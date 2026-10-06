/**
 * ⭐ D3 MILESTONE 1, STEP 2 — THE GOAL CHANCE'S OWN LICENCE, AS CEE DECIDED IT (DL 0df0e1 #87 6006078553; Science d5
 * 6005279728 / 6005640764; Wording c6 6005196947 + 6 Oct rulings).
 *
 * ⛔ THE UI RENDERS IT; IT DOES NOT DECIDE IT (`theUiRendersItDoesNotDecide`). CEE decides which of c6's sentences a Run
 * licenses — on the displayed whole percentages, with Science's 10-point superlative rule — and stores it with the Run as
 * ONE `info` entry in `inference_warnings`, code `GOAL_CHANCE_LICENSED` (CEE `goal-chance-licence.ts`). This module only
 * READS that record by its code and checks its shape: no threshold, no comparison, no ranking happens here. A malformed or
 * absent record is `null`, and every surface then says exactly what it said before.
 *
 * `form` selects the words (by identity); `option_ids` is the model's option order; `pct_by_option` is the figure each
 * sentence quotes; `target` is the target as the user stated it. ORDER COUNTS AS A SUPERLATIVE (d5): only the two
 * `highest` forms license ordering options by goal chance.
 *
 * PER OPTION (Science d5 #87 6007421281): `withheld_option_ids` names the options whose chance was withheld for their own
 * path. Each is in `option_ids` and has no figure; with any of them the form is `each` (CEE decides; a record that says
 * otherwise disagrees with itself and is not read).
 */

import { formatGoalTarget } from './formatGoalTarget'

export const GOAL_CHANCE_LICENSED = 'GOAL_CHANCE_LICENSED'

export type GoalChanceForm = 'highest' | 'highest_all_likely_to_miss' | 'all_likely_to_miss' | 'similar' | 'each'
export type GoalChanceComparator = 'at_least' | 'above' | 'at_most' | 'below'

export interface GoalChanceLicence {
  readonly form: GoalChanceForm
  readonly optionIds: readonly string[]
  readonly pctByOption: Readonly<Record<string, number>>
  /** Options whose chance was withheld for their own path (subset of `optionIds`, no figure); empty when none. */
  readonly withheldOptionIds: readonly string[]
  /** `similar` (H2) only: the options within 10 points of the top, in the model's order (≥ 2); else empty. */
  readonly similarOptionIds: readonly string[]
  readonly leaderOptionId: string | null
  readonly nextOptionId: string | null
  readonly target: { readonly comparator: GoalChanceComparator; readonly value: number; readonly unit: string }
  /**
   * ⭐ D3 cut 5 (DL 0df0e1; Science d5 #87 6008252938): CEE's `user_link_existence` — the chances also count Olumi's
   * own existence prior on links the USER stated. `oneIn` is N ("a 1-in-N chance each") when every such link shares one
   * value, else null (Olumi's estimate for each). `null` when CEE wrote none.
   */
  readonly userLinkExistence: { readonly links: number; readonly oneIn: number | null } | null
  /**
   * ⭐ D3 cut 6 INTERIM (Science d5 #87 6009272273 + 6009276913; DL adopted): CEE withheld the summary `form` would have been,
   * because a compared option's goal path carries Olumi's own existence assumption. The record's form is then `each`; the
   * hero says c6's sentence for THIS form. `null` when CEE wrote none (or a malformed one: the `each` lines still stand).
   */
  readonly summaryWithheld?: { readonly cause: 'olumi_existence_assumption'; readonly form: Exclude<GoalChanceForm, 'each'> } | null
}

const FORMS: ReadonlySet<string> = new Set(['highest', 'highest_all_likely_to_miss', 'all_likely_to_miss', 'similar', 'each'])
const COMPARATORS: ReadonlySet<string> = new Set(['at_least', 'above', 'at_most', 'below'])
const isRec = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)

/** The two forms that name a highest chance — and so the only ones that license an order by goal chance. */
export function goalChanceLicensesOrder(licence: GoalChanceLicence | null): boolean {
  return licence !== null && (licence.form === 'highest' || licence.form === 'highest_all_likely_to_miss')
}

