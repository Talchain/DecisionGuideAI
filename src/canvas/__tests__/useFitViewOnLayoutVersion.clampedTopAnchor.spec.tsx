/**
 * THE CLAMPED EXIT — `fitNow`'s top-anchored `setViewport`, which had ZERO
 * coverage while being the exit the product actually takes on every restored
 * model at the smallest desktop this PoC commits to.
 *
 * ⭐⭐ WHY THIS FILE EXISTS, AND WHY ITS NUMBERS ARE NOT INVENTED.
 *
 * `fitNow` has two exits: an animated `setViewport` to the top-anchored viewport
 * when the fit would clamp below `LABEL_LEGIBLE_ZOOM`, and `fitView` otherwise.
 * Until this file, `setViewport` appeared in NO `useFitViewOnLayoutVersion`
 * spec — contrast control: `fitView` appears in all four. The cause is the
 * harness, not an oversight about behaviour: every sibling spec mocks
 * `useReactFlow` as `{ fitView, getNodes }`, so `setViewportRef` is `undefined`,
 * and `readFocusCamera` returns null in jsdom anyway (it needs a laid-out
 * `.react-flow` element). The branch was UNREACHABLE by construction, and a
 * camera exit no test can reach is a defect in its own right whatever lives
 * behind it (CLAUDE.md trap 13 — an absence probe with no positive control).
 *
 * ⭐⭐ THE EXPECTATION IS A MEASUREMENT, NOT THIS FILE'S OWN ARITHMETIC. Restating
 * the implementation's formula here would be a guard agreeing with itself
 * (CLAUDE.md trap 13b); deriving the expected viewport by calling
 * `topAnchoredViewportWhenClamped` would be the same thing wearing an import.
 * So the oracle comes from OUTSIDE this repo: driven in real headless Chromium
 * (rAF confirmed firing at 60/s, `document.hidden === false`) against DEPLOYED
 * staging `83f20058` — whose camera path is byte-identical to the witness build
 * `1c8009e4`, the only intervening commit touching these files being #1108,
 * which changed no camera logic. Guest -> `build-vs-buy` -> a REAL page load ->
 * settled in the restore class (`layoutVersion` 0 for 30s):
 *
 *     pane        1280 x 800
 *     insets      top 73  right 444  bottom 29  left 76   (dock expanded)
 *     bounds      x 24  y 24  w 1052  h 2768
 *     zoomToFit   0.2522   -> BELOW the 0.5 floor, so the fit CLAMPS
 *     observed    translate(181px, 61px) scale(0.5)
 *
 * A clamped-and-RE-CENTRED `fitView` would have produced y = -282 at that same
 * tip. It produced y = 61. That discrimination — not the zoom, which both exits
 * clamp to 0.5 — is what identifies the live exit as `setViewport`, and 181/61
 * is what this file asserts. All five shipped starters settle at exactly
 * `scale(0.5)` with y = 61, so this is the ordinary case, not a corner.
 *
 * ⚠ WHAT THIS FILE IS NOT. It is not a regression test for the reported
 * "Auto-arrange does not re-frame after a reload" defect. That defect did NOT
 * reproduce on the deployed build: six live runs — all five starters plus an
 * outstanding-user-claim variant — each panned to 0-of-N visible in the restore
 * class, and every one re-framed within ~700ms. See the PR body. These arms are
 * GREEN at a tip where the witness says the defect is live, and a green run here
 * must never be reported as evidence that it is fixed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { getNodesBounds } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { useFitViewOnLayoutVersion } from '../hooks/useFitViewOnLayoutVersion'
import { GHOST_OPTION_NODE_ID } from '../utils/fitTargets'
import { LABEL_LEGIBLE_ZOOM } from '../utils/zoomLegibility'

/** The deployed measurement above, spelled once. */
const PANE = { width: 1280, height: 800 }
const DEPLOYED_INSETS = { top: '73px', right: '444px', bottom: '29px', left: '76px' }
/** The viewport deployed staging was measured parking at. THE ORACLE. */
const DEPLOYED_TOP_ANCHORED = { x: 181, y: 61, zoom: 0.5 }
const NODE_W = 200
const NODE_H = 80

