/**
 * useRecommendation PLoT Bearer seam — the CEE recommendation call
 * (`POST ${BFF_BASE_URL}/v1/recommend/generate`). It now fetches through
 * `plotFetch`, so the env-injected Bearer rides the real outgoing request.
 *
 * The pin renders the REAL hook and drives its `fetch()` with a runId (so it
 * reaches the network rather than the no-run-id fallback), asserting on the
 * headers that reach the stubbed global `fetch`. This is the "one recommendation
 * seam" pin; the sibling recommendation/analysis hooks share the identical
 * `fetch( → plotFetch(` migration and the repo guard pins that they all do.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRecommendation } from '../useRecommendation'
import { useCanvasStore } from '../../store'

const fetchMock = vi.fn(async () => ({
  ok: true,
  status: 200,
  json: async () => ({ recommendation: { summary: 'ok' } }),
}))

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  useCanvasStore.setState({ nodes: [], edges: [], results: null })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function headersOfFirstFetch(): Record<string, string> {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
  return (init?.headers ?? {}) as Record<string, string>
}

describe('useRecommendation PLoT Bearer seam', () => {
  it('attaches Authorization: Bearer <token> to the recommend/generate request when VITE_PLOT_BEARER is set', async () => {
    vi.stubEnv('VITE_PLOT_BEARER', 'staging-token-rec')

    // Distinct runId per test — the hook keeps a module-level response cache
    // keyed by runId, so a shared id would let the second test hit the cache
    // instead of the network.
    const { result } = renderHook(() => useRecommendation({ runId: 'run-present' }))
    await act(async () => {
      await result.current.fetch()
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/v1/recommend/generate')
    expect(headersOfFirstFetch().Authorization).toBe('Bearer staging-token-rec')
  })

  it('attaches NO Authorization header when VITE_PLOT_BEARER is unset (fail-safe)', async () => {
    const { result } = renderHook(() => useRecommendation({ runId: 'run-absent' }))
    await act(async () => {
      await result.current.fetch()
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(headersOfFirstFetch()).not.toHaveProperty('Authorization')
  })
})
