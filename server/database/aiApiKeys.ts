/**
 * @deprecated
 * DEPRECATED: This module managed the separate Firestore collection "ai_api_keys".
 * To fix BUG 1 (Dual Key Pools), all key management is now unified in the "apiKeys"
 * collection managed by dbService (dbGetApiKeys / dbSaveApiKeys) and server/workflows/api-keys/service.ts.
 * 
 * Please do not write new logic that queries the "ai_api_keys" collection.
 */

import { safeGet, safeGetOne, safeSave, safeDelete } from '@/src/db/dbService';
import { logger } from '@/server/core/utils/logger';

export interface AiApiKey {
  id: string;
  provider: 'gemini' | 'openai' | string;
  api_key?: string;
  encrypted_key: string;
  status: 'active' | 'cooldown' | 'disabled' | 'rate_limited' | 'error' | 'revoked';
  available_models: string[];
  health_score: number; // 0 - 100
  total_requests: number;
  failed_requests: number;
  usage_count?: number; // legacy alias for total_requests
  error_count?: number; // legacy alias for failed_requests
  last_used: string;
  cooldown_until: number;
  rpm_usage: number;
  tpm_usage: number;
  daily_usage: number;
  quota_status: 'healthy' | 'warning' | 'exhausted';
  latency_average: number; // in ms
  priority: number; // 1 = highest priority weight
  rpm_limit: number;
  tpm_limit: number;
  daily_limit: number;
  last_error?: string;
  created_at: string;
  alias?: string;
}

const COLLECTION_NAME = 'ai_api_keys';

const DEFAULT_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite',
];

/**
  * Calculate dynamic Key Health Score (0 - 100)
  */
export function calculateKeyHealthScore(key: Partial<AiApiKey>): number {
  if (key.status === 'disabled' || key.status === 'revoked') return 0;
  if (key.status === 'cooldown' || key.status === 'rate_limited') return 10;

  const total = key.total_requests || key.usage_count || 0;
  const failed = key.failed_requests || key.error_count || 0;

  let baseScore = 100;

  // Penalty for failed requests ratio
  if (total > 0) {
    const errorRatio = failed / total;
    baseScore -= Math.min(60, errorRatio * 100);
  }

  // Penalty for high latency (> 1000ms)
  const latency = key.latency_average || 200;
  if (latency > 1000) {
    baseScore -= Math.min(20, (latency - 1000) / 100);
  }

  // Penalty for near-daily-limit usage
  const daily = key.daily_usage || 0;
  const limit = key.daily_limit || 1500;
  if (limit > 0 && daily > limit * 0.8) {
    baseScore -= 15;
  }

  return Math.max(1, Math.min(100, Math.round(baseScore)));
}

/**
 * Calculate Intelligent Key Score for Load Balancing Router
 * KEY_SCORE = Health Score + Remaining Quota Weight + Latency Weight + Usage Weight + Priority Weight
 */
export function calculateKeyRoutingScore(key: AiApiKey): number {
  if (key.status === 'disabled' || key.status === 'revoked') return -1000;
  const now = Date.now();
  if (key.cooldown_until && key.cooldown_until > now) return -500;

  const healthScore = key.health_score || calculateKeyHealthScore(key);

  // Remaining Quota Weight (0 - 25)
  const dailyLimit = key.daily_limit || 1500;
  const remainingRatio = Math.max(0, (dailyLimit - (key.daily_usage || 0)) / dailyLimit);
  const quotaWeight = remainingRatio * 25;

  // Latency Weight (0 - 20)
  const latency = key.latency_average || 200;
  const latencyWeight = Math.max(0, 20 - (latency / 100));

  // Priority Weight (0 - 30)
  const priorityWeight = Math.max(0, 30 - (key.priority || 10));

  // Usage Balance Weight (0 - 15) -> reward keys with fewer requests to distribute load
  const usageWeight = Math.max(0, 15 - Math.min(15, (key.total_requests || 0) / 100));

  return Math.round(healthScore * 0.4 + quotaWeight + latencyWeight + priorityWeight + usageWeight);
}

/**
 * Seed default Admin API Key Pool if none exist
 */
