import { Response, NextFunction } from 'express';
import { type AuthenticatedRequest, type UserRole } from './auth.middleware';
import { logAdminActionEvent } from '@/server/core/security/auditLogService';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 5,
  admin: 4,
  moderator: 3,
  premium: 2,
  user: 1,
};

/**
 * Ensures the user has one of the specified allowed roles, or is an owner.
 */
export function requireRoles(...allowedRoles: UserRole[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized: Sesi tidak ditemukan. Silakan login kembali.',
        code: 'UNAUTHENTICATED',
      });
    }

    if (req.user.role === 'owner') {
      return next(); // Owner has universal bypass
    }

    if (!allowedRoles.includes(req.user.role)) {
      await logAdminActionEvent(
        'ACCESS_DENIED_ROLE',
        req,
        `Role '${req.user.role}' tidak memiliki izin untuk akses ${req.method} ${req.originalUrl}. Diperlukan salah satu dari: ${allowedRoles.join(', ')}`,
        req.user.name || req.user.email
      );

      return res.status(403).json({
        error: `Forbidden: Peran '${req.user.role}' tidak diizinkan mengakses resource ini. Dibutuhkan peran: ${allowedRoles.join(', ')}.`,
        code: 'INSUFFICIENT_ROLE',
        userRole: req.user.role,
        requiredRoles: allowedRoles,
      });
    }

    next();
  };
}

/**
 * Ensures the user meets a minimum tier level in the hierarchy.
 */
export function requireMinimumRole(minRole: UserRole) {
  const minLevel = ROLE_HIERARCHY[minRole] || 1;

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized: Sesi tidak ditemukan.',
        code: 'UNAUTHENTICATED',
      });
    }

    const currentLevel = ROLE_HIERARCHY[req.user.role] || 0;
    if (currentLevel < minLevel) {
      await logAdminActionEvent(
        'ACCESS_DENIED_TIER',
        req,
        `Role tier ${currentLevel} (${req.user.role}) di bawah minimum tier ${minLevel} (${minRole}) untuk ${req.method} ${req.originalUrl}`,
        req.user.name || req.user.email
      );

      return res.status(403).json({
        error: `Forbidden: Level otorisasi tidak mencukupi. Dibutuhkan minimal level '${minRole}'.`,
        code: 'INSUFFICIENT_ROLE_TIER',
      });
    }

    next();
  };
}

// Convenient pre-configured role gates
export const requireOwner = requireRoles('owner');
export const requireAdmin = requireRoles('owner', 'admin');
export const requireModerator = requireRoles('owner', 'admin', 'moderator');
export const requirePremium = requireRoles('owner', 'admin', 'moderator', 'premium');
export const requireUser = requireRoles('owner', 'admin', 'moderator', 'premium', 'user');

// Backwards-compatibility alias for existing code
export const requireAdminRole = requireAdmin;
