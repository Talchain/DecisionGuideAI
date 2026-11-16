/**
 * V12 "Where we differ": pure grouping and counting over core's `GET /api/scenarios/:sid/differences` read. Nothing is worded about the
 * scenario here and no number is calculated beyond counting rows core sent; every group is decided by core's own fields (`kind`, `status`,
 * the chances it supplies), never by reading words.
 *
 * Core's own `group` field (`framing | reasoning | consequence`, core scope z2 §3; additive) decides the group whenever it is sent; the
 * derivation below is only for a core that sends none. Text-only kinds (`question | aim | option | link_added`, status `not_run`) are
 * `framing` and are shown, never ranked or counted as calculated.
 *
 * Groups (proposal, "The centre: member views"; Codex reply 005: not ranked by one number, and "not computable" never means "unimportant"):
 *  1. question: a factor one member thinks the model is missing (core `kind: 'factor'`): a different question or measure of success.
 *  2. reasoning: contested reasoning or evidence: every link, and any figure whose effect core has not (or could not) calculate
 *     (`pending`, `not_run`, `withheld`). Not computable stays here, visible, never dropped.
 *  3. consequence: core supplied a status of `changes`, `moves` or `same` AND at least one holder's chance for an option.
 */
import type { View } from '../../client'
import type { Difference, Differences } from '../../../olumiCore/team/differences'

export type DifferGroupId = 'question' | 'reasoning' | 'consequence'
/** Chrome words only: category names, never about the scenario. */
export const DIFFER_GROUP_HEADINGS: Record<DifferGroupId, string> = {
  question: 'A different question or measure of success',
  reasoning: 'Contested reasoning or evidence',
  consequence: 'Calculated consequences',
}
export const DIFFER_GROUP_ORDER: readonly DifferGroupId[] = ['question', 'reasoning', 'consequence']

const CALCULATED = new Set<Difference['status']>(['changes', 'moves', 'same'])

/** Core's group name for a row, mapped to ours (`framing` is the different-question group); null when core sent none or one we do not know. */
const CORE_GROUPS: Readonly<Record<string, DifferGroupId>> = { framing: 'question', reasoning: 'reasoning', consequence: 'consequence' }
export const coreGroupOf = (d: Difference): DifferGroupId | null => CORE_GROUPS[String((d as { group?: unknown }).group)] ?? null
/** The text-only kinds core adds (`question | aim | option | link_added`): different words, not run, so never drawn as a calculated consequence. */
const TEXT_ONLY = new Set(['question', 'aim', 'option', 'link_added'])

export function groupOf(d: Difference): DifferGroupId {
  const core = coreGroupOf(d)
  if (core !== null) return core
  const kind = (d as { kind?: string }).kind
  if (kind === 'factor' || (kind !== undefined && TEXT_ONLY.has(kind))) return 'question'
  const hasChance = d.options.some((o) => o.chances.some((c) => c.chance !== null))
  return CALCULATED.has(d.status) && hasChance ? 'consequence' : 'reasoning'
}

/** Core's own heading for a group (`headings.groups`, v1.41), drawn as given; null from a core that sends none. */
const coreHeading = (data: Differences, id: DifferGroupId): string | null => {
  const g = (data.headings as unknown as { groups?: Record<string, unknown> }).groups
  const h = g?.[id === 'question' ? 'framing' : id]
  return typeof h === 'string' && h !== '' ? h : null
}

export interface DifferGroup { readonly id: DifferGroupId; readonly heading: string; readonly rows: readonly Difference[] }
/** Non-empty groups only, in the fixed order; rows keep core's order. */
export function groupDifferences(data: Differences): readonly DifferGroup[] {
  return DIFFER_GROUP_ORDER.flatMap((id) => {
    const rows = data.differences.filter((d) => groupOf(d) === id)
    return rows.length === 0 ? [] : [{ id, heading: coreHeading(data, id) ?? DIFFER_GROUP_HEADINGS[id], rows }]
  })
}

/** True once this viewer is authorised to see revealed views: core is not holding them back and at least one has been revealed. */
export function revealedForYou(view: View): boolean {
  return !view.gated && view.collab.shared.length > 0
}

/** A valid comparison: authorised, core's read not gated, and two different people have each given a view (a skip is not a view). */
export function validComparison(view: View, data: Differences | null): data is Differences {
  if (data === null || data.gated || !revealedForYou(view)) return false
  return new Set(view.collab.shared.filter((s) => !s.skip).map((s) => s.by_id)).size >= 2
}

export interface DifferCount { readonly places: number; readonly changes: number }
/** Places = distinct records (core sends a link once per aim); changes = distinct records where core says it changes the answer. */
export function countDifferences(data: Differences): DifferCount {
  const all = new Set(data.differences.map((d) => d.record))
  const ch = new Set(data.differences.filter((d) => d.status === 'changes').map((d) => d.record))
  return { places: all.size, changes: ch.size }
}

/** Chrome words for the count. Says "changes the answer" only for what core marks `changes`; never claims none do, since not all are run. */
export function summaryLine(c: DifferCount): string | null {
  if (c.places === 0) return null
  const where = `${c.places} ${c.places === 1 ? 'place' : 'places'} you differ`
  return c.changes === 0 ? where : `${where}; ${c.changes} ${c.changes === 1 ? 'changes' : 'change'} the answer`
}
