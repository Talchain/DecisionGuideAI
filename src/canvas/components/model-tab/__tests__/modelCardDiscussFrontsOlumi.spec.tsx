/**
 * ⭐⭐ THE MODEL CARD'S ONE CLICKABLE AFFORDANCE MUST FRONT OLUMI, AND MUST HAVE
 * A NAME.
 *
 * ── THE DEFECT, MEASURED AT `bdf4fb89` ───────────────────────────────────────
 *
 * `modelcard-discuss` is a 14px icon-only button in `ModelHealthSection`. Its
 * `onClick` called `onSendMessage(...)` DIRECTLY, with no fronting, and its only
 * accessible name was a `title` attribute.
 *
 * So clicking it posted a REAL turn into the Olumi tab — which is `hidden` +
 * `aria-hidden` whenever Model is the active tab (`OutputsDock.tsx:3735-3737`).
 * The screen did not change and the product said nothing.
 *
 * ⚠ AND IT IS THE ONLY ONE OF ITS FAMILY THAT WAS EVER REACHABLE.
 * `olumiHandOff.ts`'s header names six "Discuss this with the AI" buttons and
 * closes the defect for them — on the v2 outline. THIS host survived that sweep
 * because `ModelTabBody` mounts it in `model-scientific-transparency`, OUTSIDE
 * the `LEGACY_DETAILED_EDITOR_MOUNTED = false` gate, while the five sibling v1
 * discuss buttons (`GoalSection`, `OptionsSection`, `FactorsSection`,
 * `RelationshipsSection`, `RisksSection`) sit INSIDE it and are dark. The one
 * the user can actually click is the one the fix missed.
 * `groupActions.ts:186-207` records the survival in as many words, and draws the
 * opposite conclusion from it: "the original had never gone away" was read as
 * reassurance, when it also meant the original had inherited none of the fixes.
 *
 * ── WHY THE ASSERTIONS ARE SHAPED THIS WAY ───────────────────────────────────
 *
 * The three behavioural tests are deliberately SEPARATE, so that the two
 * mutations that matter RED on DIFFERENT signatures rather than on one shared
 * one — a single combined test would let either mutation satisfy the other's
 * failure and tell us nothing about which property is broken:
 *
 *   (a) revert to a bare `send(message)` with no fronting
 *       → "fronts the Olumi surface" REDs (`revealOlumiSurface` 0 calls).
 *       → the send test stays GREEN, which is the point: the turn was always
 *         being sent. Sending was never the defect.
 *   (b) front the surface but drop the send
 *       → "sends the exact turn text" REDs (`send` 0 calls).
 *       → the fronting test stays GREEN.
 *
 * Both tests green can only mean both halves happened, and the ORDER test
 * pins which came first — a send that lands before the reveal is the same
 * defect with better timing, and `olumiHandOff.ts` says so explicitly.
 *
 * ⚠ THE TURN TEXT IS ASSERTED AS A LITERAL, NOT VIA THE SOURCE STRING. Reading
 * the message back out of the component would be a guard agreeing with itself.
 * It is also the string `groupActionsRehome.spec.tsx` pins as the tenth v1
 * capability, so editing it must RED in two places.
 *
 * ⚠ THE ACCESSIBLE NAME IS ASSERTED AS A LITERAL FOR THE SAME REASON. Importing
 * `MODELCARD_DISCUSS_LABEL` and comparing the attribute to it would pass for ANY
 * value of the constant, including an empty string.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// The reveal primitive is the one thing we must observe rather than perform:
// it reaches into the UI store and the real DOM. Mocked at the module the
// hand-off imports, so `createOlumiHandOff` itself stays REAL — the subject
// here is the wiring, and a mocked hand-off would test nothing.
vi.mock('../../../conversation/revealOlumi', () => ({
  revealOlumiSurface: vi.fn(() => true),
}))

import { revealOlumiSurface } from '../../../conversation/revealOlumi'
import { createOlumiHandOff } from '../../../conversation/olumiHandOff'
import { ModelHealthSection } from '../ModelHealthSection'

/** The turn `modelcard-discuss` has always sent. Unchanged by this fix. */
const V1_TURN = 'Help me understand the reliability and limitations of my model'

/**
 * The accessible name. ⚠ NOT A NEW STRING — it is `DISCUSS_RELIABILITY.label`
 * as `groupActions.ts` records it, i.e. the name the outline action written to
 * replace this button already carried.
 */
const EXPECTED_NAME = "Discuss the model's reliability with Olumi"

/**
 * Render the card with a REAL hand-off over a spy sender, recording the order
 * of the two effects in one array so "before" is a measured fact rather than an
 * inference from two separate call counts.
 */
