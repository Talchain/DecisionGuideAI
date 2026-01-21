/**
 * Fragile Edge Selection Invariants
 *
 * When a factor has multiple fragile edges (to different outcomes), we must
 * select the most risky one for display. These tests verify the selection logic.
 *
 * RULE: When a factor has multiple fragile edges:
 * - Prefer defined switchProbability values over undefined
 * - When both defined, keep the higher value (more risky edge dominates)
 * - undefined means "no data", not "zero risk"
 *
 * Location: useResultsSectionData.ts, Step 4b (fragileEdgesMap)
 */

import { describe, it, expect } from 'vitest'

/**
 * Simulates the fragile edge selection logic from useResultsSectionData.ts
 * This allows us to test the algorithm in isolation.
 */
function buildFragileEdgesMap(
  fragileEdges: Array<{
    from_id?: string
    switch_probability?: number
    alternative_winner_label?: string
  }>
): Map<string, { switchProbability?: number; alternativeWinnerLabel?: string }> {
  const fragileEdgesMap = new Map<string, { switchProbability?: number; alternativeWinnerLabel?: string }>()

  fragileEdges.forEach((fe) => {
    const fromId = fe.from_id
    if (fromId) {
      const newProb = typeof fe.switch_probability === 'number' ? fe.switch_probability : undefined
      const existing = fragileEdgesMap.get(fromId)
      const existingProb = existing?.switchProbability

      // Decision logic: prefer defined values, then prefer higher values
      const shouldReplace =
        !existing || // No existing entry
        (existingProb === undefined && newProb !== undefined) || // New has value, existing doesn't
        (existingProb !== undefined && newProb !== undefined && newProb > existingProb) // Both defined, new is higher

      if (shouldReplace) {
        fragileEdgesMap.set(fromId, {
          switchProbability: newProb,
          alternativeWinnerLabel: fe.alternative_winner_label,
        })
      }
    }
  })

  return fragileEdgesMap
}