/** The Run's goal-chance licence, read verbatim off its `inference_warnings`; `null` when absent or malformed. */
export function readGoalChanceLicence(inferenceWarnings: unknown): GoalChanceLicence | null {
  if (!Array.isArray(inferenceWarnings)) return null
  const records = inferenceWarnings.filter((w) => isRec(w) && w.code === GOAL_CHANCE_LICENSED)
  if (records.length !== 1) return null
  const r = records[0] as Record<string, unknown>
  const ids = r.option_ids
  const pct = r.pct_by_option
  const target = r.target
  if (typeof r.form !== 'string' || !FORMS.has(r.form)) return null
  if (!Array.isArray(ids) || ids.length < 2 || !ids.every((id) => typeof id === 'string')) return null
  const withheldRaw = r.withheld_option_ids ?? []
  if (!Array.isArray(withheldRaw) || !withheldRaw.every((id) => typeof id === 'string' && (ids as string[]).includes(id))) return null
  const withheld = new Set(withheldRaw as string[])
  // Every option is EITHER quoted (a whole percentage in 0–100) OR withheld with NO figure — never both, never neither — and
  // at least one is quoted (Codex r1 #2545: a withheld id carrying a figure, or "about 162%", is a record at odds with itself).
  const quoted = (id: string): boolean => isRec(pct) && typeof pct[id] === 'number' && Number.isInteger(pct[id])
    && (pct[id] as number) >= 0 && (pct[id] as number) <= 100
  if (!isRec(pct) || !(ids as string[]).every((id) => (withheld.has(id) ? !(id in pct) : quoted(id))) || withheld.size === ids.length) return null
  if (Object.keys(pct).some((id) => !(ids as string[]).includes(id))) return null
  if (!isRec(target) || typeof target.comparator !== 'string' || !COMPARATORS.has(target.comparator)
    || typeof target.value !== 'number' || !Number.isFinite(target.value) || typeof target.unit !== 'string') return null
  const named = (v: unknown): string | null => (typeof v === 'string' && (ids as string[]).includes(v) ? v : null)
  const leaderOptionId = named(r.leader_option_id)
  const nextOptionId = named(r.next_option_id)
  const form = r.form as GoalChanceForm
  // A `highest` form names its two DIFFERENT options; any other form names none, not even one it cannot resolve. A record
  // that disagrees with itself is not read (Codex r1 #2545).
  if (form === 'highest' || form === 'highest_all_likely_to_miss') {
    if (leaderOptionId === null || nextOptionId === null || leaderOptionId === nextOptionId) return null
  } else if (r.leader_option_id !== undefined || r.next_option_id !== undefined) return null
  if (withheld.size > 0 && form !== 'each') return null
  // H2 names ≥ 2 DISTINCT quoted options (CEE's model order); no other form names any.
  const sameRaw = r.similar_option_ids ?? []
  if (!Array.isArray(sameRaw) || !sameRaw.every((id) => typeof id === 'string' && (ids as string[]).includes(id) && !withheld.has(id))) return null
  if (new Set(sameRaw).size !== sameRaw.length) return null
  if (form === 'similar' ? sameRaw.length < 2 : sameRaw.length > 0) return null
  // A withheld summary leaves only the `each` lines; a record that says both is at odds with itself.
  if (r.summary_withheld !== undefined && form !== 'each') return null
  return {
    form,
    optionIds: ids as string[],
    pctByOption: pct as Record<string, number>,
    withheldOptionIds: (ids as string[]).filter((id) => withheld.has(id)),
    similarOptionIds: sameRaw as string[],
    leaderOptionId,
    nextOptionId,
    target: { comparator: target.comparator as GoalChanceComparator, value: target.value, unit: target.unit },
    userLinkExistence: existenceOf(r.user_link_existence),
    summaryWithheld: summaryWithheldOf(r.summary_withheld),
  }
}

/** CEE's `summary_withheld`, shape-checked; a malformed one is not read (no sentence; the `each` lines still stand). */
function summaryWithheldOf(v: unknown): NonNullable<GoalChanceLicence['summaryWithheld']> | null {
  if (!isRec(v) || v.cause !== 'olumi_existence_assumption' || typeof v.form !== 'string' || v.form === 'each' || !FORMS.has(v.form)) return null
  return { cause: 'olumi_existence_assumption', form: v.form as Exclude<GoalChanceForm, 'each'> }
}

/** CEE's `user_link_existence`, shape-checked; a malformed one is not read (no line, never a guessed fraction). */
function existenceOf(v: unknown): GoalChanceLicence['userLinkExistence'] {
  if (!isRec(v) || typeof v.links !== 'number' || !Number.isInteger(v.links) || v.links < 1) return null
  if (v.one_in === undefined) return { links: v.links, oneIn: null }
  return typeof v.one_in === 'number' && Number.isInteger(v.one_in) && v.one_in >= 2 ? { links: v.links, oneIn: v.one_in } : null
}

