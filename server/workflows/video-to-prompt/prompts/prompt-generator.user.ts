export function buildPromptGeneratorUserPrompt(input: {
  targetAi: string;
  aspectRatio: string;
  storyboardContext: string;
}): string {
  return `
Generate an optimized Master Prompt and Negative Prompt for ${input.targetAi.toUpperCase()} generator (Aspect Ratio: ${input.aspectRatio}).

Storyboard Context:
${input.storyboardContext}
`;
}
