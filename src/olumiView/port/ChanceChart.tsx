/**
 * The Analysis tab's first five seconds (design, 18 Nov): each option's chance of meeting the aim in this model, on one 0 to 100 track, with
 * how far it moves when the figure it depends on most comes out low or high. One chart, one line per option, nothing repeated:
 * - the title is core's lead (`run.lead`), its lens words on hover;
 * - each option in core's card order: its heading, core's most-likely mark (`row.likely`) and Olumi mark (`row.olumi`), the bar filled to
 *   `row.chance`, a whisker from `row.driver.low` to `row.driver.high`, and core's own words for the chance under it (`row.value`, its
 *   `title` on hover). The numbers only place marks; every word is core's;
 * - a press on an option selects and centres its card on the canvas; pointing at it rings the card.
 * Geometry is in SVG attributes (percent of the track), colour in classes: no inline style.
 */
import { FoldChevron } from '../look/FoldChevron'
import type { ViewModel } from '../client'
import { pressCard, ringFrom } from '../reasoning/tabRing'
import { OkIcon } from '../look/icons'
import type { ViewCard } from '../client'
import { FigureEdit } from '../FigureEdit'
import { chartGroupsOf, findOutOf, rangeOf, trackPct, type ChartRow } from './pick'
import { TYPE } from './type'
import { typography } from '../../styles/typography'

/** The chart's own chrome: the key's two words and the axis. What low and high mean is core's sentence, on the key's hover. */
export const CHART_WORDS = { low: 'low', high: 'high', axis: ['0%', '50%', '100%'], meaning: 'What the marks mean' } as const
const RING = 'analysis-chart'

/** The 0 to 100 axis, over the first track (never between a bar and core's words for it): three equal columns, so 50% stands at the middle. */
function Axis() {
  return (
    <span className={`${TYPE.meta} mb-0.5 grid grid-cols-3 tabular-nums text-text-light`} aria-hidden="true" data-testid="analysis-chart-axis">
      <span className="text-left">{CHART_WORDS.axis[0]}</span><span className="text-center">{CHART_WORDS.axis[1]}</span><span className="text-right">{CHART_WORDS.axis[2]}</span>
    </span>
  )
}

/** One option's track: the bar to its chance, and the whisker between its low and high chances where core sends them. */
export function ChanceTrack({ chance, range }: { chance: number; range: { low: number; high: number } | null }) {
  const at = trackPct(chance)
  const lo = range === null ? null : trackPct(Math.min(range.low, range.high)), hi = range === null ? null : trackPct(Math.max(range.low, range.high))
  return (
    <svg className="block h-4 w-full overflow-visible" aria-hidden="true" data-testid="analysis-chance-track">
      <rect x="0" y="0" width="100%" height="6" rx="3" className="fill-panel-border" />
      <rect x="0" y="0" width={`${at}%`} height="6" rx="3" className="fill-option" data-chance-bar={at} />
      {/* The whisker sits under the bar, never over it, so the chance stays the first thing read. */}
      {range === null || lo === null || hi === null ? null : (
        <g data-chance-range={`${trackPct(range.low)}:${trackPct(range.high)}`}>
          <line x1={`${lo}%`} x2={`${hi}%`} y1="12" y2="12" strokeWidth="2" className="stroke-text-body" data-chance-whisker />
          <circle cx={`${trackPct(range.low)}%`} cy="12" r="3" strokeWidth="1.5" className="fill-panel stroke-text-body" data-chance-low />
          <circle cx={`${trackPct(range.high)}%`} cy="12" r="3" className="fill-text-body" data-chance-high />
        </g>
      )}
    </svg>
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
        {card.olumi == null ? null : <>{' '}<span className="text-info" title={card.olumi.title} aria-label={card.olumi.title} data-view={`${card.id}.olumi.glyph`}>{card.olumi.glyph}</span></>}
      </span>
      {card.figure?.edit == null || given.has(card.id) ? null : <FigureEdit id={card.id} edit={card.figure.edit} place="analysis-mover" glyph words={false} label={`Give your figure for ${card.heading}`} />}
    </span>
  )
}

/** One option's bar: its heading and core's marks, the track, core's words under it; a press focuses its card, pointing rings it. */
function Bar({ card, row, i, figure, given, axis = false }: ChartRow & { figure: ViewCard | null; given: ReadonlySet<string>; axis?: boolean }) {
  const range = rangeOf(row)
  const tail = row.tail !== undefined && row.tail.text !== '' ? row.tail.text : null
  return (
    <li data-chart-option={card.id}>
      <button type="button" onClick={() => pressCard(card.id)} onMouseEnter={() => ringFrom(RING, [card.id])} onFocus={() => ringFrom(RING, [card.id])} onBlur={() => ringFrom(RING, [])}
        title={row.title} className="-mx-1 block w-[calc(100%+0.5rem)] rounded-sm px-1 py-1 text-left hover:bg-panel-hover">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`${TYPE.body} min-w-0 text-text-header`} data-view={`${card.id}.heading`}>{card.heading}</span>
          <span className={`${TYPE.meta} flex shrink-0 gap-1 text-text-light`}>
            {row.likely == null ? null : <span className="text-text-header" title={row.likely.title} aria-label={row.likely.title} data-view={`${card.id}.rows.${i}.likely.glyph`}>{row.likely.glyph}</span>}
            {row.olumi == null ? null : <span className="text-info" title={row.olumi.title} aria-label={row.olumi.title} data-view={`${card.id}.rows.${i}.olumi.glyph`}>{row.olumi.glyph}</span>}
          </span>
        </span>
        <span className="mt-1 block px-1">{axis ? <Axis /> : null}<ChanceTrack chance={row.chance!} range={range} /></span>
        <span className={`${TYPE.meta} mt-0.5 block text-text-body`} data-view={`${card.id}.rows.${i}.value`}>{row.value}</span>
        {/* Which figure the whisker is for, at rest (Codex 01:56Z: a range with no identity reads as a confidence bound, which it is not). The
            label is a sibling of the press below, never inside it; when every whisker is for one figure it is named once, under the chart. */}
      </button>
      {range === null || figure === null ? null : <span className="block px-1"><FigureLabel card={figure} given={given} /></span>}
      {/* Core's worst-tenth sentence for this option and aim (R7, `rows[].tail`, optional): supporting detail
          under its own bar, verbatim, never composed from its numbers and never a comparison across options. */}
      {tail === null ? null : <p className={`${TYPE.meta} m-0 mt-0.5 px-1 text-text-light`} data-view={`${card.id}.rows.${i}.tail.text`}>{tail}</p>}
    </li>
  )
}

