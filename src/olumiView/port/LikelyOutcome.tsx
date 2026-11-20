/**
 * The Analysis tab's second picture: what is LIKELY TO HAPPEN under each option (core's "outcome" lens, `rows[].outcome`), under the chance
 * chart. The chance says how often an option meets the aim; this says where the aim's own measure is likely to land, so a near miss and a
 * wide miss no longer look the same. Restored after the 18 Nov redesign dropped the old tab's outcome bars (Paul: "what is most likely to
 * happen" is part of what option analysis is for).
 * - the heading is core's lens label (`run.lenses` id `outcome`), its title on hover; a View with outcomes but no lens gets the tab's chrome;
 * - per aim with an outcome, every option in core's card order: its heading, a bar from its low to its high on that aim's one axis with a
 *   tick at the middle (`outcomePlace`), and core's own line under it (`outcome.text`, its `title` on hover). The numbers only place marks;
 * - a press on an option selects and centres its card, as the chance chart does.
 * Geometry is in SVG attributes (percent of the track), colour in classes: no inline style.
 */
import type { ViewModel } from '../client'
import { outcomePlace } from '../layout'
import { pressCard, ringFrom } from '../reasoning/tabRing'
import { chartGroupsOf, type ChartRow } from './pick'
import { TYPE } from './type'
import { Hov } from './Hover'
import { typography } from '../../styles/typography'

const RING = 'analysis-outcome'
/** The tab's own chrome, used only when core sends no outcome lens to name the section. */
export const OUTCOME_WORDS = { heading: 'Likely outcome' } as const
type Outcome = NonNullable<ChartRow['row']['outcome']>
const outcomeOf = (r: ChartRow): Outcome | null => r.row.outcome ?? null

/** One option's likely range on its aim's axis: a band from low to high and a tick at the middle; one value is a single mark. */
export function OutcomeTrack({ left, width, mid }: { left: number; width: number; mid: number | null }) {
  const point = width < 0.5
  return (
    <svg className="block h-3 w-full overflow-visible" aria-hidden="true" data-testid="analysis-outcome-track">
      <rect x="0" y="4" width="100%" height="2" rx="1" className="fill-panel-border" />
      {point
        ? <circle cx={`${left}%`} cy="5" r="3" className="fill-text-body" data-outcome-point={left} />
        : <rect x={`${left}%`} y="1" width={`${width}%`} height="8" rx="4" className="fill-option" data-outcome-band={`${left}:${left + width}`} />}
      {point || mid === null ? null : <line x1={`${mid}%`} x2={`${mid}%`} y1="0" y2="10" strokeWidth="1.5" className="stroke-text-header" data-outcome-mid={mid} />}
    </svg>
  )
}

export function LikelyOutcome({ model }: { model: ViewModel }) {
  const run = model.run ?? null
  const li = run?.lenses?.findIndex((l) => l.id === 'outcome') ?? -1
  const lens = li < 0 ? null : run!.lenses![li]!
  const groups = chartGroupsOf(model).map((g) => ({ ...g, rows: g.rows.filter((r) => outcomeOf(r) !== null) })).filter((g) => g.rows.length > 0)
  if (run === null || groups.length === 0) return null
  const label = lens?.label ?? OUTCOME_WORDS.heading
  return (
    <section className="space-y-3" data-testid="analysis-likely-outcome" aria-label={label} onMouseLeave={() => ringFrom(RING, [])}>
      {lens === null
        ? <h3 className={`${typography.viewPanelHeading} m-0 text-text-header`}>{label}</h3>
        : <Hov as="h3" words={lens.title} className={`${typography.viewPanelHeading} m-0 text-text-header`} data-view={`run.lenses.${li}.label`}>{label}</Hov>}
      {groups.map((g) => (
        <div key={g.aimId} className="space-y-1" data-outcome-aim={g.aimId}>
          {groups.length > 1 ? <p className={`${TYPE.meta} m-0 text-text-light`} data-view={g.aim.at}>{g.aim.text}</p> : null}
          <ul className="m-0 list-none space-y-1 p-0">
            {g.rows.map((r) => {
              const o = outcomeOf(r)!, place = outcomePlace(model, g.aimId, o)
              return (
                <li key={r.card.id} data-outcome-option={r.card.id}>
                  <Hov as="button" type="button" words={o.title} onClick={() => pressCard(r.card.id)} onMouseEnter={() => ringFrom(RING, [r.card.id])} onFocus={() => ringFrom(RING, [r.card.id])} onBlur={() => ringFrom(RING, [])}
                    className="-mx-1 block w-[calc(100%+0.5rem)] rounded-sm px-1 py-1 text-left hover:bg-panel-hover">
                    <span className={`${TYPE.body} block min-w-0 text-text-header`} data-view={`${r.card.id}.heading`}>{r.card.heading}</span>
                    <span className="mt-1 block px-1"><OutcomeTrack {...place} /></span>
                    <span className={`${TYPE.meta} mt-0.5 block tabular-nums text-text-body`} data-view={`${r.card.id}.rows.${r.i}.outcome.text`}>{o.text}</span>
                  </Hov>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}