const fitViewSpy = vi.fn()
const setViewportSpy = vi.fn()
const getViewportSpy = vi.fn(() => currentViewport)

/** Where the camera is when the trigger fires — panned far away, as the witness had it. */
let currentViewport = { x: -919, y: -639, zoom: 0.5 }
let currentPadding: Record<string, string> = DEPLOYED_INSETS
let currentNodes: Array<Record<string, unknown>> = []

vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xyflow/react')>()),
  // ⭐ THE WHOLE POINT OF THIS FILE: the instance carries the camera writers the
  // sibling specs omit, so the clamped exit is reachable at all.
  useReactFlow: () => ({
    fitView: fitViewSpy,
    getNodes: () => currentNodes,
    getViewport: getViewportSpy,
    setViewport: setViewportSpy,
  }),
}))

vi.mock('../utils/computeFitPadding', () => ({
  computeFitPadding: () => currentPadding,
}))

type PendingFrame = { id: number; cb: () => void }
let frames: PendingFrame[] = []
let nextFrameId = 0

function spyOnRaf() {
  frames = []
  nextFrameId = 0
  const raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
    nextFrameId += 1
    frames.push({ id: nextFrameId, cb: cb as unknown as () => void })
    return nextFrameId
  })
  const caf = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id: number) => {
    frames = frames.filter((f) => f.id !== id)
  })
  return { restore: () => { raf.mockRestore(); caf.mockRestore() } }
}

const flushFrames = () => act(() => {
  const due = frames
  frames = []
  due.forEach((f) => f.cb())
})

/**
 * A measurable `.react-flow` element. `readFocusCamera` returns null without
 * one, which is precisely why jsdom could never reach the clamped exit.
 */
let paneEl: HTMLDivElement | null = null
function mountPane(size = PANE) {
  paneEl = document.createElement('div')
  paneEl.className = 'react-flow'
  paneEl.getBoundingClientRect = () => ({
    left: 0, top: 0, right: size.width, bottom: size.height,
    width: size.width, height: size.height, x: 0, y: 0, toJSON: () => ({}),
  }) as DOMRect
  document.body.appendChild(paneEl)
}

/**
 * Two model nodes whose REAL `getNodesBounds` is the deployed
 * `{ x: 24, y: 24, width: 1052, height: 2768 }`. Tall enough that the fit
 * clamps, which is the condition under test.
 */
function clampingNodes() {
  return [
    { id: 'n-decision', position: { x: 24, y: 24 }, measured: { width: NODE_W, height: NODE_H }, data: {} },
    { id: 'n-goal', position: { x: 876, y: 2712 }, measured: { width: NODE_W, height: NODE_H }, data: {} },
  ]
}

/** The same model, short enough that the fit does NOT clamp. */
function fittingNodes() {
  return [
    { id: 'n-decision', position: { x: 24, y: 24 }, measured: { width: NODE_W, height: NODE_H }, data: {} },
    { id: 'n-goal', position: { x: 876, y: 844 }, measured: { width: NODE_W, height: NODE_H }, data: {} },
  ]
}

/** The user's Auto-arrange, as `applyLayout` commits it. */
function userLayoutCommit() {
  useCanvasStore.setState({
    layoutVersion: useCanvasStore.getState().layoutVersion + 1,
    pendingLayout: false,
    lastLayoutInitiatedBy: 'user',
  } as never)
}

