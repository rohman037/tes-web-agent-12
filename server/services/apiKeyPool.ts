/**
 * API Key Pool Service
 * BUG FIX 1: Unified Key Pool & Single Source of Truth
 * 
 * Sebelummya, service ini membaca dari koleksi Firestore "ai_api_keys" yang terpisah
 * dari Admin Dashboard ("apiKeys"). Kini telah direfaktor penuh untuk menggunakan
 * SATU-SATUNYA sumber data: koleksi "apiKeys" via dbGetApiKeys/dbSaveApiKeys di dbService.
 */

import { dbGetApiKeys, dbSaveApiKeys, dbAddApiKeyLog } from '@/src/db/dbService';
import { logger } from '@/server/core/utils/logger';
import { recordKeyRotationBreadcrumb } from '@/server/core/observability/sentry';

export interface AiApiKey {
  id: string;
  provider?: 'gemini' | 'openai' | string;
  key?: string;
  api_key?: string;
  encrypted_key?: string;
  status: 'active' | 'cooldown' | 'disabled' | 'rate_limited' | 'error' | 'revoked';
  available_models?: string[];
  health_score?: number;
  total_requests?: number;
  failed_requests?: number;
  usage_count?: number;
  error_count?: number;
  dailyUsage?: number;
  daily_usage?: number;
  dailyLimit?: number;
  daily_limit?: number;
  monthlyUsage?: number;
  monthlyLimit?: number;
  last_used?: string;
  lastUsedAt?: string;
  cooldown_until?: number;
  cooldownUntil?: number;
  latency_average?: number;
  lastTestedLatency?: number;
  priority?: number;
  rpm_limit?: number;
  tpm_limit?: number;
  last_error?: string;
  created_at?: string;
  createdAt?: string;
  alias?: string;
  keyType?: 'admin_pool' | 'user_custom';
  verifiedByAdmin?: boolean;
}

interface KeyRuntimeState {
  cooldownUntil: number;
  consecutiveRateLimits: number;
}

const runtimeKeyStates = new Map<string, KeyRuntimeState>();

/**
 * Resolves the raw API key string (handling process.env fallbacks if needed)
 */
export function resolveRawKey(key: Partial<AiApiKey> | any): string {
  const rawCandidate = String(key.key || key.api_key || key.encrypted_key || '').trim();

  if (!rawCandidate || rawCandidate.includes('GeminiPoolKey') || rawCandidate.includes('DefaultKey') || rawCandidate.includes('demo_key')) {
    return process.env.GEMINI_API_KEY || '';
  }

  if (rawCandidate.startsWith('AIzaSy') || rawCandidate.length >= 20) {
    return rawCandidate;
  }

  if (rawCandidate === 'process.env.GEMINI_API_KEY') {
    return process.env.GEMINI_API_KEY || '';
  }

  if (process.env[rawCandidate]) {
    return process.env[rawCandidate] || '';
  }

  return rawCandidate || process.env.GEMINI_API_KEY || '';
}

/**
 * Calculate dynamic Key Health Score (0 - 100)
 */
export function calculateKeyHealthScore(key: Partial<AiApiKey>): number {
  if (key.status === 'disabled' || key.status === 'revoked') return 0;
  if (key.status === 'cooldown' || key.status === 'rate_limited') return 10;

  const total = key.total_requests || key.usage_count || key.dailyUsage || 0;
  const failed = key.failed_requests || key.error_count || 0;

  let baseScore = 100;

  if (total > 0) {
    const errorRatio = failed / total;
    baseScore -= Math.min(60, errorRatio * 100);
  }

  const latency = key.latency_average || key.lastTestedLatency || 200;
  if (latency > 1000) {
    baseScore -= Math.min(20, (latency - 1000) / 100);
  }

  const daily = key.dailyUsage || key.daily_usage || 0;
  const limit = key.dailyLimit || key.daily_limit || 1000;
  if (limit > 0 && daily > limit * 0.8) {
    baseScore -= 15;
  }

  return Math.max(1, Math.min(100, Math.round(baseScore)));
}

/**
 * Calculate Intelligent Key Score for Load Balancing Router
 */
