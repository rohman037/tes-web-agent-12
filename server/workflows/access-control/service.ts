import {
  dbGetPackages,
  dbSavePackage,
  dbDeletePackage,
  dbGetAccessCodes,
  dbSaveAccessCode,
  dbDeleteAccessCode,
  dbGetAuditLogs,
  dbAddAuditLog,
  dbGetBannedDevices,
  dbGetClients,
  dbSaveClient,
  dbDeleteClient,
} from '@/src/db/dbService';
import {
  broadcastLiveEvent,
  activeGenerationsMap,
  sseClients,
} from '@/server/core/state/serverState';
import {
  isDeviceOrIpBanned,
  banDeviceOrIp,
  unbanDeviceOrIp,
  bannedDevicesMap,
  failedLoginTracker,
} from '@/server/core/security/deviceSecurity';
import { validateAdminCredential, hashCredential } from '@/server/core/security/secretManager';
import {
  recordUserPresence,
  removeUserPresence,
  getActiveSessionsList,
  activePresenceSessions,
} from '@/server/core/security/presence';
import { AuditLogItem } from '@/src/types';
import { logger } from '@/server/core/utils/logger';

// --- PACKAGES SERVICE ---
export async function getPackagesService() {
  return await dbGetPackages();
}

export async function updatePackagesService(packagesList: any[]) {
  if (!Array.isArray(packagesList)) {
    throw new Error('Payload paket harus berupa array');
  }

  // Retrieve existing packages to identify deleted packages
  try {
    const existing = await dbGetPackages();
    if (Array.isArray(existing)) {
      const newIds = new Set(packagesList.map((p: any) => p.id).filter(Boolean));
      for (const oldPkg of existing) {
        if (oldPkg?.id && !newIds.has(oldPkg.id)) {
          await dbDeletePackage(oldPkg.id);
        }
      }
    }
  } catch (err) {
    logger.warn('[updatePackagesService] Failed to clean up removed packages:', err);
  }

  for (const item of packagesList) {
    if (item && item.id) {
      await dbSavePackage(item);
    }
  }

  broadcastLiveEvent({ type: 'packages_updated', packages: packagesList });
  return packagesList;
}

// --- ACCESS CODES SERVICE ---
export async function getAccessCodesService() {
  return await dbGetAccessCodes();
}

export async function createAccessCodeService(code: string, note?: string) {
  if (!code) throw new Error('Kode akses tidak boleh kosong');
  const cleanCode = code.trim().toUpperCase();
  const list = await dbGetAccessCodes();
  const existingIdx = list.findIndex((item) => item.code && item.code.toUpperCase() === cleanCode);
  const newItem = {
    code: cleanCode,
    note: note || 'Akses Satset',
    createdAt: Date.now(),
  };
  if (existingIdx >= 0) {
    list[existingIdx] = { ...list[existingIdx], ...newItem };
  } else {
    list.unshift(newItem);
  }

  await dbSaveAccessCode(newItem);
  broadcastLiveEvent({ type: 'access_codes_updated', accessCodes: list });
  return { list, item: newItem };
}

export async function removeAccessCodeService(code: string) {
  if (!code) throw new Error('Kode akses tidak boleh kosong');
  const cleanCode = code.trim().toUpperCase();
  await dbDeleteAccessCode(cleanCode);
  const list = (await dbGetAccessCodes()).filter((item) => item.code && item.code.toUpperCase() !== cleanCode);
  broadcastLiveEvent({ type: 'access_codes_updated', accessCodes: list });
  return list;
}

// --- AUDIT LOGS SERVICE ---
export async function getAuditLogsService() {
  const logs = await dbGetAuditLogs();
  return logs || [];
}

export async function addAuditLogService(data: {
  action: string;
  details?: string;
  category?: string;
  adminName?: string;
  actor?: string;
  clientIp?: string;
  userAgent?: string;
}) {
  const { action, details, category, adminName, actor, clientIp = 'unknown', userAgent = 'Web Browser' } = data;
  if (!action) {
    throw new Error('Action is required');
  }

  const logItem: AuditLogItem = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    adminName: actor || adminName || 'System',
    action: String(action).trim(),
    details: details || `Aktivitas tercatat dari IP: ${clientIp} • Browser: ${userAgent.slice(0, 80)}`,
    timestamp: new Date().toISOString(),
    category: (category as any) || 'system',
  };

  await dbAddAuditLog(logItem);

  try {
    const currentLogs = await dbGetAuditLogs();
    broadcastLiveEvent({
      type: 'audit_log_event',
      log: logItem,
      auditLogs: currentLogs,
    });
    broadcastLiveEvent({ type: 'audit_logs_updated', auditLogs: currentLogs } as any);
  } catch (e) {
    logger.error('Audit broadcast error:', e);
  }

  return logItem;
}

