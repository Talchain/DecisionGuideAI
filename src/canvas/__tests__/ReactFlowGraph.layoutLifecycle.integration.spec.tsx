/**
 * End-to-end proof that the initial-layout safety-net guard plays nicely
 * with the existing measurement + fitView lifecycle.
 *
 * The guard itself is unit-tested in useInitialLayoutGuard.spec.tsx (it
 * imports the production hook directly — no simulation). What this file
 * adds is a *chain* test:
 *
 *   guard.setPendingLayout(true)
 *     → measurement effect picks up pendingLayout + measured nodes
 *     → applyLayout commits spread positions and bumps layoutVersion
 *     → fitView effect fires once via requestAnimationFrame
 *
 * The measurement and fitView effects are inline in ReactFlowGraph.tsx
 * (no production hook to import), so they are simulated here using the
 * same pattern as measureLayoutEffect.spec.tsx. The guard hook itself is
 * NOT simulated — `useInitialLayoutGuard` is imported and called as-is.
 *
 * applyLayout is mocked to deterministically commit spread positions and
 * bump layoutVersion. The real applyLayout dynamically imports ELK; this
 * suite is about lifecycle wiring, not the layout algorithm.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import type { Node } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { useInitialLayoutGuard } from '../hooks/useInitialLayoutGuard'
import {
  evaluateMeasurementGate,
  allUnlockedNodesMeasured,
} from '../utils/measureLayoutGate'

let mockNodesInitialized = true
let mockNodeLookup = new Map<string, { measured?: { width?: number; height?: number } }>()

vi.mock('@xyflow/react', () => ({
  useNodesInitialized: () => mockNodesInitialized,
  useStore: <T,>(selector: (s: { nodeLookup: typeof mockNodeLookup }) => T) =>
    selector({ nodeLookup: mockNodeLookup }),
}))

/**
 * Combines the production guard hook with thin mirrors of the inline
 * effects in ReactFlowGraph.tsx (measurement → applyLayout, layoutVersion
 * → fitView). The mirrors track the existing measureLayoutEffect.spec
 * pattern; the guard is the real production hook.
 */
function useLayoutLifecycleHarness(fitView: () => void) {
  useInitialLayoutGuard()

  const pendingLayout = useCanvasStore((s) => s.pendingLayout)
  const layoutInProgress = useCanvasStore((s) => s.layoutInProgress)
  const layoutRequestId = useCanvasStore((s) => s.layoutRequestId)
  const layoutVersion = useCanvasStore((s) => s.layoutVersion)
  const storeNodes = useCanvasStore((s) => s.nodes)
  const applyLayout = useCanvasStore((s) => s.applyLayout)

  useEffect(() => {
    const decision = evaluateMeasurementGate({
      pendingLayout,
      layoutInProgress,
      nodesInitialized: mockNodesInitialized,
      storeNodes,
      allUnlockedNodesMeasured: allUnlockedNodesMeasured(storeNodes, mockNodeLookup),
    })
    if (decision === 'idle' || decision === 'blocked') return
    const capturedId = layoutRequestId
    if (decision === 'run-now') {
      void applyLayout({ skipHistory: true, requestId: capturedId })
    }
    // 'wait-with-fallback' path intentionally omitted: every test sets
    // measurement complete (nodesInitialized + nodeLookup) so the gate
    // always returns 'run-now' or 'idle'/'blocked'.
  }, [pendingLayout, layoutInProgress, layoutRequestId, storeNodes, applyLayout])

  const fitViewRef = useRef(fitView)
  fitViewRef.current = fitView
  useEffect(() => {
    if (layoutVersion === 0) return
    const raf = requestAnimationFrame(() => fitViewRef.current())
    return () => cancelAnimationFrame(raf)
  }, [layoutVersion])
}

function buildMeasuredNodes(ids: string[], at: { x: number; y: number }): Node[] {
  return ids.map((id) => ({
    id,
    type: 'factor',
    position: { x: at.x, y: at.y },
    data: { label: id },
  } as Node))
}

