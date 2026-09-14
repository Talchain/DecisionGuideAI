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
    expect(proposeGoalTarget).toHaveBeenCalledWith('125', '%', 'scenario-7', 'at_least')
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
    expect(setGoalThresholdAndUpdateNode).toHaveBeenCalledWith('g1', 125)
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
