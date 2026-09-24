import { logger } from '../utils/logger';

export interface QueueItem<T> {
  id: string;
  model: string;
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: any) => void;
  retries: number;
  addedAt: number;
}

/**
 * Smart Queue & Rate Limiter for Google AI Studio & Multi-Key Admin Pool
 * - Partitions queues by keyId and model to allow parallel execution across the 85+ admin keys.
 * - Enforces polite 600ms spacing per key to prevent RPM burst errors on individual keys.
 * - Exponential backoff retry handler for HTTP 429 Rate Limit responses.
 */
class SmartRateLimiter {
  private queues = new Map<string, QueueItem<any>[]>();
  private processing = new Map<string, boolean>();
  private lastRequestTimes = new Map<string, number>();
  
  // Safe spacing per individual key (600ms = 100 RPM headroom per key)
  private minIntervalMs = 600;
  private maxQueueSize = 50;

  /**
   * Enqueues an LLM task with rate limiting and retry backoff
   */
  public async schedule<T>(model: string, task: () => Promise<T>, keyId?: string): Promise<T> {
    const normalizedModel = (model || 'default-gemini').toLowerCase().trim();
    const queueKey = keyId ? `${normalizedModel}::${keyId}` : normalizedModel;

    return new Promise<T>((resolve, reject) => {
      if (!this.queues.has(queueKey)) {
        this.queues.set(queueKey, []);
      }

      const queue = this.queues.get(queueKey)!;

      if (queue.length >= this.maxQueueSize) {
        const estimatedWaitSec = Math.ceil((queue.length * this.minIntervalMs) / 1000);
        reject(
          new Error(
            `Server sedang sibuk. Antrian AI penuh (${queue.length} request). Estimasi tunggu sekitar ${estimatedWaitSec} detik.`
          )
        );
        return;
      }

      const itemId = Math.random().toString(36).substring(2, 9);
      queue.push({
        id: itemId,
        model: normalizedModel,
        task,
        resolve,
        reject,
        retries: 0,
        addedAt: Date.now(),
      });

      logger.info(`[RateLimiter] Request ${itemId} queued for '${queueKey}'. Queue depth: ${queue.length}`);
      this.processQueue(queueKey);
    });
  }

  private async processQueue(queueKey: string) {
    if (this.processing.get(queueKey)) return;
    this.processing.set(queueKey, true);

    const queue = this.queues.get(queueKey);
    if (!queue || queue.length === 0) {
      this.processing.set(queueKey, false);
      return;
    }

    const item = queue.shift()!;
    const now = Date.now();
    const lastTime = this.lastRequestTimes.get(queueKey) || 0;
    const elapsed = now - lastTime;

    if (elapsed < this.minIntervalMs) {
      const waitTime = this.minIntervalMs - elapsed;
      await new Promise((r) => setTimeout(r, waitTime));
    }

    this.lastRequestTimes.set(queueKey, Date.now());

    try {
      const result = await this.executeWithRetry(item);
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    } finally {
      this.processing.set(queueKey, false);
      // Process next in queue
      if (queue && queue.length > 0) {
        setImmediate(() => this.processQueue(queueKey));
      }
    }
  }

  /**
   * Executes task with Exponential Backoff retry mechanism (2s, 4s, 8s) for 429 / Rate Limit errors
   */
  private async executeWithRetry<T>(item: QueueItem<T>, maxRetries = 3): Promise<T> {
    try {
      return await item.task();
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      const isRateLimit =
        errorMessage.includes('429') ||
        errorMessage.includes('RESOURCE_EXHAUSTED') ||
        errorMessage.includes('quota') ||
        errorMessage.includes('rate limit');

      if (isRateLimit && item.retries < maxRetries) {
        item.retries++;
        // Exponential backoff: 2s, 4s, 8s
        const backoffMs = Math.pow(2, item.retries) * 1000;
        logger.warn(
          `[RateLimiter] 429 Rate Limit hit for model '${item.model}' (Attempt ${item.retries}/${maxRetries}). Retrying in ${backoffMs / 1000}s...`
        );

        await new Promise((r) => setTimeout(r, backoffMs));
        return this.executeWithRetry(item, maxRetries);
      }

      throw error;
    }
  }

  public getQueueStats() {
    const stats: Record<string, number> = {};
    for (const [model, queue] of this.queues.entries()) {
      stats[model] = queue.length;
    }
    return stats;
  }
}

export const smartRateLimiter = new SmartRateLimiter();
