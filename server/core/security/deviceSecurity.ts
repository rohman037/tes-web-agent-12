import {
  dbGetBannedDevices,
  dbSaveBannedDevice,
  dbDeleteBannedDevice,
  dbAddAuditLog,
  dbGetClients,
  dbSaveClient,
} from '@/src/db/dbService';
import { broadcastLiveEvent } from '@/server/core/state/serverState';
import { logger } from '@/server/core/utils/logger';

export interface BannedDeviceItem {
  id: string;
  fingerprint?: string;
  ip?: string;
  accessCode?: string;
  reason: string;
  bannedAt: string;
  bannedBy: string;
}

export const bannedDevicesMap = new Map<string, BannedDeviceItem>();
export const failedLoginTracker = new Map<string, { count: number; lastAttempt: number }>();

export async function loadBannedDevicesServer() {
  try {
    const list = await dbGetBannedDevices();
    if (Array.isArray(list)) {
      for (const item of list) {
        const key = item.id || item.fingerprint || item.ip;
        if (key) bannedDevicesMap.set(key, item);
      }
    }
  } catch (e) {
    logger.warn('[Security Engine] Failed loading banned devices from DB:', e);
  }
}

export const loadBannedDevices = loadBannedDevicesServer;

export function isDeviceOrIpBanned(ip: string, fingerprint?: string, accessCode?: string): { banned: boolean; reason?: string } {
  const cleanIp = (ip || '').replace('::ffff:', '').trim();
  const cleanFp = (fingerprint || '').trim();
  const cleanCode = (accessCode || '').trim().toUpperCase();

  for (const item of bannedDevicesMap.values()) {
    if (cleanFp && item.fingerprint && item.fingerprint === cleanFp) {
      return { banned: true, reason: item.reason || 'Perangkat (Fingerprint) ini telah diblokir secara permanen oleh Sistem Keamanan.' };
    }
    if (cleanIp && item.ip && item.ip === cleanIp) {
      return { banned: true, reason: item.reason || 'Alamat IP Anda telah diblokir secara permanen.' };
    }
    if (cleanCode && item.accessCode && item.accessCode.toUpperCase() === cleanCode) {
      return { banned: true, reason: item.reason || 'Kode Akses ini telah diblokir karena aktivitas mencurigakan.' };
    }
  }

  return { banned: false };
}

export async function banDeviceOrIp(details: { fingerprint?: string; ip: string; accessCode?: string; reason: string; bannedBy?: string }) {
  const id = `ban_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const bannedItem: BannedDeviceItem = {
    id,
    fingerprint: details.fingerprint || '',
    ip: (details.ip || '').replace('::ffff:', '').trim(),
    accessCode: details.accessCode ? details.accessCode.trim().toUpperCase() : '',
    reason: details.reason || 'Pelanggaran keamanan / Konsol terdeteksi',
    bannedAt: new Date().toISOString(),
    bannedBy: details.bannedBy || 'SYSTEM_AUTO_BAN',
  };

  bannedDevicesMap.set(id, bannedItem);
  if (bannedItem.fingerprint) bannedDevicesMap.set(bannedItem.fingerprint, bannedItem);
  if (bannedItem.ip) bannedDevicesMap.set(bannedItem.ip, bannedItem);
  if (bannedItem.accessCode) bannedDevicesMap.set(bannedItem.accessCode, bannedItem);

  try {
    await dbSaveBannedDevice(bannedItem);
  } catch (e) {
    logger.warn('[Security Engine] Failed saving banned device to DB:', e);
  }

  if (bannedItem.accessCode) {
    try {
      const clients = await dbGetClients();
      const cli = clients.find((c) => c.accessCode && c.accessCode.toUpperCase() === bannedItem.accessCode);
      if (cli) {
        cli.status = 'suspended';
        await dbSaveClient(cli);
        broadcastLiveEvent({ type: 'clients_updated', clients: await dbGetClients() });
      }
    } catch (e) {
      logger.warn('[Security Engine] Failed suspending client on ban:', e);
    }
  }

  dbAddAuditLog({
    id: 'audit_' + Date.now(),
    adminName: 'DEVICE_BANNED',
    action: `Device/IP Banned (${bannedItem.reason}) - IP: ${bannedItem.ip}, FP: ${bannedItem.fingerprint || 'N/A'}, Code: ${bannedItem.accessCode || 'N/A'}`,
    details: 'security_system',
    timestamp: new Date().toISOString(),
    category: 'Security System' as any,
  });

  try {
    broadcastLiveEvent({ type: 'device_banned', bannedDevice: bannedItem });
  } catch (e) {}

  return bannedItem;
}

export async function unbanDeviceOrIp(key: string, fingerprint?: string, ip?: string) {
  bannedDevicesMap.delete(key);
  if (fingerprint) bannedDevicesMap.delete(fingerprint);
  if (ip) bannedDevicesMap.delete(ip);

  await dbDeleteBannedDevice(key);

  dbAddAuditLog({
    id: 'audit_' + Date.now(),
    adminName: 'DEVICE_UNBANNED',
    action: `Unbanned Device/IP key: ${key}`,
    details: 'security_system',
    timestamp: new Date().toISOString(),
    category: 'Security System' as any,
  });

  broadcastLiveEvent({ type: 'device_unbanned', unbannedKey: key });
}
