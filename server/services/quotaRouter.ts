import crypto from 'crypto';
import { dbGetApiKeys, dbSaveApiKeys, dbAddApiKeyLog } from '@/src/db/dbService';
import { logger } from '@/server/core/utils/logger';
import { recordKeyRotationBreadcrumb, Sentry } from '@/server/core/observability/sentry';
import { getFallbackChainForTask, MODEL_QUOTA_SPECS, TaskType } from '@/config/modelTiering';
import { checkKeyQuotaAvailable, recordQuotaUsage, getModelLedgerState } from './quotaLedger';
import { calculateKeyHealthScore, resolveRawKey, AiApiKey } from './apiKeyPool';
import { llmCache } from '@/server/core/llm/cache';

export interface SlotAcquisitionResult {
  keyId: string;
  rawKey: string;
  model: string;
  tierUsed: string;
}

interface SingleFlightEntry {
  promise: Promise<any>;
  createdAt: number;
}

const singleFlightMap = new Map<string, SingleFlightEntry>();
const warmKeyCooldowns = new Map<string, number>(); // keyId:model -> timestamp until warm

/**
 * Checks if a key is in warm cooldown for a specific model (due to recent 429)
 */
function isKeyWarm(keyId: string, modelName: string): boolean {
  const compositeKey = `${keyId}:${modelName}`;
  const until = warmKeyCooldowns.get(compositeKey);
  if (!until) return false;
  if (Date.now() > until) {
    warmKeyCooldowns.delete(compositeKey);
    return false;
  }
  return true;
}

export function markKeyWarmForModel(keyId: string, modelName: string, durationMs = 10 * 60 * 1000) {
  const compositeKey = `${keyId}:${modelName}`;
  warmKeyCooldowns.set(compositeKey, Date.now() + durationMs);
  logger.warn(`[QuotaRouter] Key ${keyId.slice(0, 8)} marked WARM for model '${modelName}' for ${durationMs / 1000}s due to 429.`);
}

/**
 * Quota-Aware Slot Orchestrator with Scoring, 20% Reserve, and Fallback Chains
 */
export async function acquireSlot(
  taskType: TaskType,
  priority: 'premium' | 'free' | 'cron' = 'free',
  preferredModel?: string
): Promise<SlotAcquisitionResult> {
  const fallbackChain = preferredModel ? [preferredModel, ...getFallbackChainForTask(taskType)] : getFallbackChainForTask(taskType);
  const keys = await dbGetApiKeys();

  const activeKeys = keys.filter((k: any) => {
    const st = k.status;
    return st === 'active' || st === 'ready' || !st;
  });

  if (activeKeys.length === 0) {
    // Fallback to any key if pool is depleted
    if (keys.length > 0) {
      return {
        keyId: keys[0].id || 'fallback_key',
        rawKey: resolveRawKey(keys[0]),
        model: fallbackChain[0] || 'gemini-3.8-flash',
        tierUsed: 'fallback',
      };
    }
    const envKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
    if (envKey) {
      return {
        keyId: 'env_primary_gemini_key',
        rawKey: envKey,
        model: fallbackChain[0] || 'gemini-3.8-flash',
        tierUsed: 'env_fallback',
      };
    }
    throw new Error('[QuotaRouter] No API keys available in pool.');
  }

  const isCronOrBulk = priority === 'cron' || taskType === 'bulk';

  // Iterate fallback chain models
  for (const model of fallbackChain) {
    const spec = MODEL_QUOTA_SPECS[model] || { rpmLimit: 5, tpmLimit: 250000, rpdLimit: 20 };

    // Score and filter eligible keys for this model
    const scoredCandidates: { key: AiApiKey; score: number }[] = [];

    for (const key of activeKeys) {
      const keyId = key.id || key.alias || 'unknown';
      if (isKeyWarm(keyId, model)) continue;

      const rpdLimit = key.daily_limit || key.dailyLimit || spec.rpdLimit;
      const rpmLimit = key.rpm_limit || spec.rpmLimit;

      // 20% Reserve Check: cron/bulk tasks are forbidden from touching the top 20% reserved capacity during peak
      const state = getModelLedgerState(keyId, model);
      if (isCronOrBulk && state.rpdUsed >= rpdLimit * 0.8) {
        continue; // Reserved for premium / real-time user traffic
      }

      const available = checkKeyQuotaAvailable(keyId, model, rpmLimit, rpdLimit, isCronOrBulk);
      if (!available) continue;

      // Calculate Scoring: (Remaining RPD weighted 0.6) + (Health score weighted 0.3) + (Idle Time weighted 0.1)
      const remainingRpdRatio = Math.max(0, 1 - state.rpdUsed / rpdLimit);
      const healthScore = calculateKeyHealthScore(key) / 100;
      
      const lastUsedTimestamp = new Date(key.last_used || key.lastUsedAt || 0).getTime();
      const idleTimeSec = Math.min(3600, (Date.now() - lastUsedTimestamp) / 1000);
      const normalizedIdleScore = idleTimeSec / 3600;

      const score = (remainingRpdRatio * 0.6) + (healthScore * 0.3) + (normalizedIdleScore * 0.1);

      scoredCandidates.push({ key, score });
    }

    // Sort by highest score
    scoredCandidates.sort((a, b) => b.score - a.score);

    if (scoredCandidates.length > 0) {
      const best = scoredCandidates[0].key;
      const keyId = best.id || 'unknown';

      // Reserve slot atomically
      recordQuotaUsage(keyId, model, 400);

      return {
        keyId,
        rawKey: resolveRawKey(best),
        model,
        tierUsed: 'quota_orchestrated_tier',
      };
    }
  }

  // If all fallback models are exhausted, grab the least utilized active key
  logger.warn('[QuotaRouter] All model quota slots saturated across fallback chain. Selecting least loaded fallback.');
  const fallbackKey = activeKeys[0];
  const fallbackModel = fallbackChain[0] || 'gemini-3.8-flash';
  recordQuotaUsage(fallbackKey.id || 'fallback', fallbackModel, 400);

  return {
    keyId: fallbackKey.id || 'fallback',
    rawKey: resolveRawKey(fallbackKey),
    model: fallbackModel,
    tierUsed: 'emergency_fallback',
  };
}

/**
 * Single-flight Deduplication wrapper for LLM requests
 */
export async function executeSingleFlightRequest<T>(
  cacheKey: string,
  taskFn: () => Promise<T>
): Promise<T> {
  const existing = singleFlightMap.get(cacheKey);
  if (existing) {
    logger.info(`[SingleFlight] Deduplicating concurrent identical request for key ${cacheKey.slice(0, 10)}...`);
    return existing.promise;
  }

  const promise = taskFn().finally(() => {
    singleFlightMap.delete(cacheKey);
  });

  singleFlightMap.set(cacheKey, {
    promise,
    createdAt: Date.now(),
  });

  return promise;
}
