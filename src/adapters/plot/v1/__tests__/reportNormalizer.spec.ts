/**
 * Unit tests for report normalizer (toUiReport)
 *
 * Tests normalization of different API response envelopes into consistent UI model
 */

import { describe, it, expect } from 'vitest'
import { toUiReport } from '../reportNormalizer'
import type { RunResponse } from '../../../../types/plot'

describe('reportNormalizer', () => {
  describe('toUiReport - current envelope format', () => {
    it('should extract results from results.{conservative,most_likely,optimistic}', () => {
      const response: RunResponse = {
        results: {
          conservative: 100,
          most_likely: 150,
          optimistic: 200,
        },
      }

      const report = toUiReport(response)

      expect(report.conservative).toBe(100)
      expect(report.mostLikely).toBe(150)
      expect(report.optimistic).toBe(200)
    })

    it('should extract seed from meta.seed', () => {
      const response: RunResponse = {
        meta: { seed: 42 },
      }

      const report = toUiReport(response)

      expect(report.seed).toBe(42)
    })

    it('should extract seed from model_card.seed', () => {
      const response: RunResponse = {
        model_card: { seed: 1337 },
      }

      const report = toUiReport(response)

      expect(report.seed).toBe(1337)
    })

    it('should prefer meta.seed over model_card.seed', () => {
      const response: RunResponse = {
        meta: { seed: 42 },
        model_card: { seed: 1337 },
      }

      const report = toUiReport(response)

      expect(report.seed).toBe(42)
    })

    it('should extract hash from model_card.response_hash', () => {
      const response: RunResponse = {
        model_card: { response_hash: 'abc123xyz' },
      }

      const report = toUiReport(response)

      expect(report.hash).toBe('abc123xyz')
    })

    it('should extract hash from root response_hash', () => {
      const response: RunResponse = {
        response_hash: 'xyz789abc',
      }

      const report = toUiReport(response)

      expect(report.hash).toBe('xyz789abc')
    })

    it('should prefer model_card.response_hash over response_hash', () => {
      const response: RunResponse = {
        model_card: { response_hash: 'preferred' },
        response_hash: 'fallback',
      }

      const report = toUiReport(response)

      expect(report.hash).toBe('preferred')
    })
  })

  describe('toUiReport - legacy envelope format', () => {
    it('should extract results from result.summary.{conservative,likely,optimistic}', () => {
      const response: RunResponse = {
        result: {
          summary: {
            conservative: 80,
            likely: 120,
            optimistic: 160,
          },
        },
      }

      const report = toUiReport(response)

      expect(report.conservative).toBe(80)
      expect(report.mostLikely).toBe(120)
      expect(report.optimistic).toBe(160)
    })

    it('should handle results.summary fallback (intermediate format)', () => {
      const response: RunResponse = {
        results: {
          summary: {
            conservative: 90,
            likely: 130,
            optimistic: 170,
          },
        },
      }

      const report = toUiReport(response)

      expect(report.conservative).toBe(90)
      expect(report.mostLikely).toBe(130)
      expect(report.optimistic).toBe(170)
    })
  })

  describe('toUiReport - drivers extraction', () => {
    it('should extract drivers with polarity and strength', () => {
      const response: RunResponse = {
        explain_delta: {
          top_drivers: [
            {
              label: 'Factor A',
              impact: 0.8,
              kind: 'node',
              node_id: 'a',
            },
            {
              label: 'Factor B',
              impact: -0.5,
              kind: 'edge',
              edge_id: 'e1',
            },
          ],
        },
      }

      const report = toUiReport(response)

      expect(report.drivers).toHaveLength(2)

      expect(report.drivers[0]).toEqual({
        label: 'Factor A',
        polarity: 'up',
        strength: 'high',
        kind: 'node',
        node_id: 'a',
        edge_id: undefined,
      })

      expect(report.drivers[1]).toEqual({
        label: 'Factor B',
        polarity: 'down',
        strength: 'medium',
        kind: 'edge',
        node_id: undefined,
        edge_id: 'e1',
      })
    })

    it('should classify driver strength correctly', () => {
      const response: RunResponse = {
        explain_delta: {
          top_drivers: [
            { impact: 0.9 }, // high
            { impact: 0.5 }, // medium
            { impact: 0.2 }, // low
            { impact: -0.8 }, // high (negative)
            { impact: -0.4 }, // medium (negative)
            { impact: -0.1 }, // low (negative)
          ],
        },
      }

      const report = toUiReport(response)

      expect(report.drivers[0].strength).toBe('high')
      expect(report.drivers[1].strength).toBe('medium')
      expect(report.drivers[2].strength).toBe('low')
      expect(report.drivers[3].strength).toBe('high')
      expect(report.drivers[4].strength).toBe('medium')
      expect(report.drivers[5].strength).toBe('low')
    })

    it('should classify driver polarity correctly', () => {
      const response: RunResponse = {
        explain_delta: {
          top_drivers: [
            { impact: 0.5 }, // up
            { impact: -0.5 }, // down
            { impact: 0 }, // neutral
          ],
        },
      }

      const report = toUiReport(response)

      expect(report.drivers[0].polarity).toBe('up')
      expect(report.drivers[1].polarity).toBe('down')
      expect(report.drivers[2].polarity).toBe('neutral')
    })

    it('should fall back to node_id/edge_id for label', () => {
      const response: RunResponse = {
        explain_delta: {
          top_drivers: [
            { node_id: 'node-123', impact: 0.6 },
            { edge_id: 'edge-456', impact: 0.4 },
            { impact: 0.2 }, // no label at all
          ],
        },
      }

      const report = toUiReport(response)

      expect(report.drivers[0].label).toBe('node-123')
      expect(report.drivers[1].label).toBe('edge-456')
      expect(report.drivers[2].label).toBe('Unknown')
    })

    it('should return empty array when no drivers present', () => {
      const response: RunResponse = {}

      const report = toUiReport(response)

      expect(report.drivers).toEqual([])
    })
  })

  describe('toUiReport - mixed/missing data', () => {
    it('should handle completely empty response', () => {
      const response: RunResponse = {}

      const report = toUiReport(response)

      expect(report.conservative).toBeUndefined()
      expect(report.mostLikely).toBeUndefined()
      expect(report.optimistic).toBeUndefined()
      expect(report.seed).toBeUndefined()
      expect(report.hash).toBeUndefined()
      expect(report.drivers).toEqual([])
    })

    it('should handle partial results', () => {
      const response: RunResponse = {
        results: {
          most_likely: 150,
        },
      }

      const report = toUiReport(response)

      expect(report.conservative).toBeUndefined()
      expect(report.mostLikely).toBe(150)
      expect(report.optimistic).toBeUndefined()
    })

    it('should handle complete response (determinism use case)', () => {
      const response: RunResponse = {
        meta: { seed: 42 },
        model_card: {
          seed: 42,
          response_hash: 'abc123xyz',
        },
        results: {
          conservative: 100,
          most_likely: 150,
          optimistic: 200,
        },
        explain_delta: {
          top_drivers: [
            {
              label: 'Primary Driver',
              impact: 0.85,
              kind: 'node',
              node_id: 'n1',
            },
          ],
        },
        response_hash: 'abc123xyz',
      }

      const report = toUiReport(response)

      expect(report).toEqual({
        conservative: 100,
        mostLikely: 150,
        optimistic: 200,
        seed: 42,
        hash: 'abc123xyz',
        drivers: [
          {
            label: 'Primary Driver',
            polarity: 'up',
            strength: 'high',
            kind: 'node',
            node_id: 'n1',
            edge_id: undefined,
          },
        ],
      })
    })
  })
})
