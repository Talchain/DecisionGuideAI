/**
 * WHO IS ALLOWED TO MOVE THE CAMERA WHEN A LAYOUT COMPLETES — all three
 * directions, pinned separately.
 *
 * ⭐⭐ THIS FILE EXISTS BECAUSE THE FIX AND ITS INVERSE WERE BOTH SHIPPED, AS TWO
 * SEPARATE PULL REQUESTS, ON THE SAME DAY. #1096 keyed the claim to the model
 * and closed the corrective-layout door; #1097 added the initiator and closed
 * the Auto-arrange door. Each was correct about its own harm and re-opened the
 * other's, and neither was a superset of the other — which is CLAUDE.md trap 22b
 * exactly: one predicate cannot carry two harms in opposite directions. The
 * production guard is therefore a CONJUNCTION,
 *
 *     if (layoutWasAutomatic && userOwnsCameraFor(currentModelKey())) return
 *
 * and the three cases below are the three directions it has to get right at
 * once. A mutant that deletes EITHER conjunct REDs here, and each REDs on its
 * OWN assertion — that pair is what proves the two halves are independently
 * pinned rather than one case covering both by accident.
 *
 * ⭐⭐ THE DEFECT DIRECTION 2 PINS (measured 1 Sep 2026, real Chromium at
 * 1280x720 with the render loop asserted live, on the five shipped starters).
 * "Show whole model" reaches the overview and the product takes it back ~1s
 * later:
 *
 *     starter                lv          after the click
 *     vendor-selection       4 -> 6      0.5000, 7 of 19 off-pane
 *     pricing-model          2 -> 4      0.5000, 1 of 15 off-pane
 *     build-vs-buy           3 -> 5      0.5000, 10 of 19 off-pane
 *     headcount-allocation   2 -> 4      0.5000, 1 of 16 off-pane
 *     market-entry           4 -> 4      0.3208, 0 of 18 off-pane  <- CONTROL
 *
 * `market-entry` is the control that names the mechanism rather than guessing at
 * it: the ONE starter where no corrective layout fired is the ONE where the
 * overview survived. The mechanism is a loop the user's own click starts — going
 * below `LABEL_LEGIBLE_ZOOM` puts the canvas into level-of-detail, cards render
 * less, their MEASURED HEIGHTS change, and `useMeasureThenLayout`'s corrective
 * pass lays out again.
 *
 * ⚠ WHAT THIS FILE IS AND IS NOT. jsdom cannot prove visibility (CLAUDE.md trap
 * 3), so this spec pins the DECISION — who is allowed to move the camera — and
 * NOTHING about pixels. No claim here is evidence that a user can see the whole
 * model. The geometry half is `e2e/geometry/draftFitCameraOwnership.measure.ts`
 * and `e2e/geometry/showWholeModel.measure.ts`, in real Chromium, in a page
 * whose `requestAnimationFrame` is asserted alive first — a starved render loop
 * freezes every animated camera move part-way and is indistinguishable from this
 * defect, which is how it came to be filed with the wrong root cause.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { useFitViewOnLayoutVersion } from '../hooks/useFitViewOnLayoutVersion'
import {
  claimCameraForUser,
  releaseUserCameraClaim,
  userOwnsCamera,
} from '../utils/userCameraClaim'
import { currentModelKey } from '../utils/currentModelKey'

const fitViewSpy = vi.fn()
let currentNodes: Array<{ id: string }> = []

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({ fitView: fitViewSpy, getNodes: () => currentNodes }),
}))

vi.mock('../utils/computeFitPadding', () => ({
  computeFitPadding: () => ({ top: '10px', right: '20px', bottom: '10px', left: '20px' }),
}))

function modelNodes(ids: string[]): Node[] {
  // Spread apart so `graphNeedsInitialLayout` reads these as REAL positions —
  // a stacked pile is a different state class and would latch off the triggers.
  return ids.map((id, i) => ({
    id,
    type: 'option',
    position: { x: i * 400, y: i * 260 },
    data: {},
  })) as unknown as Node[]
}

describe('the layout trigger and the user\'s camera', () => {
  let rafCallback: (() => void) | null = null

  beforeEach(() => {
    useCanvasStore.getState().resetCanvas()
    useCanvasStore.setState({ layoutVersion: 0, lastLayoutInitiatedBy: 'user' } as never)
    fitViewSpy.mockReset()
    currentNodes = []
    rafCallback = null
    // The claim is module state by design (see `utils/userCameraClaim.ts`), so
    // it is reset here rather than leaking between cases.
    releaseUserCameraClaim()
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      rafCallback = cb as () => void
      return 1
    })
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    releaseUserCameraClaim()
  })

  const runRaf = () => { rafCallback?.() }

  /**
   * A draft arrives and `useMeasureThenLayout` lays it out — `layoutVersion`
   * 0 -> 1, dispatched by the PRODUCT, with nobody having framed anything.
   *
   * Returns with the spy CLEARED, so every case below counts only what its own
   * stimulus caused.
   */
  function draftArrivesAndIsLaidOut(ids: string[]) {
    act(() => {
      useCanvasStore.setState({
        nodes: modelNodes(ids),
        edges: [] as Edge[],
        currentScenarioId: null,
        layoutVersion: 1,
        lastLayoutInitiatedBy: 'product',
      } as never)
    })
    act(() => { runRaf() })
    return {
      firstFits: fitViewSpy.mock.calls.length,
      clear: () => fitViewSpy.mockClear(),
    }
  }

  /**
   * ⭐ DIRECTION 1 — THE AUTOMATIC FIT STILL FIRES WHEN IT SHOULD.
   *
   * The owner's original failure was a drafted model rendering off-screen until
   * the page was reloaded. A guard that defers too readily reproduces it, and
   * this is the direction a model-key-free fix (`if (layoutWasAutomatic) return`)
   * destroys: EVERY automatic layout would defer, including the very first one a
   * draft gets, and nothing would ever aim the camera at a new model.
   */
  describe('direction 1 — an automatic layout with no claim outstanding still frames the model', () => {
    it('a fresh draft is framed by its FIRST automatic layout', () => {
      renderHook(() => useFitViewOnLayoutVersion())

      const { firstFits } = draftArrivesAndIsLaidOut(['a', 'b', 'c'])

      expect(
        firstFits,
        'a freshly drafted model was never framed — it renders wherever the layout left it, which is the failure that opened this defect',
      ).toBe(1)
    })

    it('and its corrective passes keep framing it while nobody has claimed the camera', () => {
      renderHook(() => useFitViewOnLayoutVersion())
      const { clear } = draftArrivesAndIsLaidOut(['a', 'b', 'c'])
      clear()
      // No `claimCameraForUser` — the post-draft corrective pass on a camera
      // nobody has taken, i.e. the overwhelmingly common path.

      act(() => {
        useCanvasStore.setState({ layoutVersion: 2, lastLayoutInitiatedBy: 'product' } as never)
      })
      act(() => { runRaf() })

      expect(
        fitViewSpy,
        'the ordinary post-draft re-fit stopped running — the fix over-applied and the model is left at whatever the first pass chose',
      ).toHaveBeenCalledTimes(1)
    })
  })

  /**
   * ⭐ DIRECTION 2 — AN AUTOMATIC RE-LAYOUT MAY NOT TAKE THE CAMERA FROM THE USER.
   *
   * The defect the measurement table above records. This is the direction an
   * initiator-only fix keeps, and the direction the guard would lose if the
   * `userOwnsCameraFor` conjunct were dropped in the OTHER sense (never
   * consulting the claim at all).
   */
  describe('direction 2 — an automatic re-layout of the claimed model leaves the user\'s frame alone', () => {
    it('THE DEFECT: a corrective pass on the same model does not re-fit', () => {
      renderHook(() => useFitViewOnLayoutVersion())
      const { clear } = draftArrivesAndIsLaidOut(['a', 'b', 'c'])
      clear()

      // The user takes the overview — the same call `ModelExtentNotice.showAll`,
      // the toolbar's "Fit to view" and the command palette's "Zoom to Fit"
      // make, bound by IDENTITY to the claim module rather than to a spy.
      claimCameraForUser(currentModelKey())

      // The corrective pass fires: SAME model, dispatched by the product.
      act(() => {
        useCanvasStore.setState({ layoutVersion: 2, lastLayoutInitiatedBy: 'product' } as never)
      })
      act(() => { runRaf() })

      expect(
        fitViewSpy,
        'the product re-fitted over the user\'s overview — this is #1051 through the layout trigger',
      ).not.toHaveBeenCalled()
    })

    it('and the claim STANDS afterwards, so the next reserved-box change cannot take it either', () => {
      // ⚠ THIS IS WHAT MAKES THE CASE ABOVE ABOUT OWNERSHIP RATHER THAN ABOUT ONE
      // SUPPRESSED CALL. Without it, a fix that merely skipped this particular
      // fit would pass while the claim had already been thrown away.
      renderHook(() => useFitViewOnLayoutVersion())
      const { clear } = draftArrivesAndIsLaidOut(['a', 'b', 'c'])
      clear()
      claimCameraForUser(currentModelKey())

      act(() => {
        useCanvasStore.setState({ layoutVersion: 2, lastLayoutInitiatedBy: 'product' } as never)
      })
      act(() => { runRaf() })

      expect(
        userOwnsCamera(),
        'the claim was released, so the very next reserved-box change would take the camera anyway',
      ).toBe(true)
    })

    it('TWIN — a CHANGED model still re-frames, so a stale claim cannot strand the camera', () => {
      // The opposite-direction twin (trap 22b). Without it, "honour the claim on
      // every automatic layout" satisfies both cases above while stranding the
      // camera on a model that no longer exists. Measured: dropping the model
      // key leaves a newly arrived model at the previous model's zoom of 0.3233,
      // never re-aimed.
      renderHook(() => useFitViewOnLayoutVersion())
      const { clear } = draftArrivesAndIsLaidOut(['a', 'b', 'c'])
      clear()
      claimCameraForUser(currentModelKey())

      // A new draft arrives while the claim is outstanding: different node set.
      act(() => {
        useCanvasStore.setState({
          nodes: modelNodes(['a', 'b', 'c', 'd']),
          layoutVersion: 2,
          lastLayoutInitiatedBy: 'product',
        } as never)
      })
      act(() => { runRaf() })

      expect(
        fitViewSpy,
        'the camera was stranded on a model that no longer exists',
      ).toHaveBeenCalledTimes(1)
      expect(userOwnsCamera(), 'a model that no longer exists still owned the camera').toBe(false)
    })
  })

  /**
   * ⭐ DIRECTION 3 — A LAYOUT THE USER ASKED FOR MUST STILL FIT.
   *
   * ⚠⚠ THIS IS THE HALF #1096 ALONE GETS WRONG, AND THE REASON THIS SPEC EXISTS
   * AS A CONJUNCTION RATHER THAN A KEY. Auto-arrange (`contextMenu/useMenuItems.ts`)
   * re-lays out THE MODEL THE USER IS LOOKING AT — same nodes, same edges, same
   * identity key — so a model-keyed claim is outstanding and matches, and the
   * fit is suppressed. Every node moves under a camera framed for the old
   * arrangement and the product never re-frames it. The user pressed a control
   * asking for a new arrangement; they are asking to be shown it.
   *
   * The user's own `applyLayout` call sites, complete manifest at this tip:
   * `contextMenu/useMenuItems.ts` (Auto-arrange), `layout/runLayoutWithProgress.ts`
   * (the command palette's re-layout), `store.ts`'s `setViewMode` follow-up, and
   * `EmptyState.tsx`'s first node. All four omit `initiatedBy`, which defaults to
   * `'user'` — the fail-safe direction is the pre-existing always-re-fit one.
   */
  describe('direction 3 — a layout the USER asked for re-frames, claim or no claim', () => {
    it('Auto-arrange re-frames the model it just re-arranged', () => {
      renderHook(() => useFitViewOnLayoutVersion())
      const { clear } = draftArrivesAndIsLaidOut(['a', 'b', 'c'])
      clear()
      claimCameraForUser(currentModelKey())

      // Auto-arrange: SAME model — identical ids, so the model key matches and
      // the claim is live. Only the initiator distinguishes this from the
      // corrective pass in direction 2.
      act(() => {
        useCanvasStore.setState({ layoutVersion: 2, lastLayoutInitiatedBy: 'user' } as never)
      })
      act(() => { runRaf() })

      expect(
        fitViewSpy,
        'Auto-arrange re-arranged every node under a camera framed for the OLD arrangement and never re-framed',
      ).toHaveBeenCalledTimes(1)
      expect(
        userOwnsCamera(),
        'a re-frame the user asked for hands the camera back to the product',
      ).toBe(false)
    })

    it('and it re-frames even after the user EDITED the model then claimed', () => {
      // The keyed-claim path from the other side. An edit with no layout changes
      // the model key (`store.ts` has exactly ONE write to `layoutVersion`, inside
      // `applyLayout`, and `addNode` never calls `setPendingLayout`), the claim is
      // then taken on the EDITED model, and Auto-arrange must still be shown.
      renderHook(() => useFitViewOnLayoutVersion())
      const { clear } = draftArrivesAndIsLaidOut(['a', 'b', 'c'])
      clear()

      act(() => {
        useCanvasStore.setState({ nodes: modelNodes(['a', 'b', 'c', 'added']) } as never)
      })
      claimCameraForUser(currentModelKey())

      act(() => {
        useCanvasStore.setState({ layoutVersion: 2, lastLayoutInitiatedBy: 'user' } as never)
      })
      act(() => { runRaf() })

      expect(
        fitViewSpy,
        'a user-requested layout of the edited model was suppressed',
      ).toHaveBeenCalledTimes(1)
    })
  })

  /**
   * ⭐⭐ THE DISCRIMINATION ITSELF, ASSERTED AS ONE OBJECT.
   *
   * A guard must pin its own precondition (trap 13b): each case above is a
   * separate `it`, so a branch that collapsed — always defer, or always fit —
   * would RED several of them, but nothing would state WHICH INPUT made the
   * difference. This runs the three inputs against ONE seated hook and asserts
   * they produce three different outcomes, so a probe that has stopped
   * discriminating cannot pass by agreeing with itself (trap 20: sameness across
   * inputs that ought to differ is evidence about the instrument).
   */
  it('the two conjuncts discriminate independently — three inputs, three outcomes', () => {
    renderHook(() => useFitViewOnLayoutVersion())
    const { clear } = draftArrivesAndIsLaidOut(['a', 'b', 'c'])
    clear()

    // (a) automatic + claimed + same model -> defer
    claimCameraForUser(currentModelKey())
    act(() => {
      useCanvasStore.setState({ layoutVersion: 2, lastLayoutInitiatedBy: 'product' } as never)
    })
    act(() => { runRaf() })
    const automaticWithClaim = fitViewSpy.mock.calls.length

    // (b) USER-initiated, claim still outstanding, same model -> fit
    fitViewSpy.mockClear()
    claimCameraForUser(currentModelKey())
    act(() => {
      useCanvasStore.setState({ layoutVersion: 3, lastLayoutInitiatedBy: 'user' } as never)
    })
    act(() => { runRaf() })
    const userInitiated = fitViewSpy.mock.calls.length

    // (c) automatic, NO claim outstanding (b released it), same model -> fit
    fitViewSpy.mockClear()
    act(() => {
      useCanvasStore.setState({ layoutVersion: 4, lastLayoutInitiatedBy: 'product' } as never)
    })
    act(() => { runRaf() })
    const automaticWithoutClaim = fitViewSpy.mock.calls.length

    expect(
      { automaticWithClaim, userInitiated, automaticWithoutClaim },
      'the guard is not discriminating on both inputs independently',
    ).toEqual({ automaticWithClaim: 0, userInitiated: 1, automaticWithoutClaim: 1 })
  })
})
