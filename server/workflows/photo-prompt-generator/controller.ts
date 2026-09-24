import { Request, Response } from 'express';
import {
  extractClientAccessCode,
  getClientInfoByCode,
  activeGenerationsMap,
  broadcastLiveEvent,
  sseClients,
} from '@/server/core/state/serverState';
import { generatePhotoPromptService } from './service';
import { logger } from '@/server/core/utils/logger';

export async function generatePhotoPromptController(req: Request, res: Response) {
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
    tool: 'Photo Prompt',
    status: 'generating',
    category: req.body.category || 'umum',
    topic: req.body.photoStyle ? `Style: ${req.body.photoStyle}` : 'Photo Analysis',
    modelUsed: req.body.model && req.body.model !== 'auto' ? req.body.model : 'Auto-Routing (Anti-Limit)',
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
    const rawHeaderKeys = (req.headers['x-custom-api-key'] as string) || '';
    const bodyCustomKey = typeof req.body?.customApiKey === 'string' ? req.body.customApiKey.trim() : '';
    const bodyApiKeys = Array.isArray(req.body?.apiKeys) ? req.body.apiKeys.filter((k: any) => typeof k === 'string' && k.trim()).join(',') : '';
    const customApiKey = [rawHeaderKeys, bodyCustomKey, bodyApiKeys].filter(Boolean).join(',');

    const isForced = req.headers['x-force'] === 'true' || req.query.force === 'true' || req.body?.force === true;
    const useCache = req.headers['x-use-cache'] !== 'false' && !isForced;

    const {
      mimeType,
      base64Data,
      subjectReference,
      productReference,
      model,
      targetGenerator = 'nanobananapro',
      photoStyle = 'commercial',
      aspectRatio = '--ar 16:9',
      negativePrompt,
      referenceImageBase64,
      referenceImageMimeType,
      analysisMode,
      ultraDetail,
      isUltra,
      mode,
    } = req.body;

    if (!base64Data || !mimeType) {
      activeGenerationsMap.delete(taskId);
      return res.status(400).json({ error: 'Data gambar/teks dan tipe MIME diperlukan' });
    }

    const output = await generatePhotoPromptService({
      mimeType,
      base64Data,
      subjectReference: typeof subjectReference === 'string' ? subjectReference.trim() : undefined,
      productReference: typeof productReference === 'string' ? productReference.trim() : undefined,
      model,
      targetGenerator,
      photoStyle,
      aspectRatio,
      negativePrompt,
      referenceImageBase64,
      referenceImageMimeType,
      analysisMode,
      ultraDetail,
      isUltra,
      mode,
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
    logger.error('Error generating photo prompt:', error);
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
    return res.status(statusCode).json({ error: error.message || 'Terjadi kesalahan saat menganalisis gambar/konsep.' });
  }
}
