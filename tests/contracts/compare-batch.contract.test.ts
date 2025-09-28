/**
 * Contract Tests - Batch Compare API
 * Tests multi-scenario ranking and response schema
 */

import { describe, it, expect } from 'vitest';
import { handleBatchCompareRequest } from '../../src/lib/batch-compare.js';

describe('Batch Compare Contract Tests', () => {
  describe('POST /compare/batch', () => {
    it('should require items array', async () => {
      const result = await handleBatchCompareRequest({});

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('Request must include items array');
    });

    it('should reject empty items array', async () => {
      const result = await handleBatchCompareRequest({ items: [] });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('At least one item required');
    });

    it('should reject too many items', async () => {
      const items = Array.from({ length: 11 }, (_, i) => ({
        scenarioId: `scenario-${i}`,
        seed: 42
      }));

      const result = await handleBatchCompareRequest({ items });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('Maximum 10 items allowed');
    });

    it('should require scenarioId for each item', async () => {
      const result = await handleBatchCompareRequest({
        items: [{ seed: 42 }]
      });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('Item 1: scenarioId required');
    });

    it('should require seed for each item', async () => {
      const result = await handleBatchCompareRequest({
        items: [{ scenarioId: 'test' }]
      });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('Item 1: seed must be an integer');
    });

    it('should validate seed as integer', async () => {
      const result = await handleBatchCompareRequest({
        items: [{ scenarioId: 'test', seed: 'invalid' }]
      });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('Item 1: seed must be an integer');
    });

    it('should reject duplicate scenario IDs', async () => {
      const result = await handleBatchCompareRequest({
        items: [
          { scenarioId: 'test', seed: 42 },
          { scenarioId: 'test', seed: 17 }
        ]
      });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toContain('Duplicate scenarioId not allowed');
    });

    it('should return valid batch comparison for single item', async () => {
      const result = await handleBatchCompareRequest({
        items: [
          { scenarioId: 'scenario-a', seed: 42 }
        ]
      });

      expect(result.status).toBe(200);
      expect(result.body.schema).toBe('compare-batch.v1');
      expect(result.body.ranked).toHaveLength(1);
      expect(result.body.baseline).toBe('scenario-a');
      expect(Array.isArray(result.body.notes)).toBe(true);
      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['Cache-Control']).toBe('no-store');
    });

    it('should return ranked comparison for multiple items', async () => {
      const result = await handleBatchCompareRequest({
        items: [
          { scenarioId: 'scenario-a', seed: 42 },
          { scenarioId: 'scenario-b', seed: 42 },
          { scenarioId: 'scenario-c', seed: 42 }
        ]
      });

      expect(result.status).toBe(200);
      expect(result.body.schema).toBe('compare-batch.v1');
      expect(result.body.ranked).toHaveLength(3);
      expect(result.body.baseline).toBeDefined();
      expect(result.body.notes).toContain('All seeds 42');
    });

    it('should detect mixed seeds in notes', async () => {
      const result = await handleBatchCompareRequest({
        items: [
          { scenarioId: 'scenario-a', seed: 42 },
          { scenarioId: 'scenario-b', seed: 17 }
        ]
      });

      expect(result.status).toBe(200);
      expect(result.body.notes).toContain('Mixed seeds used');
    });
  });

  describe('Response Schema Validation', () => {
    it('should return compare-batch.v1 schema', async () => {
      const result = await handleBatchCompareRequest({
        items: [{ scenarioId: 'test', seed: 42 }]
      });

      expect(result.body.schema).toBe('compare-batch.v1');
    });

    it('should include required ranked scenario fields', async () => {
      const result = await handleBatchCompareRequest({
        items: [
          { scenarioId: 'scenario-a', seed: 42 },
          { scenarioId: 'scenario-b', seed: 42 }
        ]
      });

      const rankedScenario = result.body.ranked[0];
      expect(rankedScenario).toHaveProperty('scenarioId');
      expect(rankedScenario).toHaveProperty('most_likely');
      expect(rankedScenario).toHaveProperty('delta_vs_baseline_pct');
      expect(rankedScenario).toHaveProperty('confidence');

      expect(typeof rankedScenario.scenarioId).toBe('string');
      expect(typeof rankedScenario.most_likely).toBe('number');
      expect(typeof rankedScenario.delta_vs_baseline_pct).toBe('number');
      expect(['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']).toContain(rankedScenario.confidence);
    });

    it('should set baseline to highest value scenario', async () => {
      const result = await handleBatchCompareRequest({
        items: [
          { scenarioId: 'low-value', seed: 42 },
          { scenarioId: 'high-value', seed: 42 },
          { scenarioId: 'medium-value', seed: 42 }
        ]
      });

      // First ranked item should be the baseline (highest value)
      const baseline = result.body.baseline;
      const firstRanked = result.body.ranked[0];

      expect(baseline).toBe(firstRanked.scenarioId);
      expect(firstRanked.delta_vs_baseline_pct).toBe(0);
    });

    it('should calculate percentage deltas correctly', async () => {
      const result = await handleBatchCompareRequest({
        items: [
          { scenarioId: 'scenario-a', seed: 42 },
          { scenarioId: 'scenario-b', seed: 42 }
        ]
      });

      // First item (baseline) should have 0% delta
      expect(result.body.ranked[0].delta_vs_baseline_pct).toBe(0);

      // Other items should have negative deltas (lower than baseline)
      if (result.body.ranked.length > 1) {
        expect(result.body.ranked[1].delta_vs_baseline_pct).toBeLessThanOrEqual(0);
      }
    });

    it('should round percentages to 1 decimal place', async () => {
      const result = await handleBatchCompareRequest({
        items: [
          { scenarioId: 'scenario-a', seed: 42 },
          { scenarioId: 'scenario-b', seed: 42 }
        ]
      });

      result.body.ranked.forEach(item => {
        const decimals = (item.delta_vs_baseline_pct.toString().split('.')[1] || '').length;
        expect(decimals).toBeLessThanOrEqual(1);
      });
    });

    it('should include currency note', async () => {
      const result = await handleBatchCompareRequest({
        items: [{ scenarioId: 'test', seed: 42 }]
      });

      expect(result.body.notes).toContain('Currency: USD (unconverted)');
    });
  });

  describe('Ranking Logic', () => {
    it('should sort scenarios by most_likely value descending', async () => {
      const result = await handleBatchCompareRequest({
        items: [
          { scenarioId: 'scenario-a', seed: 42 },
          { scenarioId: 'scenario-b', seed: 42 },
          { scenarioId: 'scenario-c', seed: 42 }
        ]
      });

      const values = result.body.ranked.map(item => item.most_likely);

      // Check if sorted in descending order
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
      }
    });

    it('should preserve all input scenarios in ranking', async () => {
      const inputScenarios = ['scenario-x', 'scenario-y', 'scenario-z'];

      const result = await handleBatchCompareRequest({
        items: inputScenarios.map(id => ({ scenarioId: id, seed: 42 }))
      });

      const outputScenarios = result.body.ranked.map(item => item.scenarioId);

      inputScenarios.forEach(scenarioId => {
        expect(outputScenarios).toContain(scenarioId);
      });

      expect(outputScenarios).toHaveLength(inputScenarios.length);
    });
  });

  describe('Error Handling', () => {
    it('should handle null request body', async () => {
      const result = await handleBatchCompareRequest(null);

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
    });

    it('should handle missing items property', async () => {
      const result = await handleBatchCompareRequest({ other: 'data' });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
    });

    it('should handle non-array items', async () => {
      const result = await handleBatchCompareRequest({ items: 'not-array' });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
    });

    it('should include timestamp in error responses', async () => {
      const result = await handleBatchCompareRequest({});

      expect(result.body.timestamp).toBeDefined();
      expect(new Date(result.body.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('Budget Parameter', () => {
    it('should accept optional budget parameter', async () => {
      const result = await handleBatchCompareRequest({
        items: [
          { scenarioId: 'scenario-a', seed: 42, budget: 500 }
        ]
      });

      expect(result.status).toBe(200);
      expect(result.body.schema).toBe('compare-batch.v1');
    });

    it('should work without budget parameter', async () => {
      const result = await handleBatchCompareRequest({
        items: [
          { scenarioId: 'scenario-a', seed: 42 }
        ]
      });

      expect(result.status).toBe(200);
      expect(result.body.schema).toBe('compare-batch.v1');
    });
  });
});