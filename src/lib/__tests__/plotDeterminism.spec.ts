import { describe, it, expect, vi } from 'vitest'
import { runTemplate, type RunResponse } from '../plotApi'

describe('PLoT Determinism', () => {
  it('produces identical response_hash for 5 consecutive runs with same seed', async () => {
    // Mock fetch to return deterministic responses
    const mockResponse: RunResponse = {
      schema: 'report.v1',
      meta: { seed: 42, elapsed_ms: 100, response_id: 'test-123' },
      summary: {
        bands: { p10: 10, p50: 50, p90: 90 },
        confidence: { level: 'high', score: 0.9 }
      },
      critique: [],
      model_card: {
        response_hash: 'abc123def456',
        response_hash_algo: 'sha256',
        normalized: true
      }
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    })

    const template = {
      template_id: 'test-v1',
      seed: 42,
      belief_mode: 'strict' as const,
      graph: {
        goalNodeId: 'g1',
        nodes: [{ id: 'g1', kind: 'goal' as const, label: 'Test' }],
        edges: []
      }
    }

    // Run 5 times
    const hashes: string[] = []
    for (let i = 0; i < 5; i++) {
      const result = await runTemplate(template, 'test-token')
      hashes.push(result.model_card.response_hash)
    }

    // All hashes should be identical
    const uniqueHashes = new Set(hashes)
    expect(uniqueHashes.size).toBe(1)
    expect(hashes[0]).toBe('abc123def456')
  })
})
