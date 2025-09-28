/**
 * Contract Tests - Persistent Snapshot Index API
 * Tests snapshot metadata storage, retrieval, and retention
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import {
  addSnapshotMetadata,
  getSnapshotMetadata,
  listSnapshots,
  handleSnapshotsListRequest,
  handleSnapshotGetRequest,
  getSnapshotIndexStatistics,
  cleanupExpiredSnapshots,
  initializeSnapshotIndex,
  resetSnapshotIndex
} from '../../src/lib/snapshot-index.js';

// Mock environment for testing
const originalEnv = process.env;
const testIndexPath = './artifacts/test-snapshot-index.json';

describe('Snapshot Index Contract Tests', () => {
  beforeEach(async () => {
    // Reset environment
    process.env = { ...originalEnv };

    // Set test configuration
    process.env.SNAPSHOT_INDEX_TTL_DAYS = '7';
    process.env.SNAPSHOT_INDEX_PATH = testIndexPath;

    // Clean up any existing test file
    try {
      await fs.unlink(testIndexPath);
    } catch {
      // File doesn't exist, that's fine
    }

    // Reset in-memory state
    resetSnapshotIndex();

    // Initialize fresh index
    initializeSnapshotIndex();
  });

  afterEach(async () => {
    process.env = originalEnv;

    // Clean up test file
    try {
      await fs.unlink(testIndexPath);
    } catch {
      // File doesn't exist, that's fine
    }
  });

  describe('Snapshot Metadata Management', () => {
    it('should add and retrieve snapshot metadata', () => {
      const metadata = {
        runId: 'test-run-123',
        org: 'acme-corp',
        scenarioId: 'scenario-1',
        seed: 42,
        createdAt: new Date().toISOString(),
        ttff_ms: 1500,
        cancel_ms: 500,
        version: 'v0.1.0',
        correlationId: 'corr-123'
      };

      addSnapshotMetadata(metadata);

      const retrieved = getSnapshotMetadata('test-run-123');
      expect(retrieved).toEqual(metadata);
    });

    it('should return null for non-existent snapshot', () => {
      const result = getSnapshotMetadata('non-existent-run');
      expect(result).toBeNull();
    });

    it('should replace existing metadata with same runId', () => {
      const metadata1 = {
        runId: 'test-run-123',
        org: 'acme-corp',
        scenarioId: 'scenario-1',
        seed: 42,
        createdAt: new Date().toISOString(),
        ttff_ms: 1500,
        version: 'v0.1.0'
      };

      const metadata2 = {
        runId: 'test-run-123',
        org: 'acme-corp',
        scenarioId: 'scenario-2',
        seed: 84,
        createdAt: new Date().toISOString(),
        ttff_ms: 2000,
        version: 'v0.1.0'
      };

      addSnapshotMetadata(metadata1);
      addSnapshotMetadata(metadata2);

      const retrieved = getSnapshotMetadata('test-run-123');
      expect(retrieved?.scenarioId).toBe('scenario-2');
      expect(retrieved?.ttff_ms).toBe(2000);
    });

    it('should sort snapshots by createdAt (newest first)', () => {
      const now = new Date();
      const older = new Date(now.getTime() - 1000);

      addSnapshotMetadata({
        runId: 'run-1',
        org: 'test-org',
        scenarioId: 'scenario-1',
        seed: 1,
        createdAt: older.toISOString(),
        ttff_ms: 1000,
        version: 'v0.1.0'
      });

      addSnapshotMetadata({
        runId: 'run-2',
        org: 'test-org',
        scenarioId: 'scenario-1',
        seed: 2,
        createdAt: now.toISOString(),
        ttff_ms: 1000,
        version: 'v0.1.0'
      });

      const list = listSnapshots();
      expect(list.items[0].runId).toBe('run-2'); // Newer first
      expect(list.items[1].runId).toBe('run-1');
    });
  });

  describe('Snapshot Listing', () => {
    beforeEach(() => {
      // Add test data
      const baseTime = new Date('2025-01-01T00:00:00Z').getTime();

      for (let i = 0; i < 5; i++) {
        addSnapshotMetadata({
          runId: `run-${i}`,
          org: i < 3 ? 'org-a' : 'org-b',
          scenarioId: `scenario-${i % 2}`,
          seed: i,
          createdAt: new Date(baseTime + i * 1000).toISOString(),
          ttff_ms: 1000 + i * 100,
          version: 'v0.1.0'
        });
      }
    });

    it('should list all snapshots by default', () => {
      const result = listSnapshots();

      expect(result.items).toHaveLength(5);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.hasMore).toBe(false);
    });

    it('should filter by org', () => {
      const result = listSnapshots('org-a');

      expect(result.items).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.items.every(item => item.org === 'org-a')).toBe(true);
    });

    it('should filter by since date', () => {
      const sinceDate = new Date('2025-01-01T00:00:02Z').toISOString();
      const result = listSnapshots(undefined, sinceDate);

      expect(result.items).toHaveLength(3); // runs 2, 3, 4
      expect(result.total).toBe(3);
    });

    it('should support pagination', () => {
      const page1 = listSnapshots(undefined, undefined, 1, 2);
      expect(page1.items).toHaveLength(2);
      expect(page1.page).toBe(1);
      expect(page1.limit).toBe(2);
      expect(page1.hasMore).toBe(true);

      const page2 = listSnapshots(undefined, undefined, 2, 2);
      expect(page2.items).toHaveLength(2);
      expect(page2.page).toBe(2);
      expect(page2.hasMore).toBe(true);

      const page3 = listSnapshots(undefined, undefined, 3, 2);
      expect(page3.items).toHaveLength(1);
      expect(page3.page).toBe(3);
      expect(page3.hasMore).toBe(false);
    });
  });

  describe('GET /snapshots', () => {
    beforeEach(() => {
      addSnapshotMetadata({
        runId: 'test-run',
        org: 'test-org',
        scenarioId: 'test-scenario',
        seed: 42,
        createdAt: new Date().toISOString(),
        ttff_ms: 1500,
        version: 'v0.1.0'
      });
    });

    it('should return snapshot list with default parameters', async () => {
      const result = await handleSnapshotsListRequest({});

      expect(result.status).toBe(200);
      expect(result.body.items).toHaveLength(1);
      expect(result.body.total).toBe(1);
      expect(result.body.page).toBe(1);
      expect(result.body.limit).toBe(50);

      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['Cache-Control']).toBe('no-store');
    });

    it('should validate page parameter', async () => {
      const result = await handleSnapshotsListRequest({ page: '0' });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('page must be a positive integer');
    });

    it('should validate limit parameter', async () => {
      const result = await handleSnapshotsListRequest({ limit: '250' });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('limit must be between 1 and 200');
    });

    it('should validate since parameter', async () => {
      const result = await handleSnapshotsListRequest({ since: 'invalid-date' });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('since must be a valid ISO8601 date');
    });

    it('should validate org parameter', async () => {
      const result = await handleSnapshotsListRequest({ org: '' });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('org must be a non-empty string');
    });

    it('should handle filter parameters correctly', async () => {
      const result = await handleSnapshotsListRequest({
        org: 'test-org',
        page: '1',
        limit: '10',
        since: '2025-01-01T00:00:00Z'
      });

      expect(result.status).toBe(200);
      expect(result.body.items.every((item: any) => item.org === 'test-org')).toBe(true);
    });
  });

  describe('GET /snapshots/{runId}', () => {
    beforeEach(() => {
      addSnapshotMetadata({
        runId: 'existing-run',
        org: 'test-org',
        scenarioId: 'test-scenario',
        seed: 42,
        createdAt: new Date().toISOString(),
        ttff_ms: 1500,
        version: 'v0.1.0'
      });
    });

    it('should return snapshot metadata for existing run', async () => {
      const result = await handleSnapshotGetRequest('existing-run');

      expect(result.status).toBe(200);
      expect(result.body.runId).toBe('existing-run');
      expect(result.body.org).toBe('test-org');

      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['Cache-Control']).toBe('no-store');
    });

    it('should return 404 for non-existent run', async () => {
      const result = await handleSnapshotGetRequest('non-existent-run');

      expect(result.status).toBe(404);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('Snapshot metadata for run non-existent-run not found');
    });

    it('should validate runId parameter', async () => {
      const result = await handleSnapshotGetRequest('');

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('runId parameter required');
    });

    it('should handle null runId', async () => {
      const result = await handleSnapshotGetRequest(null as any);

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
    });
  });

  describe('Snapshot Statistics', () => {
    beforeEach(() => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago

      // Add some test data
      addSnapshotMetadata({
        runId: 'recent-run',
        org: 'org-a',
        scenarioId: 'scenario-1',
        seed: 1,
        createdAt: now.toISOString(),
        ttff_ms: 1000,
        version: 'v0.1.0'
      });

      addSnapshotMetadata({
        runId: 'old-run',
        org: 'org-b',
        scenarioId: 'scenario-2',
        seed: 2,
        createdAt: yesterday.toISOString(),
        ttff_ms: 2000,
        version: 'v0.1.0'
      });
    });

    it('should return comprehensive statistics', () => {
      const stats = getSnapshotIndexStatistics();

      expect(stats).toHaveProperty('total_snapshots', 2);
      expect(stats).toHaveProperty('ttl_days', 7);
      expect(stats).toHaveProperty('index_file_path');
      expect(stats).toHaveProperty('orgs');
      expect(stats).toHaveProperty('scenarios');
      expect(stats).toHaveProperty('recent_snapshots');

      expect(stats.orgs['org-a']).toBe(1);
      expect(stats.orgs['org-b']).toBe(1);
      expect(stats.scenarios['scenario-1']).toBe(1);
      expect(stats.scenarios['scenario-2']).toBe(1);
      expect(stats.recent_snapshots).toBe(1); // Only the recent one
    });
  });

  describe('Cleanup and Retention', () => {
    it('should clean up expired snapshots', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10); // 10 days ago

      const recentDate = new Date();

      // Add old snapshot (should be cleaned)
      addSnapshotMetadata({
        runId: 'old-run',
        org: 'test-org',
        scenarioId: 'test-scenario',
        seed: 1,
        createdAt: oldDate.toISOString(),
        ttff_ms: 1000,
        version: 'v0.1.0'
      });

      // Add recent snapshot (should be kept)
      addSnapshotMetadata({
        runId: 'recent-run',
        org: 'test-org',
        scenarioId: 'test-scenario',
        seed: 2,
        createdAt: recentDate.toISOString(),
        ttff_ms: 1000,
        version: 'v0.1.0'
      });

      const cleaned = cleanupExpiredSnapshots();

      expect(cleaned).toBe(1); // One old entry cleaned
      expect(getSnapshotMetadata('old-run')).toBeNull();
      expect(getSnapshotMetadata('recent-run')).not.toBeNull();
    });

    it('should return 0 when no cleanup needed', () => {
      const recentDate = new Date();

      addSnapshotMetadata({
        runId: 'recent-run',
        org: 'test-org',
        scenarioId: 'test-scenario',
        seed: 1,
        createdAt: recentDate.toISOString(),
        ttff_ms: 1000,
        version: 'v0.1.0'
      });

      const cleaned = cleanupExpiredSnapshots();
      expect(cleaned).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should include timestamp in error responses', async () => {
      const result = await handleSnapshotsListRequest({ page: 'invalid' });

      expect(result.body.timestamp).toBeDefined();
      expect(() => new Date(result.body.timestamp)).not.toThrow();
    });

    it('should handle malformed query parameters gracefully', async () => {
      const result = await handleSnapshotsListRequest({ limit: 'not-a-number' });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
    });
  });

  describe('Response Format Validation', () => {
    beforeEach(() => {
      addSnapshotMetadata({
        runId: 'test-run',
        org: 'test-org',
        scenarioId: 'test-scenario',
        seed: 42,
        createdAt: new Date().toISOString(),
        ttff_ms: 1500,
        version: 'v0.1.0'
      });
    });

    it('should return consistent list response structure', async () => {
      const result = await handleSnapshotsListRequest({});

      expect(result.status).toBe(200);
      expect(result.body).toHaveProperty('items');
      expect(result.body).toHaveProperty('total');
      expect(result.body).toHaveProperty('page');
      expect(result.body).toHaveProperty('limit');
      expect(result.body).toHaveProperty('hasMore');

      expect(Array.isArray(result.body.items)).toBe(true);
      expect(typeof result.body.total).toBe('number');
      expect(typeof result.body.page).toBe('number');
      expect(typeof result.body.limit).toBe('number');
      expect(typeof result.body.hasMore).toBe('boolean');
    });

    it('should return consistent metadata structure', async () => {
      const result = await handleSnapshotGetRequest('test-run');

      expect(result.status).toBe(200);
      expect(result.body).toHaveProperty('runId');
      expect(result.body).toHaveProperty('org');
      expect(result.body).toHaveProperty('scenarioId');
      expect(result.body).toHaveProperty('seed');
      expect(result.body).toHaveProperty('createdAt');
      expect(result.body).toHaveProperty('ttff_ms');
      expect(result.body).toHaveProperty('version');

      expect(typeof result.body.runId).toBe('string');
      expect(typeof result.body.org).toBe('string');
      expect(typeof result.body.seed).toBe('number');
      expect(typeof result.body.ttff_ms).toBe('number');
    });

    it('should return consistent error response structure', async () => {
      const result = await handleSnapshotsListRequest({ page: '0' });

      expect(result.status).toBe(400);
      expect(result.body).toHaveProperty('type');
      expect(result.body).toHaveProperty('message');
      expect(result.body).toHaveProperty('timestamp');
      expect(['BAD_INPUT', 'RATE_LIMIT', 'INTERNAL_ERROR']).toContain(result.body.type);
    });
  });
});