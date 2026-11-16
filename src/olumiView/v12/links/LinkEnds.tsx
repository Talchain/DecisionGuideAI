/** The small SVG pieces of a V12 link: the end of a line (arrowhead or filled dot), Olumi's mark on a line, the not-settled badge and a size wire's label. */
import { OlumiAiIcon } from '../../../components/results/analysisNew/OlumiAiIcon'
import { INPUT_GREY, type LineEnd } from './styles'

/** The marker for a line's end, or null for none. Referenced as `url(#id)`. */
export function EndMarker({ id, end, colour }: { id: string; end: LineEnd; colour: string }): JSX.Element | null {
  if (end === 'none') return null
  return end === 'arrow'
    ? <marker id={id} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" style={{ fill: colour }} /></marker>
    : <marker id={id} viewBox="0 0 8 8" refX="4" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2.5" style={{ fill: colour }} /></marker>
}

/** Olumi's mark (the board's circle, square and triangle) on the line of a link Olumi proposed: its author, in place of a dash. */
export function OlumiLineMark({ i, x, y, title }: { i: number; x: number; y: number; title?: string }): JSX.Element {
  return (
    <g data-view-link-olumi-mark={`links.${i}`} transform={`translate(${x - 6},${y - 6})`}>
      <title>{title ?? "Olumi's estimate"}</title>
      <rect x="-1" y="-1" width="14" height="14" rx="3" fill="var(--bg-canvas)" />
      <OlumiAiIcon size={12} strokeWidth={2.4} aria-label="Olumi's estimate" />
    </g>
  )
}

/** A size wire's word, set on the wire. */
export function SizeLabel({ i, x, y, text }: { i: number; x: number; y: number; text: string }): JSX.Element {
  return <text data-view-link-size-label={`links.${i}`} x={x} y={y - 4} textAnchor="middle" fontSize="12" style={{ fill: INPUT_GREY, paintOrder: 'stroke', stroke: 'var(--bg-canvas)', strokeWidth: 3 }}>{text}</text>
}
