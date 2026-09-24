import { GoogleGenAI } from '@google/genai';

export function isRealApiKey(key?: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const k = key.trim();
  if (k.length < 10) return false;
  if (
    k.includes('demo_key') ||
    k.includes('backup_key_satset') ||
    k.includes('satset_01') ||
    k.includes('satset_02')
  ) {
    return false;
  }
  return true;
}

export function maskApiKeyStr(key: string): string {
  if (!key) return '••••••••';
  if (key.length <= 10) return `${key.slice(0, 3)}••••${key.slice(-2)}`;
  return `${key.slice(0, 6)}••••${key.slice(-4)}`;
}

export function getGeminiClient(customApiKey?: string) {
  const keyToUse = customApiKey && customApiKey.trim() ? customApiKey.trim() : process.env.GEMINI_API_KEY;
  if (!keyToUse) {
    throw new Error('API Key Gemini tidak dikonfigurasi. Silakan atur di Pengaturan Anti Limit.');
  }
  return new GoogleGenAI({
    apiKey: keyToUse,
  });
}
