import {
  dbGetApiKeys,
  dbSaveApiKeys,
  dbGetApiKeyLogs,
  dbAddApiKeyLog,
  dbGetModelPriorities,
  dbSaveModelPriorities,
} from '@/src/db/dbService';
import { llmGateway } from '@/server/core/llm/routing/llmGateway';
import { broadcastLiveEvent } from '@/server/core/state/serverState';
import {
  TOP_MODEL_ORDER,
  IMAGE_MODEL_ORDER,
  VIDEO_MODEL_ORDER,
} from '@/server/core/llm/routing/modelRouter';
import { isRealApiKey, maskApiKeyStr, getGeminiClient } from '@/server/core/llm/keyUtils';
import { recordAuditLog } from '@/server/core/security/auditLogService';
import { logger } from '@/server/core/utils/logger';

export async function getApiKeysService(maskForClient: boolean = true) {
  const keys = await dbGetApiKeys();
  if (!keys || !Array.isArray(keys)) return [];
  if (!maskForClient) return keys;

  // Mask API keys so raw secret keys are never exposed over the wire
  return keys.map((k: any) => ({
    ...k,
    key: maskApiKeyStr(k.key || ''),
    masked: true,
  }));
}

export async function updateApiKeysService(newKeys: any[], actorName?: string) {
  if (!Array.isArray(newKeys)) {
    throw new Error('Payload kunci API harus berupa array');
  }

  const existingKeys = await dbGetApiKeys();
  const existingMap = new Map<string, any>();
  for (const ek of existingKeys) {
    if (ek.id) existingMap.set(ek.id, ek);
    if (ek.alias) existingMap.set(ek.alias, ek);
  }

  // Validate and preserve raw keys if masked string was sent back
  const sanitizedKeys = newKeys.map((item: any, idx: number) => {
    let rawKey = String(item.key || '').trim();

    // If key is masked (contains '...' or '***'), restore existing raw key from DB
    if (rawKey.includes('...') || rawKey.includes('***')) {
      const existing = (item.id && existingMap.get(item.id)) || (item.alias && existingMap.get(item.alias));
      if (existing && existing.key) {
        rawKey = existing.key;
      }
    }

    // Validation: key must have a reasonable length
    if (rawKey && rawKey.length < 15 && !rawKey.startsWith('AIzaSy')) {
      logger.warn(`[API Key Security] Potensi kunci tidak valid terdeteksi pada indeks ${idx}: ${rawKey.substring(0, 6)}...`);
    }

    return {
      ...item,
      id: item.id || `key_${Date.now()}_${idx}`,
      key: rawKey,
      updatedAt: new Date().toISOString(),
    };
  });

  await dbSaveApiKeys(sanitizedKeys);
  llmGateway.syncPolledKeys(sanitizedKeys);

  // Broadcast masked keys to avoid leaking plaintext keys via SSE
  const maskedBroadcastKeys = sanitizedKeys.map((k) => ({
    ...k,
    key: maskApiKeyStr(k.key || ''),
  }));
  broadcastLiveEvent({ type: 'apikeys_updated', keys: maskedBroadcastKeys });

  // Record audit log
  await recordAuditLog({
    action: '[API KEY] Update Pool Kunci API',
    details: `Admin memperbarui ${sanitizedKeys.length} API key dalam pool Gemini.`,
    category: 'apikey',
    actor: actorName || 'Admin',
    adminName: actorName || 'Administrator',
  });

  return maskedBroadcastKeys;
}

export async function getApiKeyLogsService() {
  const logs = await dbGetApiKeyLogs();
  return logs || [];
}

export async function addApiKeyLogService(log: any) {
  if (!log || typeof log !== 'object') {
    throw new Error('Payload log tidak valid');
  }
  const fullLog = {
    ...log,
    id: log.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: log.timestamp || new Date().toISOString(),
  };
  await dbAddApiKeyLog(fullLog);
  broadcastLiveEvent({ type: 'apikey_log_added', log: fullLog });
  return fullLog;
}

export async function getModelPrioritiesService() {
  const priorities = await dbGetModelPriorities();
  return (
    priorities || {
      text: TOP_MODEL_ORDER,
      image: IMAGE_MODEL_ORDER,
      video: VIDEO_MODEL_ORDER,
    }
  );
}

export async function updateModelPrioritiesService(config: any) {
  if (!config || typeof config !== 'object') {
    throw new Error('Payload konfigurasi model priority tidak valid');
  }
  await dbSaveModelPriorities(config);
  broadcastLiveEvent({ type: 'model_priorities_updated', priorities: config });
  return config;
}

export function getLlmGatewayMetricsService() {
  return llmGateway.getMetrics();
}

export function getLlmGatewayHealthService() {
  const states = llmGateway.getKeyHealthStates();
  const metrics = llmGateway.getMetrics();
  return {
    metrics,
    keys: states,
    uptimePercentage: metrics.uptimePercentage,
    activePoolSize: metrics.activePoolSize,
    cooldownKeysCount: metrics.cooldownKeysCount,
  };
}

