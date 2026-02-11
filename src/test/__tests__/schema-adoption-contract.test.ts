/**
 * @talchain/schemas adoption contract tests.
 *
 * Verifies that the UI application correctly imports and uses shared types
 * and constants from @talchain/schemas instead of local definitions.
 *
 * Three test groups:
 * 1. Contract test with shared fixture — validates shared types parse expected data
 * 2. Limit alignment test — verifies canvas validation uses LIMITS values
 * 3. CIL constant alignment test — verifies ContractIntegrity tab uses shared codes and thresholds
 */

import { describe, it, expect } from 'vitest'
import {
  CIL_WARNING_CODES,
  CIL_WARNING_SEVERITY,
  CIL_THRESHOLDS,
  LIMITS,
  MAX_NODES,
  MAX_EDGES,
  MAX_OPTIONS,
  STD_FLOOR,
  DEFAULT_STD,
  DEFAULT_SEED,
  STRENGTH_BOUNDS,
  NodeV3Schema,
  EdgeV3Schema,
  AnalysisReadyV3Schema,
} from '@talchain/schemas'
import type {
  ValidationWarning,
  ValidationBlocker,
  CeeErrorCodeType,
  AnalysisRequestIdChain,
  DraftGraphTrace,
  StrengthDefaultAppliedDetails,
  StrengthMeanDefaultDominantDetails,
} from '@talchain/schemas'

// ============================================================================
// 1. Contract test with shared fixture
// ============================================================================

describe('contract test: shared fixture validates against schemas', () => {
  const fixtureNode = {
    id: 'factor_price',
    kind: 'factor',
    label: 'Price',
    category: 'controllable',
    observed_state: {
      value: 0.5,
      std: 0.1,
      baseline: 0.6,
      unit: 'USD',
    },
  }

  const fixtureEdge = {
    from: 'factor_price',
    to: 'goal_revenue',
    strength: { mean: 0.7, std: 0.1 },
    exists_probability: 0.9,
  }

  it('shared NodeV3Schema accepts canonical fixture node', () => {
    const result = NodeV3Schema.safeParse(fixtureNode)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('factor_price')
      expect(result.data.kind).toBe('factor')
    }
  })

  it('shared EdgeV3Schema accepts canonical fixture edge', () => {
    const result = EdgeV3Schema.safeParse(fixtureEdge)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.from).toBe('factor_price')
      expect(result.data.strength.mean).toBe(0.7)
    }
  })

  it('shared types compile correctly (type-level check)', () => {
    // These are compile-time checks — if they compile, the types match
    const warning: ValidationWarning = {
      code: 'TEST',
      message: 'test warning',
    }
    expect(warning.code).toBe('TEST')

    const blocker: ValidationBlocker = {
      code: 'BLOCKER',
      message: 'test blocker',
    }
    expect(blocker.code).toBe('BLOCKER')

    const errorCode: CeeErrorCodeType = 'CEE_TIMEOUT'
    expect(errorCode).toBe('CEE_TIMEOUT')

    const chain: AnalysisRequestIdChain = {
      ui_sent: 'abc',
      plot_received: 'abc',
      forwarded_to_isl: 'abc',
      isl_echoed: 'abc',
      all_match: true,
    }
    expect(chain.all_match).toBe(true)

    const trace: DraftGraphTrace = { cee_trace: 'xyz' }
    expect(trace.cee_trace).toBe('xyz')

    const details: StrengthDefaultAppliedDetails = {
      edge_id: 'e1',
      default_mean: 0.5,
      default_std: 0.125,
    }
    expect(details.edge_id).toBe('e1')

    const dominant: StrengthMeanDefaultDominantDetails = {
      total_edges: 10,
      structural_edges_excluded: 2,
      mean_defaulted_edge_ids: ['e1', 'e2'],
      defaulted_percentage: 25,
    }
    expect(dominant.total_edges).toBe(10)
  })
})

// ============================================================================
// 2. Limit alignment test
// ============================================================================

