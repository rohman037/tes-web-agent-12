/**
 * Types & Contracts for Replika Video Viral (3-Agent Reverse-Engineering + Content Adaptation Engine)
 */

export interface ReplicaVideoInput {
  // Input Video Sources
  tiktokUrl?: string;
  videoBase64?: string;
  videoMimeType?: string;
  videoDuration?: number;

  // Product & Content Context
  sourceTitle?: string;
  productNameOrTopic?: string;
  productUrl?: string;
  referenceImageBase64?: string;
  referenceImageMimeType?: string;

  // Settings
  targetDurationSeconds: number;       // e.g. 10, 20, 30, 40, 50, 60, 70
  splitDurationSeconds: number;        // e.g. 5, 6, 8, 10, 15
  enableTextOverlay: boolean;
  targetAI?: string;                   // 'veo' | 'sora' | 'runway' | 'kling' | 'general'
  aspectRatio?: string;                // '9:16' | '16:9' | '1:1'
  tone?: string;
  contentType?: string;

  // Custom Key / Access Code & Model Override
  customApiKey?: string;
  clientAccessCode?: string;
  preferredModel?: string;
}

export interface ViralAnalysisData {
  hook: string;
  emotional_trigger: string;
  retention_pattern: string;
  visual_style: string;
  camera_style: string;
  audio_style: string;
  editing_pattern: string;
  cta_pattern: string;
  text_overlay_style?: string;
}

export interface ProductAnalysisData {
  product_name: string;
  category: string;
  target_audience: string;
  features: string[];
  benefits?: string[];
  selling_angle_primary: string;
  selling_angle_secondary: string;
  keyword_core: string[];
  keyword_niche: string[];
  value_proposition: string;
  audience_intent?: string;
  market_positioning?: string;
}

export interface AdaptedConceptData {
  concept_title: string;
  concept_summary: string;
  strategy_summary: string;
  hook_strategy: string;
  cta_strategy: string;
}

export interface ReplicaScene {
  scene_number: number;
  start_second: number;
  end_second: number;
  visual: string;
  action: string;
  camera: string;
  audio: string;
  text_overlay?: string;
  dialogue_or_subtitle?: string;
  scene_goal?: string;
  copy_text_scene?: string;
}

export interface ReplicaClip {
  clip_number: number;
  start_second: number;
  end_second: number;
  duration_label?: string;
  master_prompt: string;
  copy_text_full?: string;
  scenes: ReplicaScene[];
}

export interface SeoData {
  caption: string;
  hashtags: string[];
  keywords_used: string[];
}

export interface QualityControlIssue {
  check_type: 'product_consistency' | 'prompt_relevance' | 'caption_relevance' | 'hashtag_intelligence' | 'audio_relevance' | 'scene_timing' | 'visual_hallucination';
  severity: 'warning' | 'critical';
  message: string;
  suggestion?: string;
}

export interface QualityScoreBreakdown {
  product_relevance: number; // 0-100
  visual_relevance: number;   // 0-100
  caption_relevance: number;  // 0-100
  hashtag_relevance: number;  // 0-100
  audio_relevance: number;    // 0-100
  scene_accuracy: number;     // 0-100
}

export interface QualityControlResult {
  passed: boolean;
  total_score: number; // 0-100
  quality_score: QualityScoreBreakdown;
  issues: QualityControlIssue[];
  refinement_attempted: boolean;
  extracted_keywords?: {
    core: string[];
    related: string[];
  };
}

export interface ReplicaVideoResponse {
  request_meta: {
    source_type: 'tiktok_url' | 'uploaded_video' | 'topic_or_product';
    target_duration_seconds: number;
    split_duration_seconds: number;
    total_clips: number;
    text_overlay_enabled: boolean;
    model_used?: string;
    latency_ms?: number;
  };
  viral_analysis: ViralAnalysisData;
  product_analysis: ProductAnalysisData;
  adapted_concept: AdaptedConceptData;
  seo: SeoData;
  clips: ReplicaClip[];
  quality_control?: QualityControlResult;
}
