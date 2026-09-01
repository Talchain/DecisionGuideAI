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
import { claimCameraForUser, releaseUserCameraClaim } from '../utils/userCameraClaim'
import { currentModelKey } from '../utils/currentModelKey'

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
    // ⚠ THE INITIATOR IS RESET HERE TOO. `resetCanvas` does not clear it, and the
    // layout trigger's guard reads it — a case that left it `'product'` would
    // silently change the branch the NEXT case takes.
    useCanvasStore.setState({ layoutVersion: 0, lastLayoutInitiatedBy: 'user' } as never)
    fitViewSpy.mockReset()
    currentPadding = FIT_PADDING
    currentNodes = []
    // The claim is module state by design (see `utils/userCameraClaim.ts`), so
    // it is reset here rather than leaking between cases.
    releaseUserCameraClaim()
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

    it('does NOT re-fit when the USER has framed the camera (#1051)', () => {
      // ⭐⭐ THE DEFECT, AT THE SEAM. Measured in Chromium on `build-vs-buy`:
      // "Show whole model" landed the camera at 0.2630 with 19 of 19 nodes
      // inside the pane, and THIS trigger overwrote it 155ms later at 0.5000 —
      // the legibility floor the automatic fit is clamped to — leaving 9 of 19
      // inside. The button did its job and the product undid it.
      //
      // ⚠ WHAT THIS jsdom CASE PROVES, AND WHAT IT DOES NOT. It proves the
      // SEAM: that a claimed camera stops this trigger issuing a fit at all.
      // It cannot prove anything about layout, zoom or what a user can see —
      // jsdom has no layout. The visibility half is
      // `e2e/visual/showWholeModelFit.visual.spec.ts`, in a real browser.
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

      // The user asks for the overview.
      claimCameraForUser(currentModelKey())

      // The reserved box then changes for real — the same stimulus the case
      // above proves DOES re-fit, so this is not passing because nothing moved.
      currentPadding = { top: '10px', right: '444px', bottom: '10px', left: '20px' }
      act(() => {
        window.dispatchEvent(new Event('resize'))
      })
      act(() => {
        rafCallbacks.splice(0).forEach((cb) => cb())
      })

      expect(
        fitViewSpy,
        'the product re-framed a camera the user had explicitly framed',
      ).toHaveBeenCalledTimes(1)

      rafSpy.mockRestore()
    })

    it('a layout that brings a DIFFERENT model releases the claim — that frame is gone', () => {
      // The other direction, and it is not decoration: a claim that outlived the
      // model would strand the camera on a graph that no longer exists.
      //
      // ⚠ THIS TEST USED TO SAY "a completed layout releases the claim", full
      // stop, and asserted it by laying out THE SAME (empty) MODEL. That was the
      // defect #1096 fixed, written down as an expectation: `layoutVersion`
      // incrementing was being read as "a new model arrived" when it also covers
      // the corrective re-layouts `useMeasureThenLayout` runs on the model
      // already on screen. The claim it tests is still real — it just has to be
      // exercised with an actual model CHANGE, which is what now distinguishes
      // the two cases.
      const rafCallbacks: Array<() => void> = []
      const rafSpy = vi
        .spyOn(globalThis, 'requestAnimationFrame')
        .mockImplementation((cb: FrameRequestCallback) => {
          rafCallbacks.push(cb as () => void)
          return rafCallbacks.length
        })

      renderHook(() => useFitViewOnLayoutVersion())
      claimCameraForUser(currentModelKey())

      act(() => {
        useCanvasStore.setState({
          nodes: [{ id: 'arrived_1', position: { x: 0, y: 0 }, data: {} }],
          layoutVersion: 1,
          // ⚠ AUTOMATIC, EXPLICITLY. A model ARRIVING is laid out by
          // `useMeasureThenLayout`, i.e. `initiatedBy: 'product'`. Left at the
          // store default of `'user'` this case would pass on the INITIATOR
          // conjunct and stop saying anything about the model key at all —
          // green for a reason it was not written to test (trap 13b).
          lastLayoutInitiatedBy: 'product',
        } as never)
      })
      act(() => {
        rafCallbacks.splice(0).forEach((cb) => cb())
      })
      expect(fitViewSpy, 'a layout must still fit even while a claim is held').toHaveBeenCalledTimes(1)

      // ...and the claim is GONE, so the reserved box works again afterwards.
      currentPadding = { top: '10px', right: '444px', bottom: '10px', left: '20px' }
      act(() => {
        window.dispatchEvent(new Event('resize'))
      })
      act(() => {
        rafCallbacks.splice(0).forEach((cb) => cb())
      })
      expect(fitViewSpy, 'the layout did not release the claim').toHaveBeenCalledTimes(2)

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

  /**
   * ⭐⭐ A LAYOUT PASS IS NOT A NEW MODEL — the half `claimCameraForUser` did not
   * cover (#1051 was a half-fix, and this is the other half).
   *
   * The layout trigger released the claim unconditionally, so the user's
   * overview survived only until the next layout. It did not have to be a new
   * model: `useMeasureThenLayout` re-lays out the model ALREADY on screen when a
   * card grows taller than the height the committed layout was computed against
   * (late measurement, or analysis adding content to a card). Measured in real
   * Chromium at 1280x800 on `build-vs-buy`, the camera went 0.5000 -> 0.2907
   * (the user's overview, whole model framed) -> 0.5000, back to EXACTLY the
   * pre-click camera, 587ms after the click — leaving 10 of 19 model nodes
   * outside the visible canvas.
   *
   * ⚠ WHAT THESE jsdom CASES PROVE. The SEAM only: whether the trigger issues a
   * fit. jsdom has no layout, so nothing here is evidence about what a user can
   * see; that half is `e2e/geometry/showWholeModel.measure.ts`, in real
   * Chromium, where the two are a discriminating pair — reverting the fix REDs
   * the first arm, and dropping the model-key conjunct alone REDs the second.
   */
  describe('a layout of the SAME model does not take the user\'s frame', () => {
    /** A model identity the store can hold; the ids are what the key hashes. */
    const MODEL_A = [{ id: 'dec_1', position: { x: 0, y: 0 }, data: {} }]
    const MODEL_B = [{ id: 'dec_2', position: { x: 0, y: 0 }, data: {} }]

    function setup() {
      const rafCallbacks: Array<() => void> = []
      const rafSpy = vi
        .spyOn(globalThis, 'requestAnimationFrame')
        .mockImplementation((cb: FrameRequestCallback) => {
          rafCallbacks.push(cb as () => void)
          return rafCallbacks.length
        })
      const flush = () =>
        act(() => {
          rafCallbacks.splice(0).forEach((cb) => cb())
        })
      renderHook(() => useFitViewOnLayoutVersion())
      // The product frames the model once. This is what stamps "the model I am
      // looking at" — without it the comparison below has nothing to compare to.
      //
      // ⚠ EVERY LAYOUT IN THIS DESCRIBE IS MARKED `'product'` EXPLICITLY, and
      // that is not tidying. The guard is a CONJUNCTION — `layoutWasAutomatic &&
      // userOwnsCameraFor(currentModelKey())` — so a case that leaves the
      // initiator at the store default of `'user'` exits on the FIRST conjunct
      // and never reaches the model key these cases exist to test. They would
      // stay green under a mutant that deleted the key entirely: a guard
      // agreeing with itself (CLAUDE.md trap 13b). Naming the initiator is what
      // keeps them pointed at the key. The initiator's own directions are
      // `useFitViewOnLayoutVersion.userOverview.spec.tsx`.
      act(() => {
        useCanvasStore.setState({ nodes: MODEL_A, layoutVersion: 1, lastLayoutInitiatedBy: 'product' } as never)
      })
      flush()
      expect(fitViewSpy, 'the product must frame the model first').toHaveBeenCalledTimes(1)
      return { flush, rafSpy }
    }

    it('honours the claim when the model is the one already framed', () => {
      const { flush, rafSpy } = setup()

      claimCameraForUser(currentModelKey())
      // A corrective re-layout: same nodes, same ids, only the geometry redone.
      act(() => {
        useCanvasStore.setState({ nodes: MODEL_A, layoutVersion: 2, lastLayoutInitiatedBy: 'product' } as never)
      })
      flush()

      expect(
        fitViewSpy,
        "a re-layout of the SAME model re-framed a camera the user had explicitly framed",
      ).toHaveBeenCalledTimes(1)

      rafSpy.mockRestore()
    })

    it('releases the claim when a DIFFERENT model arrives', () => {
      // The opposite-direction twin (CLAUDE.md trap 22b). Without this the case
      // above is equally satisfied by honouring the claim unconditionally, which
      // would strand the camera on a model that no longer exists — the harm
      // `utils/userCameraClaim.ts` warns about in its scope note. Proven live:
      // dropping the model-key conjunct leaves a new model at zoom 0.3233,
      // never re-aimed.
      const { flush, rafSpy } = setup()

      claimCameraForUser(currentModelKey())
      act(() => {
        useCanvasStore.setState({ nodes: MODEL_B, layoutVersion: 2, lastLayoutInitiatedBy: 'product' } as never)
      })
      flush()

      expect(
        fitViewSpy,
        'a new model arrived and the product did not frame it — a stale claim stranded the camera',
      ).toHaveBeenCalledTimes(2)

      rafSpy.mockRestore()
    })
  })

  /**
   * ⭐⭐ THE KEY MUST BE THE ONE THE USER CLAIMED, NOT THE ONE THE PRODUCT LAST
   * FRAMED — trap 21 recurring ONE LEVEL BELOW the instance it was introduced to
   * fix, and found in review of #1096.
   *
   * The first fix compared the corrective layout against `lastFramedModelRef`,
   * stamped inside `fitNow` — i.e. on the PRODUCT's fit. The user's own fit does
   * not go through `fitNow`, so an ordinary edit between the product's fit and
   * the user's click left the reference stale:
   *
   *   1. the product frames model A            -> ref = key(A)
   *   2. the user adds a node                  -> the model is now A'
   *   3. the user clicks "Show whole model"    -> claim taken, ref STILL key(A)
   *   4. a corrective layout compares A' to A  -> "a different model arrived",
   *      releases the claim and overwrites the user's frame
   *
   * Reachable by an ordinary edit-then-click, verified at the bytes rather than
   * assumed: `store.ts` has exactly ONE write to `layoutVersion` (inside
   * `applyLayout`), and neither `addNode` nor `deleteNodeById` calls
   * `setPendingLayout`, so step 2 changes the model WITHOUT laying it out. The
   * corrective pass in `useMeasureThenLayout` then calls `applyLayout` directly.
   *
   * The ref answered "which model did the PRODUCT last frame?"; the code needed
   * "which model did the USER claim?". Two questions, one ref. The key is now
   * taken AT CLAIM TIME, by the claim itself.
   */
  describe('the claim is keyed to the model the USER claimed', () => {
    const MODEL_A = [{ id: 'dec_1', position: { x: 0, y: 0 }, data: {} }]
    /** A, plus one node the user added — a DIFFERENT identity, same session. */
    const MODEL_A_PRIME = [
      { id: 'dec_1', position: { x: 0, y: 0 }, data: {} },
      { id: 'opt_new', position: { x: 0, y: 0 }, data: {} },
    ]
    const MODEL_B = [{ id: 'dec_2', position: { x: 0, y: 0 }, data: {} }]

    function setup() {
      const rafCallbacks: Array<() => void> = []
      const rafSpy = vi
        .spyOn(globalThis, 'requestAnimationFrame')
        .mockImplementation((cb: FrameRequestCallback) => {
          rafCallbacks.push(cb as () => void)
          return rafCallbacks.length
        })
      const flush = () =>
        act(() => {
          rafCallbacks.splice(0).forEach((cb) => cb())
        })
      renderHook(() => useFitViewOnLayoutVersion())
      act(() => {
        useCanvasStore.setState({ nodes: MODEL_A, layoutVersion: 1, lastLayoutInitiatedBy: 'product' } as never)
      })
      flush()
      expect(fitViewSpy, 'the product must frame the model first').toHaveBeenCalledTimes(1)
      return { flush, rafSpy }
    }

    it("survives a corrective layout after the user EDITED the model then claimed", () => {
      const { flush, rafSpy } = setup()

      // The user edits — no layout, so nothing re-frames and nothing re-stamps.
      act(() => {
        useCanvasStore.setState({ nodes: MODEL_A_PRIME } as never)
      })
      // ...and THEN asks for the overview. The claim is taken on A'.
      claimCameraForUser(currentModelKey())

      // A corrective pass on that same edited model.
      act(() => {
        useCanvasStore.setState({ nodes: MODEL_A_PRIME, layoutVersion: 2, lastLayoutInitiatedBy: 'product' } as never)
      })
      flush()

      expect(
        fitViewSpy,
        "an edit before the click made the reference stale, so a corrective layout read the user's own model as a new one and overwrote their frame",
      ).toHaveBeenCalledTimes(1)

      rafSpy.mockRestore()
    })

    it('and the claim still STANDS afterwards — a reserved-box change cannot re-fit either', () => {
      // ⚠ THIS IS WHAT MAKES THE CASE ABOVE ABOUT OWNERSHIP RATHER THAN ABOUT ONE
      // SUPPRESSED CALL. Without it, a fix that merely skipped this particular
      // fit would pass while the claim had already been thrown away.
      const { flush, rafSpy } = setup()

      act(() => {
        useCanvasStore.setState({ nodes: MODEL_A_PRIME } as never)
      })
      claimCameraForUser(currentModelKey())
      act(() => {
        useCanvasStore.setState({ nodes: MODEL_A_PRIME, layoutVersion: 2, lastLayoutInitiatedBy: 'product' } as never)
      })
      flush()

      // The reserved box then changes for real — the stimulus the suite proves
      // elsewhere DOES re-fit, so this cannot pass because nothing moved.
      currentPadding = { top: '10px', right: '444px', bottom: '10px', left: '20px' }
      act(() => {
        window.dispatchEvent(new Event('resize'))
      })
      flush()

      expect(
        fitViewSpy,
        'the corrective layout consumed the claim — the user no longer owns the camera',
      ).toHaveBeenCalledTimes(1)

      rafSpy.mockRestore()
    })

    it('but a genuinely NEW model still re-fits, claim or no claim', () => {
      // The falsifier (CLAUDE.md trap 22b). Without this, "never release" passes
      // both cases above and strands the camera on a model that no longer exists.
      const { flush, rafSpy } = setup()

      act(() => {
        useCanvasStore.setState({ nodes: MODEL_A_PRIME } as never)
      })
      claimCameraForUser(currentModelKey())

      act(() => {
        useCanvasStore.setState({ nodes: MODEL_B, layoutVersion: 2, lastLayoutInitiatedBy: 'product' } as never)
      })
      flush()

      expect(
        fitViewSpy,
        'a new model arrived and the product did not frame it — a stale claim stranded the camera',
      ).toHaveBeenCalledTimes(2)

      rafSpy.mockRestore()
    })
  })
})
