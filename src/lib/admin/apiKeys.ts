import { TOP_MODEL_ORDER, IMAGE_MODEL_ORDER, VIDEO_MODEL_ORDER } from '@/server/core/llm/routing/modelConstants';

export interface ApiKeyItem {
  id: string;
  key: string;
  alias?: string;
  dailyLimit: number;
  dailyUsage: number;
  monthlyLimit: number;
  monthlyUsage: number;
  status: 'active' | 'expired' | 'revoked' | 'rate_limited';
  expiryDate?: string;
  createdAt: string;
  lastUsedAt?: string;
  cooldownUntil?: number;
  accessCode?: string;
  keyType?: 'admin_pool' | 'user_custom';
  toolUsage?: Record<string, number>;
  modelUsage?: Record<string, number>;
  modelStatus?: Record<string, 'active' | 'rate_limited' | 'dead'>;
  verifiedByAdmin?: boolean;
  lastPolledAt?: string;
  pollStatus?: 'active' | 'rate_limited' | 'revoked' | 'error';
  lastTestedLatency?: number;
  lastTestedModel?: string;
}

export interface ApiKeyUsageLog {
  id: string;
  keyId: string;
  keyMasked: string;
  endpoint: string;
  timestamp: string;
  status: 'success' | 'error' | 'rate_limited';
  modelUsed?: string;
  toolName?: string;
  latencyMs?: number;
  keySource?: 'admin_pool' | 'user_custom';
  userCode?: string;
  clientName?: string;
  fallbackReason?: string;
}

export interface ModelPriorityConfig {
  text: string[];
  image: string[];
  video: string[];
}

export const DEFAULT_MODEL_PRIORITIES: ModelPriorityConfig = {
  text: TOP_MODEL_ORDER,
  image: IMAGE_MODEL_ORDER,
  video: VIDEO_MODEL_ORDER
};

export interface CatalogModelItem {
  id: string;
  name: string;
  category: 'Text-out models' | 'Multi-modal generative models' | 'Agents' | 'Other models' | 'Voice / TTS';
  tier: 'tier1' | 'tier2' | 'tier3' | 'specialized';
  description: string;
}

