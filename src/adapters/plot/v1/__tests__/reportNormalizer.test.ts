import { describe, it, expect } from 'vitest'
import { toUiReport } from '../reportNormalizer'
import type { RunResponse } from '../../../../types/plot'

describe('reportNormalizer', () => {
  describe('toUiReport', () => {
    it('normalizes current API format (results.{likely,conservative,optimistic})', () => {
      const input: RunResponse = {
        results: {
          conservative: 100,
          likely: 150,
          optimistic: 200,
          units: 'currency',
        },
        confidence: 0.85,
        explanation: 'High confidence estimate',
        explain_delta: {
          top_drivers: [
            {
              label: 'Market size',
              kind: 'node',
              node_id: 'n1',
              impact: 0.8,
            },
            {
              label: 'Competition',
              kind: 'edge',
              edge_id: 'e1',
              impact: -0.6,
            },
          ],
        },
        model_card: {
          seed: 42,
          response_hash: 'abc123',
        },
      }

      const result = toUiReport(input)

      expect(result).toEqual({
        conservative: 100,
        mostLikely: 150,
        optimistic: 200,
        units: 'currency',
        confidence: 0.85,
        explanation: 'High confidence estimate',
        drivers: [
          {
            label: 'Market size',
            kind: 'node',
            node_id: 'n1',
            polarity: 'up',
            strength: 'high',
            edge_id: undefined,
          },
          {
            label: 'Competition',
            kind: 'edge',
            edge_id: 'e1',
            polarity: 'down',
            strength: 'medium',
            node_id: undefined,
          },
        ],
        seed: 42,
        hash: 'abc123',
      })
    })

    it('normalizes v1 API format (results.most_likely)', () => {
      const input: RunResponse = {
        results: {
          conservative: 80,
          most_likely: 120,
          optimistic: 160,
          units: 'percent',
        },
        model_card: {
          seed: 1337,
          response_hash: 'xyz789',
        },
      }

      const result = toUiReport(input)

      expect(result.mostLikely).toBe(120)
      expect(result.conservative).toBe(80)
      expect(result.optimistic).toBe(160)
    })

    it('normalizes nested summary format (results.summary.likely)', () => {
      const input: RunResponse = {
        results: {
          summary: {
            conservative: 50,
            likely: 75,
            optimistic: 100,
            units: 'count',
          },
        },
      }

      const result = toUiReport(input)

      expect(result.mostLikely).toBe(75)
      expect(result.conservative).toBe(50)
      expect(result.optimistic).toBe(100)
      expect(result.units).toBe('count')
    })

    it('normalizes older format (result.summary)', () => {
      const input: RunResponse = {
        result: {
          summary: {
            conservative: 30,
            likely: 50,
            optimistic: 70,
            units: 'units',
          },
        },
      }

      const result = toUiReport(input)

      expect(result.mostLikely).toBe(50)
      expect(result.conservative).toBe(30)
      expect(result.optimistic).toBe(70)
    })

    it('extracts seed from multiple locations (meta.seed preferred)', () => {
      const input: RunResponse = {
        meta: {
          seed: 999,
        },
        model_card: {
          seed: 111,
          response_hash: 'hash',
        },
        results: {},
      }

      const result = toUiReport(input)

      expect(result.seed).toBe(999)
    })

    it('extracts seed from model_card when meta is missing', () => {
      const input: RunResponse = {
        model_card: {
          seed: 222,
          response_hash: 'hash',
        },
        results: {},
      }

      const result = toUiReport(input)

      expect(result.seed).toBe(222)
    })

    it('extracts hash from multiple locations (model_card.response_hash preferred)', () => {
      const input: RunResponse = {
        model_card: {
          response_hash: 'preferred-hash',
        },
        response_hash: 'fallback-hash',
        results: {},
      }

      const result = toUiReport(input)

      expect(result.hash).toBe('preferred-hash')
    })

    it('extracts hash from top-level when model_card is missing', () => {
      const input: RunResponse = {
        response_hash: 'top-level-hash',
        results: {},
      }

      const result = toUiReport(input)

      expect(result.hash).toBe('top-level-hash')
    })

    it('maps driver impact to polarity (up/down/neutral)', () => {
      const input: RunResponse = {
        explain_delta: {
          top_drivers: [
            { label: 'Positive', impact: 0.5 },
            { label: 'Negative', impact: -0.3 },
            { label: 'Neutral', impact: 0 },
          ],
        },
        results: {},
      }

      const result = toUiReport(input)

      expect(result.drivers[0].polarity).toBe('up')
      expect(result.drivers[1].polarity).toBe('down')
      expect(result.drivers[2].polarity).toBe('neutral')
    })

    it('maps driver impact to strength (high/medium/low)', () => {
      const input: RunResponse = {
        explain_delta: {
          top_drivers: [
            { label: 'High', impact: 0.9 },
            { label: 'Medium', impact: 0.5 },
            { label: 'Low', impact: 0.1 },
            { label: 'High Negative', impact: -0.8 },
            { label: 'Medium Negative', impact: -0.4 },
            { label: 'Low Negative', impact: -0.2 },
          ],
        },
        results: {},
      }

      const result = toUiReport(input)

      expect(result.drivers[0].strength).toBe('high') // 0.9 > 0.7
      expect(result.drivers[1].strength).toBe('medium') // 0.5 > 0.3
      expect(result.drivers[2].strength).toBe('low') // 0.1 <= 0.3
      expect(result.drivers[3].strength).toBe('high') // |−0.8| > 0.7
      expect(result.drivers[4].strength).toBe('medium') // |−0.4| > 0.3
      expect(result.drivers[5].strength).toBe('low') // |−0.2| <= 0.3
    })

    it('uses fallback labels for drivers (node_id, edge_id, or "Unknown")', () => {
      const input: RunResponse = {
        explain_delta: {
          top_drivers: [
            { node_id: 'n1', impact: 0.5 }, // No label, use node_id
            { edge_id: 'e1', impact: 0.5 }, // No label, use edge_id
            { impact: 0.5 }, // No label, node_id, or edge_id
          ],
        },
        results: {},
      }

      const result = toUiReport(input)

      expect(result.drivers[0].label).toBe('n1')
      expect(result.drivers[1].label).toBe('e1')
      expect(result.drivers[2].label).toBe('Unknown')
    })

    it('prefers label over node_id/edge_id when present', () => {
      const input: RunResponse = {
        explain_delta: {
          top_drivers: [
            { label: 'Preferred Label', node_id: 'n1', edge_id: 'e1', impact: 0.5 },
          ],
        },
        results: {},
      }

      const result = toUiReport(input)

      expect(result.drivers[0].label).toBe('Preferred Label')
    })

    it('preserves driver metadata (kind, node_id, edge_id)', () => {
      const input: RunResponse = {
        explain_delta: {
          top_drivers: [
            {
              label: 'Node Driver',
              kind: 'node',
              node_id: 'n1',
              impact: 0.5,
            },
            {
              label: 'Edge Driver',
              kind: 'edge',
              edge_id: 'e1',
              impact: 0.5,
            },
          ],
        },
        results: {},
      }

      const result = toUiReport(input)

      expect(result.drivers[0]).toEqual({
        label: 'Node Driver',
        kind: 'node',
        node_id: 'n1',
        edge_id: undefined,
        polarity: 'up',
        strength: 'medium',
      })

      expect(result.drivers[1]).toEqual({
        label: 'Edge Driver',
        kind: 'edge',
        edge_id: 'e1',
        node_id: undefined,
        polarity: 'up',
        strength: 'medium',
      })
    })

    it('returns empty drivers array when explain_delta is missing', () => {
      const input: RunResponse = {
        results: {},
      }

      const result = toUiReport(input)

      expect(result.drivers).toEqual([])
    })

    it('handles missing optional fields gracefully', () => {
      const input: RunResponse = {
        results: {},
      }

      const result = toUiReport(input)

      expect(result.conservative).toBeUndefined()
      expect(result.mostLikely).toBeUndefined()
      expect(result.optimistic).toBeUndefined()
      expect(result.units).toBeUndefined()
      expect(result.confidence).toBeUndefined()
      expect(result.explanation).toBeUndefined()
      expect(result.seed).toBeUndefined()
      expect(result.hash).toBeUndefined()
      expect(result.drivers).toEqual([])
    })

    it('handles empty response gracefully', () => {
      const input: RunResponse = {}

      const result = toUiReport(input)

      expect(result).toEqual({
        conservative: undefined,
        mostLikely: undefined,
        optimistic: undefined,
        units: undefined,
        confidence: undefined,
        explanation: undefined,
        drivers: [],
        seed: undefined,
        hash: undefined,
      })
    })

    it('prefers results.likely over results.most_likely when both present', () => {
      const input: RunResponse = {
        results: {
          likely: 100,
          most_likely: 200,
          conservative: 50,
          optimistic: 150,
        },
      }

      const result = toUiReport(input)

      // most_likely is checked first, so it takes precedence
      expect(result.mostLikely).toBe(200)
    })

    it('uses results.likely when most_likely is missing', () => {
      const input: RunResponse = {
        results: {
          likely: 100,
          conservative: 50,
          optimistic: 150,
        },
      }

      const result = toUiReport(input)

      expect(result.mostLikely).toBe(100)
    })

    // Edge cases for 100% branch coverage
    it('extracts units from results.summary.units when results.units is missing', () => {
      const input: RunResponse = {
        results: {
          summary: {
            units: 'from-summary',
            likely: 100,
          },
        },
      }

      const result = toUiReport(input)

      expect(result.units).toBe('from-summary')
    })

    it('handles driver with missing impact field (defaults to 0)', () => {
      const input: RunResponse = {
        explain_delta: {
          top_drivers: [
            { label: 'No Impact', node_id: 'n1' },
          ],
        },
        results: {},
      }

      const result = toUiReport(input)

      expect(result.drivers[0].polarity).toBe('neutral') // 0 impact
      expect(result.drivers[0].strength).toBe('low') // 0 <= 0.3
    })

    it('classifies strength at exact boundary values', () => {
      const input: RunResponse = {
        explain_delta: {
          top_drivers: [
            { label: 'Exactly 0.7', impact: 0.7 }, // Should be medium (not > 0.7, but > 0.3)
            { label: 'Just above 0.7', impact: 0.71 }, // Should be high
            { label: 'Exactly 0.3', impact: 0.3 }, // Should be low (not > 0.3)
            { label: 'Just above 0.3', impact: 0.31 }, // Should be medium
            { label: 'Negative 0.7', impact: -0.7 }, // |−0.7| = 0.7, medium
            { label: 'Negative 0.71', impact: -0.71 }, // |−0.71| = 0.71, high
          ],
        },
        results: {},
      }

      const result = toUiReport(input)

      expect(result.drivers[0].strength).toBe('medium') // 0.7 not > 0.7, but > 0.3
      expect(result.drivers[1].strength).toBe('high') // 0.71 > 0.7
      expect(result.drivers[2].strength).toBe('low') // 0.3 not > 0.3
      expect(result.drivers[3].strength).toBe('medium') // 0.31 > 0.3
      expect(result.drivers[4].strength).toBe('medium') // |-0.7| not > 0.7, but > 0.3
      expect(result.drivers[5].strength).toBe('high') // |-0.71| > 0.7
    })

    it('handles driver with only edge_id (no node_id)', () => {
      const input: RunResponse = {
        explain_delta: {
          top_drivers: [
            { edge_id: 'e999', impact: 0.5 },
          ],
        },
        results: {},
      }

      const result = toUiReport(input)

      expect(result.drivers[0].label).toBe('e999')
      expect(result.drivers[0].node_id).toBeUndefined()
      expect(result.drivers[0].edge_id).toBe('e999')
    })

    it('extracts confidence field from response', () => {
      const input: RunResponse = {
        confidence: 0.92,
        results: {},
      }

      const result = toUiReport(input)

      expect(result.confidence).toBe(0.92)
    })

    it('extracts explanation field from response', () => {
      const input: RunResponse = {
        explanation: 'Detailed explanation of the analysis',
        results: {},
      }

      const result = toUiReport(input)

      expect(result.explanation).toBe('Detailed explanation of the analysis')
    })
  })
})
