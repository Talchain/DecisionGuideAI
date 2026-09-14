/**
 * ⭐⭐ "The numbers behind these are mine" — AND NOT ONE OF THEM IS ON SCREEN.
 *
 * ── THE DEFECT, DERIVED 12 Sep 2026 ────────────────────────────────────────
 * `EstimatedFactorRow` renders exactly two things: `factor.label` and
 * `FactorValueControl`. No value, no unit, no figure of any kind. It sits under
 * `COPY.estimatedLead` — *"The numbers behind these are mine, not yours. If you
 * have better ones, tell me and I'll use them."*
 *
 * **Better than WHAT?** The sentence licenses a comparison against a number the
 * reader is never shown, and the control it introduces opens an empty box.
 * Two sessions independently typed a real-world figure into that box on a
 * normalised quantity (`7`, then `250000`); a third saw `+250` reverse the
 * ranking outright. The control offered no anchor because the surface had none.
 *
 * ── ⛔ WHY THIS IS NOT THE SEED, WHICH IS THE FIX THE REGISTER PRESCRIBES ───
 * ROADMAP 2.1385 says *"THE FIX IS THE SEED: render the current value in the
 * units the field expects"* — meaning pre-fill the INPUT. That is refused by a
 * written ruling at `FactorValueControl.tsx`: *"THE FIELD OPENS EMPTY, NEVER
 * SEEDED … seeding would invite the reader to nudge OUR number rather than
 * state THEIRS, which is the whole point of the act."*
 *
 * Both are right, about DIFFERENT THINGS (CLAUDE.md trap 21 — name the question
 * each answers, do not align them):
 *
 *   · the FIELD is the reader's STATEMENT   → stays empty. Their number.
 *   · the ROW is the product's DISCLOSURE   → shows ours. The thing they are
 *     invited to better.
 *
 * The ruling's own closing clause is the measurement of this gap, not an
 * argument against closing it: *"Neither surface displays a figure whose scale
 * a seed could inherit either."* Nothing did. Now the row does, and the field
 * still opens empty — pinned below, so no later seat can read this change as
 * licence to seed.
 *
 * ── ⛔ AND WHY IT IS NOT A RANGE EITHER ────────────────────────────────────
 * The obvious alternative — state the admitted range at rest, the positive twin
 * of #1507's `NO_RANGE_NOTICE` — is refused by a SECOND written ruling, in two
 * services. `factorPriorRange.ts:261` suppresses the line on an ignorance
 * prior, quoting CEE's own comment: *"instead of printing a bare `Range: 0 to
 * 1`"*. Every factor in a drafted model carries `prior: {range_min: 0,
 * range_max: 1}`, so an at-rest range notice would print that bare line on
 * essentially every row the reader meets, beside a sentence saying we have no
 * real estimate. A value is not a range; disclosing one asserts nothing about
 * the other.
 *
 * ── THE RULE IS IMPORTED, NEVER RE-DERIVED ─────────────────────────────────
 * The number comes from `resolveValueInputSeed` — the module's own "single
 * definition of what the value input shows and what scale that number is in",
 * already the authority for four surfaces. A `raw_value ?? value` written here
 * would be a fifth spelling of the scale contract (trap 12), and it would be
 * the dangerous kind: the row would disagree with the field beside it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const conversation = { sendSystemEvent: () => Promise.resolve(undefined) }
vi.mock('../../../../canvas/conversation/ConversationContext', () => ({
  useOptionalConversationContext: () => conversation,
  useConversationContext: () => conversation,
  ConversationProvider: ({ children }: { children: unknown }) => children,
}))
vi.mock('../../../../canvas/ToastContext', () => ({
  useShowToastSafe: () => vi.fn(),
  ToastProvider: ({ children }: { children: unknown }) => children,
}))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

import { WhatIWasGivenSection } from '../WhatIWasGivenSection'
import { useCanvasStore } from '@/canvas/store'
import { useContextIntegrityStore } from '@/canvas/stores/contextIntegrityStore'
import { parseNotModelled } from '@/adapters/cee/notModelled'
import b1Fixture from './fixtures/b1-cold-read.not-modelled.json'

const TID = 'what-i-was-given-estimated'
const LIVE_SCENARIO_ID = '11111111-1111-4111-8111-111111111111'

/**
 * ── IDENTITY ANCHORS, HAND-PINNED ──────────────────────────────────────────
 * Read from the fixture by hand, never derived at runtime: a number read from
 * the fixture inside the test is an oracle agreeing with itself.
 */
