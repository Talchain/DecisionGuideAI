/**
 * Idempotent jobs.cancel test
 * Tests that cancelling the same job multiple times is handled correctly
 */

import { describe, test, expect } from 'vitest';
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

describe('Jobs Cancel Idempotency Test', () => {
  test('should handle multiple cancel calls idempotently', async () => {
    const jobId = 'idempotent-test-job';

    // First cancel - should be fast and succeed
    const start1 = Date.now();
    const response1 = await fetch(`${BASE_URL}/jobs/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    });
    const time1 = Date.now() - start1;

    expect(response1.status).toBe(200);
    const data1 = await response1.json();
    expect(data1.cancelled).toBe(true);
    expect(data1.jobId).toBe(jobId);

    // Second cancel - should be idempotent
    const start2 = Date.now();
    const response2 = await fetch(`${BASE_URL}/jobs/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    });
    const time2 = Date.now() - start2;

    expect(response2.status).toBe(200);
    const data2 = await response2.json();
    expect(data2.cancelled).toBe(true);
    expect(data2.jobId).toBe(jobId);

    // Third cancel - should still be idempotent
    const start3 = Date.now();
    const response3 = await fetch(`${BASE_URL}/jobs/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    });
    const time3 = Date.now() - start3;

    expect(response3.status).toBe(200);
    const data3 = await response3.json();
    expect(data3.cancelled).toBe(true);
    expect(data3.jobId).toBe(jobId);

    console.log(`✅ Cancel times: ${time1}ms, ${time2}ms, ${time3}ms - all idempotent`);

    // All should be reasonably fast (under 200ms)
    expect(time1).toBeLessThan(200);
    expect(time2).toBeLessThan(200);
    expect(time3).toBeLessThan(200);
  });

  test('should handle missing jobId consistently', async () => {
    const response = await fetch(`${BASE_URL}/jobs/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(400);
    const errorData = await response.json();
    expect(errorData.code).toBe('BAD_INPUT');
    expect(errorData.retryable).toBe(false);

    console.log('✅ Missing jobId handled consistently');
  });
});