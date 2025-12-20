/**
 * Tests for Drivers Adapter
 *
 * Phase 1 P0: Transform PLoT driver data for UI
 */

import { describe, it, expect } from 'vitest'
import {
  normalizeDrivers,
  getDriverHighlightIds,
  formatDriverImpact,
  getImpactColorClass,
  toStoreDrivers,
  type RawDriver,
} from '../driversAdapter'

describe('normalizeDrivers', () => {
  const mockNodes = [
    { id: 'node_1', type: 'factor', data: { label: 'Market Size' }, position: { x: 0, y: 0 } },
    { id: 'node_2', type: 'factor', data: { label: 'Competition' }, position: { x: 100, y: 0 } },
  ]

  const mockEdges = [
    { id: 'edge_1', source: 'node_1', target: 'node_2', data: { label: 'influences' } },
  ]

  describe('basic transformation', () => {
    it('transforms raw drivers to normalized format', () => {
      const rawDrivers: RawDriver[] = [
        { kind: 'node', node_id: 'node_1', impact: 0.8 },
        { kind: 'node', node_id: 'node_2', impact: 0.5 },
      ]

      const result = normalizeDrivers(rawDrivers, mockNodes as any, mockEdges as any)

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('node_1')
      expect(result[0].kind).toBe('node')
      expect(result[0].impact).toBe(80)
      expect(result[0].rank).toBe(1)
      expect(result[1].rank).toBe(2)
    })

    it('resolves labels from nodes', () => {
      const rawDrivers: RawDriver[] = [
        { kind: 'node', node_id: 'node_1', impact: 0.8 },
      ]

      const result = normalizeDrivers(rawDrivers, mockNodes as any, mockEdges as any)

      expect(result[0].label).toBe('Market Size')
    })

    it('uses provided label over resolved label', () => {
      const rawDrivers: RawDriver[] = [
        { kind: 'node', node_id: 'node_1', impact: 0.8, label: 'Custom Label' },
      ]

      const result = normalizeDrivers(rawDrivers, mockNodes as any, mockEdges as any)

      expect(result[0].label).toBe('Custom Label')
    })
  })

  describe('impact normalization', () => {
    it('normalizes 0-1 values to 0-100', () => {
      const rawDrivers: RawDriver[] = [
        { kind: 'node', node_id: 'node_1', impact: 0.75 },
      ]

      const result = normalizeDrivers(rawDrivers, mockNodes as any, mockEdges as any)

      expect(result[0].impact).toBe(75)
    })

    it('handles values already in 0-100 range', () => {
      const rawDrivers: RawDriver[] = [
        { kind: 'node', node_id: 'node_1', impact: 75 },
      ]

      const result = normalizeDrivers(rawDrivers, mockNodes as any, mockEdges as any)

      expect(result[0].impact).toBe(75)
    })

    it('uses contribution when impact is not available', () => {
      const rawDrivers: RawDriver[] = [
        { kind: 'node', node_id: 'node_1', contribution: 0.6 },
      ]

      const result = normalizeDrivers(rawDrivers, mockNodes as any, mockEdges as any)

      expect(result[0].impact).toBe(60)
    })
  })

  describe('direction detection', () => {
    it('detects positive direction from sign', () => {
      const rawDrivers: RawDriver[] = [
        { kind: 'node', node_id: 'node_1', impact: 0.5, sign: '+' },
      ]

      const result = normalizeDrivers(rawDrivers, mockNodes as any, mockEdges as any)

      expect(result[0].impactDirection).toBe('positive')
    })

    it('detects negative direction from sign', () => {
      const rawDrivers: RawDriver[] = [
        { kind: 'node', node_id: 'node_1', impact: 0.5, sign: '-' },
      ]

      const result = normalizeDrivers(rawDrivers, mockNodes as any, mockEdges as any)

      expect(result[0].impactDirection).toBe('negative')
    })

    it('infers direction from impact value', () => {
      const rawDrivers: RawDriver[] = [
        { kind: 'node', node_id: 'node_1', impact: 0.5 },
        { kind: 'node', node_id: 'node_2', impact: -0.3 },
      ]

      const result = normalizeDrivers(rawDrivers, mockNodes as any, mockEdges as any)

      expect(result[0].impactDirection).toBe('positive')
      expect(result[1].impactDirection).toBe('negative')
    })
  })

  describe('filtering and sorting', () => {
    it('filters by minimum impact', () => {
      const rawDrivers: RawDriver[] = [
        { kind: 'node', node_id: 'node_1', impact: 0.8 },
        { kind: 'node', node_id: 'node_2', impact: 0.02 }, // Below default threshold
      ]

      const result = normalizeDrivers(rawDrivers, mockNodes as any, mockEdges as any)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('node_1')
    })

    it('sorts by impact descending', () => {
      const rawDrivers: RawDriver[] = [
        { kind: 'node', node_id: 'node_2', impact: 0.5 },
        { kind: 'node', node_id: 'node_1', impact: 0.8 },
      ]

      const result = normalizeDrivers(rawDrivers, mockNodes as any, mockEdges as any)

      expect(result[0].id).toBe('node_1')
      expect(result[1].id).toBe('node_2')
    })

    it('limits to maxDrivers', () => {
      const rawDrivers: RawDriver[] = [
        { kind: 'node', node_id: 'node_1', impact: 0.9 },
        { kind: 'node', node_id: 'node_2', impact: 0.8 },
      ]

      const result = normalizeDrivers(rawDrivers, mockNodes as any, mockEdges as any, { maxDrivers: 1 })

      expect(result).toHaveLength(1)
    })
  })

  describe('edge handling', () => {
    it('filters out edges when showEdges is false', () => {
      const rawDrivers: RawDriver[] = [
        { kind: 'node', node_id: 'node_1', impact: 0.8 },
        { kind: 'edge', edge_id: 'edge_1', impact: 0.6 },
      ]

      const result = normalizeDrivers(rawDrivers, mockNodes as any, mockEdges as any, { showEdges: false })

      expect(result).toHaveLength(1)
      expect(result[0].kind).toBe('node')
    })

    it('creates edge label from connected nodes', () => {
      const rawDrivers: RawDriver[] = [
        { kind: 'edge', edge_id: 'edge_2', impact: 0.8 },
      ]

      // Edge without explicit label should create "source → target"
      const edgesWithoutLabel = [
        { id: 'edge_2', source: 'node_1', target: 'node_2', data: {} },
      ]

      const result = normalizeDrivers(rawDrivers, mockNodes as any, edgesWithoutLabel as any)

      expect(result[0].label).toContain('→')
      expect(result[0].label).toBe('Market Size → Competition')
    })
  })

  describe('empty/undefined handling', () => {
    it('returns empty array for undefined input', () => {
      expect(normalizeDrivers(undefined, [], [])).toEqual([])
    })

    it('returns empty array for empty input', () => {
      expect(normalizeDrivers([], [], [])).toEqual([])
    })
  })
})

