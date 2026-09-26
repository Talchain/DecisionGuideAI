/**
 * ⭐⭐⭐ "YOUR MODEL SO FAR" AS A TOOL, NOT A STATUS BAR — the rows are controls,
 * the strip carries a worklist, and the detail can be acted on.
 *
 * ⚠ V2 (Paul, 25 Sep 2026): the worklist CHIPS left the strip — the review
 * tool's "N to review" is the one worklist count. See block B.
 *
 * Paul, 1 Sep 2026: *"The top component still doesn't feel like a tool. The
 * information shown when you hover over it isn't very action-oriented. It
 * doesn't give you any additional icons or clickable elements to make it
 * valuable."*
 *
 * ⚠ THE ACCEPTANCE BAR IS A MEASUREMENT, NOT THE PROTOTYPE'S FEATURE LIST.
 * Driven on the deployed build at `19fe8710`, hovering the RICHEST mark
 * available (a factor that is also a named driver), the detail contained
 * exactly three lines — the node's name, its kind, one driver chip — and
 * `querySelectorAll('button,a,[role="button"]')` inside it returned EMPTY. Two
 * of those three restate what the mark already carries. So the bar is: naming
 * a mark must yield something the reader could NOT already see AND something
 * they can DO. `the detail carries a control at all` below is that measurement
 * mechanised, and it is deliberately written the way the browser probe was.
 *
 * ⚠ EVERY ASSERTION BINDS BY IDENTITY — `data-node-id`, `data-kind`, an exact
 * testid, an exact imported string — never by a value predicate another element
 * could satisfy (CLAUDE.md trap 19). Every case that could pass on a blunter
 * component carries its OPPOSITE-DIRECTION TWIN in the same block: a row
 * control that rang every node would pass "something was ringed"; a chip that
 * rendered always would pass "the unconfirmed factor says so".
 *
 * ⚠ WHAT THIS FILE CANNOT CLAIM. jsdom cannot prove visibility, width or that
 * a real pointer reaches any of this (trap 3), and the browser probe above
 * found that hand-dispatched DOM events do NOT drive the hover path the way a
 * real pointer does. `fireEvent` is used throughout for that reason, and no
 * case here should be read as a witness that the strip is usable at the 280px
 * dock floor. That is owed on a real browser.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

const nodes: Array<{ id: string; type?: string; data?: unknown }> = []
const setHighlightedNodes = vi.fn()

/**
 * ⚠ THE STATE OBJECT IS BUILT ON EVERY CALL, NEVER CAPTURED IN THE FACTORY.
 * `vi.mock` is hoisted above the `const` declarations, so a factory that closes
 * over `nodes` eagerly throws `Cannot access 'nodes' before initialization` and
 * the whole file collects as `(0 test)` — invisible to the suite total, the
 * exit code and the failure count at once (CLAUDE.md trap 2b).
 */
type MockState = { nodes: unknown; setHighlightedNodes: unknown }
vi.mock('../../../../canvas/store', () => {
  const read = (): MockState => ({ nodes, setHighlightedNodes })
  const useCanvasStore = (select: (s: MockState) => unknown) => select(read())
  ;(useCanvasStore as unknown as { getState: () => MockState }).getState = read
  return { useCanvasStore }
})
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))
vi.mock('../../../../canvas/utils/highlightHelpers', () => ({
  highlightNode: vi.fn(),
  clearHighlight: vi.fn(),
}))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))

import { focusModelTarget } from '../../../../canvas/utils/focusHelpers'
import { clearHighlight } from '../../../../canvas/utils/highlightHelpers'
import { UNCONFIRMED_ESTIMATE_LABEL } from '../../../../canvas/domain/vocabulary'
import { ModelStrip } from '../sections/ModelStrip'
import { MARK_CAP, buildModelStrip } from '../buildModelStrip'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'

const TID = 'analysis-new-model-strip'

const node = (id: string, type: string, label: string, data: Record<string, unknown> = {}) => ({
  id,
  type,
  data: { label, ...data },
})

