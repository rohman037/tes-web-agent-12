import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '@/src/lib/firebase-admin';
import { dbGetClients, dbGetAccessCodes } from '@/src/db/dbService';
import { logAuthEvent, extractClientIp } from '@/server/core/security/auditLogService';
import { isDeviceOrIpBanned } from '@/server/core/security/deviceSecurity';
import { validateAdminCredential, hashCredential } from '@/server/core/security/secretManager';
import { ROLE_PERMISSIONS, type UserRole } from '@/server/core/security/customClaimsService';
import { logger } from '@/server/core/utils/logger';

export type { UserRole };

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  name: string;
  role: UserRole;
  accessCode?: string;
  packageName?: string;
  permissions: string[];
  isMasterAdmin?: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Resolves user credentials from headers (Bearer Token, x-access-code, x-admin-code)
 * and determines role, permissions, and validity.
 */
export async function resolveUserFromRequest(req: Request): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.authorization;
  const accessCodeHeader =
    (req.headers['x-access-code'] as string) ||
    (req.headers['x-admin-code'] as string) ||
    (req.headers['x-client-access-code'] as string) ||
    (req.headers['x-client-id'] as string) ||
    (req.body && req.body.accessCode);

  const clientIp = extractClientIp(req);
  const fingerprint = (req.headers['x-device-fingerprint'] as string) || req.body?.fingerprint || '';

  // Collect candidate tokens from headers
  const rawTokensToCheck: string[] = [];
  if (accessCodeHeader && typeof accessCodeHeader === 'string') {
    rawTokensToCheck.push(accessCodeHeader.trim());
  }
  if (authHeader && authHeader.startsWith('Bearer ')) {
    rawTokensToCheck.push(authHeader.split('Bearer ')[1].trim());
  }

  // 1. Check if token or header matches Owner/Admin Hash Credentials via SecretManager
  for (const token of rawTokensToCheck) {
    const adminValidation = validateAdminCredential(token);
    if (adminValidation.isValid) {
      const isOwner = adminValidation.role === 'owner';
      const role: UserRole = isOwner ? 'owner' : 'admin';
      return {
        uid: isOwner ? 'owner_server_sec' : 'admin_server_sec',
        name: isOwner ? 'Master Owner' : 'Administrator',
        role,
        accessCode: token,
        permissions: ROLE_PERMISSIONS[role],
        isMasterAdmin: isOwner,
      };
    }
  }

  // 2. Check Firebase ID Token (Bearer Token) with Custom Claims RBAC
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1].trim();
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      const email = (decoded.email || '').toLowerCase();

      // Check if email or token qualifies for server admin credentials
      if (email) {
        const emailValidation = validateAdminCredential(email);
        if (emailValidation.isValid) {
          const isOwner = emailValidation.role === 'owner';
          const role: UserRole = isOwner ? 'owner' : 'admin';
          return {
            uid: decoded.uid,
            email,
            name: decoded.name || (isOwner ? 'Master Owner' : 'Administrator'),
            role,
            permissions: ROLE_PERMISSIONS[role],
            isMasterAdmin: isOwner,
          };
        }
      }

      // Read Custom Claims from Firebase Token (request.auth.token.role)
      const tokenRole = (decoded.role || (decoded.admin ? 'admin' : 'user')) as UserRole;
      const validRole: UserRole = ['owner', 'admin', 'moderator', 'premium', 'user'].includes(tokenRole)
        ? tokenRole
        : 'user';

      const permissions = Array.isArray(decoded.permissions)
        ? decoded.permissions
        : ROLE_PERMISSIONS[validRole] || ['access_standard_ai'];

      return {
        uid: decoded.uid,
        email,
        name: decoded.name || 'Pengguna Satset',
        role: validRole,
        permissions,
        isMasterAdmin: validRole === 'owner',
      };
    } catch (e) {
      // Not a valid Firebase JWT, proceed to check client access codes
    }
  }

  // 3. Check Client Database by Access Code (Hash-aware)
  const candidateCode = rawTokensToCheck[0];
  if (candidateCode) {
    const cleanUpper = candidateCode.toUpperCase();
    const candidateHash = hashCredential(cleanUpper);
    const clients = await dbGetClients();

    const foundClient = clients.find(
      (c: any) =>
        (c.accessCodeHash && c.accessCodeHash === candidateHash) ||
        (c.accessCode && c.accessCode.toUpperCase() === cleanUpper)
    );

    if (foundClient) {
      // Check account status
      if (foundClient.status === 'suspended') {
        throw new Error('Akun Anda ditangguhkan (Suspended). Silakan hubungi administrator.');
      }

      const now = Date.now();
      const expiry = foundClient.expiryDate ? new Date(foundClient.expiryDate).getTime() : now + 86400000;
      if (expiry - now <= 0) {
        throw new Error('Masa aktif kode akses Anda telah kedaluwarsa. Silakan perpanjang paket Anda.');
      }

      const isVip =
        (foundClient.packageName && /vip|ultra|lifetime/i.test(foundClient.packageName)) ||
        (foundClient.packageId && /vip|ultra|lifetime/i.test(foundClient.packageId)) ||
        cleanUpper.includes('VIP') ||
        cleanUpper.includes('ULTRA');

      const role: UserRole = isVip ? 'premium' : 'user';

      return {
        uid: `client_${foundClient.id || cleanUpper}`,
        email: foundClient.email,
        name: foundClient.name || 'Klien Satset',
        role,
        accessCode: foundClient.accessCode,
        packageName: foundClient.packageName || foundClient.packageId,
        permissions: ROLE_PERMISSIONS[role],
      };
    }

    // 4. Check Valid Access Codes Repository (Hash-aware)
    const validCodes = await dbGetAccessCodes();
    const matchedCode = validCodes.find(
      (c: any) =>
        (c.accessCodeHash && c.accessCodeHash === candidateHash) ||
        (c.code && c.code.toUpperCase() === cleanUpper)
    );

    if (matchedCode) {
      const isVip = cleanUpper.includes('VIP') || cleanUpper.includes('ULTRA');
      const role: UserRole = isVip ? 'premium' : 'user';

      return {
        uid: `code_${cleanUpper}`,
        name: matchedCode.note || 'Pengguna Kode Akses',
        role,
        accessCode: matchedCode.code,
        permissions: ROLE_PERMISSIONS[role],
      };
    }
  }

  return null;
}

