import { describe, it, expect, vi, beforeEach } from 'vitest';
import { acquireSlot, markKeyWarmForModel } from '../../server/services/quotaRouter';
import { getPacificDateString, runPacificMidnightResetCron } from '../../server/services/quotaLedger';

vi.mock('@/src/db/dbService', () => ({
  dbGetApiKeys: vi.fn().mockResolvedValue([
    {
      id: 'key_1',
      key: 'AIzaSyTestKey123456789012345678901234567890',
      status: 'active',
      daily_limit: 20,
      rpm_limit: 5,
    },
    {
      id: 'key_2',
      key: 'AIzaSyTestKey098765432109876543210987654321',
      status: 'active',
      daily_limit: 500,
      rpm_limit: 15,
    }
  ]),
  dbSaveApiKeys: vi.fn().mockResolvedValue(true),
  dbAddApiKeyLog: vi.fn().mockResolvedValue(true),
}));

describe('Quota Orchestrator & Ledger Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should format Pacific Date string correctly', () => {
    const ptDate = getPacificDateString(new Date('2026-09-23T12:00:00Z'));
    expect(ptDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should acquire slot successfully from available keys', async () => {
    const slot = await acquireSlot('generate-final', 'free', 'gemini-3.8-flash');
    expect(slot).toBeDefined();
    expect(slot.keyId).toBeDefined();
    expect(slot.model).toBe('gemini-3.8-flash');
    expect(slot.rawKey).toContain('AIzaSy');
  });

  it('should execute Pacific midnight reset cron without errors', async () => {
    const result = await runPacificMidnightResetCron();
    expect(result).toBeUndefined(); // cron wrapper returns void or result
  });

  it('should mark key warm and bypass it temporarily', async () => {
    markKeyWarmForModel('key_1', 'gemini-3.8-flash', 5000);
    const slot = await acquireSlot('generate-final', 'free', 'gemini-3.8-flash');
    // Should fallback to key_2 because key_1 is warm
    expect(slot.keyId).toBe('key_2');
  });
});
