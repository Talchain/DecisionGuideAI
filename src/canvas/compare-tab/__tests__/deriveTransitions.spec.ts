import { describe, it, expect } from 'vitest'
import {
  deriveTransitions,
  buildCumulativeTransition,
  buildRangeTransition,
  compareStructure,
} from '../deriveTransitions'
import { makeAnalysisSnapshot } from './__fixtures__/analysisSnapshot'
import type { AnalysisSnapshot, FactorSensitivitySummary } from '../types'

// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------

function makeFactor(overrides: Partial<FactorSensitivitySummary> & { id: string }): FactorSensitivitySummary {
  return {
    label: overrides.id,
    elasticity: 0.3,
    rankFlipRate: 0.05,
    attributionStability: 'high',
    ...overrides,
  }
}

// Delegates to the ONE shared snapshot fixture (see that file's header on why
// six hand-kept copies of this literal were a trap-12 mirror). This spec's own
// default — a single top factor — is preserved by spreading over it.
function makeSnapshot(overrides: Partial<AnalysisSnapshot> & { runNumber: number }): AnalysisSnapshot {
  return makeAnalysisSnapshot({
    topFactors: [makeFactor({ id: 'fac-a', label: 'Churn', elasticity: 0.4 })],
    ...overrides,
  })
}

// ---------------------------------------------------------------------------
// deriveTransitions
// ---------------------------------------------------------------------------

