/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FastCancelManager } from '../fastCancel';

describe('Fast-cancel handshake (Gateway ↔ Warp)', () => {
  let manager: FastCancelManager;

  beforeEach(() => {
    manager = new FastCancelManager();
    vi.clearAllMocks();
  });

  it('should cancel within ≤150ms target', async () => {
    const sessionId = 'test-session-1';

    // Start a session
    const controller = manager.startSession(sessionId);
    expect(controller).toBeDefined();
    expect(manager.isSessionActive(sessionId)).toBe(true);

    // Cancel and measure timing
    const startTime = Date.now();
    const result = await manager.cancel({
      sessionId,
      timestamp: startTime
    });

    const actualLatency = Date.now() - startTime;

    // Verify timing requirements
    expect(result.latency).toBeLessThanOrEqual(150);
    expect(actualLatency).toBeLessThanOrEqual(200); // Allow some test overhead
    expect(result.status).toBe('cancelled');
    expect(result.sessionId).toBe(sessionId);
    expect(manager.isSessionActive(sessionId)).toBe(false);
  });

  it('should handle multiple concurrent cancels', async () => {
    const sessionIds = ['session-1', 'session-2', 'session-3'];

    // Start multiple sessions
    sessionIds.forEach(id => {
      manager.startSession(id);
      expect(manager.isSessionActive(id)).toBe(true);
    });

    expect(manager.getActiveSessionCount()).toBe(3);

    // Cancel all concurrently
    const cancelPromises = sessionIds.map(sessionId =>
      manager.cancel({ sessionId, timestamp: Date.now() })
    );

    const results = await Promise.all(cancelPromises);

    // Verify all cancels succeeded within timing
    results.forEach((result, index) => {
      expect(result.latency).toBeLessThanOrEqual(150);
      expect(result.status).toBe('cancelled');
      expect(result.sessionId).toBe(sessionIds[index]);
    });

    expect(manager.getActiveSessionCount()).toBe(0);
  });

  it('should return not_found for unknown sessions', async () => {
    const result = await manager.cancel({
      sessionId: 'unknown-session',
      timestamp: Date.now()
    });

    expect(result.status).toBe('not_found');
    expect(result.latency).toBeLessThan(10); // Should be very fast
    expect(result.sessionId).toBe('unknown-session');
  });

  it('should track latency metrics correctly', async () => {
    const sessionIds = ['s1', 's2', 's3', 's4', 's5'];

    // Perform multiple cancels
    for (const sessionId of sessionIds) {
      manager.startSession(sessionId);
      await manager.cancel({ sessionId, timestamp: Date.now() });
    }

    const metrics = manager.getMetrics();

    expect(metrics.totalCancels).toBe(5);
    expect(metrics.averageLatency).toBeGreaterThan(0);
    expect(metrics.maxLatency).toBeGreaterThanOrEqual(metrics.minLatency);
    expect(metrics.successRate).toBe(100);
    expect(metrics.targetCompliance).toBeGreaterThan(0); // Should have some compliant cancels
  });

  it('should create proper cancelled events', () => {
    const sessionId = 'test-session';
    const event = manager.createCancelledEvent(sessionId);

    expect(event.type).toBe('cancelled');
    expect(event.sessionId).toBe(sessionId);
    expect(event.timestamp).toBeTypeOf('number');
    expect(event.data).toBeDefined();
    expect(event.data.reason).toBe('User requested cancellation');
    expect(event.data.final).toBe(true);
  });

  it('should handle EventSource cleanup', async () => {
    const sessionId = 'test-session-with-eventsource';

    // Mock EventSource
    const mockEventSource = {
      readyState: 1, // 1 = OPEN
      close: vi.fn()
    } as unknown as EventSource;

    // Start session with EventSource
    manager.startSession(sessionId, mockEventSource);

    // Verify EventSource is in the expected state
    expect(mockEventSource.readyState).toBe(1);

    // Cancel should close the EventSource
    const result = await manager.cancel({
      sessionId,
      timestamp: Date.now()
    });

    // Verify cancellation succeeded
    expect(result.status).toBe('cancelled');
    expect(mockEventSource.close).toHaveBeenCalled();
  });

  it('should respect custom timeout values', async () => {
    const sessionId = 'timeout-test-session';
    const customTimeout = 50; // Very short timeout

    manager.startSession(sessionId);

    const startTime = Date.now();
    const result = await manager.cancel({
      sessionId,
      timestamp: startTime,
      timeout: customTimeout
    });

    // Should complete within custom timeout bounds
    expect(result.latency).toBeLessThanOrEqual(customTimeout + 20); // Allow small overhead
  });

  it('should track target compliance metrics', async () => {
    const sessionCount = 10;

    // Simulate a mix of fast and slow cancels
    for (let i = 0; i < sessionCount; i++) {
      const sessionId = `session-${i}`;
      manager.startSession(sessionId);

      // Simulate some variability in cancel timing
      await manager.cancel({
        sessionId,
        timestamp: Date.now(),
        timeout: i < 5 ? 100 : 200 // First 5 should be fast, rest slower
      });
    }

    const metrics = manager.getMetrics();

    expect(metrics.totalCancels).toBe(sessionCount);
    expect(metrics.targetCompliance).toBeGreaterThan(0);
    expect(metrics.targetCompliance).toBeLessThanOrEqual(100);
  });

  it('should cleanup all sessions properly', () => {
    const sessionIds = ['s1', 's2', 's3'];

    // Start multiple sessions
    sessionIds.forEach(id => manager.startSession(id));
    expect(manager.getActiveSessionCount()).toBe(3);

    // Cleanup should clear all
    manager.cleanup();
    expect(manager.getActiveSessionCount()).toBe(0);

    sessionIds.forEach(id => {
      expect(manager.isSessionActive(id)).toBe(false);
    });
  });
});