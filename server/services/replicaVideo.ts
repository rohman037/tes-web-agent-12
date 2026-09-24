import { logger } from '@/server/core/utils/logger';
import {
  ReplicaVideoInput,
  ReplicaVideoResponse,
} from '@/server/types/replicaVideo.types';
import { runViralProductAnalysisAgent } from '@/server/agents/viralProductAnalysisAgent';
import { runAdaptationScriptGenerationAgent } from '@/server/agents/adaptationScriptGenerationAgent';
import { runVideoPromptSeoGenerationAgent } from '@/server/agents/videoPromptSeoGenerationAgent';
import { QualityControlService } from '@/server/services/qualityControl.service';
import { fetchTikTokVideoInfo } from '@/server/core/tiktok-fetcher/service';

export interface GenerateReplicaVideoResult {
  structured: ReplicaVideoResponse;
  markdownText: string;
  modelUsed: string;
  latencyMs: number;
}

/**
 * Format structured response into legacy-compatible markdown representation
 * ensuring backward compatibility with text-based tools and TXT downloads.
 */
export function formatReplicaVideoMarkdown(res: ReplicaVideoResponse): string {
  const { viral_analysis, product_analysis, adapted_concept, seo, clips, request_meta } = res;

  const lines: string[] = [];

  lines.push(`### 💡 IDE 1: ${adapted_concept.concept_title}`);
  lines.push(`- **Tipe & Angle Konten**: ${product_analysis.selling_angle_primary} | ${product_analysis.category}`);
  lines.push(`- **Target Audiens**: ${product_analysis.target_audience}`);
  lines.push(`- **BLUFF Hook (0–3 Detik)**: "${viral_analysis.hook}"`);
  lines.push(`- **Panduan Visual & Audio**: Visual bergaya ${viral_analysis.visual_style}. Kamera ${viral_analysis.camera_style}. Audio ${viral_analysis.audio_style}.`);
  lines.push(`- **Rincian Adegan Video & Prompt AI per Segmen**:`);

  clips.forEach((c) => {
    lines.push(`\n**[Segmen Prompt Klip ${c.clip_number} (${c.duration_label || `${c.start_second}–${c.end_second} detik`})]**`);
    lines.push(`\`\`\`\n${c.master_prompt}\n\`\`\``);

    if (c.scenes && c.scenes.length > 0) {
      c.scenes.forEach((sc) => {
        lines.push(`\n* Scene ${sc.scene_number} (${sc.start_second}–${sc.end_second} detik)`);
        lines.push(`Visual: ${sc.visual}`);
        lines.push(`Aksi: ${sc.action}`);
        if (sc.camera) {
          lines.push(`Kamera: ${sc.camera}`);
        }
        if (sc.audio) {
          lines.push(`Audio: ${sc.audio}`);
        }
        if (sc.text_overlay) {
          lines.push(`Text Overlay: "${sc.text_overlay}"`);
        }
        if (sc.dialogue_or_subtitle) {
          lines.push(`Voice Over: "${sc.dialogue_or_subtitle}"`);
        }
      });
    }
  });

  lines.push(`\n- **Caption Persuasif**:`);
  lines.push(seo.caption);

  lines.push(`\n- **Hashtags Relevan**:`);
  lines.push(seo.hashtags.join(' '));

  if (res.quality_control) {
    const qc = res.quality_control;
    lines.push(`\n- **Quality Control Intelligence**:`);
    lines.push(`Total Score: ${qc.total_score}/100 (${qc.passed ? 'PASSED' : 'FLAGGED'})`);
    lines.push(`Breakdown: Produk ${qc.quality_score.product_relevance}% | Visual ${qc.quality_score.visual_relevance}% | Caption ${qc.quality_score.caption_relevance}% | Hashtag ${qc.quality_score.hashtag_relevance}% | Audio ${qc.quality_score.audio_relevance}% | Timing ${qc.quality_score.scene_accuracy}%`);
    if (qc.refinement_attempted) {
      lines.push(`Refinement Status: Auto-Refined by AI Agent 3 Loop`);
    }
  }

  return lines.join('\n');
}

/**
 * Master Pipeline: Replika Video Viral (3-Agent Reverse-Engineering + Content Adaptation Engine)
 */
