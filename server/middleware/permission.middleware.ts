import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, UserRole } from './auth.middleware';
import { logAdminActionEvent } from '@/server/core/security/auditLogService';

export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, string[]> = {
  owner: ['*'],
  admin: [
    'users:read', 'users:write',
    'clients:read', 'clients:write',
    'access_codes:read', 'access_codes:write',
    'packages:read', 'packages:write',
    'transactions:read', 'transactions:write', 'transactions:verify',
    'api_keys:read', 'api_keys:write', 'api_keys:test',
    'audit_logs:read', 'audit_logs:write',
    'configs:read', 'configs:write',
    'agents:read', 'agents:write',
    'devices:read', 'devices:ban',
    'ai:generate', 'ai:deep', 'ai:split',
    'backup:export', 'backup:restore',
    'history:read', 'history:write',
  ],
  moderator: [
    'clients:read',
    'transactions:read',
    'audit_logs:read',
    'devices:read', 'devices:ban',
    'ai:generate', 'ai:deep', 'ai:split',
    'history:read',
  ],
  premium: [
    'ai:generate', 'ai:deep', 'ai:split',
    'history:read', 'history:write',
  ],
  user: [
    'ai:generate',
    'history:read', 'history:write',
  ],
};

/**
 * Checks if a user has a specific permission (or wildcard '*').
 */
export function hasPermission(user: AuthenticatedRequest['user'], permission: string): boolean {
  if (!user) return false;
  if (user.role === 'owner') return true;

  const permissions = user.permissions && user.permissions.length > 0
    ? user.permissions
    : (ROLE_DEFAULT_PERMISSIONS[user.role] || []);

  if (permissions.includes('*')) return true;
  if (permissions.includes(permission)) return true;

  // Domain wildcard match (e.g. 'ai:*' matches 'ai:generate')
  const [domain] = permission.split(':');
  if (domain && permissions.includes(`${domain}:*`)) return true;

  return false;
}

/**
 * Middleware ensuring the authenticated user holds a specific permission.
 */
export function requirePermission(permission: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized: Sesi tidak valid.',
        code: 'UNAUTHENTICATED',
      });
    }

    if (!hasPermission(req.user, permission)) {
      await logAdminActionEvent(
        'ACCESS_DENIED_PERMISSION',
        req,
        `User ${req.user.name || req.user.email} (Role: ${req.user.role}) tidak memiliki izin '${permission}'`,
        req.user.name || req.user.email
      );

      return res.status(403).json({
        error: `Forbidden: Anda tidak memiliki izin '${permission}'.`,
        code: 'MISSING_PERMISSION',
        requiredPermission: permission,
      });
    }

    next();
  };
}

/**
 * Middleware ensuring the user holds at least one of the listed permissions.
 */
export function requireAnyPermission(...permissions: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized: Sesi tidak valid.',
        code: 'UNAUTHENTICATED',
      });
    }

    const permitted = permissions.some((p) => hasPermission(req.user, p));
    if (!permitted) {
      return res.status(403).json({
        error: `Forbidden: Diperlukan salah satu dari izin: ${permissions.join(', ')}.`,
        code: 'MISSING_ANY_PERMISSION',
      });
    }

    next();
  };
}
