/**
 * ROADMAP 2.113a slice 2 — the pick-two-runs derivation.
 *
 * WHAT THESE TESTS ARE FOR. The side-by-side view has four ways to publish a
 * measurement nobody made, and each one is pinned here:
 *
 *   1. a delta against a FABRICATED BASELINE — an option or factor present on
 *      one side only, subtracted against an implied 0;
 *   2. a CROSS-REGIME structure claim — a session snapshot's
 *      `generateGraphHash` compared against a persisted run's `aag_v1`, which
 *      are always unequal and would report "changed" about a provenance
 *      boundary;
 *   3. an UNLICENSED LEADER claim — leader language taken from the
 *      client-side `winnerId` argmax instead of the run's own producer verdict;
 *   4. a MISSING quantity rendered as zero rather than as absence.
 */
import { describe, it, expect } from 'vitest'
import { deriveRunPairComparison, deriveLeaderClaim } from '../deriveRunPairComparison'
import {
  makeAnalysisSnapshot,
  DEFAULT_LEADER_VERDICT,
  TIED_LEADER_VERDICT,
  UNCLAIMED_LEADER_VERDICT,
} from './__fixtures__/analysisSnapshot'
import type { AnalysisSnapshot, FactorSensitivitySummary } from '../types'

function factor(id: string, elasticity: number, label = id): FactorSensitivitySummary {
  return { id, label, elasticity, rankFlipRate: 0.05, attributionStability: 'high' }
}

function persisted(overrides: Partial<AnalysisSnapshot> & { runNumber: number }): AnalysisSnapshot {
  return makeAnalysisSnapshot({ source: 'persisted', graphHash: 'aag-x', ...overrides })
}

describe('deriveRunPairComparison — win probability by option', () => {
  it('reports a real delta for an option BOTH runs scored', () => {
    const from = persisted({
      runNumber: 1,
      options: [
        { id: 'opt-a', label: 'Option A', winProbability: 62 },
        { id: 'opt-b', label: 'Option B', winProbability: 38 },
      ],
    })
    const to = persisted({
      runNumber: 2,
      options: [
        { id: 'opt-a', label: 'Option A', winProbability: 74 },
        { id: 'opt-b', label: 'Option B', winProbability: 26 },
      ],
    })

    const rows = deriveRunPairComparison(from, to).options
    const a = rows.find(r => r.optionId === 'opt-a')!
    expect(a.presence).toBe('both')
    expect(a.fromProbability).toBe(62)
    expect(a.toProbability).toBe(74)
    expect(a.deltaPp).toBe(12)

    const b = rows.find(r => r.optionId === 'opt-b')!
    expect(b.deltaPp).toBe(-12)
  })

  it('orders rows by the strongest probability seen on either side', () => {
    const from = persisted({
      runNumber: 1,
      options: [
        { id: 'opt-a', label: 'A', winProbability: 20 },
        { id: 'opt-b', label: 'B', winProbability: 80 },
      ],
    })
    const to = persisted({
      runNumber: 2,
      options: [
        { id: 'opt-a', label: 'A', winProbability: 55 },
        { id: 'opt-b', label: 'B', winProbability: 45 },
      ],
    })
    expect(deriveRunPairComparison(from, to).options.map(r => r.optionId)).toEqual(['opt-b', 'opt-a'])
  })

  // ── DEFECT 1: the fabricated baseline ───────────────────────────────────
  it('an option scored by only the LATER run gets NO delta — never a subtraction against 0', () => {
    const from = persisted({
      runNumber: 1,
      options: [{ id: 'opt-a', label: 'Option A', winProbability: 100 }],
    })
    const to = persisted({
      runNumber: 2,
      options: [
        { id: 'opt-a', label: 'Option A', winProbability: 60 },
        { id: 'opt-c', label: 'Option C', winProbability: 40 },
      ],
    })

    const c = deriveRunPairComparison(from, to).options.find(r => r.optionId === 'opt-c')!
    expect(c.presence).toBe('only_to')
    expect(c.fromProbability).toBeNull()
    expect(c.toProbability).toBe(40)
    // `40 - 0 = +40pp` would announce a forty-point gain for an option the
    // earlier run never scored at all.
    expect(c.deltaPp).toBeNull()
  })

  it('an option scored by only the EARLIER run gets NO delta either', () => {
    const from = persisted({
      runNumber: 1,
      options: [
        { id: 'opt-a', label: 'Option A', winProbability: 55 },
        { id: 'opt-d', label: 'Option D', winProbability: 45 },
      ],
    })
    const to = persisted({
      runNumber: 2,
      options: [{ id: 'opt-a', label: 'Option A', winProbability: 100 }],
    })

    const d = deriveRunPairComparison(from, to).options.find(r => r.optionId === 'opt-d')!
    expect(d.presence).toBe('only_from')
    expect(d.toProbability).toBeNull()
    expect(d.deltaPp).toBeNull()
  })

  it('discloses a RENAME rather than silently showing only the new label', () => {
    const from = persisted({
      runNumber: 1,
      options: [{ id: 'opt-a', label: 'Old name', winProbability: 62 }],
    })
    const to = persisted({
      runNumber: 2,
      options: [{ id: 'opt-a', label: 'New name', winProbability: 70 }],
    })
    const row = deriveRunPairComparison(from, to).options[0]
    expect(row.label).toBe('New name')
    expect(row.previousLabel).toBe('Old name')
    expect(row.deltaPp).toBe(8)
  })

  it('no rename ⇒ no "was" disclosure', () => {
    const from = persisted({ runNumber: 1, options: [{ id: 'opt-a', label: 'Same', winProbability: 62 }] })
    const to = persisted({ runNumber: 2, options: [{ id: 'opt-a', label: 'Same', winProbability: 70 }] })
    expect(deriveRunPairComparison(from, to).options[0].previousLabel).toBeNull()
  })
})