// --- SECURITY & BAN SERVICE ---
export function checkBannedService(ip: string, fingerprint?: string, accessCode?: string) {
  return isDeviceOrIpBanned(ip, fingerprint, accessCode);
}

export async function reportViolationService(details: {
  violationType?: string;
  details?: string;
  fingerprint?: string;
  accessCode?: string;
  clientIp: string;
}) {
  const reason = `Otomatis Diblokir oleh Security System (${details.violationType || 'TAMPERING_DETECTED'}): ${details.details || 'Aktivitas mencurigakan di browser'}`;
  const banned = await banDeviceOrIp({
    fingerprint: details.fingerprint,
    ip: details.clientIp,
    accessCode: details.accessCode,
    reason,
    bannedBy: 'SYSTEM_SECURITY_GUARD',
  });

  return { banned, reason };
}

export async function getBannedDevicesService() {
  const list = await dbGetBannedDevices();
  return list || Array.from(bannedDevicesMap.values());
}

export async function banDeviceManualService(details: {
  fingerprint?: string;
  ip?: string;
  accessCode?: string;
  reason?: string;
}) {
  if (!details.fingerprint && !details.ip && !details.accessCode) {
    throw new Error('Sediakan Fingerprint, IP, atau Kode Akses untuk diblokir.');
  }

  return await banDeviceOrIp({
    fingerprint: details.fingerprint,
    ip: details.ip || '0.0.0.0',
    accessCode: details.accessCode,
    reason: details.reason || 'Manual Ban oleh Super Admin',
    bannedBy: 'SUPER_ADMIN',
  });
}

export async function unbanDeviceService(key: string, fingerprint?: string, ip?: string) {
  if (!key) {
    throw new Error('Sediakan ID atau Key perangkat untuk di-unban.');
  }
  await unbanDeviceOrIp(key, fingerprint, ip);
  return { success: true };
}

// --- ACTIVE GENERATIONS FORCE STOP ---
export async function stopActiveGenerationService(taskId: string, banUser?: boolean) {
  if (!taskId) throw new Error('taskId required');

  const task = activeGenerationsMap.get(taskId);
  if (task) {
    task.status = 'failed';
    task.updatedAt = Date.now();
    activeGenerationsMap.set(taskId, task);

    if (banUser && (task.ip || task.deviceFingerprint || task.accessCode)) {
      await banDeviceOrIp({
        fingerprint: task.deviceFingerprint,
        ip: task.ip,
        accessCode: task.accessCode,
        reason: `Dihentikan & Dibanned oleh Admin saat generate (${task.tool || 'Generasi AI'})`,
        bannedBy: 'ADMIN_FORCE_STOP',
      });
    }

    setTimeout(() => {
      activeGenerationsMap.delete(taskId);
      broadcastLiveEvent({
        type: 'active_status_update',
        activeGenerations: Array.from(activeGenerationsMap.values()),
        activeUserCount: sseClients.size,
      });
    }, 3000);
  }

  broadcastLiveEvent({
    type: 'active_status_update',
    activeGenerations: Array.from(activeGenerationsMap.values()),
    activeUserCount: sseClients.size,
  });

  return { success: true };
}

// --- PRESENCE SERVICE ---
export function handleHeartbeatService(session: { accessCode: string; name?: string; role?: string; ip: string; userAgent: string }) {
  if (!session.accessCode) {
    throw new Error('accessCode is required');
  }
  recordUserPresence(session);
  return { success: true, activeCount: activePresenceSessions.size };
}

export function getActivePresenceSessionsService() {
  return getActiveSessionsList();
}

