/** Tolerant READ boundary. Unknown versions and malformed records carry no authority. */
export type CanonicalAnalysisCell =
  | { readonly kind: 'figure'; readonly display: string; readonly face?: string }
  | { readonly kind: 'range'; readonly display: string; readonly face?: string; readonly detail: Readonly<Record<string, unknown>> }
  | { readonly kind: 'withheld'; readonly face?: string; readonly why?: string; readonly reasons: readonly { readonly code: string; readonly message: string | null }[] }
  | { readonly kind: 'none' }
export type CanonicalMainDriver =
  | { readonly kind: 'available'; readonly driver: Readonly<Record<string, unknown>>; readonly detail?: string }
  | { readonly kind: 'none_licensed'; readonly reason: string }
  | { readonly kind: 'not_recorded' }
export interface CanonicalAnalysisView {
  readonly schema: 'canonical_analysis_view.v1'
  readonly source: 'stored_run_facts'
  readonly run: { readonly run_id: string | null; readonly graph_hash_at_run: string | null; readonly computed_at: string | null } | null
  readonly staleness: {
    readonly stale: boolean | null
    readonly revision: number | null
    readonly run_revision: number | null
    readonly run_revision_source?: 'recorded' | 'legacy_unknown'
    readonly basis: 'analysis_graph_hash_interim' | 'recorded_run_revision'
    readonly reason: string | null
    readonly limitation: 'Hash equality cannot detect brief, framing or stage changes.'
      | 'No analysis hash was available; only the scenario revision was compared.'
  }
  readonly face_when_stale?: string
  readonly leader_licence: 'permitted' | 'permitted_with_caveat' | 'withheld'
  readonly options: readonly { readonly option_id: string; readonly cell: CanonicalAnalysisCell; readonly main_driver: CanonicalMainDriver }[]
  /** Recovery Batch C (CEE `canonicalGoalChanceDetail`): what the chance is a chance OF, and the lines said once beside it. */
  readonly goal_chance?: CanonicalGoalChanceDetail
  /**
   * S7 (CEE #3192, served from 15 Oct 02:32Z; `run-facts.ts` `RunLeader`): WHO leads this Run, as CEE says it. `option_id`
   * is the comparative leader only where the licence permits naming one and the Run is current, else null. Absent from
   * an older CEE, and dropped here when malformed (the rest of the view still stands).
   */
  leader?: CanonicalRunLeader
}
export interface CanonicalRunLeader {
  readonly licence: CanonicalAnalysisView['leader_licence']
  readonly option_id: string | null
}
/**
 * Recovery Batch C, CEE `canonical-analysis-view.ts` `CanonicalGoalChanceDetail`, copied from the Run's stored licence. The
 * UI says these words as served and composes no chance of its own.
 */
export interface CanonicalGoalChanceDetail {
  /** "chance of ‘Productivity’ being at least 10% higher than today at three months" */
  readonly chance_words?: string
  readonly notes?: readonly string[]
  readonly status_quo?: { readonly option_id: string; readonly line: string }
  readonly targets?: {
    readonly joint: { readonly status: 'licensed'; readonly words: string }
      | { readonly status: 'withheld'; readonly line: string; readonly frechet_line?: string }
    readonly per_target: readonly { readonly constraint_id: string; readonly words: string;
      readonly options: readonly { readonly option_id: string; readonly display: string }[] }[]
  }
}
const rec = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const nullableString = (v: unknown): v is string | null => v === null || typeof v === 'string'
const sayable = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '' && !/[\r\n]/.test(v)

