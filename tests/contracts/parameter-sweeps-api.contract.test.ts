/**
 * Parameter Sweeps API Contract Tests
 * Ensures /compare/sweep endpoint behaves correctly when flagged
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleSweepRequest } from '../../src/lib/sweep/sweep-api.js';

describe('Parameter Sweeps API Contract Tests', () => {
  let originalEnv: string | undefined;
  let originalSchemaValidation: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.SWEEP_ENABLE;
    originalSchemaValidation = process.env.SCHEMA_VALIDATION_DISABLE;
    // Disable schema validation for direct API testing
    process.env.SCHEMA_VALIDATION_DISABLE = '1';
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SWEEP_ENABLE;
    } else {
      process.env.SWEEP_ENABLE = originalEnv;
    }

    if (originalSchemaValidation === undefined) {
      delete process.env.SCHEMA_VALIDATION_DISABLE;
    } else {
      process.env.SCHEMA_VALIDATION_DISABLE = originalSchemaValidation;
    }
  });

  describe('Feature Flag Behavior', () => {
    it('should return 404 when SWEEP_ENABLE is not set', async () => {
      delete process.env.SWEEP_ENABLE;

      const result = await handleSweepRequest({
        baseScenario: { nodes: [], links: [] },
        targetPaths: ['nodes[0].weight']
      });

      expect(result.status).toBe(404);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toBe('The requested resource could not be found.');
    });

    it('should return 404 when SWEEP_ENABLE is 0', async () => {
      process.env.SWEEP_ENABLE = '0';

      const result = await handleSweepRequest({
        baseScenario: { nodes: [], links: [] },
        targetPaths: ['nodes[0].weight']
      });

      expect(result.status).toBe(404);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toBe('The requested resource could not be found.');
    });

    it('should process request when SWEEP_ENABLE=1', async () => {
      process.env.SWEEP_ENABLE = '1';

      const testScenario = {
        id: 'test-scenario',
        nodes: [
          { id: 'node1', weight: 0.5 },
          { id: 'node2', weight: 0.3 }
        ],
        links: [
          { from: 'node1', to: 'node2', weight: 0.7 }
        ]
      };

      const result = await handleSweepRequest({
        baseScenario: testScenario,
        targetPaths: ['nodes[0].weight'],
        maxVariants: 5
      });

      expect(result.status).toBe(200);
      expect(result.body.schema).toBe('sweep.v1');
      expect(result.body.variants).toBeDefined();
      expect(result.body.rankings).toBeDefined();
      expect(result.body.summary).toBeDefined();
    });
  });

  describe('Request Validation (when enabled)', () => {
    beforeEach(() => {
      process.env.SWEEP_ENABLE = '1';
    });

    it('should return 400 for missing baseScenario', async () => {
      const result = await handleSweepRequest({
        targetPaths: ['nodes[0].weight']
      });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toMatch(/Request validation failed|baseScenario/);
    });

    it('should return 400 for missing targetPaths', async () => {
      const result = await handleSweepRequest({
        baseScenario: { nodes: [], links: [] }
      });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toMatch(/Request validation failed|targetPaths/);
    });

    it('should return 400 for empty targetPaths array', async () => {
      const result = await handleSweepRequest({
        baseScenario: { nodes: [], links: [] },
        targetPaths: []
      });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toMatch(/Request validation failed|targetPaths/);
    });

    it('should return 400 for invalid targetPaths (non-strings)', async () => {
      const result = await handleSweepRequest({
        baseScenario: { nodes: [], links: [] },
        targetPaths: [123, 'valid.path']
      });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toMatch(/Request validation failed|target paths must be strings/);
    });

    it('should return 400 for invalid variations (non-numbers)', async () => {
      const result = await handleSweepRequest({
        baseScenario: { nodes: [], links: [] },
        targetPaths: ['nodes[0].weight'],
        variations: ['not', 'numbers']
      });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toMatch(/Request validation failed|variations must be an array of numbers/);
    });

    it('should return 400 for invalid maxVariants (out of range)', async () => {
      const result = await handleSweepRequest({
        baseScenario: { nodes: [], links: [] },
        targetPaths: ['nodes[0].weight'],
        maxVariants: 100
      });

      expect(result.status).toBe(400);
      expect(result.body.type).toBe('BAD_INPUT');
      expect(result.body.message).toMatch(/Request validation failed|maxVariants must be a number between 1 and 50/);
    });
  });

  describe('Schema Validation (when enabled)', () => {
    beforeEach(() => {
      process.env.SWEEP_ENABLE = '1';
    });

    it('should return sweep.v1 schema in response', async () => {
      const testScenario = {
        id: 'test-scenario',
        nodes: [
          { id: 'node1', weight: 0.5 }
        ]
      };

      const result = await handleSweepRequest({
        baseScenario: testScenario,
        targetPaths: ['nodes[0].weight'],
        maxVariants: 3
      });

      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({
        schema: 'sweep.v1',
        timestamp: expect.any(String),
        baseScenario: {
          id: 'test-scenario',
          baseline: expect.any(Object)
        },
        parameters: {
          targetPaths: ['nodes[0].weight'],
          variations: expect.any(Array),
          maxVariants: 3
        },
        variants: expect.any(Array),
        rankings: expect.any(Array),
        summary: {
          variantsGenerated: expect.any(Number),
          bestVariant: expect.any(String),
          worstVariant: expect.any(String),
          averageScore: expect.any(Number)
        }
      });
    });

    it('should generate variants with correct structure', async () => {
      const testScenario = {
        nodes: [
          { id: 'node1', weight: 0.5 }
        ]
      };

      const result = await handleSweepRequest({
        baseScenario: testScenario,
        targetPaths: ['nodes[0].weight'],
        variations: [-10, 10],
        maxVariants: 5
      });

      expect(result.status).toBe(200);
      expect(result.body.variants).toBeDefined();
      expect(Array.isArray(result.body.variants)).toBe(true);

      if (result.body.variants.length > 0) {
        const variant = result.body.variants[0];
        expect(variant).toMatchObject({
          id: expect.any(String),
          description: expect.any(String),
          modifications: expect.any(Array),
          scenario: expect.any(Object)
        });

        if (variant.modifications.length > 0) {
          const modification = variant.modifications[0];
          expect(modification).toMatchObject({
            path: expect.any(String),
            originalValue: expect.any(Number),
            newValue: expect.any(Number),
            changePercent: expect.any(Number)
          });
        }
      }
    });

    it('should generate rankings with correct structure', async () => {
      const testScenario = {
        nodes: [
          { id: 'node1', weight: 0.5 }
        ]
      };

      const result = await handleSweepRequest({
        baseScenario: testScenario,
        targetPaths: ['nodes[0].weight'],
        maxVariants: 3
      });

      expect(result.status).toBe(200);
      expect(result.body.rankings).toBeDefined();
      expect(Array.isArray(result.body.rankings)).toBe(true);

      if (result.body.rankings.length > 0) {
        const ranking = result.body.rankings[0];
        expect(ranking).toMatchObject({
          variantId: expect.any(String),
          rank: expect.any(Number),
          score: expect.any(Number)
        });

        // Rankings should be in order
        expect(ranking.rank).toBe(1);
      }
    });
  });

  describe('Headers and Response Format', () => {
    beforeEach(() => {
      process.env.SWEEP_ENABLE = '1';
    });

    it('should include correct response headers', async () => {
      const result = await handleSweepRequest({
        baseScenario: { nodes: [{ weight: 0.5 }] },
        targetPaths: ['nodes[0].weight']
      });

      expect(result.status).toBe(200);
      expect(result.headers).toBeDefined();
      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['Cache-Control']).toBe('no-store');
    });

    it('should include correlation ID in headers when provided', async () => {
      const headers = { 'x-correlation-id': 'test-correlation-123' };

      const result = await handleSweepRequest({
        baseScenario: { nodes: [{ weight: 0.5 }] },
        targetPaths: ['nodes[0].weight']
      }, headers);

      expect(result.status).toBe(200);
      expect(result.headers['X-Correlation-ID']).toBe('test-correlation-123');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      process.env.SWEEP_ENABLE = '1';
    });

    it('should handle internal errors gracefully', async () => {
      // Pass invalid scenario to trigger internal error
      const result = await handleSweepRequest({
        baseScenario: null,
        targetPaths: ['nodes[0].weight']
      });

      expect([400, 500]).toContain(result.status);
      expect(result.body.type).toMatch(/BAD_INPUT|INTERNAL_ERROR/);
      expect(result.body.message).toBeDefined();
      expect(result.body.timestamp).toBeDefined();
    });
  });
});