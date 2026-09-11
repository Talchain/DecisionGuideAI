/**
 * THE CANVAS SAYS IT IS DRAWING — AND ITS COMPLEMENT STAYS QUIET WHILE IT DOES.
 *
 * ⭐⭐ THE DEFECT, MEASURED IN THIS DIRECTORY BEFORE THIS FILE EXISTED.
 * `ModelExtentNotice.tsx` records 18 timed runs on the Playwright geometry
 * harness against deployed staging `f59ffc26` (real geometry):
 * `pending=true` at t=0 in **18/18 runs**, healing between **1.05s and 17.0s**.
 * Throughout that window React Flow holds every node at `visibility: hidden`
 * and the canvas is BLANK — and the extent notice deliberately says nothing,
 * because "Showing 0 of 18 elements" would be false.
 *
 * So the product drew nothing and said nothing, for up to seventeen seconds,
 * on every load. The founder's report, 11 Sep 2026: *"No graph is being
 * displayed at all at the moment. I think there may be something broken behind
 * it."*
 *
 * ⭐ WHAT THIS FILE PINS THAT A CAVEAT'S SPEC USUALLY CANNOT. The two notices
 * are EXACT COMPLEMENTS on one boolean (`pendingLayout || layoutInProgress`),
 * so "the caveat appears" is not the property worth guarding — **exactly one of
 * the two speaks, in every layout state, on a non-empty model** is. A guard
 * that only proved this notice appears would pass just as happily if the extent
 * notice had started appearing beside it, which is the state the whole design
 * exists to prevent (CLAUDE.md trap 13b — a guard agreeing with itself).
 *
 * ⚠ EVERY ASSERTION BINDS BY TEST ID, never by a text predicate another overlay
 * could satisfy (CLAUDE.md trap 19).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

/**
 * The camera fixture is the extent notice's own measured staging value, reused
 * verbatim so the complement assertions exercise the REAL sibling rather than a
 * stub of it. A mock of the thing under comparison would make the invariant
 * vacuous.
 */
