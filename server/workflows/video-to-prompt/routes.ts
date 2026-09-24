import { Router } from 'express';
import { aiGenerationRateLimiter } from '@/server/middleware/rateLimit.middleware';
import { generateVideoToPromptController } from './controller';

export const videoToPromptRouter = Router();

// Primary generator endpoint
videoToPromptRouter.post(
  '/api/generate-video-to-prompt',
  aiGenerationRateLimiter,
  generateVideoToPromptController
);

// Alias endpoint for flexibility
videoToPromptRouter.post(
  '/api/video-to-prompt',
  aiGenerationRateLimiter,
  generateVideoToPromptController
);
