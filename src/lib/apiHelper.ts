import { getAntiLimitConfig, removeDeadKey } from './antiLimit';
import { getModelPriorities, addApiKeyLog } from './admin/apiKeys';
import { api } from './apiProxy';
import { ALL_GEMINI_CASCADING_MODELS } from '@/server/core/llm/routing/modelRouter';
export { ALL_GEMINI_CASCADING_MODELS };

export function getCategoryModelPriority(category: 'text' | 'image' | 'video' = 'text'): string[] {
  try {
    const config = getModelPriorities();
    if (config && Array.isArray(config[category]) && config[category].length > 0) {
      return config[category];
    }
  } catch (e) {}
  return ALL_GEMINI_CASCADING_MODELS;
}

export interface GenerateOptions {
  model?: string;
  systemInstruction?: string;
  responseMimeType?: string;
  category?: 'text' | 'image' | 'video';
  endpointName?: string;
  enableSearchGrounding?: boolean;
  enableHighThinking?: boolean;
  lowLatency?: boolean;
  temperature?: number;
  toolName?: string;
}

/**
 * Helper error checker for Rate Limit (429), Permission Denied (403),
 * RESOURCE_EXHAUSTED, or API_KEY_INVALID errors.
 */
export function isRateLimitOrDeadKeyError(err: any): boolean {
  if (!err) return false;
  const errMsg = String(err?.message || err?.error || err || '').toUpperCase();
  const status = err?.status || err?.statusCode || err?.response?.status || 0;

  return (
    status === 429 ||
    status === 403 ||
    errMsg.includes('429') ||
    errMsg.includes('403') ||
    errMsg.includes('RESOURCE_EXHAUSTED') ||
    errMsg.includes('API_KEY_INVALID') ||
    errMsg.includes('QUOTA EXCEEDED') ||
    errMsg.includes('INVALID API KEY') ||
    errMsg.includes('PERMISSION_DENIED') ||
    errMsg.includes('UNAUTHENTICATED')
  );
}

/**
 * Executes Gemini API generation through the secure backend proxy endpoint.
 * Ensures no API keys are exposed to the client bundle.
 */
export async function executeGeminiWithFullCascade(
  contents: any,
  options: GenerateOptions = {},
  userCode?: string
): Promise<string> {
  const antiLimit = getAntiLimitConfig(userCode);
  const customApiKey = antiLimit.customApiKey || (antiLimit.apiKeys && antiLimit.apiKeys[0]) || '';
  const category = options.category || 'text';
  const endpoint = options.endpointName || '/api/gemini/generate';

  const result = await api.generateGemini(
    {
      contents,
      model: options.model,
      systemInstruction: options.systemInstruction,
      responseMimeType: options.responseMimeType,
      category,
      endpointName: endpoint,
      enableSearchGrounding: options.enableSearchGrounding,
      enableHighThinking: options.enableHighThinking,
      temperature: options.temperature,
      toolName: options.toolName,
      customApiKey,
      clientAccessCode: userCode,
    },
    {
      userCode,
      customApiKey,
    }
  );

  if (!result.success && result.error) {
    throw new Error(result.error);
  }

  if (result.modelUsed) {
    addApiKeyLog('backend_gateway', 'Server Proxy', endpoint, 'success', result.modelUsed);
  }

  return result.text || '';
}

/**
 * Compatibility wrapper for executing with backend proxy
 */
export async function executeWithGenAI<T = any>(
  fn: (clientProxy: { generateContent: (model: string, prompt: string, config?: any) => Promise<{ text?: string }> }, apiKey: string, model: string) => Promise<T>,
  userCode?: string
): Promise<T> {
  const proxyClient = {
    generateContent: async (model: string, prompt: string, config?: any) => {
      const text = await executeGeminiWithFullCascade(
        prompt,
        {
          model,
          systemInstruction: config?.systemInstruction,
          responseMimeType: config?.responseMimeType,
        },
        userCode
      );
      return { text };
    }
  };

  return fn(proxyClient, '', 'gemini-3.8-flash');
}

/**
 * Safe parser JSON from Response fetch, detecting dead keys in headers or 429/403 errors.
 */
export async function safeParseJson<T = any>(res: Response): Promise<T> {
  const deadKeysHeader = res.headers.get('x-dead-keys');
  if (deadKeysHeader) {
    const deadKeys = deadKeysHeader.split(',').map((k) => k.trim()).filter(Boolean);
    deadKeys.forEach((k) => removeDeadKey(k));
  }

  const contentType = res.headers.get('content-type') || '';
  
  if (contentType.includes('application/json')) {
    try {
      const data = await res.json();
      if (!res.ok) {
        if (data.deadKey) {
          removeDeadKey(data.deadKey);
        }
        if (isRateLimitOrDeadKeyError(data) || res.status === 429 || res.status === 403) {
          throw new Error(data.error || 'Semua API Key dalam pool telah habis atau terkena limit (429/403). Silakan masukkan API Key baru di menu Pengaturan API Key.');
        }
        throw new Error(data.error || `HTTP Error ${res.status}`);
      }
      return data;
    } catch (e: any) {
      if (e.message && !e.message.includes('JSON')) {
        throw e;
      }
    }
  }

  const text = await res.text();
  if (!res.ok) {
    if (res.status === 429 || res.status === 403 || text.includes('RESOURCE_EXHAUSTED') || text.includes('API_KEY_INVALID')) {
      throw new Error('Semua API Key dalam pool telah habis atau terkena limit (429/403). Silakan masukkan API Key baru di menu Pengaturan API Key.');
    }
    if (text.startsWith('<') || text.toLowerCase().includes('<!doctype html>')) {
      if (res.status === 413) {
        throw new Error('Ukuran data file terlalu besar. Silakan gunakan file di bawah 50MB.');
      }
      throw new Error(`Server mengalami masalah (${res.status}). Silakan coba lagi.`);
    }
    throw new Error(text || `HTTP Error ${res.status}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Respon dari server tidak dalam format JSON yang valid.');
  }
}
