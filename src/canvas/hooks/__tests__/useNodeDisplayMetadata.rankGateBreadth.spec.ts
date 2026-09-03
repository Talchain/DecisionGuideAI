/**
 * useNodeDisplayMetadata — the rank badge may not claim more than the numbers
 * determine, and may not print a manufactured zero as a measurement.
 *
 * ⚠⚠ THE DEFECT THESE PIN (derived at the bytes, 2026-09-03).
 *
 * (1) THE GATE ASKED A NARROWER QUESTION THAN THE BADGE PROMISED.
 *     `hasClearInfluenceLeader` asks only "is the TOP unique?", and the hook
 *     then handed out `#1`, `#2` AND `#3` on that one answer. On a real user's
 *     model eight factors came back at `{1.00, 0.67 x6, 0.00}` — six tied. The
 *     leader gate passes, so `#2` and `#3` went to two of the six tied
 *     factors, selected by `compareByDisplayModel` falling through value →
 *     elasticity → `key.localeCompare`: ALPHABETICAL NODE ID. The badge that
 *     renders it (`BaseNode.tsx`) is titled "Key driver #N: ranked by
 *     influence on the outcome" — so the product asserted a sensitivity
 *     ranking it did not have and attributed it to a measurement.
 *
 * (2) `Influence 0%` IS INDISTINGUISHABLE FROM "NO DATA", AND THE CANVAS IS
 *     THE ONLY SURFACE THAT PRINTS IT. The feed's normaliser ends its
 *     magnitude chain with a terminal `: 0`, and `computeNormalisedInfluences`
 *     deliberately maps a magnitude-less SET to all-zero as a sentinel. The
 *     Drivers panel absorbs both (`isZeroImpact` filters such a driver out of
 *     its default view); the canvas printed `Influence 0%` beside the node.
 *
 * ⚠ EVERY ASSERTION BINDS BY FACTOR ID. On the tied set the six values are
 * byte-identical, so no value predicate could tell one tied factor from
 * another (trap 19) — the ids are what make these tests about the object they
 * name.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useNodeDisplayMetadata, MAX_BADGED_RANK } from '../useNodeDisplayMetadata'

const makeReport = (overrides: Record<string, unknown> = {}) => ({
  schema: 'report.v1' as const,
  meta: { seed: 1, elapsed_ms: 100 },
  result: { mean: 0.7, p10: 0.5, p50: 0.7, p90: 0.9, critique: '' },
  bands: { p10: 0.5, p50: 0.7, p90: 0.9 },
  ...overrides,
})

let mockState = {
  results: { status: 'idle' as string, report: null as unknown },
}

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: typeof mockState) => unknown) => selector(mockState)),
}))

import { useCanvasStore } from '../../store'

beforeEach(() => {
  vi.clearAllMocks()
  mockState = { results: { status: 'idle', report: null } }
  vi.mocked(useCanvasStore).mockImplementation((selector) => selector(mockState as never))
})

const setReport = (factorSensitivity: Array<Record<string, unknown>>) => {
  mockState = {
    results: {
      status: 'complete',
      report: makeReport({ factor_sensitivity: factorSensitivity }),
    },
  }
}

const rankOf = (nodeId: string) =>
  renderHook(() => useNodeDisplayMetadata(nodeId, 'factor')).result.current.sensitivityRank

const metaOf = (nodeId: string) =>
  renderHook(() => useNodeDisplayMetadata(nodeId, 'factor')).result.current

/**
 * THE LIVE SET, 2026-09-03: eight factors, influences {1.00, 0.67 x6, 0.00}.
 * Elasticities are identical across the tied six, which is what leaves
 * `key.localeCompare` deciding their order. Ids are deliberately NOT in
 * alphabetical agreement with any influence ordering, so an alphabetical
 * result is distinguishable from a value-ordered one.
 */
