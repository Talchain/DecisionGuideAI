/**
 * Compare Selection Dedupe Tests (P1 Hotfix)
 *
 * Verifies that setSelectedSnapshotsForComparison:
 * - De-duplicates snapshot IDs
 * - Caps at most recent 2 unique snapshots
 * - Ignores no-op re-selections
 *
 * Migrated to useComparisonStore as part of C3-3 slice extraction.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useComparisonStore } from '../stores/comparisonStore'

describe('Compare Selection Dedupe', () => {
  beforeEach(() => {
    useComparisonStore.getState().resetComparison()
  })

  describe('setSelectedSnapshotsForComparison', () => {
    it('should deduplicate snapshot IDs', () => {
      const { setSelectedSnapshotsForComparison } = useComparisonStore.getState()

      setSelectedSnapshotsForComparison(['snap-a', 'snap-a', 'snap-b'])

      const { selectedSnapshotsForComparison } = useComparisonStore.getState()
      expect(selectedSnapshotsForComparison).toEqual(['snap-a', 'snap-b'])
    })

    it('should cap at most recent 2 unique snapshots', () => {
      const { setSelectedSnapshotsForComparison } = useComparisonStore.getState()

      setSelectedSnapshotsForComparison(['snap-a', 'snap-b', 'snap-c'])

      const { selectedSnapshotsForComparison } = useComparisonStore.getState()
      expect(selectedSnapshotsForComparison).toEqual(['snap-b', 'snap-c'])
      expect(selectedSnapshotsForComparison.length).toBe(2)
    })

    it('should maintain order (most recent)', () => {
      const { setSelectedSnapshotsForComparison } = useComparisonStore.getState()

      setSelectedSnapshotsForComparison(['snap-1', 'snap-2', 'snap-3', 'snap-4'])

      const { selectedSnapshotsForComparison } = useComparisonStore.getState()
      expect(selectedSnapshotsForComparison).toEqual(['snap-3', 'snap-4'])
    })

    it('should ignore no-op re-selections (same IDs, same order)', () => {
      const { setSelectedSnapshotsForComparison } = useComparisonStore.getState()

      setSelectedSnapshotsForComparison(['snap-a', 'snap-b'])
      const initial = useComparisonStore.getState().selectedSnapshotsForComparison

      setSelectedSnapshotsForComparison(['snap-a', 'snap-b'])
      const after = useComparisonStore.getState().selectedSnapshotsForComparison

      expect(after).toBe(initial)
      expect(after).toEqual(['snap-a', 'snap-b'])
    })

    it('should update when order changes', () => {
      const { setSelectedSnapshotsForComparison } = useComparisonStore.getState()

      setSelectedSnapshotsForComparison(['snap-a', 'snap-b'])
      const initial = useComparisonStore.getState().selectedSnapshotsForComparison

      setSelectedSnapshotsForComparison(['snap-b', 'snap-a'])
      const after = useComparisonStore.getState().selectedSnapshotsForComparison

      expect(after).not.toBe(initial)
      expect(after).toEqual(['snap-b', 'snap-a'])
    })

    it('should handle single selection', () => {
      const { setSelectedSnapshotsForComparison } = useComparisonStore.getState()

      setSelectedSnapshotsForComparison(['snap-only'])

      const { selectedSnapshotsForComparison } = useComparisonStore.getState()
      expect(selectedSnapshotsForComparison).toEqual(['snap-only'])
      expect(selectedSnapshotsForComparison.length).toBe(1)
    })

    it('should handle empty selection', () => {
      const { setSelectedSnapshotsForComparison } = useComparisonStore.getState()

      setSelectedSnapshotsForComparison([])

      const { selectedSnapshotsForComparison } = useComparisonStore.getState()
      expect(selectedSnapshotsForComparison).toEqual([])
      expect(selectedSnapshotsForComparison.length).toBe(0)
    })

    it('should dedupe then cap (correct order of operations)', () => {
      const { setSelectedSnapshotsForComparison } = useComparisonStore.getState()

      setSelectedSnapshotsForComparison(['snap-a', 'snap-a', 'snap-b', 'snap-c'])

      const { selectedSnapshotsForComparison } = useComparisonStore.getState()
      expect(selectedSnapshotsForComparison).toEqual(['snap-b', 'snap-c'])
    })

    it('should handle all duplicates', () => {
      const { setSelectedSnapshotsForComparison } = useComparisonStore.getState()

      setSelectedSnapshotsForComparison(['snap-same', 'snap-same', 'snap-same'])

      const { selectedSnapshotsForComparison } = useComparisonStore.getState()
      expect(selectedSnapshotsForComparison).toEqual(['snap-same'])
    })

    it('should update from empty to single', () => {
      const { setSelectedSnapshotsForComparison } = useComparisonStore.getState()

      setSelectedSnapshotsForComparison([])
      expect(useComparisonStore.getState().selectedSnapshotsForComparison).toEqual([])

      setSelectedSnapshotsForComparison(['snap-first'])
      expect(useComparisonStore.getState().selectedSnapshotsForComparison).toEqual(['snap-first'])
    })

    it('should update from single to two', () => {
      const { setSelectedSnapshotsForComparison } = useComparisonStore.getState()

      setSelectedSnapshotsForComparison(['snap-one'])
      expect(useComparisonStore.getState().selectedSnapshotsForComparison).toEqual(['snap-one'])

      setSelectedSnapshotsForComparison(['snap-one', 'snap-two'])
      expect(useComparisonStore.getState().selectedSnapshotsForComparison).toEqual(['snap-one', 'snap-two'])
    })
  })
})
