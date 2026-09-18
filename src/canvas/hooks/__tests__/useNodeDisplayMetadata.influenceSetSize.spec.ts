/**
 * ⭐⭐ THE DENOMINATOR BEHIND "MOST INFLUENTIAL OF 5" — what it counts, and when
 * it refuses to count at all.
 *
 * ⛔⛔ THIS SPEC HAS NEVER BEEN EXECUTED. Written under a hard no-install /
 * no-test-run constraint: no vitest, no tsc, no node_modules. Every expectation
 * is derived by reading `useNodeDisplayMetadata.ts` and `useResultsSectionData.ts`
 * at this branch's tip. CI is the authority; this lane makes no green claim.
 *
 * ## ABSENCE, WITH ITS CONTRAST CONTROL
 *
 * Swept at `2a433f99`: `influenceSetSize` → 2 files, BOTH SOURCE, 0 test.
 * Contrast in the same sweep: `influenceBasisNoun` → 10 files including 5
 * dedicated specs. The contrast fires hard, so the zero is real absence.
 *
 * ## ⭐⭐ THE INVARIANT THAT MAKES THE FIELD'S OPTIONALITY SAFE
 *
 * `influenceSetSize?: number | null` is optional on `NodeDisplayMetadata`, and
 * an optional field whose absence silently selects a DIFFERENT RENDER is
 * CLAUDE.md trap 3b waiting to happen — which is exactly what it did: every
 * pre-existing mock omits it, so the whole suite sat on the fallback branch
 * while the deployed card took the ranked one.
 *
 * Making it required was considered and rejected on measured grounds (recorded
 * in full on the field's own docblock): `vi.mocked(useNodeDisplayMetadata)
 * .mockReturnValue` has 100 call sites across 24 spec files in this tree, only
 * four of which carry a typecheck-baseline entry — so the gate's per-file COUNT
 * ratchet, which IS blocking, would red on ~20 newly-erroring files.
 *
 * What makes the optionality safe is not the default being convenient. It is
 * that the state "rank present, denominator absent" IS UNREACHABLE FROM THE
 * PRODUCER: the assignment is unconditional inside the factor branch and runs
 * BEFORE the rank gate. **That implication is what the first describe below
 * pins.** Move the assignment below the gate, make it conditional, or delete
 * it, and this REDs — which is what turns an optional field from a silent
 * fallback into a stated contract.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useNodeDisplayMetadata } from '../useNodeDisplayMetadata'

const makeReport = (overrides: Record<string, unknown> = {}) => ({
  schema: 'report.v1' as const,
  meta: { seed: 1, elapsed_ms: 100 },
  result: { mean: 0.7, p10: 0.5, p50: 0.7, p90: 0.9, critique: '' },
  bands: { p10: 0.5, p50: 0.7, p90: 0.9 },
  ...overrides,
})

let mockState = {
  results: { status: 'idle' as string, report: null as unknown },
  graphEditedSinceLastRun: false,
}

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: typeof mockState) => unknown) => selector(mockState)),
}))

import { useCanvasStore } from '../../store'

beforeEach(() => {
  vi.clearAllMocks()
  mockState = { results: { status: 'idle', report: null }, graphEditedSinceLastRun: false }
  vi.mocked(useCanvasStore).mockImplementation((selector) => selector(mockState as never))
})

const setReport = (
  factorSensitivity: Array<Record<string, unknown>>,
  graphEditedSinceLastRun = false,
) => {
  mockState = {
    results: { status: 'complete', report: makeReport({ factor_sensitivity: factorSensitivity }) },
    graphEditedSinceLastRun,
  }
}

const metaOf = (nodeId: string) =>
  renderHook(() => useNodeDisplayMetadata(nodeId, 'factor')).result.current

/**
 * A clearly-ordered set of five: no ties anywhere, so the rank gate licenses
 * ranks 1..3 and nothing here is confounded by the tie withholding.
 */
const FIVE_CLEAR = [
  { factor_id: 'fac_pricing', influence_score: 1.0, elasticity: 3.6 },
  { factor_id: 'fac_churn', influence_score: 0.8, elasticity: 2.9 },
  { factor_id: 'fac_latency', influence_score: 0.6, elasticity: 2.1 },
  { factor_id: 'fac_support', influence_score: 0.4, elasticity: 1.4 },
  { factor_id: 'fac_backlog', influence_score: 0.2, elasticity: 0.7 },
]

