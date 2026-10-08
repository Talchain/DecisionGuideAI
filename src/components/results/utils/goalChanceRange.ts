import { GOAL_FIGURES_USER_EFFECT_CLAMPED_CODE, GOAL_FIGURES_WITHHELD_CODES, GOAL_IDENTITY_NOT_EVALUATED_CODE, readGoalFigureWithholds } from './goalIdentityWithheld'
import { readGoalChanceTarget, type GoalChanceTarget } from './goalChanceTarget'

/**
 * CEE's GOAL_CHANCE_RANGE record, read by identity. The UI checks shape only:
 * it never derives bounds, chooses a link, or orders options by chance.
 */
export type GoalChanceRangeEntry = {
  readonly lowPct: number
  readonly highPct: number
  readonly from: string
  readonly to: string
  readonly among: 'all' | 'unsized_links'
} & ({
  readonly kind: 'link_strength' | 'link_existence'
  readonly lowRounding: 'whole' | 'nearest_5'
  readonly highRounding: 'whole' | 'nearest_5'
} | {
  readonly kind: 'stated_time'
  readonly basis: 'stated_time'
  readonly quantity: 'months_to_finish' | 'share_per_month'
  readonly low: number
  readonly high: number
  readonly statedEstimate: { readonly low: number; readonly high: number; readonly unit: string }
})

export interface GoalChanceRange {
  readonly optionIds: readonly string[]
  readonly rangeByOption: Readonly<Record<string, GoalChanceRangeEntry>>
  readonly target?: GoalChanceTarget
  readonly horizonLine: string | null
}

const isRec = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
const wholePct = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100
const rounding = (v: unknown): v is 'whole' | 'nearest_5' => v === 'whole' || v === 'nearest_5'

/** Read the optional deadline clause verbatim; malformed optional fields say nothing. */
export function readGoalChanceHorizonLine(record: Record<string, unknown>): string | null {
  return record.horizon_untested === true && nonEmpty(record.horizon_line) ? record.horizon_line : null
}

function readEntry(v: unknown, target: GoalChanceTarget | null): GoalChanceRangeEntry | null {
  if (!isRec(v) || !wholePct(v.low_pct) || !wholePct(v.high_pct)
    || !nonEmpty(v.from) || !nonEmpty(v.to)) return null
  if (v.kind === 'stated_time') {
    const estimate = v.stated_estimate
    const chance = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1
    const positive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0
    if (target?.by_date === undefined || !target.unit.startsWith('% of ') || !nonEmpty(target.unit.slice(5))
      || v.basis !== 'stated_time' || v.among !== 'all' || !chance(v.low) || !chance(v.high) || v.low > v.high
      || v.low_pct > v.high_pct || !isRec(estimate) || !positive(estimate.low) || !positive(estimate.high)
      || estimate.low > estimate.high) return null
    if (v.quantity !== 'months_to_finish' && v.quantity !== 'share_per_month') return null
    const unit = v.quantity === 'months_to_finish' ? 'months' : `${target.unit} per month`
    if (estimate.unit !== unit) return null
    return {
      kind: 'stated_time', basis: 'stated_time', quantity: v.quantity,
      low: v.low, high: v.high, lowPct: v.low_pct, highPct: v.high_pct,
      from: v.from, to: v.to, among: 'all',
      statedEstimate: { low: estimate.low, high: estimate.high, unit },
    }
  }
  if (v.low_pct >= v.high_pct || !rounding(v.low_rounding) || !rounding(v.high_rounding)
    || (v.kind !== 'link_strength' && v.kind !== 'link_existence')
    || (v.among !== 'all' && v.among !== 'unsized_links')) return null
  return {
    lowPct: v.low_pct, highPct: v.high_pct, lowRounding: v.low_rounding, highRounding: v.high_rounding,
    kind: v.kind, from: v.from, to: v.to, among: v.among,
  }
}

/**
 * ⛔ Science S3 (DL #87 7 Oct; the same rule as CEE PR-S2's `goalChanceRangeBarredForAgent`): a range exists BECAUSE its
 * option's point figure was withheld for an unsized path or share approximation. Every
 * other withhold bars it: PLoT's run-wide pair on every option; the rest when unscoped or scoped to that option. The
 * Run-wide "withheld" sentence is NOT the test: it also fires on the compatible withholds a range sits beside.
 */
const RANGE_COMPATIBLE_WITHHOLDS: ReadonlySet<string> = new Set(['GOAL_FIGURES_PLACEHOLDER_PATH', 'GOAL_FIGURES_TARGET_NOT_TESTABLE', 'GOAL_FIGURES_SHARE_APPROXIMATION'])
const RUN_WIDE_WITHHOLDS: ReadonlySet<string> = new Set([GOAL_IDENTITY_NOT_EVALUATED_CODE, GOAL_FIGURES_USER_EFFECT_CLAMPED_CODE])
const RANGE_BARRING_WITHHOLDS: ReadonlySet<string> = new Set(
  [...GOAL_FIGURES_WITHHELD_CODES, 'GOAL_FIGURES_PROBABILITY_UNUSABLE'].filter((c) => !RANGE_COMPATIBLE_WITHHOLDS.has(c)),
)
function rangeBarred(warnings: readonly unknown[], optionId: string): boolean {
  return warnings.some((w) => isRec(w) && typeof w.code === 'string' && RANGE_BARRING_WITHHOLDS.has(w.code)
    && (RUN_WIDE_WITHHOLDS.has(w.code) || !Array.isArray(w.option_ids) || w.option_ids.length === 0 || w.option_ids.includes(optionId)))
}

/** Exactly one record; invalid or barred option entries are dropped, without rejecting valid siblings. */
export function readGoalChanceRange(inferenceWarnings: unknown): GoalChanceRange | null {
  if (!Array.isArray(inferenceWarnings)) return null
  const records = inferenceWarnings.filter((w) => isRec(w) && w.code === 'GOAL_CHANCE_RANGE')
  if (records.length !== 1) return null
  const r = records[0] as Record<string, unknown>
  const ids = r.option_ids
  if (r.severity !== 'info' || !nonEmpty(r.message) || !Array.isArray(ids) || ids.length === 0
    || !ids.every(nonEmpty) || new Set(ids).size !== ids.length || !isRec(r.range_by_option)) return null
  const target = readGoalChanceTarget(r.target)
  // Reading-unconfirmed withholds include the shared reader's fail-closed synthesis when the producer omitted
  // its typed warning. A range is still a goal figure; the unconfirmed reading must not leave bare bounds visible.
  const readingWithholds = readGoalFigureWithholds({ inference_warnings: inferenceWarnings })
    .filter((w) => w.code === 'GOAL_FIGURES_READING_UNCONFIRMED')
  const rangeByOption: Record<string, GoalChanceRangeEntry> = Object.create(null)
  for (const id of ids) {
    if (!Object.prototype.hasOwnProperty.call(r.range_by_option, id)) continue
    const entry = readEntry(r.range_by_option[id], target)
    const readingBarred = readingWithholds.some((w) => w.optionIds === null || w.optionIds.includes(id))
    if (entry !== null && !rangeBarred(inferenceWarnings, id) && !readingBarred) rangeByOption[id] = entry
  }
  const optionIds = ids.filter((id) => Object.prototype.hasOwnProperty.call(rangeByOption, id))
  return optionIds.length === 0 ? null : { optionIds, rangeByOption, horizonLine: readGoalChanceHorizonLine(r), ...(target === null ? {} : { target }) }
}
