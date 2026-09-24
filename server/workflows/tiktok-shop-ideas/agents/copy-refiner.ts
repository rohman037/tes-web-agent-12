import { callGeminiWithFallback } from '@/server/core/llm/geminiGateway';
import { normalizeGeminiModel } from '@/server/core/llm/routing/modelRouter';
import { logger } from '@/server/core/utils/logger';
import { buildCopyRefinerPrompt } from '../prompts/copy-refiner';
import { CopyRefinerInput } from '../types';

export async function refineShopCopy(input: CopyRefinerInput): Promise<string> {
  const { currentGeneratedText, model, customApiKey, clientAccessCode } = input;

  const hashtagCount = (currentGeneratedText.match(/#[a-zA-Z0-9_\u0590-\u05ff\u0600-\u06ff\u0e00-\u0e7f]+/g) || [])
    .length;
  const hasCaptionSection = /Draft\s*Caption/i.test(currentGeneratedText);
  const isCaptionBroken = !hasCaptionSection || hashtagCount < 3;

  if (!isCaptionBroken) {
    return currentGeneratedText;
  }

  logger.info('[copy-refiner] Detected issues with Caption/Hashtags. Running Copy Refiner | tier=tier3');
  try {
    const { prompt, systemInstruction } = buildCopyRefinerPrompt(currentGeneratedText);
    const copyPayload = {
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        systemInstruction,
        temperature: 0.4,
      },
    };

    const userSelectedModel = model ? normalizeGeminiModel(model) : undefined;
    const refinerResult = await callGeminiWithFallback(
      userSelectedModel,
      copyPayload,
      customApiKey,
      clientAccessCode,
      'tier3',
      'TikTok Shop Copy Refiner'
    );

    if (refinerResult?.text && refinerResult.text.includes('BAGIAN 1') && refinerResult.text.includes('BAGIAN 3')) {
      logger.info('[copy-refiner] Copy Refiner successfully updated captions & hashtags.');
      return refinerResult.text;
    }
  } catch (copyErr) {
    logger.warn('[copy-refiner] Copy Refiner failed or timed out, keeping original text:', copyErr);
  }

  return currentGeneratedText;
}

export async function refineCopy(
  currentGeneratedText: string,
  _validation?: any,
  model?: string,
  customApiKey?: string,
  clientAccessCode?: string
): Promise<string> {
  return refineShopCopy({
    currentGeneratedText,
    model,
    customApiKey,
    clientAccessCode,
  });
}
