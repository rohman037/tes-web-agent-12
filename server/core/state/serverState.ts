import { Request } from 'express';
import { logger } from '@/server/core/utils/logger';
import { dbGetClients } from '@/src/db/dbService';

export interface SSEClientMeta {
  res: any;
  token: string;
  connectedAt: number;
}

export interface PendingPoll {
  token: string;
  lastEventId: number;
  res: any;
  timeout: any;
}

export interface QueuedEvent {
  id: number;
  data: any;
  timestamp: number;
}

export const activeGenerationsMap = new Map<string, any>();
export const sseClients = new Set<SSEClientMeta>();
export const pendingPolls: PendingPoll[] = [];
export const eventQueue: QueuedEvent[] = [];
let globalEventCounter = Date.now();

export const promptResponseCache = new Map<string, {
  timestamp: number;
  text: string;
  modelUsed: string;
  promptArchitect?: any;
  structured?: any;
}>();

export const PROMPT_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 Hours

export function pushToEventQueue(data: any): number {
  const eventId = ++globalEventCounter;
  eventQueue.push({ id: eventId, data, timestamp: Date.now() });
  // Trim old events beyond 300 to prevent memory leak
  if (eventQueue.length > 300) {
    eventQueue.shift();
  }
  return eventId;
}

export function broadcastLiveEvent(data: any) {
  const eventId = pushToEventQueue(data);
  const payload = `:pad\nid: ${eventId}\ndata: ${JSON.stringify(data)}\n\n`;

  // 1. Broadcast to SSE clients
  sseClients.forEach((client) => {
    try {
      client.res.write(payload);
    } catch (e) {
      setTimeout(() => {
        try {
          client.res.write(payload);
        } catch (retryErr) {
          logger.warn('[SSE] Client write failed after retry, dropping client.');
          sseClients.delete(client);
        }
      }, 50);
    }
  });

  // 2. Resolve Long-Polling clients waiting for new events
  for (let i = pendingPolls.length - 1; i >= 0; i--) {
    const poll = pendingPolls[i];
    if (poll.lastEventId < eventId) {
      clearTimeout(poll.timeout);
      try {
        poll.res.json({
          status: 'ok',
          eventId,
          events: [{ id: eventId, data }],
        });
      } catch (err) {}
      pendingPolls.splice(i, 1);
    }
  }
}

export function extractClientAccessCode(req: Request): string {
  const code =
    (req.headers['x-access-code'] as string) ||
    (req.headers['x-client-id'] as string) ||
    (req.headers['x-client-access-code'] as string) ||
    (req.body && req.body.accessCode) ||
    (req.body && req.body.clientId) ||
    'GUEST';
  return code.trim();
}

export async function getClientInfoByCode(accessCode?: string): Promise<{ name: string; accessCode: string; email?: string }> {
  if (!accessCode) return { name: 'Klien Satset', accessCode: 'GUEST' };
  const cleanCode = accessCode.trim().toUpperCase();
  try {
    const list = await dbGetClients();
    const found = list.find((c: any) => c.accessCode && c.accessCode.toUpperCase() === cleanCode);
    if (found) {
      return { name: found.name || 'Klien Satset', accessCode: found.accessCode, email: found.email };
    }
  } catch (e) {
    logger.warn('[Client Auth] Gagal membaca clients dari database', e);
  }
  return { name: cleanCode === 'GUEST' ? 'Pengguna Tamu' : `Klien ${cleanCode}`, accessCode: cleanCode };
}

let executionUpgradeHandler: ((type: 'videoPrompt' | 'contentIdeas' | 'photoPrompt', keyInsight?: string) => void) | null = null;

export function registerExecutionUpgradeHandler(handler: (type: 'videoPrompt' | 'contentIdeas' | 'photoPrompt', keyInsight?: string) => void) {
  executionUpgradeHandler = handler;
}

export function recordExecutionAndUpgrade(type: 'videoPrompt' | 'contentIdeas' | 'photoPrompt', keyInsight?: string) {
  if (executionUpgradeHandler) {
    try {
      executionUpgradeHandler(type, keyInsight);
    } catch (e) {
      logger.warn('[recordExecutionAndUpgrade] Error in execution upgrade handler:', e);
    }
  }
}
