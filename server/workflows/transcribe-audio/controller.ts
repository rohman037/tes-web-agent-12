import { Request, Response } from 'express';
import { extractClientAccessCode } from '@/server/core/state/serverState';
import { transcribeAudioService } from './service';
import { logger } from '@/server/core/utils/logger';

export async function transcribeAudioController(req: Request, res: Response) {
  try {
    const { base64Audio, mimeType = 'audio/wav', prompt } = req.body;
    if (!base64Audio) {
      return res.status(400).json({ error: 'Data audio base64 diperlukan.' });
    }

    const clientAccessCode = extractClientAccessCode(req);
    const customApiKey = (req.headers['x-custom-api-key'] as string) || req.body.customApiKey;

    const result = await transcribeAudioService({
      base64Audio,
      mimeType,
      prompt,
      customApiKey,
      clientAccessCode,
    });

    return res.json(result);
  } catch (error: any) {
    logger.error('Transcribe audio error:', error);
    return res.status(500).json({ error: error.message || 'Gagal merubah audio menjadi teks' });
  }
}
