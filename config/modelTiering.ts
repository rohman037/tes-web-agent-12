export interface ModelQuotaSpec {
  name: string;
  rpmLimit: number;
  tpmLimit: number;
  rpdLimit: number;
  unlimited?: boolean;
}

export const MODEL_QUOTA_SPECS: Record<string, ModelQuotaSpec> = {
  'gemini-3.8-flash': { name: 'gemini-3.8-flash', rpmLimit: 15, tpmLimit: 1000000, rpdLimit: 1500 },
  'gemini-3.7-flash': { name: 'gemini-3.7-flash', rpmLimit: 15, tpmLimit: 1000000, rpdLimit: 1500 },
  'gemini-3.6-flash': { name: 'gemini-3.6-flash', rpmLimit: 15, tpmLimit: 1000000, rpdLimit: 1500 },
  'gemini-3.5-flash': { name: 'gemini-3.5-flash', rpmLimit: 15, tpmLimit: 1000000, rpdLimit: 1500 },
  'gemini-3.5-flash-lite': { name: 'gemini-3.5-flash-lite', rpmLimit: 30, tpmLimit: 1000000, rpdLimit: 1500 },
  'gemini-3.1-flash-lite': { name: 'gemini-3.1-flash-lite', rpmLimit: 30, tpmLimit: 1000000, rpdLimit: 1500 },
  'gemini-3.1-pro-preview': { name: 'gemini-3.1-pro-preview', rpmLimit: 5, tpmLimit: 250000, rpdLimit: 50 },

  // Normalization aliases
  'flash-3.8': { name: 'gemini-3.8-flash', rpmLimit: 15, tpmLimit: 1000000, rpdLimit: 1500 },
  'flash-3.7': { name: 'gemini-3.7-flash', rpmLimit: 15, tpmLimit: 1000000, rpdLimit: 1500 },
  'flash-3.6': { name: 'gemini-3.6-flash', rpmLimit: 15, tpmLimit: 1000000, rpdLimit: 1500 },
  'flash-3.5': { name: 'gemini-3.5-flash', rpmLimit: 15, tpmLimit: 1000000, rpdLimit: 1500 },
  'flash-lite-3.5': { name: 'gemini-3.5-flash-lite', rpmLimit: 30, tpmLimit: 1000000, rpdLimit: 1500 },
  'flash-lite-3.1': { name: 'gemini-3.1-flash-lite', rpmLimit: 30, tpmLimit: 1000000, rpdLimit: 1500 },
  'pro-3.1': { name: 'gemini-3.1-pro-preview', rpmLimit: 5, tpmLimit: 250000, rpdLimit: 50 },

  'embedding-2': { name: 'embedding-2', rpmLimit: 100, tpmLimit: 30000, rpdLimit: 1000 },
  'embedding-1': { name: 'embedding-1', rpmLimit: 100, tpmLimit: 30000, rpdLimit: 1000 },
  'gemini-3.5-transcribe': { name: 'gemini-3.5-transcribe', rpmLimit: 15, tpmLimit: 500000, rpdLimit: 1500 },
};

export const GROUNDING_LIMITS = {
  searchGroundingDailyLimit: 1500,
  mapGroundingDailyLimit: 500,
};

// Hard Guardrails: Veo 3 & Nano Banana are strictly forbidden
const FORBIDDEN_MODELS = ['veo-3', 'nano-banana', 'veo3', 'nanobanana'];

export function validateModelName(modelName: string): string {
  const normalized = (modelName || '').toLowerCase().trim();
  for (const forbidden of FORBIDDEN_MODELS) {
    if (normalized.includes(forbidden)) {
      throw new Error(`[Hard Guardrail Violation] Model '${modelName}' is strictly prohibited or unavailable in Google AI Studio pool (Veo/Nano Banana).`);
    }
  }
  return normalized;
}

export type TaskType =
  | 'validation'
  | 'sanitation'
  | 'classification'
  | 'draft'
  | 'summarize'
  | 'bulk'
  | 'generate-final'
  | 'realtime'
  | 'stream'
  | 'transcribe'
  | 'similarity'
  | 'semantic-search'
  | 'trend-research'
  | 'product_intelligence'
  | 'viral_product_analysis'
  | 'content_generation'
  | 'script_generation'
  | 'adaptation_script_generation'
  | 'video_prompt_seo_generation'
  | 'video_analysis'
  | string;

export const TASK_MODEL_FALLBACK_CHAINS: Record<string, string[]> = {
  validation: ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'],
  sanitation: ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'],
  classification: ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'],

  draft: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'],
  summarize: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'],
  bulk: ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],

  'generate-final': ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'],
  product_intelligence: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'],
  viral_product_analysis: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'],
  content_generation: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'],
  script_generation: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'],
  adaptation_script_generation: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'],
  video_prompt_seo_generation: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'],
  video_analysis: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'],
  video_to_prompt: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'],
  prompt_splitter: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'],
  photo_prompt: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'],
  'photo-prompt': ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'],
  'generate-photo-prompt': ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'],

  realtime: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.1-flash-lite'],
  stream: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.1-flash-lite'],
  transcribe: ['gemini-3.5-transcribe', 'gemini-3.8-flash'],

  similarity: ['embedding-2', 'embedding-1'],
  'semantic-search': ['embedding-2', 'embedding-1'],

  'trend-research': ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'], // with search grounding enabled
};

export function getFallbackChainForTask(taskType: TaskType): string[] {
  const normalizedTask = (taskType || 'generate-final').toLowerCase().trim();
  const chain = TASK_MODEL_FALLBACK_CHAINS[normalizedTask] || [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.1-pro-preview',
  ];
  
  // Validate every model in chain against forbidden guardrails
  for (const m of chain) {
    validateModelName(m);
  }
  return chain;
}
