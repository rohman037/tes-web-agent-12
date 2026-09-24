import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import { logAuthEvent, extractClientIp } from '@/server/core/security/auditLogService';

/**
 * Multi-dimensional composite key generator combining User Identity (UID / Access Code),
 * IP address, and Device Fingerprint to thwart distributed and credential-stuffing attacks.
 */
export function generateRateLimitKey(req: Request): string {
  const ip = extractClientIp(req);
  const user = (req as any).user;
  const identifier =
    user?.uid ||
    user?.accessCode ||
    (req.headers['x-client-access-code'] as string) ||
    (req.headers['x-access-code'] as string) ||
    req.body?.accessCode ||
    'anon';

  const rawFingerprint =
    (req.headers['x-device-fingerprint'] as string) ||
    (req.body?.fingerprint as string) ||
    '';

  const cleanId = String(identifier).trim().toUpperCase().slice(0, 64);
  const cleanFp = rawFingerprint.trim().slice(0, 64) || 'nofp';

  return `rl_${cleanId}_${ip}_${cleanFp}`;
}

/**
 * Key generator specifically tuned for Authentication endpoints.
 * Prioritizes IP and Device Fingerprint so attackers cannot bypass rate limits by spraying random access codes.
 */
export function generateAuthRateLimitKey(req: Request): string {
  const ip = extractClientIp(req);
  const rawFingerprint =
    (req.headers['x-device-fingerprint'] as string) ||
    (req.body?.fingerprint as string) ||
    '';
  const cleanFp = rawFingerprint.trim().slice(0, 64) || 'nofp';

  return `auth_${ip}_${cleanFp}`;
}

/**
 * Strict rate limiter for Authentication and Verification endpoints.
 * Protects against brute-force attacks on access codes and passwords.
 * Limit: 15 requests per minute per IP/Device.
 */
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: {
    error: 'Terlalu banyak percobaan login/verifikasi. Silakan tunggu 1 menit sebelum mencoba lagi.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { default: false },
  keyGenerator: generateAuthRateLimitKey,
  handler: async (req, res, _next, options) => {
    await logAuthEvent(
      'UNAUTHORIZED_ACCESS',
      req,
      `Rate limit login terlampaui (15 req/min). Upaya login diblokir sementara.`
    );
    res.status(429).json(options.message);
  },
});

/**
 * Rate limiter for heavy AI generation endpoints.
 * Protects API keys and server resources from abuse.
 * Limit: 40 requests per minute per user/client.
 */
export const aiGenerationRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  message: {
    error: 'Batas frekuensi pembuatan AI tercapai. Silakan beri jeda beberapa saat antar permintaan.',
    code: 'AI_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { default: false },
  keyGenerator: generateRateLimitKey,
});

/**
 * Rate limiter for sensitive Administrative operations.
 * Limit: 100 requests per minute.
 */
export const adminActionRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: {
    error: 'Terlalu banyak permintaan administratif. Silakan coba kembali sesaat lagi.',
    code: 'ADMIN_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { default: false },
  keyGenerator: generateRateLimitKey,
});

/**
 * Rate limiter for payment & checkout operations.
 * Protects transaction endpoints from spam submissions.
 * Limit: 20 requests per minute.
 */
export const paymentRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    error: 'Terlalu banyak permintaan pembayaran. Silakan tunggu beberapa saat.',
    code: 'PAYMENT_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { default: false },
  keyGenerator: generateRateLimitKey,
});
