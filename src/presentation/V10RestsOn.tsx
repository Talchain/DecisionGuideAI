/**
 * v10 (#/canvas2), "Rests on": the key reads as v10 draws it. Figures are told apart by AUTHOR and nothing else: blue is
 * Olumi's (an estimate nobody has checked, solid; one you accepted, outlined), ink is the person's, grey is unset or of
 * unknown origin. Each option shows what it stands on as a count of figures on its path (`restsOnReliance.ts`).
 *
 * Counts only. No share of an option's uncertainty by author is served, so none is drawn: the note says so in words.
 */
import type { CSSProperties } from 'react'
import { Sparkles, User } from 'lucide-react'
import { typography } from '../styles/typography'
import type { AssumptionColumn } from '../canvas/artefacts/assumptionMapModel'
import type { OptionReliance, RelianceCounts } from './restsOnReliance'

export const V10_RESTS_ON_TESTID = 'v10-rests-on'

export const V10_RESTS_ON_COPY = {
  heading: 'What each option stands on',
  note: 'Figures on each option’s path, counted by who they came from. This counts figures; it does not say how much each one moves the result.',
  nothing: 'No figure on its path yet',
  olumi: 'Olumi’s, unchecked',
  accepted: 'Olumi’s, you accepted',
  yours: 'Yours',
  unset: 'No figure yet or origin not known',
} as const

/** Segment order: Olumi's first (the unexamined), then the person's, then the unset. */
const SEGMENTS: ReadonlyArray<{ id: 'unchecked' | 'accepted' | 'yours' | 'unset'; columns: readonly AssumptionColumn[]; label: string }> = [
  { id: 'unchecked', columns: ['unchecked'], label: V10_RESTS_ON_COPY.olumi },
  { id: 'accepted', columns: ['accepted'], label: V10_RESTS_ON_COPY.accepted },
  { id: 'yours', columns: ['yours'], label: V10_RESTS_ON_COPY.yours },
  { id: 'unset', columns: ['missing', 'unknown'], label: V10_RESTS_ON_COPY.unset },
]

const countOf = (counts: RelianceCounts, columns: readonly AssumptionColumn[]): number =>
  columns.reduce((sum, c) => sum + counts[c], 0)

function Glyph({ id }: { id: 'unchecked' | 'accepted' | 'yours' | 'unset' }) {
  if (id === 'yours') return <User aria-hidden="true" className="h-3 w-3 flex-none" style={{ color: 'var(--text-header)' }} />
  if (id === 'unset') return <span aria-hidden="true" className="inline-block h-0 w-3 flex-none border-t border-dashed" style={{ borderColor: 'var(--text-light)' }} />
  return <Sparkles aria-hidden="true" className="h-3 w-3 flex-none" style={{ color: 'var(--info)' }} />
}

/** The key: each author's glyph once, with its model-wide count. Shown folded and open. */
export function V10RestsOnLegend({ totals }: { totals: RelianceCounts }) {
  const shown = SEGMENTS.map((s) => ({ ...s, n: countOf(totals, s.columns) })).filter((s) => s.n > 0)
  if (shown.length === 0) return null
  return (
    <ul data-testid={`${V10_RESTS_ON_TESTID}-legend`} className={`m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 ${typography.panelMeta} text-text-body`}>
      {shown.map((s) => (
        <li key={s.id} data-testid={`${V10_RESTS_ON_TESTID}-legend-${s.id}`} className="inline-flex items-center gap-1 tabular-nums">
          <Glyph id={s.id} />
          {s.label} {s.n}
        </li>
      ))}
    </ul>
  )
}

const FILL: Record<'unchecked' | 'accepted' | 'yours' | 'unset', CSSProperties> = {
  unchecked: { background: 'var(--info)' },
  accepted: { background: 'transparent', boxShadow: 'inset 0 0 0 1.5px var(--info)' },
  yours: { background: 'var(--text-header)' },
  unset: { background: 'var(--border-default)' },
}

/** One option's row: its name, a bar of its figures by author, and the counts in words. Never blank. */
function Row({ row }: { row: OptionReliance }) {
  const parts = SEGMENTS.map((s) => ({ ...s, n: countOf(row.counts, s.columns) })).filter((s) => s.n > 0)
  return (
    <li data-testid={`${V10_RESTS_ON_TESTID}-row`} data-option={row.optionId} className="space-y-1">
      <p className={`${typography.panelBody} m-0 text-text-header`}>{row.label}</p>
      {row.total === 0 ? (
        <p className={`${typography.panelMeta} m-0 text-text-light`}>{V10_RESTS_ON_COPY.nothing}</p>
      ) : (
        <>
          <div aria-hidden="true" className="flex h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--track-neutral, var(--border-default))' }}>
            {parts.map((s) => (
              <i key={s.id} data-segment={s.id} className="block h-full" style={{ ...FILL[s.id], width: `${(s.n / row.total) * 100}%` }} />
            ))}
          </div>
          {/* A mark at rest: the author's glyph and the count. The words are on hover and focus, and once in the key above. */}
          <ul className={`m-0 flex list-none flex-wrap gap-x-3 gap-y-0.5 p-0 ${typography.panelMeta} text-text-body tabular-nums`}>
            {parts.map((s) => (
              <li key={s.id} data-testid={`${V10_RESTS_ON_TESTID}-count-${s.id}`} tabIndex={0} title={`${s.label} ${s.n}`} aria-label={`${s.label} ${s.n}`} className="inline-flex items-center gap-1">
                <Glyph id={s.id} />
                {s.n}
              </li>
            ))}
          </ul>
        </>
      )}
    </li>
  )
}

export function V10RestsOnReliance({ rows }: { rows: readonly OptionReliance[] }) {
  if (rows.length === 0) return null
  return (
    <section data-testid={`${V10_RESTS_ON_TESTID}-reliance`} className="space-y-2">
      <h3 className={`${typography.panelMeta} m-0 text-text-light`}>{V10_RESTS_ON_COPY.heading}</h3>
      <ul className="m-0 list-none space-y-2 p-0">
        {rows.map((r) => <Row key={r.optionId} row={r} />)}
      </ul>
      <p className={`${typography.panelMeta} m-0 text-text-light`}>{V10_RESTS_ON_COPY.note}</p>
    </section>
  )
}
