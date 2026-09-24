export interface GenerateContentIdeasOptions {
  mimeType?: string;
  base64Data?: string;
  sourceTitle?: string;
  topic?: string;
  tiktokShopUrl?: string;
  contentType?: string;
  tone?: string;
  maxDuration?: string;
  segmentDuration?: string;
  targetAI?: string;
  model?: string;
  aeoQueryMode?: string;
  enableBigSound?: boolean;
  enableTextOverlay?: boolean;
  referenceImageBase64?: string;
  referenceImageMimeType?: string;
  userSeedQueries?: string[];
  numIdeas?: number;
  customApiKey?: string;
  clientAccessCode?: string;
  useCache?: boolean;
}

export interface VideoDNAInput {
  base64Data?: string;
  mimeType?: string;
  sourceTitle?: string;
  topic?: string;
  model?: string;
  customApiKey?: string;
  clientAccessCode?: string;
}

export interface VideoDNAOutput {
  groundingContext: string;
  modelUsed?: string;
}

export interface ProductIntelInput {
  tiktokShopUrl?: string;
  referenceImageBase64?: string;
  referenceImageMimeType?: string;
  model?: string;
  customApiKey?: string;
  clientAccessCode?: string;
}

export interface ProductIntelOutput {
  productContext: string;
  identityAnchorDescription: string;
  fetchedProductName?: string;
}

export interface ContentGeneratorInput {
  totalIdeas: number;
  maxSecNum: number;
  segSecNum: number;
  expectedClipsCount: number;
  timestampTemplateText: string;
  timestampGuideList: string[];
  groundingContext: string;
  productContext: string;
  contentType: string;
  tone: string;
  queryCouncilResult: {
    final_short_query_targets: string[];
    final_long_tail_queries: string[];
  };
  userSeedQueriesClean: string[];
  model?: string;
  customApiKey?: string;
  clientAccessCode?: string;
}

export interface ContentGeneratorOutput {
  text: string;
  modelUsed?: string;
}

export interface CopyRefinerInput {
  groundingContext: string;
  rawText: string;
  allIdeasTemplate: string;
  totalIdeas: number;
  model?: string;
  customApiKey?: string;
  clientAccessCode?: string;
}

export interface ValidationResult {
  isValid: boolean;
  needsRefine: boolean;
  issues: string[];
}
