/**
 * Contract Tests - Snapshots API
 * Tests ZIP bundle structure and content validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  handleSnapshotRequest,
  handleCompareSnapshotRequest,
  storeRunSnapshot,
  createSnapshotBundle,
  createCompareSnapshotBundle
} from '../../src/lib/snapshots.js';

describe('Snapshots Contract Tests', () => {
  beforeEach(() => {
    // Clean state for each test
  });

  describe('GET /runs/{runId}/snapshot', () => {
    it('should return 404 for non-existent run', async () => {
      const result = await handleSnapshotRequest('non-existent-run');

      expect(result.status).toBe(404);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('not found');
      expect(result.body.timestamp).toBeDefined();
    });

    it('should return ZIP bundle for existing run', async () => {
      const runId = 'test-run-123';
      const scenarioId = 'test-scenario';
      const seed = 42;

      // Store a test snapshot
      storeRunSnapshot(runId, scenarioId, seed);

      const result = await handleSnapshotRequest(runId);

      expect(result.status).toBe(200);
      expect(result.headers['Content-Type']).toBe('application/zip');
      expect(result.headers['Content-Disposition']).toContain('attachment');
      expect(result.headers['Content-Disposition']).toContain(`snapshot_${runId}_seed-${seed}_v0.1.0.zip`);
      expect(result.headers['Cache-Control']).toBe('no-store');
      expect(result.body).toBeInstanceOf(Buffer);
    });

    it('should include all required files in bundle', () => {
      const mockSnapshot = {
        runId: 'test-run',
        scenarioId: 'test-scenario',
        seed: 42,
        scenario: { title: 'Test Scenario' },
        report: { schema: 'report.v1' },
        sseEvents: [{ type: 'start' }, { type: 'done' }],
        timings: { ttff_ms: 150 },
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      const zipBuffer = createSnapshotBundle(mockSnapshot);
      expect(zipBuffer).toBeInstanceOf(Buffer);
      expect(zipBuffer.length).toBeGreaterThan(0);
    });
  });

  describe('POST /compare/snapshot', () => {
    it('should require both left and right scenarios', async () => {
      const result = await handleCompareSnapshotRequest({});

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('Both left and right scenarios required');
    });

    it('should return ZIP bundle for compare request', async () => {
      const requestBody = {
        left: { scenarioId: 'scenario-a', seed: 42 },
        right: { scenarioId: 'scenario-b', seed: 42 }
      };

      const result = await handleCompareSnapshotRequest(requestBody);

      expect(result.status).toBe(200);
      expect(result.headers['Content-Type']).toBe('application/zip');
      expect(result.headers['Content-Disposition']).toContain('attachment');
      expect(result.headers['Content-Disposition']).toContain('compare_scenario-a-vs-scenario-b_seed-42_v0.1.0.zip');
      expect(result.body).toBeInstanceOf(Buffer);
    });

    it('should include compare files in bundle', () => {
      const leftSnapshot = {
        runId: 'left-run',
        scenarioId: 'left-scenario',
        seed: 42,
        scenario: { title: 'Left Scenario' },
        report: { schema: 'report.v1' },
        sseEvents: [{ type: 'start' }],
        timings: { ttff_ms: 150 },
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      const rightSnapshot = {
        runId: 'right-run',
        scenarioId: 'right-scenario',
        seed: 42,
        scenario: { title: 'Right Scenario' },
        report: { schema: 'report.v1' },
        sseEvents: [{ type: 'start' }],
        timings: { ttff_ms: 200 },
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      const compareResult = {
        schema: 'compare.v1',
        delta: { most_likely_diff: 1000 },
        headline: 'Test comparison'
      };

      const zipBuffer = createCompareSnapshotBundle(leftSnapshot, rightSnapshot, compareResult);
      expect(zipBuffer).toBeInstanceOf(Buffer);
      expect(zipBuffer.length).toBeGreaterThan(0);
    });
  });

  describe('Bundle Content Validation', () => {
    it('should contain scenario.json with valid structure', () => {
      const mockSnapshot = {
        runId: 'test-run',
        scenarioId: 'test-scenario',
        seed: 42,
        scenario: {
          title: 'Test Decision',
          options: [
            { id: 'opt1', name: 'Option 1' },
            { id: 'opt2', name: 'Option 2' }
          ]
        },
        report: { schema: 'report.v1' },
        sseEvents: [],
        timings: { ttff_ms: 150 },
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      const zipBuffer = createSnapshotBundle(mockSnapshot);
      expect(zipBuffer).toBeInstanceOf(Buffer);
    });

    it('should contain seed.txt with correct format', () => {
      const mockSnapshot = {
        runId: 'test-run',
        scenarioId: 'test-scenario',
        seed: 999,
        scenario: {},
        report: {},
        sseEvents: [],
        timings: {},
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      const zipBuffer = createSnapshotBundle(mockSnapshot);
      expect(zipBuffer).toBeInstanceOf(Buffer);
    });

    it('should contain report.json with schema field', () => {
      const mockSnapshot = {
        runId: 'test-run',
        scenarioId: 'test-scenario',
        seed: 42,
        scenario: {},
        report: {
          schema: 'report.v1',
          decision: { title: 'Test Decision' },
          meta: { seed: 42 }
        },
        sseEvents: [],
        timings: {},
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      const zipBuffer = createSnapshotBundle(mockSnapshot);
      expect(zipBuffer).toBeInstanceOf(Buffer);
    });

    it('should contain stream.ndjson with valid NDJSON format', () => {
      const mockSnapshot = {
        runId: 'test-run',
        scenarioId: 'test-scenario',
        seed: 42,
        scenario: {},
        report: {},
        sseEvents: [
          { type: 'start', data: { sessionId: 'test' } },
          { type: 'token', data: { text: 'hello' } },
          { type: 'done', data: { sessionId: 'test' } }
        ],
        timings: {},
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      const zipBuffer = createSnapshotBundle(mockSnapshot);
      expect(zipBuffer).toBeInstanceOf(Buffer);
    });

    it('should contain timings.json with performance metrics', () => {
      const mockSnapshot = {
        runId: 'test-run',
        scenarioId: 'test-scenario',
        seed: 42,
        scenario: {},
        report: {},
        sseEvents: [],
        timings: {
          ttff_ms: 150,
          total_duration_ms: 2500,
          cancel_latency_ms: 50
        },
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      const zipBuffer = createSnapshotBundle(mockSnapshot);
      expect(zipBuffer).toBeInstanceOf(Buffer);
    });

    it('should contain provenance.json with version info', () => {
      const mockSnapshot = {
        runId: 'test-run',
        scenarioId: 'test-scenario',
        seed: 42,
        scenario: {},
        report: {},
        sseEvents: [],
        timings: {},
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      const zipBuffer = createSnapshotBundle(mockSnapshot);
      expect(zipBuffer).toBeInstanceOf(Buffer);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid runId format gracefully', async () => {
      const result = await handleSnapshotRequest('');

      expect(result.status).toBe(404);
      expect(result.body.type).toBe('BAD_INPUT');
    });

    it('should handle missing left scenario', async () => {
      const result = await handleCompareSnapshotRequest({
        right: { scenarioId: 'test', seed: 42 }
      });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
    });

    it('should handle missing right scenario', async () => {
      const result = await handleCompareSnapshotRequest({
        left: { scenarioId: 'test', seed: 42 }
      });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
    });
  });
});