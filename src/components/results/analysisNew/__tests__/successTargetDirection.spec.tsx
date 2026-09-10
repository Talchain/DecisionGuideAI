/**
 * ⭐⭐⭐ THE DIRECTION OF A GOAL TARGET IS THE READER'S TO STATE, AND BOTH
 * EXPRESSIONS OF IT MUST MOVE TOGETHER.
 *
 * ⚠⚠ WHAT SHIPPED, MEASURED ON THE SERVED BUILD `475ee1c7` (10 Sep 2026).
 * A guest opened the Reasoning tab on a goal reading
 * **"95% Next-Day Delivery Within 12 Months"**, strip **"Target: 12 months"**,
 * pressed Change, typed `9`, saved. The wire carried:
 *
 *   {"kind":"message","stage":"analyse","turn_class":"frame",
 *    "message":"This goal must be at least 9 months. This is an absolute
 *               level, not a change from the current level.",
 *    "source":"chip_click",
 *    "chip":{"action_type":"add_constraint",
 *            "parameters":{"constraint_type":"at_least",
 *                          "target_id":"4731f926","value":9,"unit":"months"}}}
 *
 * and CEE answered *"Success target set: ... at least 9 months."* The goal is a
 * DEADLINE, a ceiling on time. The reader meant "sooner, within 9 months". The
 * model recorded a FLOOR, which is close to the opposite of what they said.
 *
 * ⚠⚠⚠ THE WRITER WAS NEVER BUGGY, AND THIS FILE MUST NOT BE READ AS SAYING SO.
 * `buildManualGoalTarget` hardcoded `at_least` deliberately, under a comment
 * that is still true: *"No parsing of goal labels, delta-to-level conversion or
 * local graph write."* Recovering direction from the words of a goal label is
 * the natural-language predicate CLAUDE.md trap 22f records as UNWINNABLE after
 * four rounds that each fixed one direction and reopened the other. The fix is
 * trap 22f's own sanctioned exit: where direction cannot be DERIVED, make the
 * ambiguity the product and ASK. The defect was that nothing ever asked, and
 * the word "minimum" lived only in a dispatch label and an authority key the
 * reader never sees.
 *
 * ── WHY A PAIR, AND WHY THROUGH THE REAL AUTHORITY ────────────────────────
 * ⚠ A ONE-DIRECTION TEST IS A GUARD WATCHING ONE DOOR, and this estate has
 * shipped that exact defect repeatedly (CLAUDE.md trap 22b: a corpus that tests
 * one direction certified a fix that reopened the original lie in the other).
 * So every case here has its opposite-direction twin, and BOTH assert the
 * DISPATCHED PAYLOAD rather than the rendered label — a selector that reads
 * "at most" over a dispatch of `at_least` is precisely the defect, and only the
 * payload can see it.
 *
 * ⚠ THE AUTHORITY IS REAL HERE, DELIBERATELY. `successTargetDispatches.spec.tsx`
 * mocks `useModelEditAuthority` and asserts the ARGUMENTS `proposeGoalTarget`
 * received, which is the right question for that file. It is one hop short of
 * this one: it cannot see what the builder then encodes. This file mocks only
 * the conversation seam, so the chain under test is the whole of
 * selector → SuccessTargetLine → useModelEditAuthority → buildManualGoalTarget
 * → dispatchAction, which is the chain the capture above came off.
 *
 * ⚠ EVERY EXPECTATION IS A LITERAL. Comparing against the constant the code
 * emits would move both sides together and the test could not RED in either
 * direction (CLAUDE.md trap 13b, a guard agreeing with itself).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Node } from '@xyflow/react'

const dispatchAction = vi.fn().mockResolvedValue(undefined)
vi.mock('../../../../canvas/conversation/ConversationContext', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useOptionalConversationContext: () => ({ dispatchAction, sendSystemEvent: vi.fn() }),
}))

import { useCanvasStore } from '../../../../canvas/store'
import { SuccessTargetLine } from '../sections/SuccessTargetLine'

const TID = 'target'

/**
 * ⭐ THE DEADLINE-SHAPED GOAL FROM THE CAPTURE, in the node fields
 * `resolveGoalTarget` actually reads. `months` is the unit that made the
 * shipped sentence read as a floor on time.
 */
