import { describe, it, expect, beforeEach } from 'vitest'
import { useAnalysisSnapshotStore } from '../../stores/analysisSnapshotStore'
import type { AnalysisSnapshot } from '../types'
import { makeAnalysisSnapshot } from './__fixtures__/analysisSnapshot'

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

// Delegates to the ONE shared snapshot fixture (trap 12 — see its header).
function makeSnapshot(runNumber: number, overrides?: Partial<AnalysisSnapshot>): AnalysisSnapshot {
  return makeAnalysisSnapshot({ runNumber, ...overrides })
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

  // -------------------------------------------------------------------------
  // ROADMAP 2.113a slice 1 — hydration from persisted runs
  // -------------------------------------------------------------------------

  describe('hydrateFromPersisted', () => {
    const persisted = (n: number, overrides?: Partial<AnalysisSnapshot>): AnalysisSnapshot =>
      makeSnapshot(n, {
        runId: `fact-${n}`,
        source: 'persisted',
        graphHash: `aag-${n}`,
        nodeCount: null,
        edgeCount: null,
        evidenceCoverage: null,
        responseHash: `rh-${n}`,
        timestamp: `2026-07-20T1${n}:00:00.000Z`,
        ...overrides,
      })

    it('seeds an EMPTY store — the reload case, and the live-V5 case where nothing was ever captured', () => {
      const store = useAnalysisSnapshotStore.getState()
      store.hydrateFromPersisted([persisted(1), persisted(2)])
      const out = useAnalysisSnapshotStore.getState().snapshots
      expect(out.map(s => s.runId)).toEqual(['fact-1', 'fact-2'])
      expect(out.map(s => s.runNumber)).toEqual([1, 2])
      expect(out.every(s => s.source === 'persisted')).toBe(true)
    })

    it('is IDEMPOTENT — re-hydrating the same history does not duplicate runs', () => {
      const store = useAnalysisSnapshotStore.getState()
      store.hydrateFromPersisted([persisted(1), persisted(2)])
      store.hydrateFromPersisted([persisted(1), persisted(2)])
      expect(useAnalysisSnapshotStore.getState().snapshots).toHaveLength(2)
    })

    it('LAYERS a session run the persisted set does not contain, and renumbers by timestamp', () => {
      const store = useAnalysisSnapshotStore.getState()
      store.addSnapshot(
        makeSnapshot(1, {
          runId: 'session-new',
          responseHash: 'rh-9',
          timestamp: '2026-07-20T19:00:00.000Z',
        }),
      )
      store.hydrateFromPersisted([persisted(1), persisted(2)])
      const out = useAnalysisSnapshotStore.getState().snapshots
      expect(out.map(s => s.runId)).toEqual(['fact-1', 'fact-2', 'session-new'])
      expect(out.map(s => s.runNumber)).toEqual([1, 2, 3])
      expect(out.map(s => s.source)).toEqual(['persisted', 'persisted', 'session'])
    })

    it('DEDUPES by run identity (responseHash) and prefers the PERSISTED copy', () => {
      // Same run seen twice: captured in session by a direct run, then read
      // back from the DB. Keeping both would show the user a phantom rerun
      // with every delta zero.
      const store = useAnalysisSnapshotStore.getState()
      store.addSnapshot(
        makeSnapshot(1, {
          runId: 'session-dupe',
          responseHash: 'rh-2',
          timestamp: '2026-07-20T12:00:00.000Z',
        }),
      )
      store.hydrateFromPersisted([persisted(1), persisted(2)])
      const out = useAnalysisSnapshotStore.getState().snapshots
      expect(out).toHaveLength(2)
      expect(out.map(s => s.runId)).toEqual(['fact-1', 'fact-2'])
      expect(out.some(s => s.runId === 'session-dupe')).toBe(false)
    })

    it('a session run with NO responseHash is never merged into another run', () => {
      const store = useAnalysisSnapshotStore.getState()
      store.addSnapshot(
        makeSnapshot(1, { runId: 'session-nohash', responseHash: '', timestamp: '2026-07-20T19:00:00.000Z' }),
      )
      store.hydrateFromPersisted([persisted(1, { responseHash: '' })])
      const out = useAnalysisSnapshotStore.getState().snapshots
      expect(out.map(s => s.runId)).toEqual(['fact-1', 'session-nohash'])
    })

    it('a second hydration REPLACES the persisted portion but keeps session-only runs', () => {
      const store = useAnalysisSnapshotStore.getState()
      store.addSnapshot(
        makeSnapshot(1, { runId: 'session-keep', responseHash: 'rh-keep', timestamp: '2026-07-20T19:00:00.000Z' }),
      )
      store.hydrateFromPersisted([persisted(1)])
      store.hydrateFromPersisted([persisted(1), persisted(2), persisted(3)])
      const out = useAnalysisSnapshotStore.getState().snapshots
      expect(out.map(s => s.runId)).toEqual(['fact-1', 'fact-2', 'fact-3', 'session-keep'])
    })

    it('hydrating with an empty list clears the persisted portion and keeps session runs', () => {
      const store = useAnalysisSnapshotStore.getState()
      store.addSnapshot(makeSnapshot(1, { runId: 'session-only', responseHash: 'rh-s' }))
      store.hydrateFromPersisted([persisted(1)])
      store.hydrateFromPersisted([])
      expect(useAnalysisSnapshotStore.getState().snapshots.map(s => s.runId)).toEqual(['session-only'])
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
