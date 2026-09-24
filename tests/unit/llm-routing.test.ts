import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAvailableApiKeys,
  handleKeyRateLimited,
  handleKeyDisabled,
  handleKeySuccess,
  calculateKeyHealthScore,
  calculateKeyRoutingScore,
  resolveRawKey,
} from '@/server/services/apiKeyPool';
import * as dbService from '@/src/db/dbService';
import { MOCK_API_KEYS } from '../fixtures/dbFixtures';

describe('Unit Test: LLM Gateway & API Key Pool Routing', () => {
  let mockDbKeys: any[] = [];

  beforeEach(() => {
    mockDbKeys = JSON.parse(JSON.stringify(MOCK_API_KEYS));
    vi.spyOn(dbService, 'dbGetApiKeys').mockImplementation(async () => mockDbKeys);
    vi.spyOn(dbService, 'dbSaveApiKeys').mockImplementation(async (keys: any[]) => {
      mockDbKeys = keys;
    });
  });

  describe('resolveRawKey Helper', () => {
    it('should resolve standard AIza API keys directly', () => {
      const result = resolveRawKey({ key: 'AIzaSyA_valid_google_key_123456789' });
      expect(result).toBe('AIzaSyA_valid_google_key_123456789');
    });

    it('should fallback to process.env.GEMINI_API_KEY when key contains placeholder alias', () => {
      process.env.GEMINI_API_KEY = 'AIzaSy_env_fallback_key';
      const result = resolveRawKey({ key: 'GeminiPoolKey_Demo' });
      expect(result).toBe('AIzaSy_env_fallback_key');
    });
  });

  describe('Key Scoring Formulas', () => {
    it('should give healthy keys high health scores', () => {
      const score = calculateKeyHealthScore({
        status: 'active',
        dailyUsage: 10,
        dailyLimit: 1000,
        failed_requests: 0,
        lastTestedLatency: 150,
      });
      expect(score).toBeGreaterThanOrEqual(90);
    });

    it('should give disabled or cooling keys low health scores', () => {
      expect(calculateKeyHealthScore({ status: 'disabled' })).toBe(0);
      expect(calculateKeyHealthScore({ status: 'rate_limited' })).toBe(10);
    });

    it('should rank verified admin pool keys higher in routing score', () => {
      const verifiedScore = calculateKeyRoutingScore({
        status: 'active',
        health_score: 95,
        dailyLimit: 1000,
        dailyUsage: 50,
        verifiedByAdmin: true,
      });

      const unverifiedScore = calculateKeyRoutingScore({
        status: 'active',
        health_score: 95,
        dailyLimit: 1000,
        dailyUsage: 50,
        verifiedByAdmin: false,
      });

      expect(verifiedScore).toBeGreaterThan(unverifiedScore);
    });
  });

  describe('getAvailableApiKeys Pool Extraction', () => {
    it('should filter out revoked keys and keys currently in cooldown', async () => {
      const available = await getAvailableApiKeys();
      const ids = available.map((k) => k.id);

      expect(ids).toContain('key_primary_01');
      expect(ids).toContain('key_secondary_02');
      expect(ids).not.toContain('key_cooling_03'); // Cooling down in fixture
      expect(ids).not.toContain('key_revoked_04'); // Revoked in fixture
    });

    it('should respect excludeKeyIds parameter', async () => {
      const available = await getAvailableApiKeys(['key_primary_01']);
      const ids = available.map((k) => k.id);
      expect(ids).not.toContain('key_primary_01');
      expect(ids).toContain('key_secondary_02');
    });
  });

  describe('handleKeyRateLimited (Cooldown Transition)', () => {
    it('should mark key as rate_limited and assign cooldown timestamp', async () => {
      await handleKeyRateLimited('key_primary_01', 60000);
      const target = mockDbKeys.find((k) => k.id === 'key_primary_01');

      expect(target.status).toBe('rate_limited');
      expect(target.cooldownUntil).toBeGreaterThan(Date.now());
      expect(target.lastError).toContain('429');
    });
  });

  describe('handleKeyDisabled (Revoke Transition)', () => {
    it('should mark key as revoked on 401 unauthorized', async () => {
      await handleKeyDisabled('key_secondary_02', '401 Unauthorized API Key');
      const target = mockDbKeys.find((k) => k.id === 'key_secondary_02');

      expect(target.status).toBe('revoked');
      expect(target.lastError).toContain('401');
    });
  });

  describe('handleKeySuccess (Metrics Updating)', () => {
    it('should increment usage counts and calculate moving average latency', async () => {
      const initialUsage = mockDbKeys.find((k) => k.id === 'key_primary_01').dailyUsage;
      await handleKeySuccess('key_primary_01', 120);
      const target = mockDbKeys.find((k) => k.id === 'key_primary_01');

      expect(target.dailyUsage).toBe(initialUsage + 1);
      expect(target.lastTestedLatency).toBeDefined();
    });
  });
});
