/**
 * CEE's GOAL_CHANCE_RANGE record, read by identity. The UI checks shape only:
 * it never derives bounds, chooses a link, or orders options by chance.
 */
export type GoalChanceRangeEntry = {
  readonly lowPct: number
  readonly highPct: number
  readonly lowRounding: 'whole' | 'nearest_5'
  readonly highRounding: 'whole' | 'nearest_5'
  readonly kind: 'link_strength' | 'link_existence'
  readonly from: string
  readonly to: string
  readonly among: 'all' | 'unsized_links'
}

export interface GoalChanceRange {
  readonly optionIds: readonly string[]
  readonly rangeByOption: Readonly<Record<string, GoalChanceRangeEntry>>
  readonly horizonLine: string | null
}

const isRec = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
const wholePct = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100
const rounding = (v: unknown): v is GoalChanceRangeEntry['lowRounding'] => v === 'whole' || v === 'nearest_5'

/** Read the optional deadline clause verbatim; malformed optional fields say nothing. */
export function readGoalChanceHorizonLine(record: Record<string, unknown>): string | null {
  return record.horizon_untested === true && nonEmpty(record.horizon_line) ? record.horizon_line : null
}

function readEntry(v: unknown): GoalChanceRangeEntry | null {
  if (!isRec(v) || !wholePct(v.low_pct) || !wholePct(v.high_pct) || v.low_pct >= v.high_pct
    || !rounding(v.low_rounding) || !rounding(v.high_rounding)
    || (v.kind !== 'link_strength' && v.kind !== 'link_existence')
    || !nonEmpty(v.from) || !nonEmpty(v.to) || (v.among !== 'all' && v.among !== 'unsized_links')) return null
  return {
    lowPct: v.low_pct, highPct: v.high_pct, lowRounding: v.low_rounding, highRounding: v.high_rounding,
    kind: v.kind, from: v.from, to: v.to, among: v.among,
  }
}

/** Exactly one record; invalid option entries are dropped, without rejecting valid siblings. */
export function readGoalChanceRange(inferenceWarnings: unknown): GoalChanceRange | null {
  if (!Array.isArray(inferenceWarnings)) return null
  const records = inferenceWarnings.filter((w) => isRec(w) && w.code === 'GOAL_CHANCE_RANGE')
  if (records.length !== 1) return null
  const r = records[0] as Record<string, unknown>
  const ids = r.option_ids
  if (r.severity !== 'info' || !nonEmpty(r.message) || !Array.isArray(ids) || ids.length === 0
    || !ids.every(nonEmpty) || new Set(ids).size !== ids.length || !isRec(r.range_by_option)) return null
  const rangeByOption: Record<string, GoalChanceRangeEntry> = Object.create(null)
  for (const id of ids) {
    if (!Object.prototype.hasOwnProperty.call(r.range_by_option, id)) continue
    const entry = readEntry(r.range_by_option[id])
    if (entry !== null) rangeByOption[id] = entry
  }
  const optionIds = ids.filter((id) => Object.prototype.hasOwnProperty.call(rangeByOption, id))
  return optionIds.length === 0 ? null : { optionIds, rangeByOption, horizonLine: readGoalChanceHorizonLine(r) }
}