export const AVAILABLE_GEMINI_MODELS_CATALOG: CatalogModelItem[] = [
  // Flagship & Workhorse (Tier 1 & Tier 2) - New Model Priorities
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Prioritas #1 Semua Tool)', category: 'Text-out models', tier: 'tier1', description: 'Flagship performa mutakhir generasi terbaru, ultra cepat untuk semua tool Satset.' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite (Prioritas #2 High Throughput)', category: 'Text-out models', tier: 'tier2', description: 'Resilient high-throughput lite model tahan beban tinggi dengan zero rate-limit spikes.' },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', category: 'Text-out models', tier: 'tier1', description: 'Flagship hybrid reasoning, cerdas untuk analisis video viral & naskah mendalam.' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', category: 'Text-out models', tier: 'tier1', description: 'Flagship high-speed throughput untuk naskah dan ide konten massal.' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', category: 'Text-out models', tier: 'tier1', description: 'Model cepat seimbang untuk tugas berat & eksekusi skrip.' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', category: 'Text-out models', tier: 'tier2', description: 'Lightweight workhorse efisien hemat biaya.' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', category: 'Text-out models', tier: 'tier1', description: 'Deep reasoning untuk bedah video & angle konten rumit.' },

  // Specialized: Audio Transcription
  { id: 'gemini-3.5-transcribe', name: 'Gemini 3.5 Transcribe (Audio Transcription Utama)', category: 'Other models', tier: 'specialized', description: 'Model spesialis transkripsi audio video presisi tinggi dengan timestamp.' },

  // Multi-modal & Images (Nano Banana family)
  { id: 'gemini-3.1-flash-image', name: 'Nano Banana 2 (Gemini 3.1 Flash Image)', category: 'Multi-modal generative models', tier: 'specialized', description: 'Generasi visual cepat multi-gaya resolusi tinggi.' },
  { id: 'gemini-3.1-flash-lite-image', name: 'Nano Banana 2 Lite (Gemini 3.1 Flash Lite Image)', category: 'Multi-modal generative models', tier: 'specialized', description: 'Generasi gambar kilat ringan hemat kuota.' },
  { id: 'gemini-3-pro-image', name: 'Nano Banana Pro (Gemini 3 Pro Image)', category: 'Multi-modal generative models', tier: 'specialized', description: 'Generasi gambar presisi tinggi fotorealistik profesional.' },
  { id: 'gemini-omni-flash', name: 'Gemini Omni Flash', category: 'Multi-modal generative models', tier: 'specialized', description: 'Multimodal terpadu serba bisa.' },

  // Audio / TTS
  { id: 'gemini-3.1-flash-tts-preview', name: 'Gemini 3.1 Flash TTS Preview', category: 'Voice / TTS', tier: 'specialized', description: 'Text-to-Speech natural intonasi tinggi generasi terbaru.' },
  { id: 'gemini-3.1-flash-tts', name: 'Gemini 3.1 Flash TTS', category: 'Voice / TTS', tier: 'specialized', description: 'Voice generation stabil responsif.' },
  { id: 'gemini-2.5-flash-tts', name: 'Gemini 2.5 Flash TTS', category: 'Voice / TTS', tier: 'specialized', description: 'Voice generation fallback.' },
  { id: 'gemini-2.5-pro-tts', name: 'Gemini 2.5 Pro TTS', category: 'Voice / TTS', tier: 'specialized', description: 'High-fidelity audio synth.' },
  { id: 'lyria-3-clip-preview', name: 'Lyria 3 Clip Preview', category: 'Voice / TTS', tier: 'specialized', description: 'Audio & background music segment generator.' },

  // Agents & Specialized
  { id: 'antigravity', name: 'Antigravity', category: 'Agents', tier: 'specialized', description: 'Autonomous agentic workflow engine.' },
  { id: 'deep-research-pro-preview', name: 'Deep Research Pro Preview', category: 'Agents', tier: 'specialized', description: 'Riset mendalam multi-sumber otomatis.' },
  { id: 'computer-use-preview', name: 'Computer Use Preview', category: 'Other models', tier: 'specialized', description: 'Automasi antarmuka dan kontrol sistem.' },
  { id: 'gemini-robotics-er-1.6-preview', name: 'Gemini Robotics ER 1.6 Preview', category: 'Other models', tier: 'specialized', description: 'Embodied reasoning & spatial logic.' },
  { id: 'gemini-robotics-er-2-preview', name: 'Gemini Robotics ER 2 Preview', category: 'Other models', tier: 'specialized', description: 'Advanced robotics spatial reasoning.' },
  { id: 'gemma-4-26b', name: 'Gemma 4 26B', category: 'Other models', tier: 'specialized', description: 'Open model efisiensi tinggi.' },
  { id: 'gemma-4-31b', name: 'Gemma 4 31B', category: 'Other models', tier: 'specialized', description: 'Open model penalaran luas.' },
  { id: 'gemini-embedding-2-preview', name: 'Gemini Embedding 2 Preview', category: 'Other models', tier: 'specialized', description: 'High-dimensional embeddings v2.' },
  { id: 'gemini-embedding-1', name: 'Gemini Embedding 1', category: 'Other models', tier: 'specialized', description: 'Vector embeddings untuk semantic search.' }
];

const LOCAL_STORAGE_APIKEYS_KEY = 'satset_apikeys_data';
const LOCAL_STORAGE_APIKEY_LOGS_KEY = 'satset_apikey_logs_data';
const LOCAL_STORAGE_MODEL_PRIORITY_KEY = 'satset_model_priority_config';

export const DEFAULT_APIKEYS: ApiKeyItem[] = [
  {
    id: 'key_01',
    key: 'AIzaSyB3_demo_key_satset_01_pro_engine',
    alias: 'Primary Gemini Flash Key',
    dailyLimit: 1000,
    dailyUsage: 142,
    monthlyLimit: 30000,
    monthlyUsage: 2840,
    status: 'active',
    createdAt: '2026-08-01T00:00:00.000Z',
    lastUsedAt: '2026-08-06T12:10:00.000Z'
  },
  {
    id: 'key_02',
    key: 'AIzaSyC7_backup_key_satset_02_rotation',
    alias: 'Backup Gemini Key #2',
    dailyLimit: 1000,
    dailyUsage: 38,
    monthlyLimit: 30000,
    monthlyUsage: 910,
    status: 'active',
    createdAt: '2026-08-01T00:00:00.000Z',
    lastUsedAt: '2026-08-06T11:45:00.000Z'
  }
];

