/**
 * THE NEXT INPUT THIS RUN TURNS ON — named, or nothing.
 *
 * ## The state this exists for, measured rather than supposed
 *
 * Two post-result captures on the served build (`0db2eb0a`, `52383f4b`,
 * 20 Sep 2026) both land in `permitted_analysis_mode: "quantified_provisional"`
 * with `material_parameters_user_stated: 0`. CEE states the remedy in its own
 * words — *"Figures can be shown as provisional, but no option can be called
 * the leader … until you have set at least one of them"* — and publishes
 * exactly which ones, in `semantic_signals.material_parameters_awaiting_user_node_ids`
 * (9 ids and 7 ids respectively).
 *
 * The panel renders that set as an untruncatable roll-call. This turns it into
 * one named next input.
 *
 * ## THE CLAIM IS NECESSARY, NEVER SUFFICIENT — and the capture proves it
 *
 * ⛔ The tempting sentence is *"set this and I will name the leader."* It is
 * FALSE. `52383f4b` carries `confidence_parameters_user_stated: 1` — the user
 * had already set Monthly Churn Rate to 3.8% — and the refusal persisted with
 * code `USER_STATED_PARAMETERS_NOT_MATERIAL`. At least three further gates sit
 * behind this one: the value must be MATERIAL, the run must separate the arms,
 * and the constraint verdict can still withhold (`0db2eb0a` does exactly that,
 * with separation established and robustness `high`).
 *
 * So the caller states what is true — this is the input the comparison turns on
 * most, and the estimate behind it is not the reader's — and promises nothing
 * about what the next run will conclude.
 *
 * ## ⛔ IT NEVER MINTS A RANK, AND THAT IS THE WHOLE OF THE SELECTION RULE
 *
 * PLoT owns the driver order and says so in its own source: *"ISL measures ·
 * PLoT orders + attests · CEE permits + projects · UI renders WITHOUT
 * reordering"* (`plot-lite-service/src/lib/driver-order.ts`), because
 * `influence_score`, `sensitivity_score` and `elasticity` are incommensurable
 * and sorting by magnitude ranks unlike quantities against each other.
 *
 * This module therefore reads the ordinal the surface ALREADY publishes:
 * `determinedRankDepth` over the same policy-resolved display values the
 * Drivers panel and the canvas factor cards rank from. That function withholds
 * the whole set unless the ordinal is clear of its runner-up
 * (`INFLUENCE_TIE_EPSILON`), which is precisely the fail-closed behaviour this
 * needs: where the analysis cannot separate two factors, naming one would be
 * the arbitrary row dressed as the answer.
 *
 * ⚠ ONE RANK AUTHORITY, NOT TWO. The wire also carries a producer
 * `influence_rank`, and reading it here would be a SECOND answer to one
 * question — this estate's dominant defect class. The two agree on both
 * captures (rank 1 = `c4f243aa` Pitch Quality, `c2413bb5` New Customer
 * Conversion Rate), and `nextInputToSet.spec.ts` asserts that agreement against
 * the real captures so a future divergence REDs rather than silently forking.
 *
 * ## ⛔ AND THE ORDINAL MOVED — this module followed it on 26 Sep 2026
 *
 * The paragraph above says this reads "the ordinal the surface ALREADY
 * publishes … the canvas factor cards rank from". When it was written the card
 * ranked by the displayed influence. It no longer does: `rankFactor.ts` ranks
 * by |elasticity| ("Ranked by how strongly the comparison responds to each
 * factor"), which is exactly "the input the comparison turns on". This module
 * kept the structural read and so became the second answer it warns against.
 *
 * WITNESSED ON SERVED 853feeb7 (pricing starter, one Run): the Strengthen card
 * read "Give Enterprise Revenue Cannibalization Risk a value of your own · Most
 * influential of 5 factors compared in this model" while the canvas card named
 * Top Account Revenue Concentration Driver 1 and the lever's own card read "Not
 * ranked in this run". Every option SETS that lever, so its value never enters
 * the comparison; its elasticity and sensitivity are 0. It topped only
 * `influence_score` (and PLoT's `influence_rank`, the same structural order).
 *
 * So the caller now hands in the card's Driver 1 (`driverLeader`,
 * `rankFactor.sensitivityLeader`) and this names THAT factor, or nothing: a
 * tie on the card's basis, no leader, or a Driver 1 that is not in CEE's
 * blocking set all return `null`. `undefined` (no driver feed; legacy callers)
 * keeps the influence read below, which the capture specs still pin.
 *
 * ## Fail closed at every step, because the cost is asymmetric
 *
 * A parameter WRONGLY NAMED sends the reader to set a number that cannot lift
 * the refusal — worse than the unnamed sentence, because it spends the trust
 * the refusal just earned. A parameter wrongly OMITTED costs only today's
 * wording. Every unreadable case returns `null` and the caller keeps the
 * existing copy.
 */

import { determinedRankDepth } from '../driverDisplayModel'
import type { SensitivityLeader } from '../../../canvas/nodes/shared/rankFactor'

