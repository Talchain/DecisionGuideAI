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

const W = 360
const LEFT = 84
const RIGHT = 176
const TOP = 28
const TRACK = 136
const LABEL_GAP = 15
const R = FIGURE_MARKER_W / 2
const y = (scale: number): number => TOP + TRACK - (Math.min(100, Math.max(0, scale)) / 100) * TRACK
const mid = (side: PairChanceSide): number => (side.kind === 'point' ? side.scaleAt : (side.scaleLow + side.scaleHigh) / 2)
const shorten = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** Label rows top to bottom, each at least LABEL_GAP below the last; markers stay where their figures put them. */
function labelYs(sides: readonly (PairChanceSide | null)[]): (number | null)[] {
  const order = sides.map((s, i) => ({ i, at: s === null ? null : y(mid(s)) }))
    .filter((o): o is { i: number; at: number } => o.at !== null).sort((a, b) => a.at - b.at)
  const out: (number | null)[] = sides.map(() => null)
  let last = -Infinity
  for (const o of order) { last = Math.max(o.at, last + LABEL_GAP); out[o.i] = last }
  return out
}

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
  const height = TOP + TRACK + 14
  const leftYs = labelYs(rows.map(r => r.earlier))
  const rightYs = labelYs(rows.map(r => r.now))
  const name = (label: string | null): string => label ?? 'An option'
  return (
    <figure className="m-0 mt-3" data-testid={PAIR_CHANCE_SLOPE_TESTID}>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" aria-hidden="true" className={`${typography.panelTabular} block`}>
        <text x={LEFT} y={14} textAnchor="middle" className="fill-current text-text-light">Earlier run</text>
        <text x={RIGHT} y={14} textAnchor="middle" className="fill-current text-text-light">This run</text>
        <line x1={LEFT} x2={LEFT} y1={TOP - 6} y2={TOP + TRACK + 6} stroke="currentColor" className="text-panel-border" />
        <line x1={RIGHT} x2={RIGHT} y1={TOP - 6} y2={TOP + TRACK + 6} stroke="currentColor" className="text-panel-border" />
        {rows.map((row, i) => {
          const strong = row.optionId === strongId
          const tone = strong ? 'text-text-header' : 'text-text-light'
          const joined = row.earlier?.kind === 'point' && row.now?.kind === 'point'
          return (
            <g key={row.optionId} className={tone} data-option-id={row.optionId} data-goal-chance-leader={strong ? 'true' : undefined}>
              {joined ? <line x1={LEFT} y1={y(mid(row.earlier!))} x2={RIGHT} y2={y(mid(row.now!))} stroke="currentColor" strokeWidth={strong ? 2.5 : 1.5} /> : null}
              {row.earlier ? <Marker x={LEFT} side={row.earlier} filled={false} strong={strong} /> : null}
              {row.now ? <Marker x={RIGHT} side={row.now} filled strong={strong} /> : null}
              {row.earlier && leftYs[i] !== null
                ? <text x={LEFT - 10} y={leftYs[i]! + 4} textAnchor="end" className="fill-current">{row.earlier.words}</text> : null}
              {row.now && rightYs[i] !== null
                ? <text x={RIGHT + 10} y={rightYs[i]! + 4} className={`fill-current ${strong ? 'font-medium' : ''}`}>
                    {`${row.now.words} ${shorten(name(row.label), 22)}`}
                  </text> : null}
              {!row.now && row.earlier && leftYs[i] !== null
                ? <text x={RIGHT + 10} y={leftYs[i]! + 4} className="fill-current">{`${shorten(name(row.label), 22)}: not shown this run`}</text> : null}
            </g>
          )
        })}
      </svg>
      <figcaption className="sr-only">
        <ul>
          {rows.map(row => (
            <li key={row.optionId}>
              {`${name(row.label)}: earlier run ${row.earlier?.words ?? 'not shown'}, this run ${row.now?.words ?? 'not shown'}.`}
            </li>
          ))}
        </ul>
      </figcaption>
      <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`}>Chance of meeting your goal, in this model</p>
    </figure>
  )
}