/**
 * Strict authentication middleware: rejects requests with 401 if unauthenticated,
 * or 403 if banned or suspended.
 */
export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const clientIp = extractClientIp(req);
  const fingerprint = (req.headers['x-device-fingerprint'] as string) || req.body?.fingerprint || '';
  const accessCode =
    (req.headers['x-access-code'] as string) ||
    (req.headers['x-client-access-code'] as string) ||
    req.body?.accessCode ||
    '';

  // Check banned devices/IPs
  const banCheck = isDeviceOrIpBanned(clientIp, fingerprint, accessCode);
  if (banCheck.banned) {
    await logAuthEvent('BANNED_ACCESS_ATTEMPT', req, `Akses ditolak: IP/Perangkat terblokir (${banCheck.reason})`, accessCode);
    return res.status(403).json({
      error: `Akses ditolak! Perangkat atau IP Anda telah diblokir secara permanen. Alasan: ${banCheck.reason}`,
      code: 'DEVICE_BANNED',
      isBanned: true,
    });
  }

  try {
    const user = await resolveUserFromRequest(req);
    if (!user) {
      await logAuthEvent('UNAUTHORIZED_ACCESS', req, `Percobaan akses endpoint terlindungi: ${req.method} ${req.originalUrl}`);
      return res.status(401).json({
        error: 'Unauthorized: Autentikasi diperlukan. Sediakan kode akses atau token yang valid.',
        code: 'AUTH_REQUIRED',
      });
    }

    req.user = user;
    next();
  } catch (err: any) {
    await logAuthEvent('LOGIN_FAILED', req, `Autentikasi gagal: ${err.message || err}`);
    return res.status(403).json({
      error: err.message || 'Akses ditolak.',
      code: 'AUTH_FORBIDDEN',
    });
  }
}

/**
 * Lenient authentication middleware: sets req.user if present,
 * but does not reject if unauthenticated.
 */
export async function optionalAuthenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const user = await resolveUserFromRequest(req);
    if (user) req.user = user;
  } catch (e) {}
  next();
}

// Backwards-compatibility aliases
export const requireAuth = authenticate;

export function requireAdminRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'owner')) {
    return res.status(403).json({ error: 'Akses ditolak. Endpoint ini membutuhkan hak akses Administrator.' });
  }
  next();
}

export function requireRole(roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Akses ditolak: role tidak memiliki izin.' });
    }
    next();
  };
}
