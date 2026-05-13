/**
 * Tests for the `useMeasureThenLayout` production hook
 * (src/canvas/hooks/useMeasureThenLayout.ts).
 *
 * The hook drives `applyLayout` once node measurement is complete, with
 * a bounded fallback timer when measurement does not settle in time.
 * `handleLayoutWithRecovery` is the failure-routing wrapper used by every
 * auto-trigger of `applyLayout`.
 *
 * @xyflow/react is mocked because the hook uses `useNodesInitialized`
 * and `useStore(s => s.nodeLookup)` which require a Provider. The mock
 * exposes both via simple module-scope state.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCanvasStore } from '../store'
import { useMeasureThenLayout } from '../hooks/useMeasureThenLayout'
import { LAYOUT_MEASUREMENT_FALLBACK_MS } from '../utils/nodeLayoutConstants'
import { handleLayoutWithRecovery } from '../layout/handleLayoutWithRecovery'

let mockNodesInitialized = false
let mockNodeLookup = new Map<string, { measured?: { width?: number; height?: number } }>()

vi.mock('@xyflow/react', () => ({
  useNodesInitialized: () => mockNodesInitialized,
  useStore: <T,>(selector: (s: { nodeLookup: typeof mockNodeLookup }) => T) =>
    selector({ nodeLookup: mockNodeLookup }),
}))

// Default recovery wrapper: invoke the layout callback immediately. The
// "routes through handleLayoutWithRecovery" test overrides this default
// in-line.
vi.mock('../layout/handleLayoutWithRecovery', () => ({
  handleLayoutWithRecovery: vi.fn((fn: () => Promise<void> | void) => fn()),
}))

const mockedRecovery = vi.mocked(handleLayoutWithRecovery)

function seedSingleNode() {
  useCanvasStore.setState({
    nodes: [
      {
        id: 'a',
        type: 'factor',
        position: { x: 0, y: 0 },
        data: { label: 'a', kind: 'factor' },
      },
    ] as never,
    pendingLayout: true,
    layoutRequestId: 1,
  } as never)
}

describe('useMeasureThenLayout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useCanvasStore.getState().resetCanvas()
    useCanvasStore.setState({
      pendingLayout: false,
      layoutInProgress: false,
      layoutVersion: 0,
      layoutRequestId: 0,
    } as never)
    mockNodesInitialized = false
    mockNodeLookup = new Map()
    mockedRecovery.mockClear()
    mockedRecovery.mockImplementation((fn: () => Promise<void> | void) => fn())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not invoke applyLayout while measurement is incomplete (wait-with-fallback, before timer)', () => {
    const applySpy = vi
      .spyOn(useCanvasStore.getState(), 'applyLayout')
      .mockImplementation(() => Promise.resolve())

    seedSingleNode()
    mockNodesInitialized = false

    renderHook(() => useMeasureThenLayout())

    expect(applySpy).not.toHaveBeenCalled()
  })

  it('fallback timer invokes applyLayout after LAYOUT_MEASUREMENT_FALLBACK_MS', () => {
    const applySpy = vi
      .spyOn(useCanvasStore.getState(), 'applyLayout')
      .mockImplementation(() => Promise.resolve())

    seedSingleNode()
    mockNodesInitialized = false

    renderHook(() => useMeasureThenLayout())

    act(() => {
      vi.advanceTimersByTime(LAYOUT_MEASUREMENT_FALLBACK_MS - 1)
    })
    expect(applySpy).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(applySpy).toHaveBeenCalledTimes(1)
    expect(applySpy.mock.calls[0][0]).toEqual({ skipHistory: true, requestId: 1 })
  })

  it('cleanup cancels the fallback timer when pendingLayout flips false before it fires', () => {
    const applySpy = vi
      .spyOn(useCanvasStore.getState(), 'applyLayout')
      .mockImplementation(() => Promise.resolve())

    seedSingleNode()
    mockNodesInitialized = false

    const { rerender } = renderHook(() => useMeasureThenLayout())

    act(() => {
      vi.advanceTimersByTime(100)
    })
    act(() => {
      useCanvasStore.setState({ pendingLayout: false } as never)
    })
    rerender()
    act(() => {
      vi.advanceTimersByTime(LAYOUT_MEASUREMENT_FALLBACK_MS)
    })

    expect(applySpy).not.toHaveBeenCalled()
  })

  it('run-now: invokes applyLayout immediately when measurement is complete', () => {
    const applySpy = vi
      .spyOn(useCanvasStore.getState(), 'applyLayout')
      .mockImplementation(() => Promise.resolve())

    seedSingleNode()
    mockNodesInitialized = true
    mockNodeLookup = new Map([['a', { measured: { width: 320, height: 100 } }]])

    renderHook(() => useMeasureThenLayout())

    expect(applySpy).toHaveBeenCalledTimes(1)
    expect(applySpy.mock.calls[0][0]).toEqual({ skipHistory: true, requestId: 1 })
  })

  it('blocked: does not invoke applyLayout while layoutInProgress is true', () => {
    const applySpy = vi
      .spyOn(useCanvasStore.getState(), 'applyLayout')
      .mockImplementation(() => Promise.resolve())

    useCanvasStore.setState({
      nodes: [
        {
          id: 'a',
          type: 'factor',
          position: { x: 0, y: 0 },
          data: { label: 'a', kind: 'factor' },
        },
      ] as never,
      pendingLayout: true,
      layoutInProgress: true,
      layoutRequestId: 1,
    } as never)
    mockNodesInitialized = true
    mockNodeLookup = new Map([['a', { measured: { width: 320, height: 100 } }]])

    renderHook(() => useMeasureThenLayout())

    expect(applySpy).not.toHaveBeenCalled()
  })

  it('idle: does not invoke applyLayout when pendingLayout is false', () => {
    const applySpy = vi
      .spyOn(useCanvasStore.getState(), 'applyLayout')
      .mockImplementation(() => Promise.resolve())

    useCanvasStore.setState({
      nodes: [
        {
          id: 'a',
          type: 'factor',
          position: { x: 0, y: 0 },
          data: { label: 'a', kind: 'factor' },
        },
      ] as never,
      pendingLayout: false,
      layoutRequestId: 0,
    } as never)
    mockNodesInitialized = true
    mockNodeLookup = new Map([['a', { measured: { width: 320, height: 100 } }]])

    renderHook(() => useMeasureThenLayout())

    expect(applySpy).not.toHaveBeenCalled()
  })

  it('routes applyLayout through handleLayoutWithRecovery (failure-routing path)', () => {
    // Override default: do NOT invoke the callback. We're only checking
    // that the wrapper was called with a layout callback, and that the
    // callback (when invoked manually) hits applyLayout with the captured
    // requestId. This proves auto-triggered failures land in the retry
    // banner machinery rather than going silent.
    mockedRecovery.mockImplementation(() => {})

    const applySpy = vi
      .spyOn(useCanvasStore.getState(), 'applyLayout')
      .mockImplementation(() => Promise.resolve())

    seedSingleNode()
    mockNodesInitialized = true
    mockNodeLookup = new Map([['a', { measured: { width: 320, height: 100 } }]])

    renderHook(() => useMeasureThenLayout())

    expect(mockedRecovery).toHaveBeenCalledTimes(1)
    const callback = mockedRecovery.mock.calls[0][0]
    expect(typeof callback).toBe('function')

    // Since the wrapper did not invoke the callback, applyLayout has not
    // been called yet.
    expect(applySpy).not.toHaveBeenCalled()

    // Invoke the callback manually — this is what the real wrapper would
    // do under success and on retry under failure.
    callback()

    expect(applySpy).toHaveBeenCalledTimes(1)
    expect(applySpy.mock.calls[0][0]).toEqual({ skipHistory: true, requestId: 1 })
  })
})