/** A factor carrying a number nobody has confirmed — `factorIsConfirmable` true. */
const unconfirmed = (id: string, label: string, value = 0.7) =>
  node(id, 'factor', label, { observed_state: { value, source: 'cee_inference' } })

/**
 * The model these cases run against.
 *
 * ⚠ IT SPANS ALL FOUR CLASSES THE PREDICATE DISTINGUISHES, and that is what
 * makes the worklist assertions discriminating rather than a head-count:
 *   f1 — a number stamped by the producer            → needs a check
 *   f2 — a number with no source at all              → needs a check
 *   f3 — a number the USER confirmed                 → does not
 *   f4 — a source but NO number to ratify            → does not
 *   f5 — no observed state at all                    → does not
 * A component that counted "factors" would read 5, one that counted "factors
 * with an observed_state" would read 4, and only the write authority's own
 * condition reads 2.
 */
const CANVAS = [
  node('g1', 'goal', 'Replace the customer data platform within budget'),
  node('o1', 'option', 'Adopt Segment'),
  node('o2', 'option', 'Adopt RudderStack'),
  unconfirmed('f1', 'Vendor licensing cost'),
  node('f2', 'factor', 'Migration effort', { observed_state: { value: 0.4 } }),
  node('f3', 'factor', 'Team capacity', {
    observed_state: { value: 0.9, source: 'user_confirmed' },
  }),
  node('f4', 'factor', 'Data volume', { observed_state: { source: 'cee_inference' } }),
  node('f5', 'factor', 'Contract length'),
  node('r1', 'risk', 'Migration delay'),
]

/** The two factors the write authority would accept a confirmation for. */
const NEEDS_CHECK = ['f1', 'f2']

const setCanvas = (next: ReadonlyArray<ReturnType<typeof node>>) => {
  nodes.length = 0
  nodes.push(...next)
}

const mark = (nodeId: string) =>
  screen.getAllByTestId(`${TID}-mark`).find((el) => el.getAttribute('data-node-id') === nodeId)!

const markIds = () =>
  screen.queryAllByTestId(`${TID}-mark`).map((el) => el.getAttribute('data-node-id'))

const rowFilter = (kind: string) =>
  screen.getAllByTestId(`${TID}-row-filter`).find((el) => el.getAttribute('data-kind') === kind)!

const rowCount = (kind: string) =>
  screen.getAllByTestId(`${TID}-row-count`).find((el) => el.getAttribute('data-kind') === kind)

const renderOpen = () => {
  const r = render(<ModelStrip isPreRun={false} />)
  fireEvent.click(screen.getByTestId(`${TID}-toggle`))
  return r
}

beforeEach(() => {
  vi.mocked(focusModelTarget).mockClear()
  vi.mocked(clearHighlight).mockClear()
  setHighlightedNodes.mockClear()
  setCanvas(CANVAS)
})
afterEach(() => cleanup())

// ── A. THE ROW IS A CONTROL ─────────────────────────────────────────────────