// --- VERIFY ACCESS CODE & LOGIN SERVICE ---
export async function verifyAccessCodeService(data: {
  accessCode?: string;
  fingerprint?: string;
  userAgent?: string;
  ip: string;
}) {
  const { fingerprint, userAgent = 'Web Browser', ip } = data;
  const cleaned = String(data.accessCode || '').trim().toUpperCase();

  // 1. Check if IP, Fingerprint or Code is banned
  const banCheck = isDeviceOrIpBanned(ip, fingerprint, cleaned);
  if (banCheck.banned) {
    const banLogItem: AuditLogItem = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      adminName: cleaned ? `Aktor Terblokir (${cleaned})` : 'Perangkat Terblokir',
      action: 'Login Ditolak (Device Banned)',
      details: `Upaya login dari IP/Perangkat yang telah diblokir permanen (${banCheck.reason}) • IP: ${ip}`,
      timestamp: new Date().toISOString(),
      category: 'system',
    };
    await dbAddAuditLog(banLogItem);
    try {
      const currentLogs = await dbGetAuditLogs();
      broadcastLiveEvent({ type: 'audit_log_event', log: banLogItem, auditLogs: currentLogs });
      broadcastLiveEvent({ type: 'audit_logs_updated' } as any);
    } catch (e) {}

    return {
      status: 403,
      body: {
        success: false,
        isBanned: true,
        error: `Akses Anda ditolak! Device/IP ini telah diblokir secara permanen oleh Sistem Keamanan. Alasan: ${banCheck.reason}`,
      },
    };
  }

  if (!cleaned) {
    const emptyLogItem: AuditLogItem = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      adminName: 'Pengguna Tanpa Kode',
      action: 'Login Gagal (Input Kosong)',
      details: `Percobaan submit form login dengan kode kosong dari IP: ${ip}`,
      timestamp: new Date().toISOString(),
      category: 'system',
    };
    await dbAddAuditLog(emptyLogItem);
    try {
      const currentLogs = await dbGetAuditLogs();
      broadcastLiveEvent({ type: 'audit_log_event', log: emptyLogItem, auditLogs: currentLogs });
      broadcastLiveEvent({ type: 'audit_logs_updated' } as any);
    } catch (e) {}

    return {
      status: 400,
      body: { success: false, error: 'Masukkan Kode Akses Anda.' },
    };
  }

  const trackerKey = `${ip}_${fingerprint || 'nofp'}`;
  const nowTs = Date.now();
  const prevAttempts = failedLoginTracker.get(trackerKey) || { count: 0, lastAttempt: nowTs };

  if (nowTs - prevAttempts.lastAttempt > 300000) {
    prevAttempts.count = 0;
  }

  // 2. MASTER ADMIN / OWNER LOGIN VIA ENTERPRISE SECRET MANAGER
  const adminValidation = validateAdminCredential(cleaned);
  if (adminValidation.isValid) {
    failedLoginTracker.delete(trackerKey);
    const isOwner = adminValidation.role === 'owner';
    const displayName = isOwner ? 'Super Admin (David)' : 'Administrator';
    const adminCode = cleaned;
    const isEmail = cleaned.includes('@');
    const adminEmail = isEmail ? cleaned.toLowerCase() : 'davidrohman037@gmail.com';

    recordUserPresence({
      accessCode: adminCode,
      name: displayName,
      role: 'admin',
      ip,
      userAgent,
    });

    const logItem: AuditLogItem = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      adminName: `${displayName}`,
      action: 'Login Berhasil',
      details: `Otentikasi ${displayName} (${adminEmail}) sukses dari IP: ${ip} • Browser: ${userAgent.slice(0, 80)}`,
      timestamp: new Date().toISOString(),
      category: 'system',
    };
    await dbAddAuditLog(logItem);
    try {
      const currentLogs = await dbGetAuditLogs();
      broadcastLiveEvent({ type: 'audit_log_event', log: logItem, auditLogs: currentLogs });
      broadcastLiveEvent({ type: 'audit_logs_updated' } as any);
    } catch (e) {}

    return {
      status: 200,
      body: {
        success: true,
        role: 'admin',
        name: displayName,
        email: adminEmail,
        code: adminCode,
        serverTimestamp: Date.now(),
        serverTimeIso: new Date().toISOString(),
      },
    };
  }

  // 3. REGISTERED CLIENT LOGIN (HASH-AWARE & STRICT EXPIRY CHECK)
  const candidateHash = hashCredential(cleaned);
  const clients = await dbGetClients();
  const client = clients.find(
    (c) =>
      (c.accessCodeHash && c.accessCodeHash === candidateHash) ||
      (c.accessCode && c.accessCode.trim().toUpperCase() === cleaned)
  );

  if (client) {
    const now = Date.now();
    const expiry = client.expiryDate ? new Date(client.expiryDate).getTime() : 0;
    let calculatedStatus = client.status || 'active';
    
    // Check if 30-day or custom duration has passed
    if (calculatedStatus !== 'suspended') {
      if (expiry > 0 && expiry <= now) {
        calculatedStatus = 'expired';
      }
    }

    if (calculatedStatus === 'suspended') {
      const logItem: AuditLogItem = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        adminName: `${client.name || 'Klien Satset'} (${cleaned})`,
        action: 'Login Ditolak (Ditangguhkan)',
        details: `Akses ditolak karena akun dalam status ditangguhkan/suspended • IP: ${ip}`,
        timestamp: new Date().toISOString(),
        category: 'client',
      };
      await dbAddAuditLog(logItem);
      try {
        const currentLogs = await dbGetAuditLogs();
        broadcastLiveEvent({ type: 'audit_log_event', log: logItem, auditLogs: currentLogs });
        broadcastLiveEvent({ type: 'audit_logs_updated' } as any);
      } catch (e) {}

      return {
        status: 200,
        body: {
          success: false,
          error: 'Akses Anda saat ini ditangguhkan. Silakan hubungi administrator.',
        },
      };
    }

    if (calculatedStatus === 'expired') {
      // Auto-update client status to expired in database and revoke code
      client.status = 'expired';
      await dbSaveClient(client);
      if (client.accessCode) {
        await dbDeleteAccessCode(client.accessCode);
      }

      const logItem: AuditLogItem = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        adminName: `${client.name || 'Klien Satset'} (${cleaned})`,
        action: 'Login Ditolak (Masa Aktif Habis)',
        details: `Akses ditolak karena durasi aktif (30 hari / paket) telah kedaluwarsa (${client.expiryDate ? new Date(client.expiryDate).toLocaleDateString('id-ID') : 'Expired'}). Kode otomatis dinonaktifkan • IP: ${ip}`,
        timestamp: new Date().toISOString(),
        category: 'client',
      };
      await dbAddAuditLog(logItem);
      try {
        const currentLogs = await dbGetAuditLogs();
        broadcastLiveEvent({ type: 'audit_log_event', log: logItem, auditLogs: currentLogs });
        broadcastLiveEvent({ type: 'clients_updated', clients: await dbGetClients() });
        broadcastLiveEvent({ type: 'access_codes_updated', accessCodes: await dbGetAccessCodes() });
      } catch (e) {}

      return {
        status: 200,
        body: {
          success: false,
          isExpired: true,
          error: `Masa aktif kode akses Anda (${client.packageName || 'Paket'} - 30 Hari) telah habis/kedaluwarsa. Akun otomatis dinonaktifkan. Silakan hubungi admin untuk perpanjang masa aktif.`,
        },
      };
    }

    // Reset failed logins on success
    failedLoginTracker.delete(trackerKey);

    // Record Presence
    recordUserPresence({
      accessCode: client.accessCode,
      name: client.name || 'Klien Satset',
      role: 'user',
      ip,
      userAgent,
    });

    client.lastLoginAt = new Date().toISOString();
    await dbSaveClient(client);
    broadcastLiveEvent({ type: 'clients_updated', clients: await dbGetClients() });

    const logItem: AuditLogItem = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      adminName: `${client.name || 'Klien Satset'} (${cleaned})`,
      action: 'Login Berhasil',
      details: `Login pengguna sukses • Paket: ${client.packageName || client.packageId || 'VIP'} • IP: ${ip} • Masa Aktif Hingga: ${client.expiryDate ? new Date(client.expiryDate).toLocaleDateString('id-ID') : 'Lifetime'}`,
      timestamp: new Date().toISOString(),
      category: 'client',
    };
    await dbAddAuditLog(logItem);
    try {
      const currentLogs = await dbGetAuditLogs();
      broadcastLiveEvent({ type: 'audit_log_event', log: logItem, auditLogs: currentLogs });
      broadcastLiveEvent({ type: 'audit_logs_updated' } as any);
    } catch (e) {}

    return {
      status: 200,
      body: {
        success: true,
        role: 'user',
        code: client.accessCode,
        name: client.name || 'Klien Satset',
        email: client.email || '',
        expiryDate: client.expiryDate,
        serverTimestamp: Date.now(),
        serverTimeIso: new Date().toISOString(),
      },
    };
  }

  // 4. ACCESS CODE POOL LOGIN (WITH STRICT CLIENT LINK & EXPIRATION AUDIT)
  const accessCodes = await dbGetAccessCodes();
  const matchedCode = accessCodes.find(
    (item) =>
      (item.accessCodeHash && item.accessCodeHash === candidateHash) ||
      (item.code && item.code.trim().toUpperCase() === cleaned)
  );

  if (matchedCode) {
    // Cross-check with clients table: If this code belongs to an expired client, reject!
    const linkedClient = clients.find(c => c.accessCode && c.accessCode.trim().toUpperCase() === cleaned);
    if (linkedClient) {
      const now = Date.now();
      const expiry = linkedClient.expiryDate ? new Date(linkedClient.expiryDate).getTime() : 0;
      if (linkedClient.status === 'expired' || (expiry > 0 && expiry <= now)) {
        await dbDeleteAccessCode(matchedCode.code);
        return {
          status: 200,
          body: {
            success: false,
            isExpired: true,
            error: 'Masa aktif kode akses Anda telah habis. Akun otomatis dinonaktifkan. Silakan perpanjang paket Anda.',
          },
        };
      }
    }

    failedLoginTracker.delete(trackerKey);

    recordUserPresence({
      accessCode: matchedCode.code,
      name: matchedCode.note || 'Klien Satset',
      role: 'user',
      ip,
      userAgent,
    });

    const logItem: AuditLogItem = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      adminName: `${matchedCode.note || 'User Kode Akses'} (${cleaned})`,
      action: 'Login Berhasil',
      details: `Login kode akses terdaftar sukses (${matchedCode.note || 'Akses Terverifikasi'}) • IP: ${ip}`,
      timestamp: new Date().toISOString(),
      category: 'client',
    };
    await dbAddAuditLog(logItem);
    try {
      const currentLogs = await dbGetAuditLogs();
      broadcastLiveEvent({ type: 'audit_log_event', log: logItem, auditLogs: currentLogs });
      broadcastLiveEvent({ type: 'audit_logs_updated' } as any);
    } catch (e) {}

    return {
      status: 200,
      body: {
        success: true,
        role: 'user',
        code: matchedCode.code,
        name: matchedCode.note || 'Klien Satset',
        serverTimestamp: Date.now(),
        serverTimeIso: new Date().toISOString(),
      },
    };
  }

  // 5. FAILED LOGIN ATTEMPT
  const currentCount = prevAttempts.count + 1;
  failedLoginTracker.set(trackerKey, { count: currentCount, lastAttempt: nowTs });

  if (currentCount >= 5) {
    const banReason = `Otomatis Diblokir (Brute Force Login): 5x percobaan kode salah '${cleaned}' dari IP ${ip}`;
    await banDeviceOrIp({
      fingerprint,
      ip,
      accessCode: cleaned,
      reason: banReason,
      bannedBy: 'SYSTEM_BRUTE_FORCE_PROTECTOR',
    });

    const banLogItem: AuditLogItem = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      adminName: `Pelaku Brute Force (${cleaned})`,
      action: 'Login Ditolak (Auto-Banned)',
      details: `Perangkat/IP diblokir otomatis setelah 5x gagal login dengan kode salah • IP: ${ip}`,
      timestamp: new Date().toISOString(),
      category: 'system',
    };
    await dbAddAuditLog(banLogItem);
    try {
      const currentLogs = await dbGetAuditLogs();
      broadcastLiveEvent({ type: 'audit_log_event', log: banLogItem, auditLogs: currentLogs });
      broadcastLiveEvent({ type: 'audit_logs_updated' } as any);
    } catch (e) {}

    return {
      status: 403,
      body: {
        success: false,
        isBanned: true,
        error: `PERANGKAT DIBLOKIR PERMANEN! Anda telah melakukan 5 kali percobaan kode salah. Akses ditolak.`,
      },
    };
  }

  const failedLogItem: AuditLogItem = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    adminName: `Tamu Tidak Terdaftar (${cleaned})`,
    action: 'Login Gagal (Kode Salah)',
    details: `Percobaan kode tidak terdaftar (Percobaan ke-${currentCount} dari batas 5) • IP: ${ip}`,
    timestamp: new Date().toISOString(),
    category: 'system',
  };
  await dbAddAuditLog(failedLogItem);
  try {
    const currentLogs = await dbGetAuditLogs();
    broadcastLiveEvent({ type: 'audit_log_event', log: failedLogItem, auditLogs: currentLogs });
    broadcastLiveEvent({ type: 'audit_logs_updated' } as any);
  } catch (e) {}

  return {
    status: 200,
    body: {
      success: false,
      error: `Kode Akses tidak terdaftar atau salah. (${currentCount}/5 batas percobaan sebelum Device Banned)`,
    },
  };
}

