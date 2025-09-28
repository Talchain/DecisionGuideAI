/**
 * Tests for scenario validator and MAX_NODES cap
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateScenario } from '../../src/lib/safety-limits';

describe('Scenario Validator', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment for each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Basic validation', () => {
    it('should pass validation for valid minimal template', () => {
      const validTemplate = {
        scenario: {
          title: 'Test Decision',
          options: [
            { id: 'option_a', name: 'Option A' },
            { id: 'option_b', name: 'Option B' }
          ]
        }
      };

      const result = validateScenario(validTemplate);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.nodeCount).toBe(2); // 2 options
    });

    it('should fail validation for missing template', () => {
      const result = validateScenario(null);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Template is required');
      expect(result.nodeCount).toBe(0);
    });

    it('should fail validation for missing scenario', () => {
      const invalidTemplate = {
        template_name: 'Test'
      };

      const result = validateScenario(invalidTemplate);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Template must contain a scenario');
      expect(result.nodeCount).toBe(0);
    });

    it('should fail validation for missing title', () => {
      const invalidTemplate = {
        scenario: {
          options: [{ id: 'a', name: 'Option A' }]
        }
      };

      const result = validateScenario(invalidTemplate);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Scenario title is required');
    });

    it('should fail validation for missing options', () => {
      const invalidTemplate = {
        scenario: {
          title: 'Test Decision'
        }
      };

      const result = validateScenario(invalidTemplate);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Scenario must have at least one option');
    });

    it('should fail validation for empty options array', () => {
      const invalidTemplate = {
        scenario: {
          title: 'Test Decision',
          options: []
        }
      };

      const result = validateScenario(invalidTemplate);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Scenario must have at least one option');
    });
  });

  describe('Option validation', () => {
    it('should validate option structure', () => {
      const templateWithInvalidOptions = {
        scenario: {
          title: 'Test Decision',
          options: [
            { id: 'valid_option', name: 'Valid Option' },
            { name: 'Missing ID' }, // Missing id
            { id: 'missing_name' }, // Missing name
            { id: '', name: 'Empty ID' } // Empty id
          ]
        }
      };

      const result = validateScenario(templateWithInvalidOptions);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Option 2 must have a valid id');
      expect(result.errors).toContain('Option 3 must have a valid name');
      expect(result.errors).toContain('Option 4 must have a valid id');
    });

    it('should accept options with additional fields', () => {
      const validTemplate = {
        scenario: {
          title: 'Test Decision',
          options: [
            {
              id: 'rich_option',
              name: 'Rich Option',
              description: 'Detailed description',
              pros: ['Pro 1', 'Pro 2'],
              cons: ['Con 1'],
              score: 0.85,
              metadata: { tags: ['important'] }
            }
          ]
        }
      };

      const result = validateScenario(validTemplate);

      expect(result.valid).toBe(true);
      expect(result.nodeCount).toBe(1);
    });
  });

  describe('Node counting and limits', () => {
    it('should count nodes correctly', () => {
      const complexTemplate = {
        scenario: {
          title: 'Complex Decision',
          options: [
            { id: 'a', name: 'Option A' },
            { id: 'b', name: 'Option B' },
            { id: 'c', name: 'Option C' }
          ], // 3 nodes
          stakeholders: ['Product', 'Engineering'], // 2 nodes
          constraints: {
            budget: '£100k',
            timeline: '6 months'
          }, // 2 nodes
          success_metrics: ['Metric 1', 'Metric 2'], // 2 nodes
          requirements: ['Req 1'], // 1 node
          assumptions: ['Assumption 1', 'Assumption 2'], // 2 nodes
          risks: ['Risk 1'] // 1 node
        }
      };

      const result = validateScenario(complexTemplate);

      expect(result.nodeCount).toBe(13); // Total nodes
      expect(result.valid).toBe(false); // Exceeds default MAX_NODES=12
      expect(result.errors).toContain('Scenario too large for pilot (12-node cap)');
    });

    it('should respect custom MAX_NODES environment variable', () => {
      process.env.MAX_NODES = '20';

      const largeTemplate = {
        scenario: {
          title: 'Large Decision',
          options: Array.from({ length: 15 }, (_, i) => ({
            id: `option_${i}`,
            name: `Option ${i}`
          })),
          stakeholders: ['Stakeholder 1', 'Stakeholder 2']
        }
      };

      const result = validateScenario(largeTemplate);

      expect(result.nodeCount).toBe(17);
      expect(result.valid).toBe(true); // Should pass with MAX_NODES=20
    });

    it('should respect custom WARN_NODES environment variable', () => {
      process.env.WARN_NODES = '5';

      const mediumTemplate = {
        scenario: {
          title: 'Medium Decision',
          options: Array.from({ length: 6 }, (_, i) => ({
            id: `option_${i}`,
            name: `Option ${i}`
          })),
          stakeholders: ['Stakeholder 1']
        }
      };

      const result = validateScenario(mediumTemplate);

      expect(result.nodeCount).toBe(7);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Scenario approaching complexity limit (7/12 nodes)');
    });

    it('should handle templates at exact node limit', () => {
      const exactLimitTemplate = {
        scenario: {
          title: 'Exact Limit Decision',
          options: Array.from({ length: 12 }, (_, i) => ({
            id: `option_${i}`,
            name: `Option ${i}`
          }))
        }
      };

      const result = validateScenario(exactLimitTemplate);

      expect(result.nodeCount).toBe(12);
      expect(result.valid).toBe(true); // Should pass at exact limit
      expect(result.errors).toHaveLength(0);
    });

    it('should handle templates just over node limit', () => {
      const overLimitTemplate = {
        scenario: {
          title: 'Over Limit Decision',
          options: Array.from({ length: 13 }, (_, i) => ({
            id: `option_${i}`,
            name: `Option ${i}`
          }))
        }
      };

      const result = validateScenario(overLimitTemplate);

      expect(result.nodeCount).toBe(13);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Scenario too large for pilot (12-node cap)');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty arrays correctly', () => {
      const templateWithEmptyArrays = {
        scenario: {
          title: 'Test Decision',
          options: [{ id: 'a', name: 'Option A' }],
          stakeholders: [],
          success_metrics: [],
          requirements: []
        }
      };

      const result = validateScenario(templateWithEmptyArrays);

      expect(result.nodeCount).toBe(1); // Only the option
      expect(result.valid).toBe(true);
    });

    it('should handle null and undefined fields', () => {
      const templateWithNulls = {
        scenario: {
          title: 'Test Decision',
          options: [{ id: 'a', name: 'Option A' }],
          stakeholders: null,
          constraints: undefined,
          success_metrics: null
        }
      };

      const result = validateScenario(templateWithNulls);

      expect(result.nodeCount).toBe(1);
      expect(result.valid).toBe(true);
    });

    it('should handle non-object constraints', () => {
      const templateWithStringConstraints = {
        scenario: {
          title: 'Test Decision',
          options: [{ id: 'a', name: 'Option A' }],
          constraints: 'Budget is £100k'
        }
      };

      const result = validateScenario(templateWithStringConstraints);

      expect(result.nodeCount).toBe(1); // Constraints not counted as not an object
      expect(result.valid).toBe(true);
    });

    it('should handle deeply nested structures', () => {
      const nestedTemplate = {
        scenario: {
          title: 'Nested Decision',
          options: [
            {
              id: 'nested_option',
              name: 'Nested Option',
              metadata: {
                deeply: {
                  nested: {
                    data: 'value'
                  }
                }
              }
            }
          ]
        }
      };

      const result = validateScenario(nestedTemplate);

      expect(result.nodeCount).toBe(1); // Deep nesting doesn't affect count
      expect(result.valid).toBe(true);
    });
  });
});