import { GoogleGenAI } from '@google/genai';
import { logger } from '@/server/core/utils/logger';
import { dbGetApiKeys, dbSaveApiKeys, dbAddApiKeyLog, dbGetModelPriorities } from '@/src/db/dbService';
import { getAntiLimitConfig } from '@/src/lib/antiLimit';
import {
  getTierForModel,
  normalizeGeminiModel,
  MODEL_TIERS,
  MODEL_CASCADE,
  getModelsForTier,
  GATEWAY_MODELS_HIERARCHY,
  GATEWAY_IMAGE_MODELS_HIERARCHY,
  GATEWAY_PHOTO_PROMPT_MODELS_HIERARCHY,
  GATEWAY_TTS_MODELS_HIERARCHY,
  GATEWAY_AUDIO_TRANSCRIBE_MODELS_HIERARCHY,
  GATEWAY_VIDEO_MODELS_HIERARCHY,
  TOP_MODEL_ORDER,
  IMAGE_MODEL_ORDER,
  PHOTO_PROMPT_MODEL_ORDER,
  TTS_MODEL_ORDER,
} from './modelRouter';

export interface LLMGatewayRequestOptions {
  model?: string;
  isUserExplicitChoice?: boolean;
  contents: any;
  config?: any;
  customApiKeyHeader?: string;
  clientAccessCode?: string;
  toolName?: string;
  targetTier?: 'flagship' | 'tier2' | 'tier3' | 'user_key';
  endpoint?: string;
  streaming?: boolean;
  isSingleRequestMode?: boolean;
}

// Single-request instrumentation counter for Video to Prompt audit
export let videoPromptAiRequestCounter = 0;
export function resetVideoPromptAiRequestCounter() {
  videoPromptAiRequestCounter = 0;
}
export function getVideoPromptAiRequestCounter() {
  return videoPromptAiRequestCounter;
}

export interface LLMGatewayResponse {
  text: string;
  modelUsed: string;
  keyIdUsed: string;
  keyMasked: string;
  latencyMs: number;
  retriesCount: number;
  tierUsed: string;
  cached?: boolean;
}

export interface KeyHealthState {
  keyId: string;
  keyMasked: string;
  key: string;
  status: 'active' | 'cooldown' | 'revoked' | 'rate_limited';
  activeRequests: number;
  totalRequests: number;
  totalErrors: number;
  consecutiveErrors: number;
  lastUsedAt: number;
  cooldownUntil: number;
  averageLatencyMs: number;
  lastErrorReason?: string;
  source: 'user_custom' | 'admin_pool' | 'env';
  verifiedByAdmin?: boolean;
  lastPolledAt?: number;
  lastTestedModel?: string;
}

export interface GatewayMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitHits: number;
  circuitBreakerTrips: number;
  fastFailoverSkips: number;
  activePoolSize: number;
  availableKeysCount: number;
  cooldownKeysCount: number;
  averageLatencyMs: number;
  uptimePercentage: number;
  modelUsageDistribution: Record<string, number>;
}

export {
  MODEL_TIERS,
  MODEL_CASCADE,
  getModelsForTier,
  TOP_MODEL_ORDER,
  GATEWAY_MODELS_HIERARCHY,
  GATEWAY_IMAGE_MODELS_HIERARCHY,
  GATEWAY_TTS_MODELS_HIERARCHY,
};

function isRealApiKey(key?: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const k = key.trim();
  if (k.length < 10) return false;
  if (
    k.includes('demo_key') ||
    k.includes('backup_key_satset') ||
    k.includes('satset_01') ||
    k.includes('satset_02')
  ) {
    return false;
  }
  return true;
}

function maskApiKey(key: string): string {
  if (!key) return '••••••••';
  if (key.length <= 10) return `${key.slice(0, 3)}••••${key.slice(-2)}`;
  return `${key.slice(0, 6)}••••${key.slice(-4)}`;
}

/**
 * Centralized LLM Gateway
 * - Load balances across available API keys using Least-Connection + Exponential Weighting
 * - Circuit Breaker pattern with automatic cooldown & health recovery
 * - Intelligent Cross-Model Cascading Fallback (Tier 1 Flagship -> Tier 2 High Perf -> Tier 3 Resilient Lite)
 * - Anti-Limit jitter backoff & retry mechanism
 * - Full telemetry, metrics, and audit logging to database & SSE broadcast
 */
