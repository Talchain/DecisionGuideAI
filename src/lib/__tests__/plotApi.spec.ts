import { describe, it, expect, vi } from 'vitest'
import { validateGraph, type Graph, type ApiLimits } from '../plotApi'

describe('PLoT API Client', () => {
  describe('validateGraph', () => {
    const limits: ApiLimits = { max_nodes: 12, max_edges: 20 }

    it('returns null for valid graph', () => {
      const graph: Graph = {
        goalNodeId: 'g1',
        nodes: [{ id: 'g1', kind: 'goal', label: 'Test' }],
        edges: []
      }

      const result = validateGraph(graph, limits)
      expect(result).toBeNull()
    })

    it('returns error when nodes exceed limit', () => {
      const graph: Graph = {
        goalNodeId: 'g1',
        nodes: Array.from({ length: 13 }, (_, i) => ({
          id: `n${i}`,
          kind: 'goal' as const,
          label: `Node ${i}`
        })),
        edges: []
      }

      const result = validateGraph(graph, limits)
      
      expect(result).toEqual({
        code: 'LIMIT_EXCEEDED',
        message: 'Too many nodes (max 12)',
        field: 'nodes',
        max: 12
      })
    })

    it('returns error when edges exceed limit', () => {
      const graph: Graph = {
        goalNodeId: 'g1',
        nodes: [
          { id: 'g1', kind: 'goal', label: 'Goal' },
          { id: 'd1', kind: 'decision', label: 'Decision' }
        ],
        edges: Array.from({ length: 21 }, (_, i) => ({
          id: `e${i}`,
          source: 'g1',
          target: 'd1',
          weight: 1,
          belief: 0.5
        }))
      }

      const result = validateGraph(graph, limits)
      
      expect(result).toEqual({
        code: 'LIMIT_EXCEEDED',
        message: 'Too many edges (max 20)',
        field: 'edges',
        max: 20
      })
    })
  })

  describe('API Integration (mocked)', () => {
    it('fetchLimits includes X-UI-Build header', async () => {
      const { fetchLimits } = await import('../plotApi')
      
      const mockLimits = { max_nodes: 12, max_edges: 20 }
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => '"abc123"' },
        json: async () => mockLimits
      })

      await fetchLimits('test-token')
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/limits'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'X-UI-Build': expect.any(String)
          })
        })
      )
    })

    it('runTemplate sends belief_mode without mutation', async () => {
      const { runTemplate } = await import('../plotApi')
      
      const mockResponse = {
        schema: 'report.v1',
        meta: { seed: 42, elapsed_ms: 100, response_id: 'test-123' },
        summary: {
          bands: { p10: 10, p50: 50, p90: 90 },
          confidence: { level: 'high' as const, score: 0.9 }
        },
        critique: [],
        model_card: {
          response_hash: 'abc123',
          response_hash_algo: 'sha256' as const,
          normalized: true
        }
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const request = {
        template_id: 'test-v1',
        seed: 42,
        belief_mode: 'as_provided' as const,
        graph: {
          goalNodeId: 'g1',
          nodes: [{ id: 'g1', kind: 'goal' as const, label: 'Test' }],
          edges: [{ id: 'e1', source: 'g1', target: 'g1', weight: 1, belief: 0.7 }]
        }
      }

      await runTemplate(request, 'test-token')
      
      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body)
      expect(body.belief_mode).toBe('as_provided')
      expect(body.graph.edges[0].belief).toBe(0.7) // Not mutated
    })

    it('runTemplate includes X-UI-Build header', async () => {
      const { runTemplate } = await import('../plotApi')
      
      const mockResponse = {
        schema: 'report.v1',
        meta: { seed: 42, elapsed_ms: 100, response_id: 'test-123' },
        summary: {
          bands: { p10: 10, p50: 50, p90: 90 },
          confidence: { level: 'high' as const, score: 0.9 }
        },
        critique: [],
        model_card: {
          response_hash: 'abc123',
          response_hash_algo: 'sha256' as const,
          normalized: true
        }
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const request = {
        seed: 42,
        graph: {
          goalNodeId: 'g1',
          nodes: [{ id: 'g1', kind: 'goal' as const, label: 'Test' }],
          edges: []
        }
      }

      await runTemplate(request, 'test-token')
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-UI-Build': expect.any(String)
          })
        })
      )
    })
  })
})
