import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import firebaseConfig from '../../config/firebase-applet-config.json';
import { FIRESTORE_COLLECTIONS } from './schema';
import { adminDb } from '../lib/firebase-admin';

// Non-blocking debounced disk cache backup for high resilience & instant fallback
const CACHE_DIR = path.join(process.cwd(), 'storage');
const CACHE_FILE = path.join(CACHE_DIR, 'local_db_store.json');
let localStore: Record<string, Record<string, any>> = {};
let isDiskStoreDirty = false;
let diskStoreTimer: NodeJS.Timeout | null = null;

// Diagnostics tracker for database health monitoring
export const dbDiagnostics = {
  lastCheckTime: new Date().toISOString(),
  status: 'INITIALIZING' as 'CONNECTED' | 'STANDBY_LOCAL' | 'INITIALIZING' | 'QUOTA_EXCEEDED',
  lastError: null as { collection?: string; operation?: string; code?: string; message: string; timestamp: string } | null,
  firestoreDatabaseId: firebaseConfig.firestoreDatabaseId || '(default)',
  projectId: firebaseConfig.projectId,
};

// Ensure storage directory exists and load initial cache safely
try {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  if (fs.existsSync(CACHE_FILE)) {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    localStore = JSON.parse(raw);
  }
} catch (e: any) {
  console.warn('[dbService] Notice loading initial local_db_store:', e?.message || e);
  localStore = {};
}

const persistLocalStore = (forceImmediate = false) => {
  isDiskStoreDirty = true;
  if (!fs.existsSync(CACHE_DIR)) {
    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    } catch (err) {}
  }

  if (forceImmediate) {
    if (diskStoreTimer) {
      clearTimeout(diskStoreTimer);
      diskStoreTimer = null;
    }
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(localStore, null, 2), 'utf8');
      isDiskStoreDirty = false;
    } catch (e: any) {
      console.error('[dbService] Error persisting local database store immediately:', e?.message || e);
    }
    return;
  }

  if (!diskStoreTimer) {
    diskStoreTimer = setTimeout(() => {
      diskStoreTimer = null;
      if (isDiskStoreDirty) {
        fs.promises.writeFile(CACHE_FILE, JSON.stringify(localStore, null, 2), 'utf8')
          .then(() => { isDiskStoreDirty = false; })
          .catch((err) => {
            console.error('[dbService] Error persisting local database store asynchronously:', err?.message || err);
          });
      }
    }, 1500); // 1.5s non-blocking debounce
  }
};

/**
 * Timeout wrapper for Firestore operations to prevent hung connections
 */
const withTimeout = <T>(promise: Promise<T>, timeoutMs = 4000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Firestore request timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
};

/**
 * Categorize database error for diagnostic logging
 */
const recordDbError = (colName: string, op: string, error: any) => {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code || (message.includes('PERMISSION_DENIED') ? 'permission-denied' : message.includes('Quota exceeded') ? 'resource-exhausted' : 'unknown');
  
  dbDiagnostics.lastError = {
    collection: colName,
    operation: op,
    code,
    message,
    timestamp: new Date().toISOString(),
  };

  // Only log detailed warnings for unexpected errors to keep server logs clean
  const isExpectedServerOnly = ['apiKeys', 'apiKeyUsageLogs', 'apiKeyLogs', 'trackingEvents', 'bannedDevices', 'clients'].includes(colName);
  if (!isExpectedServerOnly || code !== 'permission-denied') {
    console.warn(`[dbService] [${op}] Firestore notice for '${colName}': ${message} -> Preserved in resilient local store.`);
  }
};

export const safeGet = async (colName: string): Promise<any[]> => {
  const startTime = Date.now();
  try {
    const snap = await withTimeout(adminDb.collection(colName).get(), 4000);
    const duration = Date.now() - startTime;
    if (duration > 500) {
      console.warn(`[Firestore Performance] Slow GET on '${colName}': ${duration}ms`);
    }
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Update local cache
    if (!localStore[colName]) localStore[colName] = {};
    for (const item of items) {
      if (item && item.id) {
        localStore[colName][item.id] = item;
      }
    }
    persistLocalStore();

    // If Firestore returned items, return them. If Firestore was empty but localStore has entries, return localStore
    if (items.length > 0) return items;
    const localItems = Object.values(localStore[colName] || {});
    return localItems.length > 0 ? localItems : items;
  } catch (e: any) {
    recordDbError(colName, 'GET', e);
    const colData = localStore[colName] || {};
    return Object.values(colData);
  }
};

