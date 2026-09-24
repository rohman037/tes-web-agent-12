import { Router } from 'express';
import { aiGenerationRateLimiter } from '@/server/middleware/rateLimit.middleware';
import { generateContentIdeasController } from './controller';

export const contentIdeasRouter = Router();

// API endpoint for 5 TikTok Content Ideas, Captions & Hashtags Generator (2-Stage Grounded Pipeline & Anti-AI-Slop)
contentIdeasRouter.post('/api/generate-content-ideas', aiGenerationRateLimiter, generateContentIdeasController);
contentIdeasRouter.post('/api/content-ideas', aiGenerationRateLimiter, generateContentIdeasController);