describe('⭐ a row is a control, and it says what it does', () => {
  it('every row label is a button whose accessible name names its own kind', () => {
    renderOpen()
    // Bound by `data-kind`, so a component that rendered one control for the
    // whole strip, or named them all the same, fails here.
    expect(
      screen.getAllByTestId(`${TID}-row-filter`).map((el) => el.getAttribute('data-kind')),
    ).toEqual(['option', 'factor', 'risk'])

    const factors = rowFilter('factor')
    expect(factors.tagName).toBe('BUTTON')
    expect(factors).toHaveAttribute('aria-pressed', 'false')
    expect(factors).toHaveAttribute('aria-label', COPY.modelStrip.onlyKind('Factors'))
    // ⚠ Meaning must not live in a `title`: unreachable on touch, suppressed by
    // many browsers. The visible word plus the accessible name carry it.
    expect(factors).not.toHaveAttribute('title')
  })

  it('pressing a row rings EVERY node of THAT kind on the canvas', () => {
    renderOpen()
    fireEvent.click(rowFilter('factor'))
    expect(setHighlightedNodes).toHaveBeenCalledTimes(1)
    expect(setHighlightedNodes).toHaveBeenCalledWith(['f1', 'f2', 'f3', 'f4', 'f5'])
  })

  /**
   * ⭐ THE DISCRIMINATING TWIN. A control that rang the whole model — or a
   * fixed row — satisfies "something was ringed" perfectly and fails here.
   */
  it('and a DIFFERENT row rings a different set — not the model, not the first row', () => {
    renderOpen()
    fireEvent.click(rowFilter('option'))
    expect(setHighlightedNodes).toHaveBeenCalledWith(['o1', 'o2'])
  })

  it('pressing a row LIFTS ITS CAP — the withheld count is not a wall any more', () => {
    setCanvas([
      node('g1', 'goal', 'A goal'),
      ...Array.from({ length: MARK_CAP + 8 }, (_, i) => node(`f${i}`, 'factor', `Factor ${i}`)),
    ])
    renderOpen()
    // Before: capped, and the strip discloses what it withheld.
    expect(screen.getAllByTestId(`${TID}-mark`)).toHaveLength(MARK_CAP)
    expect(screen.getByTestId(`${TID}-overflow`)).toHaveTextContent('+8 not shown')

    fireEvent.click(rowFilter('factor'))
    // After: every node is a target, and nothing is withheld so nothing is
    // disclosed — the reader sees what they could not get any other way.
    expect(screen.getAllByTestId(`${TID}-mark`)).toHaveLength(MARK_CAP + 8)
    expect(screen.queryByTestId(`${TID}-overflow`)).toBeNull()
    expect(rowFilter('factor')).toHaveAttribute('aria-pressed', 'true')
  })

  it('the other rows keep their labels and counts, and stop drawing marks', () => {
    renderOpen()
    fireEvent.click(rowFilter('factor'))
    // Only the selected kind draws marks…
    expect(markIds()).toEqual(['f1', 'f2', 'f3', 'f4', 'f5'])
    // …and every row is still reachable, so the reader is not stranded inside
    // the one they picked.
    expect(rowFilter('option')).toBeInTheDocument()
    expect(rowFilter('risk')).toBeInTheDocument()
    // ⚠ Selecting a kind narrows no row's MEMBERSHIP, so the counts stay the
    // model's. "0 of 2" on Options would be a claim about the model.
    expect(rowCount('option')).toHaveTextContent('2')
  })

  it('pressing the SAME row again restores every row and clears the ring', () => {
    renderOpen()
    fireEvent.click(rowFilter('factor'))
    setHighlightedNodes.mockClear()
    fireEvent.click(rowFilter('factor'))

    expect(rowFilter('factor')).toHaveAttribute('aria-pressed', 'false')
    expect(markIds()).toEqual(['o1', 'o2', 'f1', 'f2', 'f3', 'f4', 'f5', 'r1'])
    expect(clearHighlight).toHaveBeenCalled()
    expect(setHighlightedNodes).not.toHaveBeenCalled()
  })
})

// ── B. THE WORKLIST ─────────────────────────────────────────────────────────
//
// V2 prototype (Paul, 25 Sep 2026): the strip's "N to verify" / "N with no
// value" chips duplicated the review tool's "N to review" and are gone. The
// cases that pressed them (count phrase, narrowing, both numbers, criterion
// note, ring, mutual exclusion) were deleted with the control. What stays is
// the closed line's count and the absence of the chips themselves.

