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
  // Every option is EITHER quoted (a whole percentage) OR withheld — never both, never neither — and at least one is quoted.
  const quoted = (id: string): boolean => isRec(pct) && typeof pct[id] === 'number' && Number.isInteger(pct[id])
  if (!isRec(pct) || !(ids as string[]).every((id) => quoted(id) !== withheld.has(id)) || withheld.size === ids.length) return null
  if (!isRec(target) || typeof target.comparator !== 'string' || !COMPARATORS.has(target.comparator)
    || typeof target.value !== 'number' || !Number.isFinite(target.value) || typeof target.unit !== 'string') return null
  const named = (v: unknown): string | null => (typeof v === 'string' && (ids as string[]).includes(v) ? v : null)
  const leaderOptionId = named(r.leader_option_id)
  const nextOptionId = named(r.next_option_id)
  const form = r.form as GoalChanceForm
  // A `highest` form names its two options; any other form names none. A record that disagrees with itself is not read.
  if ((form === 'highest' || form === 'highest_all_likely_to_miss') !== (leaderOptionId !== null && nextOptionId !== null)) return null
  if (withheld.size > 0 && form !== 'each') return null
  // H2 names ≥ 2 quoted options (CEE's model order); no other form names any.
  const sameRaw = r.similar_option_ids ?? []
  if (!Array.isArray(sameRaw) || !sameRaw.every((id) => typeof id === 'string' && (ids as string[]).includes(id) && !withheld.has(id))) return null
  if ((form === 'similar') !== (sameRaw.length >= 2)) return null
  return {
    form,
    optionIds: ids as string[],
    pctByOption: pct as Record<string, number>,
    withheldOptionIds: (ids as string[]).filter((id) => withheld.has(id)),
    similarOptionIds: sameRaw as string[],
    leaderOptionId,
    nextOptionId,
    target: { comparator: target.comparator as GoalChanceComparator, value: target.value, unit: target.unit },
  }
}