describe('deriveRunPairComparison — factors (same draft-variance rule, on RANK)', () => {
  // ⚠ Rank, not elasticity, and that is a house rule not a preference: the
  // elasticity claim family has NO owner selector, its debt is frozen
  // shrink-only, and a NEW raw `.elasticity` read is a hard RED in
  // `claim-ownership.drift.spec.ts`. Each run's `topFactors` is already sorted
  // by |elasticity| descending, so POSITION is the already-derived value the
  // debt module tells new code to consume.
  it('matched factors get a rank movement; unmatched ones get membership, not a number', () => {
    const from = persisted({
      runNumber: 1,
      topFactors: [factor('fac-a', 0.4, 'Churn'), factor('fac-b', 0.2, 'Price')],
    })
    const to = persisted({
      runNumber: 2,
      topFactors: [factor('fac-c', 0.6, 'Latency'), factor('fac-a', 0.3, 'Churn')],
    })

    const rows = deriveRunPairComparison(from, to).factors
    const a = rows.find(r => r.factorId === 'fac-a')!
    expect(a.presence).toBe('both')
    expect(a.fromRank).toBe(1)
    expect(a.toRank).toBe(2)
    // Positive is MORE influential, so slipping 1st → 2nd is -1.
    expect(a.rankDelta).toBe(-1)

    const b = rows.find(r => r.factorId === 'fac-b')!
    expect(b.presence).toBe('only_from')
    expect(b.fromRank).toBe(2)
    expect(b.toRank).toBeNull()
    expect(b.rankDelta).toBeNull()

    const c = rows.find(r => r.factorId === 'fac-c')!
    expect(c.presence).toBe('only_to')
    expect(c.fromRank).toBeNull()
    expect(c.rankDelta).toBeNull()
  })

  it('a factor that climbed reports a POSITIVE movement', () => {
    const from = persisted({ runNumber: 1, topFactors: [factor('x', 0.5), factor('y', 0.1)] })
    const to = persisted({ runNumber: 2, topFactors: [factor('y', 0.9), factor('x', 0.2)] })
    const rows = deriveRunPairComparison(from, to).factors
    expect(rows.find(r => r.factorId === 'y')!.rankDelta).toBe(1)
    expect(rows.find(r => r.factorId === 'x')!.rankDelta).toBe(-1)
  })

  it('reads NO raw elasticity: two runs with identical order report no movement whatever the values', () => {
    // The same ranking with wildly different elasticities is "no change in the
    // influence order" — which is all a rank comparison is entitled to say.
    const from = persisted({ runNumber: 1, topFactors: [factor('x', 0.9), factor('y', 0.8)] })
    const to = persisted({ runNumber: 2, topFactors: [factor('x', 0.05), factor('y', 0.01)] })
    expect(deriveRunPairComparison(from, to).factors.map(r => r.rankDelta)).toEqual([0, 0])
  })
})

