/**
 * Driver Matching Tests
 * Tests ID-first with label fallback matching logic
 */

import { describe, it, expect } from 'vitest'
import { findNodeMatches, findEdgeMatches, findDriverMatches, type Driver } from '../driverMatching'
import type { Node, Edge } from '@xyflow/react'

describe('driverMatching', () => {
  const mockNodes: Node[] = [
    { id: '1', position: { x: 0, y: 0 }, data: { label: 'Market Growth' } },
    { id: '2', position: { x: 100, y: 0 }, data: { label: 'Competition Risk' } },
    { id: '3', position: { x: 200, y: 0 }, data: { label: 'Market' } }
  ]

  const mockEdges: Edge[] = [
    { id: 'e1', source: '1', target: '2', label: 'Primary Path' },
    { id: 'e2', source: '2', target: '3', label: 'Secondary' }
  ]

  describe('findNodeMatches', () => {
    it('should match by ID (primary path)', () => {
      const driver: Driver = { kind: 'node', id: '1', label: 'Wrong Label' }
      const matches = findNodeMatches(driver, mockNodes)

      expect(matches).toHaveLength(1)
      expect(matches[0]).toEqual({
        kind: 'node',
        targetId: '1',
        matchType: 'id',
        confidence: 'exact'
      })
    })

    it('should fallback to exact label match when no ID', () => {
      const driver: Driver = { kind: 'node', label: 'Market Growth' }
      const matches = findNodeMatches(driver, mockNodes)

      expect(matches).toHaveLength(1)
      expect(matches[0]).toEqual({
        kind: 'node',
        targetId: '1',
        matchType: 'label',
        confidence: 'exact'
      })
    })

    it('should do fuzzy label match (case-insensitive)', () => {
      const driver: Driver = { kind: 'node', label: 'market growth' }
      const matches = findNodeMatches(driver, mockNodes)

      expect(matches).toHaveLength(1)
      expect(matches[0].targetId).toBe('1')
      expect(matches[0].confidence).toBe('exact')
    })

    it('should find multiple fuzzy matches and sort by confidence', () => {
      const driver: Driver = { kind: 'node', label: 'market' }
      const matches = findNodeMatches(driver, mockNodes)

      expect(matches.length).toBeGreaterThanOrEqual(2)
      // Exact match should come first
      expect(matches[0].targetId).toBe('3')
      expect(matches[0].confidence).toBe('exact')
    })

    it('should normalize whitespace and punctuation', () => {
      const nodesWithPunctuation: Node[] = [
        { id: '1', position: { x: 0, y: 0 }, data: { label: 'Market-Growth!' } }
      ]

      const driver: Driver = { kind: 'node', label: 'market growth' }
      const matches = findNodeMatches(driver, nodesWithPunctuation)

      expect(matches).toHaveLength(1)
      expect(matches[0].targetId).toBe('1')
    })

    it('should return empty array when no matches', () => {
      const driver: Driver = { kind: 'node', label: 'Nonexistent' }
      const matches = findNodeMatches(driver, mockNodes)

      expect(matches).toEqual([])
    })

    it('should return empty array for edge driver', () => {
      const driver: Driver = { kind: 'edge', label: 'Test' }
      const matches = findNodeMatches(driver, mockNodes)

      expect(matches).toEqual([])
    })
  })

  describe('findEdgeMatches', () => {
    it('should match by ID (primary path)', () => {
      const driver: Driver = { kind: 'edge', id: 'e1', label: 'Wrong Label' }
      const matches = findEdgeMatches(driver, mockEdges)

      expect(matches).toHaveLength(1)
      expect(matches[0]).toEqual({
        kind: 'edge',
        targetId: 'e1',
        matchType: 'id',
        confidence: 'exact'
      })
    })

    it('should fallback to exact label match when no ID', () => {
      const driver: Driver = { kind: 'edge', label: 'Primary Path' }
      const matches = findEdgeMatches(driver, mockEdges)

      expect(matches).toHaveLength(1)
      expect(matches[0]).toEqual({
        kind: 'edge',
        targetId: 'e1',
        matchType: 'label',
        confidence: 'exact'
      })
    })

    it('should find fuzzy matches', () => {
      const driver: Driver = { kind: 'edge', label: 'primary' }
      const matches = findEdgeMatches(driver, mockEdges)

      expect(matches).toHaveLength(1)
      expect(matches[0].targetId).toBe('e1')
    })

    it('should return empty array for node driver', () => {
      const driver: Driver = { kind: 'node', label: 'Test' }
      const matches = findEdgeMatches(driver, mockEdges)

      expect(matches).toEqual([])
    })
  })

  describe('findDriverMatches', () => {
    it('should delegate to findNodeMatches for node drivers', () => {
      const driver: Driver = { kind: 'node', id: '1' }
      const matches = findDriverMatches(driver, mockNodes, mockEdges)

      expect(matches).toHaveLength(1)
      expect(matches[0].kind).toBe('node')
    })

    it('should delegate to findEdgeMatches for edge drivers', () => {
      const driver: Driver = { kind: 'edge', id: 'e1' }
      const matches = findDriverMatches(driver, mockNodes, mockEdges)

      expect(matches).toHaveLength(1)
      expect(matches[0].kind).toBe('edge')
    })
  })

  describe('confidence sorting', () => {
    it('should sort exact matches before fuzzy', () => {
      const nodes: Node[] = [
        { id: '1', position: { x: 0, y: 0 }, data: { label: 'Market Growth Projection' } },
        { id: '2', position: { x: 100, y: 0 }, data: { label: 'Market' } }
      ]

      const driver: Driver = { kind: 'node', label: 'market' }
      const matches = findNodeMatches(driver, nodes)

      expect(matches.length).toBeGreaterThanOrEqual(2)
      // Exact normalized match should come first
      expect(matches[0].targetId).toBe('2')
      expect(matches[0].confidence).toBe('exact')
    })
  })
})
