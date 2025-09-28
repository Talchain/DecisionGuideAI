/**
 * Contract Tests - CSV/JSON Exporters
 * Tests export format validation and currency labeling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  handleReportCsvRequest,
  handleCompareCsvRequest,
  handleBatchCsvRequest
} from '../../src/lib/exporters.js';
import { lookupRun, registerRunExecution, clearRegistry } from '../../src/lib/run-registry.js';

describe('Exporters Contract Tests', () => {
  beforeEach(() => {
    clearRegistry();
  });

  describe('GET /export/report.csv', () => {
    it('should require runId parameter', async () => {
      const result = await handleReportCsvRequest({});

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('runId parameter required');
    });

    it('should return 404 for non-existent run', async () => {
      const result = await handleReportCsvRequest({ runId: 'non-existent' });

      expect(result.status).toBe(404);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('not found');
    });

    it('should return CSV for existing run', async () => {
      // Create a run with report
      const lookupResult = lookupRun('test-scenario', 42);
      const mockReport = {
        schema: 'report.v1',
        decision: {
          title: 'Test Decision',
          options: [
            { id: 'opt1', name: 'Option 1', score: 0.8, description: 'First option' },
            { id: 'opt2', name: 'Option 2', score: 0.6, description: 'Second option' }
          ]
        },
        recommendation: { primary: 'opt1' },
        analysis: { confidence: 'high' },
        meta: { scenarioId: 'test-scenario', seed: 42, timestamp: '2024-01-01T00:00:00.000Z' }
      };

      registerRunExecution(lookupResult.runId, 'test-scenario', 42, [], mockReport);

      const result = await handleReportCsvRequest({ runId: lookupResult.runId });

      expect(result.status).toBe(200);
      expect(result.headers['Content-Type']).toBe('text/csv');
      expect(result.headers['Content-Disposition']).toContain('attachment');
      expect(result.headers['Content-Disposition']).toContain('report');
      expect(result.headers['Content-Disposition']).toContain('seed-42');
      expect(result.headers['Content-Disposition']).toContain('v0.1.0');
      expect(result.headers['Cache-Control']).toBe('no-store');
      expect(typeof result.body).toBe('string');
    });

    it('should include CSV headers', async () => {
      const lookupResult = lookupRun('test-scenario', 42);
      const mockReport = {
        schema: 'report.v1',
        decision: { title: 'Test', options: [{ id: 'opt1', name: 'Option 1', score: 0.8 }] },
        recommendation: { primary: 'opt1' },
        analysis: { confidence: 'medium' },
        meta: { scenarioId: 'test-scenario', seed: 42 }
      };

      registerRunExecution(lookupResult.runId, 'test-scenario', 42, [], mockReport);

      const result = await handleReportCsvRequest({ runId: lookupResult.runId });
      const csvLines = result.body.split('\n');

      // Check header row
      const headers = csvLines[0].split(',');
      expect(headers).toContain('run_id');
      expect(headers).toContain('scenario_id');
      expect(headers).toContain('seed');
      expect(headers).toContain('currency');
      expect(headers).toContain('version');
    });

    it('should include currency label', async () => {
      const lookupResult = lookupRun('test-scenario', 42);
      const mockReport = {
        schema: 'report.v1',
        decision: { title: 'Test', options: [{ id: 'opt1', name: 'Option 1' }] },
        meta: { scenarioId: 'test-scenario', seed: 42 }
      };

      registerRunExecution(lookupResult.runId, 'test-scenario', 42, [], mockReport);

      const result = await handleReportCsvRequest({ runId: lookupResult.runId });

      expect(result.body).toContain('USD');
    });

    it('should include version in filename and content', async () => {
      const lookupResult = lookupRun('test-scenario', 42);
      const mockReport = { schema: 'report.v1', decision: { options: [] }, meta: { seed: 42 } };

      registerRunExecution(lookupResult.runId, 'test-scenario', 42, [], mockReport);

      const result = await handleReportCsvRequest({ runId: lookupResult.runId });

      expect(result.headers['Content-Disposition']).toContain('v0.1.0');
      expect(result.body).toContain('v0.1.0');
    });
  });

  describe('GET /export/compare.csv', () => {
    it('should require left parameter', async () => {
      const result = await handleCompareCsvRequest({ right: 'run-2' });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('left and right runId parameters required');
    });

    it('should require right parameter', async () => {
      const result = await handleCompareCsvRequest({ left: 'run-1' });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('left and right runId parameters required');
    });

    it('should return 404 for non-existent runs', async () => {
      const result = await handleCompareCsvRequest({ left: 'non-existent-1', right: 'non-existent-2' });

      expect(result.status).toBe(404);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('One or both runs not found');
    });

    it('should return CSV for valid comparison', async () => {
      // Create two runs
      const leftResult = lookupRun('scenario-a', 42);
      const rightResult = lookupRun('scenario-b', 42);

      const leftReport = {
        schema: 'report.v1',
        meta: { scenarioId: 'scenario-a', seed: 42 },
        analysis: { most_likely_outcome: 1000000 }
      };

      const rightReport = {
        schema: 'report.v1',
        meta: { scenarioId: 'scenario-b', seed: 42 },
        analysis: { most_likely_outcome: 1100000 }
      };

      registerRunExecution(leftResult.runId, 'scenario-a', 42, [], leftReport);
      registerRunExecution(rightResult.runId, 'scenario-b', 42, [], rightReport);

      const result = await handleCompareCsvRequest({ left: leftResult.runId, right: rightResult.runId });

      expect(result.status).toBe(200);
      expect(result.headers['Content-Type']).toBe('text/csv');
      expect(result.headers['Content-Disposition']).toContain('compare');
      expect(result.headers['Content-Disposition']).toContain('scenario-a-vs-scenario-b');
      expect(typeof result.body).toBe('string');
    });

    it('should include comparison CSV headers', async () => {
      const leftResult = lookupRun('scenario-a', 42);
      const rightResult = lookupRun('scenario-b', 42);

      registerRunExecution(leftResult.runId, 'scenario-a', 42, [], { schema: 'report.v1', meta: { scenarioId: 'scenario-a', seed: 42 } });
      registerRunExecution(rightResult.runId, 'scenario-b', 42, [], { schema: 'report.v1', meta: { scenarioId: 'scenario-b', seed: 42 } });

      const result = await handleCompareCsvRequest({ left: leftResult.runId, right: rightResult.runId });
      const csvLines = result.body.split('\n');

      const headers = csvLines[0].split(',');
      expect(headers).toContain('metric');
      expect(headers).toContain('left_run_id');
      expect(headers).toContain('right_run_id');
      expect(headers).toContain('difference');
      expect(headers).toContain('percentage_change');
      expect(headers).toContain('currency');
    });
  });

  describe('GET /export/batch.csv', () => {
    it('should require baseline parameter', async () => {
      const result = await handleBatchCsvRequest({ items: 'a,b,c' });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('baseline and items parameters required');
    });

    it('should require items parameter', async () => {
      const result = await handleBatchCsvRequest({ baseline: 'scenario-a' });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('baseline and items parameters required');
    });

    it('should reject empty items', async () => {
      const result = await handleBatchCsvRequest({ baseline: 'scenario-a', items: '' });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('At least one item required');
    });

    it('should return CSV for valid batch request', async () => {
      const result = await handleBatchCsvRequest({
        baseline: 'scenario-a',
        items: 'scenario-a,scenario-b,scenario-c'
      });

      expect(result.status).toBe(200);
      expect(result.headers['Content-Type']).toBe('text/csv');
      expect(result.headers['Content-Disposition']).toContain('batch');
      expect(result.headers['Content-Disposition']).toContain('scenario-a');
      expect(typeof result.body).toBe('string');
    });

    it('should include batch CSV headers', async () => {
      const result = await handleBatchCsvRequest({
        baseline: 'scenario-a',
        items: 'scenario-a,scenario-b'
      });

      const csvLines = result.body.split('\n');
      const headers = csvLines[0].split(',');

      expect(headers).toContain('rank');
      expect(headers).toContain('scenario_id');
      expect(headers).toContain('most_likely');
      expect(headers).toContain('delta_vs_baseline_pct');
      expect(headers).toContain('confidence');
      expect(headers).toContain('baseline_scenario');
      expect(headers).toContain('currency');
    });

    it('should parse comma-separated items correctly', async () => {
      const result = await handleBatchCsvRequest({
        baseline: 'scenario-a',
        items: 'scenario-a,scenario-b,scenario-c'
      });

      const csvLines = result.body.split('\n');
      expect(csvLines).toHaveLength(4); // Header + 3 data rows
    });
  });

  describe('CSV Format Validation', () => {
    it('should escape CSV special characters', async () => {
      const lookupResult = lookupRun('test-scenario', 42);
      const mockReport = {
        schema: 'report.v1',
        decision: {
          title: 'Test, "Decision" with\nspecial chars',
          options: [{ id: 'opt1', name: 'Option, with "quotes"', description: 'Multi\nline\ndescription' }]
        },
        meta: { scenarioId: 'test-scenario', seed: 42 }
      };

      registerRunExecution(lookupResult.runId, 'test-scenario', 42, [], mockReport);

      const result = await handleReportCsvRequest({ runId: lookupResult.runId });

      // Should not break CSV parsing
      const csvLines = result.body.split('\n');
      expect(csvLines.length).toBeGreaterThan(1);

      // Check for proper escaping
      expect(result.body).toContain('"');
    });

    it('should handle null and undefined values', async () => {
      const lookupResult = lookupRun('test-scenario', 42);
      const mockReport = {
        schema: 'report.v1',
        decision: {
          title: null,
          options: [{ id: 'opt1', name: undefined, score: null }]
        },
        meta: { scenarioId: 'test-scenario', seed: 42 }
      };

      registerRunExecution(lookupResult.runId, 'test-scenario', 42, [], mockReport);

      const result = await handleReportCsvRequest({ runId: lookupResult.runId });

      expect(result.status).toBe(200);
      expect(typeof result.body).toBe('string');
    });
  });

  describe('Filename Generation', () => {
    it('should include seed in report filename', async () => {
      const lookupResult = lookupRun('test-scenario', 999);
      const mockReport = { schema: 'report.v1', decision: { options: [] }, meta: { seed: 999 } };

      registerRunExecution(lookupResult.runId, 'test-scenario', 999, [], mockReport);

      const result = await handleReportCsvRequest({ runId: lookupResult.runId });

      expect(result.headers['Content-Disposition']).toContain('seed-999');
    });

    it('should include scenario names in compare filename', async () => {
      const leftResult = lookupRun('pricing-conservative', 42);
      const rightResult = lookupRun('pricing-aggressive', 42);

      registerRunExecution(leftResult.runId, 'pricing-conservative', 42, [], { schema: 'report.v1', meta: { scenarioId: 'pricing-conservative', seed: 42 } });
      registerRunExecution(rightResult.runId, 'pricing-aggressive', 42, [], { schema: 'report.v1', meta: { scenarioId: 'pricing-aggressive', seed: 42 } });

      const result = await handleCompareCsvRequest({ left: leftResult.runId, right: rightResult.runId });

      expect(result.headers['Content-Disposition']).toContain('pricing-conservative-vs-pricing-aggressive');
    });

    it('should include date in filename', async () => {
      const lookupResult = lookupRun('test-scenario', 42);
      const mockReport = { schema: 'report.v1', decision: { options: [] }, meta: { seed: 42 } };

      registerRunExecution(lookupResult.runId, 'test-scenario', 42, [], mockReport);

      const result = await handleReportCsvRequest({ runId: lookupResult.runId });

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      expect(result.headers['Content-Disposition']).toContain(today);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing query parameters gracefully', async () => {
      const result = await handleReportCsvRequest(null);

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
    });

    it('should include error timestamps', async () => {
      const result = await handleReportCsvRequest({});

      expect(result.body.timestamp).toBeDefined();
      expect(new Date(result.body.timestamp)).toBeInstanceOf(Date);
    });
  });
});