describe('THE INVARIANT: a rank is never published without its denominator', () => {
  it('every factor that gets a rank also gets a set size', () => {
    setReport(FIVE_CLEAR)
    const ranked = FIVE_CLEAR
      .map((f) => metaOf(f.factor_id))
      .filter((m) => m.sensitivityRank != null)
    // NON-VACUITY: if nothing were ranked, the loop below would assert nothing
    // and this whole describe would pass by testing zero cases
    // (CLAUDE.md trap 13 — an absence probe with no positive control).
    expect(ranked.length).toBeGreaterThan(0)
    for (const m of ranked) expect(m.influenceSetSize).not.toBeNull()
  })

  it('and the denominator is supplied even to factors the rank gate withholds', () => {
    setReport(FIVE_CLEAR)
    // `fac_backlog` is 5th, past MAX_BADGED_RANK, so its rank is withheld —
    // yet the count is still computed, because it is a property of the SET and
    // not of this node. This is what proves the assignment sits before the gate
    // rather than inside it.
    const m = metaOf('fac_backlog')
    expect(m.sensitivityRank).toBeNull()
    expect(m.influenceSetSize).toBe(5)
  })
})

describe('what the denominator counts', () => {
  it('counts the comparison set, which for a clean feed is its row count', () => {
    setReport(FIVE_CLEAR)
    expect(metaOf('fac_pricing').influenceSetSize).toBe(5)
  })

  it('counts DISTINCT factors — two rows sharing an id are one factor', () => {
    /* ⚠ THE SAME DUPLICATE-ID COLLAPSE `determinedRankDepth` ALREADY APPLIES.
       A denominator that counted rows while the rank counted factors would
       produce "2nd most influential of 3" on a set of two — the rank and its
       own denominator derived on different bases, which is precisely the defect
       `driverDisplayModel.ts` records one level down. */
    setReport([
      { factor_id: 'fac_pricing', influence_score: 1.0, elasticity: 3.6 },
      { factor_id: 'fac_pricing', influence_score: 0.9, elasticity: 3.1 },
      { factor_id: 'fac_churn', influence_score: 0.5, elasticity: 1.8 },
    ])
    expect(metaOf('fac_churn').influenceSetSize).toBe(2)
  })

  it('is null outside results mode — there is no set to count', () => {
    expect(metaOf('fac_pricing').influenceSetSize).toBeNull()
  })

  it('is null for a non-factor node — the question does not arise', () => {
    setReport(FIVE_CLEAR)
    const m = renderHook(() => useNodeDisplayMetadata('fac_pricing', 'option')).result.current
    expect(m.influenceSetSize == null).toBe(true)
  })
})

/**
 * ⭐⭐ THE STALENESS GATE — and why a stale DENOMINATOR is a different class of
 * wrong from a stale percentage.
 *
 * `results.status` survives a graph edit: it is cleared by a new run, not by a
 * mutation. So a figure from the last completed run outlives the model it
 * described. The old render carried that softly — once the graph moves, `80%`
 * is wrong but UNFALSIFIABLE from the screen. `of 5` is not: run over five
 * factors, add three, and the canvas shows EIGHT factor cards beside a row
 * still claiming `of 5`. The reader refutes the product by counting.
 *
 * ⚠ THE EXISTING FLAG, NOT A NEW ONE. `graphEditedSinceLastRun` is declared on
 * the store, initialised `false`, and set by both the internal edit chokepoint
 * (`pushToHistory`) and the external mutator entry point
 * (`markGraphStructurallyEdited`).
 *
 * ⚠ AND THE REFUSAL REUSES THE EXISTING FAIL-CLOSED ARM rather than minting a
 * ranked-but-uncountable third variant: with no denominator,
 * `influenceRankReadout` returns null and the row renders exactly what it
 * renders today.
 */
describe('a moved graph withdraws the denominator, and nothing else', () => {
  it('THE DEFECT: without the gate, an edited graph keeps printing a countable claim', () => {
    setReport(FIVE_CLEAR, true)
    expect(metaOf('fac_pricing').influenceSetSize).toBeNull()
  })

  it('the RANK is untouched — only the countable half of the claim is withdrawn', () => {
    /* ⚠ THIS IS THE DISCRIMINATING HALF OF THE PAIR, and without it the test
       above would pass on a gate that had disabled the whole factor branch.
       The `#N` badge, the inspector's "#N" and the edge's "ranked #N in
       influence" all read `sensitivityRank`; withdrawing it here would change
       three other surfaces this lane never argued for. */
    setReport(FIVE_CLEAR, true)
    const m = metaOf('fac_pricing')
    expect(m.sensitivityRank).toBe(1)
    expect(m.influence).not.toBeNull()
    expect(m.influenceProvenance).not.toBeNull()
  })

  it('CONTROL: the same set on an unedited graph DOES carry the denominator', () => {
    // Both arms asserted explicitly, so neither is reached by accident and the
    // gate is shown to discriminate rather than merely to return null.
    setReport(FIVE_CLEAR, false)
    expect(metaOf('fac_pricing').influenceSetSize).toBe(5)
    expect(metaOf('fac_pricing').sensitivityRank).toBe(1)
  })
})
