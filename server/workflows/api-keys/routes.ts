import { Router } from 'express';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { requireAdminRole } from '@/server/middleware/role.middleware';
import { adminActionRateLimiter } from '@/server/middleware/rateLimit.middleware';
import {
  getApiKeysController,
  updateApiKeysController,
  getApiKeyLogsController,
  addApiKeyLogController,
  getModelPrioritiesController,
  updateModelPrioritiesController,
  getLlmGatewayMetricsController,
  getLlmGatewayHealthController,
  testGeminiKeyController,
  pollAllApiKeysController,
  getQuotaSummaryController,
} from './controller';

export const apiKeysRouter = Router();

// Quota Summary (Admin/Owner only)
apiKeysRouter.get('/api/admin/quota/summary', requireAuth, requireAdminRole, getQuotaSummaryController);


// API Keys Pool Management (Admin/Owner only)
apiKeysRouter.get(['/api/apikeys', '/api/admin/apikeys'], requireAuth, requireAdminRole, getApiKeysController);
apiKeysRouter.post(['/api/apikeys', '/api/admin/apikeys'], requireAuth, requireAdminRole, adminActionRateLimiter, updateApiKeysController);

// API Keys Logs (Admin/Owner only)
apiKeysRouter.get(['/api/apikeys/logs', '/api/admin/apikeys/logs'], requireAuth, requireAdminRole, getApiKeyLogsController);
apiKeysRouter.post(['/api/apikeys/logs', '/api/admin/apikeys/logs'], requireAuth, requireAdminRole, adminActionRateLimiter, addApiKeyLogController);

// Model Routing & Priorities
apiKeysRouter.get(['/api/model-priorities', '/api/admin/model-priorities'], getModelPrioritiesController);
apiKeysRouter.post(['/api/model-priorities', '/api/admin/model-priorities'], requireAuth, requireAdminRole, adminActionRateLimiter, updateModelPrioritiesController);

// Centralized LLM Gateway Metrics & Health (Admin/Owner only)
apiKeysRouter.get('/api/llm-gateway/metrics', requireAuth, requireAdminRole, getLlmGatewayMetricsController);
apiKeysRouter.get('/api/llm-gateway/health', requireAuth, requireAdminRole, getLlmGatewayHealthController);

// Key Testing & Health Probes (Admin/Owner only)
apiKeysRouter.post('/api/test-gemini-key', requireAuth, requireAdminRole, adminActionRateLimiter, testGeminiKeyController);
apiKeysRouter.post('/api/admin/apikeys/poll-all', requireAuth, requireAdminRole, adminActionRateLimiter, pollAllApiKeysController);

