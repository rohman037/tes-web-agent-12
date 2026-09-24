import { ValidationResult } from '../types';

export function validateContentIdeasOutput(
  outputText: string | undefined | null,
  totalIdeas: number = 5
): ValidationResult {
  const issues: string[] = [];

  if (!outputText || typeof outputText !== 'string' || outputText.trim().length < 80) {
    issues.push('Output terlalu pendek atau kosong (< 80 karakter)');
    return {
      isValid: false,
      needsRefine: true,
      issues,
    };
  }

  const trimmed = outputText.trim();

  // Periksa apakah format Ide Konten ada
  const hasIdeaHeaders = /###\s*💡\s*IDE/i.test(trimmed) || /IDE\s*\d+/i.test(trimmed);
  if (!hasIdeaHeaders) {
    issues.push('Header ide konten tidak ditemukan');
  }

  // Periksa apakah segmen timeline ada
  const hasTimelineFormat = /Visual:/i.test(trimmed) && /Aksi:/i.test(trimmed);
  if (!hasTimelineFormat) {
    issues.push('Format timeline (Visual / Aksi) tidak lengkap');
  }

  const needsRefine = issues.length > 0;

  return {
    isValid: issues.length === 0,
    needsRefine,
    issues,
  };
}
