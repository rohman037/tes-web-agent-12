import { callGeminiWithFallback } from '@/server/core/llm/geminiGateway';
import { normalizeGeminiModel } from '@/server/core/llm/routing/modelRouter';
import { logger } from '@/server/core/utils/logger';
import { VIDEO_DNA_SYSTEM_PROMPT } from '../prompts/video-dna.system';
import { buildVideoDNAUserPrompt } from '../prompts/video-dna.user';
import { VideoDNAInput, VideoDNAOutput } from '../types';

export async function extractVideoDNA(input: VideoDNAInput): Promise<VideoDNAOutput> {
  const { base64Data, mimeType, sourceTitle, topic, model, customApiKey, clientAccessCode } = input;

  if (!base64Data) {
    logger.info('[video-dna-extractor] No video base64, using textual user grounding');
    return {
      groundingContext: `INFORMASI INPUT TEKS USER (Tanpa Video File):
- Judul/Caption Video: ${sourceTitle || '-'}
- Topik / Produk: ${topic || '-'}`,
    };
  }

  logger.info('[video-dna-extractor] Extracting visual DNA from video | tier=tier2');
  const userPrompt = buildVideoDNAUserPrompt(sourceTitle, topic);
  const userSelectedModel = model ? normalizeGeminiModel(model) : undefined;

  const payload = {
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType || 'video/mp4',
            data: base64Data,
          },
        },
        {
          text: userPrompt,
        },
      ],
    },
    config: {
      systemInstruction: VIDEO_DNA_SYSTEM_PROMPT,
    },
  };

  const result = await callGeminiWithFallback(
    userSelectedModel,
    payload,
    customApiKey,
    clientAccessCode,
    'tier2',
    'Content Ideas Stage 1'
  );

  return {
    groundingContext: result.text || '',
    modelUsed: result.modelUsed,
  };
}
