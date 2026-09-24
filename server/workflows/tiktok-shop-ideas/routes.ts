import { Router } from 'express';
import { aiGenerationRateLimiter } from '@/server/middleware/rateLimit.middleware';
import { generateTikTokShopIdeasController } from './controller';

export const tiktokShopIdeasRouter = Router();

// Route utama
tiktokShopIdeasRouter.post(
  '/api/generate-tiktok-shop-ideas',
  aiGenerationRateLimiter,
  generateTikTokShopIdeasController
);

// Route alias (backward compat)
tiktokShopIdeasRouter.post(
  '/api/tiktok-shop-ideas',
  aiGenerationRateLimiter,
  generateTikTokShopIdeasController
);
