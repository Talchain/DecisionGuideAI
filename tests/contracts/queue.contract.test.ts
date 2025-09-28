/**
 * Contract Tests - Concurrency Queue API
 * Tests queue status, slot management, and fair scheduling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  requestRunSlot,
  releaseRunSlot,
  getQueueStatus,
  handleQueueStatusRequest,
  handleQueueBumpRequest,
  getQueueStatistics,
  cleanupExpiredEntries,
  resetQueueState
} from '../../src/lib/concurrency-queue.js';

// Mock environment for testing
const originalEnv = process.env;

describe('Concurrency Queue Contract Tests', () => {
  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };

    // Set default test configuration
    process.env.MAX_CONCURRENCY_PER_ORG = '2';
    process.env.QUEUE_MAX_DEPTH = '5';
    process.env.QUEUE_RETRY_AFTER_S = '3';
    process.env.QUEUE_TIMEOUT_MS = '1000'; // 1 second for tests

    // Reset queue state
    resetQueueState();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Slot Management', () => {
    it('should allow run within concurrency limit', async () => {
      const result = await requestRunSlot('test-org', 'run-1');

      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBeUndefined();
      expect(result.reason).toBeUndefined();
    });

    it('should queue run when at concurrency limit', async () => {
      // Fill concurrency slots
      await requestRunSlot('test-org', 'run-1');
      await requestRunSlot('test-org', 'run-2');

      // Third run should be queued
      const queuePromise = requestRunSlot('test-org', 'run-3');

      // Should not resolve immediately
      let resolved = false;
      queuePromise.then(() => { resolved = true; });

      // Give it a moment
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(resolved).toBe(false);

      // Release a slot
      releaseRunSlot('test-org', 'run-1');

      // Now the queued run should be allowed
      const result = await queuePromise;
      expect(result.allowed).toBe(true);
    });

    it('should reject when queue is full', async () => {
      // Fill concurrency slots
      await requestRunSlot('test-org', 'run-1');
      await requestRunSlot('test-org', 'run-2');

      // Fill queue (MAX_DEPTH = 5)
      const queuePromises = [];
      for (let i = 3; i <= 7; i++) {
        queuePromises.push(requestRunSlot('test-org', `run-${i}`));
      }

      // 8th run should be rejected
      const result = await requestRunSlot('test-org', 'run-8');

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBe(3);
      expect(result.reason).toContain('Queue full');
    });

    it('should handle different orgs independently', async () => {
      // Fill slots for org-1
      await requestRunSlot('org-1', 'run-1');
      await requestRunSlot('org-1', 'run-2');

      // org-2 should still have slots available
      const result = await requestRunSlot('org-2', 'run-1');

      expect(result.allowed).toBe(true);
    });

    it('should release slots properly', async () => {
      await requestRunSlot('test-org', 'run-1');
      await requestRunSlot('test-org', 'run-2');

      // Check status shows 2 active
      const statusBefore = getQueueStatus('test-org');
      expect(statusBefore.active).toBe(2);

      // Release one slot
      releaseRunSlot('test-org', 'run-1');

      // Check status shows 1 active
      const statusAfter = getQueueStatus('test-org');
      expect(statusAfter.active).toBe(1);
    });
  });

  describe('GET /queue/status', () => {
    it('should require org parameter', async () => {
      const result = await handleQueueStatusRequest({});

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('org parameter required');
    });

    it('should return queue status for org', async () => {
      // Set up some queue state
      await requestRunSlot('test-org', 'run-1');

      const result = await handleQueueStatusRequest({ org: 'test-org' });

      expect(result.status).toBe(200);
      expect(result.body).toHaveProperty('org', 'test-org');
      expect(result.body).toHaveProperty('active', 1);
      expect(result.body).toHaveProperty('queued', 0);
      expect(result.body).toHaveProperty('max', 2);

      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['Cache-Control']).toBe('no-store');
    });

    it('should return zero counts for org with no activity', async () => {
      const result = await handleQueueStatusRequest({ org: 'empty-org' });

      expect(result.status).toBe(200);
      expect(result.body.active).toBe(0);
      expect(result.body.queued).toBe(0);
      expect(result.body.max).toBe(2);
    });
  });

  describe('POST /queue/bump', () => {
    it('should return 404 when TEST_ROUTES not enabled', async () => {
      delete process.env.TEST_ROUTES;

      const result = await handleQueueBumpRequest();

      expect(result.status).toBe(404);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('requires TEST_ROUTES=1');
    });

    it('should process queued runs when TEST_ROUTES enabled', async () => {
      process.env.TEST_ROUTES = '1';

      // Fill concurrency and add to queue
      await requestRunSlot('test-org', 'run-1');
      await requestRunSlot('test-org', 'run-2');

      // This should queue
      const queuePromise = requestRunSlot('test-org', 'run-3');

      const result = await handleQueueBumpRequest();

      expect(result.status).toBe(200);
      expect(result.body).toHaveProperty('processed');
      expect(typeof result.body.processed).toBe('number');

      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['Cache-Control']).toBe('no-store');
    });
  });

  describe('Queue Statistics', () => {
    it('should return comprehensive queue statistics', () => {
      const stats = getQueueStatistics();

      expect(stats).toHaveProperty('max_concurrency_per_org', 2);
      expect(stats).toHaveProperty('queue_max_depth', 5);
      expect(stats).toHaveProperty('retry_after_seconds', 3);
      expect(stats).toHaveProperty('total_orgs_active');
      expect(stats).toHaveProperty('total_orgs_queued');
      expect(stats).toHaveProperty('active_runs_by_org');
      expect(stats).toHaveProperty('queued_runs_by_org');

      expect(typeof stats.total_orgs_active).toBe('number');
      expect(typeof stats.active_runs_by_org).toBe('object');
    });

    it('should track per-org statistics correctly', async () => {
      await requestRunSlot('org-1', 'run-1');
      await requestRunSlot('org-2', 'run-1');

      const stats = getQueueStatistics();

      expect(stats.total_orgs_active).toBe(2);
      expect(stats.active_runs_by_org['org-1']).toBe(1);
      expect(stats.active_runs_by_org['org-2']).toBe(1);
    });
  });

  describe('Queue Cleanup', () => {
    it('should clean up expired entries', () => {
      // This tests the interface but may not test actual expiry
      // since expired entries are cleaned by timeout logic
      const cleaned = cleanupExpiredEntries();

      expect(typeof cleaned).toBe('number');
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid run IDs gracefully', async () => {
      const result = await requestRunSlot('test-org', '');

      // Should still work - empty string is a valid runId
      expect(result.allowed).toBe(true);
    });

    it('should handle null org gracefully', async () => {
      // TypeScript would prevent this, but test runtime behavior
      const result = await requestRunSlot(null as any, 'run-1');

      // Should handle null org without crashing
      expect(result).toBeDefined();
    });

    it('should include timestamp in error responses', async () => {
      const result = await handleQueueStatusRequest({});

      expect(result.body.timestamp).toBeDefined();
      expect(() => new Date(result.body.timestamp)).not.toThrow();
    });
  });

  describe('Environment Configuration', () => {
    it('should respect MAX_CONCURRENCY_PER_ORG setting', async () => {
      process.env.MAX_CONCURRENCY_PER_ORG = '1';

      // First run should be allowed
      const result1 = await requestRunSlot('test-org', 'run-1');
      expect(result1.allowed).toBe(true);

      // Second run should be queued (not allowed immediately)
      const queuePromise = requestRunSlot('test-org', 'run-2');

      let resolved = false;
      queuePromise.then(() => { resolved = true; });

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(resolved).toBe(false);
    });

    it('should respect QUEUE_RETRY_AFTER_S setting', async () => {
      process.env.QUEUE_RETRY_AFTER_S = '10';

      // Fill slots and queue
      await requestRunSlot('test-org', 'run-1');
      await requestRunSlot('test-org', 'run-2');

      // Fill queue beyond limit
      for (let i = 3; i <= 8; i++) {
        await requestRunSlot('test-org', `run-${i}`);
      }

      const result = await requestRunSlot('test-org', 'run-overflow');

      expect(result.retryAfter).toBe(10);
    });
  });

  describe('Response Format Validation', () => {
    it('should return consistent queue status structure', async () => {
      const result = await handleQueueStatusRequest({ org: 'test-org' });

      expect(result.status).toBe(200);
      expect(result.body).toHaveProperty('org');
      expect(result.body).toHaveProperty('active');
      expect(result.body).toHaveProperty('queued');
      expect(result.body).toHaveProperty('max');

      expect(typeof result.body.org).toBe('string');
      expect(typeof result.body.active).toBe('number');
      expect(typeof result.body.queued).toBe('number');
      expect(typeof result.body.max).toBe('number');
    });

    it('should return consistent error response structure', async () => {
      const result = await handleQueueStatusRequest({});

      expect(result.status).toBe(400);
      expect(result.body).toHaveProperty('type');
      expect(result.body).toHaveProperty('message');
      expect(result.body).toHaveProperty('timestamp');
      expect(['BAD_INPUT', 'RATE_LIMIT', 'INTERNAL_ERROR']).toContain(result.body.type);
    });
  });
});