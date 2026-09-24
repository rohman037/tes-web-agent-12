import { Router } from 'express';
import { aiGenerationRateLimiter } from '@/server/middleware/rateLimit.middleware';
import { generatePromptController } from './controller';

export const promptSplitterRouter = Router();

// API endpoint for Video to Prompt Generator (5 Shot Splitter)
promptSplitterRouter.post('/api/generate-prompt', aiGenerationRateLimiter, generatePromptController);

