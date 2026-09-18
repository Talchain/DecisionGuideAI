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
 *
 * ## ⛔⛔ AND THAT INVARIANT WAS FALSE WHEN IT WAS FIRST WRITTEN HERE — SELF-
 * CONTRADICTED FOUR TESTS LATER IN THIS SAME FILE
 *
 * The commit that stated it also added a staleness gate INSIDE the producer:
 * `influenceSetSize = graphEditedSinceLastRun ? null : new Set(...).size`. That
 * makes the assignment CONDITIONAL, so "rank present, denominator absent" was
 * not merely reachable — a describe at the foot of this file PRODUCED it, with
 * `sensitivityRank: 1` and `influenceSetSize: null` asserted side by side. The
 * docblock argued the optionality was safe and the spec four tests down proved
 * it was not, inside one commit. An invariant that the file asserting it also
 * refutes is worse than no invariant, because it reads as settled.
 *
 * ⭐ THE REPAIR IS NOT A STRONGER WORD IN THE DOCBLOCK. The gate moved to the
 * single render site (`FactorNode.tsx`, `useAnalysisResultsAreCurrent`), where
 * it belongs: "what is the size of the run's comparison set?" and "may this
 * claim be published?" are two questions, and answering both in one assignment
 * is CLAUDE.md trap 21. With the gate gone from here the assignment is once more
 * unconditional, the implication is TRUE, and the first describe pins something
 * real. The staleness describe that used to sit at the foot of this file now
 * lives in `FactorNode.influenceRanking.spec.tsx`, pointed at the surface that
 * actually makes the claim.
 *
 * ⚠ THE OTHER OPTION WAS TO MAKE THE FIELD REQUIRED, and it is rejected on the
 * measurement recorded on the field's docblock, not on preference: 100
 * `vi.mocked(useNodeDisplayMetadata).mockReturnValue` call sites across 24 spec
 * files, only four of which carry a typecheck-baseline entry, so the gate's
 * blocking per-file COUNT ratchet reds on ~20 newly-erroring files. The
 * fixture-blindness finding is closed by making the invariant TRUE, which is
 * what the argument always needed.
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

/**
 * ⚠ THE STORE SLICE THIS HOOK READS IS NOW EXACTLY TWO FIELDS, AND THAT IS THE
 * SHAPE OF THE FIX. A currency flag was threaded through here for one commit;
 * it is gone, because the licence to publish a denominator is not this
 * producer's question. `useNodeDisplayMetadata` reads `results.status` and
 * `results.report` and nothing else.
 */
const setReport = (factorSensitivity: Array<Record<string, unknown>>) => {
  mockState = {
    results: { status: 'complete', report: makeReport({ factor_sensitivity: factorSensitivity }) },
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

/*
 * ⛔ THE STALENESS DESCRIBE THAT STOOD HERE HAS MOVED, AND THE MOVE IS THE
 * POINT. It asserted `influenceSetSize === null` for a fixture seeded with
 * `graphEditedSinceLastRun: true` — which is precisely the "rank present,
 * denominator absent" state the first describe above declares unreachable. Two
 * describes in one file, one asserting an implication and the other producing
 * its counter-example.
 *
 * The claim it guarded is still guarded: `FactorNode.influenceRanking.spec.tsx`
 * now pins that a result the product cannot confirm is about the current graph
 * publishes no denominator, on BOTH views, with its control arm. It is pinned
 * at the surface that makes the claim rather than at the producer that computes
 * a count — and on a signal that survives a reload, which
 * `graphEditedSinceLastRun` does not (`canvas/store.ts:6026`/`:6097` reset it in
 * the same `set()` that installs a restored run).
 */
