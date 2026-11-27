/** The selected aim’s chances, conditional whiskers and Core’s words on one 0 to 100 axis. */
import { useId, useState } from 'react'
import { FoldChevron } from '../look/FoldChevron'
import type { ViewModel } from '../client'
import { ringFrom } from '../reasoning/tabRing'
import { OkIcon } from '../look/icons'
import { GlyphMark, Hover } from '../look/Hover'
import type { ViewCard } from '../client'
import { FigureEdit } from '../FigureEdit'
import { findOutOf, rangeOf, type ChartGroup, type ChartRow } from './pick'
import { typography } from '../../styles/typography'
import { TYPE } from './type'
import { ChanceKeyMark, ChanceTrack } from '../v12/scale/ChanceTrack'
import { ChanceDots } from '../v12/scale/ChanceDots'
import { OptionRow, RESULT_ROW_GRID } from './OptionRow'
import { chanceForDots, isFixedMiss } from '../resultRange'

/** The chart's own chrome: the key's two words and the axis. What low and high mean is core's sentence, on the key's hover. */
export const CHART_WORDS = { low: 'low', high: 'high', axis: ['0%', '50%', '100%'], more: 'More on these chances' } as const
const RING = 'analysis-chart'

/** The 0 to 100 axis, over the first track (never between a bar and core's words for it): three equal columns, so 50% stands at the middle. */
function Axis() {
  return (
    <span className={`${TYPE.meta} mb-0.5 grid grid-cols-3 tabular-nums text-text-light`} aria-hidden="true" data-testid="analysis-chart-axis">
      <span className="text-left">{CHART_WORDS.axis[0]}</span><span className="text-center">{CHART_WORDS.axis[1]}</span><span className="text-right">{CHART_WORDS.axis[2]}</span>
    </span>
  )
}

/** The marks' key: each glyph beside core's own words for it. */
function Marks({ marks }: { marks: readonly { glyph: string; title: string }[] }) {
  if (marks.length === 0) return null
  return (
    <ul className="m-0 grid list-none gap-0.5 p-0" data-chart-marks>
      {marks.map((m) => <li key={m.glyph} className="flex min-w-0 items-baseline gap-1" data-chart-mark={m.glyph}><span className="text-text-header" aria-hidden="true">{m.glyph}</span><span className="min-w-0 break-words">{m.title}</span></li>)}
    </ul>
  )
}

/**
 * The figure a whisker is for, named once: core's heading, core's words for its value, Olumi's mark where core gives one, and ✎ to give your
 * own (what narrows a range Olumi estimated), unless core's find-out ranking below already offers that ✎.
 */
function FigureLabel({ card, given }: { card: ViewCard; given: ReadonlySet<string> }) {
  return (
    <span className={`${TYPE.meta} flex min-h-6 items-center gap-1 text-text-light`} data-chart-figure={card.id}>
      <OkIcon id="why-moves" size={14} decorative />
      <span className="min-w-0">
        <span data-view={`${card.id}.heading`}>{card.heading}</span>
        {card.figure == null || card.figure.text === '' ? null : <>{' '}<span className="text-text-body" data-view={`${card.id}.figure.text`}>{card.figure.text}</span></>}
        {card.olumi == null ? null : <>{' '}<GlyphMark mark={card.olumi} className="text-info" view={`${card.id}.olumi.glyph`} /></>}
      </span>
      {card.figure?.edit == null || given.has(card.id) ? null : <FigureEdit id={card.id} edit={card.figure.edit} place="analysis-mover" glyph words={false} label={`Give your figure for ${card.heading}`} />}
    </span>
  )
}

/** A fixed zero draws Core's words alone. Older Views may only mark the headline's own aim as fixed. */
const neverMet = (card: ViewCard, row: ChartRow['row']): boolean =>
  isFixedMiss(row) || (row.chance === 0 && card.headline?.state === 'fixed' && card.headline.aim_id === row.aim_id)

