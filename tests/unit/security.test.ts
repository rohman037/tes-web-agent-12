import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hashCredential,
  timingSafeHashCompare,
  validateAdminCredential,
  verifyWebhookSignature,
} from '@/server/core/security/secretManager';
import {
  isDeviceOrIpBanned,
  banDeviceOrIp,
  unbanDeviceOrIp,
  bannedDevicesMap,
} from '@/server/core/security/deviceSecurity';
import * as dbService from '@/src/db/dbService';

describe('Unit Test: Security Engines (Secret Manager & Device Security)', () => {
  beforeEach(() => {
    bannedDevicesMap.clear();
    vi.spyOn(dbService, 'dbSaveBannedDevice').mockImplementation(async () => {});
    vi.spyOn(dbService, 'dbDeleteBannedDevice').mockImplementation(async () => {});
    vi.spyOn(dbService, 'dbAddAuditLog').mockImplementation(async () => {});
  });

  describe('Secret Manager & Hashing', () => {
    it('should hash string credentials using sha256 deterministically', () => {
      const hash1 = hashCredential('secret123');
      const hash2 = hashCredential('secret123');
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // sha256 hex string length
    });

    it('should return empty string on empty input', () => {
      expect(hashCredential('')).toBe('');
    });

    it('should perform timing safe comparison correctly', () => {
      const hA = hashCredential('admin-pass');
      const hB = hashCredential('admin-pass');
      const hC = hashCredential('wrong-pass');

      expect(timingSafeHashCompare(hA, hB)).toBe(true);
      expect(timingSafeHashCompare(hA, hC)).toBe(false);
      expect(timingSafeHashCompare('', hA)).toBe(false);
    });

    it('should validate admin credentials accurately', () => {
      process.env.ADMIN_ACCESS_CODE = 'super-secret-admin-pass-2026';
      const valid = validateAdminCredential('super-secret-admin-pass-2026');
      expect(valid.isValid).toBe(true);
      expect(valid.role).toBe('admin');

      const invalid = validateAdminCredential('wrong-password');
      expect(invalid.isValid).toBe(false);
    });

    it('should verify authorized owner email credential and roles', () => {
      const ownerRes = validateAdminCredential('davidrohman037@gmail.com');
      expect(ownerRes.isValid).toBe(true);
      expect(ownerRes.role).toBe('owner');

      const adminRes = validateAdminCredential('ahmaddavid0906@gmail.com');
      expect(adminRes.isValid).toBe(true);
      expect(adminRes.role).toBe('admin');
    });

    it('should verify payment webhook HMAC signatures', () => {
      const payload = JSON.stringify({ orderId: 'ORD-123', status: 'PAID' });
      const secret = 'webhook-secret-key-999';
      const validSig = require('crypto').createHmac('sha256', secret).update(payload).digest('hex');

      expect(verifyWebhookSignature(payload, validSig, secret)).toBe(true);
      expect(verifyWebhookSignature(payload, 'invalid-signature-hash', secret)).toBe(false);
    });
  });

  describe('Device & IP Security', () => {
    it('should detect unbanned device as clean', () => {
      const check = isDeviceOrIpBanned('192.168.1.1', 'fp_clean_001', 'CODE-VALID');
      expect(check.banned).toBe(false);
    });

    it('should ban device and detect banned IP / fingerprint / code', async () => {
      await banDeviceOrIp({
        ip: '10.0.0.99',
        fingerprint: 'fp_malicious_666',
        accessCode: 'SATSET-MALICIOUS',
        reason: 'Brute force login detected',
        bannedBy: 'SECURITY_AUTOMATION',
      });

      // Check by IP
      expect(isDeviceOrIpBanned('10.0.0.99').banned).toBe(true);

      // Check by Fingerprint
      expect(isDeviceOrIpBanned('192.168.1.5', 'fp_malicious_666').banned).toBe(true);

      // Check by Access Code
      expect(isDeviceOrIpBanned('192.168.1.5', 'fp_other', 'SATSET-MALICIOUS').banned).toBe(true);
    });

    it('should unban device and restore access', async () => {
      const banItem = await banDeviceOrIp({
        ip: '10.0.0.50',
        reason: 'Temporary test ban',
        bannedBy: 'ADMIN',
      });

      expect(isDeviceOrIpBanned('10.0.0.50').banned).toBe(true);

      await unbanDeviceOrIp(banItem.id, '10.0.0.50');
      expect(isDeviceOrIpBanned('10.0.0.50').banned).toBe(false);
    });
  });
});
