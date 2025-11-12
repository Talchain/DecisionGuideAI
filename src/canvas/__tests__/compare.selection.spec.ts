/**
 * Compare Selection Dedupe Tests (P1 Hotfix)
 *
 * Verifies that setSelectedSnapshotsForComparison:
 * - De-duplicates snapshot IDs
 * - Caps at most recent 2 unique snapshots
 * - Ignores no-op re-selections
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../store'

describe('Compare Selection Dedupe', () => {
  beforeEach(() => {
    // Reset store to clean state
    useCanvasStore.setState({
      selectedSnapshotsForComparison: []
    })
  })

  describe('setSelectedSnapshotsForComparison', () => {
    it('should deduplicate snapshot IDs', () => {
      const { setSelectedSnapshotsForComparison } = useCanvasStore.getState()

      setSelectedSnapshotsForComparison(['snap-a', 'snap-a', 'snap-b'])

      const { selectedSnapshotsForComparison } = useCanvasStore.getState()
      expect(selectedSnapshotsForComparison).toEqual(['snap-a', 'snap-b'])
    })

    it('should cap at most recent 2 unique snapshots', () => {
      const { setSelectedSnapshotsForComparison } = useCanvasStore.getState()

      setSelectedSnapshotsForComparison(['snap-a', 'snap-b', 'snap-c'])

      const { selectedSnapshotsForComparison } = useCanvasStore.getState()
      expect(selectedSnapshotsForComparison).toEqual(['snap-b', 'snap-c']) // Most recent 2
      expect(selectedSnapshotsForComparison.length).toBe(2)
    })

    it('should maintain order (most recent)', () => {
      const { setSelectedSnapshotsForComparison } = useCanvasStore.getState()

      setSelectedSnapshotsForComparison(['snap-1', 'snap-2', 'snap-3', 'snap-4'])

      const { selectedSnapshotsForComparison } = useCanvasStore.getState()
      expect(selectedSnapshotsForComparison).toEqual(['snap-3', 'snap-4'])
    })

    it('should ignore no-op re-selections (same IDs, same order)', () => {
      const { setSelectedSnapshotsForComparison } = useCanvasStore.getState()

      // Initial selection
      setSelectedSnapshotsForComparison(['snap-a', 'snap-b'])
      const initial = useCanvasStore.getState().selectedSnapshotsForComparison

      // Re-select same IDs in same order (should be no-op)
      setSelectedSnapshotsForComparison(['snap-a', 'snap-b'])
      const after = useCanvasStore.getState().selectedSnapshotsForComparison

      // Should be the same array reference (no state update)
      expect(after).toBe(initial)
      expect(after).toEqual(['snap-a', 'snap-b'])
    })

    it('should update when order changes', () => {
      const { setSelectedSnapshotsForComparison } = useCanvasStore.getState()

      setSelectedSnapshotsForComparison(['snap-a', 'snap-b'])
      const initial = useCanvasStore.getState().selectedSnapshotsForComparison

      // Reverse order - should trigger update
      setSelectedSnapshotsForComparison(['snap-b', 'snap-a'])
      const after = useCanvasStore.getState().selectedSnapshotsForComparison

      expect(after).not.toBe(initial)
      expect(after).toEqual(['snap-b', 'snap-a'])
    })

    it('should handle single selection', () => {
      const { setSelectedSnapshotsForComparison } = useCanvasStore.getState()

      setSelectedSnapshotsForComparison(['snap-only'])

      const { selectedSnapshotsForComparison } = useCanvasStore.getState()
      expect(selectedSnapshotsForComparison).toEqual(['snap-only'])
      expect(selectedSnapshotsForComparison.length).toBe(1)
    })

    it('should handle empty selection', () => {
      const { setSelectedSnapshotsForComparison } = useCanvasStore.getState()

      setSelectedSnapshotsForComparison([])

      const { selectedSnapshotsForComparison } = useCanvasStore.getState()
      expect(selectedSnapshotsForComparison).toEqual([])
      expect(selectedSnapshotsForComparison.length).toBe(0)
    })

    it('should dedupe then cap (correct order of operations)', () => {
      const { setSelectedSnapshotsForComparison } = useCanvasStore.getState()

      // [A, A, B, C] → dedupe: [A, B, C] → cap: [B, C]
      setSelectedSnapshotsForComparison(['snap-a', 'snap-a', 'snap-b', 'snap-c'])

      const { selectedSnapshotsForComparison } = useCanvasStore.getState()
      expect(selectedSnapshotsForComparison).toEqual(['snap-b', 'snap-c'])
    })

    it('should handle all duplicates', () => {
      const { setSelectedSnapshotsForComparison } = useCanvasStore.getState()

      setSelectedSnapshotsForComparison(['snap-same', 'snap-same', 'snap-same'])

      const { selectedSnapshotsForComparison } = useCanvasStore.getState()
      expect(selectedSnapshotsForComparison).toEqual(['snap-same'])
    })

    it('should update from empty to single', () => {
      const { setSelectedSnapshotsForComparison } = useCanvasStore.getState()

      // Start empty
      setSelectedSnapshotsForComparison([])
      expect(useCanvasStore.getState().selectedSnapshotsForComparison).toEqual([])

      // Add one
      setSelectedSnapshotsForComparison(['snap-first'])
      expect(useCanvasStore.getState().selectedSnapshotsForComparison).toEqual(['snap-first'])
    })

    it('should update from single to two', () => {
      const { setSelectedSnapshotsForComparison } = useCanvasStore.getState()

      setSelectedSnapshotsForComparison(['snap-one'])
      expect(useCanvasStore.getState().selectedSnapshotsForComparison).toEqual(['snap-one'])

      setSelectedSnapshotsForComparison(['snap-one', 'snap-two'])
      expect(useCanvasStore.getState().selectedSnapshotsForComparison).toEqual(['snap-one', 'snap-two'])
    })
  })
})
