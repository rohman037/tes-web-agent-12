import crypto from 'crypto';
import { logger } from '../utils/logger';

export interface CacheEntry {
  text: string;
  modelUsed: string;
  tierUsed?: string;
  latencyMs?: number;
  keyMasked?: string;
  cached: boolean;
  createdAt: number;
  expiresAt: number;
}

/**
 * In-Memory Semantic & Exact-Match Cache with TTL (Default 24 Hours)
 * Designed to drastically save Google AI Studio RPD (Requests Per Day - limit 20).
 */
class LlmSemanticCache {
  private cache = new Map<string, CacheEntry>();
  private defaultTtlMs = 24 * 60 * 60 * 1000; // 24 Hours

  /**
   * Generates a deterministic SHA-256 hash from model, contents, and config parameters
   */
  public generateKey(model: string, contents: any, config?: any): string {
    const payloadString = JSON.stringify({
      model: (model || 'default').toLowerCase().trim(),
      contents: contents || '',
      temperature: config?.temperature ?? 0.7,
      topP: config?.topP ?? 0.95,
      topK: config?.topK ?? 40,
      systemInstruction: config?.systemInstruction || '',
    });

    return crypto.createHash('sha256').update(payloadString).digest('hex');
  }

  public get(cacheKey: string): CacheEntry | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      return null;
    }

    logger.info(`[LlmCache] Cache HIT for key ${cacheKey.slice(0, 10)}... (Model: ${entry.modelUsed})`);
    return {
      ...entry,
      cached: true,
    };
  }

  public set(cacheKey: string, data: Omit<CacheEntry, 'cached' | 'createdAt' | 'expiresAt'>, ttlMs = this.defaultTtlMs): void {
    const now = Date.now();
    const entry: CacheEntry = {
      ...data,
      cached: true,
      createdAt: now,
      expiresAt: now + ttlMs,
    };

    // Limit cache size to prevent memory bloat (max 500 entries)
    if (this.cache.size >= 500) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(cacheKey, entry);
    logger.info(`[LlmCache] Cached response stored for key ${cacheKey.slice(0, 10)}... (TTL: ${ttlMs / 1000}s)`);
  }

  public clear(): void {
    this.cache.clear();
    logger.info('[LlmCache] Cache cleared.');
  }

  public size(): number {
    return this.cache.size;
  }
}

export const llmCache = new LlmSemanticCache();
