import crypto from 'crypto';
import { promptResponseCache, PROMPT_CACHE_TTL_MS } from '@/server/core/state/serverState';
import { logger } from '@/server/core/utils/logger';
import { fetchTikTokVideoInfo } from '@/server/core/tiktok-fetcher/service';
import { validateVideoInput, processVideoSegmentation } from '@/server/services/videoProcessor';
import { runVideoAnalyzerAgent, VideoAnalyzerOutput } from '@/server/agents/videoAnalyzerAgent';
import { runPromptGenerationAgent } from '@/server/agents/promptGenerationAgent';
import {
  cleanSubjectTitle,
  cleanInlineHashtagsFromSentence,
  generateProductRelevantHashtags,
} from '@/server/core/utils/sanitizer';
import { VideoToPromptQcEngine } from './qcEngine';
import type { VideoToPromptInput, VideoToPromptOutput, VideoClipOutput, Segment, MicroClip } from './types';

export * from './types';

export async function runVideoToPromptPipeline(
  input: VideoToPromptInput
): Promise<VideoToPromptOutput> {
  const startTime = Date.now();
  let apiCallsUsed = 0;
  const warnings: string[] = [];

  let effectiveInput: VideoToPromptInput = {
    ...input,
    segmentDuration: input.segmentDuration || 10,
    targetAi: input.targetAi || 'general',
    aspectRatio: input.aspectRatio || '9:16',
    analysisDepth: input.analysisDepth || 'standard',
  };

  // STEP 0: If TikTok URL is provided, attempt to resolve video metadata or title
  if (effectiveInput.videoUrl && !effectiveInput.sourceTitle) {
    try {
      const tiktokInfo = await fetchTikTokVideoInfo(effectiveInput.videoUrl);
      if (tiktokInfo && tiktokInfo.title) {
        effectiveInput.sourceTitle = tiktokInfo.title;
        if (!effectiveInput.videoDuration && tiktokInfo.duration) {
          effectiveInput.videoDuration = tiktokInfo.duration;
        }
        logger.info(`[AI CONTENT CLONE ENGINE] Resolved TikTok title: "${tiktokInfo.title.slice(0, 50)}..."`);
      }
    } catch (e: any) {
      warnings.push(`Could not fetch TikTok info automatically: ${e.message}`);
    }
  }

  // If input is text/prompt, extract snippet for title
  if (effectiveInput.mimeType?.startsWith('text/') && effectiveInput.videoFile && !effectiveInput.sourceTitle) {
    try {
      const decoded = Buffer.from(effectiveInput.videoFile, 'base64').toString('utf-8');
      effectiveInput.sourceTitle = decoded.slice(0, 150);
    } catch {
      // ignore
    }
  }

  // STEP 1: VALIDATION
  const validationResult = validateVideoInput({
    base64Data: effectiveInput.videoFile,
    videoUrl: effectiveInput.videoUrl,
    mimeType: effectiveInput.mimeType,
    duration: effectiveInput.videoDuration,
  });

  if (!validationResult.valid && !effectiveInput.sourceTitle) {
    throw new Error(validationResult.error || 'Video tidak valid');
  }

  // STEP 2: VIDEO SEGMENTATION
  const splitChoiceStr = String(effectiveInput.segmentDuration);
  const segmentation = processVideoSegmentation(
    effectiveInput.videoDuration || 30,
    splitChoiceStr
  );

  // Cache lookup key
  const sampleData = effectiveInput.videoFile
    ? effectiveInput.videoFile.slice(0, 300)
    : effectiveInput.videoUrl || effectiveInput.sourceTitle || 'generic_video';

  const cacheKey = crypto
    .createHash('sha256')
    .update(
      `ai_content_clone_${sampleData}_${splitChoiceStr}_${effectiveInput.targetAi}_${effectiveInput.model || 'auto'}`
    )
    .digest('hex');

  if (effectiveInput.useCache !== false && promptResponseCache.has(cacheKey)) {
    const cached = promptResponseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < PROMPT_CACHE_TTL_MS) {
      logger.info('[AI CONTENT CLONE ENGINE] Serving result from high-speed cache');
      return cached.data;
    }
  }

  // STEP 3: RUN AGENT PIPELINE FOR EACH SEGMENT
  // AGENT 1 (VIRAL & VIDEO DNA ANALYST) -> AGENT 3 (PROMPT & SCENE GENERATOR)
  let clipsOutput: VideoClipOutput[] = [];
  const segmentsForUi: Segment[] = [];
  const analysisList: VideoAnalyzerOutput[] = [];
  let modelUsedInPipeline = effectiveInput.model || 'gemini-3.8-flash';

  const segmentProcessingPromises = segmentation.segments.map(async (seg) => {
    // 1. Run Agent 1: Video & Viral DNA Analyzer Agent
    const analysis: VideoAnalyzerOutput = await runVideoAnalyzerAgent({
      base64Data: effectiveInput.videoFile,
      mimeType: effectiveInput.mimeType || 'video/mp4',
      videoUrl: effectiveInput.videoUrl,
      clipNumber: seg.clip_number,
      startTime: seg.start_time,
      endTime: seg.end_time,
      durationLabel: seg.duration_label,
      sourceCaption: effectiveInput.sourceTitle,
      customApiKey: effectiveInput.customApiKey,
      clientAccessCode: effectiveInput.clientAccessCode,
      preferredModel: effectiveInput.model,
      overallContext: effectiveInput.customInstructions,
    });

    // 2. Run Agent 3: Prompt & Scene Generation Agent
    const promptGen = await runPromptGenerationAgent({
      analysis,
      clipNumber: seg.clip_number,
      startTime: seg.start_time,
      endTime: seg.end_time,
      durationLabel: seg.duration_label,
      targetAi: effectiveInput.targetAi,
      customApiKey: effectiveInput.customApiKey,
      clientAccessCode: effectiveInput.clientAccessCode,
      preferredModel: effectiveInput.model,
    });

    return {
      seg,
      analysis,
      promptGen,
    };
  });

  const processedResults = await Promise.all(segmentProcessingPromises);
  apiCallsUsed += processedResults.length * 2;

  // Assemble initial clips and collect analyses
  for (const item of processedResults) {
    const { seg, analysis, promptGen } = item;
    analysisList.push(analysis);

    const clipObj: VideoClipOutput = {
      clip_number: seg.clip_number,
      start_time: seg.start_time,
      end_time: seg.end_time,
      duration_label: seg.duration_label,
      master_prompt: promptGen.master_prompt,
      scenes: promptGen.scenes.map((s) => ({
        start: s.start,
        end: s.end,
        visual: s.visual,
        action: s.action,
        camera: s.camera,
        subject: s.subject,
        subtitle: s.subtitle,
      })),
    };
    clipsOutput.push(clipObj);
  }

  // STEP 4: SYNTHESIZE VIDEO DNA, VIRAL DNA & SEO
  const firstAnalysis = analysisList[0] || {} as VideoAnalyzerOutput;
  const rawSubject = effectiveInput.sourceTitle || firstAnalysis.subject || 'Produk Unggulan';
  const cleanProductName = cleanSubjectTitle(rawSubject);

  // Generate 5 High-relevance Hashtags (0% generic spam)
  let hashtagsList = generateProductRelevantHashtags(
    cleanProductName,
    firstAnalysis.environment || firstAnalysis.scene,
    firstAnalysis.action
  );

  // Natural high-converting SEO Caption with Hook, Value Proposition & CTA (without awkward inline hashtags in sentences)
  const visualDetail = firstAnalysis.action || firstAnalysis.subject || 'desain dan fungsi unggulannya';
  let captionText = cleanInlineHashtagsFromSentence(
    `Pernah kepikiran kalau ${cleanProductName} bisa sebagus dan sefungsional ini? 🔥 Visual sinematik detail memperlihatkan keunggulan nyata pada ${visualDetail} tanpa rekayasa. Pas banget buat kamu yang cari kualitas terbaik dan kepuasan maksimal. Cek selengkapnya sekarang sebelum kehabisan!`
  );

  // STEP 5: QUALITY CONTROL INTELLIGENCE SYSTEM
  // Evaluates 6 checks: Product Consistency, Prompt Quality, Caption Match, Hashtag Validation, Scene Timing, Audio-Visual Match
  const splitDurationNum = typeof effectiveInput.segmentDuration === 'number'
    ? effectiveInput.segmentDuration
    : (parseInt(String(effectiveInput.segmentDuration), 10) || 10);

  const qcEvaluation = VideoToPromptQcEngine.evaluate({
    productOrSubject: cleanProductName,
    clips: clipsOutput,
    caption: captionText,
    hashtags: hashtagsList,
    analysisList,
    splitDuration: splitDurationNum,
  });

  // Apply auto-corrections from QC
  captionText = qcEvaluation.correctedCaption;
  hashtagsList = qcEvaluation.correctedHashtags;
  clipsOutput = qcEvaluation.correctedClips;

  // Build legacy / UI segments
  for (let idx = 0; idx < clipsOutput.length; idx++) {
    const c = clipsOutput[idx];
    const segInfo = segmentation.segments[idx];
    const microClips: MicroClip[] = c.scenes.map((s) => ({
      timeRange: `${s.start}–${s.end}`,
      visual: s.visual,
      aksi: `${s.action} | Camera: ${s.camera}`,
      suara: s.subtitle || null,
      subteks: s.subject ? `Subjek: ${s.subject}` : null,
    }));

    segmentsForUi.push({
      segmentIndex: c.clip_number,
      timeRange: segInfo?.duration_label || `${c.start_time}-${c.end_time}s`,
      stageLabel: c.clip_number === 1 ? 'HOOK' : c.clip_number === clipsOutput.length ? 'CTA' : 'DEMO',
      microClips,
    });
  }

  // Full Video Master Prompt
  const fullMasterPrompt = clipsOutput.map((c) => `[Clip ${c.clip_number}: ${c.start_time}-${c.end_time}s]\n${c.master_prompt}`).join('\n\n');
  const negativePromptText = 'blurry, oversaturated, low quality, artifacts, watermark, logo, text overlay, distorted face, extra limbs, bad anatomy, jittery motion, flickering';

  // Video Analysis & Viral DNA structured object
  const videoAnalysisObj = {
    visual_and_style: firstAnalysis.style || `${firstAnalysis.scene}, ${firstAnalysis.lighting}`,
    audio_and_music: firstAnalysis.dna?.audio_dna?.music_vibe || firstAnalysis.dna?.audio_dna?.voice_over || 'Cinematic immersive audio with dynamic rhythm',
    camera_and_framing: `${firstAnalysis.camera?.shot || 'Medium Shot'}, ${firstAnalysis.camera?.movement || 'Tracking'} on ${firstAnalysis.lens || '35mm lens'}`,
    lighting_and_mood: firstAnalysis.lighting || 'Soft studio key light with cinematic rim fill',
    composition: firstAnalysis.dna?.visual_dna?.composition || 'Balanced framing with intentional depth of field',
    color_palette: firstAnalysis.color || 'Cinematic natural grading',
  };

  const viralDnaObj = {
    hook_type: firstAnalysis.dna?.viral_dna?.hook_type || 'Visual Problem & Curiosity Hook',
    hook_visual: firstAnalysis.dna?.viral_dna?.hook_visual || firstAnalysis.action || 'High-contrast opening motion',
    hook_text: firstAnalysis.dna?.viral_dna?.hook_text || productOrSubject,
    retention_trigger: firstAnalysis.dna?.viral_dna?.retention_trigger || 'Pacing cepat per 1-2 detik',
    curiosity_gap: firstAnalysis.dna?.viral_dna?.curiosity_gap || 'Antisipasi hasil demonstrasi produk',
    pacing: firstAnalysis.dna?.retention_tactics?.pacing || 'Dinamis berirama cepat',
    emotional_curve: `${firstAnalysis.dna?.emotional_dna?.opening_emotion || 'Penasaran'} -> ${firstAnalysis.dna?.emotional_dna?.climax_emotion || 'Puas'} -> ${firstAnalysis.dna?.emotional_dna?.ending_emotion || 'Tertarik'}`,
    structure: {
      hook: firstAnalysis.dna?.content_structure?.hook || 'Detik 0-3: Visual memukau pemikat perhatian',
      body: firstAnalysis.dna?.content_structure?.body || 'Detik 3+: Demonstrasi keunggulan produk',
      climax: firstAnalysis.dna?.content_structure?.climax || 'Titik kepuasan visual maksimal',
      cta: firstAnalysis.dna?.content_structure?.cta || 'Call to action alami penutup video',
    },
  };

  // STEP 6: BUILD MARKDOWN REPRESENTATION (Strictly backward compatible with SplitPromptViewer)
  const markdownLines: string[] = [
    `# 🎬 HASIL AI CONTENT CLONE ENGINE`,
    ``,
    `## 🎬 ANALISIS VIDEO`,
    `- **Visual & Gaya:** ${videoAnalysisObj.visual_and_style}`,
    `- **Audio & Musik:** ${videoAnalysisObj.audio_and_music}`,
    `- **Kamera & Lensa:** ${videoAnalysisObj.camera_and_framing}`,
    `- **Lighting & Mood:** ${videoAnalysisObj.lighting_and_mood}`,
    ``,
    `## 🧬 VIRAL DNA & RETENTION ENGINE`,
    `- **Tipe Hook:** ${viralDnaObj.hook_type}`,
    `- **Visual Hook:** ${viralDnaObj.hook_visual}`,
    `- **Retention Trigger:** ${viralDnaObj.retention_trigger}`,
    `- **Pacing & Irama:** ${viralDnaObj.pacing}`,
    `- **Emotional Curve:** ${viralDnaObj.emotional_curve}`,
    ``,
    `## 📋 CAPTION`,
    captionText,
    ``,
    `## #️⃣ HASHTAG`,
    hashtagsList.join(' '),
    ``,
    `## 📊 METADATA VIDEO`,
    `- Total Durasi: ${segmentation.metadata.duration}`,
    `- Jumlah Klip: ${segmentation.metadata.total_clip} Klip`,
    `- Pilihan Pecah: ${segmentation.metadata.split_duration}`,
    `- Quality Score: ${qcEvaluation.qcResult.total_score}/100 (Pass: ${qcEvaluation.qcResult.passed ? 'YES' : 'NO'})`,
    ``,
    `## 📹 SEGMEN & BREAKDOWN DETAIL`,
  ];

  for (const c of clipsOutput) {
    markdownLines.push(`### 📹 SEGMEN ${c.clip_number} [${c.start_time}-${c.end_time} detik]`);
    markdownLines.push(`**Stage: Sinematik**`);
    markdownLines.push(``);
    markdownLines.push(`**Master Prompt AI Klip ${c.clip_number}:**`);
    markdownLines.push('```text');
    markdownLines.push(c.master_prompt);
    markdownLines.push('```');
    markdownLines.push(``);
    markdownLines.push(`**Breakdown Detail:**`);
    for (let i = 0; i < c.scenes.length; i++) {
      const sc = c.scenes[i];
      markdownLines.push(`- **Scene ${i + 1} (${sc.start} - ${sc.end}):**`);
      markdownLines.push(`  - **Visual:** ${sc.visual}`);
      markdownLines.push(`  - **Action:** ${sc.action}`);
      markdownLines.push(`  - **Camera:** ${sc.camera}`);
      markdownLines.push(`  - **Subjek:** ${sc.subject}`);
      if (sc.subtitle) markdownLines.push(`  - **Suara/Audio:** "${sc.subtitle}"`);
    }
    markdownLines.push(``);
  }

  markdownLines.push(`## 🌟 MASTER PROMPT (FULL VIDEO)`);
  markdownLines.push('```text');
  markdownLines.push(fullMasterPrompt);
  markdownLines.push('```');
  markdownLines.push(``);
  markdownLines.push(`## 🚫 NEGATIVE PROMPT`);
  markdownLines.push('```text');
  markdownLines.push(negativePromptText);
  markdownLines.push('```');

  // Embed structured data comment for frontend high-speed extraction
  const structuredDataComment = `\n\n<!-- STRUCTURED_DATA:\n${JSON.stringify({
    caption: captionText,
    hashtags: hashtagsList,
    split_duration: splitDurationNum,
    metadata: segmentation.metadata,
    videoAnalysis: {
      visualAndStyle: videoAnalysisObj.visual_and_style,
      audioAndMusic: videoAnalysisObj.audio_and_music,
      cameraAndFraming: videoAnalysisObj.camera_and_framing,
      lightingAndMood: videoAnalysisObj.lighting_and_mood,
    },
    video_analysis: videoAnalysisObj,
    viral_dna: viralDnaObj,
    seo: {
      caption: captionText,
      hashtags: hashtagsList,
      keywords: [primaryKeyword, categoryKeyword],
    },
    quality_score: qcEvaluation.qcResult,
    clips: clipsOutput,
    segments: segmentsForUi,
    masterPrompt: fullMasterPrompt,
    negativePrompt: negativePromptText,
  })}\n-->`;

  const finalMarkdown = markdownLines.join('\n') + structuredDataComment;
  const durationMs = Date.now() - startTime;

  const output: VideoToPromptOutput = {
    // New AI Content Clone Engine Schema
    video_analysis: videoAnalysisObj,
    viral_dna: viralDnaObj,
    seo: {
      caption: captionText,
      hashtags: hashtagsList,
      keywords: [primaryKeyword, categoryKeyword],
    },
    quality_score: {
      total: qcEvaluation.qcResult.total_score,
      passed: qcEvaluation.qcResult.passed,
      breakdown: qcEvaluation.qcResult.breakdown,
      issues: qcEvaluation.qcResult.issues,
    },

    // Standard & UI Fields
    caption: captionText,
    hashtags: hashtagsList,
    split_duration: splitDurationNum,
    metadata: segmentation.metadata,
    clips: clipsOutput,
    segments: segmentsForUi,
    masterPrompt: fullMasterPrompt,
    negativePrompt: negativePromptText,
    markdown: finalMarkdown,
    validation: {
      passed: qcEvaluation.qcResult.passed,
      score: qcEvaluation.qcResult.total_score,
      failures: qcEvaluation.qcResult.issues,
    },
    meta: {
      apiCallsUsed,
      durationMs,
      warnings,
      modelUsed: modelUsedInPipeline,
      tierUsed: 'flagship',
    },
  };

  if (effectiveInput.useCache !== false) {
    promptResponseCache.set(cacheKey, {
      timestamp: Date.now(),
      data: output,
    });
  }

  return output;
}

