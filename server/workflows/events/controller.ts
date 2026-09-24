import { Request, Response } from 'express';
import {
  sseClients,
  eventQueue,
  pendingPolls,
  pushToEventQueue,
  activeGenerationsMap,
  SSEClientMeta,
} from '@/server/core/state/serverState';
import {
  loadEventsService,
  updateActiveStatusService,
  createNewEventService,
} from './service';
import { logger } from '@/server/core/utils/logger';

export async function streamEventsController(req: Request, res: Response) {
  const token = (req.query.token as string) || 'GUEST-ACCESS';

  // Rate Limiting: Max 3 SSE connections per token/session
  let activeTokenConns = 0;
  sseClients.forEach((c) => {
    if (c.token === token) activeTokenConns++;
  });

  if (activeTokenConns >= 3) {
    for (const client of sseClients) {
      if (client.token === token) {
        try {
          client.res.end();
        } catch (e) {
          logger.warn('[SSE Stream] Gagal menutup response SSE lama', e);
        }
        sseClients.delete(client);
        break;
      }
    }
  }

  // Explicit Anti-Buffering Headers for Proxy / Cloud Run Nginx
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Immediate padding comment to bypass proxy initial response buffer
  res.write(':ok\n\n');

  const clientMeta: SSEClientMeta = { res, token, connectedAt: Date.now() };
  sseClients.add(clientMeta);

  // Check Last-Event-ID for missed events replay
  const lastEventIdHeader = req.headers['last-event-id'] || (req.query.lastEventId as string);
  const lastEventIdNum = lastEventIdHeader ? parseInt(lastEventIdHeader.toString(), 10) : 0;

  if (lastEventIdNum > 0) {
    const missed = eventQueue.filter((item) => item.id > lastEventIdNum);
    missed.forEach((item) => {
      res.write(`:pad\nid: ${item.id}\ndata: ${JSON.stringify(item.data)}\n\n`);
    });
  }

  // Send initial snapshot payload
  const initialEvents = await loadEventsService();
  const activeList = Array.from(activeGenerationsMap.values());
  const initPayload = { type: 'init', events: initialEvents, activeGenerations: activeList };
  const initEventId = pushToEventQueue(initPayload);
  res.write(`id: ${initEventId}\ndata: ${JSON.stringify(initPayload)}\n\n`);

  // Notify startup recovery state
  res.write(`:pad\ndata: ${JSON.stringify({ type: 'server_restarted', ts: Date.now() })}\n\n`);

  req.on('close', () => {
    sseClients.delete(clientMeta);
  });
}

export function pollEventsController(req: Request, res: Response) {
  try {
    const lastEventId = parseInt(req.body?.lastEventId || '0', 10);
    const token = req.body?.token || 'GUEST-ACCESS';

    // Check if there are unread events in queue
    const missed = eventQueue.filter((item) => item.id > lastEventId);
    if (missed.length > 0) {
      const latestId = missed[missed.length - 1].id;
      return res.json({
        success: true,
        events: missed.map((item) => item.data),
        lastEventId: latestId,
      });
    }

    // Otherwise hold request for up to 25 seconds
    const timeout = setTimeout(() => {
      const idx = pendingPolls.findIndex((p) => p.res === res);
      if (idx >= 0) pendingPolls.splice(idx, 1);
      try {
        res.json({ success: true, events: [], lastEventId });
      } catch (e) {
        logger.warn('[SSE Polling] Gagal membalas response poll', e);
      }
    }, 25000);

    pendingPolls.push({ token, lastEventId, res, timeout });

    req.on('close', () => {
      clearTimeout(timeout);
      const idx = pendingPolls.findIndex((p) => p.res === res);
      if (idx >= 0) pendingPolls.splice(idx, 1);
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Long-polling error' });
  }
}

export async function getLiveEventsController(req: Request, res: Response) {
  try {
    const events = await loadEventsService();
    const activeGenerations = Array.from(activeGenerationsMap.values());
    return res.json({
      success: true,
      events,
      activeGenerations,
      activeClientCount: activeGenerations.length,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Gagal mengambil live stream events' });
  }
}

export async function getEventsController(req: Request, res: Response) {
  try {
    const events = await loadEventsService();
    return res.json(events);
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Gagal mengambil data event tracking' });
  }
}

export function updateActiveStatusController(req: Request, res: Response) {
  try {
    const updated = updateActiveStatusService(req.body || {});
    return res.json({ success: true, activeGeneration: updated });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Gagal mengupdate active status' });
  }
}

export async function createEventController(req: Request, res: Response) {
  try {
    const newEvent = await createNewEventService(req.body);
    return res.json({ success: true, event: newEvent });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Gagal menyimpan event tracking' });
  }
}
