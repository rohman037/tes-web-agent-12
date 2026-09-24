import { describe, it, expect } from 'vitest';
import { sanitizeCaptionsAndHashtags, sanitizeMarkdown } from '@/server/workflows/shared/sanitizer';

// Extended text sanitizer helper for robust edge cases
export function sanitizeUserTextInput(input: string | null | undefined, maxLength: number = 500): string {
  if (input === null || input === undefined) return '';
  const text = String(input);
  
  return text
    // Strip dangerous HTML/Script tags
    .replace(/<[^>]*>?/gm, '')
    // Normalize consecutive whitespace
    .replace(/\s+/g, ' ')
    // Trim length safely
    .slice(0, maxLength)
    .trim();
}

describe('Unit Test: Text Sanitization & Encoding Utilities', () => {
  describe('sanitizeCaptionsAndHashtags', () => {
    it('should format hashtags without trailing spaces and normalize spaces', () => {
      const input = '# video   # tips    #creator  keren';
      const output = sanitizeCaptionsAndHashtags(input);
      expect(output).toBe('#video #tips #creator keren');
    });

    it('should safely handle empty or null inputs', () => {
      expect(sanitizeCaptionsAndHashtags('')).toBe('');
      expect(sanitizeCaptionsAndHashtags(null as any)).toBe('');
      expect(sanitizeCaptionsAndHashtags(undefined as any)).toBe('');
    });
  });

  describe('sanitizeMarkdown', () => {
    it('should normalize carriage returns and consecutive newlines', () => {
      const input = 'Line 1\r\n\r\n\r\n\r\nLine 2\r\nLine 3';
      const output = sanitizeMarkdown(input);
      expect(output).toBe('Line 1\n\nLine 2\nLine 3');
    });

    it('should handle empty input safely', () => {
      expect(sanitizeMarkdown('')).toBe('');
    });
  });

  describe('sanitizeUserTextInput (XSS, Emoji & Unicode Edge Cases)', () => {
    it('should strip XSS and HTML tags completely', () => {
      const dirty = '<script>alert("hack")</script>Halo <img src="x" onerror="alert(1)">Dunia!';
      const clean = sanitizeUserTextInput(dirty);
      expect(clean).toBe('alert("hack")Halo Dunia!');
      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('<img');
    });

    it('should preserve emojis and unicode characters intact', () => {
      const unicodeText = '🚀 Review Kuliner Spesial 🔥 Rasa Mantap! 🍜';
      const clean = sanitizeUserTextInput(unicodeText);
      expect(clean).toBe(unicodeText);
    });

    it('should enforce maximum length truncation', () => {
      const longText = 'a'.repeat(600);
      const truncated = sanitizeUserTextInput(longText, 100);
      expect(truncated.length).toBe(100);
    });

    it('should safely handle null, undefined, and non-string inputs', () => {
      expect(sanitizeUserTextInput(null)).toBe('');
      expect(sanitizeUserTextInput(undefined)).toBe('');
      expect(sanitizeUserTextInput(12345 as any)).toBe('12345');
    });
  });
});