/** One option's bar: its heading and core's marks, the track, core's words and dots above it; a press focuses its card, pointing rings it. */
function Bar({ card, row, i, figure, given, axis = false }: ChartRow & { figure: ViewCard | null; given: ReadonlySet<string>; axis?: boolean }) {
  const range = rangeOf(row)
  const tail = tailOf(row)
  const fixedMiss = neverMet(card, row)
  const withheld = card.headline?.state === 'none' && card.headline.aim_id === row.aim_id
  return (
    <li data-chart-option={card.id}>
      <OptionRow id={card.id} ring={RING} words={row.title} wordsAt={`${card.id}.rows.${i}.title`}
        className={`${RESULT_ROW_GRID} items-end`}>
        <span className="flex min-w-0 flex-wrap items-baseline gap-1">
          <span className={`${TYPE.body} min-w-0 break-words text-text-header`} data-view={`${card.id}.heading`}>{card.heading}</span>
          <span className={`${TYPE.meta} flex shrink-0 gap-1 text-text-light`}>
            {row.likely == null ? null : <GlyphMark mark={row.likely} tip={false} className="text-text-header" view={`${card.id}.rows.${i}.likely.glyph`} />}
            {row.olumi == null ? null : <GlyphMark mark={row.olumi} tip={false} className="text-info" view={`${card.id}.rows.${i}.olumi.glyph`} />}
          </span>
        </span>
        <span className="min-w-0">
          {fixedMiss ? null : <>{axis ? <Axis /> : null}<ChanceTrack chance={row.chance!} range={range} /></>}
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 [&_[data-chance-dots]]:max-w-full [&_[data-chance-dots]]:flex-wrap">
          <span className={`${TYPE.meta} min-w-0 break-words text-text-body`} data-view={`${card.id}.rows.${i}.value`}>{row.value}</span>
          <ChanceDots chance={fixedMiss || withheld ? null : chanceForDots(row)} />
        </span>
        {/* Which figure the whisker is for, at rest (Codex 01:56Z: a range with no identity reads as a confidence bound, which it is not). The
            label is a sibling of the press below, never inside it; when every whisker is for one figure it is named once, under the chart. */}
      </OptionRow>
      {range === null || figure === null ? null : <span className="block px-1"><FigureLabel card={figure} given={given} /></span>}
      {/* Core's worst-tenth sentence for this option and aim (R7, `rows[].tail`, optional): supporting detail
          under its own bar, verbatim, never composed from its numbers and never a comparison across options. */}
      {tail === null ? null : <p className={`${TYPE.meta} m-0 mt-0.5 px-1 text-text-light`} data-view={`${card.id}.rows.${i}.tail.text`}>{tail}</p>}
    </li>
  )
}

/** Core's one note for the worst-tenth lines (`run.tail_note`, core s3-tail-once 7e6add3d): what "Worst tenth" means and its hedge, said ONCE by code for the aims it
 *  lists; each option's own line is then short ("Worst tenth: about £320/week"). Read defensively (additive; absent on an older core, whose rows carry the whole sentence). */
export const tailNoteOf = (run: unknown): { text: string; aims: string[] } | null => {
  const n = typeof run === 'object' && run !== null ? (run as { tail_note?: unknown }).tail_note : undefined
  if (typeof n !== 'object' || n === null) return null
  const { text, aims } = n as { text?: unknown; aims?: unknown }
  return typeof text === 'string' && text.trim() !== '' && Array.isArray(aims) && aims.every((a) => typeof a === 'string') ? { text, aims: aims as string[] } : null
}
const tailOf = (row: ChartRow['row']): string | null => (row.tail !== undefined && row.tail.text !== '' ? row.tail.text : null)

