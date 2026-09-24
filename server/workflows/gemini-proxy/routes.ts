import { Router } from 'express';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { aiGenerationRateLimiter } from '@/server/middleware/rateLimit.middleware';
import { geminiGenerateController } from './controller';

export const geminiProxyRouter = Router();

// Secure Backend Gemini Proxy Endpoint (Guarded by Auth + Token Bucket Rate Limiter)
geminiProxyRouter.post('/api/gemini/generate', requireAuth, aiGenerationRateLimiter, geminiGenerateController);

