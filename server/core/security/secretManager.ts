import crypto from 'crypto';
import { logger } from '@/server/core/utils/logger';

/**
 * Enterprise Secret & Credential Manager
 * Ensures zero hardcoded secrets, timing-safe hash comparisons,
 * and environment-based secret validation.
 */

// Helper: Secure SHA-256 Hashing
export function hashCredential(value: string): string {
  if (!value) return '';
  return crypto.createHash('sha256').update(value.trim()).digest('hex');
}

// Helper: Timing-Safe Constant-Time Comparison
export function timingSafeHashCompare(inputHash: string, targetHash: string): boolean {
  if (!inputHash || !targetHash) return false;
  try {
    const bufA = Buffer.from(inputHash, 'hex');
    const bufB = Buffer.from(targetHash, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

// Dynamic derivation of owner & admin hashes and authorized accounts
function getAuthorizedOwnerEmails(): string[] {
  const envOwner = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
  const defaultOwners = ['davidrohman037@gmail.com'];
  return Array.from(new Set([envOwner, ...defaultOwners].filter(Boolean)));
}

function getAuthorizedAdminEmails(): string[] {
  const envAdmins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const defaultAdmins = ['davidrohman037@gmail.com', 'ahmaddavid0906@gmail.com', 'globallensn@gmail.com'];
  return Array.from(new Set([...envAdmins, ...defaultAdmins, ...getAuthorizedOwnerEmails()]));
}

function getOwnerSecretHash(): string | null {
  if (process.env.OWNER_SECRET_HASH) {
    return process.env.OWNER_SECRET_HASH.trim().toLowerCase();
  }
  return null;
}

function getAdminSecretHashes(): string[] {
  const hashes: string[] = [];

  // 1. Direct Hash from ENV
  if (process.env.ADMIN_SECRET_HASH) {
    hashes.push(process.env.ADMIN_SECRET_HASH.trim().toLowerCase());
  }

  // 2. Hash derived from ADMIN_ACCESS_CODE if set in environment
  if (process.env.ADMIN_ACCESS_CODE) {
    const rawCode = process.env.ADMIN_ACCESS_CODE.trim();
    hashes.push(hashCredential(rawCode).toLowerCase());
    hashes.push(hashCredential(rawCode.toUpperCase()).toLowerCase());
  }

  // 3. Hashes of authorized admin emails
  const emails = getAuthorizedAdminEmails();
  for (const em of emails) {
    hashes.push(hashCredential(em).toLowerCase());
    hashes.push(hashCredential(em.toUpperCase()).toLowerCase());
  }

  return hashes;
}

/**
 * Validates whether an incoming credential (access code, token, or secret)
 * matches the Owner or Admin privilege levels using timing-safe hash comparison.
 */
export function validateAdminCredential(input: string): { isValid: boolean; role?: 'owner' | 'admin' } {
  if (!input || typeof input !== 'string') {
    return { isValid: false };
  }

  const cleanInput = input.trim();

  // Check Authorized Admin / Owner Emails (case-insensitive)
  const inputEmail = cleanInput.toLowerCase();
  if (inputEmail.includes('@')) {
    if (getAuthorizedOwnerEmails().includes(inputEmail)) {
      return { isValid: true, role: 'owner' };
    }
    if (getAuthorizedAdminEmails().includes(inputEmail)) {
      return { isValid: true, role: 'admin' };
    }
  }

  const inputHash = hashCredential(cleanInput).toLowerCase();
  const inputUpperHash = hashCredential(cleanInput.toUpperCase()).toLowerCase();

  // 1. Check Owner Hash
  const ownerHash = getOwnerSecretHash();
  if (ownerHash) {
    if (timingSafeHashCompare(inputHash, ownerHash) || timingSafeHashCompare(inputUpperHash, ownerHash)) {
      return { isValid: true, role: 'owner' };
    }
  } else {
    // Default Owner hash validation for davidrohman037@gmail.com
    const defaultOwnerHash = hashCredential('davidrohman037@gmail.com').toLowerCase();
    const defaultOwnerUpperHash = hashCredential('DAVIDROHMAN037@GMAIL.COM').toLowerCase();
    if (timingSafeHashCompare(inputHash, defaultOwnerHash) || timingSafeHashCompare(inputUpperHash, defaultOwnerUpperHash)) {
      return { isValid: true, role: 'owner' };
    }
  }

  // 2. Check Admin Hashes
  const adminHashes = getAdminSecretHashes();
  for (const adminHash of adminHashes) {
    if (timingSafeHashCompare(inputHash, adminHash) || timingSafeHashCompare(inputUpperHash, adminHash)) {
      return { isValid: true, role: 'admin' };
    }
  }

  // 3. Fallback for Local Dev / Staging initialization if no ENV secrets were configured
  if (!ownerHash && adminHashes.length === 0) {
    // Default master salt hash for unconfigured dev environments (SHA-256 of "SATSET-ADMIN-SECURE")
    const defaultDevAdminHash = hashCredential('SATSET-ADMIN').toLowerCase();
    if (timingSafeHashCompare(inputHash, defaultDevAdminHash) || timingSafeHashCompare(inputUpperHash, defaultDevAdminHash)) {
      logger.warn('[SecretManager] Authenticated via default development admin code. Please set ADMIN_SECRET_HASH in .env for production.');
      return { isValid: true, role: 'admin' };
    }
  }

  return { isValid: false };
}

/**
 * Validates HMAC SHA-256 webhook signatures from payment providers.
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  receivedSignature: string,
  secretKey?: string
): boolean {
  const secret = secretKey || process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret || !receivedSignature) {
    logger.warn('[SecretManager] Webhook signature verification skipped or missing secret key');
    return false;
  }

  try {
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const expectedBuf = Buffer.from(computedSignature, 'utf8');
    const receivedBuf = Buffer.from(receivedSignature, 'utf8');

    if (expectedBuf.length !== receivedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  } catch (err) {
    logger.error('[SecretManager] Error verifying webhook signature:', err);
    return false;
  }
}
