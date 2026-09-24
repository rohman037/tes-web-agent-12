import { callGeminiWithFallback } from '@/server/core/llm/geminiGateway';
import { normalizeGeminiModel } from '@/server/core/llm/routing/modelRouter';
import { logger } from '@/server/core/utils/logger';
import { PROMPT_GENERATOR_SYSTEM_PROMPT } from '../prompts/prompt-generator.system';
import { buildPromptGeneratorUserPrompt } from '../prompts/prompt-generator.user';

export interface PromptGeneratorInput {
  targetAi: string;
  aspectRatio: string;
  storyboardContext: string;
  model?: string;
  customApiKey?: string;
  clientAccessCode?: string;
}

export async function runPromptGeneratorAgent(input: PromptGeneratorInput): Promise<string> {
  const userPrompt = buildPromptGeneratorUserPrompt({
    targetAi: input.targetAi,
    aspectRatio: input.aspectRatio,
    storyboardContext: input.storyboardContext,
  });

  const payload = {
    contents: {
      parts: [{ text: userPrompt }],
    },
    config: {
      systemInstruction: PROMPT_GENERATOR_SYSTEM_PROMPT,
      temperature: 0.4,
    },
  };

  logger.info('[video-to-prompt] Executing Prompt Generator Agent');
  const result = await callGeminiWithFallback(
    input.model ? normalizeGeminiModel(input.model) : undefined,
    payload,
    input.customApiKey,
    input.clientAccessCode,
    'tier2',
    'AI Video Prompt Generator'
  );

  return result.text || '';
}
