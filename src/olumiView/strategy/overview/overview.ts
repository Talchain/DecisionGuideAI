/**
 * The Strategy Overview's rows: core's `strategy.overview.sections` (olumi-core src/view/strategy.ts), the approved board's groups in core's
 * words, drawn as given. Each line is a stored word with core's state pill ("From the brief", "Untested", "Olumi asks", the reveal's mark
 * sentence, "<who> added evidence") and its holders. No word, count or order is made here; a View without the key has no overview.
 */
import type { View } from '../../client'

type Section = NonNullable<View['strategy']>['overview']['sections'][number]
type Line = Section['lines'][number]
export type Family = 'question' | 'aim' | 'option' | 'factor' | 'risk' | 'item'
export type Row = { id: string; family: Family; title: string; pill: string; info: boolean; holders: string[] }
export type Group = { id: string; heading: string; count: number | null; rows: Row[]; empty: string }

export const MAX_HOLDERS = 3
/** Core's pills that mark Olumi's own part (drawn as an info pill, Olumi's blue): its words, not this file's. */
const OLUMI_PILLS = new Set(['Olumi asks', 'Olumi inferred'])
const COUNTED = new Set(['routes', 'assumptions', 'factors', 'risks', 'questions'])

const familyOf = (section: string, l: Line): Family =>
  section === 'question' ? 'question' : section === 'aim' ? 'aim' : l.ref?.family === 'option' ? 'option' : l.ref?.family === 'risk' ? 'risk' : l.ref?.family === 'quantity' ? 'factor' : 'item'

const row = (section: string) => (l: Line): Row => ({ id: l.id, family: familyOf(section, l), title: l.text, pill: l.pill ?? '', info: l.pill !== null && OLUMI_PILLS.has(l.pill), holders: l.people.map((p) => p.name) })

/** Core's sections as the page's groups; [] without the key. */
export function overviewOf(view: View): Group[] {
  const s = (view as { strategy?: View['strategy'] }).strategy
  if (!s) return []
  return s.overview.sections.map((sec): Group => ({ id: sec.id, heading: sec.heading, count: COUNTED.has(sec.id) ? sec.lines.length : null, rows: sec.lines.map(row(sec.id)), empty: sec.empty }))
}