export function calculateKeyRoutingScore(key: Partial<AiApiKey>): number {
  if (key.status === 'disabled' || key.status === 'revoked') return -1000;
  const now = Date.now();
  const cd = key.cooldownUntil || key.cooldown_until || 0;
  if (cd > now) return -500;

  const healthScore = key.health_score || calculateKeyHealthScore(key);

  const dailyLimit = key.dailyLimit || key.daily_limit || 1000;
  const dailyUsed = key.dailyUsage || key.daily_usage || 0;
  const remainingRatio = Math.max(0, (dailyLimit - dailyUsed) / dailyLimit);
  const quotaWeight = remainingRatio * 25;

  const latency = key.latency_average || key.lastTestedLatency || 200;
  const latencyWeight = Math.max(0, 20 - (latency / 100));

  const priorityWeight = key.verifiedByAdmin ? 30 : 15;
  const usageWeight = Math.max(0, 15 - Math.min(15, (key.total_requests || dailyUsed) / 100));

  return Math.round(healthScore * 0.4 + quotaWeight + latencyWeight + priorityWeight + usageWeight);
}

/**
 * Get active API Keys sorted by intelligent scoring formula from the unified "apiKeys" collection.
 */
export async function getAvailableApiKeys(excludeKeyIds: string[] = []): Promise<AiApiKey[]> {
  const allRawKeys = await dbGetApiKeys();
  const now = Date.now();

  const formattedKeys: AiApiKey[] = allRawKeys.map((k: any) => {
    const rawKeyStr = k.key || k.api_key || k.encrypted_key || '';
    return {
      id: k.id || `key_${rawKeyStr.slice(0, 6)}`,
      provider: 'gemini',
      key: rawKeyStr,
      api_key: rawKeyStr,
      encrypted_key: rawKeyStr,
      status: k.status || 'active',
      available_models: k.available_models || [
        'gemini-3.8-flash',
        'gemini-3.7-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
        'gemini-3.1-pro-preview',
        'gemini-3.1-flash-lite',
      ],
      health_score: k.health_score || 100,
      total_requests: k.total_requests || k.dailyUsage || 0,
      failed_requests: k.failed_requests || 0,
      usage_count: k.usage_count || k.dailyUsage || 0,
      error_count: k.error_count || 0,
      dailyUsage: k.dailyUsage || 0,
      dailyLimit: k.dailyLimit || 1000,
      last_used: k.lastUsedAt || k.last_used || new Date().toISOString(),
      lastUsedAt: k.lastUsedAt || k.last_used || new Date().toISOString(),
      cooldown_until: k.cooldownUntil || k.cooldown_until || 0,
      cooldownUntil: k.cooldownUntil || k.cooldown_until || 0,
      latency_average: k.lastTestedLatency || k.latency_average || 200,
      priority: k.verifiedByAdmin ? 1 : 10,
      rpm_limit: k.rpm_limit || 60,
      tpm_limit: k.tpm_limit || 1000000,
      daily_limit: k.dailyLimit || 1000,
      created_at: k.createdAt || k.created_at || new Date().toISOString(),
      alias: k.alias || 'Admin Pool Key',
      verifiedByAdmin: k.verifiedByAdmin || false,
    };
  });

  const available = formattedKeys.filter((key) => {
    if (excludeKeyIds.includes(key.id)) return false;
    if (key.status === 'disabled' || key.status === 'revoked') return false;

    const runtime = runtimeKeyStates.get(key.id);
    if (runtime && runtime.cooldownUntil > now) {
      return false; // Key is cooling down in runtime
    }

    const cd = key.cooldownUntil || key.cooldown_until || 0;
    if (cd > now) {
      return false; // Key is cooling down in DB
    }

    return true;
  });

  if (available.length === 0) {
    if (formattedKeys.length > 0) {
      // Graceful failover: return non-revoked keys sorted by earliest cooldown expiry
      const nonRevoked = formattedKeys.filter((k) => k.status !== 'disabled' && k.status !== 'revoked');
      if (nonRevoked.length > 0) {
        return nonRevoked.sort((a, b) => (a.cooldownUntil || 0) - (b.cooldownUntil || 0));
      }
    }

    const envKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
    if (envKey) {
      return [
        {
          id: 'env_primary_gemini_key',
          key: envKey,
          status: 'active',
          priority: 1,
          rpm_limit: 60,
          tpm_limit: 1000000,
          daily_limit: 1500,
          alias: 'System Environment Key',
          available_models: [
            'gemini-3.8-flash',
            'gemini-3.7-flash',
            'gemini-3.6-flash',
            'gemini-3.5-flash',
            'gemini-3.5-flash-lite',
            'gemini-3.1-flash-lite',
            'gemini-3.1-pro-preview',
          ],
        },
      ];
    }
  }

  return available.sort((a, b) => calculateKeyRoutingScore(b) - calculateKeyRoutingScore(a));
}

