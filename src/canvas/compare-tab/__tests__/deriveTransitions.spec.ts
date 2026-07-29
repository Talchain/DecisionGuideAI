import { describe, it, expect } from 'vitest'
import { deriveTransitions, buildCumulativeTransition } from '../deriveTransitions'
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

function makeSnapshot(overrides: Partial<AnalysisSnapshot> & { runNumber: number }): AnalysisSnapshot {
  return {
    runId: `run-${overrides.runNumber}`,
    runNumber: overrides.runNumber,
    timestamp: new Date().toISOString(),
    source: 'session',
    graphHash: 'hash-default',
    nodeCount: 5,
    edgeCount: 4,
    winnerId: 'opt-a',
    winnerLabel: 'Option A',
    winnerProbability: 65,
    runnerUpId: 'opt-b',
    runnerUpLabel: 'Option B',
    runnerUpProbability: 35,
    recommendationStability: 0.7,
    stabilityLabel: 'stable',
    fragileEdgeCount: 0,
    evidenceCoverage: '3/5',
    topFactors: [makeFactor({ id: 'fac-a', label: 'Churn', elasticity: 0.4 })],
    influenceConcentration: 40,
    topCalibrationFactor: 'Factor A',
    topCalibrationFactorId: 'fac-a',
    topElasticity: 30,
    rankFlipRate: 0.05,
    goalProbability: null,
    jointGoalProbability: null,
    inferenceWarnings: [],
    conditionalWinners: [],
    edgeEValues: [],
    seedUsed: 12345,
    responseHash: 'abc123',
    editSummary: 'Test edit',
    ...overrides,
  }
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
    it('detects graph hash change', () => {
      const snapshots = [
        makeSnapshot({ runNumber: 1, graphHash: 'hash-1' }),
        makeSnapshot({ runNumber: 2, graphHash: 'hash-2' }),
      ]
      expect(deriveTransitions(snapshots)[0].structureChanged).toBe(true)
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

    it('DOES compare hashes within one regime (the guard is not a blanket off-switch)', () => {
      const snapshots = [
        makeSnapshot({ runNumber: 1, source: 'persisted', graphHash: 'aag-1' }),
        makeSnapshot({ runNumber: 2, source: 'persisted', graphHash: 'aag-2' }),
      ]
      expect(deriveTransitions(snapshots)[0].structureChanged).toBe(true)
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

  it('includes structure change caveat', () => {
    const snapshots = [
      makeSnapshot({ runNumber: 1, graphHash: 'hash-1' }),
      makeSnapshot({ runNumber: 2, graphHash: 'hash-2' }),
      makeSnapshot({ runNumber: 3, graphHash: 'hash-2' }),
    ]
    const result = buildCumulativeTransition(snapshots)!
    expect(result.cumulativeCaveats).toContainEqual(
      expect.stringContaining('Structure changed')
    )
  })

  it('collects all edit summaries', () => {
    const snapshots = [
      makeSnapshot({ runNumber: 1, editSummary: 'Initial analysis' }),
      makeSnapshot({ runNumber: 2, editSummary: 'Tightened churn' }),
      makeSnapshot({ runNumber: 3, editSummary: 'Added regulatory risk' }),
    ]
    const result = buildCumulativeTransition(snapshots)!
    expect(result.edits).toEqual(['Tightened churn', 'Added regulatory risk'])
  })
})
