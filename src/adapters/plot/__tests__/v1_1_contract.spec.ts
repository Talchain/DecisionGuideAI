/**
 * v1.1 Contract Tests
 *
 * Tests for PLoT Engine v1.1 contract shapes:
 * - Structured confidence object (level, score, reason)
 * - Top-level explain_delta with contribution_pct
 * - Critique with severity tiers (blocker, warning, info)
 * - Provenance summary
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { httpV1Adapter } from '../httpV1Adapter'
import type { RunRequest } from '../types'
import {
  V1_1_SUCCESS_HIGH_CONFIDENCE,
  V1_1_LOW_CONFIDENCE,
  V1_1_BLOCKED,
  V1_1_MEDIUM_CONFIDENCE,
  getBlockers,
  isBlocked,
} from '../__fixtures__/v1_1_responses'

// Setup MSW server
const server = setupServer(
  // Default version handler
  http.get('/api/plot/version', () => {
    return HttpResponse.json({
      version: '1.5.0',
      build: 'test',
      capabilities: {
        detail_level: ['quick', 'standard', 'deep'],
        streaming: 'legacy',
      },
    })
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const PROXY_BASE = '/api/plot'

// Helper to setup run handlers
function setupRunHandlers(response: object) {
  server.use(
    http.get(`${PROXY_BASE}/v1/templates/test-template/graph`, () => {
      return HttpResponse.json({
        template_id: 'test-template',
        default_seed: 1337,
        graph: {
          nodes: [{ id: 'node-1', label: 'Test Node' }],
          edges: [],
        },
      })
    }),
    http.post(`${PROXY_BASE}/v1/run`, () => {
      return HttpResponse.json(response)
    })
  )
}

const runRequest: RunRequest = {
  template_id: 'test-template',
  seed: 42,
}

describe('v1.1 Contract Compliance', () => {
  describe('Structured Confidence', () => {
    it('maps high confidence correctly', async () => {
      setupRunHandlers(V1_1_SUCCESS_HIGH_CONFIDENCE)

      const result = await httpV1Adapter.run(runRequest)

      expect(result.confidence.level).toBe('high')
      expect(result.confidence.why).toContain('Strong evidence coverage')
    })

    it('maps low confidence correctly', async () => {
      setupRunHandlers(V1_1_LOW_CONFIDENCE)

      const result = await httpV1Adapter.run(runRequest)

      expect(result.confidence.level).toBe('low')
      expect(result.confidence.why).toContain('Insufficient evidence')
    })

    it('maps medium confidence correctly', async () => {
      setupRunHandlers(V1_1_MEDIUM_CONFIDENCE)

      const result = await httpV1Adapter.run(runRequest)

      expect(result.confidence.level).toBe('medium')
      expect(result.confidence.why).toContain('Reasonable evidence')
    })

    it('falls back to legacy scalar confidence', async () => {
      // Legacy format without structured confidence
      const legacyResponse = {
        result: {
          answer: 'Legacy response',
          confidence: 0.5, // Scalar, not object - maps to 'medium' (0.4-0.7)
          explanation: 'Test',
          summary: { conservative: 0.3, likely: 0.5, optimistic: 0.7 },
          response_hash: 'hash123',
          seed: 42,
        },
        execution_ms: 100,
      }
      setupRunHandlers(legacyResponse)

      const result = await httpV1Adapter.run(runRequest)

      // 0.5 maps to 'medium' level (threshold: >= 0.7 = high, >= 0.4 = medium)
      expect(result.confidence.level).toBe('medium')
    })
  })

  describe('Top-Level explain_delta', () => {
    it('reads explain_delta from top level', async () => {
      setupRunHandlers(V1_1_SUCCESS_HIGH_CONFIDENCE)

      const result = await httpV1Adapter.run(runRequest)

      expect(result.drivers).toBeDefined()
      expect(result.drivers.length).toBeGreaterThan(0)
    })

    it('extracts nodeId from top_drivers', async () => {
      setupRunHandlers(V1_1_SUCCESS_HIGH_CONFIDENCE)

      const result = await httpV1Adapter.run(runRequest)

      // First driver should have nodeId (converted from node_id)
      expect(result.drivers[0].nodeId).toBe('risk_market_saturation')
    })

    it('extracts node_kind for filtering', async () => {
      setupRunHandlers(V1_1_SUCCESS_HIGH_CONFIDENCE)

      const result = await httpV1Adapter.run(runRequest)

      // Should have risk and factor drivers (lowercase from adapter normalization)
      const riskDrivers = result.drivers.filter(
        (d: any) => d.nodeKind === 'risk'
      )
      const factorDrivers = result.drivers.filter(
        (d: any) => d.nodeKind === 'factor'
      )

      expect(riskDrivers.length).toBeGreaterThanOrEqual(1)
      expect(factorDrivers.length).toBeGreaterThanOrEqual(1)
    })

    it('extracts contribution as 0-1 scale', async () => {
      setupRunHandlers(V1_1_SUCCESS_HIGH_CONFIDENCE)

      const result = await httpV1Adapter.run(runRequest)

      // contribution_pct 45 should become 0.45
      const firstDriver = result.drivers[0]
      expect(firstDriver.contribution).toBeCloseTo(0.45, 2)
    })

    it('falls back to nested explain_delta in result', async () => {
      // Legacy format with nested explain_delta
      const legacyResponse = {
        result: {
          answer: 'Legacy response',
          confidence: 0.75,
          explanation: 'Test',
          summary: { conservative: 0.3, likely: 0.5, optimistic: 0.7 },
          explain_delta: {
            top_drivers: [
              { kind: 'node', node_id: 'legacy_node', label: 'Legacy Driver', impact: 0.5 },
            ],
          },
          response_hash: 'hash123',
          seed: 42,
        },
        execution_ms: 100,
      }
      setupRunHandlers(legacyResponse)

      const result = await httpV1Adapter.run(runRequest)

      expect(result.drivers.length).toBeGreaterThan(0)
      expect(result.drivers[0].nodeId).toBe('legacy_node')
    })
  })

  describe('Critique Severity Tiers', () => {
    it('categorizes blockers correctly', async () => {
      setupRunHandlers(V1_1_BLOCKED)

      // Use fixture helper
      const blockers = getBlockers(V1_1_BLOCKED.critique)
      expect(blockers.length).toBe(3)
    })

    it('identifies blocked analysis', async () => {
      expect(isBlocked(V1_1_BLOCKED.critique)).toBe(true)
      expect(isBlocked(V1_1_SUCCESS_HIGH_CONFIDENCE.critique)).toBe(false)
      expect(isBlocked(V1_1_LOW_CONFIDENCE.critique)).toBe(false)
    })

    it('extracts node_id from critique items', () => {
      const nodeIdItems = V1_1_BLOCKED.critique.filter(c => c.node_id)
      expect(nodeIdItems.length).toBeGreaterThan(0)
      expect(nodeIdItems[0].node_id).toBe('goal_revenue')
    })

    it('extracts suggested_fix from critique items', () => {
      const withFix = V1_1_BLOCKED.critique.filter(c => c.suggested_fix)
      expect(withFix.length).toBeGreaterThan(0)
      expect(withFix[0].suggested_fix).toContain('Normalize')
    })

    it('identifies auto_fixable items', () => {
      const autoFixable = V1_1_BLOCKED.critique.filter((c: any) => c.auto_fixable)
      expect(autoFixable.length).toBe(1)
      expect(autoFixable[0].code).toBe('PROBABILITY_SUM_INVALID')
    })
  })

  describe('Provenance Data', () => {
    it('extracts evidence_coverage', () => {
      expect(V1_1_SUCCESS_HIGH_CONFIDENCE.provenance.evidence_coverage).toBe(0.72)
      expect(V1_1_LOW_CONFIDENCE.provenance.evidence_coverage).toBe(0.40)
      expect(V1_1_BLOCKED.provenance.evidence_coverage).toBe(0.20)
    })

    it('extracts edge counts', () => {
      expect(V1_1_SUCCESS_HIGH_CONFIDENCE.provenance.total_edges).toBe(25)
      expect(V1_1_SUCCESS_HIGH_CONFIDENCE.provenance.evidenced_edges).toBe(18)
    })
  })

  describe('Polarity and Strength', () => {
    it('extracts polarity from drivers', () => {
      const drivers = V1_1_SUCCESS_HIGH_CONFIDENCE.explain_delta.top_drivers

      // First driver is a RISK with 'down' polarity
      expect(drivers[0].polarity).toBe('down')

      // Second driver is a FACTOR with 'up' polarity
      expect(drivers[1].polarity).toBe('up')
    })

    it('extracts strength from drivers', () => {
      const drivers = V1_1_SUCCESS_HIGH_CONFIDENCE.explain_delta.top_drivers

      expect(drivers[0].strength).toBe('high')
      expect(drivers[1].strength).toBe('medium')
      expect(drivers[2].strength).toBe('low')
    })
  })

  describe('Edge Drivers', () => {
    it('extracts top_edge_drivers separately', () => {
      const edgeDrivers = V1_1_SUCCESS_HIGH_CONFIDENCE.explain_delta.top_edge_drivers

      expect(edgeDrivers).toBeDefined()
      expect(edgeDrivers.length).toBe(1)
      expect(edgeDrivers[0].edge_id).toBe('risk_market_saturation->outcome_revenue')
    })
  })
})

describe('Fixture Helpers', () => {
  describe('getBlockers', () => {
    it('filters only blocker level items', () => {
      const blockers = getBlockers(V1_1_BLOCKED.critique)
      expect(blockers.every(b => b.level === 'blocker')).toBe(true)
    })

    it('returns empty array when no blockers', () => {
      const blockers = getBlockers(V1_1_SUCCESS_HIGH_CONFIDENCE.critique)
      expect(blockers).toHaveLength(0)
    })
  })

  describe('isBlocked', () => {
    it('returns true when blockers exist', () => {
      expect(isBlocked(V1_1_BLOCKED.critique)).toBe(true)
    })

    it('returns false when no blockers', () => {
      expect(isBlocked(V1_1_SUCCESS_HIGH_CONFIDENCE.critique)).toBe(false)
      expect(isBlocked(V1_1_MEDIUM_CONFIDENCE.critique)).toBe(false)
    })
  })
})
