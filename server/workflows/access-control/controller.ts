import { Request, Response } from 'express';
import { handleApiError } from '@/server/core/utils/errorHandler';
import {
  getPackagesService,
  updatePackagesService,
  getAccessCodesService,
  createAccessCodeService,
  removeAccessCodeService,
  getAuditLogsService,
  addAuditLogService,
  checkBannedService,
  reportViolationService,
  getBannedDevicesService,
  banDeviceManualService,
  unbanDeviceService,
  stopActiveGenerationService,
  handleHeartbeatService,
  getActivePresenceSessionsService,
  verifyAccessCodeService,
  logoutService,
  getClientsService,
  updateClientsService,
} from './service';

export async function getServerTimeController(req: Request, res: Response) {
  const now = Date.now();
  return res.json({
    success: true,
    serverTimestamp: now,
    serverTimeIso: new Date(now).toISOString(),
  });
}

// Packages
export async function getPackagesController(req: Request, res: Response) {
  try {
    const list = await getPackagesService();
    return res.json(list);
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function updatePackagesController(req: Request, res: Response) {
  try {
    const updated = await updatePackagesService(req.body);
    return res.json({ success: true, packages: updated });
  } catch (err) {
    return handleApiError(res, err);
  }
}

// Access Codes
export async function getAccessCodesController(req: Request, res: Response) {
  try {
    const list = await getAccessCodesService();
    return res.json(list);
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function createAccessCodeController(req: Request, res: Response) {
  try {
    const { code, note } = req.body || {};
    const { list, item } = await createAccessCodeService(code, note);
    return res.json({ success: true, accessCodes: list, item });
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function removeAccessCodeController(req: Request, res: Response) {
  try {
    const { code } = req.body || {};
    const list = await removeAccessCodeService(code);
    return res.json({ success: true, accessCodes: list });
  } catch (err) {
    return handleApiError(res, err);
  }
}

// Audit Logs
export async function getAuditLogsController(req: Request, res: Response) {
  try {
    const logs = await getAuditLogsService();
    return res.json(logs);
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function createAuditLogController(req: Request, res: Response) {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = (req.headers['user-agent'] as string) || 'Web Browser';
    const { action, details, category, adminName, actor } = req.body || {};

    const logItem = await addAuditLogService({
      action,
      details,
      category,
      adminName,
      actor,
      clientIp,
      userAgent,
    });
    return res.json({ success: true, log: logItem });
  } catch (err) {
    return handleApiError(res, err);
  }
}

// Security Check & Ban
export function checkBannedController(req: Request, res: Response) {
  const clientIp = req.ip || req.socket.remoteAddress || '';
  const fingerprint = (req.headers['x-device-fingerprint'] as string) || req.body?.fingerprint || '';
  const accessCode = (req.headers['x-access-code'] as string) || req.body?.accessCode || '';

  const check = checkBannedService(clientIp, fingerprint, accessCode);
  if (check.banned) {
    return res.status(403).json({
      isBanned: true,
      error: `Akses Ditolak! Perangkat atau IP Anda telah diblokir secara permanen oleh Sistem Keamanan Server (Device Banned). Alasan: ${check.reason || 'Pelanggaran Akses'}.`,
      reason: check.reason,
    });
  }

  return res.json({ isBanned: false });
}

export async function reportViolationController(req: Request, res: Response) {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const { violationType, details, fingerprint, accessCode } = req.body || {};

    const { banned, reason } = await reportViolationService({
      violationType,
      details,
      fingerprint,
      accessCode,
      clientIp,
    });

    return res.status(403).json({
      success: false,
      isBanned: true,
      error: `Perangkat Anda telah diblokir otomatis oleh Security Guard Server! Alasan: ${reason}`,
      bannedItem: banned,
    });
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function getBannedDevicesController(req: Request, res: Response) {
  try {
    const list = await getBannedDevicesService();
    return res.json(list);
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function banDeviceManualController(req: Request, res: Response) {
  try {
    const { fingerprint, ip, accessCode, reason } = req.body || {};
    const item = await banDeviceManualService({ fingerprint, ip, accessCode, reason });
    return res.json({ success: true, bannedDevice: item, message: 'Device/IP berhasil diblokir secara permanen.' });
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function unbanDeviceController(req: Request, res: Response) {
  try {
    const { id, fingerprint, ip } = req.body || {};
    const key = id || fingerprint || ip;
    await unbanDeviceService(key, fingerprint, ip);
    return res.json({ success: true, message: 'Blokir perangkat berhasil dibuka.' });
  } catch (err) {
    return handleApiError(res, err);
  }
}

// Active Generation Stop
export async function stopActiveGenerationController(req: Request, res: Response) {
  try {
    const { taskId, banUser } = req.body || {};
    const result = await stopActiveGenerationService(taskId, banUser);
    return res.json({ ...result, message: 'Generasi berhasil dibatalkan.' });
  } catch (err) {
    return handleApiError(res, err);
  }
}

// Presence
export function heartbeatController(req: Request, res: Response) {
  try {
    const { accessCode, name, role } = req.body || {};
    const ip = (req.ip || req.socket.remoteAddress || 'unknown').replace('::ffff:', '').trim();
    const userAgent = (req.headers['user-agent'] as string) || 'Web Browser';

    const result = handleHeartbeatService({ accessCode, name, role, ip, userAgent });
    return res.json(result);
  } catch (err) {
    return handleApiError(res, err);
  }
}

export function getPresenceController(req: Request, res: Response) {
  return res.json({
    success: true,
    activeSessions: getActivePresenceSessionsService(),
  });
}

// Verify Access Code
export async function verifyAccessCodeController(req: Request, res: Response) {
  try {
    const { accessCode, fingerprint, userAgent: reqUserAgent } = req.body || {};
    const ip = (req.ip || req.socket.remoteAddress || 'unknown').replace('::ffff:', '').trim();
    const userAgent = reqUserAgent || (req.headers['user-agent'] as string) || 'Web Browser';

    const result = await verifyAccessCodeService({ accessCode, fingerprint, userAgent, ip });
    return res.status(result.status).json(result.body);
  } catch (err) {
    return handleApiError(res, err);
  }
}

// Logout
export async function logoutController(req: Request, res: Response) {
  try {
    const { accessCode, name, role } = req.body || {};
    const ip = (req.ip || req.socket.remoteAddress || 'unknown').replace('::ffff:', '').trim();
    await logoutService({ accessCode, name, role, ip });
    return res.json({ success: true });
  } catch (err) {
    return handleApiError(res, err);
  }
}

// Clients
export async function getClientsController(req: Request, res: Response) {
  try {
    const clients = await getClientsService();
    return res.json(clients);
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function updateClientsController(req: Request, res: Response) {
  try {
    const clients = Array.isArray(req.body) ? req.body : (req.body?.clients || []);
    const updated = await updateClientsService(clients);
    return res.json({ success: true, clients: updated });
  } catch (err) {
    return handleApiError(res, err);
  }
}

// Firebase Token Verification with Custom Claims
export async function verifyFirebaseTokenController(req: Request, res: Response) {
  try {
    const { idToken } = req.body || {};
    if (!idToken) {
      return res.status(400).json({ success: false, error: 'Parameter "idToken" diperlukan.' });
    }
    const { adminAuth } = await import('@/src/lib/firebase-admin');
    const { validateAdminCredential } = await import('@/server/core/security/secretManager');
    const { setUserCustomClaims, ROLE_PERMISSIONS } = await import('@/server/core/security/customClaimsService');
    type UserRole = import('@/server/core/security/customClaimsService').UserRole;

    const decoded = await adminAuth.verifyIdToken(idToken);
    const email = (decoded.email || '').toLowerCase();

    let role: UserRole = (decoded.role || (decoded.admin ? 'admin' : 'user')) as UserRole;
    if (email) {
      const adminValidation = validateAdminCredential(email);
      if (adminValidation.isValid) {
        role = adminValidation.role === 'owner' ? 'owner' : 'admin';
        if (decoded.role !== role) {
          await setUserCustomClaims(decoded.uid, role);
        }
      }
    }

    const validRole: UserRole = ['owner', 'admin', 'moderator', 'premium', 'user'].includes(role)
      ? role
      : 'user';

    const permissions = decoded.permissions || ROLE_PERMISSIONS[validRole] || ['access_standard_ai'];

    return res.json({
      success: true,
      user: {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name || 'User',
        role: validRole,
        permissions,
      },
    });
  } catch (err: any) {
    return handleApiError(res, err);
  }
}

// Set User Role (Custom Claims)
export async function setUserRoleController(req: Request, res: Response) {
  try {
    const { uid, role, permissions } = req.body || {};
    if (!uid || !role) {
      return res.status(400).json({ success: false, error: 'Parameter "uid" dan "role" diperlukan.' });
    }
    const { setUserCustomClaims } = await import('@/server/core/security/customClaimsService');
    const result = await setUserCustomClaims(uid, role, permissions);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return handleApiError(res, err);
  }
}
