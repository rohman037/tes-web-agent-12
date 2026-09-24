export function buildCopyRefinerUserPrompt(input: {
  draftCaption?: string;
  sourceContext: string;
}): string {
  return `
Refine and polish the social media copy into a 5-sentence SEO caption and 5 distinct hashtags (1 broad, 2 niche, 2 long-tail).

Context:
${input.sourceContext}

Draft Caption (if any):
${input.draftCaption || 'None'}
`;
}
