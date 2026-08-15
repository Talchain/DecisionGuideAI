/**
 * useServerGraphHydration — the hook's own guarantees (adversarial review A2/A6).
 *
 * Every claim pinned here was COMMENT-ONLY before: the once-per-scenario guard,
 * the abort on dependency change, and the StrictMode double-mount fix. A
 * docstring is not a test.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StrictMode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useServerGraphHydration } from '../useServerGraphHydration'
import * as hydration from '../../hydrate/serverGraphHydration'
import { useDraftStore } from '../../stores/draftStore'
import { useCanvasStore } from '../../store'
import { applyDraftResult } from '../../utils/applyDraftResult'
import {
  __resetEdgeStrengthCoordinatorForTests,
  edgeStrengthRunBarrierState,
  setOpenEdgeStrengthScenario,
} from '../../edge-strength/edgeStrengthCoordinator'

const A = '11111111-2222-4333-8444-555555555555'
const B = '22222222-3333-4444-8555-666666666666'

let user: { id: string } | null = { id: 'guest' }
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user }),
}))

/**
 * Typed through a factory rather than `ReturnType<typeof vi.spyOn>`, which
 * widens to `MockInstance<unknown[], unknown>` and does not accept the real
 * spy — the typecheck gate caught that as a genuine new error.
 */
function spyOnHydrate() {
  return vi.spyOn(hydration, 'hydrateCanvasFromServer').mockResolvedValue('merged')
}

let spy: ReturnType<typeof spyOnHydrate>

beforeEach(() => {
  user = { id: 'guest' }
  useDraftStore.setState({ fullDraftAppliedAt: null })
  spy = spyOnHydrate()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  __resetEdgeStrengthCoordinatorForTests()
  useCanvasStore.setState({ currentScenarioId: null } as never)
})

