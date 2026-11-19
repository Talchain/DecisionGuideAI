/**
 * B2, the UI half: Olumi's reading of the round (`collab.round_read`), read by field against Codex's corrected contract (critique2/codex-b2.md,
 * 19 Nov; Paul's go; the UI lead's condition that no leader claim is ever the AI's).
 *
 * Every word drawn is core's: core composes the lead, the kind's words, the settle line and the question from typed selections the AI made,
 * and embeds each comparison as its own Difference (`{record, goal}`, with core's `status`, `status_text` and chances). The AI writes no
 * display text, so nothing here can say which option leads except core's own `status_text` for that comparison. Fields this reader does not
 * name are never drawn, whatever they hold.
 *
 * Absent (an older core) or null (withheld): nothing. Drawn only for this viewer's version, never while core holds the views back.
 */
import type { View } from '../../olumiView/client'
import type { Difference, DifferenceStatus } from './differences'

export type CruxKind = 'estimate' | 'cause' | 'framing' | 'priorities_question'
const KINDS: readonly CruxKind[] = ['estimate', 'cause', 'framing', 'priorities_question']
const STATUSES: readonly DifferenceStatus[] = ['changes', 'moves', 'same', 'withheld', 'pending', 'not_run']

/** A person's own words, as core resolved them from their revealed view. */
export interface RoundQuote { readonly id: string; readonly view_id: number; readonly holder_id: string; readonly holder: string; readonly text: string }
export interface RoundCrux {
  readonly id: string; readonly kind: CruxKind; readonly kind_text: string
  readonly quotes: readonly RoundQuote[]; readonly comparisons: readonly Difference[]
  readonly settle_text: string | null; readonly question: { readonly to: string | null; readonly text: string } | null
}
export interface RoundRead { readonly at_version: number; readonly snapshot: string; readonly scope: string; readonly provisional_text: string; readonly lead: string; readonly cruxes: readonly RoundCrux[] }

const isStr = (x: unknown): x is string => typeof x === 'string'
const words = (x: unknown): x is string => isStr(x) && x.trim() !== ''
const obj = (x: unknown): Record<string, unknown> | null => (x !== null && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : null)

/** One comparison core embedded: a whole Difference by its fields, or null. */
function comparisonOf(x: unknown): Difference | null {
  const d = obj(x)
  if (d === null || !words(d.record) || !isStr(d.goal) || !isStr(d.label) || !isStr(d.goal_label) || !STATUSES.includes(d.status as DifferenceStatus) || !words(d.status_text)) return null
  if (!Array.isArray(d.sides) || !Array.isArray(d.options) || !Array.isArray(d.settle) || !Array.isArray(d.steps)) return null
  return d as unknown as Difference
}

/** A quote, bound by identity: the revealed view it names is in this View, is that person's, and holds these exact words. */
function quoteOf(x: unknown, view: View): RoundQuote | null {
  const q = obj(x)
  if (q === null || !words(q.id) || typeof q.view_id !== 'number' || !words(q.holder_id) || !words(q.holder) || !words(q.text)) return null
  const shown = view.collab.shared.find((s) => s.id === q.view_id)
  if (shown === undefined || shown.by_id !== q.holder_id || !shown.text.includes(q.text)) return null
  return { id: q.id, view_id: q.view_id, holder_id: q.holder_id, holder: q.holder, text: q.text }
}

/** A crux, or null when any reference fails: an invalid crux is dropped whole, never drawn in part. */
function cruxOf(x: unknown, view: View): RoundCrux | null {
  const c = obj(x)
  if (c === null || !words(c.id) || !KINDS.includes(c.kind as CruxKind) || !words(c.kind_text) || !Array.isArray(c.quotes) || !Array.isArray(c.comparisons)) return null
  const comparisons = c.comparisons.map(comparisonOf), quotes = c.quotes.map((q) => quoteOf(q, view))
  if (comparisons.length === 0 || comparisons.some((d) => d === null) || quotes.some((q) => q === null)) return null
  if (c.settle_text != null && !words(c.settle_text)) return null
  const qn = c.question == null ? null : obj(c.question)
  if (c.question != null && (qn === null || !words(qn.text) || !(qn.to === null || words(qn.to)))) return null
  return {
    id: c.id, kind: c.kind as CruxKind, kind_text: c.kind_text, quotes: quotes as RoundQuote[], comparisons: comparisons as Difference[],
    settle_text: c.settle_text == null ? null : (c.settle_text as string), question: qn === null ? null : { to: (qn.to as string | null), text: qn.text as string },
  }
}

/** Core's reading of the round for this viewer, or null: absent, withheld, gated, for another version, unmarked as Olumi's and provisional,
 *  or with no crux that survives its checks. */
export function roundReadOf(view: View): RoundRead | null {
  if (view.gated) return null
  const r = obj((view.collab as { round_read?: unknown }).round_read)
  if (r === null || r.source !== 'olumi' || r.provisional !== true || !words(r.provisional_text) || !words(r.lead) || !words(r.snapshot) || !words(r.scope)) return null
  const version = (view.version as { id?: unknown } | null)?.id
  if (typeof r.at_version !== 'number' || r.at_version !== version || !Array.isArray(r.cruxes)) return null
  const cruxes = r.cruxes.map((c) => cruxOf(c, view)).filter((c): c is RoundCrux => c !== null)
  if (cruxes.length === 0) return null
  return { at_version: r.at_version, snapshot: r.snapshot, scope: r.scope, provisional_text: r.provisional_text, lead: r.lead, cruxes }
}
