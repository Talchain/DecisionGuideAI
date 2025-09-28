/**
 * Parameter Sweeps contract tests
 * Verifies cap limits, taxonomy, and proper error handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parameterSweepApi } from '../../src/lib/sweep/parameter-sweeps';

describe('Parameter Sweeps Contract Tests', () => {
  const originalSweepEnable = process.env.SWEEP_ENABLE;

  beforeEach(() => {
    // Reset environment for each test
    delete process.env.SWEEP_ENABLE;
  });

  afterEach(() => {
    // Restore original environment
    if (originalSweepEnable !== undefined) process.env.SWEEP_ENABLE = originalSweepEnable;
  });

  describe('Gating and Feature Flags', () => {
    it('should return 404 when SWEEP_ENABLE=0', async () => {
      process.env.SWEEP_ENABLE = '0';

      const result = await parameterSweepApi.generateSweep(
        { nodes: [] },
        ['nodes[0].weight'],
        [5, 10],
        5
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
      expect(result.error).toContain('could not be found');
    });

    it('should return 404 when SWEEP_ENABLE is unset', async () => {
      // SWEEP_ENABLE not set (default disabled)

      const result = await parameterSweepApi.generateSweep(
        { nodes: [] },
        ['nodes[0].weight'],
        [5, 10],
        5
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
    });

    it('should work when SWEEP_ENABLE=1', async () => {
      process.env.SWEEP_ENABLE = '1';

      const testScenario = {
        nodes: [
          { id: 'test', weight: 0.5 }
        ]
      };

      const result = await parameterSweepApi.generateSweep(
        testScenario,
        ['nodes[0].weight'],
        [10],
        2
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
    });
  });

  describe('Input Validation', () => {
    beforeEach(() => {
      process.env.SWEEP_ENABLE = '1';
    });

    it('should reject missing base scenario', async () => {
      const result = await parameterSweepApi.generateSweep(
        null as any,
        ['nodes[0].weight'],
        [5, 10],
        5
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.error).toContain('Base scenario is required');
    });

    it('should reject invalid base scenario', async () => {
      const result = await parameterSweepApi.generateSweep(
        'invalid' as any,
        ['nodes[0].weight'],
        [5, 10],
        5
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.error).toContain('valid object');
    });

    it('should reject empty target paths', async () => {
      const result = await parameterSweepApi.generateSweep(
        { nodes: [] },
        [],
        [5, 10],
        5
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.error).toContain('Target paths array');
    });

    it('should reject non-array target paths', async () => {
      const result = await parameterSweepApi.generateSweep(
        { nodes: [] },
        'invalid' as any,
        [5, 10],
        5
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.error).toContain('Target paths array');
    });

    it('should reject empty variations', async () => {
      const result = await parameterSweepApi.generateSweep(
        { nodes: [] },
        ['nodes[0].weight'],
        [],
        5
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.error).toContain('Variations array');
    });

    it('should reject invalid max variants (too low)', async () => {
      const result = await parameterSweepApi.generateSweep(
        { nodes: [] },
        ['nodes[0].weight'],
        [5, 10],
        0
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.error).toContain('Max variants must be between 1 and 50');
    });

    it('should reject invalid max variants (too high)', async () => {
      const result = await parameterSweepApi.generateSweep(
        { nodes: [] },
        ['nodes[0].weight'],
        [5, 10],
        51
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.error).toContain('Max variants must be between 1 and 50');
    });
  });

  describe('Cap Limits and Safety', () => {
    beforeEach(() => {
      process.env.SWEEP_ENABLE = '1';
    });

    it('should respect maxVariants cap', async () => {
      const testScenario = {
        nodes: [
          { id: 'node1', weight: 0.5 },
          { id: 'node2', weight: 0.7 },
          { id: 'node3', weight: 0.3 }
        ]
      };

      const result = await parameterSweepApi.generateSweep(
        testScenario,
        ['nodes[0].weight', 'nodes[1].weight', 'nodes[2].weight'],
        [-20, -10, -5, 5, 10, 20], // 6 variations * 3 paths = 18 potential variants
        5 // Cap at 5
      );

      expect(result.success).toBe(true);
      expect(result.data?.variants.length).toBeLessThanOrEqual(5);
      expect(result.data?.summary.variantsGenerated).toBeLessThanOrEqual(5);
    });

    it('should enforce maximum cap of 50 variants', async () => {
      const testScenario = {
        nodes: Array.from({ length: 10 }, (_, i) => ({
          id: `node${i}`,
          weight: 0.5 + i * 0.05
        }))
      };

      const targetPaths = testScenario.nodes.map((_, i) => `nodes[${i}].weight`);

      const result = await parameterSweepApi.generateSweep(
        testScenario,
        targetPaths,
        [-20, -10, -5, 5, 10, 20],
        100 // Try to request 100, should be capped
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.error).toContain('Max variants must be between 1 and 50');
    });
  });

  describe('Schema Compliance', () => {
    beforeEach(() => {
      process.env.SWEEP_ENABLE = '1';
    });

    it('should return sweep.v1 schema', async () => {
      const testScenario = {
        id: 'test-scenario',
        nodes: [
          { id: 'decision', weight: 1.0 },
          { id: 'factor1', weight: 0.7 }
        ],
        links: [
          { from: 'decision', to: 'factor1', weight: 0.8 }
        ]
      };

      const result = await parameterSweepApi.generateSweep(
        testScenario,
        ['nodes[0].weight', 'nodes[1].weight'],
        [5, 10],
        3
      );

      expect(result.success).toBe(true);
      expect(result.data?.schema).toBe('sweep.v1');
    });

    it('should include all required fields', async () => {
      const testScenario = {
        nodes: [{ id: 'test', weight: 0.5 }]
      };

      const result = await parameterSweepApi.generateSweep(
        testScenario,
        ['nodes[0].weight'],
        [10],
        2
      );

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        schema: 'sweep.v1',
        timestamp: expect.any(String),
        baseScenario: expect.any(Object),
        parameters: expect.any(Object),
        variants: expect.any(Array),
        rankings: expect.any(Array),
        summary: expect.any(Object)
      });
    });

    it('should include proper variant structure', async () => {
      const testScenario = {
        nodes: [{ id: 'test', weight: 0.5 }]
      };

      const result = await parameterSweepApi.generateSweep(
        testScenario,
        ['nodes[0].weight'],
        [10],
        2
      );

      expect(result.success).toBe(true);
      expect(result.data?.variants.length).toBeGreaterThan(0);

      const variant = result.data?.variants[0];
      expect(variant).toMatchObject({
        id: expect.any(String),
        description: expect.any(String),
        modifications: expect.any(Array),
        scenario: expect.any(Object)
      });
    });

    it('should include proper ranking structure', async () => {
      const testScenario = {
        nodes: [{ id: 'test', weight: 0.5 }]
      };

      const result = await parameterSweepApi.generateSweep(
        testScenario,
        ['nodes[0].weight'],
        [10],
        2
      );

      expect(result.success).toBe(true);
      expect(result.data?.rankings.length).toBeGreaterThan(0);

      const ranking = result.data?.rankings[0];
      expect(ranking).toMatchObject({
        variantId: expect.any(String),
        rank: expect.any(Number),
        score: expect.any(Number)
      });

      // Rankings should be sorted by rank
      const ranks = result.data?.rankings.map(r => r.rank) || [];
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    });
  });

  describe('Error Handling with Catalogue Phrases', () => {
    beforeEach(() => {
      process.env.SWEEP_ENABLE = '1';
    });

    it('should use appropriate error phrases for invalid paths', async () => {
      const testScenario = {
        nodes: [{ id: 'test', weight: 0.5 }]
      };

      const result = await parameterSweepApi.generateSweep(
        testScenario,
        ['nonexistent.path'],
        [10],
        2
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
      expect(result.error).toContain('No valid variants could be generated');
    });

    it('should handle internal errors gracefully', async () => {
      // Create scenario that might cause internal processing errors
      const problematicScenario = {
        nodes: null // Invalid structure that might cause errors during processing
      };

      const result = await parameterSweepApi.generateSweep(
        problematicScenario,
        ['nodes[0].weight'],
        [10],
        2
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe(500);
      expect(result.error).toContain('Unable to generate parameter sweep');
    });
  });

  describe('Functional Behaviour', () => {
    beforeEach(() => {
      process.env.SWEEP_ENABLE = '1';
    });

    it('should generate variants with correct modifications', async () => {
      const testScenario = {
        nodes: [{ id: 'test', weight: 0.5 }]
      };

      const result = await parameterSweepApi.generateSweep(
        testScenario,
        ['nodes[0].weight'],
        [10, -10],
        4
      );

      expect(result.success).toBe(true);
      expect(result.data?.variants.length).toBe(2); // One for +10%, one for -10%

      // Check that modifications are applied correctly
      const variant = result.data?.variants[0];
      expect(variant?.modifications.length).toBe(1);

      const mod = variant?.modifications[0];
      expect(mod?.path).toBe('nodes[0].weight');
      expect(mod?.originalValue).toBe(0.5);
      expect([0.55, 0.45]).toContain(mod?.newValue); // Either +10% or -10%
    });

    it('should skip invalid variants (negative weights)', async () => {
      const testScenario = {
        nodes: [{ id: 'test', weight: 0.1 }] // Small weight
      };

      const result = await parameterSweepApi.generateSweep(
        testScenario,
        ['nodes[0].weight'],
        [-50, -90, 10], // -50% and -90% would make negative weights
        5
      );

      expect(result.success).toBe(true);
      expect(result.data?.variants.length).toBe(1); // Only +10% should be valid

      const variant = result.data?.variants[0];
      expect(variant?.modifications[0].newValue).toBeGreaterThan(0);
    });

    it('should generate both single and multi-parameter variants', async () => {
      const testScenario = {
        nodes: [
          { id: 'test1', weight: 0.5 },
          { id: 'test2', weight: 0.7 }
        ]
      };

      const result = await parameterSweepApi.generateSweep(
        testScenario,
        ['nodes[0].weight', 'nodes[1].weight'],
        [10],
        10 // Allow room for multi-parameter variants
      );

      expect(result.success).toBe(true);
      expect(result.data?.variants.length).toBeGreaterThan(2); // Should have single + multi variants

      // Check for single-parameter variants
      const singleParamVariants = result.data?.variants.filter(v => v.modifications.length === 1);
      expect(singleParamVariants.length).toBeGreaterThan(0);

      // May have multi-parameter variants
      const multiParamVariants = result.data?.variants.filter(v => v.modifications.length > 1);
      // Don't assert presence since it's randomised, but check structure if they exist
      if (multiParamVariants.length > 0) {
        expect(multiParamVariants[0].modifications.length).toBeGreaterThan(1);
      }
    });
  });
});