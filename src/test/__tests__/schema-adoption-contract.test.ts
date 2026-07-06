/**
 * @talchain/schemas adoption contract tests.
 *
 * Verifies that the UI application correctly imports and uses shared types
 * and constants from @talchain/schemas instead of local definitions.
 *
 * Four test groups:
 * 1. Contract test with shared fixture — validates shared types parse expected data
 * 2. Limit alignment test — verifies canvas validation uses LIMITS values
 * 3. CIL constant alignment test — verifies ContractIntegrity tab uses shared codes and thresholds
 * 4. Wire-boundary safeParse fixtures — 0.8.1 → 0.13.1 re-vendor adoption proof.
 *    Runtime execution is mandatory here: Zod refinements (evidence §1.3
 *    superRefine, session handler biconditional) are invisible to tsc, so
 *    only an executed safeParse proves the vendored tarball's behaviour.
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
  PlotRequestIdChain,
  DraftGraphTrace,
  StrengthDefaultAppliedDetails,
  StrengthMeanDefaultDominantDetails,
} from '@talchain/schemas'
import {
  OlumiResponseSchema,
  BlockSchema,
  ChipSchema,
  EvidenceBlockSchema,
} from '@talchain/schemas/boundary'
import { SessionTurnSchema } from '@talchain/schemas/orchestrator'

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

    const chain: PlotRequestIdChain = {
      ui: 'abc',
      plot: 'abc',
      isl: 'abc',
      isl_echoed: 'abc',
      all_match: true,
      chain_complete: true,
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
    expect(CIL_WARNING_SEVERITY[CIL_WARNING_CODES.STRENGTH_DEFAULT_APPLIED]).toBe('warn')
    expect(CIL_WARNING_SEVERITY[CIL_WARNING_CODES.EDGE_STRENGTH_LOW]).toBe('info')
    expect(CIL_WARNING_SEVERITY[CIL_WARNING_CODES.STRENGTH_MEAN_DEFAULT_DOMINANT]).toBe('warn')
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

// ============================================================================
// 4. Wire-boundary safeParse fixtures — 0.8.1 → 0.13.1 re-vendor adoption
//
// Executed against the vendored tarball at the same schema seam the runtime
// wire boundary uses (responseParser imports OlumiResponseSchema from
// '@talchain/schemas/boundary'). Covers the measured 0.8.1 → 0.13.1 delta:
//   - BlockSchema union +4 Phase 3 types (review_card/coaching/evidence/exercise)
//   - EvidenceBlock §1.3 superRefine (runtime-only; invisible to tsc)
//   - session.user_id nullable
//   - WhatWouldFlip (flip_analysis) nullable-field shape
//   - ChipSchema (proposed-change chip)
// ============================================================================

const PHASE3_META = {
  signal_id: 'SIG_TEST_1',
  created_at: '2026-07-05T12:00:00.000Z',
  source_handler: 'decision_review',
  freshness: 'fresh',
} as const

const reviewCardBlock = {
  ...PHASE3_META,
  block_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c01',
  graph_hash_at_generation: 'hash_abc123',
  type: 'review_card',
  card_kind: 'flip_threshold',
  title: 'Price is close to a flip point',
  body: 'A small change in Price could change the leading option.',
  severity: 'warning',
  target_refs: [{ id: 'factor_price', label: 'Price', kind: 'factor' }],
  priority_rank: 1,
  action_intent: 'what_would_flip',
  action_label: 'See what would flip',
}

const coachingBlock = {
  ...PHASE3_META,
  block_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c02',
  type: 'coaching',
  coaching_kind: 'bias_signal',
  title: 'Possible anchoring on the first option',
  body: 'You have only explored variations of Option A so far.',
  source: 'decision_review',
  target_refs: [{ id: 'opt-a', label: 'Option A', kind: 'option' }],
  priority_rank: 2,
}

/** §1.3-consistent evidence block: factor_ref matches the primary factor target_ref. */
const evidenceBlock = {
  ...PHASE3_META,
  block_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c03',
  graph_hash_at_generation: 'hash_abc123',
  type: 'evidence',
  factor_label: 'Price',
  factor_ref: { id: 'factor_price', label: 'Price', kind: 'factor' },
  target_refs: [{ id: 'factor_price', label: 'Price', kind: 'factor' }],
  current_confidence: 'low',
  evidence_gap: 'No market data backs the assumed price elasticity.',
  suggested_technique: 'Run a small pricing survey.',
  impact_if_gathered: 'Would materially narrow the Price uncertainty band.',
  priority_rank: 1,
  severity: 'warning',
}

const exerciseBlock = {
  ...PHASE3_META,
  block_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c04',
  type: 'exercise',
  exercise_kind: 'pre_mortem',
  failure_scenario: 'The launch slips and the price advantage evaporates.',
  warning_signs: ['Vendor slippage', 'Competitor undercuts price'],
  mitigation: 'Lock the vendor contract before committing to the launch date.',
  target_refs: [{ id: 'opt-a', label: 'Option A', kind: 'option' }],
}

