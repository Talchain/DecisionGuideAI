/**
 * useSensitivityRanking PLoT Bearer seam — the pre-analysis-sensitivity call
 * that the capture flagged as MISSING the Bearer (readiness had it; this seam
 * did not). It now fetches through `plotFetch`, so the env-injected Bearer rides
 * the real `POST ${plotProxyBase}/v1/pre-analysis-sensitivity` request.
 *
 * The pin renders the REAL hook (mirroring useSensitivityRanking.spec.tsx) with
 * a graph that has no matching cached payload, so the debounced effect fetches,
 * and asserts on the headers that reach the stubbed global `fetch`.
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

describe('useSensitivityRanking PLoT Bearer seam', () => {
  it('attaches Authorization: Bearer <token> to the sensitivity request when VITE_PLOT_BEARER is set', async () => {
    vi.stubEnv('VITE_PLOT_BEARER', 'staging-token-sens')

    renderHook(() => useSensitivityRanking(true))
    await vi.advanceTimersByTimeAsync(1000)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(headersOfFirstFetch().Authorization).toBe('Bearer staging-token-sens')
  })

  it('attaches NO Authorization header when VITE_PLOT_BEARER is unset (fail-safe)', async () => {
    renderHook(() => useSensitivityRanking(true))
    await vi.advanceTimersByTimeAsync(1000)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(headersOfFirstFetch()).not.toHaveProperty('Authorization')
  })
})
