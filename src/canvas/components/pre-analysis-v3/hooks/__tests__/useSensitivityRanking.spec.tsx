/**
 * useSensitivityRanking — fingerprint stamping (adversarial review finding):
 * a payload whose factor ids match is only treated as current for the exact
 * structure it was fetched/adopted for. Edge-only changes (connect, rewire)
 * must refetch — factor-id matching alone served influence computed for a
 * different topology.
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

const RESPONSE = {
  factor_influence: { f1: 1 },
  edge_influence: {},
  method: 'linear',
}

describe('useSensitivityRanking — structure stamping', () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => RESPONSE,
  }))

  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock.mockClear()
    vi.stubGlobal('fetch', fetchMock)
    useCanvasStore.setState({
      nodes: [node('g1', 'goal', 'Goal'), node('f1', 'factor', 'Factor one'), node('o1', 'option', 'Option')],
      edges: [edge('e1', 'f1', 'g1')],
      preAnalysisSensitivity: { factor_influence: { f1: 0.5 }, edge_influence: {}, method: 'linear' },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('adopts a matching store payload for the current structure without fetching', async () => {
    renderHook(() => useSensitivityRanking(true))
    await vi.advanceTimersByTimeAsync(700)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('an edge-only structural change refetches even though factor ids still match', async () => {
    const { rerender } = renderHook(() => useSensitivityRanking(true))
    await vi.advanceTimersByTimeAsync(700)
    expect(fetchMock).not.toHaveBeenCalled()

    // Same factor set, new connection — the old payload belongs to a
    // different topology and must not be treated as current.
    useCanvasStore.setState({
      edges: [edge('e1', 'f1', 'g1'), edge('e2', 'o1', 'f1')],
    })
    rerender()
    await vi.advanceTimersByTimeAsync(700)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rapid structural changes inside the debounce window coalesce into one fetch', async () => {
    const { rerender } = renderHook(() => useSensitivityRanking(true))
    await vi.advanceTimersByTimeAsync(700)

    useCanvasStore.setState({ edges: [edge('e1', 'f1', 'g1'), edge('e2', 'o1', 'f1')] })
    rerender()
    await vi.advanceTimersByTimeAsync(200) // inside the 500ms window
    useCanvasStore.setState({
      edges: [edge('e1', 'f1', 'g1'), edge('e2', 'o1', 'f1'), edge('e3', 'o1', 'g1')],
    })
    rerender()
    await vi.advanceTimersByTimeAsync(700)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
