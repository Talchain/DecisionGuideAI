/**
 * Ghost Suggestions Tests
 *
 * Tests for pattern-based edge suggestions:
 * - Correct patterns applied
 * - Confidence sorting
 * - Existing edge exclusion
 * - Max 3 suggestions
 * - Stage gating
 */

import { describe, it, expect } from 'vitest'
import { generateGhostSuggestions, shouldShowGhosts } from '../ghostSuggestions'
import type { Node, Edge } from '@xyflow/react'

describe('ghostSuggestions', () => {
  const mockNodes: Node[] = [
    {
      id: 'option1',
      type: 'option',
      data: { type: 'option', label: 'Option A' },
      position: { x: 0, y: 0 },
    },
    {
      id: 'outcome1',
      type: 'outcome',
      data: { type: 'outcome', label: 'Outcome 1' },
      position: { x: 100, y: 0 },
    },
    {
      id: 'outcome2',
      type: 'outcome',
      data: { type: 'outcome', label: 'Outcome 2' },
      position: { x: 200, y: 0 },
    },
    {
      id: 'factor1',
      type: 'factor',
      data: { type: 'factor', label: 'Factor X' },
      position: { x: 0, y: 100 },
    },
    {
      id: 'risk1',
      type: 'risk',
      data: { type: 'risk', label: 'Risk Y' },
      position: { x: 100, y: 100 },
    },
  ]

  const mockEdges: Edge[] = []

  describe('generateGhostSuggestions', () => {
    it('suggests option → outcome connections', () => {
      const suggestions = generateGhostSuggestions('option1', mockNodes, mockEdges)

      expect(suggestions.length).toBeGreaterThan(0)

      const outcomeSuggestions = suggestions.filter((s) => s.to.startsWith('outcome'))
      expect(outcomeSuggestions.length).toBeGreaterThan(0)

      expect(suggestions[0]).toMatchObject({
        from: 'option1',
        to: expect.stringMatching(/outcome/),
        suggestedWeight: 0.5,
        confidence: 0.8,
        reasoning: expect.stringContaining('influence outcomes'),
      })
    })

    it('suggests factor → decision connections', () => {
      const suggestions = generateGhostSuggestions('factor1', mockNodes, mockEdges)

      const toOption = suggestions.find((s) => s.to === 'option1')
      expect(toOption).toBeDefined()
      expect(toOption?.suggestedWeight).toBe(0.3)
      expect(toOption?.confidence).toBe(0.6)
      expect(toOption?.reasoning).toContain('influence decisions')
    })

    it('suggests risk → outcome with negative weight', () => {
      const suggestions = generateGhostSuggestions('risk1', mockNodes, mockEdges)

      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions[0].suggestedWeight).toBeLessThan(0)
      expect(suggestions[0].reasoning).toContain('reduce')
    })

    it('suggests outcome → outcome chaining', () => {
      const suggestions = generateGhostSuggestions('outcome1', mockNodes, mockEdges)

      const toOutcome = suggestions.find((s) => s.to === 'outcome2')
      expect(toOutcome).toBeDefined()
      expect(toOutcome?.suggestedWeight).toBe(0.4)
      expect(toOutcome?.confidence).toBe(0.5)
      expect(toOutcome?.reasoning).toContain('cascade')
    })

    it('limits to 3 suggestions max', () => {
      const manyOutcomes: Node[] = [
        {
          id: 'option1',
          type: 'option',
          data: { type: 'option' },
          position: { x: 0, y: 0 },
        },
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `outcome${i}`,
          type: 'outcome',
          data: { type: 'outcome' },
          position: { x: i * 100, y: 0 },
        })),
      ]

      const suggestions = generateGhostSuggestions('option1', manyOutcomes, [])
      expect(suggestions.length).toBeLessThanOrEqual(3)
    })

    it('excludes existing connections', () => {
      const existingEdges: Edge[] = [
        {
          id: 'e1',
          source: 'option1',
          target: 'outcome1',
        },
      ]

      const suggestions = generateGhostSuggestions('option1', mockNodes, existingEdges)
      expect(suggestions.find((s) => s.to === 'outcome1')).toBeUndefined()
    })

    it('returns empty array for invalid node', () => {
      const suggestions = generateGhostSuggestions('invalid', mockNodes, mockEdges)
      expect(suggestions).toEqual([])
    })

    it('does not suggest self-loops', () => {
      const suggestions = generateGhostSuggestions('outcome1', mockNodes, mockEdges)
      expect(suggestions.find((s) => s.to === 'outcome1')).toBeUndefined()
    })

    it('sorts by confidence descending', () => {
      const suggestions = generateGhostSuggestions('option1', mockNodes, mockEdges)

      for (let i = 0; i < suggestions.length - 1; i++) {
        expect(suggestions[i].confidence).toBeGreaterThanOrEqual(suggestions[i + 1].confidence)
      }
    })

    it('handles nodes with type in data field', () => {
      const nodesWithDataType: Node[] = [
        {
          id: 'n1',
          type: 'default',
          data: { type: 'option', label: 'Option' },
          position: { x: 0, y: 0 },
        },
        {
          id: 'n2',
          type: 'default',
          data: { type: 'outcome', label: 'Outcome' },
          position: { x: 100, y: 0 },
        },
      ]

      const suggestions = generateGhostSuggestions('n1', nodesWithDataType, [])
      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions[0].to).toBe('n2')
    })

    it('returns empty for unknown node types', () => {
      const unknownNodes: Node[] = [
        {
          id: 'n1',
          type: 'unknown',
          data: { label: 'Unknown' },
          position: { x: 0, y: 0 },
        },
        {
          id: 'n2',
          type: 'unknown',
          data: { label: 'Unknown 2' },
          position: { x: 100, y: 0 },
        },
      ]

      const suggestions = generateGhostSuggestions('n1', unknownNodes, [])
      expect(suggestions).toEqual([])
    })
  })

  describe('shouldShowGhosts', () => {
    it('returns true in building stage with 2+ nodes', () => {
      expect(shouldShowGhosts('building', 2)).toBe(true)
      expect(shouldShowGhosts('building', 10)).toBe(true)
    })

    it('returns false in non-building stages', () => {
      expect(shouldShowGhosts('empty', 5)).toBe(false)
      expect(shouldShowGhosts('post-run', 5)).toBe(false)
      expect(shouldShowGhosts('pre-run-ready', 5)).toBe(false)
      expect(shouldShowGhosts('inspector', 5)).toBe(false)
    })

    it('returns false with < 2 nodes', () => {
      expect(shouldShowGhosts('building', 0)).toBe(false)
      expect(shouldShowGhosts('building', 1)).toBe(false)
    })

    it('requires exact building stage match', () => {
      expect(shouldShowGhosts('Building', 5)).toBe(false) // Case sensitive
      expect(shouldShowGhosts(' building', 5)).toBe(false) // Whitespace
    })
  })
})
