/**
 * ⭐⭐ THE FLAGSHIP CONTROL WAS A TRAP: USING IT AS INVITED IS WHAT BROKE THE
 * ANALYSIS.
 *
 * ── THE DEFECT, WITNESSED ON THE DEPLOYED BUILD ────────────────────────────
 * #1491 and #1496 shipped "Change this value" on the Reasoning tab. The number
 * behind those rows is NORMALISED, and the product's own receipt said so
 * verbatim:
 *
 *   "Updated Capital Borrowing Level from 0.3 to 250,000"
 *
 * The editor is a bare `type="number"` field with no unit, no scale and no
 * range on screen. A reader looking at a factor named `Capital Borrowing Level`
 * enters a realistic figure, and every later analysis refuses with "recorded as
 * a bare amount with no range". Two sessions reproduced it independently, with
 * `7` and with `250000`.
 *
 * ⛔ AND IT CANNOT UNDO ITS OWN DAMAGE. After the bad value the factor leaves
 * "What I estimated" (5 rows → 4), so the control that caused it is gone.
 * Recovery needs the canvas and a guess that the scale is 0–1. That is why
 * PREVENTION is the whole of this change: the panel has no repair route to
 * offer, so the only honest place to act is before the commit.
 *
 * ── WHAT IS REUSED, AND WHY NOTHING IS INVENTED ────────────────────────────
 * The verdict, the scale transform and the sentence are #1428's
 * `factorValueAdmissionRefusal`, already live on the Model tab's row editor
 * against the SAME `factor_value_edit` event through the SAME authority. Two
 * surfaces disagreeing about whether one commit on one factor is admissible is
 * trap 21; a second range parser here would be trap 12. This file mints ZERO
 * new product strings — the only new bytes anywhere are the act name `save this
 * change`, which exists because this surface's button says `Save` and the Model
 * tab's says `Review change`.
 *
 * ── ⚠ THE PAIR, AND THE HALF THE BASE COMMIT CANNOT EXPRESS ────────────────
 * The brief asked for: cap known → warn; cap absent → #1507's no-range notice.
 * **#1507 IS UNMERGED AT THIS BASE**, so its notice does not exist in this tree
 * and asserting it here would be asserting another PR's bytes. The
 * opposite-direction half is therefore written as the property that is true at
 * THIS tip and stays true after #1507 merges: on a factor that declares no
 * range this control invents no bound, states nothing about scale, and refuses
 * nothing. #1507 fills that silence with its sentence; it does not change this
 * assertion. The two halves fail on DIFFERENT assertions in OPPOSITE
 * directions, which is the point of the pair.
 *
 * ⚠ ONLY THE CONVERSATION TRANSPORT IS STUBBED, so `buildFactorValueEditEvent`
 * runs for real and `sentEvents` holds the bytes the product would send.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const sentEvents: unknown[] = []
let conversation: { sendSystemEvent: (e: unknown, o?: unknown) => Promise<unknown> } | null = null

vi.mock('../../../../canvas/conversation/ConversationContext', () => ({
  useOptionalConversationContext: () => conversation,
  useConversationContext: () => conversation,
  ConversationProvider: ({ children }: { children: unknown }) => children,
}))

const showToast = vi.fn()
vi.mock('../../../../canvas/ToastContext', () => ({
  useShowToastSafe: () => showToast,
  ToastProvider: ({ children }: { children: unknown }) => children,
}))

import { FactorValueControl } from '../FactorValueControl'
import { useCanvasStore } from '@/canvas/store'

/**
 * ── IDENTITY ANCHORS, HAND-PINNED ──────────────────────────────────────────
 * Never derived at runtime from the thing under test: a value read back out of
 * the component inside its own assertion is an oracle agreeing with itself.
 */
const PREFIX = 'what-i-was-given-estimated'

/**
 * ⚠ THE CAPPED FACTOR IS #1491'S OWN FIXTURE SHAPE, and the cap is the point.
 * Without it `value` and `raw_value` are the same number and no assertion can
 * tell a control that honours the scale contract from one that ignores it.
 * `cap: 20, unit: 'months'` with a `[0,1]` prior means the typed-scale range is
 * 0 to 20: typing 12 must be admitted and reach the wire as `value: 0.6` AND
 * `raw_value: 12`, and typing 250000 must not.
 */
const CAPPED_ID = 'fac_cash_runway'
const CAPPED_LABEL = 'Cash Runway'

/**
 * ⚠ THE NO-RANGE FACTOR CARRIES NO `prior` AT ALL — the witnessed shape of the
 * factor #1451 was found on. It is in the graph and is otherwise identical, so
 * a difference in behaviour is attributable to the prior and to nothing else.
 */
