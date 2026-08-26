import type { RecognisedAnalysisReadyStatus } from '../../adapters/cee/types'

/**
 * ⭐ DID THE ANALYSIS ASSESS THESE OPTIONS? — the question that decides whether
 * an option's EMPTY `interventions` is a FINDING or an ABSENCE.
 *
 * ── THE SEMANTIC COLLAPSE THIS EXISTS TO NAME APART ────────────────────────
 * `interventions: {}` on an option now means one of two opposite things, and
 * nothing in the shape distinguishes them:
 *
 *   ASSESSED     CEE projected this option's interventions and there are none.
 *                "This option changes nothing" is a real finding about the
 *                user's model, and the canvas should say so.
 *   NOT ASSESSED CEE refused before projecting. The empty object is the
 *                absence of an answer, not an answer. Rendering it as
 *                incompleteness states a fact about the model that nobody
 *                established.
 *
 * ── WHY IT BECAME REACHABLE (measured, deployed) ───────────────────────────
 * `applyV5State.ts`'s `normaliseV5AnalysisReady` rejects a payload whose
 * `goal_node_id` is empty or whose `options` array is empty — and a blocked
 * refusal used to be exactly that shape (witnessed: `{ options: [],
 * goal_node_id: "", status: "blocked", blocked_reason: "MISSING_OPTION_VALUE" }`).
 * So the guard was, in effect, the status check: nothing downstream ever saw a
 * blocked payload.
 *
 * CEE now carries model identity on refusals — correctly, since a refusal that
 * cannot name the model is one a user cannot act on. The refusal composer
 * returns `{ ...refusal, goal_node_id, options }` with `options` passed through
 * from the readiness projection, each unvalued option carrying
 * `interventions: {}`. The guard therefore ADMITS, and consumers behind it
 * inherit a payload whose status they never had to consider.
 *
 * ⚠ THE DURABLE LESSON, AND IT IS WHY THIS FILE IS NAMED FOR THE QUESTION
 * RATHER THAN THE FIX: **a guard that rejects degenerate payloads becomes an
 * implicit status check, and loosening it removes a check nobody knew they were
 * relying on.** The producer's own comment reasoned about the guard's ACCEPT
 * PREDICATE and never asked what the consumers behind it relied upon. Gating on
 * `status` alone would fix today's caller and leave the next one to walk into
 * the same collapse; naming the question gives them something to read.
 *
 * ── THE MAP IS A DRIFT GUARD, NOT A CONVENIENCE ────────────────────────────
 * Typed `Record<RecognisedAnalysisReadyStatus, …>` deliberately: adding a
 * status to the union without deciding whether it licenses an assessment claim
 * is a TYPECHECK FAILURE, and removing one orphans a key — also a failure. The
 * same mechanism `STATUS_DISPOSITION` uses, for a DIFFERENT question (that one
 * asks what the RUN GATE does; this asks whether an assessment happened). Two
 * questions, two maps, deliberately not shared.
 */
type OptionAssessment = 'assessed' | 'not_assessed'

const OPTION_ASSESSMENT: Record<RecognisedAnalysisReadyStatus, OptionAssessment> = {
  // CEE projected the options; an empty `interventions` is its answer.
  ready: 'assessed',
  needs_user_mapping: 'assessed',
  needs_encoding: 'assessed',
  needs_user_input: 'assessed',
  // CEE REFUSED. `options` is an identity passthrough, not a projection.
  blocked: 'not_assessed',
  // No status supplied. Kept 'assessed' because that is the behaviour every
  // payload had before refusals carried identity — narrowing it here would
  // silence the true case on every pre-existing shape, which is the
  // opposite-direction harm this change must not cause.
  unknown: 'assessed',
}

/**
 * True when the analysis actually projected these options, so an empty
 * `interventions` is a finding the surface may render.
 *
 * Fail-safe on an unrecognised status: treated as assessed, matching the
 * pre-existing behaviour rather than silently withdrawing a true claim.
 */
export function optionsWereAssessed(status: string | undefined | null): boolean {
  if (typeof status !== 'string' || status.length === 0) return true
  const known = (OPTION_ASSESSMENT as Record<string, OptionAssessment | undefined>)[status]
  return known === undefined ? true : known === 'assessed'
}
