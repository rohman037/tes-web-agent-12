/**
 * Core Data Contracts for Replika Video Viral (Product-First Architecture)
 */

// ==========================================
// 1. ROUTER AGENT CONTRACT
// ==========================================
export type WorkflowMode = 'product_first' | 'hybrid' | 'video_first';

export interface RouterInput {
  productUrl?: string;
  rawProductText?: string;
  productImages?: string[];
  referenceVideoUrl?: string;
  referenceVideoBuffer?: Buffer;
  userDirectives?: string;
}

export interface RouterOutput {
  mode: WorkflowMode;
  executionPlan: {
    requiresProductScraping: boolean;
    requiresVideoVision: boolean;
    useFallbackStyleTemplate: boolean;
  };
  normalizedInputs: {
    product: {
      url?: string;
      rawText?: string;
      images: string[];
    };
    video: {
      url?: string;
      buffer?: Buffer;
    };
  };
}

// ==========================================
// 2. PRODUCT AGENT CONTRACT (SINGLE SOURCE OF TRUTH)
// ==========================================
export interface ProductVisualAnchor {
  primaryColorPalette: string[];
  formFactor: string;              // e.g. "Airless pump bottle 50ml, frosted amber glass"
  distinctiveMarkings: string[];   // e.g. "White serif logo 'LUMEN', silver cap collar"
  textureAppearance: string;       // e.g. "Translucent golden gel with suspended micro-droplets"
  packageMaterial: string;         // e.g. "Matte recyclable polymer"
  immutablePromptKeywords: string; // Wajib disalin verbatim ke seluruh prompt visual adegan
}

export interface ProductAgentInput {
  url?: string;
  rawText?: string;
  images: string[];
}

export interface ProductAgentOutput {
  productId: string;
  title: string;
  canonicalCategory: string;
  verifiedFeatures: string[];      // Fakta fisik/kimia/material yang tertera di listing
  verifiedUSPs: string[];          // Nilai pembeda utama yang divalidasi
  verifiedClaims: string[];        // Klaim khasiat/keunggulan resmi (misal: "SPF 50+", "BPOM NA182...")
  forbiddenClaims: string[];       // Klaim dilarang/tidak terbukti dari listing
  targetAudience: {
    demographic: string;
    coreFrustration: string;
    desiredOutcome: string;
  };
  pricing: {
    currency: string;
    currentPrice: number;
    originalPrice?: number;
    discountPercent?: number;
  };
  visualAnchor: ProductVisualAnchor;
}

// ==========================================
// 3. VIDEO STYLE AGENT (STYLE WIREFRAME ONLY)
// ==========================================
export interface StructuralBeat {
  beatIndex: number;
  timeRangeSec: [number, number]; // e.g. [0.0, 2.5]
  beatRole: 'hook_disruption' | 'problem_amplification' | 'solution_demo' | 'social_proof' | 'cta_conversion';
  cameraShotType: 'macro_extreme_closeup' | 'pov_first_person' | 'dutch_angle' | 'orbit_cutaway';
  cameraMovement: string;         // e.g. "Rapid push-in with snap zoom"
  abstractActionPattern: string;  // Aksi fisik steril tanpa nama produk (e.g. "Melempar objek keras ke meja marmer")
  textOverlayFormat: {
    layout: 'upper_third' | 'center_boxed' | 'lower_third';
    typographyVibe: 'bold_high_contrast' | 'editorial_serif' | 'clean_tech';
    animationPacing: 'kinetic_snap' | 'static_punchy';
  };
  audioCadence: 'high_tension_silence' | 'dramatic_impact' | 'rhythmic_voiceover';
}

export interface VideoStyleAgentInput {
  videoUrl?: string;
  videoBuffer?: Buffer;
  fallbackCategory?: string;
}

export interface VideoStyleAgentOutput {
  referenceVideoId: string;
  durationSec: number;
  hookArchetype: 'visual_shock' | 'counter_intuitive' | 'pain_confrontation' | 'asmr_sensory';
  editingLanguage: {
    averageShotLengthSec: number;
    transitions: string[];        // e.g. ["whip_pan", "hard_cut", "zoom_blur"]
    energyRhythm: 'front_loaded' | 'consistently_high' | 'escalating';
  };
  beats: StructuralBeat[];
}