const TARGET_NODE_ID = 'fac_cash_runway'
const OTHER_NODE_ID = 'fac_nrr'
/** Listed by the manifest, absent from the canvas — the reachable divergence
 *  the sibling spec measured. It is this suite's CONTRAST CONTROL. */
const ORPHAN_NODE_ID = 'fac_bafin_complexity'

/**
 * ⚠ THE TWO ROWS CARRY DIFFERENT NUMBERS ON PURPOSE, AND BOTH ARE USER-UNIT
 * MAGNITUDES ON A CAPPED FACTOR. `8` and `112` are `raw_value`, not `value`
 * (`0.4` and `1.12`). A fixture whose rows shared a number could not tell a row
 * bound to its own node from one rendering whatever it found first (trap 19),
 * and a fixture with no cap could not tell the canonical scale rule from a bare
 * read of `value`.
 */
const CANVAS_NODES = [
  { id: 'g1', type: 'goal', data: { label: 'Protect the runway' } },
  {
    id: TARGET_NODE_ID,
    type: 'factor',
    data: {
      label: 'Cash Runway',
      observedState: { value: 0.4, raw_value: 8, cap: 20, unit: 'months', source: 'cee_inference' },
    },
  },
  {
    id: OTHER_NODE_ID,
    type: 'factor',
    data: {
      label: 'Net Revenue Retention',
      observedState: { value: 1.12, raw_value: 112, cap: 200, unit: '%', source: 'cee_inference' },
    },
  },
]

beforeEach(() => {
  useContextIntegrityStore.getState().reset()
  useCanvasStore.setState({ currentScenarioId: LIVE_SCENARIO_ID, nodes: CANVAS_NODES } as never)
  useContextIntegrityStore.getState().setContextIntegrity({
    scenarioId: LIVE_SCENARIO_ID,
    briefText: (b1Fixture as { brief_text: string }).brief_text,
    manifest: parseNotModelled((b1Fixture as { not_modelled: unknown }).not_modelled),
  })
})

afterEach(() => {
  useContextIntegrityStore.getState().reset()
  useCanvasStore.setState({ currentScenarioId: null, nodes: [] } as never)
  cleanup()
})

const open = () => {
  render(<WhatIWasGivenSection offerEstimatedValueControl={true} />)
  fireEvent.click(screen.getByTestId('what-i-was-given-toggle'))
}

/**
 * Find a disclosure BY THE ROW'S NODE ID, never by position or by text.
 * `getAllByTestId(...)[0]` passes on whichever row happens to sort first — an
 * assertion bound by a predicate another object satisfies (CLAUDE.md trap 19).
 */
const valueFor = (nodeId: string): HTMLElement | undefined =>
  screen.queryAllByTestId(`${TID}-current-value`).find((el) => el.getAttribute('data-node-id') === nodeId)

