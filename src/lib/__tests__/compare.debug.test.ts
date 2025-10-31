import { describe, it, expect } from 'vitest'
import { deriveCompare, deriveCompareAcrossRuns } from '../compare'

describe('compare.debug', () => {
  // Valid debug.compare map fixture
  const mockCompareMap = {
    conservative: {
      p10: 100,
      p50: 150,
      p90: 200,
      top3_edges: [
        { edge_id: 'e1', from: 'n1', to: 'n2', label: 'Edge 1', weight: 0.8 },
        { edge_id: 'e2', from: 'n2', to: 'n3', label: 'Edge 2', weight: 0.6 },
        { edge_id: 'e3', from: 'n1', to: 'n3', label: 'Edge 3', weight: 0.4 }
      ]
    },
    likely: {
      p10: 120,
      p50: 170,
      p90: 220,
      top3_edges: [
        { edge_id: 'e2', from: 'n2', to: 'n3', label: 'Edge 2', weight: 0.7 }
      ]
    },
    optimistic: {
      p10: 140,
      p50: 190,
      p90: 240,
      top3_edges: []
    }
  }

  describe('deriveCompare', () => {
    it('calculates A/B deltas for two options within same run', () => {
      const result = deriveCompare(mockCompareMap, 'conservative', 'likely')

      expect(result).not.toBeNull()
      expect(result!.p10).toEqual({ a: 100, b: 120, delta: 20 })
      expect(result!.p50).toEqual({ a: 150, b: 170, delta: 20 })
      expect(result!.p90).toEqual({ a: 200, b: 220, delta: 20 })
      expect(result!.top3_edges).toEqual(mockCompareMap.likely.top3_edges)
    })

    it('returns null when compareMap is invalid', () => {
      const result = deriveCompare({ invalid: 'data' }, 'conservative', 'likely')
      expect(result).toBeNull()
    })

    it('returns null when option A is missing', () => {
      const result = deriveCompare(mockCompareMap, 'nonexistent', 'likely')
      expect(result).toBeNull()
    })

    it('returns null when option B is missing', () => {
      const result = deriveCompare(mockCompareMap, 'conservative', 'nonexistent')
      expect(result).toBeNull()
    })

    it('handles negative deltas correctly', () => {
      const result = deriveCompare(mockCompareMap, 'likely', 'conservative')

      expect(result).not.toBeNull()
      expect(result!.p10.delta).toBe(-20)
      expect(result!.p50.delta).toBe(-20)
      expect(result!.p90.delta).toBe(-20)
    })

    it('uses option B top3_edges', () => {
      const result = deriveCompare(mockCompareMap, 'conservative', 'optimistic')

      expect(result).not.toBeNull()
      expect(result!.top3_edges).toEqual([]) // optimistic has empty top3_edges
    })
  })

  describe('deriveCompareAcrossRuns', () => {
    // Run B has higher values than Run A
    const mockCompareMapA = {
      conservative: {
        p10: 100,
        p50: 150,
        p90: 200,
        top3_edges: [
          { edge_id: 'e1', from: 'n1', to: 'n2', label: 'Edge 1', weight: 0.8 }
        ]
      }
    }

    const mockCompareMapB = {
      conservative: {
        p10: 120,
        p50: 180,
        p90: 240,
        top3_edges: [
          { edge_id: 'e2', from: 'n2', to: 'n3', label: 'Edge 2', weight: 0.9 }
        ]
      }
    }

    it('calculates cross-run deltas for same option', () => {
      const result = deriveCompareAcrossRuns(
        mockCompareMapA,
        mockCompareMapB,
        'conservative'
      )

      expect(result).not.toBeNull()
      expect(result!.p10).toEqual({ a: 100, b: 120, delta: 20 })
      expect(result!.p50).toEqual({ a: 150, b: 180, delta: 30 })
      expect(result!.p90).toEqual({ a: 200, b: 240, delta: 40 })
      expect(result!.top3_edges).toEqual(mockCompareMapB.conservative.top3_edges)
    })

    it('returns null when compareMapA is invalid', () => {
      const result = deriveCompareAcrossRuns(
        { invalid: 'data' },
        mockCompareMapB,
        'conservative'
      )
      expect(result).toBeNull()
    })

    it('returns null when compareMapB is invalid', () => {
      const result = deriveCompareAcrossRuns(
        mockCompareMapA,
        { invalid: 'data' },
        'conservative'
      )
      expect(result).toBeNull()
    })

    it('returns null when option missing in run A', () => {
      const result = deriveCompareAcrossRuns(
        mockCompareMapA,
        mockCompareMapB,
        'nonexistent'
      )
      expect(result).toBeNull()
    })

    it('returns null when option missing in run B', () => {
      const mapWithMultipleOptions = {
        conservative: mockCompareMapA.conservative,
        likely: { p10: 110, p50: 160, p90: 210, top3_edges: [] }
      }

      const result = deriveCompareAcrossRuns(
        mapWithMultipleOptions,
        mockCompareMapB,
        'likely'
      )
      expect(result).toBeNull()
    })

    it('handles negative deltas when run B has lower values', () => {
      // Swap A and B to get negative deltas
      const result = deriveCompareAcrossRuns(
        mockCompareMapB,
        mockCompareMapA,
        'conservative'
      )

      expect(result).not.toBeNull()
      expect(result!.p10.delta).toBe(-20)
      expect(result!.p50.delta).toBe(-30)
      expect(result!.p90.delta).toBe(-40)
    })

    it('uses run B top3_edges regardless of run A', () => {
      const result = deriveCompareAcrossRuns(
        mockCompareMapA,
        mockCompareMapB,
        'conservative'
      )

      expect(result).not.toBeNull()
      // Should use run B's edges, not run A's
      expect(result!.top3_edges).toEqual(mockCompareMapB.conservative.top3_edges)
      expect(result!.top3_edges).not.toEqual(mockCompareMapA.conservative.top3_edges)
    })
  })

  describe('edge cases', () => {
    it('deriveCompare handles zero deltas', () => {
      const sameValues = {
        opt1: { p10: 100, p50: 150, p90: 200, top3_edges: [] },
        opt2: { p10: 100, p50: 150, p90: 200, top3_edges: [] }
      }

      const result = deriveCompare(sameValues, 'opt1', 'opt2')

      expect(result).not.toBeNull()
      expect(result!.p10.delta).toBe(0)
      expect(result!.p50.delta).toBe(0)
      expect(result!.p90.delta).toBe(0)
    })

    it('deriveCompareAcrossRuns handles zero deltas', () => {
      const mapA = {
        conservative: { p10: 100, p50: 150, p90: 200, top3_edges: [] }
      }
      const mapB = {
        conservative: { p10: 100, p50: 150, p90: 200, top3_edges: [] }
      }

      const result = deriveCompareAcrossRuns(mapA, mapB, 'conservative')

      expect(result).not.toBeNull()
      expect(result!.p10.delta).toBe(0)
      expect(result!.p50.delta).toBe(0)
      expect(result!.p90.delta).toBe(0)
    })

    it('handles undefined/null compareMap gracefully', () => {
      expect(deriveCompare(undefined, 'a', 'b')).toBeNull()
      expect(deriveCompare(null, 'a', 'b')).toBeNull()
      expect(deriveCompareAcrossRuns(undefined, {}, 'a')).toBeNull()
      expect(deriveCompareAcrossRuns({}, undefined, 'a')).toBeNull()
    })
  })
})