/**
 * Handle 429: Put key into temporary cooldown and persist status to DB ("apiKeys")
 */
export async function handleKeyRateLimited(keyId: string, cooldownMs = 150000) {
  const current = runtimeKeyStates.get(keyId) || { cooldownUntil: 0, consecutiveRateLimits: 0 };
  const cdUntil = Date.now() + cooldownMs;
  current.cooldownUntil = cdUntil;
  current.consecutiveRateLimits += 1;
  runtimeKeyStates.set(keyId, current);

  logger.warn(`[apiKeyPool] Key ${keyId} placed in cooldown for ${cooldownMs / 1000}s due to 429 Rate Limit`);

  recordKeyRotationBreadcrumb({
    keyId,
    reason: 'rate_limited',
    details: `Placed in cooldown for ${cooldownMs / 1000}s due to 429 Rate Limit`,
  });

  try {
    const keys = await dbGetApiKeys();
    const found = keys.find((k: any) => k.id === keyId || k.key === keyId);
    if (found) {
      found.cooldownUntil = cdUntil;
      found.status = 'rate_limited'; // BUG FIX 4: marked as rate_limited during cooldown
      found.lastError = '429 Rate Limit Exceeded';
      await dbSaveApiKeys(keys);
    }
  } catch (err) {
    logger.warn(`[apiKeyPool] Error updating rate-limited key in db:`, err);
  }
}

/**
 * Handle 401: Permanently revoke/disable API key in database ("apiKeys") and runtime
 */
export async function handleKeyDisabled(keyId: string, reason = '401 Unauthorized') {
  const current = runtimeKeyStates.get(keyId) || { cooldownUntil: 0, consecutiveRateLimits: 0 };
  current.cooldownUntil = Date.now() + 86400000;
  runtimeKeyStates.set(keyId, current);

  logger.error(`[apiKeyPool] Key ${keyId} disabled permanently: ${reason}`);

  recordKeyRotationBreadcrumb({
    keyId,
    reason: 'revoked',
    details: reason,
  });

  try {
    const keys = await dbGetApiKeys();
    const found = keys.find((k: any) => k.id === keyId || k.key === keyId);
    if (found) {
      found.status = 'revoked';
      found.lastError = reason;
      await dbSaveApiKeys(keys);
    }
  } catch (err) {
    logger.warn(`[apiKeyPool] Error updating revoked key in db:`, err);
  }
}

/**
 * Handle success: reset runtime error streaks and update usage metrics in DB ("apiKeys")
 */
export async function handleKeySuccess(keyId: string, latencyMs = 200) {
  const current = runtimeKeyStates.get(keyId);
  if (current) {
    current.consecutiveRateLimits = 0;
  }

  try {
    const keys = await dbGetApiKeys();
    const found = keys.find((k: any) => k.id === keyId || k.key === keyId);
    if (found) {
      found.dailyUsage = (found.dailyUsage || 0) + 1;
      found.monthlyUsage = (found.monthlyUsage || 0) + 1;
      found.lastUsedAt = new Date().toISOString();
      const oldLat = found.lastTestedLatency || found.averageLatencyMs || 200;
      found.lastTestedLatency = Math.round(oldLat * 0.8 + latencyMs * 0.2);
      await dbSaveApiKeys(keys);
    }
  } catch (err) {
    logger.warn(`[apiKeyPool] Error updating successful key usage in db:`, err);
  }
}
