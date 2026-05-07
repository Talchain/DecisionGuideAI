/**
 * Effect-wiring tests for the measure-then-layout effect (P1.2 of post-D6
 * review).
 *
 * These complement the pure-gate unit tests in measureLayoutGate.spec.ts
 * by exercising the effect's setTimeout / RAF / cleanup behaviour through a
 * tiny test component that uses the same hooks ReactFlowGraph does. Mocks
 * `useNodesInitialized` and `useStore` from `@xyflow/react`, drives the
 * canvas store, advances fake timers, and asserts on the gate's outcomes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React, { useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'
import {
  evaluateMeasurementGate,
  allUnlockedNodesMeasured,
} from '../utils/measureLayoutGate'
import { LAYOUT_MEASUREMENT_FALLBACK_MS } from '../utils/nodeLayoutConstants'

// Variables driven by tests; the mocked react-flow hooks read from these.
let mockNodesInitialized = false
let mockNodeLookup = new Map<string, { measured?: { width?: number; height?: number } }>()

vi.mock('@xyflow/react', () => ({
  useNodesInitialized: () => mockNodesInitialized,
  useStore: <T,>(selector: (s: { nodeLookup: typeof mockNodeLookup }) => T) =>
    selector({ nodeLookup: mockNodeLookup }),
}))

// Simulates the relevant slice of ReactFlowGraph's measure-then-layout
// effect plus the layoutVersion → fitView RAF effect.
function useMeasureThenLayoutSimulation(fitView: () => void) {
  const pendingLayout = useCanvasStore(s => s.pendingLayout)
  const layoutInProgress = useCanvasStore(s => s.layoutInProgress)
  const layoutRequestId = useCanvasStore(s => s.layoutRequestId)
  const layoutVersion = useCanvasStore(s => s.layoutVersion)
  const storeNodes = useCanvasStore(s => s.nodes)
  const applyLayout = useCanvasStore(s => s.applyLayout)
  const fitViewRef = useRef(fitView)
  fitViewRef.current = fitView

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
      return
    }

    const timer = setTimeout(() => {
      void applyLayout({ skipHistory: true, requestId: capturedId })
    }, LAYOUT_MEASUREMENT_FALLBACK_MS)
    return () => clearTimeout(timer)
  }, [pendingLayout, layoutInProgress, layoutRequestId, storeNodes, applyLayout])

  useEffect(() => {
    if (layoutVersion === 0) return
    const raf = requestAnimationFrame(() => fitViewRef.current())
    return () => cancelAnimationFrame(raf)
  }, [layoutVersion])
}

describe('measure-then-layout effect wiring (P1.2)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useCanvasStore.getState().resetCanvas()
    mockNodesInitialized = false
    mockNodeLookup = new Map()
  })

  it('does not call applyLayout while measurement is incomplete (no run-now path)', () => {
    const applySpy = vi.spyOn(useCanvasStore.getState(), 'applyLayout')

    useCanvasStore.setState({
      nodes: [
        { id: 'a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'a', kind: 'factor' } },
      ] as never,
      pendingLayout: true,
      layoutRequestId: 1,
    })
    // Measurement incomplete: nodesInitialized = false.
    mockNodesInitialized = false

    renderHook(() => useMeasureThenLayoutSimulation(() => {}))

    // Effect ran and started the fallback timer; before the timer fires,
    // applyLayout has not been called.
    expect(applySpy).not.toHaveBeenCalled()

    applySpy.mockRestore()
  })

  it('fires applyLayout via the fallback timer after LAYOUT_MEASUREMENT_FALLBACK_MS', () => {
    const applySpy = vi.spyOn(useCanvasStore.getState(), 'applyLayout')
      .mockImplementation(() => Promise.resolve())

    useCanvasStore.setState({
      nodes: [
        { id: 'a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'a', kind: 'factor' } },
      ] as never,
      pendingLayout: true,
      layoutRequestId: 1,
    })
    mockNodesInitialized = false

    renderHook(() => useMeasureThenLayoutSimulation(() => {}))

    // Just before the fallback fires.
    act(() => { vi.advanceTimersByTime(LAYOUT_MEASUREMENT_FALLBACK_MS - 1) })
    expect(applySpy).not.toHaveBeenCalled()

    // Fallback fires.
    act(() => { vi.advanceTimersByTime(1) })
    expect(applySpy).toHaveBeenCalledTimes(1)
    expect(applySpy.mock.calls[0][0]).toEqual({ skipHistory: true, requestId: 1 })

    applySpy.mockRestore()
  })

  it('cleanup cancels the fallback timer when pendingLayout flips false before it fires', () => {
    const applySpy = vi.spyOn(useCanvasStore.getState(), 'applyLayout')
      .mockImplementation(() => Promise.resolve())

    useCanvasStore.setState({
      nodes: [
        { id: 'a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'a', kind: 'factor' } },
      ] as never,
      pendingLayout: true,
      layoutRequestId: 1,
    })
    mockNodesInitialized = false

    const { rerender } = renderHook(() => useMeasureThenLayoutSimulation(() => {}))

    act(() => { vi.advanceTimersByTime(100) })
    // Cancel — flip pendingLayout false. Cleanup must clearTimeout.
    act(() => {
      useCanvasStore.setState({ pendingLayout: false })
    })
    rerender()
    act(() => { vi.advanceTimersByTime(LAYOUT_MEASUREMENT_FALLBACK_MS) })

    expect(applySpy).not.toHaveBeenCalled()
    applySpy.mockRestore()
  })

  it('immediately calls applyLayout when measurement is already complete (run-now)', () => {
    const applySpy = vi.spyOn(useCanvasStore.getState(), 'applyLayout')
      .mockImplementation(() => Promise.resolve())

    useCanvasStore.setState({
      nodes: [
        { id: 'a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'a', kind: 'factor' } },
      ] as never,
      pendingLayout: true,
      layoutRequestId: 1,
    })
    mockNodesInitialized = true
    mockNodeLookup = new Map([
      ['a', { measured: { width: 320, height: 100 } }],
    ])

    renderHook(() => useMeasureThenLayoutSimulation(() => {}))

    expect(applySpy).toHaveBeenCalledTimes(1)
    expect(applySpy.mock.calls[0][0]).toEqual({ skipHistory: true, requestId: 1 })

    applySpy.mockRestore()
  })

  it('re-entry guard — does not call applyLayout while layoutInProgress is true', () => {
    const applySpy = vi.spyOn(useCanvasStore.getState(), 'applyLayout')

    useCanvasStore.setState({
      nodes: [
        { id: 'a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'a', kind: 'factor' } },
      ] as never,
      pendingLayout: true,
      layoutInProgress: true,
      layoutRequestId: 1,
    })
    mockNodesInitialized = true
    mockNodeLookup = new Map([
      ['a', { measured: { width: 320, height: 100 } }],
    ])

    renderHook(() => useMeasureThenLayoutSimulation(() => {}))

    expect(applySpy).not.toHaveBeenCalled()
    applySpy.mockRestore()
  })

  it('layoutVersion increment triggers exactly one RAF fitView', () => {
    const fitView = vi.fn()
    let rafCallback: (() => void) | null = null
    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(
      (cb: FrameRequestCallback) => {
        rafCallback = cb as () => void
        return 1
      },
    )

    renderHook(() => useMeasureThenLayoutSimulation(fitView))

    // Initial render: layoutVersion === 0 → no RAF scheduled.
    expect(rafSpy).not.toHaveBeenCalled()

    // Bump layoutVersion → effect schedules RAF.
    act(() => {
      useCanvasStore.setState({ layoutVersion: 1 })
    })
    expect(rafSpy).toHaveBeenCalledTimes(1)
    expect(fitView).not.toHaveBeenCalled()

    // Run the RAF callback — fitView fires.
    act(() => { rafCallback?.() })
    expect(fitView).toHaveBeenCalledTimes(1)

    rafSpy.mockRestore()
  })
})
