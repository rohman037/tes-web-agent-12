export type ModelTier = 'flagship' | 'tier2' | 'tier3' | 'specialized' | 'user_key';

export interface ModelRoutingResult {
  modelUsed: string;
  tierUsed: ModelTier;
  text?: string;
}

/**
 * All Gemini models categorized into strict tiers from official specifications:
 * - Tier 1 (Flagship & Deep Reasoning): Highest intelligence, deep reasoning, complex multimodality
 * - Tier 2 (High-Speed Workhorse): Ultra-fast, highly reliable multimodal generation
 * - Tier 3 (Resilient Lite & Zero-Limit Fallback): Ultra-lightweight, maximum rate-limit tolerance
 * - Specialized: Modality-specific (Image, TTS, Audio, Robotics, Agentic)
 */
export const MODEL_TIERS = {
  flagship: [
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-pro-preview',
  ],
  tier2: [
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
  ],
  tier3: [
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite',
  ],
  videoAnalysis: [
    'gemini-3.6-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
  ],
  specialized: [
    // Audio Transcription Tasks (Primary)
    'gemini-3.5-transcribe',
    // Image Generation Models (Nano Banana family)
    'gemini-3.1-flash-image', // Nano Banana 2 (High Quality)
    'gemini-3.1-flash-lite-image', // Nano Banana 2 Lite (General)
    'gemini-3-pro-image', // Nano Banana Pro
    // TTS & Audio
    'gemini-3.1-flash-tts-preview',
    'gemini-3.1-flash-tts',
    'gemini-2.5-flash-tts',
    'gemini-2.5-pro-tts',
    'lyria-3-clip-preview',
    'lyria-3-pro-preview',
    // Agentic & Multimodal Generative
    'gemini-omni-flash',
    'antigravity',
    'deep-research-pro-preview',
    'computer-use-preview',
    // Robotics & Open Weights
    'gemini-robotics-er-1.6-preview',
    'gemini-robotics-er-2-preview',
    'gemma-4-26b',
    'gemma-4-31b',
    'gemini-embedding-2-preview',
    'gemini-embedding-2',
    'gemini-embedding-1',
  ],
} as const;

/**
 * Global optimal priority order for general text & multimodal prompt generation.
 * New Priority: #1 gemini-3.8-flash -> #2 gemini-3.1-flash-lite -> #3 gemini-3.7-flash -> #4 gemini-3.6-flash -> #5 gemini-3.5-flash -> #6 gemini-3.5-flash-lite -> #7 gemini-3.1-pro-preview
 */
export const TOP_MODEL_ORDER: string[] = [
  // 1. Primary flagship: Highest quality, newest generation, fastest response
  'gemini-3.8-flash',

  // 2. High-throughput resilient lite model
  'gemini-3.1-flash-lite',

  // 3. High capability flagship models (with automatic failover)
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',

  // 4. Pro / Thinking models (Deep reasoning & complex STEM)
  'gemini-3.1-pro-preview',
];

/**
 * Image model priority order (Nano Banana family)
 */
export const IMAGE_MODEL_ORDER: string[] = [
  'gemini-3.1-flash-image', // Nano Banana 2 (High Quality)
  'gemini-3.1-flash-lite-image', // Nano Banana 2 Lite (Fast)
  'gemini-3-pro-image', // Nano Banana Pro
  'gemini-3.8-flash',
  'gemini-3.7-flash',
];

/**
 * TTS / Voice model priority order
 */
export const TTS_MODEL_ORDER: string[] = [
  'gemini-3.1-flash-tts-preview',
  'gemini-3.1-flash-tts',
  'gemini-2.5-flash-tts',
  'gemini-2.5-pro-tts',
];

/**
 * Audio Transcription model priority order
 */
export const AUDIO_TRANSCRIBE_MODEL_ORDER: string[] = [
  'gemini-3.5-transcribe',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
];

export const VIDEO_MODEL_ORDER: string[] = [
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
];

/**
 * Photo Prompt & Vision Analysis model priority order.
 * High-performance vision models for deep image deconstruction, camera optics, and prompt synthesis.
 */
export const PHOTO_PROMPT_MODEL_ORDER: string[] = [
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-pro-preview',
];

// Single source of truth aliases for backward compatibility across the app
export const ALL_GEMINI_CASCADING_MODELS = TOP_MODEL_ORDER;
export const MODEL_CASCADE = TOP_MODEL_ORDER;
export const GATEWAY_MODELS_HIERARCHY = TOP_MODEL_ORDER;
export const GATEWAY_IMAGE_MODELS_HIERARCHY = IMAGE_MODEL_ORDER;
export const GATEWAY_PHOTO_PROMPT_MODELS_HIERARCHY = PHOTO_PROMPT_MODEL_ORDER;
export const GATEWAY_TTS_MODELS_HIERARCHY = TTS_MODEL_ORDER;
export const GATEWAY_AUDIO_TRANSCRIBE_MODELS_HIERARCHY = AUDIO_TRANSCRIBE_MODEL_ORDER;
export const GATEWAY_VIDEO_MODELS_HIERARCHY = VIDEO_MODEL_ORDER;

