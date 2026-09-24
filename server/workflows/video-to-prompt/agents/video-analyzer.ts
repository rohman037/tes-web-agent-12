import { callGeminiWithFallback } from '@/server/core/llm/geminiGateway';
import { normalizeGeminiModel } from '@/server/core/llm/routing/modelRouter';
import { logger } from '@/server/core/utils/logger';
import { VIDEO_TO_PROMPT_SYSTEM_PROMPT } from '../prompts/video-to-prompt.system';
import { buildVideoToPromptUserPrompt } from '../prompts/video-to-prompt.user';
import { VideoToPromptInput } from '../types';

export interface VideoAnalysisResult {
  markdown: string;
  modelUsed?: string;
  tierUsed?: string;
  latencyMs?: number;
}

export async function runVideoAnalyzerAllInOne(
  input: VideoToPromptInput,
  overridePrompt?: string
): Promise<VideoAnalysisResult> {
  const {
    videoFile,
    mimeType = 'video/mp4',
    sourceTitle,
    videoDuration,
    segmentDuration,
    targetAi = 'general',
    aspectRatio = '9:16',
    analysisDepth = 'standard',
    customInstructions,
    model,
    customApiKey,
    clientAccessCode,
  } = input;

  const userPromptText =
    overridePrompt ||
    buildVideoToPromptUserPrompt({
      videoDuration,
      segmentDuration,
      targetAi,
      aspectRatio,
      analysisDepth,
      sourceTitle,
      customInstructions,
    });

  const userSelectedModel = model ? normalizeGeminiModel(model) : undefined;

  const parts: any[] = [];

  // If base64 video data is provided, attach as inlineData
  if (videoFile && typeof videoFile === 'string' && videoFile.length > 50) {
    const cleanBase64 = videoFile.includes(',') ? videoFile.split(',')[1] : videoFile;
    parts.push({
      inlineData: {
        mimeType: mimeType || 'video/mp4',
        data: cleanBase64,
      },
    });
  }

  // Attach text user prompt
  parts.push({
    text: userPromptText,
  });

  const payload = {
    contents: {
      parts,
    },
    config: {
      systemInstruction: VIDEO_TO_PROMPT_SYSTEM_PROMPT,
      temperature: 0.4,
      maxOutputTokens: 16000,
    },
  };

  logger.info(`[video-to-prompt] Executing Video Analyzer AI Call (hasVideo: ${Boolean(videoFile)})`);

  const result = await callGeminiWithFallback(
    userSelectedModel,
    payload,
    customApiKey,
    clientAccessCode,
    'tier2',
    'Video to Prompt',
    Boolean(userSelectedModel),
    '/api/generate-video-to-prompt',
    false
  );

  return {
    markdown: result.text || '',
    modelUsed: result.modelUsed,
    tierUsed: result.tierUsed,
    latencyMs: result.latencyMs,
  };
}
