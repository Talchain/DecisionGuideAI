/**
 * Failure-aware guard semantics (2026-05-14 P0 fix).
 *
 * Replaces the original "fire-once via firedKeysRef" set with three
 * categorised sets:
 *   - inFlightKeyRef       — guard fired, awaiting layoutVersion bump or failure
 *   - completedKeysRef     — layoutVersion observed to bump while in-flight
 *   - failedKeysRef        — recovery-store status flipped to 'error' while in-flight
 *
 * Contract:
 *   1. Guard auto-fires once per identity for a stacked unlocked graph.
 *   2. After a successful layout, the key is COMPLETED — no auto-refire even
 *      if positions later become stacked.
 *   3. After a failed layout, the key is FAILED — no auto-refire (would loop
 *      forever on a graph the engine genuinely cannot lay out). The Retry
 *      callback on the recovery banner is the user-facing path.
 *   4. A different graph identity (new structural hash) is always evaluated
 *      fresh — independent of any other key's state.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { useLayoutProgressStore } from '../layoutProgressStore'
import { useInitialLayoutGuard } from '../hooks/useInitialLayoutGuard'

function stackedNode(id: string, type = 'factor'): Node {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label: id, kind: type },
  } as Node
}

describe('useInitialLayoutGuard — failure-aware semantics', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      currentScenarioId: null,
      pendingLayout: false,
      layoutInProgress: false,
      layoutVersion: 0,
      layoutRequestId: 0,
    })
    useLayoutProgressStore.getState().cancel()
  })

  it('auto-fires once for a stacked graph; does not refire after success', () => {
    useCanvasStore.setState({
      nodes: [stackedNode('a', 'decision'), stackedNode('b', 'option'), stackedNode('c', 'goal')],
      edges: [],
    })

    const { rerender } = renderHook(() => useInitialLayoutGuard())
    expect(useCanvasStore.getState().pendingLayout).toBe(true)

    // Simulate successful layout: pendingLayout clears, layoutVersion bumps.
    act(() => {
      useCanvasStore.setState({
        pendingLayout: false,
        layoutInProgress: false,
        layoutVersion: 1,
      })
    })

    // The same graph is still stacked (the layout result didn't change
    // positions in the store, simulating a degenerate or test scenario).
    // The guard must NOT auto-refire — the key is now COMPLETED.
    useCanvasStore.setState({ pendingLayout: false })
    rerender()
    expect(useCanvasStore.getState().pendingLayout).toBe(false)
  })

  it('does not auto-refire after a failed layout — the key is FAILED', () => {
    useCanvasStore.setState({
      nodes: [stackedNode('a', 'decision'), stackedNode('b', 'option'), stackedNode('c', 'goal')],
      edges: [],
    })

    const { rerender } = renderHook(() => useInitialLayoutGuard())
    expect(useCanvasStore.getState().pendingLayout).toBe(true)

    // Simulate failed layout: recovery store flips to 'error'.
    act(() => {
      useLayoutProgressStore.getState().fail('Layout failed. Try again.', () => {})
      useCanvasStore.setState({
        pendingLayout: false,
        layoutInProgress: false,
        // layoutVersion does NOT bump on failure.
      })
    })

    // The graph is still stacked. The guard must NOT auto-refire.
    // The Retry callback on the recovery banner is the only path forward.
    rerender()
    expect(useCanvasStore.getState().pendingLayout).toBe(false)
  })

  it('clears FAILED state when the same graph succeeds via explicit retry', () => {
    useCanvasStore.setState({
      nodes: [stackedNode('a', 'decision'), stackedNode('b', 'option'), stackedNode('c', 'goal')],
      edges: [],
    })

    const { rerender } = renderHook(() => useInitialLayoutGuard())
    expect(useCanvasStore.getState().pendingLayout).toBe(true)

    act(() => {
      useLayoutProgressStore.getState().fail('Layout failed. Try again.', () => {})
      useCanvasStore.setState({ pendingLayout: false, layoutInProgress: false })
    })
    rerender()
    expect(useCanvasStore.getState().pendingLayout).toBe(false)

    // Simulate the banner Retry path succeeding. The guard is not in-flight
    // for this retry, but it should still observe the layoutVersion bump and
    // move the current key out of FAILED into COMPLETED.
    act(() => {
      useLayoutProgressStore.getState().succeed()
      useCanvasStore.setState({
        layoutVersion: 1,
        pendingLayout: false,
        layoutInProgress: false,
      })
    })
    rerender()

    // Leave positions stacked to prove COMPLETED, not graph spread, is what
    // prevents another automatic request.
    expect(useCanvasStore.getState().pendingLayout).toBe(false)
  })

  it('a NEW graph identity (different structural hash) IS auto-evaluated fresh, even after a failure on a previous key', () => {
    // First graph, will fail.
    useCanvasStore.setState({
      nodes: [stackedNode('a', 'decision'), stackedNode('b', 'option'), stackedNode('c', 'goal')],
      edges: [],
    })

    const { rerender } = renderHook(() => useInitialLayoutGuard())
    expect(useCanvasStore.getState().pendingLayout).toBe(true)

    act(() => {
      useLayoutProgressStore.getState().fail('Layout failed. Try again.', () => {})
      useCanvasStore.setState({ pendingLayout: false, layoutInProgress: false })
    })

    // Now insert a DIFFERENT graph (new structural hash).
    act(() => {
      useCanvasStore.setState({
        nodes: [
          stackedNode('x', 'decision'),
          stackedNode('y', 'option'),
          stackedNode('z', 'goal'),
          stackedNode('w', 'factor'),
        ],
        edges: [],
      })
    })
    rerender()

    expect(useCanvasStore.getState().pendingLayout).toBe(true)
  })

  it('a fresh non-stacked graph does NOT auto-fire (no false positives)', () => {
    useCanvasStore.setState({
      nodes: [
        { ...stackedNode('a', 'decision'), position: { x: 0, y: 0 } },
        { ...stackedNode('b', 'option'), position: { x: 200, y: 100 } },
        { ...stackedNode('c', 'goal'), position: { x: 400, y: 200 } },
      ],
      edges: [],
    })

    renderHook(() => useInitialLayoutGuard())
    expect(useCanvasStore.getState().pendingLayout).toBe(false)
  })
})