const NO_RANGE_ID = 'fac_borrowing_level'
const NO_RANGE_LABEL = 'Capital Borrowing Level'

/**
 * ⚠ A RANGED FACTOR WITH NO CAP AND NO UNIT — `value` IS the model scale here,
 * so the typed-scale bounds are the prior's own 0 and 1, untransformed. It is
 * the contrast that proves the sentence reports the FACTOR'S scale rather than
 * a constant: the same off-scale draft yields a different pair of numbers on
 * this factor than on the capped one.
 */
const BARE_ID = 'fac_bare_ratio'
const BARE_LABEL = 'Adoption Rate'

const CANVAS_NODES = [
  {
    id: CAPPED_ID,
    type: 'factor',
    data: {
      label: CAPPED_LABEL,
      observedState: { cap: 20, unit: 'months' },
      prior: { range_min: 0, range_max: 1 },
    },
  },
  {
    id: NO_RANGE_ID,
    type: 'factor',
    data: { label: NO_RANGE_LABEL, observedState: { value: 0.3 } },
  },
  {
    id: BARE_ID,
    type: 'factor',
    data: {
      label: BARE_LABEL,
      observedState: { value: 0.3 },
      prior: { range_min: 0, range_max: 1 },
    },
  },
]

function mount(nodeId: string) {
  return render(<FactorValueControl nodeId={nodeId} testIdPrefix={PREFIX} />)
}

/** Open the editor and type `draft` into it. Returns the input. */
function typeInto(nodeId: string, draft: string) {
  mount(nodeId)
  fireEvent.click(screen.getByTestId(`${PREFIX}-value-edit`))
  const input = screen.getByTestId(`${PREFIX}-value-input`)
  fireEvent.change(input, { target: { value: draft } })
  return input
}

const offScale = () => screen.queryByTestId(`${PREFIX}-value-off-scale`)
const save = () => screen.getByTestId(`${PREFIX}-value-save`)

beforeEach(() => {
  sentEvents.length = 0
  showToast.mockReset()
  conversation = {
    sendSystemEvent: async (e: unknown) => {
      sentEvents.push(e)
      return { ok: true }
    },
  }
  useCanvasStore.setState({ currentScenarioId: 'sc_1', nodes: CANVAS_NODES } as never)
})

afterEach(() => {
  cleanup()
  useCanvasStore.setState({ currentScenarioId: null, nodes: [] } as never)
})

// ─────────────────────────────────────────────────────────────────────────────
// (a) THE CAP IS KNOWN — an off-scale value is named, and refused
// ─────────────────────────────────────────────────────────────────────────────