export async function executeReplicaVideoWorkflow(
  input: ReplicaVideoInput
): Promise<GenerateReplicaVideoResult> {
  const startTime = Date.now();
  logger.info(`[ReplicaVideoWorkflow] Initiating 3-Agent Workflow...`);

  // 1. Preprocessing & Context Normalization
  let resolvedTitle = input.sourceTitle || '';
  let resolvedProduct = input.productNameOrTopic || '';
  let videoBase64 = input.videoBase64;
  let videoMimeType = input.videoMimeType;

  // If TikTok URL provided and no title/data, fetch metadata
  if (input.tiktokUrl && (!resolvedTitle || !resolvedProduct)) {
    try {
      const tiktokData = await fetchTikTokVideoInfo(input.tiktokUrl);
      if (tiktokData && tiktokData.title) {
        if (!resolvedTitle) resolvedTitle = tiktokData.title;
        if (!resolvedProduct) resolvedProduct = tiktokData.title.slice(0, 60);
      }
    } catch (err) {
      logger.warn('[ReplicaVideoWorkflow] TikTok fetch failed or skipped, proceeding with input fields:', err);
    }
  }

  if (!resolvedProduct) {
    resolvedProduct = resolvedTitle || 'Produk Unggulan';
  }

  const targetDurationSeconds = Math.max(10, Math.min(120, Number(input.targetDurationSeconds) || 60));
  const splitDurationSeconds = Math.max(3, Math.min(30, Number(input.splitDurationSeconds) || 6));
  const totalClips = Math.ceil(targetDurationSeconds / splitDurationSeconds);

  const sourceType = input.videoBase64
    ? 'uploaded_video'
    : input.tiktokUrl
    ? 'tiktok_url'
    : 'topic_or_product';

  // 2. AGENT 1: Viral + Product Analysis (Task: viral_product_analysis)
  logger.info(`[ReplicaVideoWorkflow] Executing CALL 1/3: Agent 1 (Viral + Product Analysis)...`);
  const agent1Result = await runViralProductAnalysisAgent({
    videoBase64,
    videoMimeType,
    sourceTitle: resolvedTitle,
    tiktokUrl: input.tiktokUrl,
    productNameOrTopic: resolvedProduct,
    productUrl: input.productUrl,
    referenceImageBase64: input.referenceImageBase64,
    referenceImageMimeType: input.referenceImageMimeType,
    customApiKey: input.customApiKey,
    clientAccessCode: input.clientAccessCode,
    preferredModel: input.preferredModel,
  });

  // 3. AGENT 2: Adaptation + Script Generation (Task: adaptation_script_generation)
  logger.info(`[ReplicaVideoWorkflow] Executing CALL 2/3: Agent 2 (Adaptation + Script Generation)...`);
  const agent2Result = await runAdaptationScriptGenerationAgent({
    viralAnalysis: agent1Result.viral_analysis,
    productAnalysis: agent1Result.product_analysis,
    targetDurationSeconds,
    splitDurationSeconds,
    enableTextOverlay: input.enableTextOverlay ?? true,
    targetAI: input.targetAI || 'general',
    tone: input.tone,
    contentType: input.contentType,
    customApiKey: input.customApiKey,
    clientAccessCode: input.clientAccessCode,
    preferredModel: input.preferredModel,
  });

  // 4. AGENT 3: Video Prompt + SEO Generation (Task: video_prompt_seo_generation)
  logger.info(`[ReplicaVideoWorkflow] Executing CALL 3/3: Agent 3 (Video Prompt + SEO Generation)...`);
  let agent3Result = await runVideoPromptSeoGenerationAgent({
    viralAnalysis: agent1Result.viral_analysis,
    productAnalysis: agent1Result.product_analysis,
    adaptedConcept: agent2Result.adapted_concept,
    storyboard: agent2Result.storyboard,
    targetAI: input.targetAI || 'general',
    enableTextOverlay: input.enableTextOverlay ?? true,
    customApiKey: input.customApiKey,
    clientAccessCode: input.clientAccessCode,
    preferredModel: input.preferredModel,
  });

  // 5. QUALITY CONTROL INTELLIGENCE SYSTEM LAYER
  logger.info(`[ReplicaVideoWorkflow] Executing Quality Control Intelligence System...`);
  let qcEvaluation = QualityControlService.evaluate({
    viralAnalysis: agent1Result.viral_analysis,
    productAnalysis: agent1Result.product_analysis,
    adaptedConcept: agent2Result.adapted_concept,
    seo: agent3Result.seo,
    clips: agent3Result.clips,
    targetDurationSeconds,
    splitDurationSeconds,
    referenceImageProvided: !!input.productImageBase64,
  });

  let refinementAttempted = false;

  // Refinement Loop: Jika skor < 80 atau ada critical issues, beri kesempatan 1x regenerasi terarah
  if (!qcEvaluation.result.passed && qcEvaluation.criticalIssuesSummary.length > 0) {
    logger.warn(
      `[ReplicaVideoWorkflow] QC score (${qcEvaluation.result.total_score}/100) below threshold or critical issues detected. Triggering Agent 3 refinement...`
    );
    refinementAttempted = true;

    try {
      const refinedAgent3 = await runVideoPromptSeoGenerationAgent({
        viralAnalysis: agent1Result.viral_analysis,
        productAnalysis: agent1Result.product_analysis,
        adaptedConcept: agent2Result.adapted_concept,
        storyboard: agent2Result.storyboard,
        targetAI: input.targetAI || 'general',
        enableTextOverlay: input.enableTextOverlay ?? true,
        customApiKey: input.customApiKey,
        clientAccessCode: input.clientAccessCode,
        preferredModel: input.preferredModel,
        qcRefinementDirectives: qcEvaluation.criticalIssuesSummary.join('\n'),
      });

      // Re-evaluate refined output
      const reEvaluatedQc = QualityControlService.evaluate({
        viralAnalysis: agent1Result.viral_analysis,
        productAnalysis: agent1Result.product_analysis,
        adaptedConcept: agent2Result.adapted_concept,
        seo: refinedAgent3.seo,
        clips: refinedAgent3.clips,
        targetDurationSeconds,
        splitDurationSeconds,
        referenceImageProvided: !!input.productImageBase64,
      });

      agent3Result = refinedAgent3;
      qcEvaluation = reEvaluatedQc;
      logger.info(
        `[ReplicaVideoWorkflow] Refinement complete. New QC Total Score=${qcEvaluation.result.total_score}/100 (Pass=${qcEvaluation.result.passed})`
      );
    } catch (err) {
      logger.error('[ReplicaVideoWorkflow] Refinement iteration failed, falling back to auto-corrected output', err);
    }
  }

  // Set refinement flag in final QC result
  qcEvaluation.result.refinement_attempted = refinementAttempted;

  // Use sanitised & auto-corrected outputs if available
  const finalSeo = qcEvaluation.correctedSeo || agent3Result.seo;
  const finalClips = qcEvaluation.correctedClips || agent3Result.clips;

  const latencyMs = Date.now() - startTime;
  logger.info(
    `[ReplicaVideoWorkflow] Successfully finished Workflow in ${latencyMs}ms across models: A1=${agent1Result.modelUsed}, A2=${agent2Result.modelUsed}, A3=${agent3Result.modelUsed}. Final QC Score: ${qcEvaluation.result.total_score}/100`
  );

  const structuredResponse: ReplicaVideoResponse = {
    request_meta: {
      source_type: sourceType,
      target_duration_seconds: targetDurationSeconds,
      split_duration_seconds: splitDurationSeconds,
      total_clips: totalClips,
      text_overlay_enabled: input.enableTextOverlay ?? true,
      model_used: agent3Result.modelUsed,
      latency_ms: latencyMs,
    },
    viral_analysis: agent1Result.viral_analysis,
    product_analysis: agent1Result.product_analysis,
    adapted_concept: agent2Result.adapted_concept,
    seo: finalSeo,
    clips: finalClips,
    quality_control: qcEvaluation.result,
  };

  const markdownText = formatReplicaVideoMarkdown(structuredResponse);

  return {
    structured: structuredResponse,
    markdownText,
    modelUsed: agent3Result.modelUsed,
    latencyMs,
  };
}