/**
 * ⭐ D3 cut 5 (Codex r1 #2551 finding 4): whether the hero's goal-chance arm may speak — a user target, and the goal figures
 * are not each a joint with limits (`buildHeroModel`'s own gate, held here once so the existence line has ONE home: under
 * the hero's chance lines when this is true, under the WinGauge goal rows otherwise — never both, never neither).
 */
export function goalChanceHeroArmOpen(
  goalThreshold: number | null | undefined,
  options: ReadonlyArray<{ goalProbability?: number | null; constraintAnalysis?: { constraints?: readonly unknown[] } | null }>,
): boolean {
  const bearing = options.filter((o) => o.goalProbability != null)
  const hasConstraints = bearing.length > 0 && bearing.every((o) => (o.constraintAnalysis?.constraints?.length ?? 0) > 0)
  return goalThreshold != null && !hasConstraints
}

/**
 * ⭐ Codex r2 #2551: whether the hero WILL say the goal-chance sentence (and so the existence line under it): its arm is
 * open, there are at least two options, every option the licence names is one of them (a Run retained after an option was
 * deleted names one that is gone), and the target can be said. The hero gates its arm on this, and ResultsBody hands the
 * line to the WinGauge exactly when this is false — so the line is said once, never nowhere.
 */
export function goalChanceHeroSays(
  goalThreshold: number | null | undefined,
  options: ReadonlyArray<{ id: string; goalProbability?: number | null; constraintAnalysis?: { constraints?: readonly unknown[] } | null }>,
  licence: GoalChanceLicence | null,
): boolean {
  if (licence === null || options.length < 2 || !goalChanceHeroArmOpen(goalThreshold, options)) return false
  if (!licence.optionIds.every((id) => options.some((o) => o.id === id))) return false
  return formatGoalTarget(licence.target.value, licence.target.unit, 'level') !== null
}

/**
 * c6/d5's words (cut 5), said ONCE beside the chance lines: the chances also count Olumi's existence prior on the user's
 * own links. CEE's fraction (`oneIn`), never computed; mixed values say it is Olumi's estimate for each. `null` otherwise.
 */
const SUMMARY_WITHHELD_WORDS: Readonly<Record<Exclude<GoalChanceForm, 'each'>, string>> = {
  highest: 'Olumi isn’t naming the option with the highest chance, because that could depend on its own assumption that some links might not hold.',
  highest_all_likely_to_miss: 'Olumi isn’t saying whether every option is more likely to miss your goal than meet it, or naming the option with the highest chance, because both could depend on its own assumption that some links might not hold.',
  all_likely_to_miss: 'Olumi isn’t saying whether every option is more likely to miss your goal than meet it, because that could depend on its own assumption that some links might not hold.',
  similar: 'Olumi isn’t saying whether the options have similar chances of meeting your goal, because that could depend on its own assumption that some links might not hold.',
}

/** c6's words (cut 6 interim), chosen by the withheld FORM (never "highest" for a withheld `similar`). `null` otherwise. */
export function goalChanceSummaryWithheldLine(licence: GoalChanceLicence | null): string | null {
  const w = licence?.summaryWithheld ?? null
  return w === null ? null : SUMMARY_WITHHELD_WORDS[w.form]
}

/**
 * Everything said once beside the chance lines, in order: why no summary is stated (cut 6), then the existence line
 * (cut 5). ONE home: the hero when it speaks, else the WinGauge goal rows. `null` when there is nothing to say.
 */
export function goalChanceDisclosureLines(licence: GoalChanceLicence | null): string | null {
  const lines = [goalChanceSummaryWithheldLine(licence), goalChanceExistenceLine(licence)].filter((l): l is string => l !== null)
  return lines.length > 0 ? lines.join(' ') : null
}

export function goalChanceExistenceLine(licence: GoalChanceLicence | null): string | null {
  const e = licence?.userLinkExistence ?? null
  if (e === null) return null
  const which = e.oneIn !== null ? `a 1-in-${e.oneIn} chance each` : 'Olumi’s estimate for each'
  return `These chances also count Olumi’s own assumption that each of your links might not hold (${which}).`
}
