import { Router } from 'express';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { requireAdminRole } from '@/server/middleware/role.middleware';
import { authRateLimiter, adminActionRateLimiter } from '@/server/middleware/rateLimit.middleware';
import {
  getServerTimeController,
  getPackagesController,
  updatePackagesController,
  getAccessCodesController,
  createAccessCodeController,
  removeAccessCodeController,
  getAuditLogsController,
  createAuditLogController,
  checkBannedController,
  reportViolationController,
  getBannedDevicesController,
  banDeviceManualController,
  unbanDeviceController,
  stopActiveGenerationController,
  heartbeatController,
  getPresenceController,
  verifyAccessCodeController,
  logoutController,
  getClientsController,
  updateClientsController,
  verifyFirebaseTokenController,
  setUserRoleController,
} from './controller';

export const accessControlRouter = Router();

// Server-Authoritative Clock Synchronization Endpoint
accessControlRouter.get('/api/server-time', getServerTimeController);

// Packages (Public read, Admin write)
accessControlRouter.get('/api/packages', getPackagesController);
accessControlRouter.post('/api/admin/packages', requireAuth, requireAdminRole, adminActionRateLimiter, updatePackagesController);

// Access Codes (Strictly Admin only)
accessControlRouter.get('/api/access-codes', requireAuth, requireAdminRole, getAccessCodesController);
accessControlRouter.post('/api/access-codes', requireAuth, requireAdminRole, adminActionRateLimiter, createAccessCodeController);
accessControlRouter.post('/api/access-codes/remove', requireAuth, requireAdminRole, adminActionRateLimiter, removeAccessCodeController);

// Audit Logs (Strictly Admin only)
accessControlRouter.get('/api/admin/audit-logs', requireAuth, requireAdminRole, getAuditLogsController);
accessControlRouter.post('/api/admin/audit-logs', requireAuth, requireAdminRole, adminActionRateLimiter, createAuditLogController);

// Security & Banned Devices
accessControlRouter.post('/api/security/check-banned', checkBannedController);
accessControlRouter.post('/api/security/report-violation', reportViolationController);
accessControlRouter.get('/api/admin/banned-devices', requireAuth, requireAdminRole, getBannedDevicesController);
accessControlRouter.post('/api/admin/banned-devices', requireAuth, requireAdminRole, adminActionRateLimiter, banDeviceManualController);
accessControlRouter.post('/api/admin/banned-devices/unban', requireAuth, requireAdminRole, adminActionRateLimiter, unbanDeviceController);

// Active Generations Force-Stop (Admin only)
accessControlRouter.post('/api/admin/active-generations/stop', requireAuth, requireAdminRole, adminActionRateLimiter, stopActiveGenerationController);

// Presence & Heartbeat
accessControlRouter.post('/api/presence/heartbeat', heartbeatController);
accessControlRouter.get('/api/admin/presence', requireAuth, requireAdminRole, getPresenceController);

// Verification & Authentication (Guarded by Brute-Force Rate Limiter)
accessControlRouter.post('/api/verify-access-code', authRateLimiter, verifyAccessCodeController);
accessControlRouter.post('/api/auth/verify-firebase-token', authRateLimiter, verifyFirebaseTokenController);
accessControlRouter.post('/api/logout', logoutController);

// Custom Claims RBAC Management (Admin / Owner only)
accessControlRouter.post('/api/admin/set-user-role', requireAuth, requireAdminRole, adminActionRateLimiter, setUserRoleController);

// Clients (Strictly Admin only)
accessControlRouter.get(['/api/clients', '/api/admin/clients'], requireAuth, requireAdminRole, getClientsController);
accessControlRouter.post('/api/admin/clients', requireAuth, requireAdminRole, adminActionRateLimiter, updateClientsController);

