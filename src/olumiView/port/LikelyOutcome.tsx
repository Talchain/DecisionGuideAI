/**
 * The Analysis tab's second picture: what is LIKELY TO HAPPEN under each option (core's "outcome" lens, `rows[].outcome`), under the chance
 * chart. The chance says how often an option meets the aim; this says where the aim's own measure is likely to land, so a near miss and a
 * wide miss no longer look the same. Restored after the 18 Nov redesign dropped the old tab's outcome bars (Paul: "what is most likely to
 * happen" is part of what option analysis is for).
 * - the heading is core's lens label (`run.lenses` id `outcome`), its title on hover; a View with outcomes but no lens gets the tab's chrome;
 * - per aim with an outcome, every option in core's card order: its heading, a bar from its low to its high on that aim's one axis with a
 *   tick at the middle (`outcomePlace`), and Core’s own line beside it (`outcome.text`, its `title` on hover). The numbers only place marks;
 * - a press on an option selects and centres its card, as the chance chart does.
 * Geometry is in SVG attributes (percent of the track), colour in classes: no inline style.
 */
import type { ViewModel } from '../client'
import { outcomePlace } from '../layout'
import { ringFrom } from '../reasoning/tabRing'
import type { ChartGroup, ChartRow } from './pick'
import { OptionBand } from '../v12/scale/OptionBand'
import { OptionRow, RESULT_ROW_GRID } from './OptionRow'
import { TYPE } from './type'
import { Hover } from '../look/Hover'
import { typography } from '../../styles/typography'

const RING = 'analysis-outcome'
/** The tab's own chrome, used only when core sends no outcome lens to name the section. */
export const OUTCOME_WORDS = { heading: 'Likely outcome' } as const
type Outcome = NonNullable<ChartRow['row']['outcome']>
const outcomeOf = (r: ChartRow): Outcome | null => r.row.outcome ?? null

export function LikelyOutcome({ model, group }: { model: ViewModel; group: ChartGroup }) {
  const run = model.run ?? null
  const li = run?.lenses?.findIndex((l) => l.id === 'outcome') ?? -1
  const lens = li < 0 ? null : run!.lenses![li]!
  const rows = group.rows.filter((r) => outcomeOf(r) !== null)
  if (run === null || rows.length === 0) return null
  const label = lens?.label ?? OUTCOME_WORDS.heading
  return (
    <section className="space-y-3" data-testid="analysis-likely-outcome" aria-label={label} onMouseLeave={() => ringFrom(RING, [])}>
      {lens === null
        ? <h3 className={`${typography.viewPanelHeading} m-0 text-text-header`}>{label}</h3>
        : <Hover as="h3" words={lens.title} wordsAt={`run.lenses.${li}.title`} className={`${typography.viewPanelHeading} m-0 text-text-header`} data-view={`run.lenses.${li}.label`}>{label}</Hover>}
      <div className="space-y-1" data-outcome-aim={group.aimId}>
        <ul className="m-0 list-none space-y-1 p-0">
          {rows.map((r) => {
            const o = outcomeOf(r)!, place = outcomePlace(model, group.aimId, o)
            return (
              <li key={r.card.id} data-outcome-option={r.card.id}>
                <OptionRow id={r.card.id} ring={RING} words={o.title} wordsAt={`${r.card.id}.rows.${r.i}.outcome.title`}
                  className={`${RESULT_ROW_GRID} items-center`}>
                  <span className={`${TYPE.body} block min-w-0 text-text-header`} data-view={`${r.card.id}.heading`}>{r.card.heading}</span>
                  <span className="min-w-0"><OptionBand {...place} /></span>
                  <span className={`${TYPE.meta} mt-0.5 block tabular-nums text-text-body`} data-view={`${r.card.id}.rows.${r.i}.outcome.text`}>{o.text}</span>
                </OptionRow>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