describe('what I estimated discloses the number it is asking you to better', () => {
  /**
   * ⭐ RED-FIRST SIGNATURE 1 — at pristine no row renders any figure, so this
   * fails on `toBeInTheDocument`.
   *
   * ⚠ THE EXPECTED STRING IS `8`, THE USER-UNIT MAGNITUDE, NOT THE MODEL-SCALE
   * `0.4`. That is what `resolveValueInputSeed` resolves for this shape and it
   * is what the field beside it would accept, which is the whole reason the
   * rule is imported rather than re-typed. A row disclosing `0.4` while the
   * field expects months would be worse than disclosing nothing.
   */
  it('states the estimated factor current value, in the units the field expects', () => {
    open()
    const disclosed = valueFor(TARGET_NODE_ID)
    expect(disclosed).toBeInTheDocument()
    expect(disclosed?.textContent).toBe('Current value: 8')
  })

  /**
   * ⭐⭐ RED-FIRST SIGNATURE 2 — THE DISCRIMINATING HALF. Signature 1 alone is
   * satisfied by a row that renders any number at all; this one fails unless
   * each row reads ITS OWN node. The two assertions are the pair: same testid,
   * different node ids, different numbers.
   */
  it('binds each disclosure to its own factor, not to whichever row rendered first', () => {
    open()
    expect(valueFor(TARGET_NODE_ID)?.textContent).toBe('Current value: 8')
    expect(valueFor(OTHER_NODE_ID)?.textContent).toBe('Current value: 112')
  })

  /**
   * ⭐ THE CONTRAST CONTROL, and the honest absence. The manifest is a COLD-READ
   * SNAPSHOT and lists factors the canvas may not hold. There is no number to
   * state for one of those, so none is stated — rather than a `0`, a dash, or
   * an empty element, each of which would be a claim we cannot support.
   *
   * ⚠ IT IS A CONTRAST CONTROL AND NOT MERELY A NEGATIVE CASE: it runs in the
   * SAME render as the two rows above, so a suite where the query itself had
   * stopped matching would fail signatures 1 and 2 rather than passing this one
   * by blindness (CLAUDE.md trap 13e).
   */
  it('states nothing for a listed factor the canvas does not hold', () => {
    open()
    expect(valueFor(ORPHAN_NODE_ID)).toBeUndefined()
    // The same render genuinely resolves the rows that DO exist.
    expect(valueFor(TARGET_NODE_ID)).toBeInTheDocument()
  })

  /**
   * ⭐⭐ THE RULING THIS CHANGE MUST NOT BREAK, PINNED AS A TEST RATHER THAN AS
   * A COMMENT. `FactorValueControl` opens its field EMPTY on purpose: the act
   * is the reader STATING their number, not nudging ours. Disclosing the value
   * in the ROW is what makes that act informed; seeding the FIELD would defeat
   * it. Anyone who later reads this change as licence to pre-fill the input —
   * the fix ROADMAP 2.1385 literally prescribes — turns this RED.
   */
  it('discloses the value without seeding the input', () => {
    open()
    const trigger = screen
      .queryAllByTestId(`${TID}-value-edit`)
      .find((el) => el.getAttribute('data-node-id') === TARGET_NODE_ID)
    expect(trigger).toBeInTheDocument()
    fireEvent.click(trigger as HTMLElement)
    const input = screen
      .queryAllByTestId(`${TID}-value-input`)
      .find((el) => el.getAttribute('data-node-id') === TARGET_NODE_ID)
    expect(input).toBeInTheDocument()
    expect((input as HTMLInputElement).value).toBe('')
    // And the disclosure survives the field opening — the anchor is still on
    // screen while the reader types, which is the point of putting it in the row.
    expect(valueFor(TARGET_NODE_ID)?.textContent).toBe('Current value: 8')
  })

  /**
   * ⭐ THE CANONICAL RULE'S OTHER ARM. A factor with no `raw_value` never
   * displayed a user-unit magnitude, so its model-scale `value` IS what the
   * field expects. A hand-rolled `raw_value` read would disclose nothing here
   * and this would RED — which is the point of importing the rule rather than
   * writing a fifth spelling of the scale contract (CLAUDE.md trap 12).
   */
  it('falls back to the model-scale value when the factor carries no magnitude', () => {
    useCanvasStore.setState({
      nodes: [
        CANVAS_NODES[0],
        {
          id: TARGET_NODE_ID,
          type: 'factor',
          data: { label: 'Cash Runway', observedState: { value: 0.35, source: 'cee_inference' } },
        },
        CANVAS_NODES[2],
      ],
    } as never)
    open()
    expect(valueFor(TARGET_NODE_ID)?.textContent).toBe('Current value: 0.35')
  })
})