export async function seedDefaultAiApiKeysIfEmpty(): Promise<AiApiKey[]> {
  try {
    const existing = await safeGet(COLLECTION_NAME);
    if (existing && existing.length > 0) {
      for (const k of existing) {
        if (
          process.env.GEMINI_API_KEY &&
          (k.encrypted_key?.includes('GeminiPoolKey') || k.encrypted_key?.includes('DefaultKey') || k.status === 'disabled')
        ) {
          k.encrypted_key = process.env.GEMINI_API_KEY;
          k.api_key = process.env.GEMINI_API_KEY;
          k.status = 'active';
          k.failed_requests = 0;
          k.error_count = 0;
          k.health_score = 100;
          await safeSave(COLLECTION_NAME, k);
        }
      }
      return existing as AiApiKey[];
    }

    const defaultKeys: AiApiKey[] = [
      {
        id: 'ai_key_pool_1',
        provider: 'gemini',
        api_key: process.env.GEMINI_API_KEY || '',
        encrypted_key: process.env.GEMINI_API_KEY || 'AIzaSyDefaultKey1_GeminiPoolKey',
        status: 'active',
        available_models: DEFAULT_MODELS,
        health_score: 100,
        total_requests: 0,
        failed_requests: 0,
        usage_count: 0,
        error_count: 0,
        last_used: new Date().toISOString(),
        cooldown_until: 0,
        rpm_usage: 0,
        tpm_usage: 0,
        daily_usage: 0,
        quota_status: 'healthy',
        latency_average: 180,
        priority: 1,
        rpm_limit: 60,
        tpm_limit: 1000000,
        daily_limit: 1500,
        created_at: new Date().toISOString(),
        alias: 'API KEY 1 (Primary Flash Pool)',
      },
      {
        id: 'ai_key_pool_2',
        provider: 'gemini',
        api_key: process.env.GEMINI_API_KEY_SECONDARY || process.env.GEMINI_API_KEY || '',
        encrypted_key: process.env.GEMINI_API_KEY_SECONDARY || process.env.GEMINI_API_KEY || 'AIzaSyDefaultKey2_GeminiPoolKey',
        status: 'active',
        available_models: DEFAULT_MODELS,
        health_score: 100,
        total_requests: 0,
        failed_requests: 0,
        usage_count: 0,
        error_count: 0,
        last_used: new Date().toISOString(),
        cooldown_until: 0,
        rpm_usage: 0,
        tpm_usage: 0,
        daily_usage: 0,
        quota_status: 'healthy',
        latency_average: 220,
        priority: 2,
        rpm_limit: 60,
        tpm_limit: 1000000,
        daily_limit: 1500,
        created_at: new Date().toISOString(),
        alias: 'API KEY 2 (Secondary Fallback Pool)',
      },
      {
        id: 'ai_key_pool_3',
        provider: 'gemini',
        api_key: process.env.GEMINI_API_KEY_TERTIARY || process.env.GEMINI_API_KEY || '',
        encrypted_key: process.env.GEMINI_API_KEY_TERTIARY || process.env.GEMINI_API_KEY || 'AIzaSyDefaultKey3_GeminiPoolKey',
        status: 'active',
        available_models: DEFAULT_MODELS,
        health_score: 100,
        total_requests: 0,
        failed_requests: 0,
        usage_count: 0,
        error_count: 0,
        last_used: new Date().toISOString(),
        cooldown_until: 0,
        rpm_usage: 0,
        tpm_usage: 0,
        daily_usage: 0,
        quota_status: 'healthy',
        latency_average: 250,
        priority: 3,
        rpm_limit: 60,
        tpm_limit: 1000000,
        daily_limit: 1500,
        created_at: new Date().toISOString(),
        alias: 'API KEY 3 (Emergency Lite Pool)',
      },
    ];

    for (const key of defaultKeys) {
      await safeSave(COLLECTION_NAME, key);
    }
    logger.info('[aiApiKeys] Default AI Key Registry Pool seeded successfully.');
    return defaultKeys;
  } catch (error) {
    logger.error('[aiApiKeys] Failed to seed default API keys:', error);
    return [];
  }
}

export async function getAiApiKeys(): Promise<AiApiKey[]> {
  try {
    let keys = (await safeGet(COLLECTION_NAME)) as AiApiKey[];
    if (!keys || keys.length === 0) {
      keys = await seedDefaultAiApiKeysIfEmpty();
    }
    return keys.map((k) => ({
      ...k,
      health_score: k.health_score || calculateKeyHealthScore(k),
      available_models: k.available_models && k.available_models.length > 0 ? k.available_models : DEFAULT_MODELS,
    })).sort((a, b) => calculateKeyRoutingScore(b) - calculateKeyRoutingScore(a));
  } catch (err) {
    logger.error('[aiApiKeys] Error fetching AI API keys:', err);
    return [];
  }
}