describe('deriveTransitions', () => {
  // ── T2b: a robustness CHANGE requires BOTH ends to have been assessed ──
  //
  // Added because this lane's own headline finding is "the fix was unpinned",
  // and an adversarial review caught it shipping a SECOND unpinned fix: the
  // null-guard below could be reverted with this file staying 27/27 green.
  //
  // What the guard prevents: TransitionCard renders
  //   {tr.robustnessChanged && (Result stability: {tr.robustnessFrom} → {tr.robustnessTo})}
  // and JSX renders null as nothing — so an unguarded null→'stable' pair
  // reports "Result stability:  → stable": a change claimed from MISSING data.
  // That is precisely the fabrication class T2b exists to remove.
  //
  // MUTATION-CHECKED: dropping either `!= null` clause turns test (a) RED.
  describe('T2b — robustness change needs both ends assessed', () => {
    it('(a) does NOT claim a change when the earlier run had no robustness data', () => {
      const [tr] = deriveTransitions([
        makeSnapshot({ runNumber: 1, stabilityLabel: null }),
        makeSnapshot({ runNumber: 2, stabilityLabel: 'stable' }),
      ])
      expect(tr.robustnessChanged).toBe(false)
    })

    it('(b) does NOT claim a change when the later run has no robustness data', () => {
      const [tr] = deriveTransitions([
        makeSnapshot({ runNumber: 1, stabilityLabel: 'stable' }),
        makeSnapshot({ runNumber: 2, stabilityLabel: null }),
      ])
      expect(tr.robustnessChanged).toBe(false)
    })

    it('(c) DOES claim a change when both ends are assessed and differ', () => {
      const [tr] = deriveTransitions([
        makeSnapshot({ runNumber: 1, stabilityLabel: 'fragile' }),
        makeSnapshot({ runNumber: 2, stabilityLabel: 'stable' }),
      ])
      expect(tr.robustnessChanged).toBe(true)
    })
  })

  it('returns empty for fewer than 2 snapshots', () => {
    expect(deriveTransitions([])).toEqual([])
    expect(deriveTransitions([makeSnapshot({ runNumber: 1 })])).toEqual([])
  })

  it('creates one transition for 2 snapshots', () => {
    const snapshots = [
      makeSnapshot({ runNumber: 1, winnerProbability: 60 }),
      makeSnapshot({ runNumber: 2, winnerProbability: 70 }),
    ]
    const result = deriveTransitions(snapshots)
    expect(result).toHaveLength(1)
    expect(result[0].fromRunNumber).toBe(1)
    expect(result[0].toRunNumber).toBe(2)
    expect(result[0].winnerProbDelta).toBe(10)
  })

  it('creates N-1 transitions for N snapshots', () => {
    const snapshots = [
      makeSnapshot({ runNumber: 1 }),
      makeSnapshot({ runNumber: 2 }),
      makeSnapshot({ runNumber: 3 }),
    ]
    expect(deriveTransitions(snapshots)).toHaveLength(2)
  })

  describe('magnitude thresholds', () => {
    it('classifies >=10pp as major', () => {
      const snapshots = [
        makeSnapshot({ runNumber: 1, winnerProbability: 55 }),
        makeSnapshot({ runNumber: 2, winnerProbability: 65 }),
      ]
      expect(deriveTransitions(snapshots)[0].magnitude).toBe('major')
    })

    it('classifies exactly 10pp as major', () => {
      const snapshots = [
        makeSnapshot({ runNumber: 1, winnerProbability: 60 }),
        makeSnapshot({ runNumber: 2, winnerProbability: 70 }),
      ]
      expect(deriveTransitions(snapshots)[0].magnitude).toBe('major')
    })

    it('classifies >=3pp and <10pp as refinement', () => {
      const snapshots = [
        makeSnapshot({ runNumber: 1, winnerProbability: 60 }),
        makeSnapshot({ runNumber: 2, winnerProbability: 65 }),
      ]
      expect(deriveTransitions(snapshots)[0].magnitude).toBe('refinement')
    })

    it('classifies <3pp as minor', () => {
      const snapshots = [
        makeSnapshot({ runNumber: 1, winnerProbability: 70 }),
        makeSnapshot({ runNumber: 2, winnerProbability: 72 }),
      ]
      expect(deriveTransitions(snapshots)[0].magnitude).toBe('minor')
    })

    it('classifies negative deltas correctly', () => {
      const snapshots = [
        makeSnapshot({ runNumber: 1, winnerProbability: 75 }),
        makeSnapshot({ runNumber: 2, winnerProbability: 60 }),
      ]
      expect(deriveTransitions(snapshots)[0].magnitude).toBe('major')
    })
  })

  describe('structure detection', () => {
    // ⚠ REVERSED BY ROADMAP 2.578, DELIBERATELY — this test used to assert
    // `structureChanged === true` here, and that expectation WAS the defect.
    // `generateGraphHash` hashes edge weight/confidence/belief, so it is a
    // CONTENT hash: a value-only edit (`+0.50 → +0.80`) changes it. Reading its
    // inequality as a STRUCTURE claim is how Compare came to render "Structure
    // changed — comparison is directional only" for a link-strength edit, on the
    // same card that said "Rerun (no edits)" (observed 2026-08-05).
    // A hash inequality is real evidence that SOMETHING changed, and that is
    // exactly what it is now reported as.
    it('a hash inequality alone does NOT license a structure claim — it is a content hash', () => {
      const snapshots = [
        makeSnapshot({ runNumber: 1, graphHash: 'hash-1' }),
        makeSnapshot({ runNumber: 2, graphHash: 'hash-2' }),
      ]
      const [tr] = deriveTransitions(snapshots)
      expect(tr.structureChanged).toBe(false)
      // …but the signal is NOT thrown away.
      expect(tr.changeVerdict.kind).toBe('uncharacterised_change')
    })

    it('detects node count change', () => {
      const snapshots = [
        makeSnapshot({ runNumber: 1, nodeCount: 5 }),
        makeSnapshot({ runNumber: 2, nodeCount: 6 }),
      ]
      expect(deriveTransitions(snapshots)[0].structureChanged).toBe(true)
    })

    it('detects edge count change', () => {
      const snapshots = [
        makeSnapshot({ runNumber: 1, edgeCount: 4 }),
        makeSnapshot({ runNumber: 2, edgeCount: 6 }),
      ]
      expect(deriveTransitions(snapshots)[0].structureChanged).toBe(true)
    })

    it('returns false when structure unchanged', () => {
      const snapshots = [
        makeSnapshot({ runNumber: 1 }),
        makeSnapshot({ runNumber: 2 }),
      ]
      expect(deriveTransitions(snapshots)[0].structureChanged).toBe(false)
    })

    // ⚠ HASH REGIMES NEVER COMPARE (ROADMAP 2.113a slice 1).
    // A session snapshot's graphHash is the UI's generateGraphHash; a
    // persisted run's is CEE's analysis-affecting aag_v1. They are ALWAYS
    // unequal, so an unguarded `!==` would assert "structure changed" on
    // every transition across the provenance boundary — a claim about the
    // user's model manufactured out of where the data was read from.
    it('does NOT claim a structure change across two different hash regimes', () => {
      const snapshots = [
        makeSnapshot({ runNumber: 1, source: 'persisted', graphHash: 'aag_v1_abc' }),
        makeSnapshot({ runNumber: 2, source: 'session', graphHash: 'ui_hash_xyz' }),
      ]
      expect(deriveTransitions(snapshots)[0].structureChanged).toBe(false)
    })

    // The ORIGINAL INTENT of this test — "the regime guard must not become a
    // blanket off-switch" — is preserved exactly. What changed (ROADMAP 2.578)
    // is only WHICH claim a same-regime inequality licenses: it proves the model
    // moved, not that its SHAPE moved. Asserting the verdict rather than a
    // boolean is what stops the fix from quietly discarding the signal.
    it('DOES still compare hashes within one regime (the guard is not a blanket off-switch)', () => {
      const snapshots = [
        makeSnapshot({ runNumber: 1, source: 'persisted', graphHash: 'aag-1' }),
        makeSnapshot({ runNumber: 2, source: 'persisted', graphHash: 'aag-2' }),
      ]
      const [tr] = deriveTransitions(snapshots)
      expect(tr.changeVerdict.kind).toBe('uncharacterised_change')
      expect(tr.structureChanged).toBe(false)
    })

    // The control for the test above: EQUAL same-regime hashes must still read
    // as unchanged, so "uncharacterised_change" cannot be reached by any pair.
    it('same regime, EQUAL hashes ⇒ unchanged (the inequality arm is discriminating)', () => {
      const snapshots = [
        makeSnapshot({ runNumber: 1, source: 'persisted', graphHash: 'aag-1' }),
        makeSnapshot({ runNumber: 2, source: 'persisted', graphHash: 'aag-1' }),
      ]
      expect(deriveTransitions(snapshots)[0].changeVerdict.kind).toBe('unchanged')
    })

    it('an absent hash at either end is no evidence, not a change', () => {
      const snapshots = [
        makeSnapshot({ runNumber: 1, source: 'persisted', graphHash: null }),
        makeSnapshot({ runNumber: 2, source: 'persisted', graphHash: 'aag-2' }),
      ]
      expect(deriveTransitions(snapshots)[0].structureChanged).toBe(false)
    })

    it('null node/edge counts are no evidence, not a change (persisted runs carry no graph)', () => {
      const snapshots = [
        makeSnapshot({ runNumber: 1, source: 'persisted', graphHash: 'aag-1', nodeCount: null, edgeCount: null }),
        makeSnapshot({ runNumber: 2, source: 'persisted', graphHash: 'aag-1', nodeCount: null, edgeCount: null }),
      ]
      expect(deriveTransitions(snapshots)[0].structureChanged).toBe(false)
    })

    it('cumulative caveat: no cross-regime "Structure changed during this period"', () => {
      const snapshots = [
        makeSnapshot({ runNumber: 1, source: 'persisted', graphHash: 'aag-1' }),
        makeSnapshot({ runNumber: 2, source: 'persisted', graphHash: 'aag-1' }),
        makeSnapshot({ runNumber: 3, source: 'session', graphHash: 'ui-hash' }),
      ]
      const cumulative = buildCumulativeTransition(snapshots)!
      expect(cumulative.cumulativeCaveats).not.toContain('Structure changed during this period')
    })
  })

  describe('E-value surfacing', () => {
    it('returns lowest E-value from snapshot', () => {
      const snapshots = [
        makeSnapshot({ runNumber: 1 }),
        makeSnapshot({
          runNumber: 2,
          edgeEValues: [
            { edgeId: 'fac-a->out-1', edgeLabel: 'Churn → Revenue', eValue: 1.4 },
            { edgeId: 'fac-b->out-1', edgeLabel: 'Growth → Revenue', eValue: 3.2 },
          ],
        }),
      ]
      const t = deriveTransitions(snapshots)[0]
      expect(t.eValue).toBe(1.4)
      expect(t.eValueEdge).toBe('Churn → Revenue')
    })

    it('returns null when no E-values', () => {
      const snapshots = [
        makeSnapshot({ runNumber: 1 }),
        makeSnapshot({ runNumber: 2, edgeEValues: [] }),
      ]
      expect(deriveTransitions(snapshots)[0].eValue).toBeNull()
    })
  })

  describe('warning diffs', () => {
    it('identifies resolved warnings', () => {
      const snapshots = [
        makeSnapshot({ runNumber: 1, inferenceWarnings: ['WARN_A', 'WARN_B'] }),
        makeSnapshot({ runNumber: 2, inferenceWarnings: ['WARN_B'] }),
      ]
      const t = deriveTransitions(snapshots)[0]
      expect(t.warningsResolved).toEqual(['WARN_A'])
      expect(t.warningsIntroduced).toEqual([])
    })

    it('identifies introduced warnings', () => {
      const snapshots = [
        makeSnapshot({ runNumber: 1, inferenceWarnings: [] }),
        makeSnapshot({ runNumber: 2, inferenceWarnings: ['WARN_NEW'] }),
      ]
      expect(deriveTransitions(snapshots)[0].warningsIntroduced).toEqual(['WARN_NEW'])
    })
  })

  describe('deterministic anchor', () => {
    it('shows "remained" when top factor unchanged', () => {
      const factors = [makeFactor({ id: 'fac-a', label: 'Churn', elasticity: 0.4 })]
      const snapshots = [
        makeSnapshot({ runNumber: 1, topFactors: factors }),
        makeSnapshot({ runNumber: 2, topFactors: factors }),
      ]
      expect(deriveTransitions(snapshots)[0].deterministicAnchor)
        .toContain('Churn remained the top influence factor')
    })

    it('shows "overtook" when top factor changed', () => {
      const snapshots = [
        makeSnapshot({
          runNumber: 1,
          topFactors: [makeFactor({ id: 'fac-a', label: 'Churn', elasticity: 0.5 })],
        }),
        makeSnapshot({
          runNumber: 2,
          topFactors: [makeFactor({ id: 'fac-b', label: 'Growth', elasticity: 0.6 })],
        }),
      ]
      expect(deriveTransitions(snapshots)[0].deterministicAnchor)
        .toContain('Growth overtook Churn')
    })
  })

  it('sets reason and aiContext to null (not yet available)', () => {
    const snapshots = [
      makeSnapshot({ runNumber: 1 }),
      makeSnapshot({ runNumber: 2 }),
    ]
    const t = deriveTransitions(snapshots)[0]
    expect(t.reason).toBeNull()
    expect(t.aiContext).toBeNull()
  })

  describe('affected factors', () => {
    it('detects rank shift >= 2 positions', () => {
      const snapshots = [
        makeSnapshot({
          runNumber: 1,
          topFactors: [
            makeFactor({ id: 'fac-a', elasticity: 0.5 }),
            makeFactor({ id: 'fac-b', elasticity: 0.4 }),
            makeFactor({ id: 'fac-c', elasticity: 0.3 }),
          ],
        }),
        makeSnapshot({
          runNumber: 2,
          topFactors: [
            makeFactor({ id: 'fac-c', elasticity: 0.6 }),
            makeFactor({ id: 'fac-b', elasticity: 0.4 }),
            makeFactor({ id: 'fac-a', elasticity: 0.3 }),
          ],
        }),
      ]
      const t = deriveTransitions(snapshots)[0]
      // fac-a: rank 0→2 (shift 2), fac-c: rank 2→0 (shift 2)
      expect(t.affectedFactorIds).toContain('fac-a')
      expect(t.affectedFactorIds).toContain('fac-c')
    })

    it('detects >20% elasticity change', () => {
      const snapshots = [
        makeSnapshot({
          runNumber: 1,
          topFactors: [makeFactor({ id: 'fac-a', elasticity: 0.5 })],
        }),
        makeSnapshot({
          runNumber: 2,
          topFactors: [makeFactor({ id: 'fac-a', elasticity: 0.7 })], // 40% change
        }),
      ]
      expect(deriveTransitions(snapshots)[0].affectedFactorIds).toContain('fac-a')
    })
  })
})