describe("fitNow's CLAMPED exit — the top-anchored setViewport", () => {
  let rafSpy: ReturnType<typeof spyOnRaf>

  beforeEach(() => {
    useCanvasStore.getState().resetCanvas()
    useCanvasStore.setState({
      layoutVersion: 0, pendingLayout: false, layoutInProgress: false, lastLayoutInitiatedBy: 'user',
    } as never)
    fitViewSpy.mockReset()
    setViewportSpy.mockReset()
    getViewportSpy.mockClear()
    currentPadding = DEPLOYED_INSETS
    currentViewport = { x: -919, y: -639, zoom: 0.5 }
    currentNodes = []
    mountPane()
    rafSpy = spyOnRaf()
  })

  afterEach(() => {
    rafSpy.restore()
    paneEl?.remove()
    paneEl = null
    vi.restoreAllMocks()
  })

  it('PRECONDITION: the fixture reproduces the deployed bounds and clamps', () => {
    // ⚠ PINNED IN-TEST (CLAUDE.md trap 13b). Every assertion below is only about
    // the clamped exit if these hold; a library change to `getNodesBounds`, or a
    // typo in the fixture, must RED HERE rather than silently retarget the arms
    // at the other exit while they keep passing.
    const bounds = getNodesBounds(clampingNodes() as never)
    expect(bounds).toMatchObject({ x: 24, y: 24, width: 1052, height: 2768 })
    const frameW = PANE.width - 76 - 444
    const frameH = PANE.height - 73 - 29
    expect(Math.min(frameW / bounds.width, frameH / bounds.height)).toBeLessThan(LABEL_LEGIBLE_ZOOM)
  })

  it('the LAYOUT trigger takes the setViewport exit, at the viewport deployed staging was measured parking at', () => {
    currentNodes = clampingNodes()
    renderHook(() => useFitViewOnLayoutVersion())

    act(() => { userLayoutCommit() })
    flushFrames()

    expect(setViewportSpy, 'the clamped exit must be taken').toHaveBeenCalledTimes(1)
    expect(setViewportSpy.mock.calls[0][0]).toEqual(DEPLOYED_TOP_ANCHORED)
    expect(setViewportSpy.mock.calls[0][1]).toMatchObject({ duration: 400 })
    // ⭐ THE EXITS ARE EXCLUSIVE, and saying so is what stops a future change
    // firing BOTH — two camera writes in one frame, the second winning silently.
    expect(fitViewSpy, 'the clamped exit RETURNS; fitView must not also run').not.toHaveBeenCalled()
  })

  it('CONTRAST: a model that fits legibly takes the fitView exit instead', () => {
    // Without this arm, the arm above passes just as happily against a hook that
    // called setViewport unconditionally — it would prove sensitivity to nothing.
    currentNodes = fittingNodes()
    renderHook(() => useFitViewOnLayoutVersion())

    act(() => { userLayoutCommit() })
    flushFrames()

    expect(setViewportSpy, 'an unclamped fit must NOT top-anchor').not.toHaveBeenCalled()
    expect(fitViewSpy).toHaveBeenCalledTimes(1)
  })

  it('the RESTORE trigger (the reloaded class, layoutVersion 0) takes the same clamped exit', () => {
    // This is the state class a page reload lands in and the one the witness
    // reported against: positions already real, `layoutVersion` 0 all session.
    currentNodes = clampingNodes()
    renderHook(() => useFitViewOnLayoutVersion())

    act(() => {
      useCanvasStore.setState({
        nodes: clampingNodes() as never,
        edges: [] as never,
        layoutVersion: 0,
        pendingLayout: false,
        layoutInProgress: false,
      } as never)
    })
    flushFrames()

    expect(useCanvasStore.getState().layoutVersion, 'precondition: reloaded class').toBe(0)
    expect(setViewportSpy, 'the restore fit clamps too, so it top-anchors').toHaveBeenCalledTimes(1)
    expect(setViewportSpy.mock.calls[0][0]).toEqual(DEPLOYED_TOP_ANCHORED)
    expect(fitViewSpy).not.toHaveBeenCalled()
  })

  it('the anchor is computed from MODEL nodes only — the ghost affordance cannot move the camera', () => {
    // Bound by IDENTITY, not by a value predicate (CLAUDE.md trap 19): the ghost
    // is placed where it WOULD widen the bounds, and the assertion is that the
    // camera lands on the same measured viewport as without it.
    currentNodes = [
      ...clampingNodes(),
      { id: GHOST_OPTION_NODE_ID, position: { x: 4000, y: 24 }, measured: { width: NODE_W, height: NODE_H }, data: {} },
    ]
    renderHook(() => useFitViewOnLayoutVersion())

    act(() => { userLayoutCommit() })
    flushFrames()

    expect(setViewportSpy).toHaveBeenCalledTimes(1)
    expect(setViewportSpy.mock.calls[0][0]).toEqual(DEPLOYED_TOP_ANCHORED)
  })
})
