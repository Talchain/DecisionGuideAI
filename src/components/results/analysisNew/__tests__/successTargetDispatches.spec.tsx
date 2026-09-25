/**
 * ⭐⭐⭐ THE SUCCESS TARGET REACHES THE SHARED MODEL, AND THE SENTENCE THE READER
 * IS SHOWN IS THE ONE THE AUTHORITY EARNED.
 *
 * ⚠⚠ THE DEFECT THIS PINS, MEASURED ON THE SERVED BUILD (10 Sep 2026). The
 * Reasoning tab's target editor committed, flipped its provenance label
 * truthfully to "Set by you", and then said **"Target set on your model. It
 * will be used the next time you analyse."** Both halves were false:
 * `setGoalThresholdAndUpdateNode` is store-only, and
 * `success_threshold`/`goalThreshold` appear ZERO times in
 * `src/v5/buildPayload.ts`. On reload the target reverted to its brief value
 * and the label reverted to "From brief", so the product re-attributed the
 * reader's own contribution to the brief. It was the only lying editor on the
 * panel.
 *
 * ⚠⚠ WHY A STORE ASSERTION WOULD NOT HAVE CAUGHT IT. A test that checked
 * "the store was written" passes on the LYING behaviour - the store write is
 * exactly what happened, and exactly what was not enough. So every case here
 * binds to one of the two things that were actually wrong: whether the
 * DISPATCH carried the reader's value, and which SENTENCE the outcome bought.
 *
 * ⚠ BOUND BY IDENTITY. The authority is mocked at its own module seam and the
 * toast at its own; the assertions name `proposeGoalTarget` and the exact copy
 * constants, never a value predicate another call could satisfy. The rendered
 * sentence is never compared against the same expression the component renders
 * - each arm names a DIFFERENT constant, so collapsing any two REDs.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const nodes: unknown[] = []
const showToast = vi.fn()
const setGoalThresholdAndUpdateNode = vi.fn()
const proposeGoalTarget = vi.fn()
const captureScenarioId = vi.fn(() => 'scenario-7' as string | null)
let goalTargetDispatchAvailable = true

type MockState = {
  nodes: unknown
  setHighlightedNodes: unknown
  setGoalThresholdAndUpdateNode: unknown
  goalThreshold: number | null
  goalThresholdRepresentation: string | null
  currentScenarioId: string | null
}
vi.mock('../../../../canvas/store', () => {
  const read = (): MockState => ({
    nodes,
    setHighlightedNodes: vi.fn(),
    setGoalThresholdAndUpdateNode,
    goalThreshold: null,
    goalThresholdRepresentation: null,
    currentScenarioId: 'scenario-7',
  })
  const useCanvasStore = (select: (s: MockState) => unknown) => select(read())
  ;(useCanvasStore as unknown as { getState: () => MockState }).getState = read
  return { useCanvasStore }
})
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: () => true }))
vi.mock('../../../../canvas/utils/highlightHelpers', () => ({
  highlightNode: vi.fn(),
  clearHighlight: vi.fn(),
}))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => showToast }))
vi.mock('../../../../canvas/hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({
    goalTargetDispatchAvailable,
    captureScenarioId,
    proposeGoalTarget,
    proposeFactorValue: vi.fn(() => 'dispatched'),
    proposeOptionIntervention: vi.fn(),
    proposeFactorConfirmation: vi.fn(),
  }),
}))

import { ModelStrip } from '../sections/ModelStrip'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'

const TID = 'analysis-new-model-strip'
const TARGET = `${TID}-target`

/**
 * A model whose GOAL carries a CEE-backfilled target and its unit.
 *
 * ⚠ THE UNIT IS PART OF THE FIXTURE BECAUSE IT IS PART OF THE CONTRACT.
 * `buildManualGoalTarget` refuses an empty unit outright, so a fixture without
 * one would exercise the refusal arm while appearing to exercise the send.
 */
const CANVAS = [
  {
    id: 'g1',
    type: 'goal',
    data: {
      label: 'Protect net revenue retention',
      goal_threshold_raw: 110,
      goal_threshold_unit: '%',
    },
  },
  { id: 'o1', type: 'option', data: { label: 'A full switch at renewal' } },
  { id: 'f1', type: 'factor', data: { label: 'Competitive pressure' } },
]

const typeTarget = (v: string) => {
  render(<ModelStrip isPreRun={false} />)
  fireEvent.click(screen.getByTestId(`${TARGET}-edit`))
  fireEvent.change(screen.getByTestId(`${TARGET}-input`), { target: { value: v } })
  fireEvent.click(screen.getByTestId(`${TARGET}-save`))
}

