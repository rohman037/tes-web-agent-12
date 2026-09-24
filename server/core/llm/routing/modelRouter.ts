import { resolveApiKey, ResolvedKeyContext } from './apiKeyResolver';
import {
  ModelTier,
  ModelRoutingResult,
  MODEL_TIERS,
  TOP_MODEL_ORDER,
  IMAGE_MODEL_ORDER,
  TTS_MODEL_ORDER,
  AUDIO_TRANSCRIBE_MODEL_ORDER,
  VIDEO_MODEL_ORDER,
  PHOTO_PROMPT_MODEL_ORDER,
  ALL_GEMINI_CASCADING_MODELS,
  MODEL_CASCADE,
  GATEWAY_MODELS_HIERARCHY,
  GATEWAY_IMAGE_MODELS_HIERARCHY,
  GATEWAY_PHOTO_PROMPT_MODELS_HIERARCHY,
  GATEWAY_TTS_MODELS_HIERARCHY,
  GATEWAY_AUDIO_TRANSCRIBE_MODELS_HIERARCHY,
  GATEWAY_VIDEO_MODELS_HIERARCHY,
  getModelsForTier,
  normalizeGeminiModel
} from './modelConstants';

export type { ModelTier, ModelRoutingResult };
export {
  MODEL_TIERS,
  TOP_MODEL_ORDER,
  IMAGE_MODEL_ORDER,
  TTS_MODEL_ORDER,
  AUDIO_TRANSCRIBE_MODEL_ORDER,
  VIDEO_MODEL_ORDER,
  PHOTO_PROMPT_MODEL_ORDER,
  ALL_GEMINI_CASCADING_MODELS,
  MODEL_CASCADE,
  GATEWAY_MODELS_HIERARCHY,
  GATEWAY_IMAGE_MODELS_HIERARCHY,
  GATEWAY_PHOTO_PROMPT_MODELS_HIERARCHY,
  GATEWAY_TTS_MODELS_HIERARCHY,
  GATEWAY_AUDIO_TRANSCRIBE_MODELS_HIERARCHY,
  GATEWAY_VIDEO_MODELS_HIERARCHY,
  getModelsForTier,
  normalizeGeminiModel
};

/**
 * Evaluates the initial routing tier based on the complexity of the requested task.
 */
export function getInitialTierForTask(aeoQueryMode?: string, hasVideo?: boolean): ModelTier {
  if (aeoQueryMode === 'short' && !hasVideo) {
    return 'tier2';
  }
  return 'flagship';
}

/**
 * Evaluates the model to use and maps execution tier based on user choice,
 * cascading fallback state, and API key source, prioritizing the top model first.
 */
export function getModelRoutingPlan(
  userRequestedModel?: string,
  customApiKeyInput?: string
): { keyContext: ResolvedKeyContext; targetModels: string[]; primaryTier: ModelTier } {
  const keyContext = resolveApiKey(customApiKeyInput);
  const normalizedRequested = (userRequestedModel || '').trim();

  // Build target candidate list with TOP model priority first
  const baseCandidates = normalizedRequested
    ? [normalizedRequested, ...TOP_MODEL_ORDER]
    : [...TOP_MODEL_ORDER];

  const targetModels = Array.from(new Set(baseCandidates)).filter(Boolean);

  if (keyContext.source === 'user_key') {
    return {
      keyContext,
      targetModels,
      primaryTier: 'user_key',
    };
  }

  // Determine primary tier based on the leading model
  const leadingModel = targetModels[0] || 'gemini-3.7-flash';
  let primaryTier: ModelTier = 'flagship';
  if ((MODEL_TIERS.tier3 as readonly string[]).includes(leadingModel)) {
    primaryTier = 'tier3';
  } else if ((MODEL_TIERS.tier2 as readonly string[]).includes(leadingModel)) {
    primaryTier = 'tier2';
  } else if ((MODEL_TIERS.specialized as readonly string[]).includes(leadingModel)) {
    primaryTier = 'specialized';
  }

  return {
    keyContext,
    targetModels,
    primaryTier,
  };
}

/**
 * Maps a specific model used to its corresponding execution tier
 */
export function getTierForModel(modelName: string, isUserKey: boolean): ModelTier {
  if (isUserKey) return 'user_key';
  if ((MODEL_TIERS.flagship as readonly string[]).includes(modelName)) return 'flagship';
  if ((MODEL_TIERS.tier3 as readonly string[]).includes(modelName)) return 'tier3';
  if ((MODEL_TIERS.specialized as readonly string[]).includes(modelName)) return 'specialized';
  return 'tier2';
}
