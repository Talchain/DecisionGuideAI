/**
 * Contract tests for Compare API
 * Validates response schema and structure only
 */

import { describe, it, expect } from 'vitest';
import { handleCompareRequest } from '../../src/lib/compare-api';
import { ERR_MSG } from '../../src/lib/error-messages.js';

describe('Compare API Contract', () => {
  const validRequest = {
    left: {
      scenarioId: 'scenario-a',
      seed: 42,
      budget: 200
    },
    right: {
      scenarioId: 'scenario-b',
      seed: 17,
      budget: 200
    }
  };

  it('should return valid compare.v1 schema for valid request', async () => {
    const result = await handleCompareRequest(validRequest);

    expect(result.status).toBe(200);
    expect(result.body.schema).toBe('compare.v1');

    // Check left report structure
    expect(result.body.left).toMatchObject({
      scenarioId: 'scenario-a',
      runId: expect.stringMatching(/^run_/),
      report: {
        decision: {
          title: expect.any(String),
          options: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              name: expect.any(String),
              score: expect.any(Number),
              description: expect.any(String)
            })
          ])
        },
        recommendation: {
          primary: expect.any(String)
        },
        analysis: {
          confidence: expect.any(String)
        },
        meta: {
          scenarioId: 'scenario-a',
          seed: 42,
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
        }
      }
    });

    // Check right report structure
    expect(result.body.right).toMatchObject({
      scenarioId: 'scenario-b',
      runId: expect.stringMatching(/^run_/),
      report: {
        decision: {
          title: expect.any(String),
          options: expect.any(Array)
        },
        recommendation: {
          primary: expect.any(String)
        },
        analysis: {
          confidence: expect.any(String)
        },
        meta: {
          scenarioId: 'scenario-b',
          seed: 17,
          timestamp: expect.any(String)
        }
      }
    });

    // Check delta structure
    expect(result.body.delta).toMatchObject({
      most_likely_diff: expect.any(Number),
      most_likely_pct: expect.any(Number),
      confidence_shift: expect.stringMatching(/^(NONE|UP|DOWN)$/),
      threshold_events: expect.any(Array)
    });

    // Check summary fields
    expect(result.body.headline).toBeDefined();
    expect(typeof result.body.headline).toBe('string');
    expect(Array.isArray(result.body.key_drivers)).toBe(true);
  });

  it('should return BAD_INPUT for missing left scenario', async () => {
    const invalidRequest = {
      right: validRequest.right
    };

    const result = await handleCompareRequest(invalidRequest);

    expect(result.status).toBe(400);
    expect(result.body.type).toBe('BAD_INPUT');
    expect(result.body.message).toContain('left and right scenarios required');
    expect(result.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should return BAD_INPUT for missing scenarioId', async () => {
    const invalidRequest = {
      left: { seed: 42 },
      right: validRequest.right
    };

    const result = await handleCompareRequest(invalidRequest);

    expect(result.status).toBe(400);
    expect(result.body.type).toBe('BAD_INPUT');
    expect(result.body.message).toContain(ERR_MSG.SCENARIO_ID_REQUIRED);
  });

  it('should return BAD_INPUT for non-numeric seed', async () => {
    const invalidRequest = {
      left: { scenarioId: 'test', seed: 'invalid' },
      right: validRequest.right
    };

    const result = await handleCompareRequest(invalidRequest);

    expect(result.status).toBe(400);
    expect(result.body.type).toBe('BAD_INPUT');
    expect(result.body.message).toContain('seed must be a number');
  });

  it('should include proper headers', async () => {
    const result = await handleCompareRequest(validRequest);

    expect(result.headers).toMatchObject({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    });
  });

  it('should generate deterministic results for same inputs', async () => {
    const result1 = await handleCompareRequest(validRequest);
    const result2 = await handleCompareRequest(validRequest);

    // Should have same structure and deterministic content
    expect(result1.body.left.report.meta.seed).toBe(result2.body.left.report.meta.seed);
    expect(result1.body.right.report.meta.seed).toBe(result2.body.right.report.meta.seed);

    // Delta should be consistent for same inputs
    expect(result1.body.delta.most_likely_pct).toBe(result2.body.delta.most_likely_pct);
  });

  it('should handle budget parameter correctly', async () => {
    const requestWithBudget = {
      ...validRequest,
      left: { ...validRequest.left, budget: 500 },
      right: { ...validRequest.right, budget: 300 }
    };

    const result = await handleCompareRequest(requestWithBudget);

    expect(result.status).toBe(200);
    expect(result.body.schema).toBe('compare.v1');
  });
});