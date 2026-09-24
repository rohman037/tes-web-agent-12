import { Request, Response } from 'express';
import { runVideoToPromptPipeline } from './service';
import { logger } from '@/server/core/utils/logger';

export async function generateVideoToPromptController(req: Request, res: Response) {
  try {
    const {
      videoUrl,
      videoFile,
      mimeType,
      sourceTitle,
      videoDuration,
      segmentDuration,
      targetAi,
      aspectRatio,
      analysisDepth,
      customInstructions,
      model,
      customApiKey,
      clientAccessCode,
      useCache,
    } = req.body;

    // Header fallbacks for API Key & Access Code
    const effectiveApiKey =
      customApiKey ||
      (req.headers['x-custom-api-key'] as string) ||
      (req.headers['x-api-key'] as string);

    const effectiveAccessCode =
      clientAccessCode ||
      (req.headers['x-client-access-code'] as string) ||
      (req.headers['x-access-code'] as string);

    // Validation
    if (!videoUrl && !videoFile && !sourceTitle) {
      return res.status(400).json({
        success: false,
        error: 'Minimal 1 input harus disediakan: videoUrl, videoFile (base64), atau sourceTitle / topik video.',
      });
    }

    const result = await runVideoToPromptPipeline({
      videoUrl,
      videoFile,
      mimeType,
      sourceTitle,
      videoDuration: videoDuration ? Number(videoDuration) : undefined,
      segmentDuration: segmentDuration !== undefined ? segmentDuration : 10,
      targetAi: targetAi || 'general',
      aspectRatio: aspectRatio || '9:16',
      analysisDepth: analysisDepth || 'standard',
      customInstructions,
      model,
      customApiKey: effectiveApiKey,
      clientAccessCode: effectiveAccessCode,
      useCache,
    });

    return res.json({
      success: true,
      data: result,
      markdown: result.markdown,
      validation: result.validation,
      apiCallsUsed: result.meta.apiCallsUsed,
    });
  } catch (error: any) {
    logger.error('Error in video-to-prompt controller:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Terjadi kesalahan saat mengekstrak prompt dari video.',
    });
  }
}