beforeEach(() => {
  nodes.length = 0
  nodes.push(...CANVAS)
  showToast.mockReset()
  setGoalThresholdAndUpdateNode.mockReset()
  captureScenarioId.mockClear().mockReturnValue('scenario-7')
  proposeGoalTarget.mockReset().mockReturnValue('dispatched')
  goalTargetDispatchAvailable = true
})
afterEach(cleanup)

describe('the target the reader typed is actually sent', () => {
  /**
   * ⭐⭐ THE LOAD-BEARING CASE. At the defect it FAILS because
   * `proposeGoalTarget` was never called at all: the commit went to
   * `setGoalThresholdAndUpdateNode` and stopped there.
   */
  it('dispatches the typed value, the unit on the goal, and the captured scenario', () => {
    typeTarget('125')
    /**
     * ⚠ FOUR ARGUMENTS NOW, AND THE FOURTH IS THE DEFAULT THIS FILE MUST PIN.
     * `at_least` is what an untouched interaction has always recorded, and
     * readers hold targets set under it — so an unstated direction reaching the
     * authority as anything else is a silent re-reading of their model, not a
     * refinement. The direction the reader CHOOSES is the direction-pair file's
     * question (`successTargetDirection.spec.tsx`); this is the default's.
     */
    /**
     * ⭐ A FIFTH ARGUMENT JOINED HERE — `{ onSendSettled }` — additive for the
     * `goal_target_edit` typed-carrier lane (`GOAL_TARGET_EDIT_ENABLED`,
     * currently `false`). `SuccessTargetLine` now always forwards its own
     * `onSendSettled` prop through; this harness never supplies one, so it
     * arrives as `undefined` — inert on the `add_constraint` path this test
     * exercises, and asserted so a later change cannot silently widen it.
     */
    expect(proposeGoalTarget).toHaveBeenCalledWith('125', '%', 'scenario-7', 'at_least', {
      onSendSettled: undefined,
    })
  })

  /**
   * ⚠ THE SCENARIO IS CAPTURED AT OPEN, NOT READ AT COMMIT. `proposeGoalTarget`
   * refuses when the captured id no longer matches `currentScenarioId`, which
   * is what makes a scenario switch mid-edit fail closed instead of writing the
   * reader's number onto a model they are no longer looking at. Reading it at
   * commit time would make that check compare a value with itself and always
   * pass - a guard agreeing with itself.
   */
  it('captures the scenario when the editor OPENS', () => {
    render(<ModelStrip isPreRun={false} />)
    expect(captureScenarioId).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId(`${TARGET}-edit`))
    expect(captureScenarioId).toHaveBeenCalled()
  })

  /**
   * ⭐⭐ THE DISCRIMINATING TWIN OF THE LOCAL-WRITE CASE BELOW, and the reason
   * both are needed. `proposeGoalTarget`'s own rule is *"do not echo the draft
   * into the store or claim saved on promise resolution"* - CEE's validated
   * commit path owns the write, and an optimistic `threshold_source: 'user'`
   * stamp beside the dispatch is precisely the fabricated authorship that made
   * the label say "Set by you" over a value the shared model never received.
   */
  it('does not echo the draft into the store when it dispatched', () => {
    typeTarget('125')
    expect(setGoalThresholdAndUpdateNode).not.toHaveBeenCalled()
  })

  /** A draft that is not a stated number is refused before the authority is asked. */
  it('never asks the authority about an unparseable draft', () => {
    typeTarget('soon')
    expect(proposeGoalTarget).not.toHaveBeenCalled()
    expect(setGoalThresholdAndUpdateNode).not.toHaveBeenCalled()
  })
})

