/**
 * ⭐⭐ THE "DEFINE SUCCESS" CTA MUST NOT HAND OFF A REQUEST THE PRODUCT CANNOT ACT ON.
 *
 * ── THE WITNESS (deployed staging, 2026-09-11, UI 9e2916fc / CEE dcebc36) ──
 * The product prescribed "Focus next: set a success target to unlock Goal fit."
 * and offered a `Define success` CTA. Following it exactly cost FOUR turns and
 * ended in an error, with the goal node still reading "Target not captured":
 *
 *   1. `Define success`  → Ask-Olumi drawer, prefilled
 *                          "Help me work through: Define what success looks like"
 *   2. user states a target → CEE asks "Did you mean 1.2% or an absolute 1.2?"
 *      (`add-constraint.ts` Gate-1 unit-ambiguity refusal: the proposal carried
 *      no `unit` parameter even though the user's own message said "1.2%")
 *   3. user restates + "Apply it" → warrant demotion, "Nothing has been changed"
 *      + an `Add this limit` chip (`v5.turn_executor.mutation_warrant_absent`)
 *   4. chip click → `parameter_invalid_at_execute` → "I could not apply that
 *      constraint because the target or constraint details were not valid."
 *
 * THE HAND-OFF IS THE FIRST LINK AND THE ONLY ONE THIS SURFACE OWNS. The draft
 * it sends carries no instruction to change anything, no number, no unit and no
 * direction, so every one of the remaining three turns exists to recover
 * information the CTA had the chance to ask for once.
 *
 * ⚠ AND THE DIRECTION IS NOT COSMETIC. `goal_target_stated` — the signal that
 * unlocks Goal fit — is true only when a `kind: 'goal'` node carries
 * `goal_threshold_raw` (CEE `admission/analysis-admission.ts::goalTargetStated`).
 * The only chat-path writer of that field stamps it under
 * `targetNode.kind === 'goal' && operator === '>='`
 * (CEE `tools/handlers/add-constraint.ts`, `isSuccessTargetTurn`), and the
 * handler says in its own comment that `at_most` goal constraints deliberately
 * do NOT stamp a threshold. So a draft that does not steer towards an
 * "at least" target is steering towards a form the model cannot hold.
 *
 * ⚠ WHY NOT THE STRUCTURED MODAL. `CANONICAL_EDIT_AUTHORITY.goalSuccessTarget`
 * is `'disabled'` in a `const satisfies` object, so `hasServerGraphAuthority`
 * is a compile-time `false` and the Define-success modal is statically closed
 * on this surface. This spec pins the FALL-THROUGH arm — the one a user
 * actually reaches — not the modal.
 *
 * ⚠ THE CANVAS COACHING PANEL'S OWN Define-success ROW IS PINNED ELSEWHERE, BY
 * STRUCTURE, NOT BY CHOICE: `focus-now/__tests__/inertness.spec.ts` fails any
 * file outside that module which imports it, so its assertion lives beside it at
 * `canvas/components/coaching-panel/focus-now/__tests__/defineSuccessPrefillIsApplyable.spec.ts`.
 *
 * BOUND BY IDENTITY, NEVER BY A VALUE PREDICATE. Every assertion reads the
 * success-measure recommendation by `SUCCESS_MEASURE_RECOMMENDATION_ID` out of
 * the strengthen store and compares the drawer draft against THAT record's own
 * `action.prompt`, so a different card satisfying the same words cannot pass
 * this spec on the wrong object.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { StrengthenContainer } from '../StrengthenContainer'
import { SUCCESS_MEASURE_RECOMMENDATION_ID } from '../buildRecommendations'
import { STRENGTHEN_COPY } from '../strengthenCopy'
import { useCanvasStore } from '../../../../canvas/store'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import { useStrengthenStore, recordKey } from '../../../../canvas/stores/strengthenStore'
import { useAskOlumiStore } from '../../coaching/askOlumiStore'
import { useSuccessMeasureStore, useDecisionRecordStore } from '../../modals'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const SPEC_DECISION = 'define-success-cta-spec'

const noTargetData = (): ResultsSectionDataReturn =>
  ({
    recommendation: { goalThreshold: null, analysisStatus: 'computed' },
    confidence: { challengeFragileEdges: [], robustnessStatus: null, robustnessLevel: null },
    drivers: { drivers: [] },
  }) as unknown as ResultsSectionDataReturn

/** The success-measure record, read by ID — never by title or copy. */
const successMeasureRec = () =>
  useStrengthenStore.getState().records[
    recordKey(SPEC_DECISION, SUCCESS_MEASURE_RECOMMENDATION_ID)
  ]?.snapshot

