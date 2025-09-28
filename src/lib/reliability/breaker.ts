/**
 * Circuit Breaker Implementation
 * Maps to BREAKER_OPEN error taxonomy
 */

import { ErrorFactory } from '../../types/error-taxonomy';

export enum BreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface BreakerConfig {
  threshold: number;        // Failure threshold to open breaker
  timeoutMs: number;        // Timeout for each call
  cooldownMs: number;       // Time to wait before trying half-open
  requestVolumeThreshold: number; // Min requests before opening
}

export interface BreakerStats {
  state: BreakerState;
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailureTime?: number;
  nextAttemptTime?: number;
}

export class CircuitBreaker {
  private state: BreakerState = BreakerState.CLOSED;
  private failures = 0;
  private successes = 0;
  private totalRequests = 0;
  private lastFailureTime?: number;
  private nextAttemptTime?: number;
  private config: BreakerConfig;

  constructor(config?: Partial<BreakerConfig>) {
    this.config = {
      threshold: parseInt(process.env.BREAKER_THRESHOLD || '5'),
      timeoutMs: parseInt(process.env.BREAKER_TIMEOUT_MS || '30000'),
      cooldownMs: parseInt(process.env.BREAKER_COOLDOWN_MS || '60000'),
      requestVolumeThreshold: 10,
      ...config
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if breaker is open
    if (this.state === BreakerState.OPEN) {
      if (Date.now() < (this.nextAttemptTime || 0)) {
        // Still in cooldown
        throw ErrorFactory.breakerOpen(
          'circuit-breaker',
          Math.ceil(((this.nextAttemptTime || 0) - Date.now()) / 1000)
        );
      }
      // Try half-open
      this.state = BreakerState.HALF_OPEN;
    }

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(fn);

      // Record success
      this.onSuccess();

      return result;
    } catch (error) {
      // Record failure
      this.onFailure();

      throw error;
    }
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(ErrorFactory.timeout('Circuit breaker timeout')),
          this.config.timeoutMs
        )
      )
    ]);
  }

  private onSuccess(): void {
    this.successes++;
    this.totalRequests++;

    if (this.state === BreakerState.HALF_OPEN) {
      // Successful call in half-open, close the breaker
      this.state = BreakerState.CLOSED;
      this.failures = 0;
      console.log('Circuit breaker closed after successful half-open attempt');
    }
  }

  private onFailure(): void {
    this.failures++;
    this.totalRequests++;
    this.lastFailureTime = Date.now();

    if (this.state === BreakerState.HALF_OPEN) {
      // Failed in half-open, open again
      this.openBreaker();
    } else if (
      this.state === BreakerState.CLOSED &&
      this.totalRequests >= this.config.requestVolumeThreshold &&
      this.failures >= this.config.threshold
    ) {
      // Threshold reached, open breaker
      this.openBreaker();
    }
  }

  private openBreaker(): void {
    this.state = BreakerState.OPEN;
    this.nextAttemptTime = Date.now() + this.config.cooldownMs;

    console.warn(`Circuit breaker OPEN - will retry at ${new Date(this.nextAttemptTime).toISOString()}`);
  }

  getStats(): BreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime
    };
  }

  reset(): void {
    this.state = BreakerState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.totalRequests = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
  }

  // Force open for testing/chaos
  forceOpen(duration?: number): void {
    this.state = BreakerState.OPEN;
    this.nextAttemptTime = Date.now() + (duration || this.config.cooldownMs);
  }

  // Force close for testing
  forceClose(): void {
    this.state = BreakerState.CLOSED;
    this.failures = 0;
  }
}

// Global breakers for different services
export const breakers = {
  model: new CircuitBreaker({ threshold: 3 }),
  database: new CircuitBreaker({ threshold: 5 }),
  external: new CircuitBreaker({ threshold: 2 })
};

/**
 * Wrap a function with circuit breaker
 */
export function withBreaker<T>(
  breakerName: keyof typeof breakers,
  fn: () => Promise<T>
): Promise<T> {
  return breakers[breakerName].execute(fn);
}