describe('(a) with the factor’s scale known, an off-scale value is not silently accepted', () => {
  it('RED-FIRST: 250000 on a cap-20 factor is accepted with no warning', () => {
    typeInto(CAPPED_ID, '250000')
    // THE DEFECT: at the base commit there is no element here at all, the Save
    // button is live, and pressing it puts 12500 on the wire as a model-scale
    // value against a prior whose top is 1.
    expect(offScale()).not.toBeNull()
    expect(save()).toBeDisabled()
  })

  it('the sentence names the bounds in the scale the reader is TYPING in', () => {
    typeInto(CAPPED_ID, '250000')
    // 0 and 1 are the prior's MODEL-scale ends; the cap of 20 is what makes the
    // typed-scale question "between 0 and 20". A sentence naming 0 and 1 here
    // would be arithmetically true and useless to someone typing months.
    expect(offScale()).toHaveTextContent(
      'Enter a value between 0 and 20 to save this change',
    )
  })

  it('the field is not remounted when the verdict flips mid-typing', () => {
    const input = typeInto(CAPPED_ID, '1')
    expect(offScale()).toBeNull()
    fireEvent.change(input, { target: { value: '250000' } })
    expect(offScale()).not.toBeNull()
    /*
     * ⭐⭐ THE SAME DOM NODE, BEFORE AND AFTER THE VERDICT FLIPS. This verdict
     * changes on a keystroke, so a wrapper rendered only in the refused state
     * moves the input's position in the React tree mid-word; React unmounts and
     * remounts it, and the reader loses focus and the caret on the exact
     * keystroke that takes the value off scale. That is how this control was
     * first written and the only thing that revealed it was a detached node.
     *
     * ⚠ THIS IS NOT REDUNDANT WITH THE `toHaveValue` ASSERTION BELOW. That one
     * fails for a remount too, but it fails the same way for a clamp, so it
     * cannot say WHICH defect is present. This binds the node identity.
     */
    expect(screen.getByTestId(`${PREFIX}-value-input`)).toBe(input)
  })

  it('the reader’s number is never rewritten into range', () => {
    const input = typeInto(CAPPED_ID, '250000')
    // ⛔ NOT CLAMPED. Showing 20 in a field the reader typed 250000 into would
    // be a worse lie than refusing it.
    expect(input).toHaveValue(250000)
  })

  it('nothing reaches the wire while the draft is off scale, by button OR by Enter', () => {
    const input = typeInto(CAPPED_ID, '250000')
    fireEvent.click(save())
    fireEvent.keyDown(input, { key: 'Enter' })
    // The keyboard path is guarded at the commit, not only at the button, so
    // the two routes cannot diverge.
    expect(sentEvents).toHaveLength(0)
    expect(showToast).not.toHaveBeenCalled()
  })

  it('an admissible value on the SAME factor is silent, live, and scale-correct', () => {
    const input = typeInto(CAPPED_ID, '12')
    expect(offScale()).toBeNull()
    expect(save()).toBeEnabled()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(sentEvents).toEqual([
      {
        type: 'factor_value_edit',
        payload: {
          target_id: CAPPED_ID,
          value: 0.6,
          field: 'value',
          raw_value: 12,
          unit: 'months',
        },
      },
    ])
  })

  it('the empty field does not greet the reader with a complaint', () => {
    mount(CAPPED_ID)
    fireEvent.click(screen.getByTestId(`${PREFIX}-value-edit`))
    // The field opens empty by design. `parseFloat('')` is NaN and the producer
    // returns null for it, so the editor opens silent.
    expect(offScale()).toBeNull()
    expect(save()).toBeEnabled()
  })

  it('the bounds are the FACTOR’s, not a constant', () => {
    typeInto(BARE_ID, '250000')
    // Same prior, no cap, no unit: `value` IS the model scale, so the typed
    // range is the prior's own 0 to 1. A hardcoded sentence would read "0 and
    // 20" here too.
    expect(offScale()).toHaveTextContent('Enter a value between 0 and 1 to save this change')
  })

  it('the reason is ASSOCIATED with the field and the button, not duplicated into them', () => {
    const input = typeInto(CAPPED_ID, '250000')
    const reasonId = offScale()?.getAttribute('id')
    expect(reasonId).toBeTruthy()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', reasonId as string)
    expect(save()).toHaveAttribute('aria-describedby', reasonId as string)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (b) NO RANGE IS DECLARED — the opposite direction, a different assertion
// ─────────────────────────────────────────────────────────────────────────────

describe('(b) with no range declared, no bound is invented and nothing is refused', () => {
  it('the same off-scale draft that is refused above is admitted here, in silence', () => {
    const input = typeInto(NO_RANGE_ID, '250000')
    // ⛔ A GUARD THAT INVENTED A BOUND WOULD BE A WORSE DEFECT THAN THE TRAP:
    // it would lock the reader out of a row whose only repair route is already
    // unreachable (#1428's own ruling, and #1451's). The factor records no
    // range, so there is nothing to measure this number against and nothing
    // this control may say about its scale.
    expect(offScale()).toBeNull()
    expect(save()).toBeEnabled()
    expect(input).not.toHaveAttribute('aria-invalid', 'true')

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(sentEvents).toHaveLength(1)
  })

  it('the two questions are derived separately, so neither reads as the other’s inverse', () => {
    // The capped factor DECLARES a range and is refused off-scale; the bare
    // factor declares NONE and is admitted. If the control had been written
    // against one predicate with a flipped sign, one of these two must break.
    typeInto(CAPPED_ID, '250000')
    expect(offScale()).not.toBeNull()
    cleanup()
    typeInto(NO_RANGE_ID, '250000')
    expect(offScale()).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (c) THE COPY RULES, ASSERTED ON THE RENDERED BYTES
// ─────────────────────────────────────────────────────────────────────────────

describe('(c) the sentence obeys the standing copy rules', () => {
  it('carries no em dash, no race framing, and promises no improvement', () => {
    typeInto(CAPPED_ID, '250000')
    const text = offScale()?.textContent ?? ''
    expect(text.length).toBeGreaterThan(0)
    // POSITIVE CONTROL for the matcher: it can see a dash when one is present.
    expect(`a ${'—'} b`).toMatch(/—/)
    expect(text).not.toMatch(/—/)
    for (const banned of ['winner', 'wins', 'leads', 'leading', 'beats', 'ahead of', 'better', 'improve']) {
      expect(text.toLowerCase(), `banned framing: ${banned}`).not.toContain(banned)
    }
  })
})