const goal: Node = {
  id: 'goal-delivery',
  type: 'goal',
  position: { x: 0, y: 0 },
  data: {
    kind: 'goal',
    label: '95% Next-Day Delivery Within 12 Months',
    goal_threshold_raw: 12,
    goal_threshold_unit: 'months',
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  useCanvasStore.setState({
    nodes: [structuredClone(goal)],
    edges: [],
    currentScenarioId: 'scenario-a',
  })
})
afterEach(() => {
  cleanup()
})

function draw() {
  render(
    <SuccessTargetLine goalNodeId="goal-delivery" onCommitOutcome={vi.fn()} testId={TID} />,
  )
}

/**
 * Open the editor, optionally state a direction, type an amount, save.
 *
 * ⭐⭐⭐ THE DIRECTION IS CHOSEN BY THE WORD ON SCREEN, NEVER BY THE OPTION'S
 * UNDERLYING VALUE — and that distinction caught a live hole in this very file.
 *
 * ⚠⚠ MEASURED, NOT REASONED. These arms first selected by value
 * (`selectOptions(select, 'at_most')`). A mutant that SWAPS THE TWO VISIBLE
 * WORDS against their values — so the option reading "at most" carries
 * `at_least` — left all five cases GREEN. That mutant is the shipped defect in
 * miniature: the reader is shown one direction and the model records the other,
 * which is precisely what this file exists to prevent. A test bound to the
 * value cannot see it, because the value is the half the reader never touches.
 *
 * Selecting by ACCESSIBLE NAME binds the WORD A HUMAN READS to the PAYLOAD THAT
 * RESULTS, which is the property, and the swap mutant now REDs. This is
 * CLAUDE.md trap 19 read the right way round: bind to the object the claim is
 * about, not to a handle that merely sits near it.
 */
async function statTarget(amount: string, directionWord?: 'at least' | 'at most') {
  const user = userEvent.setup()
  await user.click(screen.getByTestId(`${TID}-edit`))
  if (directionWord !== undefined) {
    const select = screen.getByTestId(`${TID}-direction`)
    await user.selectOptions(select, within(select).getByRole('option', { name: directionWord }))
  }
  const input = screen.getByTestId(`${TID}-input`)
  await user.clear(input)
  await user.type(input, amount)
  await user.click(screen.getByTestId(`${TID}-save`))
}

/** The one dispatched action, or a hard failure naming what arrived instead. */
function onlyDispatch() {
  expect(dispatchAction).toHaveBeenCalledTimes(1)
  return dispatchAction.mock.calls[0][0] as {
    action_type: string
    message: string
    parameters: { target_id: string; constraint_type: string; value: number; unit: string }
  }
}

