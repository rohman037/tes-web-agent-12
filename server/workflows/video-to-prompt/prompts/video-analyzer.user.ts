export function buildVideoAnalyzerUserPrompt(sourceTitle?: string, customInstructions?: string): string {
  return `
Perform an exhaustive visual, auditory, and structural analysis of this video.

Grounding Info:
- Source Title / Caption: ${sourceTitle || 'None provided'}
- Additional Instructions: ${customInstructions || 'Standard analysis'}

Extract:
1. Video timeline, pace, and natural transition points.
2. Visual atmosphere, lighting, camera movement, and subject positioning.
3. Voiceover narration script and text overlays.
4. Core product or storytelling value proposition.
`;
}
