/**
 * Out-of-contract event guard test
 * Validates that only frozen event types are allowed
 */

import { describe, test, expect } from 'vitest';
import { isSSEEventType } from '../../src/types/sse-events';

describe('SSE Event Guard Test', () => {
  test('should only allow frozen event types', () => {
    // Frozen event types should be valid
    const frozenEvents = ['hello', 'token', 'cost', 'done', 'cancelled', 'limited', 'error'];
    frozenEvents.forEach(event => {
      expect(isSSEEventType(event)).toBe(true);
    });

    // Non-frozen event types should be rejected
    const nonFrozenEvents = ['start', 'progress', 'update', 'warning', 'info', 'debug'];
    nonFrozenEvents.forEach(event => {
      expect(isSSEEventType(event)).toBe(false);
    });

    console.log('✅ SSE event guard working correctly');
  });

  test('should prevent emission of non-frozen events', () => {
    // This test simulates what would happen if someone tried to emit a non-frozen event
    const mockEmitAttempts = [
      { event: 'hello', allowed: true },
      { event: 'progress', allowed: false },  // Non-frozen
      { event: 'token', allowed: true },
      { event: 'start', allowed: false },     // Non-frozen
      { event: 'done', allowed: true },
      { event: 'custom', allowed: false }     // Non-frozen
    ];

    mockEmitAttempts.forEach(({ event, allowed }) => {
      const isAllowed = isSSEEventType(event);
      expect(isAllowed).toBe(allowed);
    });

    console.log('✅ Event emission guard validated');
  });
});