/**
 * ⛔⛔ RENAME HAD NO KEYBOARD ROUTE AT ALL, AND THE SAME FILE PROVED IT.
 *
 * The rename gesture shipped on this branch was `onDoubleClick`, and nothing
 * else. Enter and Space on a focused element dispatch `click`, NEVER `dblclick`
 * — so double-click is a POINTER-ONLY gesture, and a keyboard user could not
 * rename an element from its row. Not slowly, not awkwardly: not at all.
 *
 * ⚠ THE TELL WAS THE INCONSISTENCY, NOT THE ABSENCE. `ModelRowView` already
 * begins a VALUE edit from a `<button>`'s own `onClick`
 * (`model-row-v2-<id>-value`), which Enter and Space DO reach. One row, one
 * surface, two answers to "how does a person start an edit here" — trap 21 at
 * the scale of an interaction. The repair matches the sibling
 * (`model-row-v2-<id>-rename-start`, shaped exactly like `-confirm-as-is`)
 * rather than inventing a third gesture. The double-click stays: it is the
 * product's existing rename gesture (`ReactFlowGraph.tsx:1390-1394`) and both
 * routes call one `beginRename`.
 *
 * ⚠⚠ WHAT THIS SPEC PROVES, STATED NARROWLY BECAUSE THE LARGER CLAIM IS THE
 * TEMPTING ONE. It drives the control BY KEYBOARD through `user-event`, which
 * models the browser's own activation behaviour (Enter on keypress, Space on
 * keyup, for a clickable element). So it proves:
 *   · the control is FOCUSABLE — `focus()` makes it `document.activeElement`,
 *     which a `<span>` carrying a handler would not;
 *   · Enter and Space open the rename editor;
 *   · the write reaches `onRenameRow` addressed by ID, driven end to end from
 *     the keyboard with no pointer event anywhere.
 * It proves NOTHING about whether the control is VISIBLE, hit-testable, or
 * placed sanely in tab order at any real width. jsdom performs no layout. That
 * is a browser question and it is not answered here.
 *
 * ⚠ EVERY ABSENCE BELOW CARRIES ITS PRESENCE (trap 13). A spec asserting "no
 * rename trigger on a relationship row" passes vacuously on a build with no
 * rename trigger anywhere, which is exactly the build this repair exists to
 * end. Each such case therefore asserts the CONTRAST in the same render.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import type { Node, Edge } from '@xyflow/react'

vi.mock('../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { openOutlineGroups } from './openOutlineGroups'

const GOAL_ID = 'goal_margin'
const FACTOR_ID = 'fac_churn'
const EDGE_ID = 'e_churn_to_margin'

const NODES = [
  {
    id: GOAL_ID,
    type: 'goal',
    position: { x: 0, y: 0 },
    data: { label: 'Protect gross margin', kind: 'goal' },
  },
  {
    id: FACTOR_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Churn pressure',
      kind: 'factor',
      category: 'observable',
      observed_state: { value: 0.5, source: 'cee_inference' },
    },
  },
] as unknown as Node[]

const EDGES = [
  {
    id: EDGE_ID,
    source: FACTOR_ID,
    target: GOAL_ID,
    data: { strength: 0.6 },
  },
] as unknown as Edge[]

function renderPanel(onRenameRow?: (id: string, label: string) => void) {
  render(
    <ModelTabV2Panel
      nodes={NODES}
      edges={EDGES}
      goalThreshold={null}
      onRenameRow={onRenameRow}
    />,
  )
  openOutlineGroups()
}

/** The rename TRIGGER. Distinct from `-rename`, which is the editor input —
 *  this file's own rule: two different things never answer to one identity. */
const renameTrigger = (id: string) => screen.queryByTestId(`model-row-v2-${id}-rename-start`)
const renameInput = (id: string) => screen.queryByTestId(`model-row-v2-${id}-rename`)
/** The SIBLING that was already keyboard-reachable — the contrast that names
 *  the defect rather than merely reporting an absence. */
const valueControl = (id: string) => screen.getByTestId(`model-row-v2-${id}-value`)

/**
 * ⚠ AN EXECUTION COUNTER, NOT A COLLECTION COUNTER — and it is here because a
 * spec that contributes ZERO is invisible to every aggregate: the suite total
 * stays healthy, the exit code stays green, the failure count stays zero, and
 * this file's evidence is simply absent. Asserting the total, or reading the
 * exit code, cannot see that. This asserts BY NAME that this file ran the
 * number of cases it declares.
 */
