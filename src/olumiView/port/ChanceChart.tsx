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
import type { ViewModel } from '../client'
import { pressCard, ringFrom } from '../reasoning/tabRing'
import { chartRowsOf, rangeOf, trackPct } from './pick'
import { TYPE } from './type'
import { typography } from '../../styles/typography'

/** The chart's own chrome: the key's two words and the axis. What low and high mean is core's sentence, on the key's hover. */
export const CHART_WORDS = { low: 'low', high: 'high', axis: ['0%', '50%', '100%'] } as const
const RING = 'analysis-chart'

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
          <line x1={`${lo}%`} x2={`${hi}%`} y1="12" y2="12" strokeWidth="1" className="stroke-text-light" />
          <circle cx={`${trackPct(range.low)}%`} cy="12" r="2.5" strokeWidth="1" className="fill-panel stroke-text-body" data-chance-low />
          <circle cx={`${trackPct(range.high)}%`} cy="12" r="2.5" className="fill-text-body" data-chance-high />
        </g>
      )}
    </svg>
  )
}

export function ChanceChart({ model }: { model: ViewModel }) {
  const run = model.run ?? null
  const rows = chartRowsOf(model)
  if (run === null || rows.length === 0) return null
  const ranged = rows.some(({ row }) => rangeOf(row) !== null)
  const lensTitle = run.lenses?.find((l) => l.id === 'goal')?.title
  return (
    <section className="space-y-2" data-testid="analysis-chance-chart" aria-label={run.lead ?? undefined} onMouseLeave={() => ringFrom(RING, [])}>
      {run.lead == null ? null : <h3 className={`${typography.viewPanelHeading} m-0 text-text-header`} title={lensTitle} data-view="run.lead">{run.lead}</h3>}
      <ul className="m-0 list-none space-y-1 p-0">
        {rows.map(({ card, row, i }) => {
          const range = rangeOf(row)
          return (
            <li key={card.id} data-chart-option={card.id}>
              <button type="button" onClick={() => pressCard(card.id)} onMouseEnter={() => ringFrom(RING, [card.id])} onFocus={() => ringFrom(RING, [card.id])} onBlur={() => ringFrom(RING, [])}
                title={row.title} className="-mx-1 block w-[calc(100%+0.5rem)] rounded-sm px-1 py-1 text-left hover:bg-panel-hover">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`${TYPE.body} min-w-0 text-text-header`} data-view={`${card.id}.heading`}>{card.heading}</span>
                  <span className={`${TYPE.meta} flex shrink-0 gap-1 text-text-light`}>
                    {row.likely == null ? null : <span className="text-text-header" title={row.likely.title} aria-label={row.likely.title} data-view={`${card.id}.rows.${i}.likely.glyph`}>{row.likely.glyph}</span>}
                    {row.olumi == null ? null : <span className="text-info" title={row.olumi.title} aria-label={row.olumi.title} data-view={`${card.id}.rows.${i}.olumi.glyph`}>{row.olumi.glyph}</span>}
                  </span>
                </span>
                <span className="mt-1 block px-1"><ChanceTrack chance={row.chance!} range={range} /></span>
                <span className={`${TYPE.meta} mt-0.5 block text-text-body`} data-view={`${card.id}.rows.${i}.value`}>{row.value}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className={`${TYPE.meta} flex justify-between px-1 tabular-nums text-text-light`} aria-hidden="true" data-testid="analysis-chart-axis">
        {CHART_WORDS.axis.map((a) => <span key={a}>{a}</span>)}
      </div>
      {!ranged ? null : (
        <p className={`${TYPE.meta} m-0 flex items-center gap-2 px-1 text-text-light`} title={run.sensitivity?.title} data-testid="analysis-chart-key">
          <svg className="h-2.5 w-2.5" aria-hidden="true"><circle cx="50%" cy="50%" r="3" strokeWidth="1" className="fill-panel stroke-text-body" /></svg>{CHART_WORDS.low}
          <svg className="h-2.5 w-2.5" aria-hidden="true"><circle cx="50%" cy="50%" r="3" className="fill-text-body" /></svg>{CHART_WORDS.high}
        </p>
      )}
    </section>
  )
}
