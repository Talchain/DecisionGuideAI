import { describe, it, expect } from 'vitest'
import {
  mapPloTEdgeId,
  mapEdgeIds,
  verifyNodeIds,
  mapHighlightIds,
  mapHighlights,
  generatePloTEdgeId,
  annotateEdgesWithPloTIds,
  isPloTEdgeIdFormat,
  parsePloTEdgeId,
  createEdgeIdMaps,
} from '../idMapping'
import type { Node, Edge } from '@xyflow/react'
import type { Highlight } from '../../types/primitives'

describe('idMapping', () => {
  // Mock UI nodes
  const mockNodes: Node[] = [
    { id: 'price', position: { x: 0, y: 0 }, data: {} },
    { id: 'demand', position: { x: 100, y: 0 }, data: {} },
    { id: 'revenue', position: { x: 200, y: 0 }, data: {} },
  ]

  // Mock UI edges with different scenarios
  const mockEdges: Edge[] = [
    { id: 'edge-1', source: 'price', target: 'demand', data: {} },
    { id: 'edge-2', source: 'demand', target: 'revenue', data: {} },
    { id: 'edge-3', source: 'price', target: 'demand', data: {} }, // Parallel edge
  ]

  describe('mapPloTEdgeId', () => {
    it('maps PLoT format to UI edge ID', () => {
      expect(mapPloTEdgeId('price::demand::0', mockEdges)).toBe('edge-1')
    })

    it('maps parallel edge with index', () => {
      // edge-1 and edge-3 are both price->demand, sorted by ID edge-1 < edge-3
      expect(mapPloTEdgeId('price::demand::0', mockEdges)).toBe('edge-1')
      expect(mapPloTEdgeId('price::demand::1', mockEdges)).toBe('edge-3')
    })

    it('falls back to first match when index out of range', () => {
      expect(mapPloTEdgeId('price::demand::99', mockEdges)).toBe('edge-1')
    })

    it('returns null for unmapped edges', () => {
      expect(mapPloTEdgeId('foo::bar::0', mockEdges)).toBeNull()
    })

    it('returns null for invalid format', () => {
      expect(mapPloTEdgeId('invalid', mockEdges)).toBeNull()
    })

    it('matches by plot_id if stored on edge', () => {
      const edgesWithPlotId: Edge[] = [
        { id: 'edge-x', source: 'a', target: 'b', data: { plot_id: 'price::demand::0' } },
      ]
      expect(mapPloTEdgeId('price::demand::0', edgesWithPlotId)).toBe('edge-x')
    })

    it('defaults to index 0 when index not provided', () => {
      expect(mapPloTEdgeId('price::demand', mockEdges)).toBe('edge-1')
    })
  })

  describe('mapEdgeIds', () => {
    it('maps array of PLoT edge IDs', () => {
      const result = mapEdgeIds(['price::demand::0', 'demand::revenue::0'], mockEdges)

      expect(result.mapped).toContain('edge-1')
      expect(result.mapped).toContain('edge-2')
      expect(result.unmapped).toHaveLength(0)
    })

    it('separates unmapped IDs', () => {
      const result = mapEdgeIds(['price::demand::0', 'foo::bar::0'], mockEdges)

      expect(result.mapped).toContain('edge-1')
      expect(result.unmapped).toContain('foo::bar::0')
    })
  })

  describe('verifyNodeIds', () => {
    it('verifies valid node IDs', () => {
      const result = verifyNodeIds(['price', 'demand'], mockNodes)

      expect(result.mapped).toContain('price')
      expect(result.mapped).toContain('demand')
      expect(result.unmapped).toHaveLength(0)
    })

    it('separates invalid node IDs', () => {
      const result = verifyNodeIds(['price', 'unknown'], mockNodes)

      expect(result.mapped).toContain('price')
      expect(result.unmapped).toContain('unknown')
    })
  })

  describe('mapHighlightIds', () => {
    it('maps node highlight IDs', () => {
      const highlight: Highlight = { type: 'node', ids: ['price', 'unknown'] }
      const result = mapHighlightIds(highlight, mockNodes, mockEdges)

      expect(result.ids).toContain('price')
      expect(result.ids).not.toContain('unknown')
    })

    it('maps edge highlight IDs', () => {
      const highlight: Highlight = { type: 'edge', ids: ['price::demand::0'] }
      const result = mapHighlightIds(highlight, mockNodes, mockEdges)

      expect(result.ids).toContain('edge-1')
    })

    it('maps path highlight IDs (both nodes and edges)', () => {
      const highlight: Highlight = {
        type: 'path',
        ids: ['price::demand::0', 'price'], // Edge first, then node
      }
      const result = mapHighlightIds(highlight, mockNodes, mockEdges)

      // Edge should be mapped
      expect(result.ids).toContain('edge-1')
      // Node should be included
      expect(result.ids).toContain('price')
    })
  })

  describe('mapHighlights', () => {
    it('filters out highlights with no valid IDs', () => {
      const highlights: Highlight[] = [
        { type: 'node', ids: ['price'] },
        { type: 'node', ids: ['unknown'] },
      ]

      const result = mapHighlights(highlights, mockNodes, mockEdges)

      expect(result).toHaveLength(1)
      expect(result[0].ids).toContain('price')
    })
  })

  describe('generatePloTEdgeId', () => {
    it('generates PLoT format edge ID', () => {
      const result = generatePloTEdgeId(mockEdges[0], mockEdges)
      expect(result).toBe('price::demand::0')
    })

    it('generates correct index for parallel edges', () => {
      // edge-3 is the second price->demand edge (sorted by ID)
      const result = generatePloTEdgeId(mockEdges[2], mockEdges)
      expect(result).toBe('price::demand::1')
    })
  })

  describe('annotateEdgesWithPloTIds', () => {
    it('adds plot_id to all edges', () => {
      const result = annotateEdgesWithPloTIds(mockEdges)

      expect(result[0].data.plot_id).toBe('price::demand::0')
      expect(result[1].data.plot_id).toBe('demand::revenue::0')
      expect(result[2].data.plot_id).toBe('price::demand::1')
    })

    it('preserves existing edge data', () => {
      const edgesWithData: Edge[] = [
        { id: 'e1', source: 'a', target: 'b', data: { label: 'test', confidence: 0.5 } },
      ]

      const result = annotateEdgesWithPloTIds(edgesWithData)

      expect(result[0].data.label).toBe('test')
      expect(result[0].data.confidence).toBe(0.5)
      expect(result[0].data.plot_id).toBe('a::b::0')
    })
  })

  describe('isPloTEdgeIdFormat', () => {
    it('returns true for PLoT format', () => {
      expect(isPloTEdgeIdFormat('price::demand::0')).toBe(true)
      expect(isPloTEdgeIdFormat('a::b')).toBe(true)
    })

    it('returns false for non-PLoT format', () => {
      expect(isPloTEdgeIdFormat('edge-1')).toBe(false)
      expect(isPloTEdgeIdFormat('simple_id')).toBe(false)
    })
  })

  describe('parsePloTEdgeId', () => {
    it('parses valid PLoT edge ID', () => {
      const result = parsePloTEdgeId('price::demand::1')

      expect(result).toEqual({
        from: 'price',
        to: 'demand',
        index: 1,
      })
    })

    it('defaults index to 0 when not provided', () => {
      const result = parsePloTEdgeId('price::demand')

      expect(result).toEqual({
        from: 'price',
        to: 'demand',
        index: 0,
      })
    })

    it('returns null for invalid format', () => {
      expect(parsePloTEdgeId('invalid')).toBeNull()
    })
  })

  describe('createEdgeIdMaps', () => {
    it('creates bidirectional maps', () => {
      const { plotToUi, uiToPlot } = createEdgeIdMaps(mockEdges)

      expect(plotToUi.get('price::demand::0')).toBe('edge-1')
      expect(uiToPlot.get('edge-1')).toBe('price::demand::0')
    })

    it('handles parallel edges', () => {
      const { plotToUi, uiToPlot } = createEdgeIdMaps(mockEdges)

      expect(plotToUi.get('price::demand::1')).toBe('edge-3')
      expect(uiToPlot.get('edge-3')).toBe('price::demand::1')
    })
  })
})