describe('the sentence is the one the outcome earned', () => {
  it('a dispatched target says it was SENT, never that an analysis will use it', () => {
    proposeGoalTarget.mockReturnValue('dispatched')
    typeTarget('125')
    expect(showToast).toHaveBeenCalledWith(COPY.successTarget.dispatched)
    // ⚠ AND NOT EITHER OF THE OTHER TWO. Naming the constant alone would still
    // pass if a later edit pointed all three arms at one string; naming what it
    // must NOT be makes this arm discriminating on its own.
    expect(showToast).not.toHaveBeenCalledWith(COPY.successTarget.changedLocally)
    expect(showToast).not.toHaveBeenCalledWith(COPY.successTarget.notEncodable)
  })

  /**
   * ⚠ `dispatched` IS NOT "SAVED". The turn has been sent; the authority
   * answers asynchronously and CEE's commit path owns acceptance. This is the
   * same ceiling `modelStrip.valueDispatched` answers to, and it is the reason
   * the old sentence was wrong even before its persistence claim.
   */
  it('the dispatched sentence does not claim a save', () => {
    expect(COPY.successTarget.dispatched).not.toMatch(/\bsaved?\b/i)
  })

  /**
   * ⚠ A REFUSAL IS NOT A SEND. `proposeGoalTarget` answers `not_encodable` when
   * the goal has no unit, when the target is at or below zero, or when the
   * scenario moved under the editor - and from the reader's side those are one
   * state: nothing was written anywhere.
   */
  /**
   * ⛔⛔ THE CAUSE A READER CAN ACT ON, SPLIT OUT OF THE THREE.
   *
   * Witnessed on the deployed build (4ad71f6c, 15 Sep), driving the real panel:
   * the panel's own top recommendation is "Set a target"; the reader sets one;
   * the answer was "That target could not be applied, so nothing changed." with
   * no cause and no move, while `Re-analyse` stayed disabled. The goal carried
   * `unit: null`.
   *
   * ⭐ AND THE SIBLING WAS IN THE SAME FILE'S COMMENTS. The Model tab refuses
   * the identical draft with "Add a unit" (`unproposableDraftReason`), and
   * `SuccessTargetLine`'s own header says so. One refusal, two surfaces, one
   * vocabulary — the divergence is what made this findable only by driving it.
   *
   * ⚠ DECIDED BEFORE THE DISPATCH, so `proposeGoalTarget` is asserted NOT
   * CALLED: there is nothing to ask a shared model about when the parameter it
   * requires is absent, and a round trip here would report a refusal the
   * producer never made.
   */
  it('a goal with no unit names the cause and never dispatches', () => {
    nodes.length = 0
    nodes.push(
      ...CANVAS.map((n) =>
        n.type === 'goal'
          ? { ...n, data: { ...n.data, goal_threshold_unit: undefined, unit: undefined } }
          : n,
      ),
    )
    typeTarget('125')

    expect(showToast).toHaveBeenCalledWith(COPY.successTarget.noUnit)
    expect(
      proposeGoalTarget,
      'nothing to ask the shared model when the parameter it requires is absent',
    ).not.toHaveBeenCalled()
    expect(
      screen.getByTestId(`${TARGET}-input`),
      'the editor stays open, as it does for every refusal',
    ).toBeInTheDocument()
  })

  /**
   * ⭐ THE CONTRAST CONTROL. Without it the case above passes on a component
   * that refuses EVERY target — and the suite would applaud a control that
   * never works. Same fixture family, unit present, dispatch happens.
   */
  it('CONTROL: with a unit present the same draft dispatches', () => {
    typeTarget('125')
    expect(proposeGoalTarget).toHaveBeenCalled()
    expect(showToast).not.toHaveBeenCalledWith(COPY.successTarget.noUnit)
  })

  it('a refused target says nothing changed, and leaves the editor open', () => {
    proposeGoalTarget.mockReturnValue('not_encodable')
    typeTarget('125')
    expect(showToast).toHaveBeenCalledWith(COPY.successTarget.notEncodable)
    expect(showToast).not.toHaveBeenCalledWith(COPY.successTarget.dispatched)
    expect(screen.getByTestId(`${TARGET}-input`)).toBeInTheDocument()
  })

  /**
   * ⭐⭐ THE THIRD ARM, ON THE OTHER SIDE OF THE FIXTURE. With no dispatcher
   * mounted the local write IS the whole outcome, and the sentence must say so.
   * This is the arm the old copy got wrong, so it is pinned on BEHAVIOUR (the
   * store was written, the authority was not asked) as well as on the sentence.
   */
  it('with no dispatcher, it writes locally and says Olumi has not been told', () => {
    goalTargetDispatchAvailable = false
    typeTarget('125')
    expect(proposeGoalTarget).not.toHaveBeenCalled()
    /**
     * ⚠ THIS ASSERTION USED TO READ `('g1', 125)` — TWO ARGUMENTS — AND THE
     * VERDICT CHANGED DELIBERATELY. The store action has always accepted
     * `{ unit }` and this path was omitting it, so on the ONE route where
     * nothing downstream can recover the reader's unit it was discarded. The
     * fixture's goal declares `'%'`, and the local write now records it.
     * Strengthened, not relaxed: the old form passes on a call that drops the
     * unit, this one does not.
     */
    expect(setGoalThresholdAndUpdateNode).toHaveBeenCalledWith('g1', 125, { unit: '%' })
    expect(showToast).toHaveBeenCalledWith(COPY.successTarget.changedLocally)
    expect(showToast).not.toHaveBeenCalledWith(COPY.successTarget.dispatched)
  })

  /**
   * ⚠⚠ THE COLLAPSE GUARD. Three outcomes must buy three sentences. If a later
   * edit points two arms at one constant, the arms above still pass - each
   * would simply assert the same string - and this is the case that REDs.
   */
  it('the three sentences are three different sentences', () => {
    const said = new Set([
      COPY.successTarget.dispatched,
      COPY.successTarget.changedLocally,
      COPY.successTarget.notEncodable,
    ])
    expect(said.size).toBe(3)
  })

  /**
   * ⚠ THE WITHDRAWN CLAIM, PINNED BY ITS SUBSTANCE. Neither sentence a
   * NON-dispatched outcome can buy may promise the value reaches an analysis:
   * `success_threshold` and `goalThreshold` reach `buildPayload.ts` zero times,
   * so the promise is false on both of those paths whatever wording carries it.
   *
   * ⭐ AND THE POSITIVE CONTROL, so this is not an absence probe that cannot
   * see a presence: the shipped sentence IS matched by the pattern.
   */
  const SHIPPED_LIE = 'Target set on your model. It will be used the next time you analyse.'
  const PROMISES_AN_ANALYSIS = /\b(next time you analyse|used in the analysis|when you analyse)\b/i

  it('the pattern can see the sentence that actually shipped', () => {
    expect(PROMISES_AN_ANALYSIS.test(SHIPPED_LIE)).toBe(true)
  })

  it('no non-dispatched sentence promises an analysis will use the value', () => {
    expect(PROMISES_AN_ANALYSIS.test(COPY.successTarget.changedLocally)).toBe(false)
    expect(PROMISES_AN_ANALYSIS.test(COPY.successTarget.notEncodable)).toBe(false)
  })
})

