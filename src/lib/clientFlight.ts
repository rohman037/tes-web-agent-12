import crypto from 'crypto'; // or simple hashing for browser

/**
 * Client-Side Single-Flight Deduplication & Debounce Manager
 * Prevents duplicate in-flight API requests for identical payloads.
 */
interface InFlightRequest {
  promise: Promise<any>;
  abortController: AbortController;
  createdAt: number;
}

class ClientFlightManager {
  private inFlightMap = new Map<string, InFlightRequest>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Generates a deterministic hash for client-side request deduplication
   */
  public generateHash(endpoint: string, payload: any): string {
    const raw = `${endpoint}:${JSON.stringify(payload)}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Executes a request with Single-Flight Deduplication and optional Debounce
   */
  public async execute<T>(
    endpoint: string,
    payload: any,
    fetchFn: (signal: AbortSignal) => Promise<T>,
    debounceMs = 0
  ): Promise<T> {
    const flightKey = this.generateHash(endpoint, payload);

    // If exact same request is already in flight, return existing promise
    const existing = this.inFlightMap.get(flightKey);
    if (existing) {
      console.log(`[ClientFlight] Deduplicating in-flight request for hash ${flightKey}`);
      return existing.promise;
    }

    if (debounceMs > 0) {
      if (this.debounceTimers.has(flightKey)) {
        clearTimeout(this.debounceTimers.get(flightKey)!);
      }
    }

    const abortController = new AbortController();

    const promise = new Promise<T>((resolve, reject) => {
      const run = async () => {
        try {
          const result = await fetchFn(abortController.signal);
          resolve(result);
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            reject(new Error('Request dibatalkan (Abort)'));
          } else {
            reject(err);
          }
        } finally {
          this.inFlightMap.delete(flightKey);
        }
      };

      if (debounceMs > 0) {
        const timer = setTimeout(run, debounceMs);
        this.debounceTimers.set(flightKey, timer);
      } else {
        run();
      }
    });

    this.inFlightMap.set(flightKey, {
      promise,
      abortController,
      createdAt: Date.now(),
    });

    return promise;
  }

  public abortAll() {
    for (const [, req] of this.inFlightMap.entries()) {
      req.abortController.abort();
    }
    this.inFlightMap.clear();
  }
}

export const clientFlight = new ClientFlightManager();