/** One factor, as much of it as this selection needs. */
export interface NextInputCandidate {
  readonly factorId: string
  readonly label: string
  /**
   * The policy-resolved DISPLAY influence — the same value the panel's bars and
   * the canvas cards rank from, never the raw producer metric. Named as the
   * caller names it so a raw-metric read cannot hide behind the field.
   */
  readonly influence?: number
  /**
   * ⭐ Whether the node records no prior range, read off `ModelRow.declaresNoRange`
   * — itself read off the node's own `prior`, the only place a range lives.
   *
   * ⛔ LOAD-BEARING, AND NOT A STYLE POINT. Witnessed end to end on the served
   * build (10 Sep 2026, `ModelRowView.tsx`): on a factor that declares no prior
   * range the editor accepts a bare value, reports `Applied`, and the analysis
   * then refuses EVERY TIME — *"recorded as a bare amount with no range for me
   * to measure it against"*, and the value cannot be cleared
   * (`factor_value_edit.value` is required and finite at the contract). So an
   * instruction to set a value on such a factor can leave the model
   * unanalysable with no route back.
   *
   * ⚠⚠ AND THE SENTENCE THAT USED TO SIT HERE WAS FALSE — it read "no range
   * editor is reachable anywhere in the product", which the `#1801` guard
   * `prior-range-capability-claim.spec.ts` refuses BY NAME, and it refused this
   * file. The claim was false by NINE MINUTES when it was first written
   * (`#1454` landed 22:19:53 on 10 Sep; the claim 22:28:39) and it was copied
   * onward for eleven days.
   *
   * ⭐ THE TRUE, SURFACE-QUALIFIED STATEMENT, which is what the guard asks for:
   * a range editor exists on exactly ONE surface — the canvas inspector's
   * `FactorExternalPanel` (3 `setPriorRange` call sites) — and only for a
   * factor whose `category` is `'external'`. `FactorControllablePanel` has
   * zero, and all 19 non-test files of `model-tab-v2` have zero; its
   * `proposePriorRange` contract is declared once with zero implementations.
   * Measured on two real captures: 1 external of 7 categorised factors. So the
   * hazard above is real for the other six, and `strengthen/factorRangeCapability.ts`
   * owns that question for every caller that needs to ask it.
   */
  readonly declaresNoRange?: boolean
}

export interface NextInputToSet {
  readonly factorId: string
  readonly label: string
  /** The denominator for the ordinal, taken off the same array as the rank. */
  readonly setSize: number
  /** True when routing to the value editor would risk the bare-amount trap. */
  readonly declaresNoRange: boolean
}

/**
 * The one input to name, or `null` where nothing may be named.
 *
 * @param factors          every factor the run ranked, policy-resolved.
 * @param awaitingUserIds  CEE's blocking set, VERBATIM. Membership is the
 *                         producer's and is never re-derived or re-filtered here.
 * @param identityIsCurrent whether the admission, the run and the current graph
 *                         are one identity. ⚠ `invalidateAnalysisReady` clears
 *                         the admission on every analytical edit and the reader
 *                         falls back to a RETAINED one, so an unpinned join can
 *                         name a parameter from a graph that has since moved.
 * @param driverLeader     the canvas card's Driver 1 (`data.drivers.driverLeader`),
 *                         quoted. When supplied it IS the rank-1 factor; `null`
 *                         or an unclear lead names nothing. `undefined` keeps
 *                         the legacy influence read.
 */
export function selectNextInputToSet(
  factors: readonly NextInputCandidate[],
  awaitingUserIds: readonly string[] | undefined,
  identityIsCurrent: boolean,
  driverLeader?: SensitivityLeader | null,
): NextInputToSet | null {
  if (!identityIsCurrent) return null
  if (awaitingUserIds === undefined || awaitingUserIds.length === 0) return null
  if (factors.length === 0) return null

  // ⚠ ONE BAD MEMBER VOIDS THE SET rather than being skipped, matching
  // `materialParametersAwaitingUser.ts`: naming the members we happened to
  // understand would report a PARTIAL set as though it were the whole one.
  for (const id of awaitingUserIds) {
    if (typeof id !== 'string' || id.length === 0) return null
  }

  // The denominator comes off THIS array, so it can never be derived from a
  // different set than the rank beside it.
  const entries = factors.map((f) => ({
    id: f.factorId,
    value: typeof f.influence === 'number' && Number.isFinite(f.influence) ? f.influence : 0,
  }))
  const setSize = new Set(entries.map((e) => e.id)).size
  // `influenceRankReadout` refuses a set smaller than two, so a rank with no
  // runner-up is not a publishable ordinal. Refuse it here too rather than
  // compose a sentence the copy owner would decline.
  if (setSize < 2) return null

  // ⭐ THE CARD'S DRIVER 1, WHEN THE CALLER HAS ONE — the only rank this
  // module may publish. The card withholds its rank on a tie
  // (`leadIsClear: false`) and ranks nothing on a feed with no magnitude
  // (`null`); both are "name nothing" here too. The id join is by identity:
  // the card's key must BE one of these factors, never a label match.
  let best: { id: string } | undefined
  if (driverLeader !== undefined) {
    if (driverLeader === null || !driverLeader.leadIsClear) return null
    best = entries.find((e) => e.id === driverLeader.key)
  } else {
    // ⭐ THE ORDINAL IS ONLY AS DEEP AS IT IS DETERMINED. `determinedRankDepth`
    // returns 0 when the top factor is not clear of its runner-up, and 0 is the
    // honest answer: where the analysis cannot separate two factors, this
    // declines to separate them.
    if (determinedRankDepth(entries, 1) !== 1) return null
    best = [...entries].sort((a, b) => b.value - a.value)[0]
  }
  if (best === undefined) return null

  // ⛔ THE RANK-1 FACTOR MUST ITSELF BE IN THE BLOCKING SET. Falling through to
  // "the highest-ranked member that happens to be blocking" would name a factor
  // whose ordinal the surface never published, which is the arbitrary-row
  // defect one step along.
  if (!awaitingUserIds.includes(best.id)) return null

  const chosen = factors.find((f) => f.factorId === best.id)
  const label = chosen?.label?.trim()
  if (chosen === undefined || label === undefined || label.length === 0) return null

  return {
    factorId: chosen.factorId,
    label,
    setSize,
    declaresNoRange: chosen.declaresNoRange === true,
  }
}
