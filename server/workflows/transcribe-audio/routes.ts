import { Router } from 'express';
import { aiGenerationRateLimiter } from '@/server/middleware/rateLimit.middleware';
import { transcribeAudioController } from './controller';

export const transcribeAudioRouter = Router();

// API endpoint for Audio Transcription using Gemini
transcribeAudioRouter.post('/api/transcribe-audio', aiGenerationRateLimiter, transcribeAudioController);

