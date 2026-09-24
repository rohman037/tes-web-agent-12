export function sanitizeCaptionsAndHashtags(text: string): string {
  if (!text) return '';
  return text
    .replace(/#\s+/g, '#')           // hapus spasi setelah #
    .replace(/\s+/g, ' ')            // normalisasi spasi
    .trim();
}

export function sanitizeMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
