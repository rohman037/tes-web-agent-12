export interface ValidationResult {
  passed: boolean;
  score: number;
  failures: { rule_id: string; message: string }[];
}

export function validateClipStructure(output: string): ValidationResult {
  const failures: { rule_id: string; message: string }[] = [];
  const text = output || '';

  // C1: Format dasar
  if (!text.includes('Visual:') && !text.includes('Visual :')) {
    failures.push({ rule_id: 'C1', message: 'Missing Visual label' });
  }

  // C2: Aksi
  if (!text.includes('Aksi:') && !text.includes('Aksi :')) {
    failures.push({ rule_id: 'C2', message: 'Missing Aksi label' });
  }

  // C3: Dialog / Voice Over / Subteks
  if (!/voice\s*over|subteks/i.test(text)) {
    failures.push({ rule_id: 'C3', message: 'Missing voice over or subteks' });
  }

  // C4: Timeline format
  const hasTimeline = /\b\d+(?:[.,]\d+)?\s*[–\-—]\s*\d+(?:[.,]\d+)?\s*(?:detik|s|dtk)\b/i.test(text) ||
    /\[\d+(?:[.,]\d+)?\s*[–\-—]\s*\d+(?:[.,]\d+)?\s*s\]/i.test(text);
  if (!hasTimeline) {
    failures.push({ rule_id: 'C4', message: 'Missing clip duration timeline format' });
  }

  const totalRules = 17;
  const score = Math.max(0, Math.round(((totalRules - failures.length) / totalRules) * 100));

  return {
    passed: score >= 70 && failures.length <= 3,
    score,
    failures,
  };
}
