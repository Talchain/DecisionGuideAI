/**
 * Back-pressure and Queue Management
 * Enforces rate limits and queue caps
 */

import { ErrorFactory } from '../../types/error-taxonomy';
import { SSEEventFactory } from '../../types/sse-events';

export interface QueueConfig {
  maxSize: number;
  maxConcurrent: number;
  rateLimit: {
    requests: number;
    windowMs: number;
  };
}

export interface QueueEntry {
  id: string;
  priority: number;
  timestamp: number;
  data: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export class BackPressureQueue {
  private queue: QueueEntry[] = [];
  private processing = new Map<string, QueueEntry>();
  private rateLimitWindow: number[] = [];
  private config: QueueConfig;
  private metrics = {
    rejected: 0,
    processed: 0,
    failed: 0,
    lastLimitReason: '',
    lastLimitTime: 0
  };

  constructor(config?: Partial<QueueConfig>) {
    this.config = {
      maxSize: parseInt(process.env.QUEUE_MAX || '100'),
      maxConcurrent: parseInt(process.env.QUEUE_CONCURRENT || '10'),
      rateLimit: {
        requests: parseInt(process.env.RATE_LIMIT_REQUESTS || '100'),
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000')
      },
      ...config
    };
  }

  enqueue(entry: Omit<QueueEntry, 'status' | 'timestamp'>): void {
    // Check queue cap
    if (this.queue.length >= this.config.maxSize) {
      this.metrics.rejected++;
      this.metrics.lastLimitReason = 'queue_full';
      this.metrics.lastLimitTime = Date.now();

      throw ErrorFactory.rateLimit(
        new Date(Date.now() + 60000).toISOString(),
        this.config.maxSize,
        0
      );
    }

    // Check rate limit
    if (!this.checkRateLimit()) {
      this.metrics.rejected++;
      this.metrics.lastLimitReason = 'rate_limit';
      this.metrics.lastLimitTime = Date.now();

      const resetTime = new Date(
        this.rateLimitWindow[0] + this.config.rateLimit.windowMs
      ).toISOString();

      throw ErrorFactory.rateLimit(
        resetTime,
        this.config.rateLimit.requests,
        0
      );
    }

    // Add to queue
    const queueEntry: QueueEntry = {
      ...entry,
      status: 'pending',
      timestamp: Date.now()
    };

    // Insert based on priority
    const insertIndex = this.queue.findIndex(e => e.priority < entry.priority);
    if (insertIndex === -1) {
      this.queue.push(queueEntry);
    } else {
      this.queue.splice(insertIndex, 0, queueEntry);
    }

    this.recordRequest();
  }

  async process<T>(
    processor: (entry: QueueEntry) => Promise<T>
  ): Promise<T | undefined> {
    // Check concurrent limit
    if (this.processing.size >= this.config.maxConcurrent) {
      return undefined; // Can't process now
    }

    // Get next item
    const entry = this.queue.shift();
    if (!entry) {
      return undefined; // Queue empty
    }

    entry.status = 'processing';
    this.processing.set(entry.id, entry);

    try {
      const result = await processor(entry);
      entry.status = 'completed';
      this.metrics.processed++;
      return result;
    } catch (error) {
      entry.status = 'failed';
      this.metrics.failed++;
      throw error;
    } finally {
      this.processing.delete(entry.id);
    }
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    const windowStart = now - this.config.rateLimit.windowMs;

    // Remove old entries
    this.rateLimitWindow = this.rateLimitWindow.filter(t => t > windowStart);

    // Check if under limit
    return this.rateLimitWindow.length < this.config.rateLimit.requests;
  }

  private recordRequest(): void {
    this.rateLimitWindow.push(Date.now());
  }

  getMetrics() {
    return {
      queueSize: this.queue.length,
      processing: this.processing.size,
      ...this.metrics,
      rateLimitRemaining: Math.max(
        0,
        this.config.rateLimit.requests - this.rateLimitWindow.length
      )
    };
  }

  getPosition(id: string): number {
    return this.queue.findIndex(e => e.id === id) + 1;
  }

  cancel(id: string): boolean {
    const index = this.queue.findIndex(e => e.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return this.processing.has(id);
  }

  clear(): void {
    this.queue = [];
    this.processing.clear();
    this.rateLimitWindow = [];
  }

  /**
   * Generate SSE limited event for rate limit
   */
  generateLimitedEvent(sessionId: string): ReturnType<typeof SSEEventFactory.limited> {
    const resetTime = new Date(
      Date.now() + this.config.rateLimit.windowMs
    ).toISOString();

    return SSEEventFactory.limited(
      sessionId,
      'rate',
      resetTime,
      Math.max(0, this.config.rateLimit.requests - this.rateLimitWindow.length),
      this.config.rateLimit.requests
    );
  }
}

// Global queue instances
export const queues = {
  analysis: new BackPressureQueue({
    maxSize: 50,
    maxConcurrent: 5
  }),
  jobs: new BackPressureQueue({
    maxSize: 100,
    maxConcurrent: 10
  }),
  reports: new BackPressureQueue({
    maxSize: 200,
    maxConcurrent: 20,
    rateLimit: {
      requests: 1000,
      windowMs: 60000
    }
  })
};

/**
 * Middleware for rate limiting
 */
export function rateLimitMiddleware(queueName: keyof typeof queues = 'analysis') {
  return (req: any, res: any, next: any) => {
    const queue = queues[queueName];

    try {
      // Try to enqueue a placeholder
      const testEntry = {
        id: `test-${Date.now()}`,
        priority: 0,
        data: {}
      };

      // Check if we can accept
      if (!queue['checkRateLimit']()) {
        const metrics = queue.getMetrics();
        const resetTimeMs = Date.now() + queue['config'].rateLimit.windowMs;
        const resetTime = new Date(resetTimeMs).toISOString();
        const retryAfterSeconds = Math.ceil(queue['config'].rateLimit.windowMs / 1000);

        // Add required rate-limit headers
        const headers = {
          'Content-Type': 'application/json',
          'Retry-After': retryAfterSeconds.toString(),
          'X-RateLimit-Limit': queue['config'].rateLimit.requests.toString(),
          'X-RateLimit-Remaining': metrics.rateLimitRemaining.toString(),
          'X-RateLimit-Reset': Math.floor(resetTimeMs / 1000).toString()
        };

        res.writeHead(429, headers);
        res.end(JSON.stringify({
          code: 'RATE_LIMIT',
          message: 'Rate limit exceeded',
          retryable: true,
          timestamp: new Date().toISOString(),
          details: {
            resetTime,
            limit: queue['config'].rateLimit.requests,
            remaining: metrics.rateLimitRemaining,
            retryAfterSeconds
          }
        }));
        return;
      }

      next();
    } catch (error: any) {
      if (error.code === 'RATE_LIMIT') {
        const metrics = queue.getMetrics();
        const resetTimeMs = Date.now() + queue['config'].rateLimit.windowMs;
        const retryAfterSeconds = Math.ceil(queue['config'].rateLimit.windowMs / 1000);

        // Add required rate-limit headers for error responses
        const headers = {
          'Content-Type': 'application/json',
          'Retry-After': retryAfterSeconds.toString(),
          'X-RateLimit-Limit': queue['config'].rateLimit.requests.toString(),
          'X-RateLimit-Remaining': metrics.rateLimitRemaining.toString(),
          'X-RateLimit-Reset': Math.floor(resetTimeMs / 1000).toString()
        };

        res.writeHead(429, headers);
        res.end(JSON.stringify({
          ...error,
          details: {
            ...error.details,
            retryAfterSeconds
          }
        }));
      } else {
        next(error);
      }
    }
  };
}