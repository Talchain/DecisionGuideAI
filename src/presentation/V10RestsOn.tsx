/**
 * v10 (#/canvas2), "Rests on": figures are told apart by AUTHOR and nothing else. Blue is Olumi's (an estimate nobody
 * has checked, solid; one you accepted, outlined), ink is the person's, a dash is a figure not set or of unknown
 * origin. The glyphs are the card marks' own (`cardMarks.ts`): the Olumi mark, never Sparkles.
 *
 * Each label is said once. Folded, the legend names each author with its count. Open, the key's own group headings
 * already name them, so the groups only gain the glyph and the legend steps aside.
 */
import type { AssumptionColumn } from '../canvas/artefacts/assumptionMapModel'
import { cardMark } from '../canvas/nodes/shared/cardMarks'
import { typography } from '../styles/typography'

export const V10_RESTS_ON_TESTID = 'v10-rests-on'

type Author = 'unchecked' | 'accepted' | 'yours' | 'unset'

const AUTHOR_OF: Readonly<Record<AssumptionColumn, Author>> = {
  unchecked: 'unchecked', accepted: 'accepted', yours: 'yours', missing: 'unset', unknown: 'unset',
}

/** Segment order: Olumi's first (the unexamined), then the person's, then the unset. */
const LEGEND: ReadonlyArray<{ id: Author; columns: readonly AssumptionColumn[]; label: string }> = [
  { id: 'unchecked', columns: ['unchecked'], label: 'Olumi’s, unchecked' },
  { id: 'accepted', columns: ['accepted'], label: 'Olumi’s, you accepted' },
  { id: 'yours', columns: ['yours'], label: 'Yours' },
  { id: 'unset', columns: ['missing', 'unknown'], label: 'No figure yet or origin not known' },
]

/**
 * The author's glyph: the Olumi mark for Olumi's figures, the person's own mark for theirs, a dash for unset.
 * Olumi's unchecked estimate is the mark alone (solid); one you accepted is the same mark ringed (outlined), the same
 * solid-or-outlined distinction the numbered markers use.
 */
export function V10AuthorGlyph({ column }: { column: AssumptionColumn }) {
  const id = AUTHOR_OF[column]
  if (id === 'yours') {
    const Person = cardMark('source-you').Icon
    return <Person aria-hidden="true" className="h-3 w-3 flex-none" style={{ color: 'var(--text-header)' }} />
  }
  if (id === 'unset') return <span aria-hidden="true" className="inline-block h-0 w-3 flex-none border-t border-dashed" style={{ borderColor: 'var(--text-light)' }} />
  const Olumi = cardMark('source-olumi').Icon
  const mark = <Olumi aria-hidden="true" className="h-3 w-3 flex-none" />
  return id === 'accepted'
    ? <span data-glyph="accepted" className="inline-flex flex-none rounded-full p-0.5 ring-1 ring-info">{mark}</span>
    : <span data-glyph="unchecked" className="inline-flex flex-none">{mark}</span>
}

/** The folded key's legend: each author's glyph, name and count, once. */
export function V10RestsOnLegend({ counts }: { counts: Readonly<Record<AssumptionColumn, number>> }) {
  const shown = LEGEND.map((s) => ({ ...s, n: s.columns.reduce((sum, c) => sum + counts[c], 0) })).filter((s) => s.n > 0)
  if (shown.length === 0) return null
  return (
    <ul data-testid={`${V10_RESTS_ON_TESTID}-legend`} className={`m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 ${typography.panelMeta} text-text-body`}>
      {shown.map((s) => (
        <li key={s.id} data-testid={`${V10_RESTS_ON_TESTID}-legend-${s.id}`} className="inline-flex items-center gap-1 tabular-nums">
          <V10AuthorGlyph column={s.columns[0]} />
          {s.label} {s.n}
        </li>
      ))}
    </ul>
  )
}
