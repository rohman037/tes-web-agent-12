import { getUserSession } from './auth';
import { getAntiLimitConfig, removeDeadKey } from './antiLimit';
import { isRateLimitOrDeadKeyError } from './apiHelper';

export interface ApiProxyOptions extends Omit<RequestInit, 'body'> {
  body?: any;
  userCode?: string;
  customApiKey?: string;
  params?: Record<string, string | number | boolean | undefined | null>;
  timeoutMs?: number;
  retries?: number;
  skipAuthHeaders?: boolean;
}

export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: string;
  [key: string]: any;
}

export interface GeminiProxyPayload {
  contents: any;
  model?: string;
  systemInstruction?: string;
  responseMimeType?: string;
  category?: 'text' | 'image' | 'video';
  endpointName?: string;
  enableSearchGrounding?: boolean;
  enableHighThinking?: boolean;
  temperature?: number;
  toolName?: string;
  customApiKey?: string;
  clientAccessCode?: string;
}

export interface GeminiProxyResponse {
  success: boolean;
  text?: string;
  modelUsed?: string;
  tierUsed?: string;
  latencyMs?: number;
  error?: string;
}

/**
 * Standardizes endpoints to ensure they are directed to the backend proxy
 * and prevents accidental direct calls to external domains.
 */
export function normalizeEndpoint(urlOrPath: string): string {
  if (!urlOrPath) return '/api';
  
  // If it's already an absolute /api path
  if (urlOrPath.startsWith('/api')) {
    return urlOrPath;
  }

  // If it starts with a slash
  if (urlOrPath.startsWith('/')) {
    return `/api${urlOrPath}`;
  }

  // If a full URL was provided accidentally, extract the pathname or route to proxy
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    try {
      const parsed = new URL(urlOrPath);
      if (parsed.pathname.startsWith('/api')) {
        return `${parsed.pathname}${parsed.search}`;
      }
      return `/api${parsed.pathname}${parsed.search}`;
    } catch {
      return `/api/${urlOrPath}`;
    }
  }

  return `/api/${urlOrPath}`;
}

/**
 * Builds the default authorization and client context headers.
 */
export function getProxyHeaders(options: ApiProxyOptions = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (options.skipAuthHeaders) {
    return headers;
  }

  const session = getUserSession();
  const clientCode = (options.userCode || session?.code || '').trim().toUpperCase();
  if (clientCode) {
    headers['x-client-access-code'] = clientCode;
    headers['Authorization'] = `Bearer ${clientCode}`;
  }

  const antiLimit = getAntiLimitConfig(clientCode);
  const customKey = (options.customApiKey || antiLimit.customApiKey || (antiLimit.apiKeys && antiLimit.apiKeys[0]) || '').trim();
  if (customKey) {
    headers['x-custom-api-key'] = customKey;
  }

  return headers;
}

/**
 * Centralized API Proxy fetch wrapper.
 * Guarantees all client requests are routed through backend proxy endpoints
 * with automatic authentication, dead key rotation, and error parsing.
 */
