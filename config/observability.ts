import crypto from 'crypto';

/**
 * Single Source of Truth for Sentry & OpenTelemetry Observability Configuration.
 * Enforces strict PII redaction, API Key masking, and Zero-Raw-Prompt storage.
 */

export const isProduction = process.env.NODE_ENV === 'production';

export const observabilityConfig = {
  sentry: {
    backendDsn: process.env.SENTRY_DSN_BACKEND || '',
    frontendDsn: process.env.VITE_SENTRY_DSN_FRONTEND || process.env.SENTRY_DSN_FRONTEND || '',
    environment: process.env.SENTRY_ENVIRONMENT || (isProduction ? 'production' : 'development'),
    release: process.env.SENTRY_RELEASE || 'creator-ai-workspace@1.0.0',
    tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE
      ? parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE)
      : isProduction
      ? 0.1
      : 1.0,
    profilesSampleRate: isProduction ? 0.1 : 1.0,
    replaysSessionSampleRate: isProduction ? 0.1 : 0.5,
    replaysOnErrorSampleRate: 1.0,
  },
  otel: {
    serviceName: 'creator-ai-workspace-backend',
    serviceVersion: '1.0.0',
    exporterEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  },
};

// Mask API Keys (e.g. AIzaSy..., sk-..., etc.)
const API_KEY_REGEX = /(AIza[0-9A-Za-z-_]{20,45}|sk-[a-zA-Z0-9]{20,48})/g;
// Strip Email Addresses
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// Strip Indonesian Phone Numbers (+62 or 08...)
const PHONE_REGEX = /(\+62|62|0)8[1-9][0-9]{7,11}/g;

/**
 * Strips sensitive PII and masks API keys from strings
 */
export function sanitizeString(val: string): string {
  if (!val || typeof val !== 'string') return val;
  return val
    .replace(API_KEY_REGEX, 'AIza...[MASKED_KEY]')
    .replace(EMAIL_REGEX, '[REDACTED_EMAIL]')
    .replace(PHONE_REGEX, '[REDACTED_PHONE]');
}

/**
 * Deeply sanitizes any object or array to remove PII and secrets
 */
export function sanitizeObject<T>(obj: T, visited = new WeakSet()): T {
  if (!obj || typeof obj !== 'object') {
    if (typeof obj === 'string') {
      return sanitizeString(obj) as unknown as T;
    }
    return obj;
  }

  if (visited.has(obj as unknown as object)) {
    return obj;
  }
  visited.add(obj as unknown as object);

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, visited)) as unknown as T;
  }

  const result: Record<string, any> = {};
  const sensitiveKeys = [
    'password',
    'secret',
    'apikey',
    'api_key',
    'authorization',
    'cookie',
    'accesscode',
    'access_code',
    'rawprompt',
    'prompt_text',
    'proofimagebase64',
    'token',
  ];

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
      result[key] = '[REDACTED_SECRET]';
    } else if (typeof value === 'string') {
      result[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value, visited);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Hashes raw user prompt to SHA-256 for privacy-compliant telemetry tracking
 */
export function hashPrompt(prompt: string): string {
  if (!prompt) return 'empty_prompt';
  return crypto.createHash('sha256').update(prompt.trim()).digest('hex');
}

/**
 * Universal beforeSend hook for Sentry (Backend & Frontend)
 */
export function sentryBeforeSendHook(event: any) {
  if (!event) return null;

  // 1. Sanitize breadcrumbs
  if (event.breadcrumbs && Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map((bc: any) => {
      if (bc.data) bc.data = sanitizeObject(bc.data);
      if (bc.message) bc.message = sanitizeString(bc.message);
      return bc;
    });
  }

  // 2. Sanitize request data & headers
  if (event.request) {
    if (event.request.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
      delete event.request.headers['x-client-access-code'];
      delete event.request.headers['x-admin-key'];
    }
    if (event.request.data) {
      event.request.data = sanitizeObject(event.request.data);
    }
  }

  // 3. Sanitize user context (remove email, IP, username)
  if (event.user) {
    event.user = {
      id: event.user.id ? hashPrompt(event.user.id).substring(0, 16) : 'anonymous',
    };
  }

  // 4. Sanitize exception values & stack traces
  if (event.exception?.values) {
    for (const val of event.exception.values) {
      if (val.value) {
        val.value = sanitizeString(val.value);
      }
    }
  }

  return event;
}

/**
 * Universal beforeBreadcrumb hook for Sentry
 */
export function sentryBeforeBreadcrumbHook(breadcrumb: any) {
  if (!breadcrumb) return null;

  // Sanitize message strings that might contain raw keys, emails, or phone numbers
  if (typeof breadcrumb.message === 'string') {
    breadcrumb.message = sanitizeString(breadcrumb.message);
  }

  if (breadcrumb.data) {
    breadcrumb.data = sanitizeObject(breadcrumb.data);
  }

  return breadcrumb;
}
