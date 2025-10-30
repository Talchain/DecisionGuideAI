import { describe, it, expect } from 'vitest'
import { normalizeTemplateGraph, normalizeTemplateListItem } from '../templateNormalizer'

describe('templateNormalizer', () => {
  describe('normalizeTemplateGraph', () => {
    it('handles flat format (current API)', () => {
      const input = {
        nodes: [
          { id: 'n1', label: 'Decision' },
          { id: 'n2', label: 'Outcome' },
        ],
        edges: [
          { from: 'n1', to: 'n2', weight: 0.8 },
        ],
        version: '2.0',
        default_seed: 42,
        meta: {
          suggested_positions: {
            n1: { x: 100, y: 100 },
            n2: { x: 300, y: 100 },
          },
        },
      }

      const result = normalizeTemplateGraph(input)

      expect(result).toEqual({
        nodes: input.nodes,
        edges: input.edges,
        version: '2.0',
        default_seed: 42,
        meta: {
          suggested_positions: {
            n1: { x: 100, y: 100 },
            n2: { x: 300, y: 100 },
          },
        },
      })
    })

    it('handles nested format (expected API)', () => {
      const input = {
        graph: {
          nodes: [
            { id: 'n1', label: 'Decision' },
            { id: 'n2', label: 'Outcome' },
          ],
          edges: [
            { from: 'n1', to: 'n2', weight: 0.8 },
          ],
        },
        version: '2.0',
        default_seed: 42,
        meta: {
          suggested_positions: {
            n1: { x: 100, y: 100 },
            n2: { x: 300, y: 100 },
          },
        },
      }

      const result = normalizeTemplateGraph(input)

      expect(result).toEqual({
        nodes: input.graph.nodes,
        edges: input.graph.edges,
        version: '2.0',
        default_seed: 42,
        meta: {
          suggested_positions: {
            n1: { x: 100, y: 100 },
            n2: { x: 300, y: 100 },
          },
        },
      })
    })

    it('provides defaults for missing optional fields', () => {
      const input = {
        nodes: [{ id: 'n1' }],
        edges: [],
      }

      const result = normalizeTemplateGraph(input)

      expect(result).toEqual({
        nodes: [{ id: 'n1' }],
        edges: [],
        version: '1.0', // Default version
        default_seed: undefined,
        meta: {}, // Empty meta
      })
    })

    it('allows undefined default_seed', () => {
      const input = {
        nodes: [],
        edges: [],
        version: '1.0',
      }

      const result = normalizeTemplateGraph(input)

      expect(result.default_seed).toBeUndefined()
    })

    it('rejects invalid input (not an object)', () => {
      expect(() => normalizeTemplateGraph(null)).toThrow('[templateNormalizer] Invalid response: expected object')
      expect(() => normalizeTemplateGraph(undefined)).toThrow('[templateNormalizer] Invalid response: expected object')
      expect(() => normalizeTemplateGraph('string')).toThrow('[templateNormalizer] Invalid response: expected object')
      expect(() => normalizeTemplateGraph(42)).toThrow('[templateNormalizer] Invalid response: expected object')
    })

    it('rejects missing nodes or edges in flat format', () => {
      expect(() => normalizeTemplateGraph({ nodes: [] })).toThrow('[templateNormalizer] Invalid response: missing nodes or edges')
      expect(() => normalizeTemplateGraph({ edges: [] })).toThrow('[templateNormalizer] Invalid response: missing nodes or edges')
      expect(() => normalizeTemplateGraph({})).toThrow('[templateNormalizer] Invalid response: missing nodes or edges')
    })

    it('rejects non-array nodes', () => {
      expect(() => normalizeTemplateGraph({ nodes: 'not-array', edges: [] })).toThrow('[templateNormalizer] Invalid response: nodes must be an array')
    })

    it('rejects non-array edges', () => {
      expect(() => normalizeTemplateGraph({ nodes: [], edges: 'not-array' })).toThrow('[templateNormalizer] Invalid response: edges must be an array')
    })

    it('handles nested format with empty graph', () => {
      const input = {
        graph: {
          nodes: [],
          edges: [],
        },
      }

      const result = normalizeTemplateGraph(input)

      expect(result).toEqual({
        nodes: [],
        edges: [],
        version: '1.0',
        default_seed: undefined,
        meta: {},
      })
    })

    it('preserves custom meta fields', () => {
      const input = {
        nodes: [],
        edges: [],
        meta: {
          custom_field: 'custom_value',
          another_field: 123,
        },
      }

      const result = normalizeTemplateGraph(input)

      expect(result.meta).toEqual({
        custom_field: 'custom_value',
        another_field: 123,
      })
    })
  })

  describe('normalizeTemplateListItem', () => {
    it('normalizes v1 API format (label, summary)', () => {
      const input = {
        id: 'template-1',
        label: 'Sales Decision',
        summary: 'A template for sales decisions',
        version: '2.0',
      }

      const result = normalizeTemplateListItem(input)

      expect(result).toEqual({
        id: 'template-1',
        name: 'Sales Decision',
        description: 'A template for sales decisions',
        version: '2.0',
      })
    })

    it('normalizes future API format (name, description)', () => {
      const input = {
        id: 'template-2',
        name: 'Product Launch',
        description: 'A template for product launches',
        version: '3.0',
      }

      const result = normalizeTemplateListItem(input)

      expect(result).toEqual({
        id: 'template-2',
        name: 'Product Launch',
        description: 'A template for product launches',
        version: '3.0',
      })
    })

    it('prefers name over label when both present', () => {
      const input = {
        id: 'template-3',
        name: 'Preferred Name',
        label: 'Fallback Label',
        description: 'Description',
      }

      const result = normalizeTemplateListItem(input)

      expect(result.name).toBe('Preferred Name')
    })

    it('prefers description over summary when both present', () => {
      const input = {
        id: 'template-4',
        description: 'Preferred Description',
        summary: 'Fallback Summary',
      }

      const result = normalizeTemplateListItem(input)

      expect(result.description).toBe('Preferred Description')
    })

    it('provides defaults for missing fields', () => {
      const input = {
        id: 'template-5',
      }

      const result = normalizeTemplateListItem(input)

      expect(result).toEqual({
        id: 'template-5',
        name: 'Untitled Template',
        description: '',
        version: '1.0',
      })
    })

    it('uses label as fallback when name is missing', () => {
      const input = {
        id: 'template-6',
        label: 'Label Only',
      }

      const result = normalizeTemplateListItem(input)

      expect(result.name).toBe('Label Only')
    })

    it('uses summary as fallback when description is missing', () => {
      const input = {
        id: 'template-7',
        summary: 'Summary Only',
      }

      const result = normalizeTemplateListItem(input)

      expect(result.description).toBe('Summary Only')
    })
  })
})