/** The Batch C detail, or `undefined` when absent or any part is malformed (a malformed sentence is never said). */
export function parseCanonicalGoalChance(v: unknown): CanonicalGoalChanceDetail | undefined {
  if (!rec(v)) return undefined
  if (v.chance_words !== undefined && !sayable(v.chance_words)) return undefined
  if (v.notes !== undefined && !(Array.isArray(v.notes) && v.notes.every(sayable))) return undefined
  if (v.status_quo !== undefined && !(rec(v.status_quo) && sayable(v.status_quo.option_id) && sayable(v.status_quo.line))) return undefined
  if (v.targets !== undefined) {
    const t = v.targets
    if (!rec(t) || !rec(t.joint) || !Array.isArray(t.per_target)) return undefined
    const joint = t.joint
    if (joint.status === 'licensed' ? !sayable(joint.words)
      : joint.status !== 'withheld' || !sayable(joint.line) || (joint.frechet_line !== undefined && !sayable(joint.frechet_line))) return undefined
    if (!t.per_target.every(row => rec(row) && sayable(row.constraint_id) && sayable(row.words) && Array.isArray(row.options)
      && row.options.every(o => rec(o) && sayable(o.option_id) && sayable(o.display)))) return undefined
  }
  return v as unknown as CanonicalGoalChanceDetail
}
/** CEE's `leader` (licence + option id only; the rest is CEE's own), or `undefined` when absent or malformed. */
function parseCanonicalRunLeader(v: unknown): CanonicalRunLeader | undefined {
  if (!rec(v) || !['permitted', 'permitted_with_caveat', 'withheld'].includes(v.licence as string)) return undefined
  if (!(v.option_id === null || (typeof v.option_id === 'string' && v.option_id.trim() !== ''))) return undefined
  return { licence: v.licence as CanonicalRunLeader['licence'], option_id: v.option_id }
}
/** The only parser of the opaque field carried by the READ adapter. */
export function parseCanonicalAnalysisView(v: unknown): CanonicalAnalysisView | null {
  try {
    if (!rec(v) || v.schema !== 'canonical_analysis_view.v1' || v.source !== 'stored_run_facts') return null
    if (!['permitted', 'permitted_with_caveat', 'withheld'].includes(v.leader_licence as string)) return null
    if (v.run !== null && (!rec(v.run) || !nullableString(v.run.run_id)
      || !nullableString(v.run.graph_hash_at_run) || !nullableString(v.run.computed_at))) return null
    if (!rec(v.staleness) || (v.staleness.stale !== null && typeof v.staleness.stale !== 'boolean') || !Array.isArray(v.options)) return null
    const staleness = v.staleness
    if ((staleness.revision !== null && !(typeof staleness.revision === 'number' && Number.isSafeInteger(staleness.revision) && staleness.revision >= 0))
      || (staleness.run_revision !== null && !(typeof staleness.run_revision === 'number' && Number.isSafeInteger(staleness.run_revision) && staleness.run_revision >= 0))
      || ('run_revision_source' in staleness && !(staleness.run_revision_source === 'recorded' && typeof staleness.run_revision === 'number')
        && !(staleness.run_revision_source === 'legacy_unknown' && staleness.run_revision === null))
      || !nullableString(staleness.reason)
      || !(staleness.basis === 'analysis_graph_hash_interim' && staleness.limitation === 'Hash equality cannot detect brief, framing or stage changes.')
        && !(staleness.basis === 'recorded_run_revision' && staleness.limitation === 'No analysis hash was available; only the scenario revision was compared.')) return null
    if (v.face_when_stale !== undefined && typeof v.face_when_stale !== 'string') return null
    const ids = new Set<string>()
    for (const option of v.options) {
      if (!rec(option) || typeof option.option_id !== 'string' || option.option_id.trim() === '' || !rec(option.cell)) return null
      if (ids.has(option.option_id)) return null
      ids.add(option.option_id)
      const driver = option.main_driver
      if (!rec(driver)) return null
      if (driver.kind === 'available') {
        if (!rec(driver.driver) || (driver.detail !== undefined && typeof driver.detail !== 'string')) return null
      } else if (driver.kind === 'none_licensed') {
        if (typeof driver.reason !== 'string') return null
      } else if (driver.kind !== 'not_recorded') return null
      const cell = option.cell
      if (cell.face !== undefined && typeof cell.face !== 'string') return null
      if (cell.why !== undefined && typeof cell.why !== 'string') return null
      if (cell.kind === 'figure' || cell.kind === 'range') {
        if (typeof cell.display !== 'string' || (cell.kind === 'range' && !rec(cell.detail))) return null
      } else if (cell.kind === 'withheld') {
        if (!Array.isArray(cell.reasons) || !cell.reasons.every(reason => rec(reason)
          && typeof reason.code === 'string' && nullableString(reason.message))) return null
      } else if (cell.kind !== 'none') return null
    }
    const { goal_chance: goalChanceRaw, leader: leaderRaw, ...view } = v
    const goalChance = parseCanonicalGoalChance(goalChanceRaw)
    const leader = parseCanonicalRunLeader(leaderRaw)
    return {
      ...view,
      ...(goalChance === undefined ? {} : { goal_chance: goalChance }),
      ...(leader === undefined ? {} : { leader }),
    } as unknown as CanonicalAnalysisView
  } catch { return null }
}

/**
 * ⭐ DL #2800 follow-up (15 Oct): stamp a Results report with the Run id of the canonical view DELIVERED WITH IT (the same
 * turn or the same read), so `runViewOf` matches it by Run identity rather than hash + time. Only when the report has no
 * id of its own and the view's Run is the report's graph (`graph_hash_at_run === computed_against_hash`): a co-delivered
 * view about another Run never stamps. Mutates the freshly built report before it is stored.
 */
export function stampCanonicalRunId(report: Record<string, unknown>, canonical: CanonicalAnalysisView | null): void {
  const run = canonical?.run
  if (run == null || typeof run.run_id !== 'string' || run.run_id === '') return
  if (typeof report.run_id === 'string' && report.run_id !== '') return
  const hash = report.computed_against_hash
  if (typeof hash !== 'string' || hash === '' || hash !== run.graph_hash_at_run) return
  report.run_id = run.run_id
}
