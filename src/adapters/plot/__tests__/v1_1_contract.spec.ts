/**
 * v1.1 Contract Tests
 *
 * Tests for PLoT Engine v1.1 contract shapes:
 * - Structured confidence object (level, score, reason)
 * - Top-level explain_delta with contribution_pct
 * - Critique with severity tiers (blocker, warning, info)
 * - Provenance summary
 */

import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import {
  V1_1_SUCCESS_HIGH_CONFIDENCE,
  V1_1_LOW_CONFIDENCE,
  V1_1_BLOCKED,
  V1_1_MEDIUM_CONFIDENCE,
  getBlockers,
  isBlocked,
} from '../__fixtures__/v1_1_responses'
import { pinPlotProxyBase, PLOT_PROXY_BASE as PROXY_BASE } from '../../../../tests/setup/msw-env'

// Setup MSW server
const server = setupServer(
  // Default version handler
  http.get(`${PROXY_BASE}/version`, () => {
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

pinPlotProxyBase()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => {
  vi.unstubAllEnvs()
  server.close()
})

describe('v1.1 Contract Compliance', () => {
  // The 'Structured Confidence' and 'Top-Level explain_delta' suites are
  // DELETED with `httpV1Adapter.run`: they asserted how the RESPONSE of the
  // retired direct browser->PLoT sync run was mapped, and there is no longer
  // a run to map. The fixture-level contract below (critique tiers,
  // provenance, polarity, edge drivers) is untouched — it reads the v1.1
  // fixtures directly and never needed the adapter.

  describe('Critique Severity Tiers', () => {
    it('categorizes blockers correctly', () => {
      // Reads the fixture directly — it never needed the run handlers, and
      // the vestigial `setupRunHandlers` call went with the retired run.
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