beforeEach(() => {
  useStrengthenStore.getState()._reset()
  try { sessionStorage.clear() } catch { /* jsdom */ }
  useDecisionRecordStore.getState()._reset()
  useGuidanceStore.setState({ guidanceItems: [], _dispatchAction: null, _sendMessage: null } as never)
  useAskOlumiStore.setState({ isOpen: false, context: '', draft: '', label: '', targetId: null })
  useSuccessMeasureStore.setState({ isOpen: false })
  useCanvasStore.setState({
    currentScenarioId: SPEC_DECISION,
    currentStage: null,
    draftCoaching: null,
    results: { ...useCanvasStore.getState().results, hash: 'h-define-success' },
  } as never)
})

describe('Define success CTA — the hand-off is actionable, not a vague work-through', () => {
  it('the success-measure recommendation carries an APPLY-ABLE prompt naming the "at least" form', () => {
    render(<StrengthenContainer data={noTargetData()} />)
    const rec = successMeasureRec()
    // Precondition pinned IN-TEST: this spec is about THIS card, and it must be
    // present for the rest of the assertions to mean anything.
    expect(rec).toBeDefined()
    expect(rec!.id).toBe(SUCCESS_MEASURE_RECOMMENDATION_ID)

    const prompt = rec!.action.prompt ?? ''
    // The instruction the CEE `add_constraint` path needs in ONE turn: an
    // explicit apply, and the only threshold direction that stamps
    // `goal_threshold_raw`.
    expect(prompt.toLowerCase()).toContain('at least')
    expect(prompt.toLowerCase()).toContain('apply')
    // And it must not be the vague hand-off that cost four turns on staging.
    expect(prompt.toLowerCase()).not.toContain('work through')
  })

  it('clicking Define success prefills the drawer with THAT recommendation\'s own prompt, not the generic work-through draft', () => {
    const dispatch = vi.fn()
    useGuidanceStore.setState({ _dispatchAction: dispatch } as never)
    render(<StrengthenContainer data={noTargetData()} />)

    const rec = successMeasureRec()
    expect(rec).toBeDefined()
    const expectedDraft = rec!.action.prompt
    // Precondition: the prompt exists, so the identity comparison below is a
    // real discrimination and not a pair of undefineds agreeing.
    expect(typeof expectedDraft).toBe('string')
    expect((expectedDraft as string).length).toBeGreaterThan(0)
    // Precondition: the two candidate drafts genuinely DIFFER on this payload,
    // so passing cannot be an accident of them being the same string.
    expect(expectedDraft).not.toBe(STRENGTHEN_COPY.workThroughDraft(rec!.title))

    fireEvent.click(screen.getByRole('button', { name: 'Define success' }))

    const drawer = useAskOlumiStore.getState()
    expect(drawer.isOpen).toBe(true)
    expect(drawer.draft).toBe(expectedDraft)
    expect(drawer.draft).not.toBe(STRENGTHEN_COPY.workThroughDraft(rec!.title))
    // Unchanged contract: no auto-send, and the local-only modal stays shut.
    expect(dispatch).not.toHaveBeenCalled()
    expect(useSuccessMeasureStore.getState().isOpen).toBe(false)
  })
})
