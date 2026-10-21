/**
 * Each option's chance of meeting the goal, earlier run → this run, as one "shift row" per option (Paul, 20 Oct 2026).
 *
 * The Reasoning tab's own figure language, so the comparison reads as part of the same product: the range figure's
 * hairline track, its 11px option marker (`FIGURE_MARKER_CLASS`) and its option-tinted band. Hollow = earlier run,
 * filled = this run; the stretch between them is a soft option-tinted segment, and on first paint this run's marker
 * travels from where the earlier run left it (one authored moment; none under reduced motion). A range is always a band,
 * never a point. One plot grid (quarter lines) runs behind every row, with one axis under them.
 *
 * Draws ONLY what `pairChanceFigures` (runView.ts, the chance gate) returns: its words and where each mark sits. It
 * computes no difference, ranks nothing and names no leader of its own (CEE's goal-chance leader's name is the darker
 * text). Its caption is CEE's served `chance_words` or none. Type is the panel scale only (DS v5 §2.2): `panelBody` names,
 * `panelTabular` figures, `panelMeta` notes and axis.
 */
import { useEffect, useState } from 'react'
import { typography } from '../../styles/typography'
import { FIGURE_BAND_HEIGHT, FIGURE_MARKER_CLASS, FIGURE_RADIUS, markerLeft } from '../../components/results/analysisNew/PanelFigure'
import type { PairChanceFigures, PairChanceSide } from '../runView/runView'

export const PAIR_CHANCE_SLOPE_TESTID = 'compare-pair-chance-slope'

const QUARTERS = [25, 50, 75] as const
const clamp = (n: number): number => Math.min(100, Math.max(0, n))
const at = (side: PairChanceSide): number => clamp(side.kind === 'point' ? side.scaleAt : (side.scaleLow + side.scaleHigh) / 2)
const MOVE = 'transition-[left,width] duration-700 ease-out motion-reduce:transition-none'

