import crypto from 'crypto';
import { promptResponseCache, PROMPT_CACHE_TTL_MS, recordExecutionAndUpgrade } from '@/server/core/state/serverState';
import { logger } from '@/server/core/utils/logger';
import { callGeminiWithFallback } from '@/server/core/llm/geminiGateway';
import { normalizeGeminiModel } from '@/server/core/llm/routing/modelRouter';
import { runIndonesianQueryCouncil } from './agents/query-council';
import { GenerateContentIdeasOptions } from './types';
import { extractVideoDNA } from './agents/video-dna-extractor';
import { analyzeProductIntelligence } from './agents/product-intelligence';
import { generateContent } from './agents/content-generator';
import { refineCopy } from './agents/copy-refiner';
import { validateContentIdeasOutput } from './validators/output-validator';
import { executeReplicaVideoWorkflow } from '@/server/services/replicaVideo';

export * from './types';

export async function generateContentIdeasService(options: GenerateContentIdeasOptions) {
  let {
    mimeType,
    base64Data,
    sourceTitle = '',
    topic = '',
    tiktokShopUrl = '',
    contentType = 'affiliate',
    tone = 'persuasive',
    maxDuration = '60',
    segmentDuration = '5',
    targetAI = 'general',
    model,
    aeoQueryMode = 'both',
    enableBigSound = true,
    enableTextOverlay = true,
    referenceImageBase64 = '',
    referenceImageMimeType = '',
    userSeedQueries = [],
    numIdeas = 5,
    customApiKey,
    clientAccessCode,
    useCache = true,
  } = options;

  const totalIdeas = Math.min(5, Math.max(1, Number(numIdeas) || 5));

  if (!base64Data && !topic && !sourceTitle && !tiktokShopUrl) {
    throw new Error('Mohon sediakan data video TikTok, judul, topik konten, atau link TikTok Shop.');
  }

  const sampleData = base64Data ? base64Data.slice(0, 300) : topic || sourceTitle || tiktokShopUrl;
  const refImgSample = referenceImageBase64 ? referenceImageBase64.slice(0, 50) : '';

  let userSeedQueriesClean = Array.isArray(userSeedQueries)
    ? userSeedQueries.map(s => String(s).trim().slice(0, 80)).filter(s => s.length > 0).slice(0, 10)
    : [];

  const userSeedSample = userSeedQueriesClean.join('|').slice(0, 50);
  const shopKey = (tiktokShopUrl || '').trim().slice(0, 80);

  const cacheInput = `content_ideas_v3_${mimeType}_${sampleData}_${model || 'auto'}_${contentType}_${tone}_${maxDuration}_${segmentDuration}_${targetAI}_${aeoQueryMode}_${enableBigSound}_${enableTextOverlay}_${refImgSample}_${userSeedSample}_${totalIdeas}_${shopKey}`;
  const cacheKey = crypto.createHash('sha256').update(cacheInput).digest('hex');

  if (useCache) {
    const cached = promptResponseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < PROMPT_CACHE_TTL_MS) {
      logger.info('[Content Ideas Cache Hit - Saved Quota]', cacheKey);
      return {
        result: cached.text,
        structured: cached.structured,
        modelUsed: cached.modelUsed,
        cached: true,
      };
    }
  }

  const maxSecNum = parseInt(maxDuration, 10) || 60;
  let segSecNum = 6;
  if (segmentDuration === '4') segSecNum = 4;
  else if (segmentDuration === '6') segSecNum = 6;
  else if (segmentDuration === '8') segSecNum = 8;
  else if (segmentDuration === '10') segSecNum = 10;
  else if (segmentDuration === '15') segSecNum = 15;
  else if (segmentDuration === 'auto') segSecNum = Math.max(4, Math.ceil(maxSecNum / 4));
  else segSecNum = Math.max(3, parseInt(segmentDuration, 10) || 6);

  // Use 3-Agent Replica Video Workflow for single idea/replica requests
  if (totalIdeas === 1) {
    const replicaResult = await executeReplicaVideoWorkflow({
      tiktokUrl: (tiktokShopUrl && (tiktokShopUrl.includes('tiktok.com') || tiktokShopUrl.includes('vt.tiktok.com'))) ? tiktokShopUrl : undefined,
      videoBase64: base64Data,
      videoMimeType: mimeType,
      sourceTitle,
      productNameOrTopic: topic || sourceTitle,
      productUrl: tiktokShopUrl,
      referenceImageBase64,
      referenceImageMimeType,
      targetDurationSeconds: maxSecNum,
      splitDurationSeconds: segSecNum,
      enableTextOverlay,
      targetAI,
      tone,
      contentType,
      customApiKey,
      clientAccessCode,
      preferredModel: model,
    });

    recordExecutionAndUpgrade('contentIdeas');

    if (useCache) {
      promptResponseCache.set(cacheKey, {
        timestamp: Date.now(),
        text: replicaResult.markdownText,
        modelUsed: replicaResult.modelUsed,
        structured: replicaResult.structured,
      });
    }

    return {
      result: replicaResult.markdownText,
      structured: replicaResult.structured,
      modelUsed: replicaResult.modelUsed,
      latencyMs: replicaResult.latencyMs,
    };
  }

  const expectedClipsCount = Math.ceil(maxSecNum / segSecNum);

  const timestampGuideList: string[] = [];
  let currentSec = 0;
  for (let i = 1; i <= expectedClipsCount; i++) {
    const nextSec = Math.min(maxSecNum, currentSec + segSecNum);
    const startSecStr = currentSec === 0 ? '0' : (currentSec % 1 === 0 ? `${currentSec}` : `${currentSec}`.replace('.', ','));
    const nextSecStr = nextSec % 1 === 0 ? `${nextSec}` : `${nextSec}`.replace('.', ',');
    const timeHeader = `${startSecStr}–${nextSecStr} detik`;
    const thirdLine = (i % 2 === 1) ? 'voice over: [teks voice over natural]' : 'Subteks: [teks overlay atau makna tersirat]';

    timestampGuideList.push(`${timeHeader}
Visual: [deskripsi visual sangat detail]
Aksi: [gerakan yang terjadi]
${thirdLine}`);

    currentSec = nextSec;
  }
  const timestampTemplateText = timestampGuideList.join('\n\n');

  // AGENT CALL 1: Video DNA Extraction
  const videoDNA = await extractVideoDNA({
    base64Data,
    mimeType,
    sourceTitle,
    topic,
    model,
    customApiKey,
    clientAccessCode,
  });
  const groundingContext = videoDNA.groundingContext;

  // AGENT CALL 2: Product Intelligence & Identity Anchor
  const productIntel = await analyzeProductIntelligence({
    tiktokShopUrl,
    referenceImageBase64,
    referenceImageMimeType,
    model,
    customApiKey,
    clientAccessCode,
  });

  if (productIntel.fetchedProductName) {
    if (!topic) topic = productIntel.fetchedProductName;
    if (!sourceTitle) sourceTitle = `Produk TikTok Shop: ${productIntel.fetchedProductName}`;
  }

  // QUERY COUNCIL (AEO Router)
  let queryCouncilResult: any = { final_short_query_targets: [], final_long_tail_queries: [] };
  const hasUserSeedQueries = userSeedQueriesClean && userSeedQueriesClean.length > 0;
  const shouldSkipCouncil = (aeoQueryMode === 'short' && hasUserSeedQueries) || userSeedQueriesClean.length >= 5;

  if (shouldSkipCouncil) {
    queryCouncilResult = {
      final_short_query_targets: userSeedQueriesClean.filter(q => q.split(' ').length <= 4),
      final_long_tail_queries: userSeedQueriesClean.filter(q => q.split(' ').length > 4),
    };
    if (queryCouncilResult.final_short_query_targets.length === 0) queryCouncilResult.final_short_query_targets = userSeedQueriesClean.slice(0, 3);
    if (queryCouncilResult.final_long_tail_queries.length === 0) queryCouncilResult.final_long_tail_queries = userSeedQueriesClean.slice(-3);
  } else {
    try {
      const userSelectedModel = model ? normalizeGeminiModel(model) : undefined;
      queryCouncilResult = await runIndonesianQueryCouncil(
        topic || sourceTitle || '',
        groundingContext,
        userSeedQueriesClean,
        aeoQueryMode as any,
        (m, p, k, c, t) =>
          callGeminiWithFallback(m, p, k, c, t || 'tier2', 'Content Ideas Query Council'),
        userSelectedModel,
        customApiKey,
        clientAccessCode,
        'tier2'
      );
    } catch (err) {
      logger.warn('[Query Council Warning] Query Council Agent failed, falling back:', err);
    }
  }

  // AGENT CALL 3: Content Generator
  const generated = await generateContent({
    totalIdeas,
    maxSecNum,
    segSecNum,
    expectedClipsCount,
    timestampTemplateText,
    timestampGuideList,
    groundingContext,
    productContext: productIntel.productContext,
    contentType,
    tone,
    queryCouncilResult,
    userSeedQueriesClean,
    model,
    customApiKey,
    clientAccessCode,
  });

  let finalOutputText = generated.text;

  // VALIDASI / SELF-CRITIC
  const validation = validateContentIdeasOutput(finalOutputText, totalIdeas);

  // AGENT CALL 4: Copy Refiner (jika validasi membutuhkan penyempurnaan)
  if (validation.needsRefine) {
    const ideaPromptTemplates: string[] = [];
    for (let i = 1; i <= totalIdeas; i++) {
      ideaPromptTemplates.push(`### 💡 IDE ${i}: [Judul Ide Konten ${i}]
- **Tipe & Angle Konten**: ...
- **Rincian Adegan Video & Prompt AI per Segmen**:
${timestampTemplateText}`);
    }
    const allIdeasTemplate = ideaPromptTemplates.join('\n\n---\n\n');

    finalOutputText = await refineCopy({
      groundingContext,
      rawText: finalOutputText,
      allIdeasTemplate,
      totalIdeas,
      model,
      customApiKey,
      clientAccessCode,
    });
  }

  // Record successful execution & train system memory
  recordExecutionAndUpgrade('contentIdeas');

  if (useCache) {
    promptResponseCache.set(cacheKey, { timestamp: Date.now(), text: finalOutputText, modelUsed: generated.modelUsed });
  }

  return {
    result: finalOutputText,
    modelUsed: generated.modelUsed,
    validation,
  };
}
