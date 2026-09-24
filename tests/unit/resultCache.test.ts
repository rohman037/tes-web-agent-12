import { describe, it, expect, beforeEach } from 'vitest';
import { resultCache } from '../../src/lib/resultCache';

describe('IndexedDB Result Cache Unit Tests', () => {
  beforeEach(async () => {
    await resultCache.clear();
  });

  it('should generate hash key deterministically', () => {
    const k1 = resultCache.hashKey('gemini-3.8-flash', { contents: 'test' });
    const k2 = resultCache.hashKey('gemini-3.8-flash', { contents: 'test' });
    expect(k1).toBe(k2);
  });

  it('should store and retrieve cached generation results', async () => {
    const hash = resultCache.hashKey('gemini-3.8-flash', { contents: 'viral video' });
    await resultCache.set(hash, { text: 'Generated viral script' }, 'gemini-3.8-flash');

    const cached = await resultCache.get(hash);
    expect(cached).toBeDefined();
    expect(cached.text).toBe('Generated viral script');
    expect(cached.cached).toBe(true);
  });
});