/** True one frame after mount: this run's marks then move from the earlier run's place to their own. */
function useArrived(): boolean {
  const [arrived, setArrived] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setArrived(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return arrived
}

function Band({ side, earlier }: { side: PairChanceSide & { kind: 'range' }; earlier: boolean }): JSX.Element {
  const low = clamp(side.scaleLow)
  const width = Math.max(clamp(side.scaleHigh) - low, 0)
  return (
    <span className={`absolute top-1/2 -translate-y-1/2 ${FIGURE_BAND_HEIGHT} ${FIGURE_RADIUS} bg-panel`}
      style={{ left: `${low}%`, width: `max(${width}%, 2px)` }} data-mark={earlier ? 'earlier' : 'now'}>
      <span className={`absolute inset-0 ${FIGURE_RADIUS} ${earlier ? 'ring-1 ring-inset ring-option/70' : 'bg-option/40 ring-1 ring-inset ring-option/70'}`} />
    </span>
  )
}

/**
 * One option's two marks on a 0–100% track. Shared by the Compare chart and Reasoning's one-glance receipt, so both draw
 * the same pair the same way. `grid` draws the quarter lines inside the track (the receipt's mini track has no plot grid).
 */
export function PairChanceTrack({ earlier, now, grid = false }: {
  earlier: PairChanceSide | null; now: PairChanceSide | null; grid?: boolean
}): JSX.Element {
  const arrived = useArrived()
  const from = earlier ? at(earlier) : null
  const to = now ? at(now) : null
  const travels = earlier?.kind === 'point' && now?.kind === 'point'
  const shownTo = travels && !arrived ? from! : to
  return (
    <span className="relative block h-[11px] w-full" aria-hidden="true">
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-panel-border" />
      {grid ? QUARTERS.map(q => <span key={q} className="absolute top-0 h-full w-px bg-panel-border/50" style={{ left: `${q}%` }} />) : null}
      {from !== null && shownTo !== null
        ? <span className={`absolute top-1/2 h-[5px] -translate-y-1/2 ${FIGURE_RADIUS} bg-option/25 ${MOVE}`}
            style={{ left: `${Math.min(from, shownTo)}%`, width: `${Math.abs(shownTo - from)}%` }} />
        : null}
      {earlier?.kind === 'range' ? <Band side={earlier} earlier /> : null}
      {earlier?.kind === 'point'
        ? <span className="absolute top-1/2 -translate-y-1/2 w-[11px] h-[11px] rounded-full bg-panel border-2 border-option/70"
            style={{ left: markerLeft(clamp(earlier.scaleAt) / 100) }} data-mark="earlier" />
        : null}
      {now?.kind === 'range' ? <Band side={now} earlier={false} /> : null}
      {now?.kind === 'point'
        ? <span className={`${FIGURE_MARKER_CLASS} ${MOVE}`} style={{ left: markerLeft((shownTo ?? 0) / 100) }} data-mark="now" />
        : null}
    </span>
  )
}

export function PairChanceSlope({ figures }: { figures: PairChanceFigures }): JSX.Element | null {
  const { rows, claim, chanceWords } = figures
  const strongId = claim?.optionId ?? null
  if (rows.length === 0) return null
  const name = (label: string | null): string => label ?? 'An option'
  return (
    <figure className="m-0 mt-4" data-testid={PAIR_CHANCE_SLOPE_TESTID}>
      {/* CEE's own words for what the chance is OF, or no caption (DL, 21 Oct 2026: never a UI label beside a chance). */}
      {chanceWords !== null
        ? <figcaption className={`${typography.panelMeta} text-text-light mb-2 first-letter:uppercase`} data-wire-fields="canonical_analysis_view.goal_chance.chance_words">{chanceWords}</figcaption>
        : null}
      <div className="relative">
        <ul className="list-none p-0 m-0 space-y-1">
          {rows.map(row => {
            const strong = row.optionId === strongId
            if (row.note !== undefined && row.earlier === null && row.now === null) {
              // CEE's own words for an option with no figure: a name and its line, no track (never a mark at 0%).
              return (
                <li key={row.optionId} data-option-id={row.optionId} data-chance-note="true" className="-mx-2 px-2 py-2 rounded-md">
                  <span className={`${typography.panelBody} text-text-body block min-w-0`}>{name(row.label)}</span>
                  <p className={`${typography.panelMeta} text-text-light m-0`}>{row.note}</p>
                </li>
              )
            }
            return (
              <li key={row.optionId} data-option-id={row.optionId} data-goal-chance-leader={strong ? 'true' : undefined}
                className="-mx-2 px-2 py-2 rounded-md transition-colors hover:bg-option-light">
                <span className="sr-only">{`${name(row.label)}: earlier run ${row.earlier?.words ?? 'not shown'}, this run ${row.now?.words ?? 'not shown'}`}</span>
                <div aria-hidden="true">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className={`${typography.panelBody} ${strong ? 'text-text-header' : 'text-text-body'} min-w-0`}>{name(row.label)}</span>
                    <span className={`${typography.panelTabular} text-text-header ml-auto`}>{row.now?.words ?? 'not shown this run'}</span>
                  </div>
                  <p className={`${typography.panelMeta} text-text-light m-0`}>
                    {row.earlier ? `from ${row.earlier.words} on the earlier run` : 'not shown on the earlier run'}
                  </p>
                  <div className="mt-2">
                    <PairChanceTrack earlier={row.earlier} now={row.now} grid />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
      <div className={`${typography.panelMeta} text-text-light relative h-4 mt-1`} aria-hidden="true">
        {[0, ...QUARTERS, 100].map((t, i, all) => (
          <span key={t} data-chart-role="axis-tick" className={`absolute top-0 ${i === 0 ? '' : i === all.length - 1 ? '-translate-x-full' : '-translate-x-1/2'}`} style={{ left: `${t}%` }}>{t}%</span>
        ))}
      </div>
      <p className={`${typography.panelMeta} text-text-light mt-2 mb-0 flex flex-wrap items-center gap-x-3 gap-y-1`} aria-hidden="true">
        <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-panel border-2 border-option/70" />Earlier run</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-option" />This run</span>
        <span className="inline-flex items-center gap-1"><span className={`inline-block w-4 ${FIGURE_BAND_HEIGHT} ${FIGURE_RADIUS} bg-option/40 ring-1 ring-inset ring-option/70`} />Range</span>
      </p>
    </figure>
  )
}