export async function apiProxy<T = any>(
  endpoint: string,
  options: ApiProxyOptions = {}
): Promise<T> {
  const finalEndpoint = normalizeEndpoint(endpoint);
  const defaultHeaders = getProxyHeaders(options);

  // Build query params if provided
  let url = finalEndpoint;
  if (options.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        searchParams.append(k, String(v));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const mergedHeaders: Record<string, string> = {
    ...defaultHeaders,
    ...((options.headers as Record<string, string>) || {}),
  };

  // Determine if body is JSON object and set Content-Type
  let requestBody: BodyInit | undefined = options.body;
  if (
    requestBody &&
    typeof requestBody === 'object' &&
    !(requestBody instanceof FormData) &&
    !(requestBody instanceof Blob) &&
    !(requestBody instanceof URLSearchParams)
  ) {
    requestBody = JSON.stringify(requestBody);
    if (!mergedHeaders['Content-Type']) {
      mergedHeaders['Content-Type'] = 'application/json';
    }
  }

  const maxRetries = options.retries ?? 1;
  let attempt = 0;
  let lastError: any = null;

  while (attempt <= maxRetries) {
    attempt++;
    const controller = new AbortController();
    const timeout = options.timeoutMs || 45000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: mergedHeaders,
        body: requestBody,
        signal: options.signal || controller.signal,
      });

      clearTimeout(timeoutId);

      // Extract dead keys from response headers for anti-limit auto-cleaning
      const deadKeysHeader = response.headers.get('x-dead-keys');
      if (deadKeysHeader) {
        const deadKeys = deadKeysHeader.split(',').map((k) => k.trim()).filter(Boolean);
        deadKeys.forEach((k) => removeDeadKey(k));
      }

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const data = await response.json();
        if (data && data.deadKey) {
          removeDeadKey(data.deadKey);
        }

        if (!response.ok) {
          if (isRateLimitOrDeadKeyError(data) || response.status === 429 || response.status === 403) {
            throw new Error(
              data.error ||
              'Semua API Key dalam pool telah habis atau terkena limit (429/403). Silakan atur API Key di menu Pengaturan.'
            );
          }
          throw new Error(data.error || `Request failed with status ${response.status}`);
        }

        return data as T;
      }

      const textResponse = await response.text();
      if (!response.ok) {
        if (
          response.status === 429 ||
          response.status === 403 ||
          textResponse.includes('RESOURCE_EXHAUSTED') ||
          textResponse.includes('API_KEY_INVALID')
        ) {
          throw new Error(
            'Semua API Key dalam pool telah habis atau terkena limit (429/403). Silakan periksa kembali API Key Anda.'
          );
        }
        if (textResponse.startsWith('<') || textResponse.toLowerCase().includes('<!doctype html>')) {
          if (response.status === 413) {
            throw new Error('Ukuran file/payload terlalu besar.');
          }
          throw new Error(`Server error (${response.status}). Silakan coba sesaat lagi.`);
        }
        throw new Error(textResponse || `Request failed with status ${response.status}`);
      }

      try {
        return JSON.parse(textResponse) as T;
      } catch {
        return textResponse as unknown as T;
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;

      // Only retry on network errors or transient 502/503/504 errors if retries remaining
      const isAbort = err.name === 'AbortError';
      const shouldRetry =
        attempt <= maxRetries &&
        !isAbort &&
        !String(err.message || '').includes('429') &&
        !String(err.message || '').includes('403');

      if (shouldRetry) {
        await new Promise((res) => setTimeout(res, 500 * attempt));
        continue;
      }

      if (isAbort) {
        throw new Error(`Permintaan ke server timed out setelah ${timeout / 1000} detik.`);
      }

      throw err;
    }
  }

  throw lastError || new Error('Gagal menghubungi backend proxy.');
}

/**
 * Helper methods for common HTTP verbs
 */
export const api = {
  get: <T = any>(endpoint: string, options: ApiProxyOptions = {}) =>
    apiProxy<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = any>(endpoint: string, body?: any, options: ApiProxyOptions = {}) =>
    apiProxy<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T = any>(endpoint: string, body?: any, options: ApiProxyOptions = {}) =>
    apiProxy<T>(endpoint, { ...options, method: 'PUT', body }),

  patch: <T = any>(endpoint: string, body?: any, options: ApiProxyOptions = {}) =>
    apiProxy<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T = any>(endpoint: string, options: ApiProxyOptions = {}) =>
    apiProxy<T>(endpoint, { ...options, method: 'DELETE' }),

  /**
   * Helper specifically for Gemini AI generation via backend proxy
   */
  generateGemini: (payload: GeminiProxyPayload, options: ApiProxyOptions = {}) =>
    apiProxy<GeminiProxyResponse>('/api/gemini/generate', {
      ...options,
      method: 'POST',
      body: payload,
    }),
};

export default apiProxy;
