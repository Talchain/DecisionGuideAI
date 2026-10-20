/**
 * Each option's chance of meeting the goal, earlier run → this run, as one "shift row" per option (Paul, 20 Oct 2026).
 *
 * The Reasoning tab's own figure language, so the comparison reads as part of the same panel: the range figure's hairline
 * track, its 11px option marker (`FIGURE_MARKER_CLASS`) and its option-tinted band. Hollow = earlier run, filled = this
 * run, joined by a neutral connector; a range is drawn as a band, never as a point. One shared 0–100% axis under the rows.
 *
 * Draws ONLY what `pairChanceFigures` (runView.ts, the chance gate) returns: its words and where each mark sits. It
 * computes no difference, ranks nothing and names no leader of its own (CEE's goal-chance leader's name is the darker
 * text). Type is the panel scale only (DS v5 §2.2): `panelBody` names, `panelTabular` figures, `panelMeta` axis and key.
 */
import { ArrowRight } from 'lucide-react'
import { typography } from '../../styles/typography'
import { FIGURE_BAND_HEIGHT, FIGURE_MARKER_CLASS, FIGURE_RADIUS, markerLeft } from '../../components/results/analysisNew/PanelFigure'
import { icon } from '../../components/results/analysisNew/panelSurfaces'
import type { PairChanceFigures, PairChanceSide } from '../runView/runView'

export const PAIR_CHANCE_SLOPE_TESTID = 'compare-pair-chance-slope'

const TICKS = [0, 25, 50, 75, 100] as const
const clamp = (n: number): number => Math.min(100, Math.max(0, n))
const at = (side: PairChanceSide): number => clamp(side.kind === 'point' ? side.scaleAt : (side.scaleLow + side.scaleHigh) / 2)

/** The earlier run's mark: a hollow marker, or a ghost band (outline only). This run's: the filled marker, or the tinted band. */
function Mark({ side, earlier }: { side: PairChanceSide; earlier: boolean }): JSX.Element {
  if (side.kind === 'range') {
    const low = clamp(side.scaleLow)
    const width = Math.max(clamp(side.scaleHigh) - low, 0)
    const tint = earlier ? 'ring-1 ring-inset ring-option/70' : 'bg-option/40 ring-1 ring-inset ring-option/70'
    return (
      <span className={`absolute top-1/2 -translate-y-1/2 ${FIGURE_BAND_HEIGHT} ${FIGURE_RADIUS} bg-panel`}
        style={{ left: `${low}%`, width: `max(${width}%, 2px)` }} data-mark={earlier ? 'earlier' : 'now'}>
        <span className={`absolute inset-0 ${FIGURE_RADIUS} ${tint}`} />
      </span>
    )
  }
  const left = markerLeft(clamp(side.scaleAt) / 100)
  return earlier
    ? <span className="absolute top-1/2 -translate-y-1/2 w-[11px] h-[11px] rounded-full bg-panel border-2 border-option/70" style={{ left }} data-mark="earlier" />
    : <span className={FIGURE_MARKER_CLASS} style={{ left }} data-mark="now" />
}

function Track({ earlier, now }: { earlier: PairChanceSide | null; now: PairChanceSide | null }): JSX.Element {
  const from = earlier ? at(earlier) : null
  const to = now ? at(now) : null
  return (
    <span className="relative block h-[11px] w-full mt-2" aria-hidden="true">
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-panel-border" />
      {TICKS.slice(1, -1).map(t => <span key={t} className="absolute top-0 h-full w-px bg-panel-border/50" style={{ left: `${t}%` }} />)}
      {from !== null && to !== null && from !== to
        ? <span className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-option/40" style={{ left: `${Math.min(from, to)}%`, width: `${Math.abs(to - from)}%` }} />
        : null}
      {earlier ? <Mark side={earlier} earlier /> : null}
      {now ? <Mark side={now} earlier={false} /> : null}
    </span>
  )
}

export function PairChanceSlope({ figures }: { figures: PairChanceFigures }): JSX.Element | null {
  const { rows, claim } = figures
  const strongId = claim !== null && 'optionId' in claim ? claim.optionId : null
  if (rows.length === 0) return null
  const name = (label: string | null): string => label ?? 'An option'
  return (
    <figure className="m-0 mt-3" data-testid={PAIR_CHANCE_SLOPE_TESTID}>
      <figcaption className={`${typography.panelMeta} text-text-light mb-2`}>Chance of meeting your goal, in this model</figcaption>
      <ul className="list-none p-0 m-0 space-y-3">
        {rows.map(row => {
          const strong = row.optionId === strongId
          return (
            <li key={row.optionId} data-option-id={row.optionId} data-goal-chance-leader={strong ? 'true' : undefined}>
              <span className="sr-only">{`${name(row.label)}: earlier run ${row.earlier?.words ?? 'not shown'}, this run ${row.now?.words ?? 'not shown'}`}</span>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3" aria-hidden="true">
                <span className={`${typography.panelBody} ${strong ? 'text-text-header' : 'text-text-body'} min-w-0`}>{name(row.label)}</span>
                <span className={`${typography.panelTabular} text-text-light ml-auto inline-flex items-center gap-1`}>
                  {row.earlier?.words ?? 'not shown'}
                  <ArrowRight className={`${icon('inline')} flex-shrink-0`} aria-hidden="true" />
                  <span className="text-text-header">{row.now?.words ?? 'not shown'}</span>
                </span>
              </div>
              <Track earlier={row.earlier} now={row.now} />
            </li>
          )
        })}
      </ul>
      <div className={`${typography.panelMeta} text-text-light relative h-4 mt-1`} aria-hidden="true">
        {TICKS.map((t, i) => (
          <span key={t} className={`absolute top-0 ${i === 0 ? '' : i === TICKS.length - 1 ? '-translate-x-full' : '-translate-x-1/2'}`} style={{ left: `${t}%` }}>{t}%</span>
        ))}
      </div>
      <p className={`${typography.panelMeta} text-text-light mt-1 mb-0 flex flex-wrap items-center gap-x-3 gap-y-1`} aria-hidden="true">
        <span className="inline-flex items-center gap-1"><span className="inline-block w-[9px] h-[9px] rounded-full bg-panel border-2 border-option/70" />Earlier run</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-[9px] h-[9px] rounded-full bg-option" />This run</span>
        <span className="inline-flex items-center gap-1"><span className={`inline-block w-4 ${FIGURE_BAND_HEIGHT} ${FIGURE_RADIUS} bg-option/40 ring-1 ring-inset ring-option/70`} />Range</span>
      </p>
    </figure>
  )
}