const VIEWPORT = { x: 369, y: 61, zoom: 0.5 }

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react')
  return {
    // `importOriginal`-spread, never a hand-listed allowlist (CLAUDE.md trap 12).
    ...actual,
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

import { CanvasDrawingNotice } from '../components/CanvasDrawingNotice'
import { ModelExtentNotice } from '../components/ModelExtentNotice'
import { OVERLAY_PRIORITY } from '../components/CanvasOverlayBand'
import { GHOST_ID_PREFIX } from '../utils/fitTargets'
import { useCanvasStore } from '../store'
import { useLayoutProgressStore } from '../layoutProgressStore'

interface DOMRectLike { left: number; top: number; right: number; bottom: number }
const stub = (el: HTMLElement, r: DOMRectLike) => {
  el.getBoundingClientRect = () =>
    ({ ...r, width: r.right - r.left, height: r.bottom - r.top, x: r.left, y: r.top, toJSON: () => r }) as DOMRect
}

/** The pane and chrome the extent notice measures against, at 1280x800. */
function mountChrome(): void {
  const flow = document.createElement('div')
  flow.className = 'react-flow'
  stub(flow, { left: 0, top: 0, right: 1280, bottom: 800 })
  document.body.appendChild(flow)

  const dock = document.createElement('aside')
  dock.setAttribute('aria-label', 'Outputs dock')
  stub(dock, { left: 852, top: 0, right: 1280, bottom: 800 })
  document.body.appendChild(dock)

  const tools = document.createElement('nav')
  tools.setAttribute('aria-label', 'Canvas tools')
  stub(tools, { left: 0, top: 0, right: 60, bottom: 800 })
  document.body.appendChild(tools)

  const banner = document.createElement('header')
  banner.setAttribute('role', 'banner')
  stub(banner, { left: 12, top: 12, right: 526, bottom: 57 })
  document.body.appendChild(banner)
}

/**
 * Model nodes far enough apart that some fall outside the fit frame — so the
 * extent notice has something TRUE to say once the layout settles. Without that
 * the complement test would pass because the sibling had nothing to report,
 * not because this notice had yielded to it.
 */
const NODES = [
  { id: 'dec_a', position: { x: -400, y: 100 }, measured: { width: 260, height: 120 } },
  { id: 'opt_b', position: { x: -100, y: 300 }, measured: { width: 260, height: 120 } },
  { id: 'opt_c', position: { x: 200, y: 500 }, measured: { width: 260, height: 120 } },
  { id: 'fac_d', position: { x: 200, y: 1600 }, measured: { width: 260, height: 120 } },
  { id: 'fac_e', position: { x: 200, y: 1900 }, measured: { width: 260, height: 120 } },
]

/** The four frontier prompts a blank canvas carries. Scaffolding, not a model. */
const GHOSTS_ONLY = [
  { id: `${GHOST_ID_PREFIX}option__`, position: { x: 0, y: 0 }, measured: { width: 200, height: 80 } },
  { id: `${GHOST_ID_PREFIX}factor__`, position: { x: 0, y: 200 }, measured: { width: 200, height: 80 } },
]

function setCanvas(nodes: unknown[], layout: { pendingLayout: boolean; layoutInProgress: boolean }) {
  useCanvasStore.setState({ nodes: nodes as never, ...layout })
}

const SETTLED = { pendingLayout: false, layoutInProgress: false }

beforeEach(() => {
  document.body.innerHTML = ''
  mountChrome()
  useLayoutProgressStore.setState({ status: 'idle', message: null, canRetry: false, retry: null })
})
afterEach(() => {
  document.body.innerHTML = ''
  setCanvas([], SETTLED)
})

describe('CanvasDrawingNotice — the blank window explains itself', () => {
  it('PRECONDITION PIN: the two flags are independently settable and start settled', () => {
    /**
     * ⭐ Without this every case below could pass for the wrong reason — a
     * store whose flags were pinned true, or absent, would make "appears while
     * unsettled" hold regardless of the component's predicate. This asserts the
     * fixture can actually move the thing the component reads.
     */
    setCanvas(NODES, SETTLED)
    expect(useCanvasStore.getState().pendingLayout).toBe(false)
    expect(useCanvasStore.getState().layoutInProgress).toBe(false)

    setCanvas(NODES, { pendingLayout: true, layoutInProgress: false })
    expect(useCanvasStore.getState().pendingLayout).toBe(true)

    setCanvas(NODES, { pendingLayout: false, layoutInProgress: true })
    expect(useCanvasStore.getState().layoutInProgress).toBe(true)
  })

  it('while the layout is pending it names what is happening, in words', () => {
    setCanvas(NODES, { pendingLayout: true, layoutInProgress: false })
    render(<CanvasDrawingNotice />)

    /**
     * ⚠ THE SENTENCE IS SPELLED OUT, not imported from the component. The
     * constant is deliberately not exported precisely so this assertion cannot
     * agree with whatever the component happens to say (CLAUDE.md trap 13b).
     */
    expect(screen.getByTestId('canvas-drawing-notice')).toHaveTextContent('Drawing your model…')
  })

  it('SIGN-SYMMETRY: `layoutInProgress` alone reaches it too, not only `pendingLayout`', () => {
    /**
     * ⚠ A predicate over two flags tested through only one of them is the
     * asymmetry that has cost this estate a shipped inverse (CLAUDE.md trap
     * 13d). These are two DIFFERENT rungs of the same pipeline — call sites
     * raise `pendingLayout` after inserting nodes, and `applyLayout` raises
     * `layoutInProgress` while it runs — so a user can be in either.
     */
    setCanvas(NODES, { pendingLayout: false, layoutInProgress: true })
    render(<CanvasDrawingNotice />)

    expect(screen.getByTestId('canvas-drawing-notice')).toBeInTheDocument()
  })

  it('once the layout settles it goes away', () => {
    setCanvas(NODES, SETTLED)
    render(<CanvasDrawingNotice />)

    expect(screen.queryByTestId('canvas-drawing-notice')).toBeNull()
  })

  it('⛔ a canvas holding ONLY frontier prompts is not a model being drawn', () => {
    /**
     * ⚠ NOT A DEFENSIVE BRANCH — A REACHABLE STATE. A blank canvas renders the
     * four "What else could you do? / drives this? / could go wrong? / could
     * this lead?" prompts and nothing else (witnessed on deployed `f5135281`,
     * guest path). Telling a user their nothing is being drawn is a false claim
     * with a friendly face, and the population is counted with the SAME
     * `excludeNonModelNodes` the extent notice totals with, so the two cannot
     * disagree about what a model contains.
     */
    setCanvas(GHOSTS_ONLY, { pendingLayout: true, layoutInProgress: true })
    render(<CanvasDrawingNotice />)

    expect(screen.queryByTestId('canvas-drawing-notice')).toBeNull()
  })

  it('⛔ an empty canvas says nothing at all', () => {
    setCanvas([], { pendingLayout: true, layoutInProgress: false })
    render(<CanvasDrawingNotice />)

    expect(screen.queryByTestId('canvas-drawing-notice')).toBeNull()
  })
})

describe("⛔ SILENT WHENEVER `LayoutProgressBanner` IS SPEAKING — the third surface", () => {
  /**
   * ⭐⭐ THE BLOCKING FINDING FROM REVIEW, AND MY COMPLETENESS CLAIM WAS THE BUG.
   *
   * I asserted "the two can never contend" in four places, derived against a
   * TWO-element enumeration. `LayoutProgressBanner` is a third surface: it
   * renders `fixed top-4 left-1/2 z-[3000]` from `ReactFlowGraph.tsx` — 45 lines
   * below this notice's own mount, inside the same provider, and NOT in
   * `OVERLAY_PRIORITY`, so the band's one-slot-one-occupant rule never reaches
   * it. An enumeration that stops at the surfaces you happen to know about is
   * not a completeness proof (CLAUDE.md trap 20).
   *
   * ⚠ Both non-idle states are pinned, not just the failing one. The review
   * asked for `!layoutFailed`; that closes the contradiction and leaves the
   * duplication open. These two cases are why the predicate is `status ===
   * 'idle'` instead.
   */
  it('⛔ a FAILED layout: the product must not reassure while it is asserting failure', () => {
    setCanvas(NODES, { pendingLayout: true, layoutInProgress: false })
    useLayoutProgressStore.setState({ status: 'error', message: 'Layout failed. Please try again.', canRetry: true })
    render(<CanvasDrawingNotice />)

    expect(screen.queryByTestId('canvas-drawing-notice')).toBeNull()
  })

  it('a LOADING layout: the banner already says it, and says it with Retry and Cancel', () => {
    setCanvas(NODES, { pendingLayout: false, layoutInProgress: true })
    useLayoutProgressStore.setState({ status: 'loading', message: 'Loading layout engine and applying layout...' })
    render(<CanvasDrawingNotice />)

    expect(screen.queryByTestId('canvas-drawing-notice')).toBeNull()
  })

  it('CONTRAST CONTROL: the SAME canvas state with an idle banner DOES speak', () => {
    /**
     * ⭐ Without this the two cases above would pass on a notice that had
     * stopped rendering for any reason at all. The canvas state is identical to
     * the failed case; only the banner's status differs, so the suppression is
     * provably the banner's doing (CLAUDE.md trap 13b).
     */
    setCanvas(NODES, { pendingLayout: true, layoutInProgress: false })
    useLayoutProgressStore.setState({ status: 'idle', message: null })
    render(<CanvasDrawingNotice />)

    expect(screen.getByTestId('canvas-drawing-notice')).toBeInTheDocument()
  })
})

describe('THE INVARIANT: AT MOST ONE of the pair speaks, in every layout state', () => {
  /**
   * ⭐⭐ THE PROPERTY, NOT THE SYMPTOM. Both components are rendered together in
   * both states, and each state asserts the presence of one AND the absence of
   * the other.
   *
   * ⚠ RENAMED FROM "exactly one" AFTER REVIEW. A settled layout with nothing
   * off-frame leaves BOTH silent — correct behaviour that "exactly one" would
   * forbid. The assertions below were always right; the NAME promised more than
   * they check, which is the next reader's false confidence. Asserting only presence would leave the estate's actual failure
   * mode — two notices claiming the same cell, which is the defect
   * `CanvasOverlayBand` was built after — entirely unobserved.
   */
  it('UNSETTLED: the drawing notice speaks and the extent notice is silent', () => {
    setCanvas(NODES, { pendingLayout: true, layoutInProgress: false })
    render(
      <>
        <CanvasDrawingNotice />
        <ModelExtentNotice />
      </>,
    )

    expect(screen.getByTestId('canvas-drawing-notice')).toBeInTheDocument()
    expect(screen.queryByTestId('model-extent-notice')).toBeNull()
  })

  it('SETTLED: the extent notice speaks and the drawing notice is silent', () => {
    setCanvas(NODES, SETTLED)
    render(
      <>
        <CanvasDrawingNotice />
        <ModelExtentNotice />
      </>,
    )

    /**
     * ⚠ THE SIBLING'S PRESENCE IS THE CONTROL FOR THE WHOLE PAIR. If this
     * assertion ever stopped holding, the "silent while unsettled" case above
     * would be proving nothing — a notice that never renders is trivially
     * absent in both states.
     */
    expect(screen.getByTestId('model-extent-notice')).toBeInTheDocument()
    expect(screen.queryByTestId('canvas-drawing-notice')).toBeNull()
  })
})

describe('the overlay cell claim is declared, and declared where it can win', () => {
  it('is a known claimant of bottom-centre', () => {
    /**
     * An id absent from this table is granted nothing by `useOverlayCell`
     * ("Unknown ids never win"), so a component could mount, compute its
     * predicate correctly and render for no one. That is the shape of the
     * defect `overlayOwner.sourceScan.spec.ts`'s mount-completeness assertion
     * was added for, read from the other side.
     */
    expect(OVERLAY_PRIORITY['bottom-centre']).toContain('canvas-drawing-notice')
  })

  it('⭐ outranks its complement, so the pair can never contend for the cell', () => {
    const cell = OVERLAY_PRIORITY['bottom-centre']
    expect(cell.indexOf('canvas-drawing-notice')).toBeLessThan(cell.indexOf('model-extent-notice'))
  })

  it('⭐ outranks every other bottom-centre disclosure', () => {
    /**
     * ⚠ ASSERTED AGAINST THE WHOLE TABLE, not against the two names that
     * happen to matter today. The argument for the ordering is that every other
     * occupant's sentence is about content the user cannot see while the canvas
     * is blank — which is a claim about ALL of them, so a new claimant added
     * above this one should RED here and be argued for explicitly.
     */
    expect(OVERLAY_PRIORITY['bottom-centre'][0]).toBe('canvas-drawing-notice')
  })
})