export const safeGetOne = async (colName: string, docId: string): Promise<any | null> => {
  try {
    const snap = await withTimeout(adminDb.collection(colName).doc(docId).get(), 3000);
    if (snap.exists) {
      const data = { id: snap.id, ...snap.data() };
      if (!localStore[colName]) localStore[colName] = {};
      localStore[colName][docId] = data;
      persistLocalStore();
      return data;
    }
  } catch (e: any) {
    // If adminDb failed (e.g. PERMISSION_DENIED on Cloud Run), try REST API
    try {
      const restDoc = await restFirestoreGetOne(colName, docId);
      if (restDoc) {
        if (!localStore[colName]) localStore[colName] = {};
        localStore[colName][docId] = restDoc;
        persistLocalStore();
        return restDoc;
      }
    } catch (restErr) {}
    recordDbError(colName, `GET_ONE/${docId}`, e);
  }
  return localStore[colName]?.[docId] || null;
};

export const safeSave = async (colName: string, item: any): Promise<any> => {
  const startTime = Date.now();
  try {
    if (!item) return item;
    if (!item.id) item.id = 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    
    // Save to local cache first
    if (!localStore[colName]) localStore[colName] = {};
    localStore[colName][item.id] = { ...localStore[colName][item.id], ...item };
    persistLocalStore();

    // Persist to Firestore with timeout
    try {
      await withTimeout(adminDb.collection(colName).doc(String(item.id)).set(item, { merge: true }), 3000);
    } catch (adminErr) {
      // If adminDb lacks IAM, sync via REST API using Web API key
      await restFirestoreSetOne(colName, String(item.id), item);
    }
    const duration = Date.now() - startTime;
    if (duration > 500) {
      console.warn(`[Firestore Performance] Slow SAVE on '${colName}'/${item.id}: ${duration}ms`);
    }
    return item;
  } catch (e: any) {
    recordDbError(colName, `SAVE/${item?.id}`, e);
    return item;
  }
};

export const safeDelete = async (colName: string, id: string): Promise<void> => {
  try {
    if (localStore[colName] && localStore[colName][id]) {
      delete localStore[colName][id];
      persistLocalStore();
    }
    try {
      await withTimeout(adminDb.collection(colName).doc(String(id)).delete(), 3000);
    } catch (adminErr) {
      await restFirestoreDeleteOne(colName, String(id));
    }
  } catch (e: any) {
    recordDbError(colName, `DELETE/${id}`, e);
  }
};