// ---------------------------------------------------------------------------
// buildCumulativeTransition
// ---------------------------------------------------------------------------

describe('buildCumulativeTransition', () => {
  it('returns null for fewer than 3 snapshots', () => {
    expect(buildCumulativeTransition([])).toBeNull()
    expect(buildCumulativeTransition([makeSnapshot({ runNumber: 1 })])).toBeNull()
    expect(buildCumulativeTransition([
      makeSnapshot({ runNumber: 1 }),
      makeSnapshot({ runNumber: 2 }),
    ])).toBeNull()
  })

  it('builds cumulative card from first to latest', () => {
    const snapshots = [
      makeSnapshot({ runNumber: 1, winnerProbability: 60 }),
      makeSnapshot({ runNumber: 2, winnerProbability: 65 }),
      makeSnapshot({ runNumber: 3, winnerProbability: 73 }),
    ]
    const result = buildCumulativeTransition(snapshots)!
    expect(result.isCumulative).toBe(true)
    expect(result.fromRunNumber).toBe(1)
    expect(result.toRunNumber).toBe(3)
    expect(result.winnerProbDelta).toBe(13) // 73 - 60
  })

  it('includes intermediate count caveat', () => {
    const snapshots = [
      makeSnapshot({ runNumber: 1 }),
      makeSnapshot({ runNumber: 2 }),
      makeSnapshot({ runNumber: 3 }),
    ]
    const result = buildCumulativeTransition(snapshots)!
    expect(result.cumulativeCaveats).toContainEqual(
      expect.stringContaining('1 intermediate refinement')
    )
  })

  it('includes flip caveat when winner changed in intermediate runs', () => {
    const snapshots = [
      makeSnapshot({ runNumber: 1, winnerId: 'opt-a' }),
      makeSnapshot({ runNumber: 2, winnerId: 'opt-b' }),
      makeSnapshot({ runNumber: 3, winnerId: 'opt-a' }),
    ]
    const result = buildCumulativeTransition(snapshots)!
    expect(result.cumulativeCaveats).toContainEqual(
      expect.stringContaining('flipped')
    )
  })

  // ROADMAP 2.578: the trigger is now a COUNT change — genuine structural
  // evidence measured at both ends — rather than a hash inequality, which only
  // ever proved that the model's CONTENT moved. The caveat's own wording
  // ("Structure changed during this period") is a claim about shape, so it must
  // be licensed by evidence about shape.
  it('includes structure change caveat', () => {
    const snapshots = [
      makeSnapshot({ runNumber: 1, nodeCount: 5 }),
      makeSnapshot({ runNumber: 2, nodeCount: 6 }),
      makeSnapshot({ runNumber: 3, nodeCount: 6 }),
    ]
    const result = buildCumulativeTransition(snapshots)!
    expect(result.cumulativeCaveats).toContainEqual(
      expect.stringContaining('Structure changed')
    )
  })

  // ROADMAP 2.578 — the per-run `graphHash` values are now DISTINCT. They were
  // all the fixture default, which the new classifier correctly reads as "these
  // runs analysed an identical model", and an identical model licenses exactly
  // one sentence ("Rerun (no edits)"), not a logged edit summary. Distinct
  // hashes reproduce the real situation this test is about — a run that DID
  // change — so the passthrough it pins is exercised as intended.
  it('collects all edit summaries', () => {
    const snapshots = [
      makeSnapshot({ runNumber: 1, graphHash: 'h-1', editSummary: 'Initial analysis' }),
      makeSnapshot({ runNumber: 2, graphHash: 'h-2', editSummary: 'Tightened churn' }),
      makeSnapshot({ runNumber: 3, graphHash: 'h-3', editSummary: 'Added regulatory risk' }),
    ]
    const result = buildCumulativeTransition(snapshots)!
    expect(result.edits).toEqual(['Tightened churn', 'Added regulatory risk'])
  })
})

