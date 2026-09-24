export interface GenerateTikTokShopIdeasOptions {
  shopUrl?: string;
  productDetails?: string;
  numIdeas?: number;
  totalDuration?: string;
  promptSplitSec?: string;
  aeoTargetMode?: string;
  enableBigSound?: boolean;
  enableTextOverlay?: boolean;
  analysisMode?: string;
  referenceImageBase64?: string;
  referenceImageMimeType?: string;
  model?: string;
  enableGrounding?: boolean;
  customApiKey?: string;
  clientAccessCode?: string;
  onProgress?: (progress: number) => void;
}

export interface KeywordSeed {
  keyword: string;
  intent: 'problem' | 'result' | 'curiosity' | 'price';
}

export interface IdeaHookAssignment {
  idea_number: number;
  hook_type: 'Result-first' | 'Suspense-thinking' | 'Conflict-contrast' | 'Pain-point';
  primary_keyword: string;
  intent: string;
}

export interface IdentityAnchorInput {
  referenceImageBase64?: string;
  referenceImageMimeType?: string;
  model?: string;
  customApiKey?: string;
  clientAccessCode?: string;
}

export interface LinkEnricherInput {
  shopUrl?: string;
}

export interface LinkEnricherOutput {
  enrichedInfo: string;
  enrichedProductName: string;
  enrichedPrice: string;
  enrichedDescription: string;
}

export interface KeywordClassifierInput {
  derivedProductName: string;
  productDetails: string;
  enrichedInfo: string;
  totalIdeas: number;
  model?: string;
  customApiKey?: string;
  clientAccessCode?: string;
}

export interface KeywordClassifierOutput {
  classifiedKeywords: KeywordSeed[];
  ideasHookAssignments: IdeaHookAssignment[];
}

export interface ContentGeneratorInput {
  totalIdeas: number;
  maxSecNum: number;
  segSecNum: number;
  expectedClipsCount: number;
  identityAnchorDescription: string;
  enrichedInfo: string;
  productDetails: string;
  classifiedKeywords: KeywordSeed[];
  ideasHookAssignments: IdeaHookAssignment[];
  referenceImageBase64?: string;
  referenceImageMimeType?: string;
  model?: string;
  customApiKey?: string;
  clientAccessCode?: string;
}

export interface ContentGeneratorOutput {
  text: string;
  modelUsed?: string;
  isFormatFlawed: boolean;
}

export interface CopyRefinerInput {
  currentGeneratedText: string;
  model?: string;
  customApiKey?: string;
  clientAccessCode?: string;
}