/** The selected aim's chance rows share one 0 to 100 axis. */
export function ChanceChart({ model, group }: { model: ViewModel; group: ChartGroup }) {
  const [openAim, setOpenAim] = useState<string | null>(null)
  const open = openAim === group.aimId
  const foldId = useId()
  const headingId = useId()
  const run = model.run ?? null
  if (run === null) return null
  const ranged = group.rows.some(({ row }) => rangeOf(row) !== null)
  const { given } = findOutOf(run)
  const figureOf = (r: ChartRow) => { const f = rangeOf(r.row); return f === null ? null : model.cards.find((c) => c.id === f.figure) ?? null }
  const figures = [...new Set(group.rows.map(figureOf).filter((c): c is ViewCard => c !== null))]
  const shared = figures.length === 1 ? figures[0]! : null
  const marks = [...new Map(group.rows.flatMap(({ row }) => [row.likely, row.olumi]).filter((m): m is NonNullable<typeof m> => m != null).map((m) => [m.glyph, m] as const)).values()]
  const sentence = ranged && run.sensitivity != null ? run.sensitivity.text : ''
  const tailNote = tailNoteOf(run)
  const showTailNote = tailNote !== null && tailNote.aims.includes(group.aimId) && group.rows.some(({ row }) => tailOf(row) !== null)
  const axisAt = group.rows.findIndex(({ card, row }) => !neverMet(card, row))
  return (
    <section className="space-y-3" data-testid="analysis-chance-chart"
      aria-label={group.lead ? group.aim.text : undefined} aria-labelledby={group.lead ? undefined : headingId} onMouseLeave={() => ringFrom(RING, [])}>
      <div className="space-y-1" data-chart-aim={group.aimId}>
        {group.lead ? null : <h3 id={headingId} className={`${typography.viewPanelHeading} m-0 text-text-header`} data-view={group.aim.at}>{group.aim.text}</h3>}
        {showTailNote ? <p className={`${TYPE.meta} m-0 px-1 text-text-light`} data-view="run.tail_note.text">{tailNote.text}</p> : null}
        <ul className="m-0 list-none space-y-1 p-0">{group.rows.map((r, k) => <Bar key={r.card.id} {...r} figure={shared === null ? figureOf(r) : null} given={given} axis={k === axisAt} />)}</ul>
      </div>
      {/* At rest, under the bars: the figure every whisker is for (when it is one) and core's sentence for what the two ends ARE, never folded
          (Codex 008 item 3: folded, the ends could read as a confidence interval). Then ONE press (a button, reachable by touch and keyboard, never
          hover alone), offered whenever anything is folded: the low/high key and each mark's meaning in core's own title. */}
      {!ranged && marks.length === 0 ? null : (
        <div className={`${TYPE.meta} space-y-0.5 px-1 text-text-light`} data-testid={ranged ? 'analysis-chart-key' : 'analysis-chart-marks'}>
          {shared === null || !ranged ? null : <FigureLabel card={shared} given={given} />}
          {sentence === '' || !ranged ? null : <Hover as="p" words={run.sensitivity?.title} wordsAt="run.sensitivity.title" className="m-0 text-text-body" data-view="run.sensitivity.text" data-testid="analysis-chart-ends">{sentence}</Hover>}
          <button type="button" onClick={() => setOpenAim(open ? null : group.aimId)} aria-expanded={open} aria-controls={open ? foldId : undefined} className="-mx-1 inline-flex min-h-7 items-center gap-1 px-1 text-text-body hover:text-text-header" data-testid="analysis-chart-more">
            <FoldChevron open={open} />{CHART_WORDS.more}
          </button>
          {!open ? null : (
            <div id={foldId} className="space-y-0.5 pb-1" data-testid="analysis-chart-fold">
              {!ranged ? null : (
                <p className="m-0 flex items-center gap-2" aria-hidden="true" data-testid="analysis-chart-ends-key">
                  <ChanceKeyMark kind="low" />{CHART_WORDS.low}
                  <ChanceKeyMark kind="high" />{CHART_WORDS.high}
                </p>
              )}
              <Marks marks={marks} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}
