import { Request, Response } from 'express';
import {
  extractClientAccessCode,
  getClientInfoByCode,
  activeGenerationsMap,
  broadcastLiveEvent,
  sseClients,
} from '@/server/core/state/serverState';
import { generateContentIdeasService } from './service';
import { logger } from '@/server/core/utils/logger';

export async function generateContentIdeasController(req: Request, res: Response) {
  const clientAccessCode = extractClientAccessCode(req);
  const clientInfo = await getClientInfoByCode(clientAccessCode);
  const taskId = req.body.taskId || `gen_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const clientIp = (req.ip || req.socket.remoteAddress || '').replace('::ffff:', '').trim();
  const fingerprint = (req.headers['x-device-fingerprint'] as string) || req.body?.fingerprint || '';
  const userAgent = req.headers['user-agent'] || '';

  const activeTask = {
    id: taskId,
    clientId: clientAccessCode,
    accessCode: clientAccessCode,
    clientName: clientInfo.name,
    clientEmail: clientInfo.email || '',
    tool: 'Idea Konten',
    status: 'generating',
    category: req.body.category || 'umum',
    topic: req.body.topic || req.body.sourceTitle || 'Idea Konten TikTok',
    modelUsed: req.body.model || 'Gemini Auto-Cascade',
    startedAt: new Date().toISOString(),
    updatedAt: Date.now(),
    ip: clientIp,
    deviceFingerprint: fingerprint,
    userAgent: userAgent,
  };
  activeGenerationsMap.set(taskId, activeTask);

  broadcastLiveEvent({
    type: 'active_status_update',
    activeGenerations: Array.from(activeGenerationsMap.values()),
    activeUserCount: sseClients.size,
  });

  try {
    const customApiKey = (req.headers['x-custom-api-key'] as string) || req.body.customApiKey;
    const useCache = req.headers['x-use-cache'] !== 'false';

    const {
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
    } = req.body;

    if (!base64Data && !topic && !sourceTitle && !tiktokShopUrl) {
      activeGenerationsMap.delete(taskId);
      return res.status(400).json({ error: 'Mohon sediakan data video TikTok, judul, topik konten, atau link TikTok Shop.' });
    }

    const output = await generateContentIdeasService({
      mimeType,
      base64Data,
      sourceTitle,
      topic,
      tiktokShopUrl,
      contentType,
      tone,
      maxDuration,
      segmentDuration,
      targetAI,
      model,
      aeoQueryMode,
      enableBigSound,
      enableTextOverlay,
      referenceImageBase64,
      referenceImageMimeType,
      userSeedQueries,
      numIdeas,
      customApiKey,
      clientAccessCode,
      useCache,
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

    return res.json(output);
  } catch (error: any) {
    logger.error('Error generating content ideas:', error);
    activeTask.status = 'failed';
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
    }, 5000);

    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ error: error.message || 'Terjadi kesalahan saat membuat ide konten.' });
  }
}
