import { describe, it, expect, vi } from 'vitest';
import { clientFlight } from '../../src/lib/clientFlight';

describe('ClientFlight Deduplication Unit Tests', () => {
  it('should generate deterministic hash for requests', () => {
    const h1 = clientFlight.generateHash('/api/test', { prompt: 'hello' });
    const h2 = clientFlight.generateHash('/api/test', { prompt: 'hello' });
    const h3 = clientFlight.generateHash('/api/test', { prompt: 'world' });

    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });

  it('should deduplicate concurrent identical in-flight requests', async () => {
    const fetchFn = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return { success: true, timestamp: Date.now() };
    });

    const p1 = clientFlight.execute('/api/ai', { prompt: 'viral' }, fetchFn);
    const p2 = clientFlight.execute('/api/ai', { prompt: 'viral' }, fetchFn);

    const [res1, res2] = await Promise.all([p1, p2]);

    expect(res1).toEqual(res2);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
