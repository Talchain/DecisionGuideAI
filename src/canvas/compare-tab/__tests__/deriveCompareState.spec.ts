import { describe, it, expect } from 'vitest'
import { deriveCompareState, isNarrowFlip } from '../deriveCompareState'
import type { AnalysisSnapshot } from '../types'

// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------

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
    topFactors: [],
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
// Tests
// ---------------------------------------------------------------------------

describe('deriveCompareState', () => {
  it('returns "stale" when graph has been edited since last run', () => {
    const snapshots = [
      makeSnapshot({ runNumber: 1 }),
      makeSnapshot({ runNumber: 2 }),
    ]
    expect(deriveCompareState(snapshots, true)).toBe('stale')
  })

  it('returns "flipped" when winner changed between last two runs', () => {
    const snapshots = [
      makeSnapshot({ runNumber: 1, winnerId: 'opt-a' }),
      makeSnapshot({ runNumber: 2, winnerId: 'opt-b' }),
    ]
    expect(deriveCompareState(snapshots, false)).toBe('flipped')
  })

  it('flipped outranks noWinner (narrow margin flip)', () => {
    const snapshots = [
      makeSnapshot({ runNumber: 1, winnerId: 'opt-a' }),
      makeSnapshot({
        runNumber: 2,
        winnerId: 'opt-b',
        winnerProbability: 52,
        runnerUpProbability: 48,
      }),
    ]
    // Even though the margin is narrow (<10pp), flipped takes precedence
    expect(deriveCompareState(snapshots, false)).toBe('flipped')
  })

  it('returns "noWinner" when top options within 10pp', () => {
    const snapshots = [
      makeSnapshot({ runNumber: 1 }),
      makeSnapshot({
        runNumber: 2,
        winnerProbability: 54,
        runnerUpProbability: 46,
      }),
    ]
    expect(deriveCompareState(snapshots, false)).toBe('noWinner')
  })

  it('returns "converged" when 3 runs have same winner and <3pp variation', () => {
    const snapshots = [
      makeSnapshot({ runNumber: 1, winnerProbability: 71 }),
      makeSnapshot({ runNumber: 2, winnerProbability: 72 }),
      makeSnapshot({ runNumber: 3, winnerProbability: 73 }),
    ]
    expect(deriveCompareState(snapshots, false)).toBe('converged')
  })

  it('returns "improving" when conditions for other states not met', () => {
    const snapshots = [
      makeSnapshot({ runNumber: 1, winnerProbability: 60 }),
      makeSnapshot({ runNumber: 2, winnerProbability: 70 }),
    ]
    expect(deriveCompareState(snapshots, false)).toBe('improving')
  })

  it('returns "improving" with fewer than 2 snapshots', () => {
    expect(deriveCompareState([makeSnapshot({ runNumber: 1 })], false)).toBe('improving')
    expect(deriveCompareState([], false)).toBe('improving')
  })

  it('handles single-option case (null runnerUp)', () => {
    const snapshots = [
      makeSnapshot({ runNumber: 1, runnerUpId: null, runnerUpProbability: null }),
      makeSnapshot({ runNumber: 2, runnerUpId: null, runnerUpProbability: null }),
    ]
    // winnerProbability - 0 (null coalesced) = 65, which is >= 10
    expect(deriveCompareState(snapshots, false)).toBe('improving')
  })

  it('does not return "converged" if winner changed among last 3', () => {
    const snapshots = [
      makeSnapshot({ runNumber: 1, winnerId: 'opt-a', winnerProbability: 71 }),
      makeSnapshot({ runNumber: 2, winnerId: 'opt-b', winnerProbability: 72 }),
      makeSnapshot({ runNumber: 3, winnerId: 'opt-a', winnerProbability: 73 }),
    ]
    // Last two have different winners → flipped
    expect(deriveCompareState(snapshots, false)).toBe('flipped')
  })

  it('does not return "converged" when variation >= 3pp', () => {
    const snapshots = [
      makeSnapshot({ runNumber: 1, winnerProbability: 68 }),
      makeSnapshot({ runNumber: 2, winnerProbability: 71 }),
      makeSnapshot({ runNumber: 3, winnerProbability: 74 }),
    ]
    // maxDelta = |71-68| = 3, and condition is < 3, so not converged
    expect(deriveCompareState(snapshots, false)).toBe('improving')
  })

  it('"stale" outranks all other states', () => {
    // Even with a flip, stale takes precedence
    const snapshots = [
      makeSnapshot({ runNumber: 1, winnerId: 'opt-a' }),
      makeSnapshot({ runNumber: 2, winnerId: 'opt-b' }),
    ]
    expect(deriveCompareState(snapshots, true)).toBe('stale')
  })
})

describe('isNarrowFlip', () => {
  it('returns true when margin is < 10pp', () => {
    const snap = makeSnapshot({ runNumber: 2, winnerProbability: 54, runnerUpProbability: 46 })
    expect(isNarrowFlip(snap)).toBe(true)
  })

  it('returns false when margin is >= 10pp', () => {
    const snap = makeSnapshot({ runNumber: 2, winnerProbability: 65, runnerUpProbability: 35 })
    expect(isNarrowFlip(snap)).toBe(false)
  })

  it('handles null runner-up', () => {
    const snap = makeSnapshot({ runNumber: 2, runnerUpProbability: null })
    expect(isNarrowFlip(snap)).toBe(false)
  })
})
