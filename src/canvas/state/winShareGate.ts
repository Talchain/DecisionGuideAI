/**
 * ⭐⭐ WIN SHARES FOLLOW THE LEADER CLAIM (CURRENT-READ-v1 row 9 @ ebaed3b4; AIQ #75 5912710392,
 * #77 5912643736 (b); P0 PARTNER 5912723630). Paul's test 4276f3f9, finding 9: the Run withheld the
 * leader (`leader_claim.permitted: false`) and every reply said it could not put an option forward, yet
 * the option cards read "Model 80% · Goal only" / 13% / 7%. A per-option share that singles one option
 * out names the leader in numbers, whatever the reason the leader was withheld.
 *
 * THE RULE, ONE PLACE: when the producer's leader permission is `permitted === false` (for ANY
 * `withheld_reason`), no surface shows a per-option win share or a leader word. Each shows the reason
 * line instead. The goal chance is governed separately, by its own goal-figure withhold.
 *
 * Reads the persisted stamp on the result (`results.report.producer_leader_permission`), the same one the
 * cards' "Goal only" / "Provisional" qualifiers read, so a reload cannot drop the withhold.
 *
 * ⚠ Until the typed `maturity: exploratory | target_testable` field serves, `permitted === false` IS the
 * gate (AIQ 5912710392: "gate on `leader_claim.permitted === false` for ANY `withheld_reason`"). When
 * it serves, only `winShareWithheldReason` gains the typed branch; every surface keeps calling this module.
 */
import { leaderWithholdCause } from '../../components/results/analysisNew/analysisNewCopy'

export interface ProducerLeaderPermission {
  permitted?: boolean
  producer_cause?: string | null
}

/**
 * AIQ 5914838427, verbatim (correcting 5912710392): `constraint_verdict_withheld` fires on a LIMIT-only failure too, so
 * the line names both. The target-only line belongs to #2371's typed `TARGET_NOT_TESTABLE`, shown as its own message.
 */
export const EXPLORATORY_REASON_LINE =
  "An exploratory comparison: Olumi couldn't check your target or limits on this run, so it isn't naming an option."

/** Said when the producer withheld the leader and gave no reason this surface can state. */
export const WITHHELD_REASON_FALLBACK = "Olumi isn't naming an option on this run."

/**
 * The short marker an option card shows in its share slot instead of a share.
 * Paul, 1 Oct 2026: "It says 'not ranked' on the options. I don't think that's the right terminology."
 * - **When it shows:** results mode, the producer withheld the leader, and THIS option took part in the Run
 *   (`OptionNode`'s `notRankedRenders` excludes an option the Run left out, which reads "Not analysed" instead).
 * - **The truth:** the Run DID compare the option; Olumi only withholds its share (leader permission false).
 *   The marker says both halves, and the reason line beside it says why.
 * - ⛔ **Not "Not ranked"** (it read as a verdict on THIS option) and **not "Not compared yet"** (#2392's words):
 *   R3 F5, 1 Oct (#85 5930578606), saw it beside the Analysis panel's "Here is how your options compare … Comparing 3
 *   of 4 options" on a current Run, and a user reads it as "re-run needed". "Not compared" belongs only to an option
 *   no current Run included, which never reaches this marker.
 */
export const NOT_RANKED_MARKER = 'Compared · share not shown'

/** True when the producer withheld the leader for any reason. Absent or `true` ⇒ false. */
export function winSharesWithheld(permission: ProducerLeaderPermission | null | undefined): boolean {
  return permission?.permitted === false
}

/**
 * The reason line for a withheld leader, from the TYPED reason, never raw producer text:
 * `constraint_verdict_withheld` → the exploratory line; any other stated reason → its existing words
 * (`leaderWithholdCause`); none → the fallback.
 */
export function winShareWithheldReason(permission: ProducerLeaderPermission | null | undefined): string {
  const cause = typeof permission?.producer_cause === 'string' ? permission.producer_cause.trim() : ''
  if (cause === 'constraint_verdict_withheld') return EXPLORATORY_REASON_LINE
  return leaderWithholdCause(cause) ?? WITHHELD_REASON_FALLBACK
}

type WithReport = { results: { report?: unknown } | null | undefined }

/** `results: null` is a real store state (a reset, the Reasoning tab's harness): it reads as "not withheld". */
function permissionOf(s: WithReport): ProducerLeaderPermission | null {
  const report = s.results?.report as { producer_leader_permission?: ProducerLeaderPermission } | null | undefined
  return report?.producer_leader_permission ?? null
}

/** Store selector (a boolean, so the React-185 guard stays satisfied). */
export function selectWinSharesWithheld(s: WithReport): boolean {
  return winSharesWithheld(permissionOf(s))
}

/** Store selector for the reason line (a string or null, a primitive). */
export function selectWinShareWithheldReason(s: WithReport): string | null {
  const permission = permissionOf(s)
  return winSharesWithheld(permission) ? winShareWithheldReason(permission) : null
}