// ── DEFECT 2: the cross-regime structure claim ────────────────────────────
describe('deriveRunPairComparison — model structure', () => {
  it('two PERSISTED runs with different aag hashes: changed', () => {
    const from = persisted({ runNumber: 1, graphHash: 'aag-1' })
    const to = persisted({ runNumber: 2, graphHash: 'aag-2' })
    expect(deriveRunPairComparison(from, to).structure).toBe('changed')
  })

  it('two PERSISTED runs with the same aag hash: unchanged', () => {
    const from = persisted({ runNumber: 1, graphHash: 'aag-1' })
    const to = persisted({ runNumber: 2, graphHash: 'aag-1' })
    expect(deriveRunPairComparison(from, to).structure).toBe('unchanged')
  })

  it('SESSION vs PERSISTED is NOT COMPARABLE — never "changed"', () => {
    const from = makeAnalysisSnapshot({ runNumber: 1, source: 'session', graphHash: 'ui-hash' })
    const to = persisted({ runNumber: 2, graphHash: 'aag-1', nodeCount: null, edgeCount: null })
    expect(deriveRunPairComparison(from, to).structure).toBe('not_comparable')
  })

  it('an absent hash at either end is NOT COMPARABLE', () => {
    const from = persisted({ runNumber: 1, graphHash: null, nodeCount: null, edgeCount: null })
    const to = persisted({ runNumber: 2, graphHash: 'aag-1', nodeCount: null, edgeCount: null })
    expect(deriveRunPairComparison(from, to).structure).toBe('not_comparable')
  })
})

// ── DEFECT 3: the unlicensed leader claim ─────────────────────────────────
describe('deriveLeaderClaim — the run quotes its OWN producer verdict', () => {
  it('an entitled verdict names the option, resolved against that run’s own option list', () => {
    const snapshot = persisted({
      runNumber: 1,
      options: [{ id: 'opt-b', label: 'Option B', winProbability: 71 }],
      leaderVerdict: { ...DEFAULT_LEADER_VERDICT, leaderId: 'opt-b' },
    })
    expect(deriveLeaderClaim(snapshot)).toEqual({ kind: 'named', optionId: 'opt-b', label: 'Option B' })
  })

  it('the producer’s TIE verdict is "tied" — the one case a denial is licensed', () => {
    expect(deriveLeaderClaim(persisted({ runNumber: 1, leaderVerdict: TIED_LEADER_VERDICT })).kind).toBe('tied')
  })

  it('NO producer signal is "unclaimed" — silence, not a denial', () => {
    expect(deriveLeaderClaim(persisted({ runNumber: 1, leaderVerdict: UNCLAIMED_LEADER_VERDICT })).kind)
      .toBe('unclaimed')
  })

  it('IGNORES `winnerId`: an argmax winner does not license leader language', () => {
    const snapshot = persisted({
      runNumber: 1,
      winnerId: 'opt-a',
      winnerLabel: 'Option A',
      winnerProbability: 88,
      leaderVerdict: UNCLAIMED_LEADER_VERDICT,
    })
    const claim = deriveLeaderClaim(snapshot)
    expect(claim.kind).toBe('unclaimed')
    expect(claim.label).toBeNull()
  })

  it('an entitled verdict whose leader is NOT in the run’s options falls silent rather than naming a blank', () => {
    const snapshot = persisted({
      runNumber: 1,
      options: [{ id: 'opt-a', label: 'Option A', winProbability: 60 }],
      leaderVerdict: { ...DEFAULT_LEADER_VERDICT, leaderId: 'opt-ghost' },
    })
    expect(deriveLeaderClaim(snapshot).kind).toBe('unclaimed')
  })
})

