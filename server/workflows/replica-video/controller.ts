import { Request, Response } from 'express';
import {
  extractClientAccessCode,
  getClientInfoByCode,
  activeGenerationsMap,
  broadcastLiveEvent,
  sseClients,
} from '@/server/core/state/serverState';
import { executeReplicaVideoWorkflow } from '@/server/services/replicaVideo';
import { logger } from '@/server/core/utils/logger';

export async function generateReplicaVideoController(req: Request, res: Response) {
  const clientAccessCode = extractClientAccessCode(req);
  const clientInfo = await getClientInfoByCode(clientAccessCode);
  const taskId = req.body.taskId || `replica_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const clientIp = (req.ip || req.socket.remoteAddress || '').replace('::ffff:', '').trim();
  const fingerprint = (req.headers['x-device-fingerprint'] as string) || req.body?.fingerprint || '';
  const userAgent = req.headers['user-agent'] || '';

  const activeTask = {
    id: taskId,
    clientId: clientAccessCode,
    accessCode: clientAccessCode,
    clientName: clientInfo.name,
    clientEmail: clientInfo.email || '',
    tool: 'Replika Video Viral',
    status: 'generating',
    category: req.body.category || 'umum',
    topic: req.body.productNameOrTopic || req.body.sourceTitle || req.body.topic || 'Replika Video Viral',
    modelUsed: '3-Agent Cascade Pipeline',
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

    const {
      tiktokUrl,
      videoBase64,
      videoMimeType,
      sourceTitle,
      productNameOrTopic,
      productUrl,
      referenceImageBase64,
      referenceImageMimeType,
      targetDurationSeconds,
      splitDurationSeconds,
      enableTextOverlay,
      targetAI,
      tone,
      contentType,
      preferredModel,
    } = req.body;

    if (!videoBase64 && !productNameOrTopic && !sourceTitle && !productUrl && !tiktokUrl) {
      activeGenerationsMap.delete(taskId);
      return res.status(400).json({
        error: 'Mohon sediakan data video referensi (TikTok/upload) atau nama produk target.',
      });
    }

    const maxSec = targetDurationSeconds ? Number(targetDurationSeconds) : 60;
    let segSec = 6;
    if (splitDurationSeconds === 'auto') {
      segSec = Math.max(4, Math.ceil(maxSec / 4));
    } else if (splitDurationSeconds) {
      segSec = Math.max(3, Number(splitDurationSeconds) || 6);
    }

    const output = await executeReplicaVideoWorkflow({
      tiktokUrl,
      videoBase64,
      videoMimeType,
      sourceTitle,
      productNameOrTopic,
      productUrl,
      referenceImageBase64,
      referenceImageMimeType,
      targetDurationSeconds: maxSec,
      splitDurationSeconds: segSec,
      enableTextOverlay: enableTextOverlay !== false,
      targetAI: targetAI || 'general',
      tone: tone || 'persuasive',
      contentType: contentType || 'affiliate',
      customApiKey,
      clientAccessCode,
      preferredModel,
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
      result: output.markdownText,
      structured: output.structured,
      modelUsed: output.modelUsed,
      latencyMs: output.latencyMs,
    });
  } catch (error: any) {
    logger.error('Error in replica video controller:', error);
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
    return res.status(statusCode).json({
      error: error.message || 'Terjadi kesalahan saat memproses replika video viral.',
    });
  }
}