/** Every aim with a chance, each its own chart on the one 0 to 100 axis: the lead aim first, under core's lead; the others under their aim. */
export function ChanceChart({ model }: { model: ViewModel }) {
  const run = model.run ?? null
  const groups = chartGroupsOf(model)
  if (run === null || groups.length === 0) return null
  const ranged = groups.some((g) => g.rows.some(({ row }) => rangeOf(row) !== null))
  const { given } = findOutOf(run)
  const figureOf = (r: ChartRow) => { const f = rangeOf(r.row); return f === null ? null : model.cards.find((c) => c.id === f.figure) ?? null }
  // Every whisker for one figure: it is named once, beside the key, not under every bar.
  const figures = [...new Set(groups.flatMap((g) => g.rows.map(figureOf)).filter((c): c is ViewCard => c !== null))]
  const shared = figures.length === 1 ? figures[0]! : null
  // Each mark an option carries (core's most-likely and Olumi marks), said once in core's own title: the glyph alone is not a meaning.
  const marks = [...new Map(groups.flatMap((g) => g.rows.flatMap(({ row }) => [row.likely, row.olumi])).filter((m): m is NonNullable<typeof m> => m != null).map((m) => [m.glyph, m] as const)).values()]
  const sentence = ranged && run.sensitivity != null ? run.sensitivity.text : ''
  const lensTitle = run.lenses?.find((l) => l.id === 'goal')?.title
  return (
    <section className="space-y-3" data-testid="analysis-chance-chart" aria-label={run.lead ?? groups[0]!.aim.text} onMouseLeave={() => ringFrom(RING, [])}>
      {groups.map((g, gi) => (
        <div key={g.aimId} className="space-y-1" data-chart-aim={g.aimId}>
          {g.lead && run.lead != null
            ? <h3 className={`${typography.viewPanelHeading} m-0 text-text-header`} title={lensTitle} data-view="run.lead">{run.lead}</h3>
            : <h3 className={`${typography.viewPanelHeading} m-0 text-text-header`} data-view={g.aim.at}>{g.aim.text}</h3>}
          <ul className="m-0 list-none space-y-1 p-0">{g.rows.map((r, k) => <Bar key={r.card.id} {...r} figure={shared === null ? figureOf(r) : null} given={given} axis={gi === 0 && k === 0} />)}</ul>
        </div>
      ))}
      {/* The key: low and high, the figure they are for, and one disclosure (reachable by touch and keyboard, never hover alone) for what the marks and
          the two ends mean, in core's own words: each mark's title and the sensitivity sentence. */}
      {!ranged && marks.length === 0 ? null : (
        <div className={`${TYPE.meta} space-y-0.5 px-1 text-text-light`} title={ranged ? run.sensitivity?.title : undefined} data-testid={ranged ? 'analysis-chart-key' : 'analysis-chart-marks'}>
          {!ranged ? null : (
            <p className="m-0 flex items-center gap-2" aria-hidden="true">
              <svg className="h-2.5 w-2.5"><circle cx="50%" cy="50%" r="3" strokeWidth="1.5" className="fill-panel stroke-text-body" /></svg>{CHART_WORDS.low}
              <svg className="h-2.5 w-2.5"><circle cx="50%" cy="50%" r="3" className="fill-text-body" /></svg>{CHART_WORDS.high}
            </p>
          )}
          {shared === null || !ranged ? null : <FigureLabel card={shared} given={given} />}
          {/* What the two ends ARE, at rest (Codex 008 item 3, the overnight analysis design's scientific closure): core's one sentence that they are the
              chances if that input comes out in its lowest or highest third, never a confidence interval. Only the marks' legend folds. */}
          {sentence === '' || !ranged ? null : <p className="m-0 text-text-body" data-view="run.sensitivity.text" data-testid="analysis-chart-ends">{sentence}</p>}
          {marks.length === 0 ? null : (
            <details data-testid="analysis-chart-meaning">
              <summary className="flex min-h-6 cursor-pointer list-none items-center gap-1 text-text-body [&::-webkit-details-marker]:hidden"><FoldChevron />{CHART_WORDS.meaning}</summary>
              <div className="space-y-1 pb-1"><Marks marks={marks} /></div>
            </details>
          )}
        </div>
      )}
    </section>
  )
}
