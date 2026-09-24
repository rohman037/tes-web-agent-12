import { Request, Response } from 'express';
import {
  extractClientAccessCode,
  getClientInfoByCode,
  activeGenerationsMap,
  broadcastLiveEvent,
  sseClients,
} from '@/server/core/state/serverState';
import { generateTikTokShopIdeasService, runTikTokShopIdeasPipeline } from './service';
import { logger } from '@/server/core/utils/logger';

export async function generateTikTokShopIdeasController(req: Request, res: Response) {
  try {
    const clientAccessCode = extractClientAccessCode(req);
    const clientInfo = await getClientInfoByCode(clientAccessCode);

    const {
      shopUrl = '',
      productDetails = '',
      numIdeas = 3,
      totalDuration = '60',
      promptSplitSec = '10',
      aeoTargetMode = 'both',
      enableBigSound = true,
      enableTextOverlay = true,
      analysisMode = 'deep',
      referenceImageBase64 = '',
      referenceImageMimeType = '',
      model,
      enableGrounding,
    } = req.body || {};

    const trimmedShopUrl = typeof shopUrl === 'string' ? shopUrl.trim() : '';

    if (!trimmedShopUrl && !referenceImageBase64) {
      return res.status(400).json({
        success: false,
        error: 'Link TikTok Shop wajib diisi (atau unggah foto produk).',
      });
    }

    const taskId = req.body.taskId || `gen_shop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const activeTask: any = {
      id: taskId,
      clientId: clientAccessCode,
      accessCode: clientAccessCode,
      clientName: clientInfo.name,
      tool: 'TikTok Shop Ideas',
      status: 'generating',
      category: req.body.category || 'tiktok_shop',
      startedAt: new Date().toISOString(),
      updatedAt: Date.now(),
      progress: 5,
    };
    activeGenerationsMap.set(taskId, activeTask);

    broadcastLiveEvent({
      type: 'active_status_update',
      activeGenerations: Array.from(activeGenerationsMap.values()),
      activeUserCount: sseClients.size,
    });

    const customApiKey = (req.headers['x-custom-api-key'] as string) || req.body.customApiKey;

    const output = await generateTikTokShopIdeasService({
      shopUrl: trimmedShopUrl,
      productDetails,
      numIdeas,
      totalDuration,
      promptSplitSec,
      aeoTargetMode,
      enableBigSound,
      enableTextOverlay,
      analysisMode,
      referenceImageBase64,
      referenceImageMimeType,
      model,
      enableGrounding,
      customApiKey,
      clientAccessCode,
      onProgress: (progress) => {
        activeTask.progress = progress;
        activeTask.updatedAt = Date.now();
        activeGenerationsMap.set(taskId, activeTask);
        broadcastLiveEvent({
          type: 'active_status_update',
          activeGenerations: Array.from(activeGenerationsMap.values()),
          activeUserCount: sseClients.size,
        });
      },
    });

    activeTask.status = 'completed';
    activeTask.updatedAt = Date.now();
    activeGenerationsMap.set(taskId, activeTask);

    broadcastLiveEvent({
      type: 'active_status_update',
      activeGenerations: Array.from(activeGenerationsMap.values()),
      activeUserCount: sseClients.size,
    });

    setTimeout(() => {
      activeGenerationsMap.delete(taskId);
      broadcastLiveEvent({
        type: 'active_status_update',
        activeGenerations: Array.from(activeGenerationsMap.values()),
        activeUserCount: sseClients.size,
      });
    }, 120000);

    return res.json({
      success: true,
      ...output,
      data: output,
    });
  } catch (err: any) {
    logger.error('TikTok Shop Ideas generation error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: err.message || 'Gagal menganalisis produk TikTok Shop.',
    });
  }
}