const FIRESTORE_REST_BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId || '(default)'}/documents`;

// Helper to convert plain JS object to Firestore REST fields
const toFirestoreRestFields = (data: Record<string, any>) => {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) {
      fields[k] = { nullValue: null };
    } else if (typeof v === 'string') {
      fields[k] = { stringValue: v };
    } else if (typeof v === 'number') {
      fields[k] = { doubleValue: v };
    } else if (typeof v === 'boolean') {
      fields[k] = { booleanValue: v };
    } else if (Array.isArray(v)) {
      fields[k] = {
        arrayValue: {
          values: v.map(item =>
            typeof item === 'string' ? { stringValue: item } : { stringValue: JSON.stringify(item) }
          ),
        },
      };
    } else if (typeof v === 'object') {
      fields[k] = { stringValue: JSON.stringify(v) };
    }
  }
  return { fields };
};

// Helper to convert Firestore REST document to plain JS object
const fromFirestoreRestDoc = (doc: any) => {
  if (!doc || !doc.fields) return null;
  const res: Record<string, any> = {};
  for (const [k, v] of Object.entries(doc.fields as Record<string, any>)) {
    if (v.stringValue !== undefined) {
      if (typeof v.stringValue === 'string' && (v.stringValue.startsWith('{') || v.stringValue.startsWith('['))) {
        try {
          res[k] = JSON.parse(v.stringValue);
        } catch {
          res[k] = v.stringValue;
        }
      } else {
        res[k] = v.stringValue;
      }
    } else if (v.doubleValue !== undefined) {
      res[k] = Number(v.doubleValue);
    } else if (v.integerValue !== undefined) {
      res[k] = Number(v.integerValue);
    } else if (v.booleanValue !== undefined) {
      res[k] = v.booleanValue;
    } else if (v.nullValue !== undefined) {
      res[k] = null;
    } else if (v.arrayValue !== undefined) {
      res[k] = (v.arrayValue.values || []).map((item: any) => item.stringValue || Object.values(item)[0]);
    }
  }
  return res;
};

export const restFirestoreGetOne = async (colName: string, docId: string): Promise<any | null> => {
  try {
    const url = `${FIRESTORE_REST_BASE}/${colName}/${encodeURIComponent(docId)}?key=${firebaseConfig.apiKey}`;
    const res = await withTimeout(fetch(url), 3500);
    if (res.ok) {
      const data = await res.json();
      return fromFirestoreRestDoc(data);
    }
  } catch (err) {}
  return null;
};

export const restFirestoreSetOne = async (colName: string, docId: string, item: any): Promise<boolean> => {
  try {
    const url = `${FIRESTORE_REST_BASE}/${colName}/${encodeURIComponent(docId)}?key=${firebaseConfig.apiKey}`;
    const body = toFirestoreRestFields(item);
    const res = await withTimeout(fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }), 3500);
    return res.ok;
  } catch (err) {
    return false;
  }
};

export const restFirestoreDeleteOne = async (colName: string, docId: string): Promise<boolean> => {
  try {
    const url = `${FIRESTORE_REST_BASE}/${colName}/${encodeURIComponent(docId)}?key=${firebaseConfig.apiKey}`;
    const res = await withTimeout(fetch(url, { method: 'DELETE' }), 3500);
    return res.ok;
  } catch (err) {
    return false;
  }
};

export const testFirestoreHealth = async () => {
  const startTime = Date.now();

  // 1. Direct probe to Firestore REST API using provisioned Web API key and database ID
  try {
    const restUrl = `${FIRESTORE_REST_BASE}/_healthCheck/connection?key=${firebaseConfig.apiKey}`;
    const restRes = await withTimeout(fetch(restUrl), 3500);
    if (restRes.ok) {
      const latencyMs = Date.now() - startTime;
      dbDiagnostics.status = 'CONNECTED';
      dbDiagnostics.lastCheckTime = new Date().toISOString();
      return {
        ok: true,
        status: 'CONNECTED',
        mode: 'REMOTE_FIRESTORE',
        latencyMs,
        projectId: firebaseConfig.projectId,
        firestoreDatabaseId: firebaseConfig.firestoreDatabaseId || '(default)',
        message: 'Firestore connection verified and fully operational.',
      };
    }
  } catch (restErr) {
    // If rest failed, try secondary probe
  }

  // 2. Secondary probe on _healthCheck via adminDb
  try {
    await withTimeout(adminDb.collection('_healthCheck').doc('connection').get(), 3500);
    const latencyMs = Date.now() - startTime;
    dbDiagnostics.status = 'CONNECTED';
    dbDiagnostics.lastCheckTime = new Date().toISOString();
    return {
      ok: true,
      status: 'CONNECTED',
      mode: 'REMOTE_FIRESTORE',
      latencyMs,
      projectId: firebaseConfig.projectId,
      firestoreDatabaseId: firebaseConfig.firestoreDatabaseId || '(default)',
      message: 'Firestore connection verified and fully operational.',
    };
  } catch (e: any) {
    const latencyMs = Date.now() - startTime;
    const errMessage = e instanceof Error ? e.message : String(e);
    const isPermission = (e as any)?.code === 'permission-denied' || errMessage.includes('PERMISSION_DENIED');
    const isQuota = (e as any)?.code === 'resource-exhausted' || errMessage.includes('Quota exceeded');
    const isTimeout = errMessage.includes('timed out');
    
    const status = isQuota ? 'QUOTA_EXCEEDED' : isPermission ? 'PERMISSION_DENIED' : isTimeout ? 'TIMEOUT' : 'STANDBY_LOCAL';
    dbDiagnostics.status = status as any;
    dbDiagnostics.lastCheckTime = new Date().toISOString();

    return {
      ok: true,
      status,
      mode: 'RESILIENT_LOCAL_STORE',
      latencyMs,
      projectId: firebaseConfig.projectId,
      firestoreDatabaseId: firebaseConfig.firestoreDatabaseId || '(default)',
      detail: errMessage,
      message: isQuota
        ? 'Firestore quota exceeded. System is seamlessly serving from resilient local store.'
        : 'Firestore in standby fallback. Resilient local storage active.',
    };
  }
};

export const getDbDiagnostics = () => {
  const summary: Record<string, number> = {};
  for (const [col, docs] of Object.entries(localStore)) {
    summary[col] = Object.keys(docs || {}).length;
  }
  return {
    ...dbDiagnostics,
    localCollectionsSummary: summary,
    cacheFile: CACHE_FILE,
    cacheFileExists: fs.existsSync(CACHE_FILE),
  };
};

export const initDbSeed = async () => {
  const packagesData = [
    {
      id: 'mingguan',
      name: 'Akses Mingguan',
      tagline: 'Uji coba semua fitur AI Creator selama 7 hari penuh.',
      price: 49000,
      durationDays: 7,
      features: [
        'Akses 5 Tool AI Satset',
        'Generator Prompt Video 8K',
        'Generator Prompt Foto Ultra HD',
        'Video Frame Extractor',
        'TikTok Downloader No Watermark',
        'Bypass Kuota & Anti Limit Level 1'
      ],
      isPopular: false,
      isActive: true,
      badgeLabel: 'Hemat',
      targetCategory: 'public',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'bulanan',
      name: 'Akses Bulanan (VIP)',
      tagline: 'Pilihan favorit kreator konten & agensi digital.',
      price: 149000,
      durationDays: 30,
      features: [
        'Semua Fitur Paket Mingguan',
        'Prioritas Server Kecepatan Tinggi',
        'Bypass Kuota VIP & Anti Limit Max',
        'Format Export JSON & TXT',
        'Masa Aktif 30 Hari Penuh',
        'Dukungan Admin Fast Response'
      ],
      isPopular: true,
      isActive: true,
      badgeLabel: 'Paling Populer',
      targetCategory: 'public',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'lifetime',
      name: 'Ultra VIP Lifetime',
      tagline: 'Akses seumur hidup tanpa perpanjangan biaya bulanan.',
      price: 999000,
      durationDays: 36500,
      features: [
        'Akses Selamanya Tanpa Batas',
        'Semua Fitur VIP + Update Masa Depan',
        'Server Dedicated AI Engine',
        'Grup Komunitas Exclusive VIP',
        'Lisensi Komersial Konten Kreator'
      ],
      isPopular: false,
      isActive: true,
      badgeLabel: 'Sultan VIP',
      targetCategory: 'public',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'upgrade_vip',
      name: 'Perpanjang / Upgrade Member VIP',
      tagline: 'Penawaran khusus member terdaftar untuk perpanjangan atau upgrade akun.',
      price: 99000,
      durationDays: 30,
      features: [
        'Harga Khusus Perpanjangan Member',
        'Semua Fitur VIP + Priority Server',
        'Bypass Kuota & Anti Limit Max',
        'Akses Bebas Pemblokiran',
        'Dukungan Langsung via Admin VIP'
      ],
      isPopular: false,
      isActive: true,
      badgeLabel: 'Khusus Member',
      targetCategory: 'member',
      updatedAt: new Date().toISOString()
    }
  ];

  const defaultClients = [
    {
      id: 'cli_001',
      accessCode: 'SATSET-882194',
      name: 'Rizky Ramadhan',
      whatsapp: '081234567890',
      email: 'rizky@gmail.com',
      packageId: 'bulanan',
      packageName: 'Akses Bulanan (VIP)',
      price: 149000,
      startDate: '2026-08-01T10:00:00.000Z',
      expiryDate: '2026-08-31T10:00:00.000Z',
      status: 'active',
      type: 'standard',
      role: 'user',
      allowedFeatures: [],
      maxDailyTokens: 50,
      usageCount: 0,
      lastLoginAt: Date.parse('2026-08-06T08:00:00.000Z'),
      toolUsage: { tiktokDownloader: 12, contentIdeas: 8, videoToPrompt: 15, photoPrompt: 6, frameExtractor: 4 },
      createdAt: '2026-08-01T10:00:00.000Z'
    },
    {
      id: 'cli_002',
      accessCode: 'SATSET-331209',
      name: 'Budi Santoso',
      whatsapp: '085711223344',
      email: 'budi.santoso@yahoo.com',
      packageId: 'mingguan',
      packageName: 'Akses Mingguan',
      price: 49000,
      startDate: '2026-08-02T12:00:00.000Z',
      expiryDate: '2026-08-09T12:00:00.000Z',
      status: 'expiring_soon',
      type: 'standard',
      role: 'user',
      allowedFeatures: [],
      maxDailyTokens: 50,
      usageCount: 0,
      lastLoginAt: Date.parse('2026-08-05T14:30:00.000Z'),
      toolUsage: { tiktokDownloader: 5, contentIdeas: 3, videoToPrompt: 4, photoPrompt: 2, frameExtractor: 1 },
      createdAt: '2026-08-02T12:00:00.000Z'
    }
  ];

  // 1. Ensure local store is primed immediately so client requests never encounter empty collections
  const pkgColName = FIRESTORE_COLLECTIONS.PACKAGES || 'packages';
  if (!localStore[pkgColName] || Object.keys(localStore[pkgColName]).length === 0) {
    localStore[pkgColName] = {};
    for (const p of packagesData) {
      localStore[pkgColName][p.id] = p;
    }
  }

  const clientColName = FIRESTORE_COLLECTIONS.CLIENTS || 'clients';
  if (!localStore[clientColName] || Object.keys(localStore[clientColName]).length === 0) {
    localStore[clientColName] = {};
    for (const c of defaultClients) {
      localStore[clientColName][c.id] = c;
    }
  }
  persistLocalStore(true);

  // 2. Attempt remote Firestore synchronization with non-blocking error handling
  try {
    const pkgSnap = await withTimeout(adminDb.collection(pkgColName).get(), 3000);
    if (pkgSnap.empty) {
      console.log('[DB Seed] Seeding initial subscription packages to Firestore...');
      for (const p of packagesData) {
        await adminDb.collection(pkgColName).doc(p.id).set(p);
      }
      console.log('[DB Seed] Packages successfully seeded to Firestore.');
    }
  } catch (err: any) {
    // Gracefully handled; local store fallback is already active
    recordDbError(pkgColName, 'SEED_PACKAGES', err);
  }

  try {
    const clientSnap = await withTimeout(adminDb.collection(clientColName).get(), 3000);
    if (clientSnap.empty) {
      console.log('[DB Seed] Seeding initial clients to Firestore...');
      for (const c of defaultClients) {
        await adminDb.collection(clientColName).doc(c.id).set(c);
      }
      console.log('[DB Seed] Clients successfully seeded to Firestore.');
    }
  } catch (err: any) {
    // Gracefully handled; local store fallback is already active
    recordDbError(clientColName, 'SEED_CLIENTS', err);
  }
};

export const dbGetClients = async () => safeGet(FIRESTORE_COLLECTIONS.CLIENTS || 'clients');
export const dbGetPackages = async () => safeGet(FIRESTORE_COLLECTIONS.PACKAGES || 'packages');
export const dbGetTransactions = async () => safeGet(FIRESTORE_COLLECTIONS.TRANSACTIONS || 'transactions');
export const dbGetAuditLogs = async () => safeGet(FIRESTORE_COLLECTIONS.AUDIT_LOGS || 'auditLogs');
export const dbGetTrackingEvents = async () => safeGet(FIRESTORE_COLLECTIONS.TRACKING_EVENTS || 'trackingEvents');
export const dbGetLearningQueue = async () => safeGet(FIRESTORE_COLLECTIONS.LEARNING_QUEUE || 'learningQueue');
export const dbGetAccessCodes = async () => safeGet(FIRESTORE_COLLECTIONS.ACCESS_CODES || 'accessCodes');
export const dbGetAiAgents = async () => safeGet(FIRESTORE_COLLECTIONS.AI_AGENTS || 'aiAgents');
export const dbGetCategoryTaxonomy = async () => safeGet(FIRESTORE_COLLECTIONS.CATEGORY_TAXONOMY || 'categoryTaxonomy');

export const dbSaveCategoryTaxonomyItem = async (item: any) => {
  if (Array.isArray(item)) {
    for (const i of item) await safeSave(FIRESTORE_COLLECTIONS.CATEGORY_TAXONOMY || 'categoryTaxonomy', i);
  } else {
    await safeSave(FIRESTORE_COLLECTIONS.CATEGORY_TAXONOMY || 'categoryTaxonomy', item);
  }
};

export const dbGetCategoryProposals = async () => safeGet(FIRESTORE_COLLECTIONS.CATEGORY_TAXONOMY_PROPOSALS || 'categoryTaxonomyProposals');
export const dbSaveCategoryProposal = async (item: any) => {
  if (Array.isArray(item)) {
    for (const i of item) await safeSave(FIRESTORE_COLLECTIONS.CATEGORY_TAXONOMY_PROPOSALS || 'categoryTaxonomyProposals', i);
  } else {
    await safeSave(FIRESTORE_COLLECTIONS.CATEGORY_TAXONOMY_PROPOSALS || 'categoryTaxonomyProposals', item);
  }
};

export const dbGetPendingSchemaChanges = async () => safeGet(FIRESTORE_COLLECTIONS.PENDING_SCHEMA_CHANGES || 'pendingSchemaChanges');
export const dbSavePendingSchemaChange = async (item: any) => {
  if (Array.isArray(item)) {
    for (const i of item) await safeSave(FIRESTORE_COLLECTIONS.PENDING_SCHEMA_CHANGES || 'pendingSchemaChanges', i);
  } else {
    await safeSave(FIRESTORE_COLLECTIONS.PENDING_SCHEMA_CHANGES || 'pendingSchemaChanges', item);
  }
};

export const dbGetHistory = async (accessCode?: string) => {
  const allHistory = await safeGet(FIRESTORE_COLLECTIONS.HISTORY || 'history');
  if (!accessCode || !accessCode.trim()) return allHistory;
  const cleanCode = accessCode.trim().toUpperCase();
  return allHistory.filter((item: any) => !item.accessCode || item.accessCode.toUpperCase() === cleanCode);
};
export const dbSaveHistoryItem = async (item: any) => {
  if (Array.isArray(item)) {
    for (const i of item) await safeSave(FIRESTORE_COLLECTIONS.HISTORY || 'history', i);
  } else {
    await safeSave(FIRESTORE_COLLECTIONS.HISTORY || 'history', item);
  }
};
export const dbDeleteHistoryItem = async (id: string) => safeDelete(FIRESTORE_COLLECTIONS.HISTORY || 'history', id);

export const dbGetBannedDevices = async () => safeGet(FIRESTORE_COLLECTIONS.BANNED_DEVICES || 'bannedDevices');
export const dbSaveBannedDevice = async (item: any) => {
  if (Array.isArray(item)) {
    for (const i of item) await safeSave(FIRESTORE_COLLECTIONS.BANNED_DEVICES || 'bannedDevices', i);
  } else {
    await safeSave(FIRESTORE_COLLECTIONS.BANNED_DEVICES || 'bannedDevices', item);
  }
};
export const dbDeleteBannedDevice = async (id: string) => safeDelete(FIRESTORE_COLLECTIONS.BANNED_DEVICES || 'bannedDevices', id);

export const hashAccessCode = (code: string): string => {
  if (!code) return '';
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
};

export const dbSaveClient = async (item: any) => {
  const sanitizeClient = (raw: any) => {
    if (!raw) return raw;
    const copy = { ...raw };
    if (copy.accessCode && !copy.accessCodeHash) {
      copy.accessCodeHash = hashAccessCode(copy.accessCode);
    }
    return copy;
  };

  if (Array.isArray(item)) {
    for (const i of item) await safeSave(FIRESTORE_COLLECTIONS.CLIENTS || 'clients', sanitizeClient(i));
  } else {
    await safeSave(FIRESTORE_COLLECTIONS.CLIENTS || 'clients', sanitizeClient(item));
  }
};
export const dbDeleteClient = async (id: string) => safeDelete(FIRESTORE_COLLECTIONS.CLIENTS || 'clients', id);

export const dbSavePackage = async (item: any) => {
  if (Array.isArray(item)) {
    for (const i of item) await safeSave(FIRESTORE_COLLECTIONS.PACKAGES || 'packages', i);
  } else {
    await safeSave(FIRESTORE_COLLECTIONS.PACKAGES || 'packages', item);
  }
};
export const dbDeletePackage = async (id: string) => safeDelete(FIRESTORE_COLLECTIONS.PACKAGES || 'packages', id);

export const dbSaveTransaction = async (item: any) => {
  if (Array.isArray(item)) {
    for (const i of item) await safeSave(FIRESTORE_COLLECTIONS.TRANSACTIONS || 'transactions', i);
  } else {
    await safeSave(FIRESTORE_COLLECTIONS.TRANSACTIONS || 'transactions', item);
  }
};
export const dbDeleteTransaction = async (id: string) => safeDelete(FIRESTORE_COLLECTIONS.TRANSACTIONS || 'transactions', id);

export const dbSaveAiAgent = async (item: any) => {
  if (Array.isArray(item)) {
    for (const i of item) await safeSave(FIRESTORE_COLLECTIONS.AI_AGENTS || 'aiAgents', i);
  } else {
    await safeSave(FIRESTORE_COLLECTIONS.AI_AGENTS || 'aiAgents', item);
  }
};
export const dbDeleteAiAgent = async (id: string) => safeDelete(FIRESTORE_COLLECTIONS.AI_AGENTS || 'aiAgents', id);

let cachedApiKeys: any[] | null = null;
let cachedApiKeysAt = 0;
const API_KEYS_CACHE_TTL_MS = 15000;

export const dbGetApiKeys = async (forceRefresh = false): Promise<any[]> => {
  const now = Date.now();
  if (!forceRefresh && cachedApiKeys && (now - cachedApiKeysAt < API_KEYS_CACHE_TTL_MS)) {
    return cachedApiKeys;
  }

  const colName = FIRESTORE_COLLECTIONS.API_KEYS || 'apiKeys';
  let keysList: any[] = [];

  try {
    const snap = await adminDb.collection(colName).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (items.length > 0) {
      if (!localStore[colName]) localStore[colName] = {};
      for (const item of items) {
        if (item && item.id) {
          localStore[colName][item.id] = item;
        }
      }
      persistLocalStore(true);
      keysList = items;
    } else {
      keysList = Object.values(localStore[colName] || {});
    }
  } catch (e: any) {
    keysList = Object.values(localStore[colName] || {});
    if (keysList.length === 0) {
      console.info(`[dbService] Note: Firestore apiKeys not loaded (${e?.message || e}), using in-memory store.`);
    }
  }

  // Ensure system GEMINI_API_KEY is available in the pool if no active custom keys exist
  const hasRealKey = keysList.some(
    (k) =>
      k &&
      typeof k.key === 'string' &&
      k.key.length > 10 &&
      !k.key.includes('demo_key') &&
      !k.key.includes('backup_key_satset') &&
      k.status !== 'revoked'
  );

  const envKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
  if (!hasRealKey && envKey) {
    keysList.push({
      id: 'admin_pool_env_primary',
      key: envKey,
      name: 'Primary Admin Key (Environment)',
      alias: 'Admin System Pool Key',
      status: 'active',
      dailyUsage: 0,
      dailyLimit: 1500,
      healthScore: 100,
      latencyMs: 150,
      available_models: [
        'gemini-3.8-flash',
        'gemini-3.7-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-3.1-pro-preview',
      ],
    });
  }

  cachedApiKeys = keysList;
  cachedApiKeysAt = now;
  return keysList;
};

export const dbGetApiKeysSync = (): any[] => {
  if (cachedApiKeys && cachedApiKeys.length > 0) {
    return cachedApiKeys;
  }
  const colName = FIRESTORE_COLLECTIONS.API_KEYS || 'apiKeys';
  return Object.values(localStore[colName] || {});
};

export const dbSaveApiKeys = async (item: any) => {
  cachedApiKeys = null;
  cachedApiKeysAt = 0;
  const colName = FIRESTORE_COLLECTIONS.API_KEYS || 'apiKeys';
  if (!localStore[colName]) localStore[colName] = {};

  if (Array.isArray(item)) {
    // Reset localStore for apiKeys to match the exact list being saved
    const newStore: Record<string, any> = {};
    for (const i of item) {
      if (i && (i.key || i.id)) {
        const id = String(i.id || `key_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
        const cleanItem = { ...i, id };
        newStore[id] = cleanItem;
        
        // Persist each to Firestore asynchronously
        try {
          await adminDb.collection(colName).doc(id).set(cleanItem, { merge: true });
        } catch (err: any) {
          const msg = String(err?.message || err);
          if (!msg.includes('PERMISSION_DENIED') && !msg.includes('7 PERMISSION_DENIED')) {
            console.warn(`[dbService] Firestore set error for key ${id}:`, msg);
          }
        }
      }
    }
    localStore[colName] = newStore;
    persistLocalStore(true);
  } else if (item && (item.key || item.id)) {
    const id = String(item.id || `key_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
    const cleanItem = { ...item, id };
    localStore[colName][id] = cleanItem;
    persistLocalStore(true);
    try {
      await adminDb.collection(colName).doc(id).set(cleanItem, { merge: true });
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (!msg.includes('PERMISSION_DENIED') && !msg.includes('7 PERMISSION_DENIED')) {
        console.warn(`[dbService] Firestore set error for single key ${id}:`, msg);
      }
    }
  }
};

export const dbDeleteApiKey = async (id: string) => {
  const colName = FIRESTORE_COLLECTIONS.API_KEYS || 'apiKeys';
  if (localStore[colName] && localStore[colName][id]) {
    delete localStore[colName][id];
    persistLocalStore(true);
  }
  try {
    await adminDb.collection(colName).doc(String(id)).delete();
  } catch (e: any) {
    console.warn(`[dbService] Deleting apiKey '${id}' from Firestore notice:`, e?.message || e);
  }
};

export const dbAddApiKeyLog = async (item: any) => safeSave(FIRESTORE_COLLECTIONS.API_KEY_LOGS || 'apiKeyUsageLogs', item);
export const dbAddAuditLog = async (item: any) => safeSave(FIRESTORE_COLLECTIONS.AUDIT_LOGS || 'auditLogs', item);

export const dbSaveAccessCode = async (item: any) => {
  const sanitizeAccessCode = (raw: any) => {
    if (!raw) return raw;
    const copy = { ...raw };
    const plain = copy.code || copy.accessCode;
    if (plain) {
      copy.accessCodeHash = hashAccessCode(plain);
      // Retain masked representation for admin UI verification without exposing raw credential
      copy.codeMasked = plain.length > 8 ? `${plain.slice(0, 4)}••••${plain.slice(-3)}` : '••••••••';
      // Ensure raw code is not stored in sensitive credential storage
      copy.code = copy.accessCodeHash;
    }
    return copy;
  };

  if (Array.isArray(item)) {
    for (const i of item) await safeSave(FIRESTORE_COLLECTIONS.ACCESS_CODES || 'accessCodes', sanitizeAccessCode(i));
  } else {
    await safeSave(FIRESTORE_COLLECTIONS.ACCESS_CODES || 'accessCodes', sanitizeAccessCode(item));
  }
};
export const dbDeleteAccessCode = async (id: string) => safeDelete(FIRESTORE_COLLECTIONS.ACCESS_CODES || 'accessCodes', id);

export const dbGetApiKeyLogs = async () => safeGet(FIRESTORE_COLLECTIONS.API_KEY_LOGS || 'apiKeyUsageLogs');
export const dbSaveApiKeyLogs = async (item: any) => {
  if (Array.isArray(item)) {
    for (const i of item) await safeSave(FIRESTORE_COLLECTIONS.API_KEY_LOGS || 'apiKeyUsageLogs', i);
  } else {
    await safeSave(FIRESTORE_COLLECTIONS.API_KEY_LOGS || 'apiKeyUsageLogs', item);
  }
};

export const dbAddTrackingEvent = async (item: any) => safeSave(FIRESTORE_COLLECTIONS.TRACKING_EVENTS || 'trackingEvents', item);

export const dbSaveLearningQueueItem = async (item: any) => {
  if (Array.isArray(item)) {
    for (const i of item) await safeSave(FIRESTORE_COLLECTIONS.LEARNING_QUEUE || 'learningQueue', i);
  } else {
    await safeSave(FIRESTORE_COLLECTIONS.LEARNING_QUEUE || 'learningQueue', item);
  }
};

export const dbGetSystemMemory = async (): Promise<any> => (await safeGetOne(FIRESTORE_COLLECTIONS.CONFIGS || 'configs', 'systemMemory')) || {};
export const dbSaveSystemMemory = async (data: any) => safeSave(FIRESTORE_COLLECTIONS.CONFIGS || 'configs', { id: 'systemMemory', ...data });

export const dbGetQrisConfig = async (): Promise<any> => (await safeGetOne(FIRESTORE_COLLECTIONS.CONFIGS || 'configs', 'qris')) || {};
export const dbSaveQrisConfig = async (data: any) => safeSave(FIRESTORE_COLLECTIONS.CONFIGS || 'configs', { id: 'qris', ...data });

export const dbGetContactSettings = async (): Promise<any> => (await safeGetOne(FIRESTORE_COLLECTIONS.CONFIGS || 'configs', 'contact')) || {};
export const dbSaveContactSettings = async (data: any) => safeSave(FIRESTORE_COLLECTIONS.CONFIGS || 'configs', { id: 'contact', ...data });

export const dbGetGrowthState = async (): Promise<any> => (await safeGetOne(FIRESTORE_COLLECTIONS.CONFIGS || 'configs', 'growthState')) || {};
export const dbSaveGrowthState = async (data: any) => safeSave(FIRESTORE_COLLECTIONS.CONFIGS || 'configs', { id: 'growthState', ...data });

export const dbGetActiveGenerations = async (): Promise<any> => (await safeGetOne(FIRESTORE_COLLECTIONS.CONFIGS || 'configs', 'activeGenerations')) || {};
export const dbSaveActiveGenerations = async (data: any) => safeSave(FIRESTORE_COLLECTIONS.CONFIGS || 'configs', { id: 'activeGenerations', ...data });

export const dbGetModelPriorities = async (): Promise<any> => (await safeGetOne(FIRESTORE_COLLECTIONS.CONFIGS || 'configs', 'modelPriorities')) || null;
export const dbSaveModelPriorities = async (data: any) => safeSave(FIRESTORE_COLLECTIONS.CONFIGS || 'configs', { id: 'modelPriorities', ...data });

