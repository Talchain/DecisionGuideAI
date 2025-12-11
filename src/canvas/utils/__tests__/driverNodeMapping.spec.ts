/**
 * Driver to Node ID Mapping Tests
 *
 * Tests for the centralized driver-to-node mapping utility
 */
import { describe, it, expect } from 'vitest'
import { mapDriverToNodeId, mapDriversToNodes, getMatchQuality } from '../driverNodeMapping'
import type { Node } from '@xyflow/react'

// Mock canvas nodes for testing
const mockNodes: Node[] = [
  { id: 'n1', type: 'risk', position: { x: 0, y: 0 }, data: { label: 'Market Demand' } },
  { id: 'n2', type: 'factor', position: { x: 100, y: 0 }, data: { label: 'Team Capacity' } },
  { id: 'n3', type: 'outcome', position: { x: 200, y: 0 }, data: { label: 'Revenue Growth' } },
  { id: 'risk_saturation', type: 'risk', position: { x: 300, y: 0 }, data: { label: 'Market Saturation Risk' } },
  { id: 'n5', type: 'goal', position: { x: 400, y: 0 }, data: { label: 'Increase Customer Base' } },
]

describe('mapDriverToNodeId', () => {
  describe('API nodeId match', () => {
    it('matches driver with exact node_id from API', () => {
      const driver = { label: 'Market Demand', nodeId: 'n1' }
      const mapped = mapDriverToNodeId(driver, mockNodes)

      expect(mapped.resolvedNodeId).toBe('n1')
      expect(mapped.matchType).toBe('api')
    })

    it('falls back when API nodeId does not exist on canvas', () => {
      const driver = { label: 'Market Demand', nodeId: 'nonexistent' }
      const mapped = mapDriverToNodeId(driver, mockNodes)

      // Should fallback to exact label match
      expect(mapped.resolvedNodeId).toBe('n1')
      expect(mapped.matchType).toBe('exact_label')
    })
  })

  describe('prefix type matching', () => {
    it('extracts type from node_id prefix and matches by label', () => {
      const driver = { label: 'Market Saturation Risk', nodeId: 'risk_something' }
      const mapped = mapDriverToNodeId(driver, mockNodes)

      expect(mapped.resolvedNodeId).toBe('risk_saturation')
      expect(mapped.matchType).toBe('prefix')
    })
  })

  describe('exact label matching', () => {
    it('matches by exact label (case-insensitive)', () => {
      const driver = { label: 'team capacity' }
      const mapped = mapDriverToNodeId(driver, mockNodes)

      expect(mapped.resolvedNodeId).toBe('n2')
      expect(mapped.matchType).toBe('exact_label')
    })

    it('matches with trimmed whitespace', () => {
      const driver = { label: '  Market Demand  ' }
      const mapped = mapDriverToNodeId(driver, mockNodes)

      expect(mapped.resolvedNodeId).toBe('n1')
      expect(mapped.matchType).toBe('exact_label')
    })

    it('matches ignoring quotes', () => {
      const driver = { label: '"Market Demand"' }
      const mapped = mapDriverToNodeId(driver, mockNodes)

      expect(mapped.resolvedNodeId).toBe('n1')
      expect(mapped.matchType).toBe('exact_label')
    })
  })

  describe('partial label matching', () => {
    it('matches when driver label contains node label', () => {
      const driver = { label: 'The Market Demand factor' }
      const mapped = mapDriverToNodeId(driver, mockNodes)

      expect(mapped.resolvedNodeId).toBe('n1')
      expect(mapped.matchType).toBe('partial_label')
    })

    it('matches when node label contains driver label', () => {
      const driver = { label: 'Revenue' }
      const mapped = mapDriverToNodeId(driver, mockNodes)

      expect(mapped.resolvedNodeId).toBe('n3')
      expect(mapped.matchType).toBe('partial_label')
    })
  })

  describe('word overlap matching', () => {
    it('matches with 2+ word overlap', () => {
      const driver = { label: 'Customer Base Expansion Strategy' }
      const mapped = mapDriverToNodeId(driver, mockNodes)

      // Should match 'Increase Customer Base' with 2 words: 'customer', 'base'
      expect(mapped.resolvedNodeId).toBe('n5')
      expect(mapped.matchType).toBe('word_overlap')
    })

    it('ignores short words in overlap matching', () => {
      const driver = { label: 'The a an of' }
      const mapped = mapDriverToNodeId(driver, mockNodes)

      // Short words (<=2 chars) should be ignored
      expect(mapped.resolvedNodeId).toBeNull()
      expect(mapped.matchType).toBe('none')
    })
  })

  describe('no match', () => {
    it('returns null for unmatched drivers', () => {
      const driver = { label: 'Completely Unknown Factor' }
      const mapped = mapDriverToNodeId(driver, mockNodes)

      expect(mapped.resolvedNodeId).toBeNull()
      expect(mapped.matchType).toBe('none')
    })
  })
})

describe('mapDriversToNodes', () => {
  it('maps multiple drivers', () => {
    const drivers = [
      { label: 'Market Demand', nodeId: 'n1' },
      { label: 'Team Capacity' },
      { label: 'Unknown Factor' },
    ]
    const mapped = mapDriversToNodes(drivers, mockNodes)

    expect(mapped).toHaveLength(3)
    expect(mapped[0].resolvedNodeId).toBe('n1')
    expect(mapped[1].resolvedNodeId).toBe('n2')
    expect(mapped[2].resolvedNodeId).toBeNull()
  })

  it('preserves original driver properties', () => {
    const drivers = [
      { label: 'Market Demand', polarity: 'up' as const, contribution: 0.35 },
    ]
    const mapped = mapDriversToNodes(drivers, mockNodes)

    expect(mapped[0].label).toBe('Market Demand')
    expect(mapped[0].polarity).toBe('up')
    expect(mapped[0].contribution).toBe(0.35)
  })
})

describe('getMatchQuality', () => {
  it('returns highest quality for API match', () => {
    expect(getMatchQuality('api')).toBe(100)
  })

  it('returns high quality for prefix match', () => {
    expect(getMatchQuality('prefix')).toBe(90)
  })

  it('returns good quality for exact label match', () => {
    expect(getMatchQuality('exact_label')).toBe(80)
  })

  it('returns medium quality for partial label match', () => {
    expect(getMatchQuality('partial_label')).toBe(60)
  })

  it('returns low quality for word overlap match', () => {
    expect(getMatchQuality('word_overlap')).toBe(40)
  })

  it('returns zero for no match', () => {
    expect(getMatchQuality('none')).toBe(0)
  })
})