export const DEFAULT_APIKEY_LOGS: ApiKeyUsageLog[] = [
  {
    id: 'log_101',
    keyId: 'key_01',
    keyMasked: 'AIzaSy...01_pro',
    endpoint: '/api/generate-content-ideas',
    timestamp: '2026-08-06T12:10:00.000Z',
    status: 'success'
  },
  {
    id: 'log_102',
    keyId: 'key_01',
    keyMasked: 'AIzaSy...01_pro',
    endpoint: '/api/generate-video-prompt',
    timestamp: '2026-08-06T12:05:00.000Z',
    status: 'success'
  }
];

import { getAdminHeaders, adminFetch } from './adminApi';

export function maskApiKey(key: string): string {
  if (!key) return '••••••••';
  if (key.length <= 10) return `${key.slice(0, 3)}••••${key.slice(-2)}`;
  return `${key.slice(0, 6)}••••${key.slice(-4)}`;
}

export function getApiKeys(): ApiKeyItem[] {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_APIKEYS;
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_APIKEYS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    // console.warn('[ApiKeys Lib] Error reading localStorage api keys:', e);
  }

  try {
    localStorage.setItem(LOCAL_STORAGE_APIKEYS_KEY, JSON.stringify(DEFAULT_APIKEYS));
  } catch (e) {}

  return DEFAULT_APIKEYS;
}

export async function saveApiKeysToServer(keys: ApiKeyItem[]): Promise<boolean> {
  try {
    const headers = getAdminHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/admin/apikeys', {
      method: 'POST',
      headers,
      body: JSON.stringify({ keys, logs: getApiKeyLogs() })
    });
    return res.ok;
  } catch (e) {
    console.error('[ApiKeys Lib] Server sync error:', e);
    return false;
  }
}

export function saveApiKeys(keys: ApiKeyItem[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_APIKEYS_KEY, JSON.stringify(keys));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('satset_apikeys_updated'));
    }

    // Trigger async server sync immediately
    saveApiKeysToServer(keys).catch((err) => {
      console.warn('[ApiKeys Lib] Background server sync warning:', err);
    });
  } catch (e) {
    console.error('[ApiKeys Lib] Error saving api keys:', e);
  }
}

export function saveApiKey(item: ApiKeyItem): ApiKeyItem[] {
  const current = getApiKeys();
  const index = current.findIndex((k) => k.id === item.id);
  let updated: ApiKeyItem[];

  if (index >= 0) {
    updated = [...current];
    updated[index] = item;
  } else {
    updated = [item, ...current];
  }

  saveApiKeys(updated);
  return updated;
}

export function revokeApiKey(id: string): ApiKeyItem[] {
  const current = getApiKeys();
  const updated = current.map((k) => {
    if (k.id === id) {
      return { ...k, status: 'revoked' as const };
    }
    return k;
  });
  saveApiKeys(updated);
  return updated;
}

export function rotateApiKey(oldKeyId: string, newKeyStr: string, alias?: string): ApiKeyItem[] {
  const current = getApiKeys();
  const now = new Date().toISOString();

  // Revoke old key
  const updated = current.map((k) => {
    if (k.id === oldKeyId) {
      return { ...k, status: 'revoked' as const };
    }
    return k;
  });

  // Add new key
  const newKeyItem: ApiKeyItem = {
    id: `key_${Date.now()}`,
    key: newKeyStr,
    alias: alias || `Rotated Key ${new Date().toLocaleDateString('id-ID')}`,
    dailyLimit: 1000,
    dailyUsage: 0,
    monthlyLimit: 30000,
    monthlyUsage: 0,
    status: 'active',
    createdAt: now
  };

  const finalKeys = [newKeyItem, ...updated];
  saveApiKeys(finalKeys);
  return finalKeys;
}

