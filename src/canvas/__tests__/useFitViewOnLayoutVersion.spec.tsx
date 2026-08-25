/**
 * Tests for the `useFitViewOnLayoutVersion` production hook
 * (src/canvas/hooks/useFitViewOnLayoutVersion.ts).
 *
 * Each successful `applyLayout` bumps `layoutVersion`. The hook
 * schedules exactly one RAF-synced
 * `fitView({ padding: computeFitPadding(), duration: 400 })` per bump.
 * `layoutVersion === 0` is the "no layout yet" state and must not trigger
 * fitView. `computeFitPadding` is mocked here to a sentinel — its own correctness
 * is covered by computeFitPadding.spec.ts; this spec locks the cadence + duration.
 *
 * ⭐ EXTENDED 18 Aug 2026 (`WORKSPACE-COMPOSITION-DECISION-2026-08-18.md` step 1):
 * the RESERVED BOX is now a trigger too, and the fit targets exclude UI
 * placeholders. Both are covered below; the sentinel padding is mutable so a
 * reserved-box CHANGE can be simulated without the real measurement.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCanvasStore } from '../store'
import { useFitViewOnLayoutVersion } from '../hooks/useFitViewOnLayoutVersion'
import { LABEL_LEGIBLE_ZOOM, AUTO_FIT_MAX_ZOOM } from '../utils/zoomLegibility'

const fitViewSpy = vi.fn()

const FIT_PADDING = { top: '10px', right: '20px', bottom: '10px', left: '20px' }
/** The reserved box the mocked measurement reports; reassigned to simulate a change. */
let currentPadding: { top: string; right: string; bottom: string; left: string } = FIT_PADDING
/** The nodes the mocked ReactFlow instance holds — including a UI placeholder. */
let currentNodes: Array<{ id: string }> = []

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({ fitView: fitViewSpy, getNodes: () => currentNodes }),
}))

vi.mock('../utils/computeFitPadding', () => ({
  computeFitPadding: () => currentPadding,
}))

describe('useFitViewOnLayoutVersion', () => {
  beforeEach(() => {
    useCanvasStore.getState().resetCanvas()
    useCanvasStore.setState({ layoutVersion: 0 } as never)
    fitViewSpy.mockReset()
    currentPadding = FIT_PADDING
    currentNodes = []
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

  it('schedules RAF and invokes fitView with the panel-aware contract on layoutVersion increment', () => {
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
    // The legibility floor joined this contract on 25 Jul 2026, and the CEILING
    // joined it on 25 Aug 2026 — see autoFitLegibility.spec.tsx for why each
    // exists and what guards it. A floor with no ceiling let a degenerate
    // bounding box frame at up to the instance's `maxZoom={4}`; the witnessed
    // canvas sat at 328%.
    //
    // ⭐ This is an EXACT-OBJECT assertion on purpose: it is what makes a
    // silently ADDED or DROPPED fit option fail here rather than pass
    // unnoticed. That is exactly how it behaved — this test caught the new
    // option on CI. Keep it exact.
    expect(fitViewSpy).toHaveBeenCalledWith({
      padding: FIT_PADDING,
      minZoom: LABEL_LEGIBLE_ZOOM,
      maxZoom: AUTO_FIT_MAX_ZOOM,
      duration: 400,
    })

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

  describe('the reserved box is a trigger too', () => {
    it('re-fits when the reserved box changes, with the SAME contract as the layout fit', () => {
      // The witnessed defect: the camera sat at zoom 0.385 after the conversation
      // panel closed while the computed fit for the new box was 0.582 — the graph
      // 34% smaller than it needed to be, because fitView only ever ran on layout.
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
        rafCallbacks.splice(0).forEach((cb) => cb())
      })
      expect(fitViewSpy).toHaveBeenCalledTimes(1)
      const layoutFitArgs = fitViewSpy.mock.calls[0][0]

      // The dock collapses: 20px of right reservation becomes 444px.
      currentPadding = { top: '10px', right: '444px', bottom: '10px', left: '20px' }
      act(() => {
        window.dispatchEvent(new Event('resize'))
      })
      act(() => {
        rafCallbacks.splice(0).forEach((cb) => cb())
      })

      expect(fitViewSpy).toHaveBeenCalledTimes(2)
      const refitArgs = fitViewSpy.mock.calls[1][0]
      // ONE contract: everything except the measured padding must be identical,
      // so the two triggers cannot drift into two different fits.
      expect(refitArgs.minZoom).toBe(layoutFitArgs.minZoom)
      expect(refitArgs.maxZoom).toBe(layoutFitArgs.maxZoom)
      expect(refitArgs.duration).toBe(layoutFitArgs.duration)
      expect(refitArgs.padding).toEqual(currentPadding)

      rafSpy.mockRestore()
    })

    it('does NOT re-fit when the reserved box is unchanged', () => {
      // The discriminating half: a watcher that fired on every trigger regardless
      // would pass the test above and yank the camera on every pointerup.
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
        rafCallbacks.splice(0).forEach((cb) => cb())
      })
      expect(fitViewSpy).toHaveBeenCalledTimes(1)

      // Same padding: three triggers, no re-fit.
      act(() => {
        window.dispatchEvent(new Event('resize'))
        document.dispatchEvent(new Event('pointerup'))
        document.dispatchEvent(new Event('transitionend'))
      })
      act(() => {
        rafCallbacks.splice(0).forEach((cb) => cb())
      })
      expect(fitViewSpy).toHaveBeenCalledTimes(1)

      rafSpy.mockRestore()
    })

    it('never re-fits before a layout has happened', () => {
      const rafCallbacks: Array<() => void> = []
      const rafSpy = vi
        .spyOn(globalThis, 'requestAnimationFrame')
        .mockImplementation((cb: FrameRequestCallback) => {
          rafCallbacks.push(cb as () => void)
          return rafCallbacks.length
        })

      renderHook(() => useFitViewOnLayoutVersion())
      currentPadding = { top: '10px', right: '444px', bottom: '10px', left: '20px' }
      act(() => {
        window.dispatchEvent(new Event('resize'))
      })
      act(() => {
        rafCallbacks.splice(0).forEach((cb) => cb())
      })
      expect(fitViewSpy).not.toHaveBeenCalled()

      rafSpy.mockRestore()
    })
  })

  describe('fit targets exclude UI placeholders', () => {
    function fitOnce() {
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
        rafCallbacks.splice(0).forEach((cb) => cb())
      })
      rafSpy.mockRestore()
      return fitViewSpy.mock.calls[0][0]
    }

    it('passes the model nodes and omits __ghost-option__ — bound by ID', () => {
      currentNodes = [{ id: 'dec_1' }, { id: 'opt_a' }, { id: '__ghost-option__' }]
      const args = fitOnce()
      // Bound by identity, never by a count another node set could satisfy.
      expect(args.nodes.map((n: { id: string }) => n.id)).toEqual(['dec_1', 'opt_a'])
    })

    it('omits `nodes` entirely when there are none — the previous behaviour', () => {
      // A `nodes: []` would frame nothing. The fallback must be xyflow's
      // fit-everything, i.e. exactly what shipped before.
      currentNodes = []
      const args = fitOnce()
      expect('nodes' in args).toBe(false)
    })

    it('omits `nodes` when the ONLY node is the placeholder', () => {
      currentNodes = [{ id: '__ghost-option__' }]
      const args = fitOnce()
      expect('nodes' in args).toBe(false)
    })
  })
})
