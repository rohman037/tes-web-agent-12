import { sanitizeCaptionsAndHashtags } from '@/server/workflows/shared/sanitizer';
import { recordExecutionAndUpgrade } from '@/server/core/state/serverState';
import { logger } from '@/server/core/utils/logger';
import { GenerateTikTokShopIdeasOptions } from './types';
import { enrichProductLink } from './agents/link-enricher';
import { runProductIntelligenceAgent } from '@/server/agents/productIntelligenceAgent';
import { runContentStrategyAgent } from '@/server/agents/contentStrategyAgent';
import { runVideoPromptSeoAgent } from '@/server/agents/videoPromptSeoAgent';
import { ProductVideoQualityControlService } from '@/server/services/productVideoQualityControl.service';

export * from './types';

/**
 * AI PRODUCT COMMERCIAL GENERATOR Pipeline
 * Runs 3 core agents:
 * 1. Product Intelligence Agent (CALL 1)
 * 2. Content Strategy + Script Agent (CALL 2)
 * 3. Video Prompt + SEO Agent (CALL 3)
 * Followed by Deterministic Quality Control & Refinement.
 */
export async function generateTikTokShopIdeasService(options: GenerateTikTokShopIdeasOptions) {
  const {
    shopUrl = '',
    productDetails = '',
    numIdeas = 1,
    totalDuration = '60',
    promptSplitSec = '10',
    targetAI = 'GENERAL',
    referenceImageBase64 = '',
    referenceImageMimeType = '',
    model,
    enableGrounding,
    customApiKey,
    clientAccessCode,
    onProgress,
  } = options as any;

  const trimmedShopUrl = typeof shopUrl === 'string' ? shopUrl.trim() : '';

  if (!trimmedShopUrl && !referenceImageBase64 && !productDetails) {
    throw new Error('Informasi produk wajib diisi (Link Toko, Detail Teks, atau Foto Produk).');
  }

  const totalDurationSeconds = Math.max(10, parseInt(totalDuration, 10) || 60);

  let splitSeconds = 10;
  if (promptSplitSec === '5' || promptSplitSec === '4') splitSeconds = 5;
  else if (promptSplitSec === '8' || promptSplitSec === '6') splitSeconds = 8;
  else if (promptSplitSec === '10') splitSeconds = 10;
  else if (promptSplitSec === '15') splitSeconds = 15;
  else if (promptSplitSec === 'full') splitSeconds = totalDurationSeconds;
  else splitSeconds = Math.max(5, parseInt(promptSplitSec, 10) || 10);

  logger.info(`[ProductToVideo] Starting AI Product Commercial Generator (${totalDurationSeconds}s, split: ${splitSeconds}s)...`);

  if (onProgress) onProgress(10);

  // Link enrichment (lightweight web fetch if URL provided)
  let enrichedInfo = '';
  let enrichedProductName = '';
  if (trimmedShopUrl) {
    try {
      const linkData = await enrichProductLink({ shopUrl: trimmedShopUrl });
      enrichedInfo = linkData.enrichedInfo || '';
      enrichedProductName = linkData.enrichedProductName || '';
    } catch (e: any) {
      logger.warn(`[ProductToVideo] Link enrichment skipped or failed: ${e.message}`);
    }
  }

  if (onProgress) onProgress(25);

  // =========================================================================
  // CALL 1: PRODUCT INTELLIGENCE AGENT (Agent 1)
  // =========================================================================
  logger.info('[ProductToVideo] Executing Call 1: Product Intelligence Agent...');
  const productIntelligence = await runProductIntelligenceAgent({
    productName: enrichedProductName || productDetails.slice(0, 80) || 'Produk Komersial',
    productDescription: `${productDetails}\n${enrichedInfo}`,
    productUrl: trimmedShopUrl,
    marketplaceData: enrichedInfo,
    referenceImageBase64,
    referenceImageMimeType,
    preferredModel: model,
    enableGrounding: Boolean(enableGrounding),
    customApiKey,
    clientAccessCode,
  });

  if (onProgress) onProgress(50);

  // =========================================================================
  // CALL 2: CONTENT STRATEGY & SCRIPT AGENT (Agent 2)
  // =========================================================================
  logger.info('[ProductToVideo] Executing Call 2: Content Strategy & Script Agent...');
  const contentStrategy = await runContentStrategyAgent({
    productIntelligence,
    totalDurationSeconds,
    preferredModel: model,
    customApiKey,
    clientAccessCode,
  });

  if (onProgress) onProgress(75);

  // =========================================================================
  // CALL 3: VIDEO PROMPT + SEO AGENT (Agent 3)
  // =========================================================================
  logger.info('[ProductToVideo] Executing Call 3: Video Prompt & SEO Agent...');
  const rawVideoPromptSeo = await runVideoPromptSeoAgent({
    productIntelligence,
    contentStrategy,
    totalDurationSeconds,
    splitDurationSeconds: splitSeconds,
    targetAI: targetAI || 'GENERAL',
    referenceImageBase64,
    referenceImageMimeType,
    preferredModel: model,
    customApiKey,
    clientAccessCode,
  });

  if (onProgress) onProgress(90);

  // =========================================================================
  // QUALITY CONTROL & REFINEMENT SERVICE (Deterministic, 0 AI calls)
  // =========================================================================
  logger.info('[ProductToVideo] Running Product Video Quality Control & Refinement...');
  const { score: qualityScore, refinedOutput: videoPromptSeo } =
    ProductVideoQualityControlService.evaluateAndRefine(
      productIntelligence,
      contentStrategy,
      rawVideoPromptSeo,
      Boolean(referenceImageBase64)
    );

  if (onProgress) onProgress(98);

  // =========================================================================
  // COMPOSE FULL FORMATTED MARKDOWN & STRUCTURED PAYLOAD
  // =========================================================================
  const pId = productIntelligence.product_identity;
  const pFb = productIntelligence.features_and_benefits;
  const pAud = productIntelligence.audience_profile;
  const pSeo = productIntelligence.seo_keywords;
  const cHook = contentStrategy.hook;
  const cScript = contentStrategy.script;

  const markdownBlocks: string[] = [];

  markdownBlocks.push(
    `# AI PRODUCT COMMERCIAL GENERATOR: ${pId.name.toUpperCase()}`,
    `**Paket Konten Video Berkonversi Tinggi (High-Converting Commercial Video Package)**\n`,
    `## 1. PRODUCT INTELLIGENCE & BUYER ANALYSIS`,
    `- **Nama Produk**: ${pId.name}`,
    `- **Kategori**: ${pId.category} | **Brand**: ${pId.brand}`,
    `- **Material & Warna**: ${pId.material} (${pId.color})`,
    `- **Bentuk & Ukuran**: ${pId.shape}, ${pId.size}`,
    `- **Selling Angle**: ${productIntelligence.selling_angle}\n`,
    `### Fitur vs Manfaat (Features & Benefits)`,
    `**Fitur Teknis:**`,
    ...pFb.features.map((f) => `- ${f}`),
    `\n**Manfaat Nyata Konsumen:**`,
    ...pFb.benefits.map((b) => `- ${b}`),
    `\n### Buyer Psychology & Target Audiens`,
    `- **Target Profil**: ${pAud.gender} (${pAud.age_range}), Gaya Hidup: ${pAud.lifestyle}`,
    `- **Kebutuhan Utama**: ${pAud.core_needs}`,
    `- **Pain Points**: ${pAud.pain_points.join('; ')}`,
    `- **Buying Motivation**: ${pAud.buying_motivation}\n`,
    `### SEO Keyword Intelligence`,
    `- **Primary Keyword**: ${pSeo.primary}`,
    `- **Secondary Keyword**: ${pSeo.secondary}`,
    `- **Search Intent**: ${pSeo.search_intent}`,
    `- **Problem Keyword**: ${pSeo.problem_keyword}`,
    `- **Audience Keyword**: ${pSeo.audience_keyword}\n`,
    `---\n`,
    `## 2. VIRAL CONTENT STRATEGY & SCRIPT`,
    `- **Formula Konten**: ${contentStrategy.content_formula} (*${contentStrategy.formula_rationale}*)`,
    `- **3-Second Hook ([${cHook.category.toUpperCase()}])**:`,
    `  - **Audio/Voice Hook**: "${cHook.hook_text}"`,
    `  - **Visual Hook**: ${cHook.visual_hook}`,
    `- **Audio Mood**: ${cScript.audio_mood}\n`,
    `### Naskah Suara & Alur Cerita`,
    `**Voice Over Penuh:**`,
    `> ${cScript.full_voice_over}\n`,
    `**Call To Action (CTA):**`,
    `> ${cScript.cta}\n`,
    `---\n`,
    `## 3. MASTER VIDEO PROMPT (AI VIDEO GENERATION)`,
    `\`\`\``,
    videoPromptSeo.master_video_prompt,
    `\`\`\``,
    `**Negative Prompt**: \`${videoPromptSeo.negative_prompt}\`\n`,
    `---\n`,
    `## 4. MICRO SCENE BREAKDOWN (${videoPromptSeo.clips.length} KLIP)`
  );

  // Clips breakdown formatted with standard regex tags
  videoPromptSeo.clips.forEach((clip) => {
    markdownBlocks.push(
      `\n[${clip.duration}] ${clip.stage_label} — HookType: ${cHook.category}`,
      `- Visual: ${clip.visual}`,
      `- Aksi: ${clip.action}`,
      `- Camera: ${clip.camera}`,
      `- Lens: ${clip.lens}`,
      `- Lighting: ${clip.lighting}`,
      `- Audio: ${clip.audio}`,
      `- Subteks: ${clip.text_overlay}`,
      `- Voice Over: ${clip.voice_over}`,
      `- Prompt: ${clip.prompt}`
    );
  });

  markdownBlocks.push(
    `\n---\n`,
    `## 5. CAPTION SEO & HASHTAGS\n`,
    `### Caption`,
    videoPromptSeo.seo.caption,
    `\n### Hashtags`,
    videoPromptSeo.seo.hashtags.join(' ')
  );

  // Structured Data payload embedded
  const structuredDataPayload = {
    product_intelligence: productIntelligence,
    content_strategy: contentStrategy,
    video_prompt_seo: videoPromptSeo,
    quality_score: qualityScore,
  };

  markdownBlocks.push(
    `\n<!-- STRUCTURED_DATA:\n${JSON.stringify(structuredDataPayload, null, 2)}\n-->`
  );

  const rawMarkdown = markdownBlocks.join('\n');
  const cleanResultText = sanitizeCaptionsAndHashtags(rawMarkdown);

  recordExecutionAndUpgrade('contentIdeas');

  if (onProgress) onProgress(100);

  return {
    success: true,
    result: cleanResultText,
    text: cleanResultText,
    modelUsed: model || 'Gemini 3.8/3.7 Flash Pool',
    validationScore: qualityScore.overall_score,
    structuredData: structuredDataPayload,
  };
}

export async function runTikTokShopIdeasPipeline(input: any) {
  return generateTikTokShopIdeasService({
    shopUrl: input?.shopUrl || input?.url || '',
    productDetails: input?.productDetails || '',
    numIdeas: input?.numIdeas || 1,
    totalDuration: input?.totalDuration || '60',
    promptSplitSec: input?.promptSplitSec || '10',
    targetAI: input?.targetAI || 'GENERAL',
    referenceImageBase64: input?.referenceImageBase64 || '',
    referenceImageMimeType: input?.referenceImageMimeType || '',
    model: input?.model,
    customApiKey: input?.customApiKey,
    clientAccessCode: input?.clientAccessCode,
  });
}
