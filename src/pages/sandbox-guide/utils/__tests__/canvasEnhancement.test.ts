/**
 * Tests for Canvas Enhancement Utilities
 *
 * Verifies visual encoding calculations for:
 * - Edge thickness based on contribution
 * - Edge color based on evidence
 * - Critical gap detection
 * - Node badge generation
 * - Complete edge enhancement
 */

import { describe, it, expect } from 'vitest'
import type { Edge } from '@xyflow/react'
import {
  calculateEdgeThickness,
  calculateEdgeColor,
  isCriticalGap,
  getNodeBadge,
  enhanceEdges,
  type TopDriver,
  type CriticalGap,
} from '../canvasEnhancement'

describe('canvasEnhancement', () => {
  describe('calculateEdgeThickness', () => {
    it('returns 6 for top driver edges (>40%)', () => {
      const edge: Edge = { id: 'e1', source: 'n1', target: 'n2' }
      const drivers: TopDriver[] = [
        { node_id: 'n2', contribution: 0.45, node_label: 'Driver 1' },
      ]

      expect(calculateEdgeThickness(edge, drivers)).toBe(6)
    })

    it('returns 4 for significant edges (>20%)', () => {
      const edge: Edge = { id: 'e1', source: 'n1', target: 'n2' }
      const drivers: TopDriver[] = [
        { node_id: 'n2', contribution: 0.25, node_label: 'Driver 1' },
      ]

      expect(calculateEdgeThickness(edge, drivers)).toBe(4)
    })

    it('returns 3 for notable edges (>10%)', () => {
      const edge: Edge = { id: 'e1', source: 'n1', target: 'n2' }
      const drivers: TopDriver[] = [
        { node_id: 'n2', contribution: 0.15, node_label: 'Driver 1' },
      ]

      expect(calculateEdgeThickness(edge, drivers)).toBe(3)
    })

    it('returns 2 for non-driver edges', () => {
      const edge: Edge = { id: 'e1', source: 'n1', target: 'n2' }
      const drivers: TopDriver[] = [
        { node_id: 'n3', contribution: 0.45, node_label: 'Driver 1' },
      ]

      expect(calculateEdgeThickness(edge, drivers)).toBe(2)
    })

    it('returns 2 when no drivers provided', () => {
      const edge: Edge = { id: 'e1', source: 'n1', target: 'n2' }

      expect(calculateEdgeThickness(edge, undefined)).toBe(2)
      expect(calculateEdgeThickness(edge, [])).toBe(2)
    })

    it('uses source driver contribution at 50% weight', () => {
      const edge: Edge = { id: 'e1', source: 'n1', target: 'n2' }
      const drivers: TopDriver[] = [
        // Source has 45% but weighted at 50% = 22.5% -> thickness 4
        { node_id: 'n1', contribution: 0.45, node_label: 'Source Driver' },
      ]

      expect(calculateEdgeThickness(edge, drivers)).toBe(4)
    })

    it('uses highest contribution when both source and target are drivers', () => {
      const edge: Edge = { id: 'e1', source: 'n1', target: 'n2' }
      const drivers: TopDriver[] = [
        { node_id: 'n1', contribution: 0.3, node_label: 'Source' }, // 30% * 0.5 = 15%
        { node_id: 'n2', contribution: 0.25, node_label: 'Target' }, // 25% (wins)
      ]

      expect(calculateEdgeThickness(edge, drivers)).toBe(4)
    })
  })

  describe('calculateEdgeColor', () => {
    it('returns grey for no evidence', () => {
      const edge: Edge = { id: 'e1', source: 'n1', target: 'n2' }
      const coverage = new Map<string, number>()

      expect(calculateEdgeColor(edge, coverage)).toBe('#A0AEC0')
    })

    it('returns grey when edge not in coverage map', () => {
      const edge: Edge = { id: 'e1', source: 'n1', target: 'n2' }
      const coverage = new Map([['e2', 3]])

      expect(calculateEdgeColor(edge, coverage)).toBe('#A0AEC0')
    })

    it('returns light blue for 1 source', () => {
      const edge: Edge = { id: 'e1', source: 'n1', target: 'n2' }
      const coverage = new Map([['e1', 1]])

      expect(calculateEdgeColor(edge, coverage)).toBe('#63B3ED')
    })

    it('returns medium blue for 2 sources', () => {
      const edge: Edge = { id: 'e1', source: 'n1', target: 'n2' }
      const coverage = new Map([['e1', 2]])

      expect(calculateEdgeColor(edge, coverage)).toBe('#4299E1')
    })

    it('returns darker blue for 3 sources', () => {
      const edge: Edge = { id: 'e1', source: 'n1', target: 'n2' }
      const coverage = new Map([['e1', 3]])

      expect(calculateEdgeColor(edge, coverage)).toBe('#3182CE')
    })

    it('returns darkest blue for 4+ sources', () => {
      const edge: Edge = { id: 'e1', source: 'n1', target: 'n2' }
      const coverage = new Map([['e1', 5]])

      expect(calculateEdgeColor(edge, coverage)).toBe('#2B6CB0')
    })

    it('returns grey when coverage is undefined', () => {
      const edge: Edge = { id: 'e1', source: 'n1', target: 'n2' }

      expect(calculateEdgeColor(edge, undefined)).toBe('#A0AEC0')
    })
  })

  describe('isCriticalGap', () => {
    it('returns true for critical gaps', () => {
      const edge: Edge = { id: 'e1', source: 'n1', target: 'n2' }
      const gaps: CriticalGap[] = [
        {
          edge_id: 'e1',
          impact_on_outcome: 'HIGH',
          recommendation: 'Add evidence',
        },
      ]

      expect(isCriticalGap(edge, gaps)).toBe(true)
    })

    it('returns false for non-critical edges', () => {
      const edge: Edge = { id: 'e1', source: 'n1', target: 'n2' }
      const gaps: CriticalGap[] = [
        {
          edge_id: 'e2',
          impact_on_outcome: 'HIGH',
          recommendation: 'Add evidence',
        },
      ]

      expect(isCriticalGap(edge, gaps)).toBe(false)
    })

    it('returns false when no gaps provided', () => {
      const edge: Edge = { id: 'e1', source: 'n1', target: 'n2' }

      expect(isCriticalGap(edge, undefined)).toBe(false)
      expect(isCriticalGap(edge, [])).toBe(false)
    })

    it('handles multiple gaps correctly', () => {
      const edge: Edge = { id: 'e2', source: 'n1', target: 'n2' }
      const gaps: CriticalGap[] = [
        { edge_id: 'e1', impact_on_outcome: 'HIGH' },
        { edge_id: 'e2', impact_on_outcome: 'MEDIUM' },
        { edge_id: 'e3', impact_on_outcome: 'LOW' },
      ]

      expect(isCriticalGap(edge, gaps)).toBe(true)
    })
  })

  describe('getNodeBadge', () => {
    it('returns badge info for top drivers', () => {
      const drivers: TopDriver[] = [
        { node_id: 'n1', contribution: 0.45, node_label: 'Driver 1' },
        { node_id: 'n2', contribution: 0.25, node_label: 'Driver 2' },
      ]

      const badge = getNodeBadge('n1', drivers)

      expect(badge).toEqual({ percentage: 45, rank: 1 })
    })

    it('calculates rank correctly', () => {
      const drivers: TopDriver[] = [
        { node_id: 'n1', contribution: 0.45, node_label: 'Driver 1' },
        { node_id: 'n2', contribution: 0.25, node_label: 'Driver 2' },
        { node_id: 'n3', contribution: 0.15, node_label: 'Driver 3' },
      ]

      expect(getNodeBadge('n1', drivers)).toEqual({ percentage: 45, rank: 1 })
      expect(getNodeBadge('n2', drivers)).toEqual({ percentage: 25, rank: 2 })
      expect(getNodeBadge('n3', drivers)).toEqual({ percentage: 15, rank: 3 })
    })

    it('rounds percentage correctly', () => {
      const drivers: TopDriver[] = [
        { node_id: 'n1', contribution: 0.456, node_label: 'Driver 1' },
      ]

      expect(getNodeBadge('n1', drivers)?.percentage).toBe(46)
    })

    it('returns null for non-driver nodes', () => {
      const drivers: TopDriver[] = [
        { node_id: 'n1', contribution: 0.45, node_label: 'Driver 1' },
      ]

      expect(getNodeBadge('n2', drivers)).toBeNull()
    })

    it('returns null when no drivers provided', () => {
      expect(getNodeBadge('n1', undefined)).toBeNull()
      expect(getNodeBadge('n1', [])).toBeNull()
    })
  })

  describe('enhanceEdges', () => {
    it('enhances edges with thickness, color, and animation', () => {
      const edges: Edge[] = [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n1', target: 'n3' },
      ]

      const drivers: TopDriver[] = [
        { node_id: 'n2', contribution: 0.45, node_label: 'Driver 1' },
      ]

      const gaps: CriticalGap[] = [
        { edge_id: 'e2', impact_on_outcome: 'HIGH' },
      ]

      const coverage = new Map([['e1', 2]])

      const enhanced = enhanceEdges(edges, drivers, gaps, coverage)

      // Check edge 1 (driver, has evidence, not critical)
      expect(enhanced[0].style?.strokeWidth).toBe(6)
      expect(enhanced[0].style?.stroke).toBe('#4299E1')
      expect(enhanced[0].animated).toBe(false)
      expect(enhanced[0].className).toBeUndefined()

      // Check edge 2 (no driver, no evidence, critical)
      expect(enhanced[1].style?.strokeWidth).toBe(2)
      expect(enhanced[1].style?.stroke).toBe('#A0AEC0')
      expect(enhanced[1].animated).toBe(true)
      expect(enhanced[1].className).toBe('critical-gap-edge')
    })

    it('preserves existing edge data and style', () => {
      const edges: Edge[] = [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          data: { existing: 'data' },
          style: { opacity: 0.8 },
        },
      ]

      const enhanced = enhanceEdges(edges)

      expect(enhanced[0].data?.existing).toBe('data')
      expect(enhanced[0].style?.opacity).toBe(0.8)
    })

    it('adds visual encoding metadata to edge data', () => {
      const edges: Edge[] = [{ id: 'e1', source: 'n1', target: 'n2' }]

      const drivers: TopDriver[] = [
        { node_id: 'n2', contribution: 0.45, node_label: 'Driver 1' },
      ]

      const coverage = new Map([['e1', 3]])

      const enhanced = enhanceEdges(edges, drivers, undefined, coverage)

      expect(enhanced[0].data?.visualEncoding).toEqual({
        thickness: 6,
        color: '#3182CE',
        isCritical: false,
        evidenceCount: 3,
      })
    })

    it('handles empty edges array', () => {
      const enhanced = enhanceEdges([])

      expect(enhanced).toEqual([])
    })

    it('works with no optional parameters', () => {
      const edges: Edge[] = [
        { id: 'e1', source: 'n1', target: 'n2' },
      ]

      const enhanced = enhanceEdges(edges)

      expect(enhanced[0].style?.strokeWidth).toBe(2)
      expect(enhanced[0].style?.stroke).toBe('#A0AEC0')
      expect(enhanced[0].animated).toBe(false)
    })
  })
})