function buildSpreadNodes(ids: string[]): Node[] {
  return ids.map((id, i) => ({
    id,
    type: 'factor',
    position: { x: i * 320, y: 0 },
    data: { label: id },
  } as Node))
}

function seedMeasuredLookup(ids: string[]) {
  mockNodeLookup = new Map(
    ids.map((id) => [id, { measured: { width: 200, height: 100 } }]),
  )
}

function mockApplyLayoutWithSpread(): ReturnType<typeof vi.spyOn> {
  return vi
    .spyOn(useCanvasStore.getState(), 'applyLayout')
    .mockImplementation(async () => {
      // Simulate layoutGraph: rewrite unlocked nodes to a horizontal row,
      // preserve locked positions, bump layoutVersion, clear pendingLayout.
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
  // Drain promise microtasks (applyLayout is async) and RAF callbacks
  // (fitView schedules via requestAnimationFrame).
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
    // resetCanvas() does not reset the layout lifecycle counters — they
    // are session-scoped. Reset them explicitly so the fitView effect
    // doesn't fire from a residual layoutVersion left by a prior test.
    useCanvasStore.setState({
      pendingLayout: false,
      layoutInProgress: false,
      layoutVersion: 0,
      layoutRequestId: 0,
    } as never)
    mockNodesInitialized = true
    mockNodeLookup = new Map()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stacked existing scenario → final positions are spread and fitView fires once (acceptance #1 + #6)', async () => {
    const applySpy = mockApplyLayoutWithSpread()
    const fitView = vi.fn()

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

    renderHook(() => useLayoutLifecycleHarness(fitView))
    await flushPipeline()

    // Whole chain ran exactly once.
    expect(applySpy).toHaveBeenCalledTimes(1)

    // Final positions are no longer stacked.
    const final = useCanvasStore.getState().nodes
    const xs = final.map((n) => (n.position as { x: number }).x)
    const xSpread = Math.max(...xs) - Math.min(...xs)
    expect(xSpread).toBeGreaterThan(40)

    // fitView fired exactly once after layoutVersion incremented.
    expect(fitView).toHaveBeenCalledTimes(1)

    // Final store state is settled.
    expect(useCanvasStore.getState().pendingLayout).toBe(false)
    expect(useCanvasStore.getState().layoutInProgress).toBe(false)
    expect(useCanvasStore.getState().layoutVersion).toBeGreaterThan(0)

    applySpy.mockRestore()
  })

  it('saved-position scenario → guard, applyLayout, and fitView all stay quiet (acceptance #2)', async () => {
    const applySpy = mockApplyLayoutWithSpread()
    const fitView = vi.fn()

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

    renderHook(() => useLayoutLifecycleHarness(fitView))
    await flushPipeline()

    expect(applySpy).not.toHaveBeenCalled()
    expect(fitView).not.toHaveBeenCalled()
    expect(useCanvasStore.getState().pendingLayout).toBe(false)
    expect(useCanvasStore.getState().layoutVersion).toBe(0)

    // Positions unchanged.
    const final = useCanvasStore.getState().nodes
    expect((final[0].position as { x: number }).x).toBe(0)
    expect((final[1].position as { x: number }).x).toBe(320)

    applySpy.mockRestore()
  })

  it('scenario A→B switch lays out B when B is stacked and fires fitView once for B (acceptance #5 + #6)', async () => {
    const applySpy = mockApplyLayoutWithSpread()
    const fitView = vi.fn()

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

    renderHook(() => useLayoutLifecycleHarness(fitView))
    await flushPipeline()

    // Scenario A had meaningful positions — nothing fired.
    expect(applySpy).not.toHaveBeenCalled()
    expect(fitView).not.toHaveBeenCalled()

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
    expect(fitView).toHaveBeenCalledTimes(1)

    applySpy.mockRestore()
  })
})
