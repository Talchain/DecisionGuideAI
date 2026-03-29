import { describe, it, expect, beforeEach } from 'vitest'
import { useAnalysisSnapshotStore } from '../../stores/analysisSnapshotStore'
import type { AnalysisSnapshot } from '../types'

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function makeSnapshot(runNumber: number, overrides?: Partial<AnalysisSnapshot>): AnalysisSnapshot {
  return {
    runId: `run-${runNumber}`,
    runNumber,
    timestamp: new Date().toISOString(),
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
    topEvpiFactor: 'Factor A',
    topEvpiFactorId: 'fac-a',
    topEvpiValue: 5,
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

describe('useAnalysisSnapshotStore', () => {
  beforeEach(() => {
    useAnalysisSnapshotStore.getState().clearSnapshots()
  })

  describe('addSnapshot', () => {
    it('appends to the snapshots array', () => {
      const store = useAnalysisSnapshotStore.getState()
      store.addSnapshot(makeSnapshot(1))
      expect(store.getRunCount()).toBe(1)
      store.addSnapshot(makeSnapshot(2))
      expect(store.getRunCount()).toBe(2)
    })

    it('preserves order', () => {
      const store = useAnalysisSnapshotStore.getState()
      store.addSnapshot(makeSnapshot(1))
      store.addSnapshot(makeSnapshot(2))
      store.addSnapshot(makeSnapshot(3))
      const snapshots = useAnalysisSnapshotStore.getState().snapshots
      expect(snapshots.map(s => s.runNumber)).toEqual([1, 2, 3])
    })
  })

  describe('getLatest', () => {
    it('returns null when empty', () => {
      expect(useAnalysisSnapshotStore.getState().getLatest()).toBeNull()
    })

    it('returns last snapshot', () => {
      const store = useAnalysisSnapshotStore.getState()
      store.addSnapshot(makeSnapshot(1))
      store.addSnapshot(makeSnapshot(2))
      expect(store.getLatest()?.runNumber).toBe(2)
    })
  })

  describe('getPrevious', () => {
    it('returns null when fewer than 2 snapshots', () => {
      const store = useAnalysisSnapshotStore.getState()
      expect(store.getPrevious()).toBeNull()
      store.addSnapshot(makeSnapshot(1))
      expect(store.getPrevious()).toBeNull()
    })

    it('returns second-to-last snapshot', () => {
      const store = useAnalysisSnapshotStore.getState()
      store.addSnapshot(makeSnapshot(1))
      store.addSnapshot(makeSnapshot(2))
      store.addSnapshot(makeSnapshot(3))
      expect(store.getPrevious()?.runNumber).toBe(2)
    })
  })

  describe('getFirst', () => {
    it('returns null when empty', () => {
      expect(useAnalysisSnapshotStore.getState().getFirst()).toBeNull()
    })

    it('returns first snapshot', () => {
      const store = useAnalysisSnapshotStore.getState()
      store.addSnapshot(makeSnapshot(1))
      store.addSnapshot(makeSnapshot(2))
      expect(store.getFirst()?.runNumber).toBe(1)
    })
  })

  describe('getRunCount', () => {
    it('returns 0 when empty', () => {
      expect(useAnalysisSnapshotStore.getState().getRunCount()).toBe(0)
    })

    it('returns correct count', () => {
      const store = useAnalysisSnapshotStore.getState()
      store.addSnapshot(makeSnapshot(1))
      store.addSnapshot(makeSnapshot(2))
      store.addSnapshot(makeSnapshot(3))
      expect(store.getRunCount()).toBe(3)
    })
  })

  describe('clearSnapshots', () => {
    it('resets to empty', () => {
      const store = useAnalysisSnapshotStore.getState()
      store.addSnapshot(makeSnapshot(1))
      store.addSnapshot(makeSnapshot(2))
      store.clearSnapshots()
      expect(store.getRunCount()).toBe(0)
      expect(store.getLatest()).toBeNull()
    })
  })

  describe('single-option edge case', () => {
    it('handles null runner-up fields', () => {
      const store = useAnalysisSnapshotStore.getState()
      store.addSnapshot(makeSnapshot(1, {
        runnerUpId: null,
        runnerUpLabel: null,
        runnerUpProbability: null,
      }))
      const snap = store.getLatest()!
      expect(snap.runnerUpId).toBeNull()
      expect(snap.runnerUpLabel).toBeNull()
      expect(snap.runnerUpProbability).toBeNull()
    })
  })
})