export function getApiKeyLogs(): ApiKeyUsageLog[] {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_APIKEY_LOGS;
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_APIKEY_LOGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {}

  try {
    localStorage.setItem(LOCAL_STORAGE_APIKEY_LOGS_KEY, JSON.stringify(DEFAULT_APIKEY_LOGS));
  } catch (e) {}

  return DEFAULT_APIKEY_LOGS;
}

export function saveApiKeyLogs(logs: ApiKeyUsageLog[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_APIKEY_LOGS_KEY, JSON.stringify(logs.slice(0, 100)));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('satset_apikey_logs_updated', { detail: logs }));
    }
  } catch (e) {}
}

export async function syncApiKeysWithBackend(): Promise<{ keys: ApiKeyItem[]; logs: ApiKeyUsageLog[] }> {
  let localKeys = getApiKeys();
  let logsResult = getApiKeyLogs();

  try {
    const res = await adminFetch('/api/apikeys');
    if (res.ok && Array.isArray(res.data)) {
      const serverKeys = res.data;
      if (serverKeys.length > 0) {
        // Merge: ensure any recently added local keys not yet in server are preserved
        const serverKeySet = new Set(serverKeys.map((k: any) => k.key));
        const localOnlyKeys = localKeys.filter((k) => !serverKeySet.has(k.key) && k.status === 'active');
        
        const combinedKeys = [...serverKeys, ...localOnlyKeys];
        localKeys = combinedKeys;

        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_APIKEYS_KEY, JSON.stringify(combinedKeys));
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('satset_apikeys_updated', { detail: combinedKeys }));
        }

        // If there were local-only keys, push the merged set back to server
        if (localOnlyKeys.length > 0) {
          saveApiKeysToServer(combinedKeys).catch(() => {});
        }
      } else if (localKeys.length > 0) {
        // Server returned empty array but local has keys: push local keys to server immediately
        saveApiKeysToServer(localKeys).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[ApiKeys] Backend sync error:', err);
  }

  try {
    const resLogs = await adminFetch('/api/apikeys/logs');
    if (resLogs.ok && Array.isArray(resLogs.data)) {
      logsResult = resLogs.data;
      saveApiKeyLogs(resLogs.data);
    }
  } catch (err) {
    console.warn('[ApiKeys] Logs backend sync error:', err);
  }

  return { keys: localKeys, logs: logsResult };
}

export function addApiKeysBulkAdmin(
  rawText: string,
  defaultLimit: number = 1000
): {
  addedKeys: ApiKeyItem[];
  addedCount: number;
  skippedDuplicatesCount: number;
  invalidLinesCount: number;
} {
  const current = getApiKeys();
  const existingKeysSet = new Set(current.map((k) => k.key.trim()));
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

  let addedCount = 0;
  let skippedDuplicatesCount = 0;
  let invalidLinesCount = 0;
  const newItems: ApiKeyItem[] = [];

  lines.forEach((line) => {
    // Validate key pattern (starts with AIza or length >= 20)
    const isValidFormat = line.startsWith('AIza') || line.length >= 20;
    if (!isValidFormat) {
      invalidLinesCount++;
      return;
    }

    if (existingKeysSet.has(line)) {
      skippedDuplicatesCount++;
      return;
    }

    existingKeysSet.add(line);
    addedCount++;

    const item: ApiKeyItem = {
      id: `key_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      key: line,
      alias: `Gemini Key #${current.length + newItems.length + 1}`,
      dailyLimit: defaultLimit,
      dailyUsage: 0,
      monthlyLimit: defaultLimit * 30,
      monthlyUsage: 0,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    newItems.push(item);
  });

  if (newItems.length > 0) {
    saveApiKeys([...newItems, ...current]);
  }

  return {
    addedKeys: newItems,
    addedCount,
    skippedDuplicatesCount,
    invalidLinesCount
  };
}

export function recordApiKeyUsage(keyId: string, modelUsed?: string, toolName?: string): void {
  try {
    const current = getApiKeys();
    const idx = current.findIndex((k) => k.id === keyId || k.key === keyId);
    if (idx >= 0) {
      const target = current[idx];
      const updated = [...current];
      const tUsage = { ...(target.toolUsage || {}) };
      if (toolName) tUsage[toolName] = (tUsage[toolName] || 0) + 1;
      const mUsage = { ...(target.modelUsage || {}) };
      if (modelUsed) mUsage[modelUsed] = (mUsage[modelUsed] || 0) + 1;

      updated[idx] = {
        ...target,
        dailyUsage: (target.dailyUsage || 0) + 1,
        monthlyUsage: (target.monthlyUsage || 0) + 1,
        lastUsedAt: new Date().toISOString(),
        toolUsage: tUsage,
        modelUsage: mUsage
      };
      saveApiKeys(updated);
    }
  } catch (e) {
    console.warn('[ApiKeys Lib] Error recording key usage:', e);
  }
}

export function addApiKeyLog(
  keyId: string,
  keyMasked: string,
  endpoint: string,
  status: 'success' | 'error' | 'rate_limited' = 'success',
  modelUsed?: string,
  toolName?: string,
  latencyMs?: number,
  keySource: 'admin_pool' | 'user_custom' = 'admin_pool'
): void {
  try {
    if (status === 'success') {
      recordApiKeyUsage(keyId, modelUsed, toolName);
    }
    const currentLogs = getApiKeyLogs();
    const newLog: ApiKeyUsageLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      keyId,
      keyMasked,
      endpoint,
      timestamp: new Date().toISOString(),
      status,
      modelUsed,
      toolName: toolName || endpoint,
      latencyMs,
      keySource
    };

    const updatedLogs = [newLog, ...currentLogs].slice(0, 100);
    saveApiKeyLogs(updatedLogs);

    // Send to backend endpoint for central database persistence
    fetch('/api/apikeys/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLog)
    }).catch(() => {});
  } catch (e) {}
}