export async function testGeminiKeyService(apiKey?: string, keyId?: string) {
  let rawKey = apiKey && typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!rawKey && keyId) {
    const stored = await dbGetApiKeys();
    const found = stored.find((k: any) => k.id === keyId);
    if (found && found.key) rawKey = found.key.trim();
  }
  if (!rawKey) {
    throw new Error('API Key wajib diisi atau pilih keyId yang valid');
  }
  const aiInstance = getGeminiClient(rawKey);
  const startTime = Date.now();
  let testedModel = 'gemini-3.8-flash';
  let response: any = null;

  try {
    response = await aiInstance.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
      config: { maxOutputTokens: 5 },
    });
  } catch (err38) {
    try {
      testedModel = 'gemini-3.1-flash-lite';
      response = await aiInstance.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        config: { maxOutputTokens: 5 },
      });
    } catch (err31) {
      testedModel = 'gemini-2.5-flash';
      response = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        config: { maxOutputTokens: 5 },
      });
    }
  }

  const latency = Date.now() - startTime;
  if (response && response.text) {
    try {
      const storedKeys = await dbGetApiKeys();
      let keyFound = false;
      const updatedStored = storedKeys.map((k: any) => {
        if ((keyId && k.id === keyId) || (k.key && k.key.trim() === rawKey)) {
          keyFound = true;
          return {
            ...k,
            status: 'active',
            verifiedByAdmin: true,
            lastPolledAt: new Date().toISOString(),
            pollStatus: 'active',
            lastTestedLatency: latency,
            lastTestedModel: testedModel,
          };
        }
        return k;
      });
      if (keyFound) {
        await dbSaveApiKeys(updatedStored);
        llmGateway.syncPolledKeys(updatedStored);
        broadcastLiveEvent({ type: 'apikeys_updated', keys: updatedStored });
      }
    } catch (dbErr) {
      logger.warn('[Test Gemini Key] Notice syncing test key to db:', dbErr);
    }

    return { success: true, latency, model: testedModel };
  }

  return { success: false, error: 'Respons kosong dari Gemini API' };
}

export async function pollAllApiKeysService(keysOverride?: any[]) {
  const storedKeys = await dbGetApiKeys();
  const keysToTest =
    Array.isArray(keysOverride) && keysOverride.length > 0 ? keysOverride : storedKeys;

  if (!keysToTest || keysToTest.length === 0) {
    return {
      success: true,
      totalTested: 0,
      activeCount: 0,
      rateLimitedCount: 0,
      invalidCount: 0,
      results: [],
      message: 'Tidak ada API Key di dalam pool untuk di-poll.',
    };
  }

  const testSingleKey = async (keyItem: any) => {
    const rawKey = (keyItem.key || '').trim();
    if (!isRealApiKey(rawKey)) {
      return {
        id: keyItem.id,
        alias: keyItem.alias || 'Unknown',
        keyMasked: maskApiKeyStr(rawKey),
        status: 'revoked',
        latencyMs: 0,
        modelTested: 'none',
        error: 'Bukan format API key valid / placeholder',
      };
    }

    const start = Date.now();
    let testedModel = 'gemini-3.8-flash';
    try {
      const aiInstance = getGeminiClient(rawKey);
      let resp: any = null;
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout poll (4s)')), 4000)
        );
        resp = await Promise.race([
          aiInstance.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [{ role: 'user', parts: [{ text: 'P' }] }],
            config: { maxOutputTokens: 2 },
          }),
          timeoutPromise,
        ]);
      } catch (mErr: any) {
        testedModel = 'gemini-3.1-flash-lite';
        const timeoutPromise2 = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout poll (3s)')), 3000)
        );
        resp = await Promise.race([
          aiInstance.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: [{ role: 'user', parts: [{ text: 'P' }] }],
            config: { maxOutputTokens: 2 },
          }),
          timeoutPromise2,
        ]);
      }

      const latencyMs = Date.now() - start;
      return {
        id: keyItem.id,
        alias: keyItem.alias,
        keyMasked: maskApiKeyStr(rawKey),
        status: 'active',
        latencyMs,
        modelTested: testedModel,
        ok: true,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const errMsg = err?.message || '';
      const is429 = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED');
      const isDead =
        errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('API_KEY_INVALID');

      return {
        id: keyItem.id,
        alias: keyItem.alias,
        keyMasked: maskApiKeyStr(rawKey),
        status: isDead ? 'revoked' : is429 ? 'rate_limited' : 'error',
        latencyMs,
        modelTested: testedModel,
        ok: false,
        error: errMsg.slice(0, 100),
      };
    }
  };

  const results: any[] = [];
  const batchSize = 10;
  for (let i = 0; i < keysToTest.length; i += batchSize) {
    const chunk = keysToTest.slice(i, i + batchSize);
    const chunkResults = await Promise.all(chunk.map(testSingleKey));
    results.push(...chunkResults);
  }
  const activeCount = results.filter((r) => r.status === 'active').length;
  const rateLimitedCount = results.filter((r) => r.status === 'rate_limited').length;
  const invalidCount = results.filter((r) => r.status === 'revoked' || r.status === 'error').length;

  const resultMap = new Map<string, any>(results.map((r) => [r.id, r]));
  const nowIso = new Date().toISOString();
  const updatedKeys = keysToTest.map((k: any) => {
    const testRes = resultMap.get(k.id);
    if (!testRes) return k;
    const isActive = testRes.status === 'active';
    return {
      ...k,
      status: isActive ? 'active' : testRes.status === 'rate_limited' ? 'active' : 'revoked',
      verifiedByAdmin: isActive,
      lastPolledAt: nowIso,
      pollStatus: testRes.status,
      lastTestedLatency: testRes.latencyMs || 0,
      lastTestedModel: testRes.modelTested || 'gemini-3.8-flash',
      cooldownUntil: testRes.status === 'rate_limited' ? Date.now() + 90000 : 0,
      modelStatus: {
        ...(k.modelStatus || {}),
        [testRes.modelTested || 'gemini-3.8-flash']:
          testRes.status === 'active'
            ? 'active'
            : testRes.status === 'rate_limited'
            ? 'rate_limited'
            : 'dead',
      },
    };
  });

  try {
    await dbSaveApiKeys(updatedKeys);
    llmGateway.syncPolledKeys(updatedKeys);
    broadcastLiveEvent({ type: 'apikeys_updated', keys: updatedKeys });
  } catch (saveErr) {
    logger.warn('[API Key Poll] Warning updating db keys:', saveErr);
  }

  broadcastLiveEvent({
    type: 'llm_gateway_pool_polled',
    poolSummary: {
      totalTested: results.length,
      activeCount,
      rateLimitedCount,
      invalidCount,
      timestamp: new Date().toISOString(),
    },
    results,
  });

  return {
    success: true,
    totalTested: results.length,
    activeCount,
    rateLimitedCount,
    invalidCount,
    results,
    updatedKeys,
    message: `Polling selesai: ${activeCount}/${results.length} Key Aktif & Diprioritaskan untuk Routing LLM.`,
  };
}