/**
 * ⛔⛔⛔ THE FIGURE FROM THE READER'S OWN BRIEF, REFUSED WITHOUT A REASON.
 *
 * WITNESSED 19 Sep 2026. The panel's Strengthen row says "No measurable success
 * target is set" and offers "Define success". Paul did exactly that and typed
 * `1.3 million` — the figure from his brief, in the words his brief used:
 *
 *     "We're raising 1.3 million, and we need all of it."
 *
 * `statedTargetNumber` is an anchored numeric-literal predicate and does not
 * read magnitude words, so the commit answered `not_encodable` and the whole of
 * what he was told was:
 *
 *     "That target could not be applied, so nothing changed."
 *
 * ⭐ THE PRODUCT ASKED FOR AN INPUT, THE USER SUPPLIED IT, AND IT WAS REFUSED
 * WITHOUT SAYING WHAT WAS WRONG. That is the worst interaction on this surface:
 * it punishes the one act the panel is trying to produce.
 *
 * ⚠ THE PARSER IS NOT WIDENED. A magnitude alphabet is a known hazard here —
 * the canonical map was missing `thousand` while every derived guard agreed
 * with it (trap 12d) — and it has an owner. Naming the cause is the bounded
 * correction; reading "1.3 million" is separate, larger work.
 */
describe('an unreadable amount says what to type, not just that it failed', () => {
  /**
   * ⭐⭐ THE CONTROL. Every arm below is vacuous unless a VALID amount still
   * dispatches from this same harness — otherwise "the refusal is specific"
   * could pass on an editor that refuses everything.
   */
  it('CONTROL: a digit amount still dispatches', () => {
    typeTarget('1300000')
    expect(proposeGoalTarget).toHaveBeenCalledWith('1300000', '%', 'scenario-7', 'at_least', {
      onSendSettled: undefined,
    })
  })

  it('⛔ the witnessed input is not sent, and is not reported as a generic failure', () => {
    typeTarget('1.3 million')
    // Nothing is dispatched — the draft never became a number.
    expect(proposeGoalTarget).not.toHaveBeenCalled()
    // And the reader is told WHY, not merely that nothing happened.
    expect(showToast).toHaveBeenCalledWith(COPY.successTarget.notANumber)
    expect(showToast).not.toHaveBeenCalledWith(COPY.successTarget.notEncodable)
  })

  /**
   * ⭐ THE SENTENCE SHOWS THE FORMAT RATHER THAN NAMING IT. A refusal that says
   * "use a number" without demonstrating one makes the reader guess twice.
   */
  it('and the sentence demonstrates what a readable amount looks like', () => {
    typeTarget('1.3 million')
    const said = showToast.mock.calls.at(-1)?.[0] ?? ''
    expect(said).toMatch(/\d{4,}/)
  })

  /**
   * ⚠ THE OPPOSITE-DIRECTION TWIN. A BLANK draft is not a format problem —
   * nothing was typed, so "I could not read that as a number" would answer a
   * question the reader did not ask. It stays on the generic refusal.
   */
  it('a blank draft is still the generic refusal, not a format complaint', () => {
    typeTarget('   ')
    expect(proposeGoalTarget).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith(COPY.successTarget.notEncodable)
    expect(showToast).not.toHaveBeenCalledWith(COPY.successTarget.notANumber)
  })

  /** Other unreadable shapes reach the same sentence — the class, not the case. */
  it.each(['one point three million', '£1.3m', 'about 1.3', 'lots'])(
    '%s is reported as unreadable, not as a generic failure',
    (draft) => {
      typeTarget(draft)
      expect(showToast).toHaveBeenCalledWith(COPY.successTarget.notANumber)
    },
  )
})