export class LLMGateway {
  private static instance: LLMGateway;
  // BUG FIX 2: Scoped unavailable models per-key with auto-expiring TTL (replaces permanent global Set)
  private static unavailableModelsMap = new Map<string /* `${keyId}::${model}` */, number /* expireTimestamp */>();
  // Global cooldown for models experiencing Google-wide 503 High Demand spikes
  private static globalModelCooldownMap = new Map<string, number>();
  private keyHealthMap = new Map<string, KeyHealthState>();
  // In-Memory Fast Failover Map: Key = `${apiKey}::${model}`, Value = cooldown timestamp
  private keyModelCooldownMap = new Map<string, number>();
  private globalClients = new Map<string, GoogleGenAI>();
  private metrics: GatewayMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    rateLimitHits: 0,
    circuitBreakerTrips: 0,
    fastFailoverSkips: 0,
    activePoolSize: 0,
    availableKeysCount: 0,
    cooldownKeysCount: 0,
    averageLatencyMs: 0,
    uptimePercentage: 100,
    modelUsageDistribution: {},
  };

  private broadcastCallback?: (event: { type: string; [key: string]: any }) => void;

  private lastQuotaResetDate: string = new Date().toISOString().slice(0, 10);
  private lastQuotaResetMonth: string = new Date().toISOString().slice(0, 7);

  private constructor() {
    // Health check & recovery interval (every 20 seconds recover cooled down keys & models)
    const recoveryTimer = setInterval(() => {
      this.recoverCooldownKeys();
    }, 20 * 1000);
    if (typeof recoveryTimer.unref === 'function') {
      recoveryTimer.unref();
    }

    // Auto Quota Reset Check (Every 1 minute check if day or month has rolled over)
    const quotaTimer = setInterval(() => {
      this.checkAndResetQuotas().catch((err) => logger.warn('[LLM Gateway Quota Reset Warning]', err));
    }, 60 * 1000);
    if (typeof quotaTimer.unref === 'function') {
      quotaTimer.unref();
    }
  }

  /**
   * Automatically resets daily and monthly quota counters when date rolls over
   * Ensures keys with 429 quota resets the next day or month are fully restored!
   */
  private async checkAndResetQuotas() {
    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = new Date().toISOString().slice(0, 7);

    const isDayNew = today !== this.lastQuotaResetDate;
    const isMonthNew = thisMonth !== this.lastQuotaResetMonth;

    if (isDayNew || isMonthNew) {
      try {
        const keys = await dbGetApiKeys();
        let changed = false;

        for (const k of keys) {
          if (isDayNew) {
            k.dailyUsage = 0;
            // Lift any persistent daily rate limits
            if (k.status === 'rate_limited' || k.status === 'cooldown') {
              k.status = 'active';
              k.cooldownUntil = 0;
            }
            changed = true;
          }
          if (isMonthNew) {
            k.monthlyUsage = 0;
            changed = true;
          }
        }

        if (changed) {
          await dbSaveApiKeys(keys);
          this.emitEvent({ type: 'apikeys_updated', keys });
          logger.info(`[LLM Gateway Quota Manager] Quotas automatically reset (Day: ${isDayNew}, Month: ${isMonthNew}). All valid keys restored.`);
        }

        if (isDayNew) this.lastQuotaResetDate = today;
        if (isMonthNew) this.lastQuotaResetMonth = thisMonth;
      } catch (e) {
        logger.warn('[LLM Gateway Auto Quota Reset Error]', e);
      }
    }
  }

  public static getInstance(): LLMGateway {
    if (!LLMGateway.instance) {
      LLMGateway.instance = new LLMGateway();
    }
    return LLMGateway.instance;
  }

  public setBroadcastHandler(handler: (event: { type: string; [key: string]: any }) => void) {
    this.broadcastCallback = handler;
  }

  private emitEvent(event: { type: string; [key: string]: any }) {
    if (this.broadcastCallback) {
      try {
        this.broadcastCallback(event);
      } catch (e) {
        logger.warn('[LLM Gateway Broadcast Error]', e);
      }
    }
  }

  public getMetrics(): GatewayMetrics {
    const total = this.metrics.totalRequests;
    const successes = this.metrics.successfulRequests;
    const uptime = total > 0 ? Number(((successes / total) * 100).toFixed(2)) : 100;
    
    let activePool = 0;
    let availableCount = 0;
    let cooldownCount = 0;
    const now = Date.now();

    for (const item of this.keyHealthMap.values()) {
      if (item.status === 'revoked') continue;
      activePool++;
      if (item.cooldownUntil && item.cooldownUntil > now) {
        cooldownCount++;
      } else {
        availableCount++;
      }
    }

    return {
      ...this.metrics,
      activePoolSize: activePool,
      availableKeysCount: availableCount,
      cooldownKeysCount: cooldownCount,
      uptimePercentage: uptime,
    };
  }

  public getKeyHealthStates(): KeyHealthState[] {
    return Array.from(this.keyHealthMap.values()).map((state) => ({
      ...state,
      key: maskApiKey(state.key),
    }));
  }

  private getGenAIClient(apiKey: string): GoogleGenAI {
    if (this.globalClients.has(apiKey)) {
      return this.globalClients.get(apiKey)!;
    }
    const client = new GoogleGenAI({
      apiKey: apiKey.trim(),
      httpOptions: {
        headers: {
          'User-Agent': 'satset-llm-gateway-prod/2.0',
        },
      },
    });
    this.globalClients.set(apiKey, client);
    return client;
  }

  /**
   * Synchronizes newly polled or updated keys from the Admin Dashboard
   * to guarantee immediate routing priority in LLM Gateway.
   */
  public syncPolledKeys(polledKeys: any[]): void {
    if (!Array.isArray(polledKeys) || polledKeys.length === 0) return;
    const now = Date.now();
    for (const item of polledKeys) {
      if (!item || !item.key) continue;
      const rawKey = String(item.key).trim();
      if (!isRealApiKey(rawKey)) continue;

      const isOk = item.status === 'active' || item.pollStatus === 'active' || item.verifiedByAdmin === true;
      const isRateLimited = item.status === 'rate_limited' || item.pollStatus === 'rate_limited';
      const isRevoked = item.status === 'revoked' || item.pollStatus === 'revoked';

      const existing = this.keyHealthMap.get(rawKey);
      this.keyHealthMap.set(rawKey, {
        keyId: item.id || existing?.keyId || `admin_key_${maskApiKey(rawKey)}`,
        keyMasked: maskApiKey(rawKey),
        key: rawKey,
        status: isRevoked ? 'revoked' : (isRateLimited ? 'rate_limited' : 'active'),
        activeRequests: existing?.activeRequests || 0,
        totalRequests: existing?.totalRequests || 0,
        totalErrors: isOk ? 0 : (existing ? existing.totalErrors + 1 : 1),
        consecutiveErrors: isOk ? 0 : (existing ? existing.consecutiveErrors + 1 : 1),
        lastUsedAt: existing?.lastUsedAt || 0,
        cooldownUntil: isRateLimited ? (item.cooldownUntil || now + 90000) : 0,
        averageLatencyMs: item.lastTestedLatency || item.latencyMs || (existing ? existing.averageLatencyMs : 200),
        source: 'admin_pool',
        verifiedByAdmin: isOk,
        lastPolledAt: now,
        lastTestedModel: item.lastTestedModel || item.modelTested || 'gemini-3.8-flash',
      });
    }

    logger.info(`[LLM Gateway] Synchronized ${polledKeys.length} keys from Admin Dashboard pool. Active polled keys prioritized.`);
  }

  /**
   * Evaluates and selects the healthiest API keys ordered by load & reliability.
   * Priority rule: Keys polled and verified active by Admin in the Admin Dashboard
   * are ALWAYS given highest routing priority, followed by other pool keys, then fallback env key.
   */
  public async getAvailableKeyCandidates(
    customApiKeyHeader?: string,
    clientAccessCode?: string
  ): Promise<{ key: string; keyId: string; source: 'user_custom' | 'admin_pool' | 'env' }[]> {
    const now = Date.now();
    const userCandidates: { key: string; keyId: string; source: 'user_custom' }[] = [];
    const poolCandidates: { key: string; keyId: string; source: 'admin_pool' | 'env' }[] = [];

    // 1. User custom keys from headers / body (if explicitly supplied)
    if (customApiKeyHeader && customApiKeyHeader.trim()) {
      const parsedKeys = customApiKeyHeader
        .split(/[\n,]+/)
        .map((k) => k.trim())
        .filter((k) => isRealApiKey(k));

      for (let i = 0; i < parsedKeys.length; i++) {
        userCandidates.push({
          key: parsedKeys[i],
          keyId: `user_custom_${i + 1}`,
          source: 'user_custom',
        });
      }
    }

    // 2. Client access code bound keys
    if (clientAccessCode && clientAccessCode !== 'GUEST') {
      const cleanCode = clientAccessCode.trim().toUpperCase();
      try {
        const antiLimitCfg = getAntiLimitConfig(clientAccessCode);
        if (antiLimitCfg.customApiKey && isRealApiKey(antiLimitCfg.customApiKey)) {
          userCandidates.push({
            key: antiLimitCfg.customApiKey.trim(),
            keyId: `client_custom_${cleanCode}`,
            source: 'user_custom',
          });
        }
        if (Array.isArray(antiLimitCfg.apiKeys)) {
          for (let i = 0; i < antiLimitCfg.apiKeys.length; i++) {
            const k = antiLimitCfg.apiKeys[i];
            if (isRealApiKey(k)) {
              userCandidates.push({
                key: k.trim(),
                keyId: `client_multikey_${cleanCode}_${i + 1}`,
                source: 'user_custom',
              });
            }
          }
        }

        const keysArr = await dbGetApiKeys();
        const bound = keysArr.filter(
          (k: any) =>
            k.status === 'active' &&
            k.accessCode &&
            k.accessCode.toUpperCase() === cleanCode &&
            isRealApiKey(k.key)
        );
        for (const b of bound) {
          userCandidates.push({
            key: b.key,
            keyId: b.id || `bound_${b.accessCode}`,
            source: 'user_custom',
          });
        }
      } catch (e) {
        logger.warn('[LLM Gateway] Notice reading client-bound keys:', e);
      }
    }

    // 3. Admin Database Multi-Key Pool (TOP PRIORITY: Always loads all keys configured in Admin Dashboard)
    try {
      const adminKeys = await dbGetApiKeys();
      const activeAdminKeys = adminKeys.filter((k: any) => {
        const raw = (k.key || k.api_key || k.encrypted_key || '').trim();
        const isNotRevoked = k.status !== 'revoked' && k.status !== 'disabled';
        return isNotRevoked && isRealApiKey(raw);
      });

      for (const k of activeAdminKeys) {
        const rawKey = (k.key || k.api_key || k.encrypted_key || '').trim();
        const isPolled = Boolean(k.verifiedByAdmin || k.lastPolledAt || k.pollStatus === 'active' || k.status === 'active');
        const keyId = k.id || `admin_key_${maskApiKey(rawKey)}`;
        poolCandidates.push({
          key: rawKey,
          keyId,
          source: 'admin_pool',
        });

        // Register or sync state in health map
        const existing = this.keyHealthMap.get(rawKey);
        const healthScoreVal = typeof k.health_score === 'number' ? k.health_score : (typeof k.healthScore === 'number' ? k.healthScore : 100);
        const latencyVal = k.average_latency || k.latency_average || k.lastTestedLatency || k.latencyMs || 200;
        const dbCooldown = k.cooldown_until || k.cooldownUntil || 0;
        const dbStatus = k.status;

        // BUG FIX 5: Multi-instance state synchronization.
        // TODO: For production scaling across multiple cluster nodes / container instances,
        // distributed key health state and cooldown timestamps should be stored in a shared distributed
        // store like Redis / Firestore Realtime PubSub. For now, we actively re-sync with latest DB records.
        if (!existing) {
          this.keyHealthMap.set(rawKey, {
            keyId,
            keyMasked: maskApiKey(rawKey),
            key: rawKey,
            status: dbStatus === 'revoked' || dbStatus === 'disabled' ? 'revoked' : (dbCooldown > now || dbStatus === 'rate_limited' ? 'rate_limited' : 'active'),
            activeRequests: 0,
            totalRequests: k.total_requests || k.usage_count || k.totalRequests || 0,
            totalErrors: k.failed_requests || k.error_count || k.totalErrors || 0,
            consecutiveErrors: 0,
            lastUsedAt: k.last_used ? new Date(k.last_used).getTime() : 0,
            cooldownUntil: dbCooldown,
            averageLatencyMs: latencyVal,
            source: 'admin_pool',
            verifiedByAdmin: isPolled,
            lastPolledAt: k.lastPolledAt ? new Date(k.lastPolledAt).getTime() : (isPolled ? Date.now() : 0),
            lastTestedModel: k.lastTestedModel || 'gemini-3.8-flash',
          });
        } else {
          existing.source = 'admin_pool';
          if (isPolled) existing.verifiedByAdmin = true;
          if (k.lastTestedLatency || k.average_latency) existing.averageLatencyMs = latencyVal;

          // Re-sync cooldownUntil and status from DB to keep multi-instance state in sync
          if (dbCooldown > existing.cooldownUntil) {
            existing.cooldownUntil = dbCooldown;
          }
          if (dbStatus === 'revoked' || dbStatus === 'disabled') {
            existing.status = 'revoked';
          } else if (dbCooldown > now || dbStatus === 'rate_limited') {
            existing.status = 'rate_limited';
          } else if (existing.status === 'rate_limited' && dbCooldown <= now && existing.cooldownUntil <= now) {
            existing.status = 'active';
          }
        }
      }
    } catch (e) {
      logger.warn('[LLM Gateway] Notice reading admin keys pool:', e);
    }

    // 4. System Environment Key (Only as fallback behind admin pool keys)
    const envKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
    if (isRealApiKey(envKey)) {
      poolCandidates.push({
        key: envKey,
        keyId: 'env_primary_gemini_key',
        source: 'env',
      });
    }

    // Deduplicate user candidates
    const uniqueUserMap = new Map<string, { key: string; keyId: string; source: 'user_custom' }>();
    for (const c of userCandidates) {
      if (!uniqueUserMap.has(c.key)) uniqueUserMap.set(c.key, c);
    }
    const uniqueUserCandidates = Array.from(uniqueUserMap.values());

    // Deduplicate pool candidates
    const uniquePoolMap = new Map<string, { key: string; keyId: string; source: 'admin_pool' | 'env' }>();
    for (const c of poolCandidates) {
      if (!uniquePoolMap.has(c.key)) uniquePoolMap.set(c.key, c);
    }
    const uniquePoolCandidates = Array.from(uniquePoolMap.values());

    // Synchronize health state tracking for all keys
    const allCombined = [...uniqueUserCandidates, ...uniquePoolCandidates];
    for (const cand of allCombined) {
      if (!this.keyHealthMap.has(cand.key)) {
        this.keyHealthMap.set(cand.key, {
          keyId: cand.keyId,
          keyMasked: maskApiKey(cand.key),
          key: cand.key,
          status: 'active',
          activeRequests: 0,
          totalRequests: 0,
          totalErrors: 0,
          consecutiveErrors: 0,
          lastUsedAt: 0,
          cooldownUntil: 0,
          averageLatencyMs: 200,
          source: cand.source,
          verifiedByAdmin: false,
        });
      }
    }

    // Dynamic Intelligent Key Score Calculation for Load Balancing
    const calculateScore = (candKey: string) => {
      const state = this.keyHealthMap.get(candKey);
      if (!state) return 50;
      if (state.status === 'revoked') return -1000;
      if (state.cooldownUntil && state.cooldownUntil > now) return -500;

      const baseHealth = Math.max(10, 100 - (state.consecutiveErrors * 30));
      const polledBonus = state.verifiedByAdmin ? 25 : 0;
      const srcBonus = state.source === 'admin_pool' ? 20 : 5;
      const latencyScore = Math.max(0, 20 - ((state.averageLatencyMs || 200) / 100));
      const loadBalanceScore = Math.max(0, 15 - Math.min(15, (state.totalRequests || 0) / 100));
      const activePenalty = (state.activeRequests || 0) * 40;
      const errorPenalty = (state.consecutiveErrors || 0) * 35;

      return (baseHealth * 0.35) + polledBonus + srcBonus + latencyScore + loadBalanceScore - activePenalty - errorPenalty;
    };

    // Sort Pool Candidates by Intelligent Score
    const sortedPool = uniquePoolCandidates
      .filter((c) => {
        const state = this.keyHealthMap.get(c.key);
        if (!state) return true;
        if (state.status === 'revoked') return false;
        if (state.cooldownUntil && state.cooldownUntil > now) return false;
        return true;
      })
      .sort((a, b) => {
        const scoreA = calculateScore(a.key);
        const scoreB = calculateScore(b.key);
        return scoreB - scoreA;
      });

    // If user provided custom keys, prioritize them, followed by sorted pool keys as seamless fallbacks!
    if (uniqueUserCandidates.length > 0) {
      return [...uniqueUserCandidates, ...sortedPool];
    }

    if (sortedPool.length > 0) {
      return sortedPool;
    }

    // Fallback: If all pool keys are in cooldown, pick the key with earliest cooldown expiration
    return uniquePoolCandidates
      .filter((c) => {
        const state = this.keyHealthMap.get(c.key);
        return !state || state.status !== 'revoked';
      })
      .sort((a, b) => {
        const stateA = this.keyHealthMap.get(a.key);
        const stateB = this.keyHealthMap.get(b.key);
        const polledA = stateA?.verifiedByAdmin ? 1 : 0;
        const polledB = stateB?.verifiedByAdmin ? 1 : 0;
        if (polledA !== polledB) return polledB - polledA;
        const cdA = stateA?.cooldownUntil || 0;
        const cdB = stateB?.cooldownUntil || 0;
        return cdA - cdB;
      });
  }

  private async recoverCooldownKeys() {
    const now = Date.now();
    let recoveredCount = 0;

    // 1. Recover keys in runtime
    for (const [key, state] of this.keyHealthMap.entries()) {
      if (state.status === 'cooldown' || state.status === 'rate_limited') {
        if (state.cooldownUntil && state.cooldownUntil <= now) {
          state.status = 'active';
          state.consecutiveErrors = 0;
          state.cooldownUntil = 0;
          recoveredCount++;
          logger.info(`[LLM Gateway Circuit Breaker] Key ${state.keyMasked} cooldown lifted and restored to active pool.`);
        }
      }
    }

    // 2. Clean expired (key, model) cooldown entries
    for (const [km, cd] of this.keyModelCooldownMap.entries()) {
      if (cd <= now) {
        this.keyModelCooldownMap.delete(km);
      }
    }

    // 3. Clean expired unavailable models entries (BUG 2)
    for (const [km, exp] of LLMGateway.unavailableModelsMap.entries()) {
      if (exp <= now) {
        LLMGateway.unavailableModelsMap.delete(km);
      }
    }

    if (recoveredCount > 0) {
      // BUG FIX 4: Ensure DB status is also updated from 'rate_limited' back to 'active'
      try {
        const dbKeys = await dbGetApiKeys();
        let changed = false;
        for (const k of dbKeys) {
          if (k.status === 'rate_limited' && k.cooldownUntil && k.cooldownUntil <= now) {
            k.status = 'active';
            k.cooldownUntil = 0;
            changed = true;
          }
        }
        if (changed) {
          await dbSaveApiKeys(dbKeys);
          this.emitEvent({ type: 'apikeys_updated', keys: dbKeys });
        }
      } catch (e) {
        logger.warn('[LLM Gateway Cooldown Lift DB Sync]', e);
      }

      this.emitEvent({ type: 'llm_gateway_pool_updated', metrics: this.getMetrics() });
    }
  }

  /**
   * Main Gateway Execution:
   * Load balances requests, handles automatic retries with exponential backoff & jitter,
   * cascades across candidate models, trips instant circuit breakers on 429/503 errors, and maintains 99.9% uptime.
   */
  public async execute(options: LLMGatewayRequestOptions): Promise<LLMGatewayResponse> {
    const overallStartTime = Date.now();
    this.metrics.totalRequests++;

    const clientAccessCode = options.clientAccessCode || 'GUEST';
    const inferredTool = options.toolName || 'AI Generation';
    const endpoint = options.endpoint || `/api/${inferredTool.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    // Build intelligent cascading model list across ALL available models
    const toolLower = inferredTool.toLowerCase();
    const isVideoPromptTool = toolLower.includes('video to prompt') || toolLower.includes('video prompt') || toolLower.includes('ekstrak prompt');
    const isSingleRequestMode = Boolean(options.isSingleRequestMode);

    const isImageGenTool = (toolLower.includes('image generation') || toolLower.includes('generate image') || endpoint.includes('generate-image') || toolLower.includes('nano banana image')) && !toolLower.includes('prompt');
    const isPhotoPromptTool = toolLower.includes('photo prompt') || endpoint.includes('generate-photo-prompt') || toolLower.includes('prompt foto');
    const isAudioTranscribeTool = toolLower.includes('transcribe') || endpoint.includes('transcribe');
    const isTtsTool = (toolLower.includes('tts') || toolLower.includes('voice') || toolLower.includes('speech')) && !isAudioTranscribeTool;
    const isVideoTool = isVideoPromptTool || toolLower.includes('video') || endpoint.includes('video');

    const defaultHierarchy = isImageGenTool 
      ? GATEWAY_IMAGE_MODELS_HIERARCHY 
      : isPhotoPromptTool
        ? GATEWAY_PHOTO_PROMPT_MODELS_HIERARCHY
        : isAudioTranscribeTool
          ? GATEWAY_AUDIO_TRANSCRIBE_MODELS_HIERARCHY
          : isTtsTool 
            ? GATEWAY_TTS_MODELS_HIERARCHY 
            : isVideoTool
              ? GATEWAY_VIDEO_MODELS_HIERARCHY
              : GATEWAY_MODELS_HIERARCHY;

    // Fetch dynamic admin configured priorities if available
    let dynamicAdminOrder: string[] = [];
    try {
      const storedPriorities = await dbGetModelPriorities();
      if (storedPriorities) {
        if (isImageGenTool && Array.isArray(storedPriorities.image) && storedPriorities.image.length > 0) {
          dynamicAdminOrder = storedPriorities.image;
        } else if (isPhotoPromptTool && Array.isArray(storedPriorities.text) && storedPriorities.text.length > 0) {
          dynamicAdminOrder = storedPriorities.text;
        } else if (isVideoTool && Array.isArray(storedPriorities.video) && storedPriorities.video.length > 0) {
          dynamicAdminOrder = storedPriorities.video;
        } else if (Array.isArray(storedPriorities.text) && storedPriorities.text.length > 0) {
          dynamicAdminOrder = storedPriorities.text;
        }
      }
    } catch (e) {}

    const baseOrderedHierarchy = dynamicAdminOrder.length > 0
      ? Array.from(new Set([...dynamicAdminOrder.map(normalizeGeminiModel), ...defaultHierarchy]))
      : defaultHierarchy;

    // If a model is specified (user explicit or tool preferred), place it first in the hierarchy; otherwise cascade from top priority
    let candidateModels: string[];
    if (isSingleRequestMode) {
      // In single-request mode: STRICTLY 1 model, NO cascade
      const chosenModel = options.model ? normalizeGeminiModel(options.model) : (baseOrderedHierarchy[0] || 'gemini-3.8-flash');
      candidateModels = [chosenModel];
      logger.info(`[Video to Prompt Single Mode] Locked to single model: ${chosenModel} (no cascade, no retry)`);
    } else if (options.model && (options.isUserExplicitChoice || options.model !== TOP_MODEL_ORDER[0])) {
      const userPrimary = normalizeGeminiModel(options.model);
      candidateModels = Array.from(new Set([userPrimary, ...baseOrderedHierarchy])).filter(Boolean);
    } else {
      candidateModels = baseOrderedHierarchy;
    }

    const keyCandidates = await this.getAvailableKeyCandidates(
      options.customApiKeyHeader,
      clientAccessCode
    );

    if (keyCandidates.length === 0) {
      this.metrics.failedRequests++;
      throw new Error(
        'Tidak ada API Key Gemini yang aktif atau tersedia. Silakan tambahkan API Key di Pengaturan Anti Limit atau Admin Panel.'
      );
    }

    let lastError: any = null;
    let totalRetries = 0;

    // Generous Request-Level Budgeting (120s) to allow traversing candidate keys
    const MAX_TOTAL_EXECUTION_TIME_MS = 120000;
    // For single-request mode: exactly 1 key evaluation; for general mode: traverse up to 30 healthy keys in pool
    const MAX_KEY_HOPS_PER_REQUEST = isSingleRequestMode ? 1 : Math.min(30, keyCandidates.length);
    const evaluatedKeyCandidates = keyCandidates.slice(0, MAX_KEY_HOPS_PER_REQUEST);

    keyCandidateLoop: for (let kIdx = 0; kIdx < evaluatedKeyCandidates.length; kIdx++) {
      // Check if total execution budget is nearing limit
      const elapsedTotal = Date.now() - overallStartTime;
      if (elapsedTotal >= MAX_TOTAL_EXECUTION_TIME_MS) {
        logger.warn(`[LLM Gateway Timeout Guard] Request time budget exhausted (${elapsedTotal}ms). Halting further key hops.`);
        break keyCandidateLoop;
      }

      const candidate = evaluatedKeyCandidates[kIdx];
      const activeKey = candidate.key;
      const keyId = candidate.keyId;
      const keyMasked = maskApiKey(activeKey);

      let keyState = this.keyHealthMap.get(activeKey);
      if (!keyState) {
        keyState = {
          keyId,
          keyMasked,
          key: activeKey,
          status: 'active',
          activeRequests: 0,
          totalRequests: 0,
          totalErrors: 0,
          consecutiveErrors: 0,
          lastUsedAt: 0,
          cooldownUntil: 0,
          averageLatencyMs: 200,
          source: candidate.source,
        };
        this.keyHealthMap.set(activeKey, keyState);
      }

      if (keyState.status === 'revoked') {
        continue keyCandidateLoop;
      }

      // Fast check: If key is in global cooldown, skip in 0ms
      if (keyState.cooldownUntil && keyState.cooldownUntil > Date.now()) {
        this.metrics.fastFailoverSkips = (this.metrics.fastFailoverSkips || 0) + 1;
        continue keyCandidateLoop;
      }

      const aiInstance = this.getGenAIClient(activeKey);
      let anyModelSucceededOnKey = false;
      let rateLimitEncounteredOnKey = false;
      let consecutiveFailuresOnKey = 0;
      let consecutiveRateLimitsOnKey = 0;

      // BUG FIX 2 & 3: Filter out models that are temporarily unavailable (404) for this specific key
      const currentModelsToTry = candidateModels.filter((m) => {
        const unavailUntil = LLMGateway.unavailableModelsMap.get(`${keyId}::${m}`);
        return !unavailUntil || unavailUntil <= Date.now();
      });

      // BUG FIX 3: Explicit check if candidate models list is empty for this key.
      // Do NOT treat as rate-limited, skip circuit breaker and hop to next key cleanly.
      if (currentModelsToTry.length === 0) {
        logger.warn(
          `[LLM Gateway] no_available_models_for_key: Key ${keyMasked} tidak memiliki model aktif yang siap dicoba saat ini. Melanjutkan ke key berikutnya tanpa rate limit circuit breaker.`
        );
        continue keyCandidateLoop;
      }

      modelLoop: for (const targetModel of currentModelsToTry) {
        if ((keyState.status as string) === 'revoked') {
          break modelLoop;
        }

        if (Date.now() - overallStartTime >= MAX_TOTAL_EXECUTION_TIME_MS) {
          break modelLoop;
        }

        // Fast Failover Check: If this model is globally in cooldown (503 High Demand), skip in 0ms!
        const globalCooldown = LLMGateway.globalModelCooldownMap.get(targetModel);
        if (globalCooldown && globalCooldown > Date.now()) {
          this.metrics.fastFailoverSkips = (this.metrics.fastFailoverSkips || 0) + 1;
          logger.debug(`[LLM Gateway Global-Skip] Model ${targetModel} is temporarily globally overloaded (503). Skipping to next model in 0ms...`);
          continue modelLoop;
        }

        // Fast Failover Check: If this model is known to be in cooldown on this key, skip immediately in 0ms!
        const kmKey = `${activeKey}::${targetModel}`;
        const modelCooldown = this.keyModelCooldownMap.get(kmKey);
        if (modelCooldown && modelCooldown > Date.now()) {
          this.metrics.fastFailoverSkips = (this.metrics.fastFailoverSkips || 0) + 1;
          logger.debug(`[LLM Gateway Fast-Skip] Model ${targetModel} on key ${keyMasked} is cooling down. Instant skipping to next model...`);
          continue modelLoop;
        }

        const isThinkingModel =
          targetModel === 'gemini-3.1-pro-preview' || targetModel === 'gemini-3.1-pro';
        const requestConfig = { ...(options.config || {}) };

        if (isThinkingModel) {
          // Keep thinking level moderate so video analysis doesn't stall for >50s
          if (!requestConfig.thinkingConfig) {
            requestConfig.thinkingConfig = {
              thinkingLevel: 'LOW',
            };
          }
          delete requestConfig.maxOutputTokens;
        }

        let modelAttempts = 0;
        const maxModelAttempts = isSingleRequestMode ? 1 : 2;

        while (modelAttempts < maxModelAttempts) {
          if (Date.now() - overallStartTime >= MAX_TOTAL_EXECUTION_TIME_MS) {
            break;
          }

          modelAttempts++;
          const callStart = Date.now();
          keyState.activeRequests++;

          // Dynamic attempt timeout based on model archetype and media size
          const isImageModel = targetModel.includes('image');
          const contentsStr = typeof options.contents === 'string' ? options.contents : JSON.stringify(options.contents || {});
          const hasMediaPayload = contentsStr.includes('inlineData') || contentsStr.length > 50000;
          const perAttemptTimeoutMs = isThinkingModel 
            ? (hasMediaPayload ? 80000 : 45000) 
            : isImageModel 
            ? 35000 
            : (hasMediaPayload ? 75000 : 35000);

          try {
            logger.info(
              `[LLM Gateway Request] Key #${kIdx + 1}/${evaluatedKeyCandidates.length} (${keyMasked} [${candidate.source}]), Model: ${targetModel}, Attempt: ${modelAttempts} (Timeout: ${perAttemptTimeoutMs}ms)...`
            );

            if (isSingleRequestMode) {
              videoPromptAiRequestCounter++;
              logger.info(`[Video to Prompt Single Mode] Physical AI Request #${videoPromptAiRequestCounter} initiated for model: ${targetModel}`);
            }

            // Execute generateContent wrapped with strict timeout promise
            const generatePromise = aiInstance.models.generateContent({
              model: targetModel,
              contents: options.contents,
              config: requestConfig,
            });

            const timeoutPromise = new Promise<never>((_, reject) => {
              const timer = setTimeout(() => {
                reject(new Error(`LLM_TIMEOUT: Pemanggilan model ${targetModel} melebihi batas waktu ${perAttemptTimeoutMs}ms`));
              }, perAttemptTimeoutMs);
              generatePromise.then(() => clearTimeout(timer), () => clearTimeout(timer));
            });

            const response = await Promise.race([generatePromise, timeoutPromise]);

            const latencyMs = Date.now() - callStart;
            keyState.activeRequests = Math.max(0, keyState.activeRequests - 1);
            keyState.totalRequests++;
            keyState.lastUsedAt = Date.now();
            keyState.consecutiveErrors = 0;
            keyState.status = 'active';
            keyState.averageLatencyMs = Math.round(
              keyState.averageLatencyMs * 0.8 + latencyMs * 0.2
            );

            this.metrics.successfulRequests++;
            this.metrics.modelUsageDistribution[targetModel] =
              (this.metrics.modelUsageDistribution[targetModel] || 0) + 1;

            anyModelSucceededOnKey = true;

            // Clear any lingering cooldown entry for this specific (key, model)
            this.keyModelCooldownMap.delete(kmKey);

            // Record real-time DB stats and emit live telemetry
            this.recordSuccessLog({
              keyId,
              keyMasked,
              key: activeKey,
              endpoint,
              modelUsed: targetModel,
              toolName: inferredTool,
              latencyMs,
              keySource: candidate.source,
              userCode: clientAccessCode,
            }).catch((err) => logger.warn('[LLM Gateway Log Warning]', err));

            const resolvedTier = getTierForModel(targetModel, candidate.source === 'user_custom');

            return {
              text: response.text || '',
              modelUsed: targetModel,
              keyIdUsed: keyId,
              keyMasked,
              latencyMs: Date.now() - overallStartTime,
              retriesCount: totalRetries,
              tierUsed: resolvedTier,
            };
          } catch (err: any) {
            keyState.activeRequests = Math.max(0, keyState.activeRequests - 1);
            keyState.totalErrors++;
            keyState.consecutiveErrors++;
            consecutiveFailuresOnKey++;
            totalRetries++;
            lastError = err;

            const errMsg = String(err?.message || err || '');
            const status = (err as any)?.status || (err as any)?.statusCode || 0;
            const latencyMs = Date.now() - callStart;

            logger.warn(
              `[LLM Gateway Warning] Key ${keyMasked}, Model: ${targetModel} attempt ${modelAttempts} failed (${latencyMs}ms): ${errMsg}`
            );

            if (isSingleRequestMode) {
              const isTimeout = errMsg.includes('LLM_TIMEOUT') || errMsg.includes('DEADLINE_EXCEEDED') || errMsg.includes('ETIMEDOUT');
              const isNotFound = status === 404 || errMsg.includes('404') || errMsg.includes('NOT_FOUND') || errMsg.includes('is not found');
              const isHighDemandOrUnavailable = status === 503 || errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('high demand') || errMsg.includes('overloaded');

              let cleanMessage = 'Analisis video gagal karena model AI tidak dapat memproses video ini.';
              if (isTimeout) {
                cleanMessage = 'Analisis video timeout. Silakan gunakan video yang lebih pendek atau coba lagi.';
              } else if (isNotFound || isHighDemandOrUnavailable) {
                cleanMessage = 'Model AI video sedang tidak tersedia.';
              } else if (errMsg.includes('INVALID_ARGUMENT') || errMsg.includes('mimeType') || errMsg.includes('Unsupported MIME type') || errMsg.includes('video')) {
                cleanMessage = 'File video tidak valid.';
              }
              logger.error(`[Video to Prompt Single Mode] Failed on single attempt, terminating immediately: ${errMsg}`);
              const finalError: any = new Error(cleanMessage);
              finalError.statusCode = status || 500;
              throw finalError;
            }

            const isTimeout = errMsg.includes('LLM_TIMEOUT') || errMsg.includes('DEADLINE_EXCEEDED') || errMsg.includes('ETIMEDOUT');

            const isDeadKey =
              status === 401 ||
              status === 403 ||
              errMsg.includes('401') ||
              errMsg.includes('403') ||
              errMsg.includes('API_KEY_INVALID') ||
              errMsg.includes('API key not found') ||
              errMsg.includes('PERMISSION_DENIED') ||
              errMsg.includes('UNAUTHENTICATED') ||
              errMsg.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED');

            const isRateLimitOrQuota =
              status === 429 ||
              errMsg.includes('429') ||
              errMsg.includes('RESOURCE_EXHAUSTED') ||
              errMsg.includes('Quota exceeded') ||
              errMsg.includes('limit: 0');

            const isNotFound =
              status === 404 ||
              errMsg.includes('404') ||
              errMsg.includes('NOT_FOUND') ||
              errMsg.includes('is not found') ||
              errMsg.includes('no longer available') ||
              errMsg.includes('ModelService.ListModels');

            const isHighDemandOrUnavailable =
              status === 503 ||
              errMsg.includes('503') ||
              errMsg.includes('UNAVAILABLE') ||
              errMsg.includes('high demand') ||
              errMsg.includes('overloaded');

            const isServerError =
              !isHighDemandOrUnavailable &&
              (status >= 500 || errMsg.includes('500') || errMsg.includes('Internal error'));

            if (isDeadKey) {
              keyState.status = 'revoked';
              keyState.lastErrorReason = 'API Key Invalid / Revoked (401/403)';
              this.recordKeyRevocation(activeKey, keyId).catch(() => {});
              logger.error(`[LLM Gateway Auto-Prune] Key ${keyMasked} is revoked/invalid. Skipping remaining models on this key and proceeding immediately to next key.`);
              break modelLoop; // Instant jump out of modelLoop for this dead key
            }

            if (isNotFound) {
              // BUG FIX 2: Scoped per-key 404 tracking with 45-minute TTL auto-expiration
              const UNAVAIL_TTL_MS = 45 * 60 * 1000;
              LLMGateway.unavailableModelsMap.set(`${keyId}::${targetModel}`, Date.now() + UNAVAIL_TTL_MS);
              logger.warn(`[LLM Gateway Model 404] Model ${targetModel} tidak tersedia untuk key ${keyMasked} (404). Diskip sementara (TTL 45m).`);
              break; // Skip attempt 2 immediately!
            }

            if (isHighDemandOrUnavailable) {
              // Mark model globally in cooldown for 60s so other keys don't waste time hitting 503 on it
              LLMGateway.globalModelCooldownMap.set(targetModel, Date.now() + 60 * 1000);
              this.keyModelCooldownMap.set(kmKey, Date.now() + 60 * 1000);
              logger.warn(`[LLM Gateway High-Demand Failover] Model ${targetModel} sedang mengalami 503 (High Demand). Model ini diskip global selama 60s dan request segera dialihkan ke model berikutnya...`);
              break; // Skip attempt 2 immediately and cascade to next model on this key!
            }

            if (isTimeout) {
              // Put model in temporary 60s cooldown to prevent repeated slow calls
              this.keyModelCooldownMap.set(kmKey, Date.now() + 60 * 1000);
              logger.warn(`[LLM Gateway Timeout Failover] Model ${targetModel} timed out. Immediate failover to next model...`);
              break;
            }

            if (isRateLimitOrQuota) {
              this.metrics.rateLimitHits++;
              rateLimitEncounteredOnKey = true;
              consecutiveRateLimitsOnKey++;
              // Put this specific (key, model) in Fast-Failover cooldown for 90 seconds
              this.keyModelCooldownMap.set(kmKey, Date.now() + 90 * 1000);
              logger.warn(
                `[LLM Gateway Fast-Failover] Model ${targetModel} rate-limited pada key ${keyMasked}. Melompat ke model/key berikutnya...`
              );
              
              // If multiple models rate-limited on this key and other keys are available, jump directly to next key!
              if (consecutiveRateLimitsOnKey >= 2 && kIdx < evaluatedKeyCandidates.length - 1) {
                logger.info(`[LLM Gateway Fast Key Hop] Key ${keyMasked} kehabisan kuota pada beberapa model. Segera beralih ke API Key berikutnya (#${kIdx + 2}/${evaluatedKeyCandidates.length})...`);
                break modelLoop;
              }
              break;
            }

            if (isServerError) {
              if (modelAttempts < maxModelAttempts) {
                // Exponential backoff with jitter before next retry on the same key
                const jitter = Math.floor(Math.random() * 200) + 100;
                const delay = Math.min(1000, 200 * Math.pow(2, modelAttempts - 1) + jitter);
                logger.info(`[LLM Gateway Backoff] Waiting ${delay}ms before retrying model ${targetModel}...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
              }
            }
          }
        }

        if ((keyState.status as string) === 'revoked') {
          break modelLoop; // move to next key immediately if key revoked
        }
      }

      // If key was revoked, skip circuit breaker and continue to next key
      if ((keyState.status as string) === 'revoked') {
        continue keyCandidateLoop;
      }

      // BUG FIX 3: Only trip circuit breaker if rate limit error (429/quota) ACTUALLY occurred on this key
      const isConfirmedRateLimited = !anyModelSucceededOnKey && rateLimitEncounteredOnKey && consecutiveRateLimitsOnKey >= Math.min(2, currentModelsToTry.length);
      if (isConfirmedRateLimited) {
        this.metrics.circuitBreakerTrips++;
        const cooldownMs = 2.5 * 60 * 1000;
        keyState.status = 'rate_limited';
        keyState.cooldownUntil = Date.now() + cooldownMs;
        keyState.lastErrorReason = 'All Models Rate Limited / Quota Exceeded (429)';
        this.recordRateLimitCooldown(activeKey, keyId, cooldownMs).catch(() => {});
        logger.warn(
          `[LLM Gateway Circuit Breaker] Rate-limit confirmed on key ${keyMasked}. Isolated for 2.5 minutes.`
        );
      }
    }

    this.metrics.failedRequests++;
    throw (
      lastError ||
      new Error(
        'Semua API Key dan Model Gemini sedang mengalami limit atau gangguan. Silakan coba kembali sesaat lagi.'
      )
    );
  }

  private async recordSuccessLog(details: {
    keyId: string;
    keyMasked: string;
    key: string;
    endpoint: string;
    modelUsed: string;
    toolName: string;
    latencyMs: number;
    keySource: 'user_custom' | 'admin_pool' | 'env';
    userCode: string;
  }) {
    try {
      const keys = await dbGetApiKeys();
      const targetKey = keys.find((k: any) => k.key === details.key || k.id === details.keyId);
      if (targetKey) {
        targetKey.dailyUsage = (targetKey.dailyUsage || 0) + 1;
        targetKey.monthlyUsage = (targetKey.monthlyUsage || 0) + 1;
        targetKey.lastUsedAt = new Date().toISOString();
        if (!targetKey.toolUsage) targetKey.toolUsage = {};
        targetKey.toolUsage[details.toolName] = (targetKey.toolUsage[details.toolName] || 0) + 1;
        if (!targetKey.modelUsage) targetKey.modelUsage = {};
        targetKey.modelUsage[details.modelUsed] = (targetKey.modelUsage[details.modelUsed] || 0) + 1;
        if (!targetKey.modelStatus) targetKey.modelStatus = {};
        targetKey.modelStatus[details.modelUsed] = 'active';
        await dbSaveApiKeys(keys);
        this.emitEvent({ type: 'apikeys_updated', keys });
      }

      const newLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        keyId: details.keyId,
        keyMasked: details.keyMasked,
        endpoint: details.endpoint,
        timestamp: new Date().toISOString(),
        status: 'success' as const,
        modelUsed: details.modelUsed,
        toolName: details.toolName,
        latencyMs: details.latencyMs,
        keySource: details.keySource,
        userCode: details.userCode,
      };

      await dbAddApiKeyLog(newLog);
      this.emitEvent({ type: 'apikey_log_added', log: newLog });
    } catch (e) {
      logger.warn('[LLM Gateway Telemetry Record Error]', e);
    }
  }

  private async recordRateLimitCooldown(key: string, keyId: string, cooldownMs: number) {
    try {
      const keys = await dbGetApiKeys();
      const found = keys.find((k: any) => k.key === key || k.id === keyId);
      if (found) {
        found.cooldownUntil = Date.now() + cooldownMs;
        // BUG FIX 4: Set status to 'rate_limited' (NOT 'active') during cooldown
        found.status = 'rate_limited';
        await dbSaveApiKeys(keys);
        this.emitEvent({ type: 'apikeys_updated', keys });
      }
    } catch (e) {}
  }

  private async recordKeyRevocation(key: string, keyId: string) {
    try {
      const keys = await dbGetApiKeys();
      const found = keys.find((k: any) => k.key === key || k.id === keyId);
      if (found) {
        found.status = 'revoked';
        await dbSaveApiKeys(keys);
        this.emitEvent({ type: 'apikeys_updated', keys });
      }
    } catch (e) {}
  }
}

export const llmGateway = LLMGateway.getInstance();
