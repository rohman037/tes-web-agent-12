import { Router } from 'express';
import { requireAuth, requireAdminRole } from '@/server/middleware/auth.middleware';
import {
  getSystemMemoryController,
  getGrowthStateController,
  evaluateGrowthController,
  rollbackGrowthController,
  toggleAutoModeController,
  getAiAgentsController,
  updateAiAgentsController,
  toggleAgentStatusController,
  getLearningQueueController,
} from './controller';

export const growthRouter = Router();

// System Memory API
growthRouter.get('/api/admin/system-memory', requireAuth, requireAdminRole, getSystemMemoryController);

// Growth Scaling APIs
growthRouter.get('/api/growth/state', getGrowthStateController);
growthRouter.post('/api/growth/evaluate', evaluateGrowthController);
growthRouter.post('/api/growth/rollback', rollbackGrowthController);
growthRouter.post('/api/growth/toggle-auto-mode', toggleAutoModeController);

// AI Agents APIs
growthRouter.get(['/api/agents', '/api/admin/agents'], getAiAgentsController);
growthRouter.post(['/api/agents', '/api/admin/agents'], requireAuth, requireAdminRole, updateAiAgentsController);
growthRouter.post('/api/agents/:id/toggle', toggleAgentStatusController);

// Learning Queue API
growthRouter.get('/api/learning/queue', getLearningQueueController);