// ---------------------------------------------------------------------------
// ROADMAP 2.113a slice 2 — the three-valued structure comparison
// ---------------------------------------------------------------------------

describe('compareStructure', () => {
  // ⚠ REVERSED BY ROADMAP 2.578. `compareStructure` answers one question — "did
  // the STRUCTURE change?" — and a same-regime CONTENT-hash inequality cannot
  // answer it in either direction. 'not_comparable' is the honest verdict; the
  // fact that something moved is carried by `changeVerdict`
  // (`uncharacterised_change`), not smuggled into a shape claim.
  it('same regime, different hash ⇒ not_comparable (a content hash cannot speak to shape)', () => {
    expect(compareStructure(
      makeSnapshot({ runNumber: 1, source: 'persisted', graphHash: 'aag-1' }),
      makeSnapshot({ runNumber: 2, source: 'persisted', graphHash: 'aag-2' }),
    )).toBe('not_comparable')
  })

  // The counts arm is untouched: it IS evidence about shape, measured at both ends.
  it('same regime, different node counts ⇒ changed (counts are shape evidence)', () => {
    expect(compareStructure(
      makeSnapshot({ runNumber: 1, source: 'persisted', graphHash: 'aag-1', nodeCount: 5 }),
      makeSnapshot({ runNumber: 2, source: 'persisted', graphHash: 'aag-2', nodeCount: 6 }),
    )).toBe('changed')
  })

  it('same regime, same hash ⇒ unchanged', () => {
    expect(compareStructure(
      makeSnapshot({ runNumber: 1, source: 'persisted', graphHash: 'aag-1' }),
      makeSnapshot({ runNumber: 2, source: 'persisted', graphHash: 'aag-1' }),
    )).toBe('unchanged')
  })

  it('CROSS-REGIME ⇒ not_comparable, never "changed"', () => {
    // A session snapshot hashes with the UI\'s generateGraphHash; a persisted
    // run carries CEE\'s aag_v1. They are ALWAYS unequal, so an unguarded
    // comparison manufactures a structure change out of a provenance boundary.
    expect(compareStructure(
      makeSnapshot({ runNumber: 1, source: 'session', graphHash: 'ui-hash', nodeCount: null, edgeCount: null }),
      makeSnapshot({ runNumber: 2, source: 'persisted', graphHash: 'aag-1', nodeCount: null, edgeCount: null }),
    )).toBe('not_comparable')
  })

  it('an absent hash at either end ⇒ not_comparable', () => {
    expect(compareStructure(
      makeSnapshot({ runNumber: 1, graphHash: null, nodeCount: null, edgeCount: null }),
      makeSnapshot({ runNumber: 2, graphHash: 'h', nodeCount: null, edgeCount: null }),
    )).toBe('not_comparable')
  })

  it('EQUAL COUNTS DO NOT LICENSE "unchanged" — a rewired graph keeps its counts', () => {
    expect(compareStructure(
      makeSnapshot({ runNumber: 1, graphHash: null, nodeCount: 5, edgeCount: 4 }),
      makeSnapshot({ runNumber: 2, graphHash: null, nodeCount: 5, edgeCount: 4 }),
    )).toBe('not_comparable')
  })

  it('differing counts DO license "changed" even without a comparable hash', () => {
    expect(compareStructure(
      makeSnapshot({ runNumber: 1, graphHash: null, nodeCount: 5, edgeCount: 4 }),
      makeSnapshot({ runNumber: 2, graphHash: null, nodeCount: 6, edgeCount: 4 }),
    )).toBe('changed')
  })

  it('agrees with the boolean the transition cards render — one regime rule, not two', () => {
    const pairs: Array<[AnalysisSnapshot, AnalysisSnapshot]> = [
      [makeSnapshot({ runNumber: 1, graphHash: 'a' }), makeSnapshot({ runNumber: 2, graphHash: 'b' })],
      [makeSnapshot({ runNumber: 1, graphHash: 'a' }), makeSnapshot({ runNumber: 2, graphHash: 'a' })],
      [makeSnapshot({ runNumber: 1, source: 'session', graphHash: 'a' }),
       makeSnapshot({ runNumber: 2, source: 'persisted', graphHash: 'b' })],
    ]
    for (const [from, to] of pairs) {
      expect(deriveTransitions([from, to])[0].structureChanged)
        .toBe(compareStructure(from, to) === 'changed')
    }
  })
})

