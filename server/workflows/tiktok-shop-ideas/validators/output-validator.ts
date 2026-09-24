import { validateClipStructure } from '@/server/workflows/shared/validator';

export interface ShopIdeasValidationSummary {
  status: 'passed' | 'warning' | 'rejected';
  score: number;
  failures: string[];
  hasVisualAnchor: boolean;
  hasAudioVoiceOver: boolean;
  hasVisualPacing: boolean;
  hasValidClipCount: boolean;
}

export interface OutputValidationResult {
  passed: boolean;
  score: number;
  failures: string[];
  needsRefine: boolean;
}

export function isNewClipFormat(text: string): boolean {
  if (!text) return false;
  return /\[\d+(?:[.,]\d+)?\s*[–\-—]\s*\d+(?:[.,]\d+)?\s*s\]/i.test(text) ||
    /Visual\s*:/i.test(text) ||
    /Aksi\s*:/i.test(text);
}

export function validateShopIdeasOutput(
  rawText: string,
  hasAnchor: boolean = false
): ShopIdeasValidationSummary {
  const failures: string[] = [];
  const text = rawText || '';

  const hasVisual = /Visual\s*:/i.test(text);
  const hasAksi = /Aksi\s*:/i.test(text);
  const hasVoiceOver = /Voice\s*Over|Subteks/i.test(text);
  const hasSoundEffect = /Sound\s*Effect|SFX/i.test(text);
  const hasTimeline = /\b\d+(?:[.,]\d+)?\s*[–\-—]\s*\d+(?:[.,]\d+)?\s*(?:detik|s|dtk)\b/i.test(text) ||
    /\[\d+(?:[.,]\d+)?\s*[–\-—]\s*\d+(?:[.,]\d+)?\s*s\]/i.test(text);

  if (!hasVisual) failures.push('Format klip kurang elemen Visual');
  if (!hasAksi) failures.push('Format klip kurang elemen Aksi');
  if (!hasVoiceOver) failures.push('Format klip kurang Voice Over/Subteks');
  if (!hasTimeline) failures.push('Format klip kurang informasi durasi timeline');

  if (hasAnchor) {
    const hasProductRef = /produk|kemasan|botol|warna|varian/i.test(text);
    if (!hasProductRef) {
      failures.push('Identitas jangkar produk belum konsisten di seluruh klip');
    }
  }

  const baseClipScore = validateClipStructure(text).score;
  const score = Math.max(0, Math.min(100, Math.round((baseClipScore + (failures.length === 0 ? 10 : -failures.length * 15)))));

  let status: 'passed' | 'warning' | 'rejected' = 'passed';
  if (failures.length > 2 || score < 60) {
    status = 'rejected';
  } else if (failures.length > 0 || score < 85) {
    status = 'warning';
  }

  return {
    status,
    score,
    failures,
    hasVisualAnchor: !failures.some(f => f.includes('jangkar')),
    hasAudioVoiceOver: hasVoiceOver,
    hasVisualPacing: hasTimeline,
    hasValidClipCount: hasVisual && hasAksi,
  };
}

export function validateOutput(
  rawText: string,
  enrichedInfo?: any,
  hasAnchor?: boolean
): OutputValidationResult {
  const result = validateShopIdeasOutput(rawText, Boolean(hasAnchor));
  const hashtagCount = (rawText.match(/#[a-zA-Z0-9_\u0590-\u05ff\u0600-\u06ff\u0e00-\u0e7f]+/g) || []).length;
  const hasCaption = /Draft\s*Caption/i.test(rawText);
  const needsRefine = !hasCaption || hashtagCount < 3 || result.status === 'rejected';

  return {
    passed: result.status === 'passed',
    score: result.score,
    failures: result.failures,
    needsRefine,
  };
}
