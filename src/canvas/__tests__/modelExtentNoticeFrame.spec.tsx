/**
 * THE EXTENT NOTICE MEASURES AGAINST THE FIT'S FRAME, NEVER THE NO-CHURN GATE'S.
 *
 * ⭐⭐ THE DEFECT THIS PINS — MEASURED ON DEPLOYED STAGING `f585969d`, real
 * Chromium, 1280x800, five shipped starters, rAF asserted live at 121-122
 * ticks/s. With the floating Olumi companion OPEN the product displayed:
 *
 *     Customer Data Platform Selection     "Showing 0 of 19 elements"
 *     International Expansion Strategy     "Showing 0 of 18 elements"
 *     Usage-Based Billing System Approach  "Showing 0 of 19 elements"
 *
 * while a hit-test over every model node found NINE of them on screen and
 * un-occluded, at `translate(369px, 61px) scale(0.5)` — a normal, correctly
 * fitted camera. Sampled every second for twenty seconds: it never settles.
 *
 * ⚠ THE CAUSE IS A FRAME FORK THAT `useFitViewOnLayoutVersion` ALREADY NAMES,
 * and this component took the wrong side of it. `readFocusCamera` returns TWO
 * frames from one measurement (see `cameraComfort`'s header):
 *
 *   - `padding`  — what the FIT frames into. Edge-anchored chrome only.
 *   - `insets`   — the no-churn GATE frame: that same padding, widened by
 *                  whatever the free-floating companion occludes.
 *
 * The GATE answers *"should the camera move?"*, for which counting an occluded
 * node as uncomfortable is correct and fail-closed. The NOTICE answers *"how
 * many elements can the person see?"*, which is a claim about the screen. A
 * `fitView` inset is a FULL BAND, so clearing a 436x550 panel floating in the
 * middle of the pane costs the ENTIRE bottom 691px of an 800px pane —
 * including the wide, completely unoccluded regions to its left and right.
 * Every node then falls outside, and the product tells the user it is showing
 * nothing while showing a third of the model.
 *
 * The frame is not DEGENERATE (117 > 65), so `countNodesOutsideFrame` returns
 * a count rather than `null` and the notice renders — which is why this
 * shipped as a false sentence rather than as a missing one.
 *
 * `fitNow` gets this right and says so: *"THE FRAME IS THE FIT'S, NOT THE
 * GATE'S … `readFocusCamera` is consulted ONLY for the pane measurement."*
 * This is that same rule, for the surface that STATES the result to a person.
 * (CLAUDE.md trap 21 — two questions under one name.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { countNodesOutsideFrame, paddingToInsets, readFocusCamera } from '../utils/cameraComfort'
import { computeFitPadding } from '../utils/computeFitPadding'

/** The camera the fixture pins — the measured staging value, not a round number. */
const VIEWPORT = { x: 369, y: 61, zoom: 0.5 }

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react')
  return {
    ...actual,
    // `importOriginal`-spread, never a hand-listed allowlist (CLAUDE.md trap 12).
    useReactFlow: () => ({
      getViewport: () => VIEWPORT,
      fitView: vi.fn(),
      getNodes: () => [],
      setViewport: vi.fn(),
    }),
    useStore: (selector: (s: { transform: [number, number, number] }) => unknown) =>
      selector({ transform: [VIEWPORT.x, VIEWPORT.y, VIEWPORT.zoom] }),
  }
})

import { ModelExtentNotice } from '../components/ModelExtentNotice'
import { useCanvasStore } from '../store'

/** The rects measured on deployed staging at 1280x800 with the companion open. */
const PANE = { left: 0, top: 0, right: 1280, bottom: 800, width: 1280, height: 800 }
const CHROME: Array<[string, string, DOMRectLike]> = [
  ['aside', 'Outputs dock', { left: 852, top: 0, right: 1280, bottom: 800 }],
  ['nav', 'Canvas tools', { left: 0, top: 0, right: 60, bottom: 800 }],
]
interface DOMRectLike { left: number; top: number; right: number; bottom: number }

const stub = (el: HTMLElement, r: DOMRectLike) => {
  el.getBoundingClientRect = () =>
    ({ ...r, width: r.right - r.left, height: r.bottom - r.top, x: r.left, y: r.top, toJSON: () => r }) as DOMRect
}