describe('deriveRunPairComparison — leader change', () => {
  it('both runs named the SAME leader: unchanged', () => {
    const from = persisted({ runNumber: 1, leaderVerdict: { ...DEFAULT_LEADER_VERDICT, leaderId: 'opt-a' } })
    const to = persisted({ runNumber: 2, leaderVerdict: { ...DEFAULT_LEADER_VERDICT, leaderId: 'opt-a' } })
    expect(deriveRunPairComparison(from, to).leaderChange).toBe('unchanged')
  })

  it('both runs named DIFFERENT leaders: changed', () => {
    const from = persisted({ runNumber: 1, leaderVerdict: { ...DEFAULT_LEADER_VERDICT, leaderId: 'opt-a' } })
    const to = persisted({ runNumber: 2, leaderVerdict: { ...DEFAULT_LEADER_VERDICT, leaderId: 'opt-b' } })
    expect(deriveRunPairComparison(from, to).leaderChange).toBe('changed')
  })

  it('either run declined to name a leader: NOT COMPARABLE, never "unchanged"', () => {
    const named = persisted({ runNumber: 1, leaderVerdict: DEFAULT_LEADER_VERDICT })
    const tied = persisted({ runNumber: 2, leaderVerdict: TIED_LEADER_VERDICT })
    const silent = persisted({ runNumber: 3, leaderVerdict: UNCLAIMED_LEADER_VERDICT })

    expect(deriveRunPairComparison(named, tied).leaderChange).toBe('not_comparable')
    expect(deriveRunPairComparison(named, silent).leaderChange).toBe('not_comparable')
    // Two runs that BOTH said "no clear leader" have no leader to call unchanged.
    expect(deriveRunPairComparison(tied, tied).leaderChange).toBe('not_comparable')
  })
})

// ── DEFECT 4: absence rendered as zero ────────────────────────────────────
describe('deriveRunPairComparison — honest degradation', () => {
  it('goal probability absent on either side ⇒ null delta, never 0', () => {
    const from = persisted({ runNumber: 1, goalProbability: null })
    const to = persisted({ runNumber: 2, goalProbability: 71 })
    expect(deriveRunPairComparison(from, to).goalProbabilityDeltaPp).toBeNull()
  })

  it('goal probability present on BOTH sides ⇒ a real delta', () => {
    const from = persisted({ runNumber: 1, goalProbability: 40 })
    const to = persisted({ runNumber: 2, goalProbability: 55 })
    expect(deriveRunPairComparison(from, to).goalProbabilityDeltaPp).toBe(15)
  })

  it('evidence coverage stays null on a persisted pair — the fact stores the analysis, not the model', () => {
    const from = persisted({ runNumber: 1, evidenceCoverage: null })
    const to = persisted({ runNumber: 2, evidenceCoverage: null })
    const c = deriveRunPairComparison(from, to)
    expect(c.fromEvidenceCoverage).toBeNull()
    expect(c.toEvidenceCoverage).toBeNull()
  })

  it('warnings are a set difference over two real lists', () => {
    const from = persisted({ runNumber: 1, inferenceWarnings: ['w1', 'w2'] })
    const to = persisted({ runNumber: 2, inferenceWarnings: ['w2', 'w3'] })
    const c = deriveRunPairComparison(from, to)
    expect(c.warningsResolved).toEqual(['w1'])
    expect(c.warningsIntroduced).toEqual(['w3'])
  })

  it('a run with no options at all yields no option rows — not a row of zeros', () => {
    const from = persisted({ runNumber: 1, options: [] })
    const to = persisted({ runNumber: 2, options: [] })
    expect(deriveRunPairComparison(from, to).options).toEqual([])
  })
})
