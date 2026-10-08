/** Readiness carries the Supabase user's bearer, never the PLoT service credential. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { getSessionIdentity } = vi.hoisted(() => ({ getSessionIdentity: vi.fn() }))
vi.mock('../../../lib/supabase', () => ({ getSessionIdentity }))

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
import { buildTurnAuthHeaders } from '../../../v5/turnAuthHeaders'
import { __test__ as dedupTest, clearInflightCache } from '../../hooks/useGraphReadiness'

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
  getSessionIdentity.mockResolvedValue({ userId: null, accessToken: null })
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

describe('readinessStore session bearer at the same-origin seam', () => {
  it('targets the literal /bff/cee seam (live path, not a dead constant)', async () => {
    await storeTest.fetchReadiness()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(String(fetchSpy.mock.calls[0]?.[0] ?? '')).toBe('/bff/cee/graph-readiness')
  })

  it('guest sends no Authorization even when VITE_PLOT_BEARER is set', async () => {
    vi.stubEnv('VITE_PLOT_BEARER', 'staging-token-abc')

    await storeTest.fetchReadiness()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(headersOfFirstFetch()).not.toHaveProperty('Authorization')
  })

  it('guest sends exactly the existing request headers', async () => {
    await storeTest.fetchReadiness()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(headersOfFirstFetch()).toEqual({
      'Content-Type': 'application/json',
      'X-Request-ID': expect.any(String),
    })
  })

  it('signed-in readiness sends the exact Supabase bearer on the captured fetch', async () => {
    getSessionIdentity.mockResolvedValue({ userId: 'owner-a', accessToken: 'supabase-token-a' })
    vi.stubEnv('VITE_PLOT_BEARER', 'plot-service-token')

    await storeTest.fetchReadiness()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(headersOfFirstFetch()).toEqual({
      'Content-Type': 'application/json',
      'X-Request-ID': expect.any(String),
      'X-User-Id': 'owner-a',
      Authorization: 'Bearer supabase-token-a',
    })
    expect(getSessionIdentity).toHaveBeenCalledTimes(1)
  })

  it('the store rechecks the identical graph for a different identity', async () => {
    getSessionIdentity.mockResolvedValue({ userId: 'owner-a', accessToken: 'token-a' })
    fetchSpy.mockImplementation(async (_url: string, init: RequestInit) => {
      const auth = new Headers(init.headers).get('Authorization')
      return new Response(JSON.stringify({
        readiness_score: 75, readiness_level: 'ready', can_run_analysis: true,
        confidence_explanation: auth, improvements: [],
      }), { status: 200 })
    })
    await storeTest.fetchReadiness()
    getSessionIdentity.mockResolvedValue({ userId: 'owner-b', accessToken: 'token-b' })
    await storeTest.fetchReadiness()

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(useReadinessStore.getState().readiness?.confidence_explanation).toBe('Bearer token-b')
  })

  it('two identities cannot share an in-flight deduplicated response', async () => {
    const resolveFetches: Array<() => void> = []
    fetchSpy.mockImplementation((_url: string, init: RequestInit) => new Promise<Response>(resolve => {
      const auth = new Headers(init.headers).get('Authorization')
      resolveFetches.push(() => resolve(new Response(JSON.stringify({ auth }), { status: 200 })))
    }))
    const a = dedupTest.deduplicatedFetch('/bff/cee/graph-readiness', '{}', 'a',
      buildTurnAuthHeaders({ userId: 'owner-a', accessToken: 'token-a' }))
    const b = dedupTest.deduplicatedFetch('/bff/cee/graph-readiness', '{}', 'b',
      buildTurnAuthHeaders({ userId: 'owner-b', accessToken: 'token-b' }))
    resolveFetches.forEach(resolve => resolve())
    const [first, second] = await Promise.all([a.promise, b.promise])

    expect(second.data).toEqual({ auth: 'Bearer token-b' })
    expect(first.data).toEqual({ auth: 'Bearer token-a' })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(b.isReused).toBe(false)
  })

  it('the same identity still shares a deduplicated response', async () => {
    const headers = buildTurnAuthHeaders({ userId: 'owner-a', accessToken: 'token-a' })
    const a = dedupTest.deduplicatedFetch('/bff/cee/graph-readiness', '{}', 'a', headers)
    const b = dedupTest.deduplicatedFetch('/bff/cee/graph-readiness', '{}', 'b', headers)
    await Promise.all([a.promise, b.promise])

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(b.isReused).toBe(true)
    expect(b.promise).toBe(a.promise)
  })
})
