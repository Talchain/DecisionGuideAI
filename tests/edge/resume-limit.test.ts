/**
 * Resume-limit edge case test
 * Validates that resume functionality is limited to once per session
 */

import { describe, test, expect } from 'vitest';
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

describe('Resume-Once Limit Test', () => {
  test('should refuse second resume attempt', async () => {
    const seed = 'resume-test-123';

    // First resume should succeed
    const firstResume = await fetch(`${BASE_URL}/stream?seed=${seed}&resume=1`, {
      headers: { 'Accept': 'text/event-stream', 'Last-Event-ID': 'evt-1' }
    });
    expect(firstResume.status).toBe(200);

    // Wait a bit for session to register
    await new Promise(resolve => setTimeout(resolve, 100));

    // Second resume should be refused
    const secondResume = await fetch(`${BASE_URL}/stream?seed=${seed}&resume=1`, {
      headers: { 'Accept': 'text/event-stream', 'Last-Event-ID': 'evt-2' }
    });

    expect(secondResume.status).toBe(400);

    const errorData = await secondResume.json();
    expect(errorData.code).toBe('BAD_INPUT');
    expect(errorData.message).toContain('resume-once limit');
    expect(errorData.retryable).toBe(false);

    console.log('✅ Resume-once limit enforced correctly');
  });
});