describe('getDriverHighlightIds', () => {
  it('separates node and edge IDs using uiId when valid', () => {
    const drivers = [
      { id: 'plot_node_1', uiId: 'node_1', uiIdValid: true, kind: 'node' as const, label: 'A', impact: 80, impactDirection: 'positive' as const, rawImpact: 0.8, rank: 1 },
      { id: 'a::b::0', uiId: 'edge_1', uiIdValid: true, kind: 'edge' as const, label: 'B', impact: 60, impactDirection: 'positive' as const, rawImpact: 0.6, rank: 2 },
    ]

    const result = getDriverHighlightIds(drivers)

    expect(result.nodeIds).toEqual(['node_1'])
    expect(result.edgeIds).toEqual(['edge_1'])
  })

  it('excludes drivers with invalid uiId mapping', () => {
    const drivers = [
      { id: 'plot_node_1', uiId: 'node_1', uiIdValid: true, kind: 'node' as const, label: 'A', impact: 80, impactDirection: 'positive' as const, rawImpact: 0.8, rank: 1 },
      { id: 'a::b::0', uiId: 'a::b::0', uiIdValid: false, kind: 'edge' as const, label: 'B', impact: 60, impactDirection: 'positive' as const, rawImpact: 0.6, rank: 2 },
    ]

    const result = getDriverHighlightIds(drivers)

    expect(result.nodeIds).toEqual(['node_1'])
    expect(result.edgeIds).toEqual([]) // Invalid edge excluded
  })
})

describe('formatDriverImpact', () => {
  it('formats positive impact with + sign', () => {
    const driver = { id: '1', uiId: '1', uiIdValid: true, kind: 'node' as const, label: 'A', impact: 75, impactDirection: 'positive' as const, rawImpact: 0.75, rank: 1 }
    expect(formatDriverImpact(driver)).toBe('+75%')
  })

  it('formats negative impact with - sign', () => {
    const driver = { id: '1', uiId: '1', uiIdValid: true, kind: 'node' as const, label: 'A', impact: 25, impactDirection: 'negative' as const, rawImpact: -0.25, rank: 1 }
    expect(formatDriverImpact(driver)).toBe('-25%')
  })

  it('formats neutral impact without sign', () => {
    const driver = { id: '1', uiId: '1', uiIdValid: true, kind: 'node' as const, label: 'A', impact: 50, impactDirection: 'neutral' as const, rawImpact: 0, rank: 1 }
    expect(formatDriverImpact(driver)).toBe('50%')
  })
})

describe('getImpactColorClass', () => {
  it('returns success color for positive', () => {
    expect(getImpactColorClass('positive')).toContain('success')
  })

  it('returns error color for negative', () => {
    expect(getImpactColorClass('negative')).toContain('error')
  })

  it('returns gray for neutral', () => {
    expect(getImpactColorClass('neutral')).toContain('gray')
  })
})

describe('toStoreDrivers', () => {
  it('converts normalized drivers to store format using uiId', () => {
    const drivers = [
      { id: 'plot_node_1', uiId: 'node_1', uiIdValid: true, kind: 'node' as const, label: 'A', impact: 80, impactDirection: 'positive' as const, rawImpact: 0.8, rank: 1 },
      { id: 'a::b::0', uiId: 'edge_1', uiIdValid: true, kind: 'edge' as const, label: 'B', impact: 60, impactDirection: 'positive' as const, rawImpact: 0.6, rank: 2 },
    ]

    const result = toStoreDrivers(drivers)

    expect(result).toEqual([
      { kind: 'node', id: 'node_1' },
      { kind: 'edge', id: 'edge_1' },
    ])
  })
})