export function getModelPriorities(): ModelPriorityConfig {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_MODEL_PRIORITIES;
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_MODEL_PRIORITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          text: Array.isArray(parsed.text) ? parsed.text : DEFAULT_MODEL_PRIORITIES.text,
          image: Array.isArray(parsed.image) ? parsed.image : DEFAULT_MODEL_PRIORITIES.image,
          video: Array.isArray(parsed.video) ? parsed.video : DEFAULT_MODEL_PRIORITIES.video
        };
      }
    }
  } catch (e) {}

  try {
    localStorage.setItem(LOCAL_STORAGE_MODEL_PRIORITY_KEY, JSON.stringify(DEFAULT_MODEL_PRIORITIES));
  } catch (e) {}

  return DEFAULT_MODEL_PRIORITIES;
}

export async function syncModelPrioritiesWithBackend(): Promise<ModelPriorityConfig> {
  try {
    const res = await fetch('/api/model-priorities');
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        const validatedConfig: ModelPriorityConfig = {
          text: Array.isArray(data.text) ? data.text : DEFAULT_MODEL_PRIORITIES.text,
          image: Array.isArray(data.image) ? data.image : DEFAULT_MODEL_PRIORITIES.image,
          video: Array.isArray(data.video) ? data.video : DEFAULT_MODEL_PRIORITIES.video
        };
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_MODEL_PRIORITY_KEY, JSON.stringify(validatedConfig));
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('satset_model_priorities_updated'));
        }
        return validatedConfig;
      }
    }
  } catch (e) {
    console.warn('[ApiKeys Lib] Failed fetching model priorities from backend:', e);
  }
  return getModelPriorities();
}

export function saveModelPriorities(config: ModelPriorityConfig): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_MODEL_PRIORITY_KEY, JSON.stringify(config));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('satset_model_priorities_updated'));
    }

    const rawSession = typeof localStorage !== 'undefined' ? localStorage.getItem('satset_user_session') : null;
    let accessCode = 'SATSET-ADMIN';
    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession);
        if (parsed?.code) accessCode = parsed.code;
      } catch (e) {}
    }

    fetch('/api/admin/model-priorities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-code': accessCode
      },
      body: JSON.stringify(config)
    }).catch((err) => console.warn('[ApiKeys Lib] Failed to persist model priorities to backend:', err));
  } catch (e) {
    console.error('[ApiKeys Lib] Failed saving model priorities:', e);
  }
}


