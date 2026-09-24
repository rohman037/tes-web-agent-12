export function buildVideoToPromptUserPrompt(input: {
  videoDuration?: number;
  segmentDuration: number | "full" | string;
  targetAi: string;
  aspectRatio: string;
  analysisDepth: string;
  sourceTitle?: string;
  customInstructions?: string;
}): string {
  const duration = input.videoDuration || 30;
  const isFull = input.segmentDuration === 'full' || input.segmentDuration === 0;
  const segDurNum = typeof input.segmentDuration === 'number' ? input.segmentDuration : Number(input.segmentDuration) || 10;
  
  const totalSegments = isFull ? 1 : Math.max(1, Math.ceil(duration / segDurNum));
  
  return `
Analyze this video thoroughly and produce a COMPLETE, precision-engineered breakdown.

VIDEO CONTEXT:
- Detected / Input Duration: ${input.videoDuration ? `${input.videoDuration} seconds` : 'Analyze and detect actual video duration (default ~30s if unspecified)'}
- Segment Duration Setting: ${isFull ? 'Full video (1 single continuous segment)' : `${segDurNum} seconds per segment`}
- Calculated Total Segments: ${totalSegments}
- Target AI Video Generator: ${input.targetAi.toUpperCase()}
- Output Aspect Ratio: ${input.aspectRatio}
- Analysis Depth: ${input.analysisDepth}
- Reference Title / Caption: ${input.sourceTitle || 'none'}
- Custom Instructions: ${input.customInstructions || 'none'}

YOUR MANDATORY TASK:
1. Break down the video into EXACTLY ${totalSegments} segment(s).
2. For each segment, break it down into granular micro-clips (1–2 seconds each).
3. Ensure every single micro-clip contains:
   - Visual: [detailed visual description, lighting, angle, props, subjects]
   - Aksi: [concrete physical movement and camera motion]
   - Suara: "[voiceover or spoken narration]" OR Subteks: "[on-screen text overlay]"
4. Generate an engaging Indonesian SEO Caption (5 structured sentences: hook, benefit, use case, story, CTA).
5. Generate EXACTLY 5 Hashtags (1 broad, 2 niche, 2 long-tail).
6. Generate English Master Prompt for ${input.targetAi.toUpperCase()} AI generator (100-200 words).
7. Generate Negative Prompt.
8. Generate Ringkasan Teknis.

Follow the system prompt format and structure EXACTLY. Return clean markdown without introductory conversational filler.
`;
}
