import { Router } from 'express';
import {
  streamEventsController,
  pollEventsController,
  getLiveEventsController,
  getEventsController,
  updateActiveStatusController,
  createEventController,
} from './controller';

export const eventsRouter = Router();

// SSE Stream
eventsRouter.get('/api/events/stream', streamEventsController);

// Long-Polling Fallback
eventsRouter.post('/api/events/poll', pollEventsController);

// Live Events Snapshot
eventsRouter.get('/api/events/live', getLiveEventsController);

// Events List & Create
eventsRouter.get('/api/events', getEventsController);
eventsRouter.post('/api/events', createEventController);

// Active Status Update
eventsRouter.post('/api/events/active-status', updateActiveStatusController);