describe('⭐ the strip carries a worklist, in the product’s own count', () => {
  /**
   * ⭐ V2: NO WORKLIST CHIP IN THE STRIP, even with factors to verify. The
   * precondition is the count itself, read off the closed line, so the absence
   * below is a removed control and not an empty worklist.
   */
  it('V2: the open strip carries no worklist chip, even when factors need a check', () => {
    render(<ModelStrip isPreRun={false} />)
    // PRECONDITION: the model really does hold factors to verify.
    expect(NEEDS_CHECK.length).toBeGreaterThan(0)
    fireEvent.click(screen.getByTestId(`${TID}-toggle`))
    // CONTRAST: the region is open and drawing marks.
    expect(markIds()).toEqual(['o1', 'o2', 'f1', 'f2', 'f3', 'f4', 'f5', 'r1'])
    expect(screen.queryByTestId(`${TID}-verify-toggle`)).toBeNull()
    expect(screen.queryByTestId(`${TID}-no-value-toggle`)).toBeNull()
    // And nothing is narrowed, so no criterion line stands under the rows.
    expect(screen.queryByTestId(`${TID}-narrowed-note`)).toBeNull()
    expect(screen.queryByTestId(`${TID}-no-value-narrowed-note`)).toBeNull()
  })

  it('V2: a host that asks for openAtRest gets the census open after a run; a bare mount stays closed', () => {
    render(<ModelStrip isPreRun={false} openAtRest />)
    expect(screen.getByTestId(`${TID}-toggle`)).toHaveAttribute('aria-expanded', 'true')
    cleanup()
    render(<ModelStrip isPreRun={false} />)
    expect(screen.getByTestId(`${TID}-toggle`)).toHaveAttribute('aria-expanded', 'false')
  })

  it('V2: the CLOSED strip carries no amber "N to verify" — the one worklist count is the review tool’s', () => {
    render(<ModelStrip isPreRun={false} />)
    // PRECONDITION: factors do need a check, so an old tally would have drawn.
    expect(NEEDS_CHECK.length).toBeGreaterThan(0)
    expect(screen.getByTestId(`${TID}-toggle`)).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId(`${TID}-verify-summary`)).toBeNull()
  })
})

// ── C. THE DETAIL IS ACTIONABLE ─────────────────────────────────────────────

describe('⭐ the detail can be acted on — the measured gap', () => {
  /**
   * ⭐⭐ THE MEASUREMENT, MECHANISED. This is the browser probe's own query
   * against the deployed build, which returned EMPTY on the richest node in
   * the model. It is the case that fails if the detail goes back to being
   * three lines of restatement.
   */
  // ⚠ 26 Sep (design audit B12): a mark opens its detail on ACTIVATION, as the
  // prototype's does; pointing at it only rings the node. Every case in this
  // block therefore picks by click.
  it('a picked mark’s detail contains at least one control', () => {
    renderOpen()
    fireEvent.click(mark('f1'))
    const detail = screen.getByTestId(`${TID}-detail`)
    expect(detail.querySelectorAll('button,a,[role="button"]').length).toBeGreaterThan(0)
  })

  it('the canvas action is bound to THIS node, and follows the reader’s pick', () => {
    renderOpen()
    fireEvent.click(mark('f1'))
    // The mark's own activation focuses the canvas too; count only the button.
    vi.mocked(focusModelTarget).mockClear()
    fireEvent.click(screen.getByTestId(`${TID}-detail-focus`))
    expect(focusModelTarget).toHaveBeenCalledTimes(1)
    expect(focusModelTarget).toHaveBeenCalledWith('f1')

    // ⭐ The discrimination: a button wired to a fixed id, or to the first
    // node, satisfies the half above and fails this.
    fireEvent.click(mark('r1'))
    vi.mocked(focusModelTarget).mockClear()
    fireEvent.click(screen.getByTestId(`${TID}-detail-focus`))
    expect(focusModelTarget).toHaveBeenLastCalledWith('r1')
  })

  // ⚠ 26 Sep (design audit B12): the prototype's act is ICON-ONLY — the text
  // pill truncated to "Show on canv…" at 280px. Its name is now its
  // accessible name (also its tooltip), never only a `title`.
  it('the action is named — by its accessible name, not a title attribute', () => {
    renderOpen()
    fireEvent.click(mark('f1'))
    const action = screen.getByTestId(`${TID}-detail-focus`)
    expect(action).toHaveAccessibleName(COPY.modelStrip.showOnCanvas)
    expect(action.getAttribute('title') ?? '').toBe('')
  })

  /**
   * ⚠ 26 Sep (design audit B12): THE AMBER CHIP IS GONE FROM THE DETAIL. The
   * prototype's detail has none, and the state is not lost: a factor whose
   * number nobody has confirmed is a review-queue item (`buildReviewQueue`'s
   * verify list), so on the tab its mark opens the review tool at that item,
   * which says so ("Estimate not yet confirmed", "Confirm as my estimate").
   */
  it('a node carrying an unconfirmed number shows NO chip in the detail — the review tool owns that state', () => {
    // CONTRAST: f1 really is in the unconfirmed state, so the absence is the detail's.
    const f1 = buildModelStrip(CANVAS)
      .rows.find((r) => r.kind === 'factor')
      ?.nodes.find((n) => n.id === 'f1')
    expect(f1?.needsCheck).toBe(true)
    renderOpen()
    fireEvent.click(mark('f1'))
    expect(screen.queryByTestId(`${TID}-detail-verify`)).toBeNull()
    expect(screen.getByTestId(`${TID}-detail`)).not.toHaveTextContent(UNCONFIRMED_ESTIMATE_LABEL)
  })

  /**
   * ⭐ THE OPPOSITE-DIRECTION TWIN. A chip that always rendered would pass the
   * case above and be a sentence that is simply always true.
   */
  it('and a factor the user already confirmed carries NO such chip', () => {
    renderOpen()
    fireEvent.click(mark('f3'))
    const detail = screen.getByTestId(`${TID}-detail`)
    expect(detail).toHaveAttribute('data-node-id', 'f3')
    expect(within(detail).queryByTestId(`${TID}-detail-verify`)).toBeNull()
  })

  it('a factor with a source but NO number to ratify carries no chip either', () => {
    // The value guard is half the predicate: an enabled claim over a factor the
    // write authority would decline is the dead-affordance defect one level up.
    renderOpen()
    fireEvent.click(mark('f4'))
    expect(screen.queryByTestId(`${TID}-detail-verify`)).toBeNull()
  })

  it('a detail left open on a node the reader filters away closes itself', () => {
    renderOpen()
    fireEvent.click(mark('o1'))
    expect(screen.getByTestId(`${TID}-detail`)).toHaveAttribute('data-node-id', 'o1')

    fireEvent.click(rowFilter('factor'))
    // A panel describing something no longer on screen is worse than none.
    expect(screen.queryByTestId(`${TID}-detail`)).toBeNull()
  })
})