/**
 * Returns the model list prioritized for a given tier.
 */
export function getModelsForTier(tier: ModelTier): string[] {
  switch (tier) {
    case 'flagship':
      return [
        'gemini-3.8-flash',
        'gemini-3.1-flash-lite',
        'gemini-3.7-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
        'gemini-3.1-pro-preview',
      ];
    case 'tier2':
      return [
        'gemini-3.8-flash',
        'gemini-3.1-flash-lite',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
      ];
    case 'tier3':
      return [
        'gemini-3.1-flash-lite',
        'gemini-3.8-flash',
        'gemini-3.5-flash-lite',
      ];
    case 'specialized':
      return [...MODEL_TIERS.specialized];
    default:
      return [...TOP_MODEL_ORDER];
  }
}

/**
 * Normalizes user or legacy model strings to active supported model identifiers.
 */
export function normalizeGeminiModel(inputModel?: string): string {
  const m = (inputModel || '').toLowerCase().trim();
  if (!m) return TOP_MODEL_ORDER[0];

  // Modern common aliases
  if (m === 'gemini-flash' || m === 'flash' || m === 'gemini-flash-latest') return 'gemini-3.8-flash';
  if (m === 'gemini-lite' || m === 'flash-lite' || m === 'gemini-flash-lite') return 'gemini-3.1-flash-lite';
  if (m === 'gemini-pro' || m === 'pro') return 'gemini-3.1-pro-preview';
  if (m === 'gemini-transcribe' || m === 'audio-transcribe') return 'gemini-3.5-transcribe';
  if (m === 'gemini-tts') return 'gemini-3.1-flash-tts-preview';

  // Specific version matches
  if (m === 'gemini-3.8-flash' || m === 'gemini-3.8' || m === '3.8-flash') return 'gemini-3.8-flash';
  if (m === 'gemini-3.1-flash-lite' || m === '3.1-flash-lite') return 'gemini-3.1-flash-lite';
  if (m === 'gemini-3.7-flash' || m === 'gemini-3.7' || m === '3.7-flash') return 'gemini-3.7-flash';
  if (m === 'gemini-3.6-flash' || m === '3.6-flash') return 'gemini-3.6-flash';
  if (m === 'gemini-3.5-flash' || m === '3.5-flash') return 'gemini-3.5-flash';
  if (m === 'gemini-3.5-flash-lite' || m === '3.5-flash-lite') return 'gemini-3.5-flash-lite';
  if (m === 'gemini-3.1-pro-preview' || m === 'gemini-3.1-pro' || m === '3.1-pro') return 'gemini-3.1-pro-preview';
  if (m === 'gemini-3.5-transcribe') return 'gemini-3.5-transcribe';

  // Deprecated models smoothly mapped to current equivalents to avoid 404
  if (m === 'gemini-2.5-flash' || m === '2.5-flash') return 'gemini-3.8-flash';
  if (m === 'gemini-2.5-flash-lite' || m === '2.5-flash-lite') return 'gemini-3.1-flash-lite';
  if (m === 'gemini-2-flash-lite' || m === 'gemini-2.0-flash-lite' || m === '2.0-flash-lite' || m === '2-flash-lite') return 'gemini-3.1-flash-lite';
  if (m === 'gemini-2-flash' || m === 'gemini-2.0-flash' || m === '2.0-flash' || m === '2-flash') return 'gemini-3.8-flash';
  if (m === 'gemini-2.5-pro' || m === '2.5-pro') return 'gemini-3.1-pro-preview';
  if (m === 'gemini-1.5-flash' || m === '1.5-flash') return 'gemini-3.8-flash';
  if (m === 'gemini-1.5-pro' || m === '1.5-pro') return 'gemini-3.1-pro-preview';

  // Image models
  if (m.includes('image') || m.includes('banana')) {
    if (m.includes('pro')) return 'gemini-3-pro-image';
    if (m.includes('lite')) return 'gemini-3.1-flash-lite-image';
    return 'gemini-3.1-flash-image';
  }

  // TTS models
  if (m.includes('tts')) {
    if (m.includes('preview')) return 'gemini-3.1-flash-tts-preview';
    if (m.includes('pro')) return 'gemini-2.5-pro-tts';
    return 'gemini-3.1-flash-tts';
  }

  return inputModel || TOP_MODEL_ORDER[0];
}