const LIVE_TIED_SET = [
  { factor_id: 'fac_h_regulatory', influence_score: 0.67, elasticity: 2.4 },
  { factor_id: 'fac_a_pricing', influence_score: 1.0, elasticity: 3.6 },
  { factor_id: 'fac_c_churn', influence_score: 0.67, elasticity: 2.4 },
  { factor_id: 'fac_b_migration', influence_score: 0.67, elasticity: 2.4 },
  { factor_id: 'fac_g_headcount', influence_score: 0.67, elasticity: 2.4 },
  { factor_id: 'fac_d_latency', influence_score: 0.67, elasticity: 2.4 },
  { factor_id: 'fac_f_support', influence_score: 0.67, elasticity: 2.4 },
  { factor_id: 'fac_e_backlog', influence_score: 0.0, elasticity: 0.0 },
]

describe('useNodeDisplayMetadata — the rank badge claims only what is determined', () => {
  it('THE DEFECT: on the live tied set, #2 and #3 are withheld from the alphabetically-selected factors', () => {
    setReport(LIVE_TIED_SET)
    // `fac_b_migration` and `fac_c_churn` are the two the ungated comparator
    // crowned #2 and #3 — they win `key.localeCompare` among the tied six.
    // Bound by ID: all six share one value and one elasticity, so nothing but
    // the id identifies them.
    expect(rankOf('fac_b_migration')).toBeNull()
    expect(rankOf('fac_c_churn')).toBeNull()
    // …and every other tied member is withheld too, so this is not a single
    // lucky case.
    for (const id of ['fac_d_latency', 'fac_f_support', 'fac_g_headcount', 'fac_h_regulatory']) {
      expect(rankOf(id)).toBeNull()
    }
  })

  it('the genuinely-clear leader KEEPS its #1 — the numeral is not removed, only the false part', () => {
    setReport(LIVE_TIED_SET)
    expect(rankOf('fac_a_pricing')).toBe(1)
  })

  it('PRECONDITION, pinned in-test: the withheld factors ARE in the analysis and keep their number', () => {
    // Without this, the nulls above could be a dropped/absent row rather than
    // the gate firing — the test would pass for the wrong reason.
    // ⚠ The first draft of this test omitted the line below and measured an
    // IDLE store: every field read empty and the "precondition" asserted
    // nothing about the tied set. It failed loudly, which is the only reason
    // it is not still sitting here agreeing with itself.
    setReport(LIVE_TIED_SET)
    const tied = metaOf('fac_b_migration')
    expect(tied.inSensitivityAnalysis).toBe(true)
    expect(tied.influence).toBe(0.67)
    expect(tied.influenceProvenance).toBe('influence_score')
  })

  it('OPPOSITE-DIRECTION TWIN: a genuinely determined set still gets all three badges', () => {
    setReport([
      { factor_id: 'fac_a_pricing', influence_score: 1.0, elasticity: 3.6 },
      { factor_id: 'fac_b_migration', influence_score: 0.8, elasticity: 2.9 },
      { factor_id: 'fac_c_churn', influence_score: 0.6, elasticity: 2.2 },
      { factor_id: 'fac_d_latency', influence_score: 0.4, elasticity: 1.4 },
    ])
    expect(rankOf('fac_a_pricing')).toBe(1)
    expect(rankOf('fac_b_migration')).toBe(2)
    expect(rankOf('fac_c_churn')).toBe(3)
    // The cap still holds — rank 4 is determined but not badged.
    expect(rankOf('fac_d_latency')).toBeNull()
    expect(MAX_BADGED_RANK).toBe(3)
  })

  it('a tie at rank 3 withholds #3 while #1 and #2 survive', () => {
    setReport([
      { factor_id: 'fac_a_pricing', influence_score: 1.0, elasticity: 3.6 },
      { factor_id: 'fac_b_migration', influence_score: 0.7, elasticity: 2.5 },
      { factor_id: 'fac_c_churn', influence_score: 0.4, elasticity: 1.5 },
      { factor_id: 'fac_d_latency', influence_score: 0.4, elasticity: 1.5 },
    ])
    expect(rankOf('fac_a_pricing')).toBe(1)
    expect(rankOf('fac_b_migration')).toBe(2)
    expect(rankOf('fac_c_churn')).toBeNull()
    expect(rankOf('fac_d_latency')).toBeNull()
  })

  it('a tie at the TOP still withholds everything (the depth-1 behaviour is preserved)', () => {
    setReport([
      { factor_id: 'fac_a_migration', influence_score: 0.8333333333333334, elasticity: 5.460487156 },
      { factor_id: 'fac_b_headcount', influence_score: 0.8333333333333334, elasticity: 5.460487156 },
      { factor_id: 'fac_c_pricing', influence_score: 0.8333333333333334, elasticity: 5.460487156 },
    ])
    expect(rankOf('fac_a_migration')).toBeNull()
    expect(rankOf('fac_c_pricing')).toBeNull()
  })
})

