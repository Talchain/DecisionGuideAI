/**
 * useSensitivityRanking PLoT credential seam — now an ABSENCE pin.
 *
 * ⚠ THIS SPEC USED TO ASSERT THE OPPOSITE, AND IT WAS RIGHT TO AT THE TIME. It
 * pinned that `POST ${plotProxyBase}/v1/pre-analysis-sensitivity` carried
 * `Authorization: Bearer ${VITE_PLOT_BEARER}` — a seam an earlier capture had
 * flagged as missing the header.
 *
 * That guarantee is now a DEFECT. Vite replaces `import.meta.env.VITE_X` with the
 * literal at build time, so shipping the header meant shipping the credential: the
 * deployed asset `/assets/plotAuthHeaders-*.js` was, in its entirety,
 *
 *     function c(){const c="<64-char secret>";return{Authorization:`Bearer ${c}`}}
 *
 * — a live shared server-to-server credential readable by any visitor. The
 * credential now lives server-side in `netlify/edge-functions/plot-proxy.ts`, which
 * injects it on the same-origin `/bff/engine/*` path this hook already calls.
 *
 * WHY THE STUB IS THE LOAD-BEARING PART. "No Authorization when the env var is
 * unset" is a VACUOUS test — it passes trivially, and passed for the whole period
 * the credential was shipping. The pin that matters is the first one: the header is
 * absent EVEN WHEN `VITE_PLOT_BEARER` IS STUBBED PRESENT. That is the only version
 * that would go red if someone reintroduced the read.
 *
 * The pin renders the REAL hook (mirroring useSensitivityRanking.spec.tsx) with a
 * graph that has no matching cached payload, so the debounced effect fetches, and
 * asserts on the headers that reach the stubbed global `fetch`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { useSensitivityRanking } from '../useSensitivityRanking'
import { useCanvasStore } from '../../../../store'

function node(id: string, kind: string, label: string): Node {
  return { id, type: kind, position: { x: 0, y: 0 }, data: { kind, label } } as Node
}

type StoreEdge = Parameters<typeof useCanvasStore.setState>[0] extends infer S
  ? S extends { edges?: Array<infer E> | undefined }
    ? E
    : never
  : never

function edge(id: string, source: string, target: string): StoreEdge {
  return { id, source, target, data: { weight: 1, direction: 'positive' } } as StoreEdge
}

const fetchMock = vi.fn(async () => ({
  ok: true,
  status: 200,
  json: async () => ({ factor_influence: { f1: 1 }, edge_influence: {}, method: 'linear' }),
}))

beforeEach(() => {
  vi.useFakeTimers()
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  // No preAnalysisSensitivity → the hook cannot adopt a cached payload and must
  // fetch for this structure.
  useCanvasStore.setState({
    nodes: [node('g1', 'goal', 'Goal'), node('f1', 'factor', 'Factor one'), node('o1', 'option', 'Option')],
    edges: [edge('e1', 'f1', 'g1')],
    preAnalysisSensitivity: undefined,
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function headersOfFirstFetch(): Record<string, string> {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
  return (init?.headers ?? {}) as Record<string, string>
}

/** Obviously synthetic — never a real or realistic-looking credential. */
const SYNTHETIC_BEARER = 'a-provisioned-looking-token'

describe('useSensitivityRanking PLoT credential seam', () => {
  it('CONTROL (trap 13): the stub IS visible to this module, so the absence below is not vacuous', () => {
    vi.stubEnv('VITE_PLOT_BEARER', SYNTHETIC_BEARER)
    // If this ever stops holding, the assertions below would pass because the
    // fixture died rather than because the credential is gone — the failure mode
    // that makes an absence pin worthless.
    expect(import.meta.env.VITE_PLOT_BEARER).toBe(SYNTHETIC_BEARER)
  })

  it('sends NO Authorization header EVEN WHEN VITE_PLOT_BEARER is provisioned', async () => {
    vi.stubEnv('VITE_PLOT_BEARER', SYNTHETIC_BEARER)

    renderHook(() => useSensitivityRanking(true))
    await vi.advanceTimersByTimeAsync(1000)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(headersOfFirstFetch()).not.toHaveProperty('Authorization')
    // Bind by identity: prove the header object reached the spy POPULATED, so the
    // absence is the code's doing and not an empty-init artefact.
    expect(headersOfFirstFetch()['Content-Type']).toBe('application/json')
  })

  it('and none when it is unset either', async () => {
    renderHook(() => useSensitivityRanking(true))
    await vi.advanceTimersByTimeAsync(1000)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(headersOfFirstFetch()).not.toHaveProperty('Authorization')
  })

  it('still targets the same-origin proxy path, where the credential is injected', async () => {
    vi.stubEnv('VITE_PLOT_BEARER', SYNTHETIC_BEARER)

    renderHook(() => useSensitivityRanking(true))
    await vi.advanceTimersByTimeAsync(1000)

    const url = String(fetchMock.mock.calls[0]?.[0])
    expect(url).toBe('/bff/engine/v1/pre-analysis-sensitivity')
  })
})