function renderCard() {
  const order: string[] = []
  // ⚠ PARAMETERS DECLARED, not inferred from an empty arrow. `vi.fn(() => …)` has
  // NO declared params, so `toHaveBeenCalledWith(message, opts)` below would be
  // checked against a zero-arity signature. Typed to `OlumiSend`'s real shape so
  // the argument assertion is type-checked rather than silently widened.
  const send = vi.fn((_message: string, _opts?: { hidden?: boolean; debugSource?: string }) => {
    order.push('send')
  })
  vi.mocked(revealOlumiSurface).mockImplementation(() => { order.push('reveal'); return true })

  const handOff = createOlumiHandOff(send)
  // A null hand-off here would silently render no button and every assertion
  // below would fail on "not found" rather than on the property under test.
  expect(handOff).not.toBeNull()

  render(<ModelHealthSection ceeQuality={{ overall: 7.2 }} onHandOffToOlumi={handOff!} />)
  return { send, order }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('⭐ modelcard-discuss — the click reaches a surface the user can see', () => {
  it('fronts the Olumi surface when clicked', () => {
    renderCard()

    fireEvent.click(screen.getByTestId('modelcard-discuss'))

    // MUTATION (a): a bare `send(message)` with no fronting REDs here, on
    // "number of calls: 0", and nowhere else.
    expect(revealOlumiSurface).toHaveBeenCalledTimes(1)
  })

  it('sends the exact v1 turn text, byte for byte', () => {
    const { send } = renderCard()

    fireEvent.click(screen.getByTestId('modelcard-discuss'))

    // MUTATION (b): fronting without sending REDs here, on a DIFFERENT
    // signature from the test above.
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(V1_TURN, { debugSource: 'modelcard-discuss' })
  })

  it('⚠ fronts BEFORE sending — never the reverse', () => {
    const { order } = renderCard()

    fireEvent.click(screen.getByTestId('modelcard-discuss'))

    // `olumiHandOff.ts`: "FRONT FIRST, THEN SEND. Never the reverse: a send that
    // lands before the surface is revealed is the defect above with better
    // timing." Asserted as an exact sequence, so a swap REDs even though both
    // halves still happen and both tests above stay green.
    expect(order).toEqual(['reveal', 'send'])
  })

  /**
   * ⚠ THE DISCRIMINATING TWIN. Without this, every assertion above would be
   * satisfied by a button that renders unconditionally and a guard that does
   * nothing. `createOlumiHandOff(undefined)` is `null`, and a `null` hand-off
   * must take the BUTTON away rather than leave one whose turn cannot land —
   * which is the v1 `{onSendMessage && …}` guard preserved, not dropped.
   */
  it('renders NO button at all when no conversation can receive the turn', () => {
    expect(createOlumiHandOff(undefined)).toBeNull()

    render(<ModelHealthSection ceeQuality={{ overall: 7.2 }} />)

    expect(screen.queryByTestId('modelcard-discuss')).toBeNull()
    expect(revealOlumiSurface).not.toHaveBeenCalled()
  })
})

describe('⭐ modelcard-discuss — an icon-only control carries a real name', () => {
  it('has an aria-label, asserted as the exact expected string', () => {
    renderCard()

    const button = screen.getByTestId('modelcard-discuss')

    // ⚠ A LITERAL. Comparing against the imported constant would pass for any
    // value it happened to hold — including ''. If the name is reworded, this
    // REDs and the rewording becomes a decision rather than a diff.
    expect(button).toHaveAttribute('aria-label', EXPECTED_NAME)
  })

  it('⚠ is reachable BY THAT NAME — not merely carrying the attribute', () => {
    renderCard()

    // Bound by ACCESSIBLE NAME rather than by testid: this is the property a
    // screen-reader or touch user actually depends on, and it fails if the
    // label is present but overridden by the element's own content.
    const byName = screen.getByRole('button', { name: EXPECTED_NAME })
    expect(byName).toBe(screen.getByTestId('modelcard-discuss'))
  })

  it('⚠ does not rely on `title` as its only name — the pointer-only route', () => {
    renderCard()

    const button = screen.getByTestId('modelcard-discuss')

    // `title` is kept (it is a useful hover affordance) but it must no longer be
    // the ONLY name. `ModelRowView.tsx:876-879` states the limitation this
    // guards: a `title` on a control with no accessible name is mouse-hover
    // only — invisible to touch, and not reliably announced.
    expect(button).toHaveAttribute('title', EXPECTED_NAME)
    expect(button.getAttribute('aria-label')).not.toBeNull()
    expect(button.getAttribute('aria-label')).not.toBe('')
  })
})