// ── D. THE RING SURVIVES THE POINTER ────────────────────────────────────────

describe('⭐ a row’s ring is not erased by pointing at one of its marks', () => {
  it('leaving a mark inside a selected row RESTORES that row’s ring', () => {
    renderOpen()
    fireEvent.click(rowFilter('factor'))
    setHighlightedNodes.mockClear()
    vi.mocked(clearHighlight).mockClear()

    fireEvent.mouseEnter(mark('f1'))
    fireEvent.mouseLeave(mark('f1'))

    // Both write ONE canvas channel, so a plain clear here would blank the
    // selection the reader had just made.
    expect(setHighlightedNodes).toHaveBeenCalledWith(['f1', 'f2', 'f3', 'f4', 'f5'])
    expect(clearHighlight).not.toHaveBeenCalled()
  })

  /**
   * ⭐ THE TWIN: with nothing selected the gesture must still CLEAR, or the
   * restore would just be a highlight that never goes away.
   */
  it('and with nothing selected it still clears, exactly as before', () => {
    renderOpen()
    fireEvent.mouseEnter(mark('f1'))
    fireEvent.mouseLeave(mark('f1'))
    expect(clearHighlight).toHaveBeenCalledTimes(1)
    expect(setHighlightedNodes).not.toHaveBeenCalled()
  })

  it('keyboard blur follows the same rule as the pointer', () => {
    renderOpen()
    fireEvent.click(rowFilter('factor'))
    setHighlightedNodes.mockClear()
    fireEvent.focus(mark('f2'))
    fireEvent.blur(mark('f2'))
    expect(setHighlightedNodes).toHaveBeenCalledWith(['f1', 'f2', 'f3', 'f4', 'f5'])
  })
})
