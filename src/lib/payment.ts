import { collection, query, getDocs, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { addSpecificAccessCode } from './auth';
import { getClients, saveClient, calculateClientStatus } from "./admin/clients";
import { getPackages } from './admin/packages';
import { getAdminHeaders, adminFetch } from './admin/adminApi';

export type TransactionStatus = 'PENDING_PROOF' | 'AWAITING_VERIFICATION' | 'APPROVED' | 'REJECTED';

export interface PlanItem {
  id: string;
  name: string;
  price: number;
  durationLabel: string;
  durationDays?: number;
  badge?: string;
  description: string;
  features?: string[];
}

export const PLANS: Record<'mingguan' | 'bulanan' | 'lifetime', PlanItem> = {
  mingguan: {
    id: 'mingguan',
    name: 'Paket Mingguan Pro',
    price: 49000,
    durationLabel: '7 Hari',
    durationDays: 7,
    description: 'Akses penuh 7 hari ke seluruh fitur AI Tools Satset.',
    features: ['Akses Penuh Seluruh Fitur AI', 'TikTok Downloader HD No Watermark', '5 Generator Ide Konten FYP']
  },
  bulanan: {
    id: 'bulanan',
    name: 'Paket Bulanan Pro',
    price: 149000,
    durationLabel: '30 Hari',
    durationDays: 30,
    badge: 'Paling Populer',
    description: 'Akses penuh 30 hari + prioritas kuota AI Anti-Limit.',
    features: ['Akses Penuh 30 Hari Tanpa Batas', 'Prioritas Kuota AI Anti-429 Rate Limit', 'Video Splitter Sora, Kling & Runway']
  },
  lifetime: {
    id: 'lifetime',
    name: 'Paket Ultra VIP Lifetime',
    price: 999000,
    durationLabel: 'Lifetime (Selamanya)',
    badge: 'Hemat Best Value',
    description: 'Sekali bayar, akses selamanya tanpa iuran bulanan.',
    features: ['Akses Selamanya Tanpa Iuran', 'Update Fitur & Model AI Gratis', 'Akses VIP Support & Komunitas']
  },
};

export interface QrisConfig {
  imageBase64: string;
  merchantName: string;
}

export interface Transaction {
  id: string; // TRX-XXXXXX-SAT
  customerName: string;
  whatsapp: string;
  email: string;
  planId: string;
  planName: string;
  packageName?: string;
  planPrice: number;
  serviceFee: number; // 2500
  totalPrice: number;
  amount?: number;
  status: TransactionStatus;
  proofImageBase64?: string;
  paymentProofBase64?: string;
  accessCode?: string;
  validUntil?: string; // e.g., "04 September 2026" or "Lifetime (Akses Selamanya)"
  createdAt: number;
  updatedAt: number;
  timestamp?: number;
  note?: string;
  rejectReason?: string;
}

const STORAGE_TRX_KEY = 'satset_transactions_db';
const STORAGE_QRIS_KEY = 'satset_qris_config';

// Default SVG QRIS image if none uploaded yet (using official brand color #5b50e5)
export const DEFAULT_QRIS_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23ffffff"/><rect x="20" y="20" width="260" height="260" fill="none" stroke="%235b50e5" stroke-width="4"/><path d="M40 40h70v70H40zM190 40h70v70h-70zM40 190h70v70H40z" fill="%235b50e5"/><path d="M55 55h40v40H55zM205 55h40v40h-40zM55 205h40v40H55z" fill="%23ffffff"/><path d="M130 40h30v30h-30zM130 90h40v40h-40zM180 130h30v30h-30zM130 180h40v40h-40zM190 190h30v30h-30z" fill="%235b50e5"/><path d="M230 220h30v30h-30zM150 240h30v30h-30z" fill="%235b50e5"/><text x="150" y="280" font-family="sans-serif" font-size="12" font-weight="bold" fill="%235b50e5" text-anchor="middle">QRIS SATSET OFFICIAL</text></svg>`;

export function getQrisConfig(): QrisConfig {
  try {
    const raw = localStorage.getItem(STORAGE_QRIS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed reading QRIS config:', err);
  }
  return {
    imageBase64: DEFAULT_QRIS_SVG,
    merchantName: 'Tools Satset Official (QRIS ALL PAYMENT)',
  };
}

export async function updateQrisConfig(newImageBase64: string, merchantName: string = 'Tools Satset Official'): Promise<{ success: boolean; error?: string }> {
  const config: QrisConfig = {
    imageBase64: newImageBase64,
    merchantName,
  };
  try {
    localStorage.setItem(STORAGE_QRIS_KEY, JSON.stringify(config));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('satset_qris_updated'));
    }
  } catch (err) {
    console.error('Failed saving QRIS config to localStorage:', err);
  }
  
  // Authoritatively sync to backend API with full admin credentials
  try {
    const res = await adminFetch<{ success: boolean; qrisConfig?: QrisConfig }>('/api/admin/qris', {
      method: 'POST',
      body: JSON.stringify(config),
    });
    if (res.ok) {
      notifyTransactionsUpdated();
      return { success: true };
    }
    return { success: false, error: res.error || 'Gagal menyimpan konfigurasi ke server' };
  } catch (e: any) {
    notifyTransactionsUpdated();
    return { success: true }; // Local cache saved successfully
  }
}

