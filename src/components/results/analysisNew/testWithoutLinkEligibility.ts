/**
 * May "Test without this link" be OFFERED on this link, on this Run? (SCI-DEEP, beat 4.)
 *
 * The SERVICE decides whether a result can be shown; this only stops the UI offering a press the service is
 * certain to refuse, and says why in plain words instead. Every input is a PRODUCER field the UI already
 * stores. Nothing here is computed science. The predicate is the Science owner's (4 Oct, read at CEE 24e9b102):
 *
 *   RUN   · admission `permitted_analysis_mode` ∈ {quantified_provisional, comparative_leader}
 *           (structural-challenge-dispatch.ts:146-149: below that the result is withheld);
 *         · `leader_claim.withheld_reason` ≠ 'goal_scope_unresolved' (first-analysis.ts:254-255 sets
 *           `total_goal_claims_allowed: false`, refused at dispatch.ts:148);
 *         · `run_state.kind` = 'complete_current' and `requires_rerun` ≠ true (dispatch.ts:140-143: stale);
 *         · an analysis result is present (dispatch.ts:144: probe_unavailable).
 *   LINK  · neither end is an option or decision (`option_wiring_link`);
 *         · not a bidirected link (`bidirected_link`).
 *
 * ⛔ STRICT ON ABSENCE for the analysis state and the result: "I could not tell" never reads as eligible.
 *
 * ⚠ ONE MEASURED EXCEPTION: an ABSENT admission does not hold. Since 5 Oct (Canvas, `bootReadAdmission.ts`) a
 * cold load KEEPS the graph read's MODE: the read carries a projection of the admission, and its
 * `permitted_analysis_mode` is the input here (after a turn's own admission) while the canvas is still that read.
 * So a cold-loaded Run below quantified_provisional now HOLDS with the plain sentence instead of offering a press
 * the service refuses. Absence still means NOT LOADED, not refused: a read with no admission for its own revision,
 * a canvas not proven equal to the read, or a canvas edited since. Holding there would print "this analysis cannot
 * measure that yet" on a Run the service would answer, so the press is offered and the service refuses with its own
 * plain sentence and no model call if it must (CEE #2560, d7217130). A PRESENT mode below quantified_provisional
 * holds. ⛔ Do not make absence strict: the cases above still reach here without a mode (DL 0df0e1 ruling, 4 Oct).
 *
 * ⚠ NOT MIRRORED HERE, ON PURPOSE: identity links (`identity_participant_link`, `anchored_identity_target`).
 * Canvas nodes do not carry `nonlinear_identity` (serverGraphHydration.ts drops it), so the UI cannot see the
 * fact. The service refuses those presses with its own plain sentence and no model call. `target_becomes_root`
 * is allowed (the service decides it). The leader licence is NOT an input: a withheld leader still gets the
 * press, because the test is a structural check that needs no licensed leader (Science, 4 Oct).
 */

import type { PermittedAnalysisMode } from '../../../adapters/cee/types'

export type TestWithoutLinkHold =
  | 'not_quantified'
  | 'goal_scope_unresolved'
  | 'not_current'
  | 'no_result'
  | 'option_wiring'
  | 'bidirected'

export type TestWithoutLinkEligibility =
  | { readonly eligible: true }
  | { readonly eligible: false; readonly hold: TestWithoutLinkHold }

export interface TestWithoutLinkEligibilityInput {
  /** `analysis_admission.permitted_analysis_mode` of the effective admission (live, else retained). */
  readonly permittedAnalysisMode: string | null | undefined
  /** The stored canonical `analysis_state` (`AnalysisStateV1`), read structurally. */
  readonly analysisState: unknown
  /** Whether the Run's analysis result is on hand. */
  readonly hasResult: boolean
  /** Canvas node types of the link's two ends (undefined when the node is not on the canvas). */
  readonly sourceType: string | undefined
  readonly targetType: string | undefined
  /** The link's V3 `edge_type`, when the producer sent one. */
  readonly edgeType: string | undefined
}

/** Typed by the ONE list of modes (`PERMITTED_ANALYSIS_MODES`): a literal that is not a mode does not compile. */
export const QUANTIFIED_MODES: ReadonlySet<string> = new Set<PermittedAnalysisMode>(['quantified_provisional', 'comparative_leader'])
const WIRING_TYPES: ReadonlySet<string> = new Set(['option', 'decision'])

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec | undefined => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : undefined)

export function testWithoutLinkEligibility(input: TestWithoutLinkEligibilityInput): TestWithoutLinkEligibility {
  // Link-level holds first: they are true of the link whatever the Run, so they are the more useful sentence.
  if (WIRING_TYPES.has(input.sourceType ?? '') || WIRING_TYPES.has(input.targetType ?? '')) {
    return { eligible: false, hold: 'option_wiring' }
  }
  if (input.edgeType === 'bidirected') return { eligible: false, hold: 'bidirected' }

  const state = rec(input.analysisState)
  const runState = rec(state?.run_state)
  if (runState?.kind !== 'complete_current' || state?.requires_rerun === true) return { eligible: false, hold: 'not_current' }
  if (!input.hasResult) return { eligible: false, hold: 'no_result' }
  const mode = input.permittedAnalysisMode
  if (mode != null && !QUANTIFIED_MODES.has(mode)) return { eligible: false, hold: 'not_quantified' }
  if (rec(state?.leader_claim)?.withheld_reason === 'goal_scope_unresolved') {
    return { eligible: false, hold: 'goal_scope_unresolved' }
  }
  return { eligible: true }
}

/** One plain sentence per hold: what is true, and the next step where there is one. No figures, no jargon. */
export const TEST_WITHOUT_LINK_HOLD_COPY: Readonly<Record<TestWithoutLinkHold, string>> = {
  not_quantified:
    'This test compares how your options reach your goal with and without this link, and this analysis cannot measure that yet.',
  goal_scope_unresolved:
    'Your goal is not settled enough to measure yet, so there is nothing to compare without this link.',
  not_current: 'Run the analysis again first. This test uses the latest analysis.',
  no_result: 'Run the analysis first, then try this test.',
  option_wiring:
    'This link is how an option sets a factor, not an assumption about how the world works, so removing it would change what the option means rather than test anything.',
  bidirected:
    'This link marks a shared cause the model does not measure, so removing it would change nothing.',
}