describe('useServerGraphHydration — once per scenario', () => {
  it('hydrates once for a scenario id and not again on re-render', async () => {
    const { rerender } = renderHook(({ id }) => useServerGraphHydration(id), {
      initialProps: { id: A },
    })
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    rerender({ id: A })
    rerender({ id: A })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('hydrates AGAIN when the scenario id changes', async () => {
    const { rerender } = renderHook(({ id }) => useServerGraphHydration(id), {
      initialProps: { id: A },
    })
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    rerender({ id: B })
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
    expect(spy.mock.calls[1][0]).toBe(B)
  })

  it('makes NO call without a scenario id', () => {
    renderHook(() => useServerGraphHydration(null))
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('useServerGraphHydration — cancellation', () => {
  it('ABORTS the in-flight read when the scenario id changes', async () => {
    const { rerender } = renderHook(({ id }) => useServerGraphHydration(id), {
      initialProps: { id: A },
    })
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    const firstSignal = (spy.mock.calls[0][1] as any).signal as AbortSignal
    expect(firstSignal.aborted).toBe(false)

    rerender({ id: B })
    expect(firstSignal.aborted).toBe(true)
  })

  it('aborts on unmount', async () => {
    const { unmount } = renderHook(() => useServerGraphHydration(A))
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    const signal = (spy.mock.calls[0][1] as any).signal as AbortSignal
    unmount()
    expect(signal.aborted).toBe(true)
  })
})

describe('useServerGraphHydration — StrictMode (A6)', () => {
  /**
   * The defect this pins: the ref was marked "attempted" BEFORE the async call,
   * so StrictMode's dev double-mount aborted the first attempt and the second
   * effect early-returned on that same ref. Hydration therefore NEVER ran in
   * development, while production was fine — so a manual dev check would have
   * observed "no hydration" and drawn exactly the wrong conclusion about
   * shipped code.
   */
  it('still hydrates under StrictMode double-mount', async () => {
    renderHook(() => useServerGraphHydration(A), { wrapper: StrictMode })
    await waitFor(() => expect(spy).toHaveBeenCalled())
    // The surviving mount's read must not be an aborted one.
    const live = spy.mock.calls.some(
      (c) => !((c[1] as any).signal as AbortSignal).aborted,
    )
    expect(live).toBe(true)
  })
})

describe('useServerGraphHydration — identity', () => {
  it('passes the auth user id through', async () => {
    user = { id: 'user-42' }
    renderHook(() => useServerGraphHydration(A))
    await waitFor(() => expect(spy).toHaveBeenCalled())
    expect((spy.mock.calls[0][1] as any).userId).toBe('user-42')
  })

  it('retries the same scenario after a guest becomes authenticated', async () => {
    user = null
    const { rerender } = renderHook(({ tick }) => {
      void tick
      useServerGraphHydration(A)
    }, { initialProps: { tick: 0 } })
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    expect((spy.mock.calls[0][1] as any).userId).toBeNull()

    user = { id: 'user-42' }
    rerender({ tick: 1 })
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
    expect((spy.mock.calls[1][1] as any).userId).toBe('user-42')
  })
})

describe('useServerGraphHydration — absent-before-first-draft race', () => {
  it('keeps Run held until the one post-draft strict read reconciles server authority', async () => {
    spy.mockRestore()
    __resetEdgeStrengthCoordinatorForTests()
    setOpenEdgeStrengthScenario(A)
    useCanvasStore.setState({
      currentScenarioId: A,
      nodes: [],
      edges: [],
      lastAuthoritativeGraph: null,
      serverGraphIdentity: null,
      history: { past: [], future: [] },
    } as never)

    let resolveAuthority!: (response: Response) => void
    const jsonResponse = (status: number, body: unknown): Response => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response)
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, {
        schema: 'scenario_graph.v1',
        scenario_id: A,
        graph: null,
        graph_present: false,
        brief_text: null,
        graph_identity_hash: null,
        layout_present: false,
        request_id: 'req-absent',
      }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => {
        resolveAuthority = resolve
      }))
    vi.stubGlobal('fetch', fetch)

    renderHook(() => useServerGraphHydration(A))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    expect(edgeStrengthRunBarrierState(A).ok).toBe(false)

    act(() => {
      applyDraftResult({
        nodes: [
          { id: 'factor-1', kind: 'factor', label: 'Spend', value: 100 },
          { id: 'goal-1', kind: 'goal', label: 'Profit', value: 5 },
        ],
        edges: [],
      } as never)
      useDraftStore.getState().setFullDraftAppliedAt(400)
    })
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(edgeStrengthRunBarrierState(A).ok).toBe(false)
    expect((useCanvasStore.getState().nodes.find((node) => node.id === 'factor-1')?.data as any)?.value).toBe(100)

    resolveAuthority(jsonResponse(200, {
      schema: 'scenario_graph.v1',
      scenario_id: A,
      graph: {
        nodes: [
          { id: 'factor-1', kind: 'factor', label: 'Spend', value: 250 },
          { id: 'goal-1', kind: 'goal', label: 'Profit', value: 9 },
        ],
        edges: [],
      },
      graph_present: true,
      brief_text: null,
      graph_identity_hash: {
        kind: 'graph_identity_hash',
        value: 'a'.repeat(64),
        algorithm: 'sha256',
        projection_version: 'identity.v1',
        graph_schema_version: 'graph_v3',
        normaliser_version: '1',
      },
      layout_present: false,
      request_id: 'req-authority',
    }))

    await waitFor(() => {
      expect((useCanvasStore.getState().nodes.find((node) => node.id === 'factor-1')?.data as any)?.value).toBe(250)
      expect(edgeStrengthRunBarrierState(A)).toEqual({ ok: true })
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('performs exactly one strict authority read after the first committed draft', async () => {
    let resolvePostDraft!: (outcome: hydration.HydrationOutcome) => void
    spy
      .mockResolvedValueOnce('absent')
      .mockImplementationOnce(() => new Promise((resolve) => { resolvePostDraft = resolve }))

    renderHook(() => useServerGraphHydration(A))
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))

    act(() => useDraftStore.getState().setFullDraftAppliedAt(100))
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
    expect(spy.mock.calls[1][0]).toBe(A)
    expect(spy.mock.calls[1][1]).toMatchObject({
      userId: 'guest',
      signal: expect.any(AbortSignal),
    })
    expect((spy.mock.calls[1][1] as any).replaceLocalGraph).toBeUndefined()

    // A later marker cannot abort/restart the one authoritative read.
    act(() => useDraftStore.getState().setFullDraftAppliedAt(101))
    expect(spy).toHaveBeenCalledTimes(2)

    resolvePostDraft('merged')
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
  })

  it.each(['notReadable', 'unavailable', 'refused', 'unusable'] as const)(
    'does not turn an initial %s hold into a post-draft retry loop',
    async (outcome) => {
      spy.mockResolvedValueOnce(outcome)
      renderHook(() => useServerGraphHydration(A))
      await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))

      act(() => useDraftStore.getState().setFullDraftAppliedAt(200))
      await Promise.resolve()
      expect(spy).toHaveBeenCalledTimes(1)
    },
  )

  it('consumes the entitlement even when the post-draft strict read is still absent', async () => {
    spy.mockResolvedValueOnce('absent').mockResolvedValueOnce('absent')
    renderHook(() => useServerGraphHydration(A))
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))

    act(() => useDraftStore.getState().setFullDraftAppliedAt(300))
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
    act(() => useDraftStore.getState().setFullDraftAppliedAt(301))
    await Promise.resolve()
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('does not carry an absent retry entitlement across a scenario switch', async () => {
    spy.mockResolvedValueOnce('absent').mockResolvedValueOnce('merged')
    const { rerender } = renderHook(({ id }) => useServerGraphHydration(id), {
      initialProps: { id: A },
    })
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))

    rerender({ id: B })
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
    act(() => useDraftStore.getState().setFullDraftAppliedAt(500))
    await Promise.resolve()
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