describe('useNodeDisplayMetadata — a manufactured zero is not a measurement', () => {
  it('THE DEFECT (row-level): a row carrying NO metric field withholds the influence figure', () => {
    setReport([
      { factor_id: 'fac_a_pricing', elasticity: 3.6 },
      { factor_id: 'fac_b_migration', elasticity: 1.2 },
      // No elasticity, no sensitivity, no importance, no influence_score.
      // `getRawElasticity` manufactures a terminal 0 for this row.
      { factor_id: 'fac_c_ghost', label: 'Something nobody measured' },
    ])
    const ghost = metaOf('fac_c_ghost')
    expect(ghost.influence).toBeNull()
    expect(ghost.influenceProvenance).toBeNull()
    // PRECONDITION: the row IS in the analysis set — the null is the
    // safeguard firing, not an absent row.
    expect(ghost.inSensitivityAnalysis).toBe(true)
  })

  it('OPPOSITE-DIRECTION TWIN: a REAL measured zero still renders as a number', () => {
    setReport([
      { factor_id: 'fac_a_pricing', elasticity: 3.6 },
      { factor_id: 'fac_b_migration', elasticity: 1.2 },
      // An explicit zero IS a finding: this factor was measured and moves
      // nothing. It must not be swallowed by the safeguard above.
      { factor_id: 'fac_c_inert', elasticity: 0 },
    ])
    const inert = metaOf('fac_c_inert')
    expect(inert.influence).toBe(0)
    expect(inert.influenceProvenance).toBe('normalised_elasticity')
    expect(inert.inSensitivityAnalysis).toBe(true)
  })

  it('THE DEFECT (set-level): a magnitude-less set withholds every figure, not just one', () => {
    // Every elasticity below the magnitude floor → `computeNormalisedInfluences`
    // returns the all-zero SENTINEL, which the panel reads as "switch to
    // direction-only". The canvas used to print `Influence 0%` for all of them.
    setReport([
      { factor_id: 'fac_a_pricing', elasticity: 0.0001 },
      { factor_id: 'fac_b_migration', elasticity: 0.0002 },
      { factor_id: 'fac_c_churn', elasticity: 0 },
    ])
    for (const id of ['fac_a_pricing', 'fac_b_migration', 'fac_c_churn']) {
      const meta = metaOf(id)
      expect(meta.influence).toBeNull()
      expect(meta.influenceProvenance).toBeNull()
      expect(meta.inSensitivityAnalysis).toBe(true)
    }
  })

  it('a genuine producer zero under COMPLETE coverage survives — it is an absolute score, not a sentinel', () => {
    // Every row carries influence_score, so the basis is the producer's own
    // absolute scale. A 0.0 there is a real measurement and must be shown.
    setReport([
      { factor_id: 'fac_a_pricing', influence_score: 1.0, elasticity: 3.6 },
      { factor_id: 'fac_b_migration', influence_score: 0.5, elasticity: 1.8 },
      { factor_id: 'fac_c_inert', influence_score: 0.0, elasticity: 0 },
    ])
    const inert = metaOf('fac_c_inert')
    expect(inert.influence).toBe(0)
    expect(inert.influenceProvenance).toBe('influence_score')
  })
})
