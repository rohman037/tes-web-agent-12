import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as dbService from '@/src/db/dbService';
import {
  getPackagesService,
  updatePackagesService,
  createAccessCodeService,
  removeAccessCodeService,
} from '@/server/workflows/access-control/service';
import { MOCK_CLIENTS, MOCK_PACKAGES } from '../fixtures/dbFixtures';

describe('Unit Test: Clients & Packages Management (with Fake Timers)', () => {
  let mockPackages: any[] = [];
  let mockClients: any[] = [];
  let mockAccessCodes: any[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    mockPackages = JSON.parse(JSON.stringify(MOCK_PACKAGES));
    mockClients = JSON.parse(JSON.stringify(MOCK_CLIENTS));
    mockAccessCodes = [{ code: 'SATSET-VIP-888', note: 'VIP Member', createdAt: Date.now() }];

    vi.spyOn(dbService, 'dbGetPackages').mockImplementation(async () => mockPackages);
    vi.spyOn(dbService, 'dbSavePackage').mockImplementation(async (pkg: any) => {
      const idx = mockPackages.findIndex((p) => p.id === pkg.id);
      if (idx >= 0) mockPackages[idx] = pkg;
      else mockPackages.push(pkg);
    });
    vi.spyOn(dbService, 'dbDeletePackage').mockImplementation(async (id: string) => {
      mockPackages = mockPackages.filter((p) => p.id !== id);
    });

    vi.spyOn(dbService, 'dbGetClients').mockImplementation(async () => mockClients);
    vi.spyOn(dbService, 'dbSaveClient').mockImplementation(async (c: any) => {
      const idx = mockClients.findIndex((x) => x.id === c.id);
      if (idx >= 0) mockClients[idx] = c;
      else mockClients.push(c);
    });

    vi.spyOn(dbService, 'dbGetAccessCodes').mockImplementation(async () => mockAccessCodes);
    vi.spyOn(dbService, 'dbSaveAccessCode').mockImplementation(async (item: any) => {
      mockAccessCodes.push(item);
    });
    vi.spyOn(dbService, 'dbDeleteAccessCode').mockImplementation(async (code: string) => {
      mockAccessCodes = mockAccessCodes.filter((c) => c.code !== code);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Packages Service', () => {
    it('should retrieve package list accurately', async () => {
      const packages = await getPackagesService();
      expect(packages.length).toBe(2);
      expect(packages[0].id).toBe('pkg_starter_7d');
    });

    it('should update packages and clean up removed package IDs', async () => {
      const newPackageList = [
        {
          id: 'pkg_new_custom',
          name: 'Paket Custom Creator',
          price: 150000,
          durationDays: 30,
          isActive: true,
        },
      ];

      const result = await updatePackagesService(newPackageList);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('pkg_new_custom');
      expect(mockPackages.find((p) => p.id === 'pkg_starter_7d')).toBeUndefined();
    });

    it('should reject non-array payload', async () => {
      await expect(updatePackagesService(null as any)).rejects.toThrow('Payload paket harus berupa array');
    });
  });

  describe('Access Code Service', () => {
    it('should create uppercase normalized access code', async () => {
      const { item } = await createAccessCodeService('satset-baru-123', 'Akses Klien Baru');
      expect(item.code).toBe('SATSET-BARU-123');
      expect(item.note).toBe('Akses Klien Baru');
    });

    it('should throw error when code is empty', async () => {
      await expect(createAccessCodeService('')).rejects.toThrow('Kode akses tidak boleh kosong');
    });

    it('should delete access code successfully', async () => {
      await removeAccessCodeService('SATSET-VIP-888');
      expect(mockAccessCodes.find((c) => c.code === 'SATSET-VIP-888')).toBeUndefined();
    });
  });

  describe('Client Expiry Simulation (Fake Timers)', () => {
    it('should detect expired client status after time advancement', async () => {
      // Set baseline time
      const startTime = new Date('2026-01-01T00:00:00Z');
      vi.setSystemTime(startTime);

      const activeClient = mockClients.find((c) => c.id === 'client_active_vip');
      const isExpiredInitial = new Date(activeClient.expiryDate).getTime() < Date.now();
      expect(isExpiredInitial).toBe(false);

      // Advance time 2 years into the future (2028)
      vi.advanceTimersByTime(2 * 365 * 24 * 60 * 60 * 1000);

      const isExpiredAfter = new Date(activeClient.expiryDate).getTime() < Date.now();
      expect(isExpiredAfter).toBe(true);
    });
  });
});