function mountChrome({ companion }: { companion: boolean }): void {
  const flow = document.createElement('div')
  flow.className = 'react-flow'
  stub(flow, PANE)
  document.body.appendChild(flow)

  for (const [tag, label, rect] of CHROME) {
    const el = document.createElement(tag)
    el.setAttribute('aria-label', label)
    stub(el, rect)
    document.body.appendChild(el)
  }
  const banner = document.createElement('header')
  banner.setAttribute('role', 'banner')
  stub(banner, { left: 12, top: 12, right: 526, bottom: 57 })
  document.body.appendChild(banner)

  if (companion) {
    // The measured floating panel: 436x550, FLOATING IN THE MIDDLE of the pane
    // — not touching any edge, which is exactly why a rectangular inset for it
    // is so expensive.
    const panel = document.createElement('div')
    panel.setAttribute('data-testid', 'floating-olumi-panel')
    stub(panel, { left: 530, top: 125, right: 966, bottom: 675 })
    document.body.appendChild(panel)
  }
}

/**
 * Five model nodes at the fit-frame boundary: three sit inside the FIT frame,
 * and all five fall outside the companion-widened GATE frame. Bound by ID, so
 * the assertions below name objects rather than satisfying a value predicate
 * some other node could meet (CLAUDE.md trap 19).
 */
const NODES = [
  { id: 'dec_a', position: { x: -400, y: 100 }, measured: { width: 260, height: 120 } },
  { id: 'opt_b', position: { x: -100, y: 300 }, measured: { width: 260, height: 120 } },
  { id: 'opt_c', position: { x: 200, y: 500 }, measured: { width: 260, height: 120 } },
  { id: 'fac_d', position: { x: 200, y: 1600 }, measured: { width: 260, height: 120 } },
  { id: 'fac_e', position: { x: 200, y: 1900 }, measured: { width: 260, height: 120 } },
]

const setNodes = (nodes: unknown[]) => useCanvasStore.setState({ nodes: nodes as never })

beforeEach(() => {
  document.body.innerHTML = ''
})
afterEach(() => {
  document.body.innerHTML = ''
  setNodes([])
})

describe('ModelExtentNotice — the sentence is a claim about the SCREEN, so it uses the FIT frame', () => {
  it('PRECONDITION PIN: on this payload the two frames genuinely DISAGREE', () => {
    // ⭐ Without this the whole file could pass vacuously — a fixture that
    // stopped reproducing the fork would make both branches agree and every
    // assertion below would hold for the wrong reason (CLAUDE.md trap 13b).
    mountChrome({ companion: true })
    const cam = readFocusCamera(() => VIEWPORT)
    expect(cam, 'the pane must be measurable or every count below is null').not.toBeNull()

    const gateOutside = countNodesOutsideFrame(NODES, cam!.viewport, cam!.paneWidth, cam!.paneHeight, cam!.insets)
    const fitOutside = countNodesOutsideFrame(
      NODES, cam!.viewport, cam!.paneWidth, cam!.paneHeight, paddingToInsets(cam!.padding),
    )

    expect(cam!.insets, 'the companion must actually widen the gate frame').not.toEqual(
      paddingToInsets(cam!.padding),
    )
    expect(gateOutside, 'the GATE frame counts every node outside — the shipped defect').toBe(NODES.length)
    expect(fitOutside, 'the FIT frame counts only the genuinely off-frame nodes').toBe(2)
    expect(gateOutside).not.toBe(fitOutside)
  })

  it('with the companion OPEN it states what the fit frames, not what the gate excludes', () => {
    mountChrome({ companion: true })
    setNodes(NODES)
    render(<ModelExtentNotice />)

    // The shipped defect renders "Showing 0 of 5 elements" here.
    expect(screen.getByTestId('model-extent-count')).toHaveTextContent('Showing 3 of 5 elements')
  })

  it('POSITIVE CONTROL: with the companion ABSENT the count is unchanged', () => {
    // The fix must not be "ignore the companion and therefore report more" — the
    // no-companion case is the one that was already right, and it must stay so.
    mountChrome({ companion: false })
    setNodes(NODES)
    render(<ModelExtentNotice />)

    expect(screen.getByTestId('model-extent-count')).toHaveTextContent('Showing 3 of 5 elements')
  })

  it('CONTRAST CONTROL: it still reports genuinely off-frame nodes, and stays away when nothing is', () => {
    // Absence of a notice must be earned, not manufactured by a frame so wide
    // that nothing can fall outside it.
    mountChrome({ companion: true })
    const cam = readFocusCamera(() => VIEWPORT)!
    const fitInsets = paddingToInsets(computeFitPadding(document.querySelector('.react-flow')))
    expect(fitInsets, 'the fit padding is what the notice must measure against').toEqual(
      paddingToInsets(cam.padding),
    )

    const allInside = [NODES[0], NODES[1], NODES[2]]
    expect(
      countNodesOutsideFrame(allInside, cam.viewport, cam.paneWidth, cam.paneHeight, fitInsets),
      'these three are inside the fit frame — the notice must not appear for them',
    ).toBe(0)

    setNodes(allInside)
    const { container } = render(<ModelExtentNotice />)
    expect(container.querySelector('[data-testid="model-extent-notice"]')).toBeNull()
  })
})

