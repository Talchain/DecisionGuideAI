/**
 * End-to-end proof that the three layout-lifecycle hooks chain correctly.
 *
 * Imports the real production hooks — no simulation:
 *   - useInitialLayoutGuard           (src/canvas/hooks/useInitialLayoutGuard.ts)
 *   - useMeasureThenLayout            (src/canvas/hooks/useMeasureThenLayout.ts)
 *   - useFitViewOnLayoutVersion       (src/canvas/hooks/useFitViewOnLayoutVersion.ts)
 *
 * `@xyflow/react` is mocked because React Flow's hooks require a Provider
 * (mounting a real one would also load the canvas, ELK, etc., which is
 * out of scope for a lifecycle test). The mock surfaces:
 *   - useNodesInitialized → returns mockNodesInitialized
 *   - useStore            → exposes a controllable nodeLookup
 *   - useReactFlow        → returns { fitView: spy, ... }
 *
 * `applyLayout` is mocked at the canvas store to commit spread positions
 * synchronously and bump layoutVersion. The real applyLayout dynamically
 * imports ELK; this suite is about lifecycle wiring, not ELK output.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { useInitialLayoutGuard } from '../hooks/useInitialLayoutGuard'
import { useMeasureThenLayout } from '../hooks/useMeasureThenLayout'
import { useFitViewOnLayoutVersion } from '../hooks/useFitViewOnLayoutVersion'

let mockNodesInitialized = true
let mockNodeLookup = new Map<string, { measured?: { width?: number; height?: number } }>()
const fitViewSpy = vi.fn()

// Panel-aware fit padding is mocked to a sentinel here; its correctness is
// covered by computeFitPadding.spec.ts. This suite locks the fitView cadence
// and duration, not the padding maths.
const FIT_PADDING = { top: '10px', right: '20px', bottom: '10px', left: '20px' }

vi.mock('@xyflow/react', () => ({
  useNodesInitialized: () => mockNodesInitialized,
  useStore: <T,>(selector: (s: { nodeLookup: typeof mockNodeLookup }) => T) =>
    selector({ nodeLookup: mockNodeLookup }),
  useReactFlow: () => ({
    fitView: fitViewSpy,
  }),
}))

vi.mock('../utils/computeFitPadding', () => ({
  computeFitPadding: () => FIT_PADDING,
}))

// `handleLayoutWithRecovery` (used by useMeasureThenLayout) writes to a
// progress store and triggers retries. For pure lifecycle wiring we want
// to invoke applyLayout directly without that machinery.
vi.mock('../layout/handleLayoutWithRecovery', () => ({
  handleLayoutWithRecovery: (fn: () => Promise<void> | void) => fn(),
}))

function useLayoutLifecycle(): void {
  useInitialLayoutGuard()
  useMeasureThenLayout()
  useFitViewOnLayoutVersion()
}

function buildMeasuredNodes(ids: string[], at: { x: number; y: number }): Node[] {
  return ids.map(
    (id) =>
      ({
        id,
        type: 'factor',
        position: { x: at.x, y: at.y },
        data: { label: id },
      } as Node),
  )
}

function buildSpreadNodes(ids: string[]): Node[] {
  return ids.map(
    (id, i) =>
      ({
        id,
        type: 'factor',
        position: { x: i * 320, y: 0 },
        data: { label: id },
      } as Node),
  )
}

function seedMeasuredLookup(ids: string[]) {
  mockNodeLookup = new Map(
    ids.map((id) => [id, { measured: { width: 200, height: 100 } }]),
  )
}

function mockApplyLayoutWithSpread() {
  return vi
    .spyOn(useCanvasStore.getState(), 'applyLayout')
    .mockImplementation(async () => {
      // Mirror layoutGraph's preserveLocked behaviour: rewrite unlocked
      // nodes onto a horizontal row, leave locked nodes at their
      // persisted positions.
      const current = useCanvasStore.getState().nodes
      let i = 0
      const laidOut = current.map((n) => {
        const data = n.data as Record<string, unknown> | undefined
        if (data?.locked === true) return n
        const next = { ...n, position: { x: i * 320, y: 0 } }
        i += 1
        return next
      })
      useCanvasStore.setState({
        nodes: laidOut as never,
        pendingLayout: false,
        layoutInProgress: false,
        layoutVersion: useCanvasStore.getState().layoutVersion + 1,
      } as never)
    })
}

async function flushPipeline() {
  // Promise microtasks (applyLayout is async) + the RAF callback that
  // useFitViewOnLayoutVersion schedules.
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    vi.runAllTimers()
  })
}

describe('Layout lifecycle — guard ↔ measurement ↔ applyLayout ↔ fitView (end-to-end)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useCanvasStore.getState().resetCanvas()
    // resetCanvas does not reset the layout lifecycle counters — they
    // are session-scoped. Reset them so a previous test's bump doesn't
    // fire fitView on mount.
    useCanvasStore.setState({
      pendingLayout: false,
      layoutInProgress: false,
      layoutVersion: 0,
      layoutRequestId: 0,
    } as never)
    mockNodesInitialized = true
    mockNodeLookup = new Map()
    fitViewSpy.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('stacked existing scenario → final positions are spread and fitView fires once with the production contract (acceptance #1 + #6)', async () => {
    const applySpy = mockApplyLayoutWithSpread()

    const ids = ['a', 'b', 'c']
    seedMeasuredLookup(ids)
    act(() => {
      useCanvasStore.setState({
        nodes: buildMeasuredNodes(ids, { x: 0, y: 0 }) as never,
        edges: [] as never,
        currentScenarioId: 'scA',
        pendingLayout: false,
        layoutInProgress: false,
      } as never)
    })

    renderHook(() => useLayoutLifecycle())
    await flushPipeline()

    // Whole chain ran exactly once.
    expect(applySpy).toHaveBeenCalledTimes(1)
    expect(applySpy.mock.calls[0][0]).toMatchObject({ skipHistory: true })

    // Final positions are no longer stacked.
    const final = useCanvasStore.getState().nodes
    const xs = final.map((n) => (n.position as { x: number }).x)
    const xSpread = Math.max(...xs) - Math.min(...xs)
    expect(xSpread).toBeGreaterThan(40)

    // fitView fired exactly once with the production contract — asserted
    // directly against the real useFitViewOnLayoutVersion hook output.
    expect(fitViewSpy).toHaveBeenCalledTimes(1)
    expect(fitViewSpy).toHaveBeenCalledWith({ padding: FIT_PADDING, duration: 400 })

    expect(useCanvasStore.getState().pendingLayout).toBe(false)
    expect(useCanvasStore.getState().layoutInProgress).toBe(false)
    expect(useCanvasStore.getState().layoutVersion).toBeGreaterThan(0)
  })

  it('saved-position scenario → guard, applyLayout, and fitView all stay quiet (acceptance #2)', async () => {
    const applySpy = mockApplyLayoutWithSpread()

    const ids = ['a', 'b', 'c']
    seedMeasuredLookup(ids)
    act(() => {
      useCanvasStore.setState({
        nodes: buildSpreadNodes(ids) as never,
        edges: [] as never,
        currentScenarioId: 'scA',
        pendingLayout: false,
        layoutInProgress: false,
      } as never)
    })

    renderHook(() => useLayoutLifecycle())
    await flushPipeline()

    expect(applySpy).not.toHaveBeenCalled()
    expect(fitViewSpy).not.toHaveBeenCalled()
    expect(useCanvasStore.getState().pendingLayout).toBe(false)
    expect(useCanvasStore.getState().layoutVersion).toBe(0)

    const final = useCanvasStore.getState().nodes
    expect((final[0].position as { x: number }).x).toBe(0)
    expect((final[1].position as { x: number }).x).toBe(320)
  })

  it('locked nodes are preserved through the full pipeline (acceptance #3)', async () => {
    const applySpy = mockApplyLayoutWithSpread()

    const nodes: Node[] = [
      {
        id: 'locked',
        type: 'factor',
        position: { x: 0, y: 0 },
        data: { locked: true, label: 'locked' },
      } as Node,
      { id: 'a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'a' } } as Node,
      { id: 'b', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'b' } } as Node,
    ]
    // `allUnlockedNodesMeasured` skips locked nodes — only the two
    // unlocked nodes need measurement entries.
    mockNodeLookup = new Map([
      ['a', { measured: { width: 200, height: 100 } }],
      ['b', { measured: { width: 200, height: 100 } }],
    ])
    act(() => {
      useCanvasStore.setState({
        nodes: nodes as never,
        edges: [] as never,
        currentScenarioId: 'scA',
        pendingLayout: false,
        layoutInProgress: false,
      } as never)
    })

    renderHook(() => useLayoutLifecycle())
    await flushPipeline()

    expect(applySpy).toHaveBeenCalledTimes(1)
    const final = useCanvasStore.getState().nodes
    const lockedFinal = final.find((n) => n.id === 'locked')
    expect(lockedFinal?.position).toEqual({ x: 0, y: 0 })
    expect(fitViewSpy).toHaveBeenCalledTimes(1)
    expect(fitViewSpy).toHaveBeenCalledWith({ padding: FIT_PADDING, duration: 400 })
  })

  it('scenario A→B switch lays out B when B is stacked and fires fitView once for B (acceptance #5 + #6)', async () => {
    const applySpy = mockApplyLayoutWithSpread()

    const idsA = ['a1', 'a2']
    seedMeasuredLookup(idsA)
    act(() => {
      useCanvasStore.setState({
        nodes: buildSpreadNodes(idsA) as never,
        edges: [] as never,
        currentScenarioId: 'scA',
        pendingLayout: false,
        layoutInProgress: false,
      } as never)
    })

    renderHook(() => useLayoutLifecycle())
    await flushPipeline()

    // A had meaningful positions — nothing fired.
    expect(applySpy).not.toHaveBeenCalled()
    expect(fitViewSpy).not.toHaveBeenCalled()

    // Switch to a stacked scenario B (mimics ScenarioSwitcher click /
    // useScenario.loadScenario → hydrateGraphSlice).
    const idsB = ['b1', 'b2', 'b3']
    seedMeasuredLookup(idsB)
    act(() => {
      useCanvasStore.setState({
        nodes: buildMeasuredNodes(idsB, { x: 0, y: 0 }) as never,
        edges: [] as never,
        currentScenarioId: 'scB',
        pendingLayout: false,
        layoutInProgress: false,
      } as never)
    })
    await flushPipeline()

    expect(applySpy).toHaveBeenCalledTimes(1)
    const final = useCanvasStore.getState().nodes
    const xs = final.map((n) => (n.position as { x: number }).x)
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(40)
    expect(fitViewSpy).toHaveBeenCalledTimes(1)
    expect(fitViewSpy).toHaveBeenCalledWith({ padding: FIT_PADDING, duration: 400 })
  })
})