export async function getAiApiKeyById(id: string): Promise<AiApiKey | null> {
  try {
    const key = (await safeGetOne(COLLECTION_NAME, id)) as AiApiKey | null;
    if (!key) return null;
    return {
      ...key,
      health_score: key.health_score || calculateKeyHealthScore(key),
      available_models: key.available_models && key.available_models.length > 0 ? key.available_models : DEFAULT_MODELS,
    };
  } catch (err) {
    logger.error(`[aiApiKeys] Error fetching AI API key ${id}:`, err);
    return null;
  }
}

export async function createAiApiKey(data: Partial<AiApiKey>): Promise<AiApiKey> {
  const rawKey = data.api_key || data.encrypted_key || '';
  const newKey: AiApiKey = {
    id: data.id || `key_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    provider: data.provider || 'gemini',
    api_key: rawKey,
    encrypted_key: rawKey,
    status: data.status || 'active',
    available_models: data.available_models && data.available_models.length > 0 ? data.available_models : DEFAULT_MODELS,
    health_score: 100,
    total_requests: 0,
    failed_requests: 0,
    usage_count: 0,
    error_count: 0,
    last_used: new Date().toISOString(),
    cooldown_until: 0,
    rpm_usage: 0,
    tpm_usage: 0,
    daily_usage: 0,
    quota_status: 'healthy',
    latency_average: 200,
    priority: data.priority !== undefined ? data.priority : 10,
    rpm_limit: data.rpm_limit || 60,
    tpm_limit: data.tpm_limit || 1000000,
    daily_limit: data.daily_limit || 1500,
    created_at: new Date().toISOString(),
    alias: data.alias || `API KEY Registry`,
  };

  await safeSave(COLLECTION_NAME, newKey);
  return newKey;
}

export async function updateAiApiKey(id: string, updates: Partial<AiApiKey>): Promise<AiApiKey | null> {
  const existing = await getAiApiKeyById(id);
  if (!existing) return null;

  const merged = {
    ...existing,
    ...updates,
  };
  merged.health_score = calculateKeyHealthScore(merged);

  await safeSave(COLLECTION_NAME, merged);
  return merged;
}

export async function deleteAiApiKey(id: string): Promise<boolean> {
  try {
    await safeDelete(COLLECTION_NAME, id);
    return true;
  } catch (err) {
    logger.error(`[aiApiKeys] Error deleting AI API key ${id}:`, err);
    return false;
  }
}

export async function recordApiKeyUsage(id: string, latencyMs = 200): Promise<void> {
  const existing = await getAiApiKeyById(id);
  if (existing) {
    const totalReqs = (existing.total_requests || existing.usage_count || 0) + 1;
    const oldAvg = existing.latency_average || 200;
    const newAvg = Math.round(oldAvg * 0.8 + latencyMs * 0.2);
    const daily = (existing.daily_usage || 0) + 1;
    const quotaStatus = daily > (existing.daily_limit || 1500) * 0.9 ? 'warning' : 'healthy';

    await updateAiApiKey(id, {
      total_requests: totalReqs,
      usage_count: totalReqs,
      daily_usage: daily,
      latency_average: newAvg,
      quota_status: quotaStatus,
      last_used: new Date().toISOString(),
    });
  }
}

export async function recordApiKeyError(
  id: string,
  errorMsg: string,
  httpStatus?: number
): Promise<void> {
  const existing = await getAiApiKeyById(id);
  if (!existing) return;

  const failedReqs = (existing.failed_requests || existing.error_count || 0) + 1;
  const updates: Partial<AiApiKey> = {
    failed_requests: failedReqs,
    error_count: failedReqs,
    last_error: errorMsg,
  };

  if (httpStatus === 401 || errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('401')) {
    updates.status = 'disabled';
    updates.health_score = 0;
    updates.quota_status = 'exhausted';
    logger.warn(`[aiApiKeys] API Key ${id} disabled due to 401 Unauthorized`);
  } else if (httpStatus === 429 || errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
    updates.status = 'rate_limited';
    updates.cooldown_until = Date.now() + 150000; // 2.5 minutes cooldown
    updates.quota_status = 'exhausted';
    logger.warn(`[aiApiKeys] API Key ${id} marked rate_limited`);
  }

  await updateAiApiKey(id, updates);
}