/**
 * ⭐⭐ THE SAME SENTENCE, FALSE FOR A DIFFERENT REASON — AND ON EVERY USER'S
 * FIRST VIEW.
 *
 * Measured on the deployed build `f59ffc26`, 18 timed runs on the Playwright
 * geometry harness with `assertPaneCanRenderGeometry` passing (real geometry,
 * not a hidden-pane reading):
 *
 *   t=    0ms  zoom=4    lv=0  pending=true   "Showing 0 of 18 elements"
 *   t= 3005ms  zoom=0.5  lv=2  pending=false  "Showing 10 of 18 elements"
 *
 * 18/18 runs pass through that state; 18/18 heal; none stick. Heal time ranged
 * from 1.05s to 17.0s.
 *
 * `zoom=4` is the canvas ceiling (`maxZoom={4}`), reached when a fit runs
 * against a degenerate content bounding box because the nodes have not been
 * measured yet. The count is taken against the camera frame, so a degenerate
 * camera corrupts it directly — "Showing 0 of 18" is arithmetically correct
 * about a camera that is briefly nonsense.
 *
 * ⚠ NOTE WHAT IT SHARES WITH THE DEFECT ABOVE, because that is why both live in
 * this file: in each case the ARITHMETIC is right and the FRAME is wrong, so no
 * amount of testing the count could have found either. And in each case the
 * remedy argument settles it — this notice's only action is a camera move, and
 * no camera move repairs a bounding box that has not been computed yet.
 *
 * ⚠ The 1s-17s spread is measured but NOT explained. Nothing here depends on a
 * bound for it; the suppression is keyed on the pipeline's own flags.
 */
describe('ModelExtentNotice — no count while the layout pipeline is still unsettled', () => {
  const setLayout = (s: { pendingLayout?: boolean; layoutInProgress?: boolean }) =>
    useCanvasStore.setState(s as never)

  afterEach(() => setLayout({ pendingLayout: false, layoutInProgress: false }))

  it('POSITIVE CONTROL: with the layout settled, this payload DOES render a count', () => {
    // Trap 13, and it is the whole file's hinge: three of the four assertions
    // below are absences, and an absence proves nothing unless the same fixture
    // can be shown producing a presence.
    mountChrome({ companion: false })
    setNodes(NODES)
    setLayout({ pendingLayout: false, layoutInProgress: false })
    render(<ModelExtentNotice />)
    expect(screen.getByTestId('model-extent-count')).toHaveTextContent('Showing 3 of 5 elements')
  })

  it('says NOTHING while a layout is pending', () => {
    mountChrome({ companion: false })
    setNodes(NODES)
    setLayout({ pendingLayout: true })
    const { container } = render(<ModelExtentNotice />)
    expect(container.querySelector('[data-testid="model-extent-notice"]')).toBeNull()
  })

  it('says NOTHING while a layout is mid-flight', () => {
    // `layoutInProgress` is the same unsettled state one step later in the same
    // pipeline. The predicate is written against the SPEC — "the layout has not
    // settled" — rather than against `pending=true`, which is merely the flag
    // the measurement happened to catch (CLAUDE.md trap 13d).
    mountChrome({ companion: false })
    setNodes(NODES)
    setLayout({ layoutInProgress: true })
    const { container } = render(<ModelExtentNotice />)
    expect(container.querySelector('[data-testid="model-extent-notice"]')).toBeNull()
  })

  it('CONTRAST CONTROL: the count returns once the pipeline settles', () => {
    // Suppression must be TRANSIENT. A guard that hid the notice for good would
    // pass all three assertions above and silently delete a real capability.
    mountChrome({ companion: false })
    setNodes(NODES)
    setLayout({ pendingLayout: true })
    const view = render(<ModelExtentNotice />)
    expect(view.container.querySelector('[data-testid="model-extent-notice"]')).toBeNull()

    setLayout({ pendingLayout: false })
    view.rerender(<ModelExtentNotice />)
    expect(screen.getByTestId('model-extent-count')).toHaveTextContent('Showing 3 of 5 elements')
  })
})
