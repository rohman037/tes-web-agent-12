export interface VideoToPromptInput {
  // Input video (minimal 1)
  videoUrl?: string;
  videoFile?: string;              // base64
  mimeType?: string;
  videoDuration?: number;
  sourceTitle?: string;
  
  // Settings
  segmentDuration: 5 | 8 | 10 | 15 | "full" | number;
  targetAi: "veo" | "sora" | "runway" | "general" | string;
  aspectRatio: "9:16" | "16:9" | "1:1" | string;
  analysisDepth: "standard" | "deep" | string;
  customInstructions?: string;

  // Key & Access context
  model?: string;
  customApiKey?: string;
  clientAccessCode?: string;
  useCache?: boolean;
}

export interface MicroClip {
  timeRange: string;               // "0–2 detik"
  visual: string;
  aksi: string;
  suara: string | null;            // Voice over atau narasi
  subteks: string | null;          // Text overlay
}

export interface Segment {
  segmentIndex: number;
  timeRange: string;               // "0–10 detik"
  stageLabel: "HOOK" | "MASALAH" | "SOLUSI" | "DEMO" | "CTA" | "BENEFIT" | string;
  microClips: MicroClip[];
}

export interface ClipScene {
  start: string;
  end: string;
  visual: string;
  action: string;
  camera: string;
  subject: string;
  subtitle: string;
}

export interface VideoClipOutput {
  clip_number: number;
  start_time: number;
  end_time: number;
  duration_label?: string;
  master_prompt: string;
  scenes: ClipScene[];
}

export interface VideoToPromptOutput {
  // AI CONTENT CLONE ENGINE - Standard Output Schema
  video_analysis?: {
    visual_and_style?: string;
    audio_and_music?: string;
    camera_and_framing?: string;
    lighting_and_mood?: string;
    composition?: string;
    color_palette?: string;
  };
  viral_dna?: {
    hook_type?: string;
    hook_visual?: string;
    hook_text?: string;
    retention_trigger?: string;
    curiosity_gap?: string;
    pacing?: string;
    emotional_curve?: string;
    structure?: {
      hook?: string;
      body?: string;
      climax?: string;
      cta?: string;
    };
  };
  seo?: {
    caption: string;
    hashtags: string[];
    keywords: string[];
  };
  quality_score?: {
    total: number;
    passed: boolean;
    breakdown: {
      product_consistency: number;
      prompt_quality: number;
      caption_match: number;
      hashtag_validation: number;
      scene_timing: number;
      audio_visual_match: number;
    };
    issues: string[];
  };

  // Output Data Structure matching Specification
  caption?: string;
  hashtags?: string[];              // 5 buah
  split_duration?: number | string;
  clips?: VideoClipOutput[];
  metadata?: {
    duration: string | number;
    total_clip: number;
    split_duration: string;
  };

  // Video meta
  videoMeta?: {
    duration: number;
    resolution: string;
    aspectRatio: string;
    fps: number;
    genre: string;
  };
  
  // Overall style
  overallStyle?: {
    mood: string;
    visualStyle: string;
    colorPalette: string[];
    lighting: string;
  };
  
  // Segmentasi
  segments?: Segment[];
  
  // Caption & Hashtag
  caption?: string;
  hashtags?: string[];              // 5 buah
  
  // Master prompt
  masterPrompt?: string;
  negativePrompt?: string;
  
  // Technical summary
  technicalSummary?: {
    totalSegments: number;
    totalMicroClips: number;
    avgMicroClipDuration: number;
    dominantShotType: string;
    cameraMovements: string[];
    aspectRatio: string;
    targetAi: string;
  };
  
  // Markdown output
  markdown: string;
  
  // Validation
  validation: {
    passed: boolean;
    score: number;
    failures: string[];
  };

  // Metadata
  meta: {
    apiCallsUsed: number;
    durationMs: number;
    warnings: string[];
    modelUsed?: string;
    tierUsed?: string;
  };
}