// ---------------------------------------------------------------------------
// ROADMAP 2.113a slice 2 — arbitrary-pair transitions
// ---------------------------------------------------------------------------

describe('buildRangeTransition', () => {
  const four = () => [
    // Distinct per-run graphHash: see the note on 'collects all edit summaries'.
    // Each leg is therefore a real change, and the logged summary is what the
    // card shows for a graph-less run — which is what these interval tests pin.
    makeSnapshot({ runNumber: 1, graphHash: 'h-1', winnerProbability: 50, editSummary: 'Initial analysis' }),
    makeSnapshot({ runNumber: 2, graphHash: 'h-2', winnerProbability: 55, editSummary: 'Tightened churn' }),
    makeSnapshot({ runNumber: 3, graphHash: 'h-3', winnerProbability: 61, editSummary: 'Added risk' }),
    makeSnapshot({ runNumber: 4, graphHash: 'h-4', winnerProbability: 74, editSummary: 'Reweighted price' }),
  ]

  it('an ADJACENT pair is exactly the plain pairwise card', () => {
    const result = buildRangeTransition(four(), 1, 2)!
    expect(result.isCumulative).toBe(false)
    expect(result.fromRunNumber).toBe(2)
    expect(result.toRunNumber).toBe(3)
    expect(result.winnerProbDelta).toBe(6)
    expect(result.edits).toEqual(['Added risk'])
  })

  // ⚠ The defect this pins: `editSummary` describes the edits since the run
  // IMMEDIATELY BEFORE. Handing buildTransition a non-adjacent pair would print
  // run 4\'s last-leg summary under a heading claiming it covers runs 1→4 —
  // every character true, attached to the wrong interval.
  it('a NON-ADJACENT pair collects the edit summary of every leg inside the range', () => {
    const result = buildRangeTransition(four(), 0, 3)!
    expect(result.edits).toEqual(['Tightened churn', 'Added risk', 'Reweighted price'])
    expect(result.isCumulative).toBe(true)
    expect(result.cumulativeCaveats).toContainEqual(expect.stringContaining('2 intermediate refinements'))
  })

  it('counts flips only INSIDE the picked range', () => {
    const snapshots = [
      makeSnapshot({ runNumber: 1, winnerId: 'opt-a' }),
      makeSnapshot({ runNumber: 2, winnerId: 'opt-b' }), // flip is outside 2..4
      makeSnapshot({ runNumber: 3, winnerId: 'opt-b' }),
      makeSnapshot({ runNumber: 4, winnerId: 'opt-b' }),
    ]
    expect(buildRangeTransition(snapshots, 1, 3)!.cumulativeCaveats.join(' ')).not.toContain('flipped')
    expect(buildRangeTransition(snapshots, 0, 3)!.cumulativeCaveats.join(' ')).toContain('flipped')
  })

  it('refuses a non-forward or out-of-range pair rather than inventing one', () => {
    const snapshots = four()
    expect(buildRangeTransition(snapshots, 2, 2)).toBeNull()
    expect(buildRangeTransition(snapshots, 3, 1)).toBeNull()
    expect(buildRangeTransition(snapshots, -1, 2)).toBeNull()
    expect(buildRangeTransition(snapshots, 0, 9)).toBeNull()
  })

  it('buildCumulativeTransition is the (first, latest) case of it — unchanged behaviour', () => {
    const snapshots = four()
    expect(buildCumulativeTransition(snapshots))
      .toEqual(buildRangeTransition(snapshots, 0, snapshots.length - 1))
  })
})
