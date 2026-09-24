import { callGeminiWithFallback } from '@/server/core/llm/geminiGateway';
import { normalizeGeminiModel } from '@/server/core/llm/routing/modelRouter';
import { sanitizeCaptionsAndHashtags } from '@/server/core/utils/sanitizer';
import { logger } from '@/server/core/utils/logger';
import { COPY_REFINER_SYSTEM_PROMPT } from '../prompts/copy-refiner.system';
import { buildCopyRefinerUserPrompt } from '../prompts/copy-refiner.user';
import { CopyRefinerInput } from '../types';

export async function refineCopy(input: CopyRefinerInput): Promise<string> {
  const {
    groundingContext,
    rawText,
    totalIdeas,
    allIdeasTemplate,
    model,
    customApiKey,
    clientAccessCode,
  } = input;

  logger.info('[copy-refiner] Refining incomplete or problematic output | tier=tier3');
  const userPrompt = buildCopyRefinerUserPrompt(groundingContext, rawText, totalIdeas, allIdeasTemplate);
  const userSelectedModel = model ? normalizeGeminiModel(model) : undefined;

  const payload = {
    contents: {
      parts: [
        {
          text: userPrompt,
        },
      ],
    },
    config: {
      systemInstruction: COPY_REFINER_SYSTEM_PROMPT,
    },
  };

  try {
    const validatedResult = await callGeminiWithFallback(
      userSelectedModel,
      payload,
      customApiKey,
      clientAccessCode,
      'tier3',
      'Content Ideas Validation'
    );
    if (validatedResult?.text && validatedResult.text.trim().length >= 80) {
      logger.info('[copy-refiner] Successfully refined copy output with tier3 validator.');
      return sanitizeCaptionsAndHashtags(validatedResult.text);
    }
  } catch (err) {
    logger.warn('[copy-refiner] Refinement failed or skipped, falling back to original output:', err);
  }

  return rawText;
}
