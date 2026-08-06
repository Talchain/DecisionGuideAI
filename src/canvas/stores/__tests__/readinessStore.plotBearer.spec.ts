/**
 * Readiness store seam — ⚠ PREMISE FLIPPED BY ROADMAP 2.710, deliberately.
 *
 * This spec used to pin the OPPOSITE: that `plotAuthHeaders()` rode the
 * graph-readiness request, because the deployed base was PLoT's
 * bearer-authenticated origin (the env-resolved `VITE_CEE_BFF_BASE`). 2.710
 * re-bound the store to the same-origin `/bff/cee` edge seam, which injects
 * `X-Olumi-Assist-Key` SERVER-side — so the browser request is now
 * credential-less BY DESIGN, and the old presence pin became a leak pin:
 *
 *  1. the request targets the literal same-origin seam (URL pin, live path);
 *  2. NO Authorization header rides it — even when VITE_PLOT_BEARER is set.
 *     The bearer is a PLoT credential; attaching it to a CEE-bound
 *     same-origin call would ship it to a service that must never see it.
 *
 * Drives the REAL store path (`__test__.fetchReadiness`) and asserts on what
 * reaches the real `fetch`, exactly as the old spec did — removing the `{}`
 * headers argument in readinessStore.ts and restoring `plotAuthHeaders()`
 * turns pin 2 red.
 *
 * The canvas store is mocked to supply a one-node graph so `fetchReadiness`
 * proceeds to the network (it early-returns without fetching on an empty graph).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../store', () => ({
  useCanvasStore: {
    getState: () => ({
      nodes: [{ id: 'n1', type: 'factor', data: { label: 'A' } }],
      edges: [],
      graphHealth: null,
      ceeAnalysisReady: null,
      currentBriefText: null,
    }),
  },
}))

import { __test__ as storeTest, useReadinessStore } from '../readinessStore'
import { clearInflightCache } from '../../hooks/useGraphReadiness'

function okReadiness() {
  return new Response(
    JSON.stringify({
      readiness_score: 75,
      readiness_level: 'ready', // ROADMAP 2.635 — was 'strong', the local heuristic's spelling of the top band; that heuristic is deleted and the level with it. `ready` is the producer's own top band at this score.
      can_run_analysis: true,
      confidence_explanation: 'Good',
      improvements: [],
    }),
    { status: 200 },
  )
}

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  storeTest.resetModuleState()
  clearInflightCache()
  fetchSpy = vi.fn().mockImplementation(() => Promise.resolve(okReadiness()))
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  storeTest.resetModuleState()
  clearInflightCache()
  useReadinessStore.setState({ readiness: null, loading: false, error: null })
})

function headersOfFirstFetch(): Record<string, string> {
  const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined
  return (init?.headers ?? {}) as Record<string, string>
}

describe('readinessStore same-origin seam (2.710)', () => {
  it('targets the literal /bff/cee seam (live path, not a dead constant)', async () => {
    await storeTest.fetchReadiness()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(String(fetchSpy.mock.calls[0]?.[0] ?? '')).toBe('/bff/cee/graph-readiness')
  })

  it('LEAK PIN: no Authorization header rides the request even when VITE_PLOT_BEARER is set', async () => {
    vi.stubEnv('VITE_PLOT_BEARER', 'staging-token-abc')

    await storeTest.fetchReadiness()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(headersOfFirstFetch()).not.toHaveProperty('Authorization')
  })

  it('and none when it is unset either (credential-less by design; the edge injects the key)', async () => {
    await storeTest.fetchReadiness()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(headersOfFirstFetch()).not.toHaveProperty('Authorization')
  })
})
