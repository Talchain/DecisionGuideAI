/**
 * Focus Now — pure view-model mapper.
 *
 * Composes the rows the panel renders, honestly and render-only (F.6):
 *   - server_sourced rows first, in RECEIVED order (never ranked/sorted/selected),
 *     mapped from a structured coaching signal reading ONLY allow-listed human
 *     fields — never a science field, so a gated row can't be constructed here;
 *   - the fixed static_hygiene rows next (unless suppressed);
 *   - gated rows dropped (belt-and-braces), empty-primary rows dropped,
 *     duplicate ids dropped.
 *
 * `coaching_summary` is NOT mapped to a row — it has no per-entity grounding to
 * justify one — it maps to the panel summary line, verbatim, and is never
 * synthesised. (It is also NOT claim-certified; the live container gates its
 * display — see useFocusNow.)
 *
 * Pure and fail-closed: malformed input degrades to "static rows only, no
 * summary" and never throws.
 */
import type { CoachingSignal } from '../types'
import type { FocusRow } from './focusTypes'
import { FOCUS_COPY, STATIC_HYGIENE_ROWS } from './focusConstants'

export interface BuildFocusRowsInput {
  /** Live: store.ceeAnalysisReady?.coaching_summary. NOT claim-certified. */
  coachingSummary?: string | null
  /** Future Lane-A structured coaching signals. Default none. */
  signals?: readonly CoachingSignal[]
  /** Escape hatch for a context that suppresses the generic nudges. Default false. */
  suppressStatic?: boolean
}

export interface FocusViewModel {
  /** Verbatim orientation line, or null. Never synthesised. */
  summary: string | null
  rows: FocusRow[]
}

function nonEmpty(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined
}

/** Remove any row that claims gated ownership. The mapper never emits one; this defends the render path. */
export function dropGatedRows(rows: readonly FocusRow[]): FocusRow[] {
  return rows.filter((r) => r && r.ownership !== 'gated')
}

/**
 * Map a structured coaching signal to a server_sourced row. Reads ONLY human
 * allow-listed fields (observation, priority_reason, first suggested action,
 * target). Numeric priority, lifecycle, evidence, staleness and any science
 * field are deliberately ignored. Returns null when there is no usable line.
 *
 * One-way DISPLAY adaptation only: the canonical coaching wire shape is owned
 * upstream by CEE, not here. `FocusRow` is internal UI state — a server signal
 * maps INTO it for rendering, never the reverse.
 */
export function mapSignalToFocusRow(signal: CoachingSignal | undefined | null): FocusRow | null {
  if (!signal || typeof signal !== 'object') return null
  const observation = nonEmpty(signal.grounding?.observation)
  if (!observation) return null

  const tryThis = nonEmpty(signal.suggested_actions?.[0]?.label)
  const id = nonEmpty(signal.signal_id) ?? observation

  return {
    id: `signal:${id}`,
    ownership: 'server_sourced',
    source: 'coaching_signal',
    primary: observation,
    whyItMatters: nonEmpty(signal.priority_reason),
    tryThis,
    targetKind: nonEmpty(signal.target_kind),
    targetLabel: nonEmpty(signal.target_label),
    ...(tryThis ? { action: { kind: 'prefill' as const, label: FOCUS_COPY.tryThisLabel, prefillText: tryThis } } : {}),
  }
}

export function buildFocusRows(input: BuildFocusRowsInput = {}): FocusViewModel {
  const summary = nonEmpty(input.coachingSummary) ?? null

  const signals = Array.isArray(input.signals) ? input.signals : []
  const serverRows = signals
    .map(mapSignalToFocusRow)
    .filter((r): r is FocusRow => r != null)

  const staticRows = input.suppressStatic ? [] : STATIC_HYGIENE_ROWS

  // Fixed structural order — positional composition, NOT meaning-based ranking.
  const combined = dropGatedRows([...serverRows, ...staticRows]).filter(
    (r) => nonEmpty(r.primary) != null,
  )

  // Drop duplicate ids (first occurrence wins). Namespaced ids make this near-impossible.
  const seen = new Set<string>()
  const rows: FocusRow[] = []
  for (const r of combined) {
    if (seen.has(r.id)) continue
    seen.add(r.id)
    rows.push(r)
  }

  return { summary, rows }
}