const CASES_EXPECTED = 8
let casesRan = 0
afterAll(() => {
  expect(casesRan).toBe(CASES_EXPECTED)
})

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('renaming an element is reachable from the keyboard', () => {
  it('⭐ INSTRUMENT CONTROL: this harness turns Enter and Space into activation', async () => {
    casesRan++
    /*
     * ⚠ WITHOUT THIS, EVERY FAILURE BELOW IS AMBIGUOUS. If `user-event` did not
     * model the browser's Enter/Space-activates-a-button behaviour, a missing
     * editor would be a fact about the harness and not about the product — an
     * absence probe with no positive control (trap 13). This control is a plain
     * button owned by this file, so it depends on nothing under test.
     *
     * It covers BOTH keys deliberately: the browser reaches `click` by
     * different routes for them (Enter on keypress, Space on keyup), so one key
     * passing says nothing about the other.
     */
    const onEnter = vi.fn()
    render(
      <button type="button" data-testid="instrument-control" onClick={onEnter}>
        plain button
      </button>,
    )
    const user = userEvent.setup()
    const plain = screen.getByTestId('instrument-control')
    plain.focus()
    expect(document.activeElement).toBe(plain)

    await user.keyboard('{Enter}')
    expect(onEnter).toHaveBeenCalledTimes(1)

    await user.keyboard(' ')
    expect(onEnter).toHaveBeenCalledTimes(2)
  })

  it('⭐ THE INCONSISTENCY: the value edit is a button, so rename must be one too', () => {
    casesRan++
    /*
     * The sibling this repair is matched to, asserted rather than described.
     * `ValueCell` renders a `<button>` whose `onClick` begins the edit, which
     * is why editing a value was already keyboard-reachable on this surface.
     * If that ever stops being a button, the premise of this whole file has
     * moved and this case REDs rather than the rename case quietly becoming
     * the only opinion in the room.
     */
    renderPanel(vi.fn())
    expect(valueControl(FACTOR_ID).tagName).toBe('BUTTON')

    const trigger = renameTrigger(FACTOR_ID)
    expect(trigger).toBeInTheDocument()
    expect(trigger!.tagName).toBe('BUTTON')
  })

  it('⛔ Enter on the rename control opens the editor', async () => {
    casesRan++
    renderPanel(vi.fn())
    const user = userEvent.setup()

    // Positive control: the row rendered, so an absent editor below is about
    // the gesture and not about an empty outline.
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}`)).toBeInTheDocument()
    expect(renameInput(FACTOR_ID)).toBeNull()

    const trigger = renameTrigger(FACTOR_ID)!
    trigger.focus()
    // FOCUSABILITY, asserted rather than assumed. A `<span>` carrying a
    // handler leaves `activeElement` on `<body>`, so this discriminates
    // between "reachable" and "merely present".
    expect(document.activeElement).toBe(trigger)

    await user.keyboard('{Enter}')

    const input = renameInput(FACTOR_ID)
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('Churn pressure')
    // A rename editor that opens WITHOUT focus is not a keyboard route; it is
    // a control that hands the user nowhere to type.
    expect(document.activeElement).toBe(input)
  })

  it('⛔ Space on the rename control opens the editor too', async () => {
    casesRan++
    /*
     * ⚠ NOT REDUNDANT WITH ENTER. The browser reaches `click` from Space by a
     * different route (keyup, not keypress), and a control that handled Enter
     * alone would still be half-unreachable — Space is the activation key most
     * keyboard users reach for on a button.
     */
    renderPanel(vi.fn())
    const user = userEvent.setup()

    const trigger = renameTrigger(FACTOR_ID)!
    trigger.focus()
    await user.keyboard(' ')

    expect(renameInput(FACTOR_ID)).toBeInTheDocument()
    expect(renameInput(FACTOR_ID)).toHaveValue('Churn pressure')
  })

  it('⭐ the whole rename lands from the keyboard alone, addressed BY ID', async () => {
    casesRan++
    const onRenameRow = vi.fn()
    renderPanel(onRenameRow)
    const user = userEvent.setup()

    const trigger = renameTrigger(FACTOR_ID)!
    trigger.focus()
    await user.keyboard('{Enter}')
    // Typed into whatever the editor focused, with no pointer event anywhere in
    // this case — which is the property under test.
    await user.keyboard(', monthly')
    await user.keyboard('{Enter}')

    // Bound by IDENTITY (trap 19): the node id, never the label — a label
    // retargets on rename, which is the whole point of the field.
    expect(onRenameRow).toHaveBeenCalledWith(FACTOR_ID, 'Churn pressure, monthly')
    expect(renameInput(FACTOR_ID)).toBeNull()
  })

  it('the GOAL is reachable the same way — the row whose own pill says to rename it', async () => {
    casesRan++
    const onRenameRow = vi.fn()
    renderPanel(onRenameRow)
    const user = userEvent.setup()

    const trigger = renameTrigger(GOAL_ID)!
    expect(trigger).toBeInTheDocument()
    trigger.focus()
    await user.keyboard('{Enter}')
    await user.keyboard('!')
    await user.keyboard('{Enter}')

    expect(onRenameRow).toHaveBeenCalledWith(GOAL_ID, 'Protect gross margin!')
  })

  it('⚠ a RELATIONSHIP row offers no rename control — its label is derived, not stored', () => {
    casesRan++
    renderPanel(vi.fn())

    /*
     * ⚠ THE CONTRAST IS THE POINT. Asserted alone, this case passes on a build
     * with no rename control ANYWHERE — i.e. it would have passed on the very
     * defect this file exists to close. The factor's trigger in the SAME render
     * makes the edge row's zero a fact about the row kind.
     */
    expect(screen.getByTestId(`model-row-v2-${EDGE_ID}`)).toBeInTheDocument()
    expect(renameTrigger(FACTOR_ID)).toBeInTheDocument()
    expect(renameTrigger(EDGE_ID)).toBeNull()
  })

  it('⚠ no rename handler means NO control, never an inert one', async () => {
    casesRan++
    /*
     * Same vacuity hazard as the case above, so the presence half is rendered
     * here too rather than trusted. An absent prop must remove the affordance;
     * a control that focused, activated and wrote nowhere would be the silent
     * local write this surface refuses.
     */
    renderPanel(undefined)
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}`)).toBeInTheDocument()
    expect(renameTrigger(FACTOR_ID)).toBeNull()

    cleanup()
    renderPanel(vi.fn())
    const withHandler = renameTrigger(FACTOR_ID)
    expect(withHandler).toBeInTheDocument()

    const user = userEvent.setup()
    withHandler!.focus()
    await user.keyboard('{Enter}')
    expect(renameInput(FACTOR_ID)).toBeInTheDocument()
  })
})
