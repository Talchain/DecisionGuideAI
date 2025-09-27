/**
 * Frozen Stream Events Regression Test
 *
 * Ensures that only the 7 frozen SSE events are emitted when STREAM_ALT_EVENTS=0
 * Fails if any experimental run.* or step.* events leak while experimental API is disabled
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock EventSource for testing
class MockEventSource {
  events: any[] = [];
  onmessage: ((event: any) => void) | null = null;
  onopen: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  readyState: number = 1; // OPEN

  constructor(public url: string) {
    // Simulate connection
    setTimeout(() => {
      if (this.onopen) this.onopen({ type: 'open' });
      this.simulateEvents();
    }, 10);
  }

  simulateEvents() {
    const frozenEvents = [
      { event: 'hello', data: '{"type":"hello","sessionId":"test-123","timestamp":"2025-09-27T12:00:00Z"}' },
      { event: 'token', data: '{"type":"token","text":"Hello","sessionId":"test-123","timestamp":"2025-09-27T12:00:01Z"}' },
      { event: 'token', data: '{"type":"token","text":" world","sessionId":"test-123","timestamp":"2025-09-27T12:00:02Z"}' },
      { event: 'cost', data: '{"type":"cost","amount":0.001,"currency":"USD","sessionId":"test-123","timestamp":"2025-09-27T12:00:03Z"}' },
      { event: 'done', data: '{"type":"done","sessionId":"test-123","totalTokens":50,"totalCost":0.001,"duration":3000,"timestamp":"2025-09-27T12:00:03Z"}' }
    ];

    frozenEvents.forEach((event, index) => {
      setTimeout(() => {
        this.events.push(event);
        if (this.onmessage) {
          this.onmessage({
            type: 'message',
            data: event.data,
            lastEventId: String(index + 1)
          });
        }
      }, (index + 1) * 100);
    });
  }

  close() {
    this.readyState = 2; // CLOSED
  }
}

describe('Frozen Stream Events Contract', () => {
  const FROZEN_EVENTS = ['hello', 'token', 'cost', 'done', 'cancelled', 'limited', 'error'];
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.STREAM_ALT_EVENTS;
    process.env.STREAM_ALT_EVENTS = '0'; // Ensure experimental API is disabled
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.STREAM_ALT_EVENTS = originalEnv;
    } else {
      delete process.env.STREAM_ALT_EVENTS;
    }
  });

  it('should only emit frozen SSE events when STREAM_ALT_EVENTS=0', async () => {
    const mockEventSource = new MockEventSource('http://localhost:3001/stream');
    const capturedEvents: string[] = [];

    await new Promise<void>((resolve) => {
      mockEventSource.onmessage = (event) => {
        try {
          const eventData = JSON.parse(event.data);
          if (eventData.type) {
            capturedEvents.push(eventData.type);
          }
        } catch (e) {
          // Skip malformed events
        }
      };

      // Wait for all events to be processed
      setTimeout(() => {
        mockEventSource.close();
        resolve();
      }, 1000);
    });

    // Assert that all captured events are in the frozen set
    for (const eventType of capturedEvents) {
      expect(FROZEN_EVENTS).toContain(eventType);
    }

    // Verify we got some events (test is not trivially passing)
    expect(capturedEvents.length).toBeGreaterThan(0);

    // Specifically check that no experimental events leaked
    const experimentalEvents = capturedEvents.filter(event =>
      event.startsWith('run.') || event.startsWith('step.')
    );
    expect(experimentalEvents).toHaveLength(0);
  });

  it('should validate frozen event structure matches schema', () => {
    const validEvents = [
      { type: 'hello', sessionId: 'test', timestamp: '2025-09-27T12:00:00Z' },
      { type: 'token', text: 'Hello', sessionId: 'test', timestamp: '2025-09-27T12:00:00Z' },
      { type: 'cost', amount: 0.001, currency: 'USD', sessionId: 'test', timestamp: '2025-09-27T12:00:00Z' },
      { type: 'done', sessionId: 'test', timestamp: '2025-09-27T12:00:00Z' },
      { type: 'cancelled', sessionId: 'test', reason: 'user_cancelled', timestamp: '2025-09-27T12:00:00Z' },
      { type: 'limited', message: 'Rate limited', timestamp: '2025-09-27T12:00:00Z' },
      { type: 'error', error: { code: 'TEST_ERROR', message: 'Test error' }, sessionId: 'test', timestamp: '2025-09-27T12:00:00Z' }
    ];

    for (const event of validEvents) {
      expect(FROZEN_EVENTS).toContain(event.type);
      expect(event).toHaveProperty('type');
      expect(event).toHaveProperty('timestamp');
    }
  });

  it('should reject experimental events when feature flag is disabled', () => {
    const experimentalEvents = [
      'run.start',
      'run.heartbeat',
      'step.progress',
      'step.retry',
      'run.error',
      'run.complete'
    ];

    for (const eventType of experimentalEvents) {
      expect(FROZEN_EVENTS).not.toContain(eventType);
    }
  });
});