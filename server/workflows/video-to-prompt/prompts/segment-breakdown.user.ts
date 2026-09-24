export function buildSegmentBreakdownUserPrompt(input: {
  segmentDuration: number | string;
  totalDuration?: number;
  groundingAnalysis: string;
}): string {
  return `
Break down the analyzed video into discrete time segments of ${input.segmentDuration} seconds each.
Within each segment, produce micro-clips (1-2s each) with Visual, Aksi, and Suara/Subteks.

Video Grounding Analysis:
${input.groundingAnalysis}
`;
}