export function getAllTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_TRX_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((t: any) => {
          const proof = t.paymentProofBase64 || t.proofImageBase64 || '';
          let status = t.status as TransactionStatus;
          // Heal status if proof exists but was stuck at PENDING_PROOF
          if (proof && status === 'PENDING_PROOF') {
            status = 'AWAITING_VERIFICATION';
          }
          return {
            ...t,
            id: (t.id || '').toUpperCase(),
            packageName: t.packageName || t.planName || 'Paket Pro',
            amount: t.amount ?? t.totalPrice ?? 0,
            proofImageBase64: proof,
            paymentProofBase64: proof,
            status: status || 'PENDING_PROOF',
            timestamp: t.timestamp || t.createdAt || Date.now()
          };
        });
      }
    }
  } catch (err) {
    console.error('Failed reading transactions:', err);
  }
  return [];
}

export function saveTransactions(list: Transaction[]) {
  try {
    localStorage.setItem(STORAGE_TRX_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Failed saving transactions:', err);
  }
  notifyTransactionsUpdated();
}

export function getTransactionById(trxId: string): Transaction | null {
  const list = getAllTransactions();
  const cleaned = trxId.trim().toUpperCase();
  if (!cleaned) return null;
  return list.find((t) => 
    (t.id && t.id.toUpperCase() === cleaned) ||
    (t.whatsapp && t.whatsapp.trim().toUpperCase() === cleaned) ||
    (t.email && t.email.trim().toUpperCase() === cleaned)
  ) || null;
}

export function findTransaction(query: string): Transaction | null {
  return getTransactionById(query);
}

export async function syncTransactionsFromServer(): Promise<Transaction[]> {
  try {
    const res = await fetch('/api/transactions', {
      headers: getAdminHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        saveTransactions(data);
        return data;
      }
    }
  } catch (e) {
    // Fallback to local
  }
  return getAllTransactions();
}

export function upsertLocalTransaction(trx: Transaction) {
  const current = getAllTransactions();
  const index = current.findIndex((t) => t.id && t.id.toUpperCase() === trx.id.toUpperCase());
  if (index >= 0) {
    current[index] = { ...current[index], ...trx };
  } else {
    current.unshift(trx);
  }
  saveTransactions(current);
}

export async function fetchTransactionById(trxId: string): Promise<Transaction | null> {
  const local = getTransactionById(trxId);
  if (local) return local;
  try {
    const res = await fetch(`/api/transactions?id=${encodeURIComponent(trxId.trim().toUpperCase())}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.id) {
        upsertLocalTransaction(data);
        return data;
      }
    }
  } catch (e) {}
  return null;
}

export function createTransaction(params: {
  customerName: string;
  whatsapp: string;
  email: string;
  planId: string;
}): Transaction {
  let planName = 'Paket Pro';
  let planPrice = 149000;

  // Always check current dynamic package list first!
  try {
    const pkgs = getPackages();
    const foundPkg = pkgs.find((p) => p.id === params.planId);
    if (foundPkg) {
      planName = foundPkg.name;
      planPrice = foundPkg.price;
    } else if (PLANS[params.planId as keyof typeof PLANS]) {
      const p = PLANS[params.planId as keyof typeof PLANS];
      planName = p.name;
      planPrice = p.price;
    }
  } catch (e) {
    if (PLANS[params.planId as keyof typeof PLANS]) {
      const p = PLANS[params.planId as keyof typeof PLANS];
      planName = p.name;
      planPrice = p.price;
    }
  }

  const randomNum = Math.floor(100000 + Math.random() * 900000);
  const trxId = `TRX-${randomNum}-SAT`;

  const now = Date.now();
  const newTrx: Transaction = {
    id: trxId,
    customerName: params.customerName.trim(),
    whatsapp: params.whatsapp.trim(),
    email: params.email.trim(),
    planId: params.planId,
    planName: planName,
    packageName: planName,
    planPrice: planPrice,
    serviceFee: 2500,
    totalPrice: planPrice + 2500,
    amount: planPrice + 2500,
    status: 'PENDING_PROOF',
    createdAt: now,
    updatedAt: now,
    timestamp: now
  };

  const current = getAllTransactions();
  saveTransactions([newTrx, ...current]);

  // Sync to Firestore and backend API
  if (db) {
    setDoc(doc(db, 'transactions', newTrx.id), newTrx).catch(console.error);
  }
  fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newTrx)
  }).catch(() => {});

  return newTrx;
}

export async function uploadPaymentProof(
  trxId: string, 
  proofImageBase64: string,
  fallbackTrx?: Partial<Transaction>
): Promise<Transaction> {
  const current = getAllTransactions();
  const cleanId = trxId.trim().toUpperCase();
  const index = current.findIndex((t) => t.id.toUpperCase() === cleanId);
  const now = Date.now();

  let updatedTrx: Transaction;
  if (index >= 0) {
    updatedTrx = {
      ...current[index],
      proofImageBase64,
      paymentProofBase64: proofImageBase64,
      status: 'AWAITING_VERIFICATION' as TransactionStatus,
      updatedAt: now,
    };
    current[index] = updatedTrx;
  } else {
    updatedTrx = {
      id: cleanId,
      customerName: fallbackTrx?.customerName || 'Pembeli Satset',
      whatsapp: fallbackTrx?.whatsapp || '',
      email: fallbackTrx?.email || '',
      planId: fallbackTrx?.planId || 'bulanan',
      planName: fallbackTrx?.planName || 'Paket Bulanan Pro',
      packageName: fallbackTrx?.packageName || fallbackTrx?.planName || 'Paket Bulanan Pro',
      planPrice: fallbackTrx?.planPrice || 149000,
      serviceFee: 2500,
      totalPrice: (fallbackTrx?.planPrice || 149000) + 2500,
      amount: (fallbackTrx?.planPrice || 149000) + 2500,
      status: 'AWAITING_VERIFICATION' as TransactionStatus,
      proofImageBase64,
      paymentProofBase64: proofImageBase64,
      createdAt: fallbackTrx?.createdAt || now,
      updatedAt: now,
      timestamp: now,
    };
    current.unshift(updatedTrx);
  }

  saveTransactions(current);

  // 1. Sync directly to Firestore
  if (db) {
    setDoc(doc(db, 'transactions', cleanId), updatedTrx).catch(console.error);
  }

  // 2. Sync to backend API to broadcast event across SSE/clients
  try {
    const res = await fetch('/api/transactions/proof', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: cleanId,
        proofImageBase64,
        transaction: updatedTrx
      })
    });

    if (res && res.ok) {
      const data = await res.json();
      if (data && data.transaction) {
        upsertLocalTransaction(data.transaction);
        return data.transaction;
      }
    }
  } catch (err) {
    console.warn('[Payment] Note: synced via client storage and direct database', err);
  }

  return updatedTrx;
}

function generateAccessCodeString(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const group = () => {
    let res = '';
    for (let i = 0; i < 4; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };
  return `SATSET-${group()}-${group()}-${group()}`;
}

export async function approveTransaction(trxId: string): Promise<Transaction | null> {
  const current = getAllTransactions();
  const index = current.findIndex((t) => t.id.toUpperCase() === trxId.trim().toUpperCase());
  if (index === -1) return null;

  const trx = current[index];
  const accessCode = generateAccessCodeString();

  // Determine package duration days
  let durationDays = 30;
  try {
    const pkgs = getPackages();
    const foundPkg = pkgs.find((p) => p.id === trx.planId);
    if (foundPkg) {
      durationDays = foundPkg.durationDays;
    } else if (trx.planId === 'mingguan') {
      durationDays = 7;
    } else if (trx.planId === 'bulanan') {
      durationDays = 30;
    } else if (trx.planId === 'lifetime') {
      durationDays = 36500;
    }
  } catch (e) {
    if (trx.planId === 'mingguan') durationDays = 7;
    else if (trx.planId === 'bulanan') durationDays = 30;
    else if (trx.planId === 'lifetime') durationDays = 36500;
  }

  // Calculate validity
  let validUntilLabel = 'Lifetime (Akses Selamanya)';
  let expiryDateIso = '';

  if (durationDays < 3650) {
    const d = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    validUntilLabel = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    expiryDateIso = d.toISOString();
  } else {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 100);
    expiryDateIso = d.toISOString();
  }

  const now = Date.now();
  const pendingTrx: Transaction = {
    ...trx,
    status: 'APPROVED',
    accessCode,
    validUntil: validUntilLabel,
    updatedAt: now,
  };

  // 1. Call Backend First via adminFetch
  let finalTrx = pendingTrx;
  try {
    const apiRes = await adminFetch<{ success: boolean; transaction: Transaction; client?: any }>('/api/transactions/approve', {
      method: 'POST',
      body: JSON.stringify({
        id: trxId,
        accessCode,
        validUntil: validUntilLabel,
        transaction: pendingTrx
      })
    });

    if (apiRes.ok && apiRes.data?.transaction) {
      finalTrx = apiRes.data.transaction;
      if (apiRes.data.client) {
        saveClient(apiRes.data.client);
      }
    }
  } catch (err) {
    console.warn('[Payment Lib] Server sync notice:', err);
  }

  // 2. Register access code in local auth system & client monitoring
  addSpecificAccessCode(finalTrx.accessCode || accessCode, `Paket ${trx.planName || trx.packageName || 'Satset'} - ${trx.customerName}`);

  try {
    const clients = getClients();
    const existingClientIdx = clients.findIndex(
      (c) =>
        (c.email && trx.email && c.email.toLowerCase() === trx.email.toLowerCase()) ||
        (c.whatsapp && trx.whatsapp && c.whatsapp === trx.whatsapp) ||
        (c.accessCode && c.accessCode.toUpperCase() === (finalTrx.accessCode || accessCode).toUpperCase())
    );

    const nowIso = new Date().toISOString();
    const newClient = {
      id: existingClientIdx >= 0 ? clients[existingClientIdx].id : `cli_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      accessCode: finalTrx.accessCode || accessCode,
      name: trx.customerName || 'Klien Satset',
      whatsapp: trx.whatsapp || '',
      email: trx.email || '',
      packageId: trx.planId || 'bulanan',
      packageName: trx.planName || trx.packageName || 'Akses VIP Satset',
      price: trx.totalPrice || trx.planPrice || 0,
      startDate: nowIso,
      expiryDate: expiryDateIso,
      status: calculateClientStatus(expiryDateIso, 'active'),
      type: 'standard' as const,
      role: 'user' as const,
      allowedFeatures: [],
      maxDailyTokens: 50,
      usageCount: 0,
      createdAt: nowIso,
      toolUsage:
        existingClientIdx >= 0 && clients[existingClientIdx].toolUsage
          ? clients[existingClientIdx].toolUsage
          : {
              tiktokDownloader: 0,
              contentIdeas: 0,
              videoToPrompt: 0,
              photoPrompt: 0,
              frameExtractor: 0,
            },
    };

    saveClient(newClient);
  } catch (e) {
    console.warn('[Payment Lib] Local client auto-registration notice:', e);
  }

  // 3. Save local transaction & sync to Firestore
  current[index] = finalTrx;
  saveTransactions(current);

  if (db) {
    setDoc(doc(db, 'transactions', trxId), finalTrx).catch(console.error);
  }

  return finalTrx;
}

export async function rejectTransaction(trxId: string, reason: string): Promise<Transaction | null> {
  const current = getAllTransactions();
  const index = current.findIndex((t) => t.id.toUpperCase() === trxId.trim().toUpperCase());
  if (index === -1) return null;

  const now = Date.now();
  const rejectedTrx: Transaction = {
    ...current[index],
    status: 'REJECTED',
    rejectReason: reason.trim() || 'Bukti pembayaran tidak dapat diverifikasi atau tidak sesuai.',
    updatedAt: now,
  };

  let finalTrx = rejectedTrx;
  try {
    const apiRes = await adminFetch<{ success: boolean; transaction: Transaction }>('/api/transactions/reject', {
      method: 'POST',
      body: JSON.stringify({
        id: trxId,
        rejectReason: rejectedTrx.rejectReason,
        transaction: rejectedTrx
      })
    });

    if (apiRes.ok && apiRes.data?.transaction) {
      finalTrx = apiRes.data.transaction;
    }
  } catch (err) {
    console.warn('[Payment Lib] Server rejection sync notice:', err);
  }

  current[index] = finalTrx;
  saveTransactions(current);

  if (db) {
    setDoc(doc(db, 'transactions', trxId), finalTrx).catch(console.error);
  }

  return finalTrx;
}

export function notifyTransactionsUpdated() {
  window.dispatchEvent(new Event('transactions-updated'));
}

export function listenTransactionsUpdated(callback: () => void): () => void {
  window.addEventListener('transactions-updated', callback);
  return () => {
    window.removeEventListener('transactions-updated', callback);
  };
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}

let unsubscribeTransactions: (() => void) | null = null;

export function subscribeToTransactions() {
  if (unsubscribeTransactions) return;
  if (!db) return;
  try {
    const trxRef = collection(db, 'transactions');
    unsubscribeTransactions = onSnapshot(trxRef, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Transaction);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_TRX_KEY, JSON.stringify(data));
        window.dispatchEvent(new Event('transactions-updated'));
      }
    }, (error) => {
      console.warn('[Transactions] Firestore subscription error:', error);
    });
  } catch (e) {
    console.warn('[Transactions] Error setting up onSnapshot:', e);
  }
}

if (typeof window !== 'undefined') {
  setTimeout(() => subscribeToTransactions(), 2000);
}
