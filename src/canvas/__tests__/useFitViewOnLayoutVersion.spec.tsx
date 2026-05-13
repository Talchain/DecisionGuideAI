/**
 * Tests for the `useFitViewOnLayoutVersion` production hook
 * (src/canvas/hooks/useFitViewOnLayoutVersion.ts).
 *
 * Each successful `applyLayout` bumps `layoutVersion`. The hook
 * schedules exactly one RAF-synced `fitView({ padding: 0.2, duration: 400 })`
 * per bump. `layoutVersion === 0` is the "no layout yet" state and must
 * not trigger fitView.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCanvasStore } from '../store'
import { useFitViewOnLayoutVersion } from '../hooks/useFitViewOnLayoutVersion'

const fitViewSpy = vi.fn()

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({ fitView: fitViewSpy }),
}))

describe('useFitViewOnLayoutVersion', () => {
  beforeEach(() => {
    useCanvasStore.getState().resetCanvas()
    useCanvasStore.setState({ layoutVersion: 0 } as never)
    fitViewSpy.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not call fitView when layoutVersion is 0 on mount', () => {
    let rafScheduled = 0
    const rafSpy = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation(() => {
        rafScheduled += 1
        return 1
      })

    renderHook(() => useFitViewOnLayoutVersion())

    expect(rafScheduled).toBe(0)
    expect(fitViewSpy).not.toHaveBeenCalled()

    rafSpy.mockRestore()
  })

  it('schedules RAF and invokes fitView with the production contract on layoutVersion increment', () => {
    let rafCallback: (() => void) | null = null
    const rafSpy = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        rafCallback = cb as () => void
        return 1
      })

    renderHook(() => useFitViewOnLayoutVersion())

    act(() => {
      useCanvasStore.setState({ layoutVersion: 1 } as never)
    })

    expect(rafSpy).toHaveBeenCalledTimes(1)
    expect(fitViewSpy).not.toHaveBeenCalled()

    act(() => {
      rafCallback?.()
    })

    expect(fitViewSpy).toHaveBeenCalledTimes(1)
    expect(fitViewSpy).toHaveBeenCalledWith({ padding: 0.2, duration: 400 })

    rafSpy.mockRestore()
  })

  it('fires fitView exactly once per successive layoutVersion bump', () => {
    const rafCallbacks: Array<() => void> = []
    const rafSpy = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        rafCallbacks.push(cb as () => void)
        return rafCallbacks.length
      })

    renderHook(() => useFitViewOnLayoutVersion())

    act(() => {
      useCanvasStore.setState({ layoutVersion: 1 } as never)
    })
    act(() => {
      rafCallbacks[0]?.()
    })
    expect(fitViewSpy).toHaveBeenCalledTimes(1)

    act(() => {
      useCanvasStore.setState({ layoutVersion: 2 } as never)
    })
    act(() => {
      rafCallbacks[1]?.()
    })
    expect(fitViewSpy).toHaveBeenCalledTimes(2)

    rafSpy.mockRestore()
  })

  it('cancels the RAF if the effect re-runs before the frame fires', () => {
    const cancels: number[] = []
    let rafIdCounter = 0
    const rafSpy = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation(() => {
        rafIdCounter += 1
        return rafIdCounter
      })
    const cancelSpy = vi
      .spyOn(globalThis, 'cancelAnimationFrame')
      .mockImplementation((id: number) => {
        cancels.push(id)
      })

    renderHook(() => useFitViewOnLayoutVersion())

    act(() => {
      useCanvasStore.setState({ layoutVersion: 1 } as never)
    })
    expect(rafSpy).toHaveBeenCalledTimes(1)

    // Bump again before the RAF fires — the cleanup from the previous
    // effect invocation must cancel the first RAF.
    act(() => {
      useCanvasStore.setState({ layoutVersion: 2 } as never)
    })
    expect(cancels).toContain(1)
    expect(rafSpy).toHaveBeenCalledTimes(2)

    rafSpy.mockRestore()
    cancelSpy.mockRestore()
  })
})
