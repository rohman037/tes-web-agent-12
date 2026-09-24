import { Request, Response } from 'express';
import {
  extractClientAccessCode,
  getClientInfoByCode,
  activeGenerationsMap,
  broadcastLiveEvent,
  sseClients,
} from '@/server/core/state/serverState';
import { generateVideoPromptService } from './service';
import { logger } from '@/server/core/utils/logger';

export async function generatePromptController(req: Request, res: Response) {
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
    tool: 'Video to Prompt',
    status: 'generating',
    category: req.body.category || 'umum',
    topic: req.body.topic || `Target: ${req.body.targetAI || 'General'}`,
    modelUsed: req.body.model || 'gemini-3.8-flash',
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
    const isForced = req.headers['x-force'] === 'true' || req.query.force === 'true' || req.body?.force === true;
    const useCache = req.headers['x-use-cache'] !== 'false' && !isForced;

    const {
      mimeType,
      base64Data,
      model,
      analysisMode = 'deep',
      targetAI = 'general',
      segmentDuration = '5',
      cinematicStyle = 'cinematic',
      includeActions = true,
      includeVoiceOver = true,
      includeCinematics = true,
      sourceCaption = '',
      sourceUrl = '',
      actualDuration,
    } = req.body;

    if (!base64Data || !mimeType) {
      activeGenerationsMap.delete(taskId);
      return res.status(400).json({ error: 'Data video dan tipe MIME diperlukan' });
    }

    const output = await generateVideoPromptService({
      mimeType,
      base64Data,
      model,
      analysisMode,
      targetAI,
      segmentDuration,
      cinematicStyle,
      includeActions,
      includeVoiceOver,
      includeCinematics,
      sourceCaption,
      sourceUrl,
      actualDuration: typeof actualDuration === 'number' ? actualDuration : undefined,
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
    logger.error('Error generating video prompt:', error);
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
    return res.status(statusCode).json({ error: error.message || 'Terjadi kesalahan saat menganalisis video dengan AI.' });
  }
}
