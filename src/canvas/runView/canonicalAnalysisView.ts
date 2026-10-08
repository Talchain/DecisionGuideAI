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
    readonly run_revision: null
    readonly basis: 'analysis_graph_hash_interim'
    readonly reason: string | null
    readonly limitation: 'Hash equality cannot detect brief, framing or stage changes.'
  }
  readonly face_when_stale?: string
  readonly leader_licence: 'permitted' | 'permitted_with_caveat' | 'withheld'
  readonly options: readonly { readonly option_id: string; readonly cell: CanonicalAnalysisCell; readonly main_driver: CanonicalMainDriver }[]
}
const rec = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const nullableString = (v: unknown): v is string | null => v === null || typeof v === 'string'
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
      || staleness.run_revision !== null || staleness.basis !== 'analysis_graph_hash_interim'
      || !nullableString(staleness.reason) || staleness.limitation !== 'Hash equality cannot detect brief, framing or stage changes.') return null
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
    return v as unknown as CanonicalAnalysisView
  } catch { return null }
}
