import { Router } from 'express';
import { aiGenerationRateLimiter } from '@/server/middleware/rateLimit.middleware';
import { generatePhotoPromptController } from './controller';

export const photoPromptRouter = Router();

// API endpoint for Image / Photo Analysis & AI Image Prompt Generation
photoPromptRouter.post('/api/generate-photo-prompt', aiGenerationRateLimiter, generatePhotoPromptController);

