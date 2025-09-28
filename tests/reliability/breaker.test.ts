/**
 * Circuit Breaker Tests
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { CircuitBreaker, BreakerState } from '../../src/lib/reliability/breaker';

describe('Circuit Breaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      threshold: 3,
      timeoutMs: 100,
      cooldownMs: 500,
      requestVolumeThreshold: 1
    });
  });

  test('should execute successful calls in closed state', async () => {
    const result = await breaker.execute(async () => 'success');
    expect(result).toBe('success');

    const stats = breaker.getStats();
    expect(stats.state).toBe(BreakerState.CLOSED);
    expect(stats.successes).toBe(1);
    expect(stats.failures).toBe(0);
  });

  test('should open after threshold failures', async () => {
    const failingFn = async () => {
      throw new Error('Test failure');
    };

    // Fail threshold times
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(failingFn);
      } catch {
        // Expected
      }
    }

    const stats = breaker.getStats();
    expect(stats.state).toBe(BreakerState.OPEN);
    expect(stats.failures).toBe(3);
  });

  test('should reject calls when open', async () => {
    // Force open
    breaker.forceOpen(1000);

    try {
      await breaker.execute(async () => 'should not execute');
      expect.fail('Should have thrown');
    } catch (error: any) {
      expect(error.code).toBe('BREAKER_OPEN');
      expect(error.retryable).toBe(true);
    }
  });

  test('should transition to half-open after cooldown', async () => {
    // Force open with short cooldown
    breaker.forceOpen(100);

    // Wait for cooldown
    await new Promise(resolve => setTimeout(resolve, 150));

    // Next call should try half-open
    const result = await breaker.execute(async () => 'recovery');
    expect(result).toBe('recovery');

    const stats = breaker.getStats();
    expect(stats.state).toBe(BreakerState.CLOSED);
  });

  test('should handle timeout', async () => {
    const slowFn = async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      return 'too late';
    };

    try {
      await breaker.execute(slowFn);
      expect.fail('Should have timed out');
    } catch (error: any) {
      expect(error.code).toBe('TIMEOUT');
      expect(error.retryable).toBe(true);
    }
  });

  test('should reset state', () => {
    breaker.forceOpen(1000);
    let stats = breaker.getStats();
    expect(stats.state).toBe(BreakerState.OPEN);

    breaker.reset();
    stats = breaker.getStats();
    expect(stats.state).toBe(BreakerState.CLOSED);
    expect(stats.failures).toBe(0);
    expect(stats.successes).toBe(0);
  });

  test('should reopen from half-open on failure', async () => {
    // Open the breaker
    breaker.forceOpen(50);

    // Wait for cooldown to allow half-open
    await new Promise(resolve => setTimeout(resolve, 60));

    // Fail in half-open state
    try {
      await breaker.execute(async () => {
        throw new Error('Half-open failure');
      });
    } catch {
      // Expected
    }

    const stats = breaker.getStats();
    expect(stats.state).toBe(BreakerState.OPEN);
  });
});