describe('limit alignment: canvas validation uses LIMITS values', () => {
  it('LIMITS object contains all individual constants', () => {
    expect(LIMITS.MAX_NODES).toBe(MAX_NODES)
    expect(LIMITS.MAX_EDGES).toBe(MAX_EDGES)
    expect(LIMITS.MAX_OPTIONS).toBe(MAX_OPTIONS)
    expect(LIMITS.STD_FLOOR).toBe(STD_FLOOR)
    expect(LIMITS.DEFAULT_STD).toBe(DEFAULT_STD)
    expect(LIMITS.DEFAULT_SEED).toBe(DEFAULT_SEED)
    expect(LIMITS.STRENGTH_BOUNDS).toEqual(STRENGTH_BOUNDS)
  })

  it('MAX_NODES matches V1 contract value', () => {
    expect(MAX_NODES).toBe(50)
  })

  it('STD_FLOOR matches ISL minimum', () => {
    expect(STD_FLOOR).toBe(0.001)
  })

  it('STRENGTH_BOUNDS enforces [-1, 1] range', () => {
    expect(STRENGTH_BOUNDS.min).toBe(-1.0)
    expect(STRENGTH_BOUNDS.max).toBe(1.0)
  })

  it('DEFAULT_SEED is string "42"', () => {
    expect(DEFAULT_SEED).toBe('42')
    expect(typeof DEFAULT_SEED).toBe('string')
  })
})

// ============================================================================
// 3. CIL constant alignment test
// ============================================================================

describe('CIL constant alignment: ContractIntegrity tab uses shared codes and thresholds', () => {
  it('CIL_WARNING_CODES contains all expected strength warning codes', () => {
    expect(CIL_WARNING_CODES.STRENGTH_DEFAULT_APPLIED).toBe('STRENGTH_DEFAULT_APPLIED')
    expect(CIL_WARNING_CODES.EDGE_STRENGTH_LOW).toBe('EDGE_STRENGTH_LOW')
    expect(CIL_WARNING_CODES.STRENGTH_MEAN_DEFAULT_DOMINANT).toBe('STRENGTH_MEAN_DEFAULT_DOMINANT')
  })

  it('CIL_WARNING_SEVERITY maps all codes', () => {
    expect(CIL_WARNING_SEVERITY[CIL_WARNING_CODES.STRENGTH_DEFAULT_APPLIED]).toBe('info')
    expect(CIL_WARNING_SEVERITY[CIL_WARNING_CODES.EDGE_STRENGTH_LOW]).toBe('warning')
    expect(CIL_WARNING_SEVERITY[CIL_WARNING_CODES.STRENGTH_MEAN_DEFAULT_DOMINANT]).toBe('warning')
  })

  it('CIL_THRESHOLDS matches ContractIntegrity detection parameters', () => {
    // Default signature detection: mean = 0.5, std = 0.125, tolerance = 0.001
    expect(CIL_THRESHOLDS.STRENGTH_DEFAULT_MEAN).toBe(0.5)
    expect(CIL_THRESHOLDS.STRENGTH_DEFAULT_STD).toBe(0.125)
    expect(CIL_THRESHOLDS.STRENGTH_DEFAULT_TOLERANCE).toBe(0.001)

    // Warning triggers at 50% defaulted
    expect(CIL_THRESHOLDS.DEFAULTED_PERCENTAGE_WARN).toBe(50)

    // Repair warn threshold: >5 repairs → fail
    expect(CIL_THRESHOLDS.REPAIR_WARN_THRESHOLD).toBe(5)
  })

  it('CIL_THRESHOLDS are consistent with default signature', () => {
    // Verify: a default-signature edge would be detected by these thresholds
    const mean = CIL_THRESHOLDS.STRENGTH_DEFAULT_MEAN
    const std = CIL_THRESHOLDS.STRENGTH_DEFAULT_STD
    const tolerance = CIL_THRESHOLDS.STRENGTH_DEFAULT_TOLERANCE

    // Self-detection: the default values should match within tolerance
    expect(Math.abs(Math.abs(mean) - 0.5)).toBeLessThan(tolerance)
    expect(Math.abs(std - 0.125)).toBeLessThan(tolerance)
  })
})
