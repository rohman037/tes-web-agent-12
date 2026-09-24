import { callGeminiWithFallback } from '@/server/core/llm/geminiGateway';
import { normalizeGeminiModel } from '@/server/core/llm/routing/modelRouter';
import { logger } from '@/server/core/utils/logger';
import { COPY_REFINER_SYSTEM_PROMPT } from '../prompts/copy-refiner.system';
import { buildCopyRefinerUserPrompt } from '../prompts/copy-refiner.user';

export interface CopyRefinerInput {
  draftCaption?: string;
  sourceContext: string;
  model?: string;
  customApiKey?: string;
  clientAccessCode?: string;
}

export async function runCopyRefinerAgent(input: CopyRefinerInput): Promise<string> {
  const userPrompt = buildCopyRefinerUserPrompt({
    draftCaption: input.draftCaption,
    sourceContext: input.sourceContext,
  });

  const payload = {
    contents: {
      parts: [{ text: userPrompt }],
    },
    config: {
      systemInstruction: COPY_REFINER_SYSTEM_PROMPT,
      temperature: 0.35,
    },
  };

  logger.info('[video-to-prompt] Executing Copy Refiner Agent');
  const result = await callGeminiWithFallback(
    input.model ? normalizeGeminiModel(input.model) : undefined,
    payload,
    input.customApiKey,
    input.clientAccessCode,
    'tier3',
    'Video Copy Refiner'
  );

  return result.text || '';
}