describe('Fragile Edge Selection (Invariants)', () => {
  describe('single edge per factor', () => {
    it('should store single edge with defined switchProbability', () => {
      const edges = [
        { from_id: 'fac_price', switch_probability: 0.35, alternative_winner_label: 'Option B' },
      ]

      const result = buildFragileEdgesMap(edges)

      expect(result.get('fac_price')).toEqual({
        switchProbability: 0.35,
        alternativeWinnerLabel: 'Option B',
      })
    })

    it('should store single edge with undefined switchProbability', () => {
      const edges = [
        { from_id: 'fac_price', alternative_winner_label: 'Option B' },
      ]

      const result = buildFragileEdgesMap(edges)

      expect(result.get('fac_price')).toEqual({
        switchProbability: undefined,
        alternativeWinnerLabel: 'Option B',
      })
    })

    it('should preserve zero switchProbability (real zero, not placeholder)', () => {
      const edges = [
        { from_id: 'fac_price', switch_probability: 0, alternative_winner_label: 'Option B' },
      ]

      const result = buildFragileEdgesMap(edges)

      expect(result.get('fac_price')?.switchProbability).toBe(0)
    })
  })

  describe('multiple edges per factor - higher wins', () => {
    it('should keep higher switchProbability when both defined', () => {
      const edges = [
        { from_id: 'fac_price', switch_probability: 0.35, alternative_winner_label: 'Lower risk' },
        { from_id: 'fac_price', switch_probability: 0.72, alternative_winner_label: 'Higher risk' },
      ]

      const result = buildFragileEdgesMap(edges)

      expect(result.get('fac_price')).toEqual({
        switchProbability: 0.72,
        alternativeWinnerLabel: 'Higher risk',
      })
    })

    it('should keep higher switchProbability regardless of order', () => {
      const edges = [
        { from_id: 'fac_price', switch_probability: 0.72, alternative_winner_label: 'Higher risk' },
        { from_id: 'fac_price', switch_probability: 0.35, alternative_winner_label: 'Lower risk' },
      ]

      const result = buildFragileEdgesMap(edges)

      expect(result.get('fac_price')).toEqual({
        switchProbability: 0.72,
        alternativeWinnerLabel: 'Higher risk',
      })
    })

    it('should handle three edges and keep highest', () => {
      const edges = [
        { from_id: 'fac_price', switch_probability: 0.35, alternative_winner_label: 'Low' },
        { from_id: 'fac_price', switch_probability: 0.55, alternative_winner_label: 'Medium' },
        { from_id: 'fac_price', switch_probability: 0.18, alternative_winner_label: 'Lowest' },
      ]

      const result = buildFragileEdgesMap(edges)

      expect(result.get('fac_price')?.switchProbability).toBe(0.55)
      expect(result.get('fac_price')?.alternativeWinnerLabel).toBe('Medium')
    })
  })

  describe('prefer defined values over undefined', () => {
    it('should prefer defined value over undefined (undefined first)', () => {
      const edges = [
        { from_id: 'fac_price', alternative_winner_label: 'No probability' }, // undefined
        { from_id: 'fac_price', switch_probability: 0.35, alternative_winner_label: 'Has probability' },
      ]

      const result = buildFragileEdgesMap(edges)

      expect(result.get('fac_price')).toEqual({
        switchProbability: 0.35,
        alternativeWinnerLabel: 'Has probability',
      })
    })

    it('should prefer defined value over undefined (defined first)', () => {
      const edges = [
        { from_id: 'fac_price', switch_probability: 0.35, alternative_winner_label: 'Has probability' },
        { from_id: 'fac_price', alternative_winner_label: 'No probability' }, // undefined
      ]

      const result = buildFragileEdgesMap(edges)

      expect(result.get('fac_price')).toEqual({
        switchProbability: 0.35,
        alternativeWinnerLabel: 'Has probability',
      })
    })

    it('should prefer defined zero over undefined', () => {
      // Real zero means "0% chance of flipping" which is meaningful
      // undefined means "we don't have data"
      const edges = [
        { from_id: 'fac_price', alternative_winner_label: 'No data' }, // undefined
        { from_id: 'fac_price', switch_probability: 0, alternative_winner_label: 'Zero risk' },
      ]

      const result = buildFragileEdgesMap(edges)

      expect(result.get('fac_price')?.switchProbability).toBe(0)
      expect(result.get('fac_price')?.alternativeWinnerLabel).toBe('Zero risk')
    })

    it('should NOT let undefined replace defined value', () => {
      // CRITICAL: This was the bug we fixed. undefined should never replace a defined value.
      const edges = [
        { from_id: 'fac_price', switch_probability: 0.1, alternative_winner_label: 'Low but defined' },
        { from_id: 'fac_price', alternative_winner_label: 'No probability' }, // undefined
      ]

      const result = buildFragileEdgesMap(edges)

      expect(result.get('fac_price')?.switchProbability).toBe(0.1)
      expect(result.get('fac_price')?.alternativeWinnerLabel).toBe('Low but defined')
    })
  })

  describe('multiple factors', () => {
    it('should handle multiple factors independently', () => {
      const edges = [
        { from_id: 'fac_price', switch_probability: 0.35, alternative_winner_label: 'Price alt' },
        { from_id: 'fac_quality', switch_probability: 0.55, alternative_winner_label: 'Quality alt' },
        { from_id: 'fac_price', switch_probability: 0.72, alternative_winner_label: 'Price alt 2' },
      ]

      const result = buildFragileEdgesMap(edges)

      expect(result.get('fac_price')?.switchProbability).toBe(0.72)
      expect(result.get('fac_quality')?.switchProbability).toBe(0.55)
    })
  })

  describe('edge cases', () => {
    it('should skip edges without from_id', () => {
      const edges = [
        { switch_probability: 0.35, alternative_winner_label: 'No from_id' },
        { from_id: 'fac_price', switch_probability: 0.55, alternative_winner_label: 'Has from_id' },
      ]

      const result = buildFragileEdgesMap(edges)

      expect(result.size).toBe(1)
      expect(result.get('fac_price')?.switchProbability).toBe(0.55)
    })

    it('should handle empty array', () => {
      const result = buildFragileEdgesMap([])
      expect(result.size).toBe(0)
    })

    it('should handle all undefined probabilities', () => {
      const edges = [
        { from_id: 'fac_price', alternative_winner_label: 'First' },
        { from_id: 'fac_price', alternative_winner_label: 'Second' },
      ]

      const result = buildFragileEdgesMap(edges)

      // First one wins when both undefined
      expect(result.get('fac_price')?.switchProbability).toBeUndefined()
      expect(result.get('fac_price')?.alternativeWinnerLabel).toBe('First')
    })
  })
})