import { getGlobalLedgerSnapshot, getPacificDateString } from '@/server/services/quotaLedger';

export async function getQuotaSummaryService() {
  const ledger = getGlobalLedgerSnapshot();
  const keys = await dbGetApiKeys();

  let totalFlashRpdUsed = 0;
  let totalFlashRpdLimit = 0;
  const modelUsageMap: Record<string, { used: number; limit: number }> = {};
  const keyLoadList: { keyId: string; alias?: string; totalRpd: number }[] = [];

  for (const [keyId, models] of Object.entries(ledger)) {
    let keyTotalRpd = 0;
    for (const [model, st] of Object.entries(models as any)) {
      const rpdUsed = st.rpdUsed || 0;
      keyTotalRpd += rpdUsed;

      if (!modelUsageMap[model]) {
        modelUsageMap[model] = { used: 0, limit: model.includes('flash') ? 20 * (keys.length || 1) : 500 * (keys.length || 1) };
      }
      modelUsageMap[model].used += rpdUsed;

      if (model.includes('flash')) {
        totalFlashRpdUsed += rpdUsed;
        totalFlashRpdLimit += 20;
      }
    }
    const matchedKey = keys.find((k: any) => k.id === keyId || k.alias === keyId);
    keyLoadList.push({
      keyId,
      alias: matchedKey?.alias || matchedKey?.name || keyId.slice(0, 8),
      totalRpd: keyTotalRpd,
    });
  }

  keyLoadList.sort((a, b) => b.totalRpd - a.totalRpd);
  const top10HotKeys = keyLoadList.slice(0, 10);

  const flashRemaining = Math.max(0, totalFlashRpdLimit - totalFlashRpdUsed);
  const exhaustionHours = totalFlashRpdUsed > 0 ? (flashRemaining / (totalFlashRpdUsed / 3)) : 999;
  const predictedExhaustion = exhaustionHours < 999 ? `~${exhaustionHours.toFixed(1)} jam lagi` : 'Stabil (Belum ada ancaman kehabisan)';

  return {
    success: true,
    pacificDate: getPacificDateString(),
    nextPacificReset: '00:00 PST (Pacific Time)',
    modelUsageSummary: modelUsageMap,
    top10HotKeys,
    flashPoolStatus: {
      totalLimit: totalFlashRpdLimit,
      totalUsed: totalFlashRpdUsed,
      remaining: flashRemaining,
      predictedExhaustion,
    },
    ledgerSnapshot: ledger,
  };
}