// --- LOGOUT SERVICE ---
export async function logoutService(data: { accessCode?: string; name?: string; role?: string; ip: string }) {
  const { accessCode, name, role, ip } = data;
  const code = String(accessCode || '').trim();

  if (code || name) {
    if (code) {
      removeUserPresence(code, ip);
    }
    const logoutLogItem: AuditLogItem = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      adminName: name ? `${name} (${code || 'Sesi'})` : (code || 'Pengguna'),
      action: 'Logout Sesi',
      details: `Pengguna resmi mengakhiri sesi login dari IP: ${ip}`,
      timestamp: new Date().toISOString(),
      category: role === 'admin' ? 'system' : 'client',
    };
    await dbAddAuditLog(logoutLogItem);
    try {
      const currentLogs = await dbGetAuditLogs();
      broadcastLiveEvent({ type: 'audit_log_event', log: logoutLogItem, auditLogs: currentLogs });
      broadcastLiveEvent({ type: 'audit_logs_updated' } as any);
    } catch (e) {}
  }
}

// --- CLIENTS MANAGEMENT SERVICE ---
export async function getClientsService() {
  return await dbGetClients();
}

export async function updateClientsService(clients: any[]) {
  if (!Array.isArray(clients)) {
    throw new Error('Payload clients harus berupa array');
  }

  const previousClients = await dbGetClients();
  const existing = await dbGetClients();
  const newIds = new Set(clients.map((c: any) => c.id).filter(Boolean));
  for (const oldCli of existing) {
    if (oldCli?.id && !newIds.has(oldCli.id)) {
      await dbDeleteClient(oldCli.id);
    }
  }
  for (const c of clients) {
    await dbSaveClient(c);
  }

  // Auto-sync client access codes: add new ones and purge removed ones
  try {
    const accessCodesList = await dbGetAccessCodes();
    const activeClientCodes = new Set(
      clients.map((c: any) => String(c?.accessCode || '').trim().toUpperCase()).filter(Boolean)
    );
    const previousClientCodes = new Set(
      previousClients.map((c: any) => String(c?.accessCode || '').trim().toUpperCase()).filter(Boolean)
    );

    const deletedCodes = [...previousClientCodes].filter((code) => !activeClientCodes.has(code));

    let updatedAccessCodes = accessCodesList.filter(
      (item) => !deletedCodes.includes(String(item.code || '').trim().toUpperCase())
    );

    let codesChanged = updatedAccessCodes.length !== accessCodesList.length;

    clients.forEach((c: any) => {
      if (c && c.accessCode) {
        const cleanCode = String(c.accessCode).trim().toUpperCase();
        const existingIdx = updatedAccessCodes.findIndex((item) => item.code && item.code.toUpperCase() === cleanCode);
        if (existingIdx === -1) {
          updatedAccessCodes.unshift({
            code: cleanCode,
            note: `Client ${c.name || 'Custom'} (${c.packageName || 'Satset'})`,
            createdAt: Date.now(),
          });
          codesChanged = true;
        }
      }
    });

    if (codesChanged) {
      for (const codeItem of updatedAccessCodes) {
        await dbSaveAccessCode(codeItem);
      }
      broadcastLiveEvent({ type: 'access_codes_updated', accessCodes: updatedAccessCodes });
    }
  } catch (err) {
    logger.warn('[Clients Server] Failed syncing client access codes:', err);
  }

  broadcastLiveEvent({ type: 'clients_updated', clients });
  return clients;
}
