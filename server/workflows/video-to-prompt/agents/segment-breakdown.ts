import { callGeminiWithFallback } from '@/server/core/llm/geminiGateway';
import { normalizeGeminiModel } from '@/server/core/llm/routing/modelRouter';
import { logger } from '@/server/core/utils/logger';
import { SEGMENT_BREAKDOWN_SYSTEM_PROMPT } from '../prompts/segment-breakdown.system';
import { buildSegmentBreakdownUserPrompt } from '../prompts/segment-breakdown.user';

export interface SegmentBreakdownInput {
  segmentDuration: number | string;
  totalDuration?: number;
  groundingAnalysis: string;
  model?: string;
  customApiKey?: string;
  clientAccessCode?: string;
}

export async function runSegmentBreakdownAgent(input: SegmentBreakdownInput): Promise<string> {
  const userPrompt = buildSegmentBreakdownUserPrompt({
    segmentDuration: input.segmentDuration,
    totalDuration: input.totalDuration,
    groundingAnalysis: input.groundingAnalysis,
  });

  const payload = {
    contents: {
      parts: [{ text: userPrompt }],
    },
    config: {
      systemInstruction: SEGMENT_BREAKDOWN_SYSTEM_PROMPT,
      temperature: 0.35,
    },
  };

  logger.info('[video-to-prompt] Executing Segment Breakdown Agent');
  const result = await callGeminiWithFallback(
    input.model ? normalizeGeminiModel(input.model) : undefined,
    payload,
    input.customApiKey,
    input.clientAccessCode,
    'tier2',
    'Video Segment Breakdown'
  );

  return result.text || '';
}
