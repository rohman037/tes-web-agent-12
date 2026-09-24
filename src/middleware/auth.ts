import { Request, Response, NextFunction } from 'express';
import {
  authenticate as baseAuthenticate,
  AuthenticatedRequest,
  UserRole,
  AuthenticatedUser,
} from '@/server/middleware/auth.middleware';
import { requireAdminRole as baseRequireAdminRole } from '@/server/middleware/role.middleware';

export interface AuthRequest extends AuthenticatedRequest {
  user?: any;
}

export const requireAdminRole = baseRequireAdminRole;
export const requireAuth = baseAuthenticate;
export type { UserRole, AuthenticatedUser };

