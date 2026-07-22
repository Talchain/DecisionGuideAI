/**
 * Readiness store PLoT Bearer seam — the optional env-injected Authorization
 * header must ride the graph-readiness request the store fires.
 *
 * This is the second of the two browser→PLoT seams (the other is the CEE
 * client's `fetchWithBase`). The store's outgoing request is assembled by
 * `deduplicatedFetch`; the store passes `plotAuthHeaders()` into it, so the
 * header is present only when VITE_PLOT_BEARER is set.
 *
 * The pin drives the REAL store path (`__test__.fetchReadiness`) and asserts on
 * the headers that reach the real `fetch` — not a hand-built object. Removing
 * the `plotAuthHeaders()` argument in readinessStore.ts turns the presence pin
 * red (proving this wiring is load-bearing, independently of the CEE seam).
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
      readiness_level: 'strong',
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

describe('readinessStore PLoT Bearer seam (graph-readiness fetch)', () => {
  it('attaches Authorization: Bearer <token> to the graph-readiness request when VITE_PLOT_BEARER is set', async () => {
    vi.stubEnv('VITE_PLOT_BEARER', 'staging-token-abc')

    await storeTest.fetchReadiness()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(headersOfFirstFetch().Authorization).toBe('Bearer staging-token-abc')
  })

  it('attaches NO Authorization header when VITE_PLOT_BEARER is unset (fail-safe)', async () => {
    await storeTest.fetchReadiness()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(headersOfFirstFetch()).not.toHaveProperty('Authorization')
  })
})