// ==========================================
// 4. ADAPTATION AGENT CONTRACT
// ==========================================
export interface AdaptationAgentInput {
  product: ProductAgentOutput;
  style: VideoStyleAgentOutput;
  visualAnchor: ProductVisualAnchor;
  retryDirective?: string;
}

export interface SceneAdaptationMapping {
  sceneIndex: number;
  timeRangeSec: [number, number];
  beatRole: 'hook_disruption' | 'problem_amplification' | 'solution_demo' | 'social_proof' | 'cta_conversion';
  sourceAbstractAction: string;
  adaptedProductAction: string;
  actionJustification: string;
  cameraParameters: {
    shotType: string;
    movement: string;
    focusPoint: string;
  };
  mandatoryVisualAnchor: string;
  groundedScriptBeat: {
    spokenVoiceOver: string;
    onScreenOverlayText: string;
    referencedProductAttribute: string;
  };
}

export interface AdaptedContentBrief {
  adaptationStrategy: {
    hookFormula: string;
    pacingRule: string;
    primaryProductAngle: string;
  };
  scenes: SceneAdaptationMapping[];
  complianceCertificate: {
    isStrictlyGrounded: boolean;
    purgedReferenceConcepts: string[];
    validatedClaimsUsed: string[];
  };
}

// ==========================================
// 5. AEO (ANSWER ENGINE OPTIMIZATION) AGENT
// ==========================================
export interface AeoAgentInput {
  product: ProductAgentOutput;
  derivedHookIdea: string;
}

export interface AeoAgentOutput {
  targetSearchIntent: 'informational_problem' | 'commercial_comparison' | 'transactional_deal';
  queryEcosystem: {
    tiktokSearchDirect: string[];
    aiSearchLongTail: string[];
    voiceSearchPhrases: string[];
  };
  seoTags: {
    recommendedHashtags: string[];
    contextualCaption: string;
  };
}

// ==========================================
// 6. GENERATOR AGENT
// ==========================================
export interface GeneratorAgentInput {
  brief: AdaptedContentBrief;
  aeo: AeoAgentOutput;
  visualAnchor: ProductVisualAnchor;
}

export interface ProductionScenePrompt {
  sceneIndex: number;
  timeRangeSec: [number, number];
  imagePrompt: string;
  videoPrompt: string;
  voiceOverScript: string;
  onScreenText: string;
  soundFxCues: string;
}

export interface GeneratorAgentOutput {
  title: string;
  aspectRatio: '--ar 9:16';
  estimatedDurationSec: number;
  scenes: ProductionScenePrompt[];
  caption: string;
  hashtags: string[];
}

export type CompleteVideoProductionDraft = GeneratorAgentOutput;

// ==========================================
// 7. VALIDATOR AGENT CONTRACT
// ==========================================
export interface ValidatorAgentInput {
  productionDraft: GeneratorAgentOutput;
  productTruth: ProductAgentOutput;
  sourceStyle: VideoStyleAgentOutput;
}

export interface ValidatorAgentOutput {
  decision: 'PASS' | 'RETRY_REQUIRED' | 'HARD_FAIL';
  confidenceScore: number;
  checklist: {
    zeroHallucinationCheck: {
      passed: boolean;
      unauthorizedClaimsFound: string[];
    };
    visualIdentityCheck: {
      passed: boolean;
      missingAnchorScenes: number[];
    };
    brandLeakCheck: {
      passed: boolean;
      leakedReferenceTerms: string[];
    };
    slopVoiceOverCheck: {
      passed: boolean;
      detectedSlopPhrases: string[];
    };
  };
  retryContext?: {
    targetAgent: 'AdaptationAgent' | 'GeneratorAgent';
    correctivePromptDirectives: string;
  };
}

// ==========================================
// 8. 3-AGENT REPLICA VIDEO VIRAL CONTRACTS
// ==========================================
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

