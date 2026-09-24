import { getUserSession } from '../auth';

/**
 * Standard headers generator for Admin API calls.
 * Ensures x-access-code and authorization headers are always attached.
 */
export function getAdminHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const session = getUserSession();
  const activeCode = session?.code || (typeof localStorage !== 'undefined' ? localStorage.getItem('satset_access_code') : null) || '';
  const adminEmail = session?.email || (typeof localStorage !== 'undefined' ? localStorage.getItem('satset_admin_email') : null) || '';
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(activeCode ? { 'x-access-code': activeCode, 'x-admin-code': activeCode, 'Authorization': `Bearer ${activeCode}` } : {}),
    ...(adminEmail ? { 'x-admin-email': adminEmail } : {}),
    ...customHeaders,
  };

  return headers;
}

/**
 * Robust fetch wrapper for Admin backend endpoints.
 * Automatically injects admin credentials and handles JSON responses.
 */
export async function adminFetch<T = any>(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const timeoutMs = options.timeoutMs || 8000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const combinedHeaders = getAdminHeaders((options.headers as Record<string, string>) || {});
    const res = await fetch(url, {
      ...options,
      headers: combinedHeaders,
      signal: controller.signal,
    });

    let data: any = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch {
        data = null;
      }
    } else {
      try {
        data = await res.text();
      } catch {
        data = null;
      }
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data,
        error: data?.error || data?.message || `Request failed with status ${res.status}`,
      };
    }

    return {
      ok: true,
      status: res.status,
      data,
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.warn(`[AdminApi] Network timeout (${timeoutMs}ms) for ${url}`);
      return {
        ok: false,
        status: 408,
        error: 'Permintaan ke server kehabisan waktu (timeout).',
      };
    }
    console.error(`[AdminApi] Network error for ${url}:`, err);
    return {
      ok: false,
      status: 0,
      error: err?.message || 'Gagal terhubung ke server backend.',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
