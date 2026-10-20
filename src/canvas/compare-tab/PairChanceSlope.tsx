/**
 * Each option's chance of meeting the goal, earlier run → this run, as one line per option (Paul, 20 Oct 2026).
 *
 * Draws ONLY what `pairChanceFigures` (runView.ts, the chance gate) returns: the words to say and where each marker sits
 * on the 0–100 track. It computes no difference, ranks nothing and names no leader of its own: the darker line is the
 * option CEE's goal-chance licence names as having the highest chance this run (`claim`), or none. Never the comparative
 * leader (the most runs supported), which is not a chance. Hollow marker = earlier run, filled = this run
 * (FIGURE_MARKER_W). A line joins two point figures only; a range shows as its span.
 */
import { typography } from '../../styles/typography'
import { FIGURE_MARKER_W } from '../../components/results/analysisNew/PanelFigure'
import type { PairChanceFigures, PairChanceSide } from '../runView/runView'

export const PAIR_CHANCE_SLOPE_TESTID = 'compare-pair-chance-slope'

const W = 280
const LEFT = 92
const RIGHT = 188
const TOP = 26
const TRACK = 120
const R = FIGURE_MARKER_W / 2
const y = (scale: number): number => TOP + TRACK - (Math.min(100, Math.max(0, scale)) / 100) * TRACK
const mid = (side: PairChanceSide): number => (side.kind === 'point' ? side.scaleAt : (side.scaleLow + side.scaleHigh) / 2)

function Marker({ x, side, filled, strong }: { x: number; side: PairChanceSide; filled: boolean; strong: boolean }): JSX.Element {
  const width = strong ? 2 : 1.5
  if (side.kind === 'range') {
    return <line x1={x} x2={x} y1={y(side.scaleHigh)} y2={y(side.scaleLow)} stroke="currentColor" strokeWidth={4} strokeLinecap="round" />
  }
  return <circle cx={x} cy={y(side.scaleAt)} r={R} strokeWidth={width} stroke="currentColor"
    className={filled ? 'fill-current' : 'fill-panel'} />
}

export function PairChanceSlope({ figures }: { figures: PairChanceFigures }): JSX.Element | null {
  const { rows, claim } = figures
  const strongId = claim !== null && 'optionId' in claim ? claim.optionId : null
  if (rows.length === 0) return null
  const height = TOP + TRACK + 10
  const name = (label: string | null): string => label ?? 'An option'
  // Short point figures sit beside their markers; names and every full wording (ranges included) are in the list below,
  // which wraps at any panel width (a 360px panel clipped in-chart labels on 20 Oct).
  // A figure label is drawn only where it clears every label already drawn in its column (the list says them all).
  const placed: Record<'l' | 'r', number[]> = { l: [], r: [] }
  const short = (side: PairChanceSide | null, col: 'l' | 'r'): string | null => {
    if (side?.kind !== 'point') return null
    const at = y(side.scaleAt)
    if (placed[col].some(p => Math.abs(p - at) < 12)) return null
    placed[col].push(at)
    return side.words
  }
  return (
    <figure className="m-0 mt-3" data-testid={PAIR_CHANCE_SLOPE_TESTID}>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" aria-hidden="true" className={`${typography.panelMeta} block max-w-[320px]`}>
        <text x={LEFT} y={12} textAnchor="middle" className="fill-current text-text-light">Earlier run</text>
        <text x={RIGHT} y={12} textAnchor="middle" className="fill-current text-text-light">This run</text>
        <line x1={LEFT} x2={LEFT} y1={TOP - 6} y2={TOP + TRACK + 6} stroke="currentColor" className="text-panel-border" />
        <line x1={RIGHT} x2={RIGHT} y1={TOP - 6} y2={TOP + TRACK + 6} stroke="currentColor" className="text-panel-border" />
        {rows.map((row) => {
          const strong = row.optionId === strongId
          const joined = row.earlier?.kind === 'point' && row.now?.kind === 'point'
          return (
            <g key={row.optionId} className={strong ? 'text-text-header' : 'text-text-light'} data-option-id={row.optionId} data-goal-chance-leader={strong ? 'true' : undefined}>
              {joined ? <line x1={LEFT} y1={y(mid(row.earlier!))} x2={RIGHT} y2={y(mid(row.now!))} stroke="currentColor" strokeWidth={strong ? 2.5 : 1.5} /> : null}
              {row.earlier ? <Marker x={LEFT} side={row.earlier} filled={false} strong={strong} /> : null}
              {row.now ? <Marker x={RIGHT} side={row.now} filled strong={strong} /> : null}
              {(() => { const t = short(row.earlier, 'l'); return t ? <text x={LEFT - 10} y={y(mid(row.earlier!)) + 4} textAnchor="end" className="fill-current">{t}</text> : null })()}
              {(() => { const t = short(row.now, 'r'); return t ? <text x={RIGHT + 10} y={y(mid(row.now!)) + 4} className="fill-current">{t}</text> : null })()}
            </g>
          )
        })}
      </svg>
      <ul className={`${typography.panelBody} text-text-body list-none p-0 m-0 mt-1 space-y-1`}>
        {rows.map(row => (
          <li key={row.optionId} data-option-id={row.optionId}>
            <span className={row.optionId === strongId ? 'font-medium text-text-header' : ''}>{name(row.label)}</span>
            <span className="text-text-light">{`: earlier run ${row.earlier?.words ?? 'not shown'}, this run ${row.now?.words ?? 'not shown'}`}</span>
          </li>
        ))}
      </ul>
      <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`}>Chance of meeting your goal, in this model</p>
    </figure>
  )
}
