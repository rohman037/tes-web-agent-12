import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dbService from '@/src/db/dbService';
import {
  createTransactionService,
  submitPaymentProofService,
  approveTransactionService,
  rejectTransactionService,
} from '@/server/workflows/payment/service';
import { MOCK_PAYMENTS, MOCK_PACKAGES } from '../fixtures/dbFixtures';

describe('Unit Test: Payment Workflow & State Transitions', () => {
  let mockTransactions: any[] = [];
  let mockAccessCodes: any[] = [];
  let mockClients: any[] = [];
  let mockPackages: any[] = [];

  beforeEach(() => {
    mockTransactions = JSON.parse(JSON.stringify(MOCK_PAYMENTS));
    mockPackages = JSON.parse(JSON.stringify(MOCK_PACKAGES));
    mockAccessCodes = [];
    mockClients = [];

    vi.spyOn(dbService, 'dbGetTransactions').mockImplementation(async () => mockTransactions);
    vi.spyOn(dbService, 'dbSaveTransaction').mockImplementation(async (trx: any) => {
      const idx = mockTransactions.findIndex((t) => t.id === trx.id);
      if (idx >= 0) mockTransactions[idx] = trx;
      else mockTransactions.push(trx);
    });

    vi.spyOn(dbService, 'dbGetPackages').mockImplementation(async () => mockPackages);
    vi.spyOn(dbService, 'dbGetAccessCodes').mockImplementation(async () => mockAccessCodes);
    vi.spyOn(dbService, 'dbSaveAccessCode').mockImplementation(async (c: any) => {
      mockAccessCodes.push(c);
    });

    vi.spyOn(dbService, 'dbGetClients').mockImplementation(async () => mockClients);
    vi.spyOn(dbService, 'dbSaveClient').mockImplementation(async (c: any) => {
      mockClients.push(c);
    });
  });

  describe('createTransactionService', () => {
    it('should create new transaction with clean uppercase ID', async () => {
      const newTrx = {
        id: 'ord-2026-new-001',
        packageId: 'pkg_starter_7d',
        amount: 49050,
        customerName: 'Budi Creator',
      };

      const result = await createTransactionService(newTrx);
      expect(result.id).toBe('ORD-2026-NEW-001');
      expect(mockTransactions.some((t) => t.id === 'ORD-2026-NEW-001')).toBe(true);
    });

    it('should reject invalid empty transaction payload', async () => {
      await expect(createTransactionService(null as any)).rejects.toThrow('Payload transaksi tidak valid');
    });
  });

  describe('submitPaymentProofService (State -> AWAITING_VERIFICATION)', () => {
    it('should update status to AWAITING_VERIFICATION and store proof image', async () => {
      const proofBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const result = await submitPaymentProofService('ORD-2026-0923-001', proofBase64);

      expect(result.status).toBe('AWAITING_VERIFICATION');
      expect(result.proofImageBase64).toBe(proofBase64);
    });

    it('should throw 404 for nonexistent transaction without payload', async () => {
      await expect(submitPaymentProofService('ORD-NONEXISTENT-999')).rejects.toThrow('Transaksi tidak ditemukan');
    });
  });

  describe('approveTransactionService (State -> APPROVED)', () => {
    it('should approve transaction, generate access code, and provision client account', async () => {
      const approvedResult = await approveTransactionService('ORD-2026-0923-001', 'SATSET-BUDI-VIP');

      expect(approvedResult.transaction.status).toBe('APPROVED');
      expect(approvedResult.transaction.accessCode).toBe('SATSET-BUDI-VIP');

      // Client account provisioning verification
      expect(approvedResult.client).toBeDefined();
      expect(approvedResult.client.accessCode).toBe('SATSET-BUDI-VIP');
      expect(approvedResult.client.status).toBe('active');

      // Access code saved to registry
      expect(mockAccessCodes.some((c) => c.code === 'SATSET-BUDI-VIP')).toBe(true);
    });
  });

  describe('rejectTransactionService (State -> REJECTED)', () => {
    it('should reject transaction and store custom rejection reason', async () => {
      const result = await rejectTransactionService('ORD-2026-0923-001', 'Bukti transfer tidak terbaca');

      expect(result.status).toBe('REJECTED');
      expect(result.rejectReason).toBe('Bukti transfer tidak terbaca');
    });
  });
});