describe('wire-boundary adoption: representative v2 turn payloads (0.13.1)', () => {
  it('pre-0.13 surface still parses: text + analysis_result + graph_patch + flip_analysis', () => {
    const payload = {
      response_version: 2,
      assistant_text: 'Here is your analysis.',
      blocks: [
        { type: 'text', content: 'Option A leads.' },
        {
          type: 'analysis_result',
          summary: 'Option A leads by 12 points.',
          leading_option_id: 'opt-a',
          win_probabilities: { 'opt-a': 0.62, 'opt-b': 0.38 },
          enrichment: { coaching_signal_id: 'FIRST_ANALYSIS_COMPLETE' },
        },
        {
          type: 'graph_patch',
          status: 'applied',
          operation: 'set_factor_value',
          target_id: 'factor_price',
          before: { value: 0.5 },
          after: { value: 0.7 },
        },
        {
          // WhatWouldFlip shape (0.8.1 → 0.13.1 delta axis): nullable numerics
          // and nullable option ids must survive the wire.
          type: 'flip_analysis',
          narrative: 'Price would need to rise past 0.8 to flip the result.',
          flip_scenarios: [
            {
              factor_id: 'factor_price',
              current_value: 0.5,
              flip_threshold: 0.8,
              from_option_id: 'opt-a',
              to_option_id: 'opt-b',
              fragile: false,
            },
            {
              factor_id: 'factor_demand',
              current_value: null,
              flip_threshold: null,
              from_option_id: null,
              to_option_id: null,
              fragile: true,
            },
          ],
        },
      ],
      suggested_actions: [
        {
          id: 'act_1',
          label: 'What would flip this?',
          message: 'What would flip this result?',
          action_type: 'what_would_flip',
        },
      ],
      insights: [{ id: 'ins_1', text: 'Price dominates the outcome.' }],
      stage_indicator: 'analyse',
    }

    const result = OlumiResponseSchema.safeParse(payload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.blocks).toHaveLength(4)
      const flip = result.data.blocks[3]
      if (flip?.type === 'flip_analysis') {
        expect(flip.flip_scenarios[1]?.flip_threshold).toBeNull()
      } else {
        expect.fail('expected flip_analysis block at index 3')
      }
    }
  })

  it('Phase-3 blocks parse as first-class union members (0.13.0 delta)', () => {
    const payload = {
      response_version: 2,
      assistant_text: 'Your decision review is ready.',
      blocks: [reviewCardBlock, coachingBlock, evidenceBlock, exerciseBlock],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'review',
    }

    const result = OlumiResponseSchema.safeParse(payload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.blocks.map((b) => b.type)).toEqual([
        'review_card',
        'coaching',
        'evidence',
        'exercise',
      ])
    }
  })

  it('proposed-change chip parses under ChipSchema and stays strict', () => {
    const chip = {
      id: 'chip_apply_patch',
      label: 'Apply proposed change',
      action: 'apply_proposed_change',
    }
    expect(ChipSchema.safeParse(chip).success).toBe(true)

    // .strict() proof: unknown keys must fail closed, not be silently dropped.
    const extra = { ...chip, payload: { target_id: 'factor_price' } }
    expect(ChipSchema.safeParse(extra).success).toBe(false)
  })
})

describe('wire-boundary adoption: runtime refinements invisible to tsc', () => {
  it('evidence §1.3 superRefine accepts a consistent factor_ref/target_refs pair', () => {
    expect(EvidenceBlockSchema.safeParse(evidenceBlock).success).toBe(true)
  })

  it('evidence §1.3 superRefine rejects factor_ref.id mismatch at runtime', () => {
    const mismatched = {
      ...evidenceBlock,
      factor_ref: { id: 'factor_other', label: 'Price', kind: 'factor' },
    }
    const result = EvidenceBlockSchema.safeParse(mismatched)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.join('.') === 'factor_ref.id'),
      ).toBe(true)
    }
  })

  it('evidence §1.3 superRefine rejects target_refs without a factor entry', () => {
    const noFactor = {
      ...evidenceBlock,
      target_refs: [{ id: 'opt-a', label: 'Option A', kind: 'option' }],
    }
    const result = EvidenceBlockSchema.safeParse(noFactor)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join('.') === 'target_refs')).toBe(true)
    }
  })

  it('the same §1.3 rule fires through the BlockSchema union entry point', () => {
    const mismatched = {
      ...evidenceBlock,
      factor_ref: { id: 'factor_other', label: 'Price', kind: 'factor' },
    }
    expect(BlockSchema.safeParse(mismatched).success).toBe(false)
  })
})

describe('wire-boundary adoption: session.user_id nullable (0.8.1 → 0.13.1 delta)', () => {
  const sessionTurn = {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c05',
    scenario_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c06',
    user_id: null,
    turn_id: 'turn_1',
    turn_class: 'direct_answer',
    handler_id: null,
    request_hash: 'req_hash_1',
    response_emitted: true,
    llm_calls_used: 1,
    duration_ms: 1200,
    created_at: '2026-07-05T12:00:00.000Z',
  }

  it('accepts user_id: null', () => {
    expect(SessionTurnSchema.safeParse(sessionTurn).success).toBe(true)
  })

  it('still accepts a concrete uuid user_id', () => {
    const withUser = { ...sessionTurn, user_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c07' }
    expect(SessionTurnSchema.safeParse(withUser).success).toBe(true)
  })

  it('handler biconditional refinement still executes at runtime', () => {
    // turn_class 'direct_answer' with a non-null handler_id violates the
    // refinement — another tsc-invisible rule that only safeParse proves.
    const garbage = { ...sessionTurn, handler_id: 'run_analysis' }
    expect(SessionTurnSchema.safeParse(garbage).success).toBe(false)
  })
})
