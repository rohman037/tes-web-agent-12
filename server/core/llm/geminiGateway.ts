import { llmGateway } from './routing/llmGateway';
import { broadcastLiveEvent } from '../state/serverState';
import { llmCache } from './cache';
import { smartRateLimiter } from './rate-limiter';
import { acquireSlot, executeSingleFlightRequest, markKeyWarmForModel } from '@/server/services/quotaRouter';
import { validateModelName } from '@/config/modelTiering';

// Register broadcast handler with LLM Gateway
llmGateway.setBroadcastHandler((event) => {
  try {
    broadcastLiveEvent(event);
  } catch (e) {}
});

export async function callGeminiWithFallback(
  userSelectedModel: string | undefined,
  promptPayload: any,
  customApiKeyHeader?: string,
  clientAccessCode?: string,
  targetTier?: 'flagship' | 'tier2' | 'tier3' | 'user_key',
  toolName?: string,
  isUserExplicitChoice?: boolean,
  customEndpoint?: string,
  isSingleRequestMode?: boolean
): Promise<{ text: string; modelUsed: string; tierUsed?: string; latencyMs?: number; keyMasked?: string; cached?: boolean }> {
  const inferredTool = toolName || 'AI Generation';
  const requestConfig = { ...(promptPayload.config || {}) };
  
  if (userSelectedModel) {
    validateModelName(userSelectedModel);
  }

  // 1. Check Semantic / Exact-Match Cache (Saves Google AI Studio RPD quota)
  const targetModel = userSelectedModel || 'gemini-3.8-flash';
  const cacheKey = llmCache.generateKey(targetModel, promptPayload.contents, requestConfig);
  const cachedResult = llmCache.get(cacheKey);
  if (cachedResult) {
    return {
      text: cachedResult.text,
      modelUsed: cachedResult.modelUsed,
      tierUsed: cachedResult.tierUsed,
      latencyMs: 2,
      keyMasked: cachedResult.keyMasked || 'CACHE-HIT',
      cached: true,
    };
  }

  // 2. Single-flight Deduplication & Quota Orchestrated Execution
  return executeSingleFlightRequest(cacheKey, async () => {
    // Acquire slot via Quota-Aware Orchestrator v2
    const slot = await acquireSlot(inferredTool, clientAccessCode ? 'free' : 'cron', userSelectedModel);

    let resolvedTier = targetTier;
    if (!resolvedTier) {
      if (inferredTool.toLowerCase().includes('helper') || inferredTool.toLowerCase().includes('splitter')) {
        resolvedTier = 'tier3';
      } else {
        resolvedTier = 'tier2';
      }
    }

    const gatewayPayload = {
      model: slot.model,
      isUserExplicitChoice: isUserExplicitChoice !== undefined ? isUserExplicitChoice : Boolean(userSelectedModel),
      contents: promptPayload.contents,
      config: requestConfig,
      customApiKeyHeader: slot.rawKey || customApiKeyHeader,
      clientAccessCode,
      toolName: inferredTool,
      targetTier: resolvedTier,
      endpoint: customEndpoint || `/api/${inferredTool.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      isSingleRequestMode: Boolean(isSingleRequestMode)
    };

    try {
      // 3. Schedule through Smart Rate Limiter & Queue with fallback handling
      const response = await smartRateLimiter.schedule(slot.model, async () => {
        return await llmGateway.execute(gatewayPayload);
      }, slot.keyId);

      // Store in cache
      llmCache.set(cacheKey, {
        text: response.text,
        modelUsed: response.modelUsed,
        tierUsed: response.tierUsed,
        latencyMs: response.latencyMs,
        keyMasked: response.keyMasked,
      });

      return {
        text: response.text,
        modelUsed: response.modelUsed,
        tierUsed: response.tierUsed,
        latencyMs: response.latencyMs,
        keyMasked: response.keyMasked,
        cached: false,
      };
    } catch (error: any) {
      const msg = error?.message || '';
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        markKeyWarmForModel(slot.keyId, slot.model);
      }
      throw error;
    }
  });
}

