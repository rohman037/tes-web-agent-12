/**
 * IndexedDB Result Cache for LLM Generations (TTL 24 hours)
 * Drastically reduces duplicate outbound requests and preserves quota.
 * Falls back to in-memory map in non-browser test environments.
 */
const DB_NAME = 'CreatorAI_ResultCacheDB';
const STORE_NAME = 'generation_results';
const DB_VERSION = 1;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CachedResult {
  hashKey: string;
  data: any;
  createdAt: number;
  expiresAt: number;
  modelUsed: string;
}

class IndexedDBResultCache {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private memCache = new Map<string, CachedResult>();

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
  }

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (!this.isBrowser()) {
        return reject(new Error('IndexedDB not supported'));
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'hashKey' });
        }
      };
    });

    return this.dbPromise;
  }

  public hashKey(model: string, promptPayload: any): string {
    const raw = `${(model || '').toLowerCase()}:${JSON.stringify(promptPayload)}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }

  public async get(hashKey: string): Promise<any | null> {
    if (!this.isBrowser()) {
      const record = this.memCache.get(hashKey);
      if (!record) return null;
      if (Date.now() > record.expiresAt) {
        this.memCache.delete(hashKey);
        return null;
      }
      return {
        ...record.data,
        cached: true,
        cachedAt: record.createdAt,
      };
    }

    try {
      const db = await this.getDB();
      return await new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(hashKey);

        request.onsuccess = () => {
          const record = request.result as CachedResult;
          if (!record) return resolve(null);

          if (Date.now() > record.expiresAt) {
            this.delete(hashKey);
            return resolve(null);
          }

          resolve({
            ...record.data,
            cached: true,
            cachedAt: record.createdAt,
          });
        };
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  public async set(hashKey: string, data: any, modelUsed: string, ttlMs = DEFAULT_TTL_MS): Promise<void> {
    const now = Date.now();
    const record: CachedResult = {
      hashKey,
      data,
      createdAt: now,
      expiresAt: now + ttlMs,
      modelUsed,
    };

    if (!this.isBrowser()) {
      this.memCache.set(hashKey, record);
      return;
    }

    try {
      const db = await this.getDB();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(record);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('[ResultCache] Failed to store result in IndexedDB:', err);
    }
  }

  public async delete(hashKey: string): Promise<void> {
    if (!this.isBrowser()) {
      this.memCache.delete(hashKey);
      return;
    }
    try {
      const db = await this.getDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.delete(hashKey);
    } catch {}
  }

  public async clear(): Promise<void> {
    this.memCache.clear();
    if (!this.isBrowser()) return;
    try {
      const db = await this.getDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
    } catch {}
  }
}

export const resultCache = new IndexedDBResultCache();