describe('the reader states which way a goal target is read, and the wire agrees', () => {
  /**
   * ⭐⭐ ARM ONE OF THE PAIR — THE DEFECT'S OWN CASE. This is the capture at the
   * top of this file with the one thing the reader was never offered.
   */
  it('records at most, and says at most, when the reader states at most', async () => {
    draw()
    await statTarget('9', 'at most')

    const sent = onlyDispatch()
    expect(sent.action_type).toBe('add_constraint')
    // ⚠ BOUND BY IDENTITY — the goal's own id, never a value another node
    // could satisfy (CLAUDE.md trap 19).
    expect(sent.parameters.target_id).toBe('goal-delivery')
    expect(sent.parameters.constraint_type).toBe('at_most')
    expect(sent.parameters.value).toBe(9)
    expect(sent.parameters.unit).toBe('months')
    /**
     * ⚠⚠ THE PROSE AND THE STRUCTURE ARE TWO EXPRESSIONS OF ONE FACT, and a
     * mismatch between them is the defect one level down: CEE reads the
     * sentence, the graph reads the parameter. Pinned in the same case, as
     * literals, so a change to either alone REDs.
     */
    expect(sent.message).toBe(
      'This goal must be at most 9 months. This is an absolute level, not a change from the current level.',
    )
  })

  /**
   * ⭐⭐ ARM TWO — AND IT IS THE REGRESSION GUARD, NOT A FORMALITY. Readers have
   * already set targets under the shipped behaviour. Silently re-reading those
   * as ceilings would be a worse harm than the gap this change closes, so an
   * UNTOUCHED interaction must still record exactly what it recorded before.
   */
  it('still records at least, and says at least, when the reader states nothing', async () => {
    draw()
    await statTarget('9')

    const sent = onlyDispatch()
    expect(sent.action_type).toBe('add_constraint')
    expect(sent.parameters.target_id).toBe('goal-delivery')
    expect(sent.parameters.constraint_type).toBe('at_least')
    expect(sent.parameters.value).toBe(9)
    expect(sent.parameters.unit).toBe('months')
    expect(sent.message).toBe(
      'This goal must be at least 9 months. This is an absolute level, not a change from the current level.',
    )
  })

  /**
   * ⭐⭐ THE SAME PAIR, STATED EXPLICITLY IN BOTH DIRECTIONS. The case above
   * proves the DEFAULT is `at_least`; this proves that CHOOSING `at_least`
   * reaches the wire as `at_least` rather than merely failing to change
   * anything. A selector that was inert would pass the default case and fail
   * this one.
   */
  it('records at least when the reader states at least, having first seen at most', async () => {
    draw()
    const user = userEvent.setup()
    await user.click(screen.getByTestId(`${TID}-edit`))
    const select = screen.getByTestId(`${TID}-direction`)
    // By the words, in both moves — see `statTarget`.
    await user.selectOptions(select, within(select).getByRole('option', { name: 'at most' }))
    await user.selectOptions(select, within(select).getByRole('option', { name: 'at least' }))
    const input = screen.getByTestId(`${TID}-input`)
    await user.clear(input)
    await user.type(input, '9')
    await user.click(screen.getByTestId(`${TID}-save`))

    const sent = onlyDispatch()
    expect(sent.parameters.constraint_type).toBe('at_least')
    expect(sent.message).toBe(
      'This goal must be at least 9 months. This is an absolute level, not a change from the current level.',
    )
  })

  /**
   * ⭐⭐ WHAT A READER WHO NEVER TOUCHES THE SELECTOR IS TOLD. The shipped
   * defect was not a wrong write so much as an UNSTATED one: "minimum" existed
   * only in a dispatch label and an authority key, neither of which reaches a
   * screen. The editor must say, in words, which way it is about to record —
   * before any interaction, in the default state.
   *
   * ⚠ ASSERTED ON THE SELECTOR'S OWN VALUE AND ITS VISIBLE OPTIONS, not on the
   * presence of a control. A rendered selector with no readable direction word
   * would satisfy "a selector exists" and leave the reader exactly as
   * uninformed as before.
   */
  it('states the direction in words before the reader touches anything', async () => {
    draw()
    await userEvent.setup().click(screen.getByTestId(`${TID}-edit`))

    const select = screen.getByTestId(`${TID}-direction`)
    expect(select).toBeInTheDocument()
    expect(select).toHaveValue('at_least')
    /**
     * ⚠⚠ EACH WORD PINNED TO THE VALUE IT SENDS, not merely present in the
     * control. `toHaveTextContent('at least')` passes just as happily when the
     * two words are swapped onto each other's values — the mutant that did
     * exactly that survived an earlier version of this file. The pairing IS
     * the claim: what the reader reads is what the wire carries.
     */
    expect(within(select).getByRole('option', { name: 'at least' })).toHaveValue('at_least')
    expect(within(select).getByRole('option', { name: 'at most' })).toHaveValue('at_most')
    // The selector carries its own accessible name, so the direction is
    // announced rather than inferred from position.
    expect(select).toHaveAccessibleName('How this target should be read')
  })

  /**
   * ⚠ A DIRECTION IS NOT A LICENCE TO SEND. The builder's existing refusals are
   * unchanged by this change, and a stated direction must not smuggle an
   * unbuildable draft past them.
   */
  it('refuses an unparseable draft in either direction, and sends nothing', async () => {
    draw()
    await statTarget('abc', 'at most')
    expect(dispatchAction).not.toHaveBeenCalled()
  })
})
