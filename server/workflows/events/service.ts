import {
  dbGetTrackingEvents,
  dbAddTrackingEvent,
  dbGetActiveGenerations,
  dbSaveActiveGenerations,
} from '@/src/db/dbService';
import {
  activeGenerationsMap,
  broadcastLiveEvent,
  recordExecutionAndUpgrade,
} from '@/server/core/state/serverState';
import { logger } from '@/server/core/utils/logger';

export async function loadEventsService() {
  return await dbGetTrackingEvents();
}

export async function saveEventsService(list: any[]) {
  for (const item of list) {
    await dbAddTrackingEvent(item);
  }
}

export async function loadActiveGenerationsService() {
  try {
    const data = await dbGetActiveGenerations();
    if (Array.isArray(data?.list)) {
      for (const item of data.list) {
        activeGenerationsMap.set(item.taskId || item.id, item);
      }
    }
  } catch (e) {
    logger.warn('[ActiveGen Persistence] Error reading active generations:', e);
  }
}

export async function saveActiveGenerationsService() {
  try {
    const list = Array.from(activeGenerationsMap.values());
    await dbSaveActiveGenerations({ list });
  } catch (e) {
    logger.warn('[ActiveGen Persistence] Error saving active generations:', e);
  }
}

export function updateActiveStatusService(data: {
  id: string;
  status?: string;
  details?: string;
  accessCode?: string;
  tool?: string;
  category?: string;
  clientId?: string;
}) {
  const { id, status, details, accessCode, tool, category, clientId } = data;
  if (!id) {
    throw new Error('Event ID required');
  }

  const existing = activeGenerationsMap.get(id) || { id, startedAt: new Date().toISOString() };
  const updated = {
    ...existing,
    status: status || 'generating',
    details: details || existing.details,
    accessCode: accessCode || existing.accessCode || (id.startsWith('pres_') ? id.replace('pres_', '') : ''),
    tool: tool || existing.tool || 'Workspace Tool',
    category: category || existing.category || 'General',
    clientId: clientId || existing.clientId || (id.startsWith('pres_') ? id.replace('pres_', '') : ''),
    updatedAt: Date.now(),
  };

  if (status === 'completed') {
    setTimeout(() => activeGenerationsMap.delete(id), 120000);
  } else {
    activeGenerationsMap.set(id, updated);
  }

  broadcastLiveEvent({
    type: 'active_status_update',
    activeGeneration: updated,
    activeGenerations: Array.from(activeGenerationsMap.values()),
  });

  return updated;
}

export async function createNewEventService(eventData: any) {
  if (!eventData || typeof eventData !== 'object') {
    throw new Error('Payload event tidak valid');
  }

  const events = await loadEventsService();
  const newEvent = {
    ...eventData,
    id: eventData.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: eventData.timestamp || new Date().toISOString(),
  };

  events.unshift(newEvent);
  await saveEventsService(events);

  activeGenerationsMap.set(newEvent.id, {
    ...newEvent,
    status: 'analyzing',
    updatedAt: Date.now(),
  });

  broadcastLiveEvent({
    type: 'generation_event',
    event: newEvent,
    activeGenerations: Array.from(activeGenerationsMap.values()),
  });

  if (newEvent.outcome === 'success' || newEvent.outcome === 'flagged') {
    recordExecutionAndUpgrade('contentIdeas');
  }

  return newEvent;
}
