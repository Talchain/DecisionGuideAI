/**
 * ⭐ THE DRAFTING MARK (Paul, 7 Oct 2026: "The layout looks terrible… How can you really enhance it so it looks
 * premium?"): a small model that draws itself from Olumi's own node shapes while a first brief is drafted.
 *
 * - Decision (hexagon) → two options (squares) → factors (circles) and a risk (triangle) → the goal (diamond), the
 *   same shapes and colour tokens as `NodeShapeIndicator`, so the wait previews the canvas the user is about to get.
 * - It is decoration, not information: it claims no stage, count or progress (the honesty bar on
 *   `DraftLoadingAnimation`). The loop runs on a fixed clock and is the same for every brief.
 * - Reduced motion: drawn once, fully assembled, no loop.
 *
 * ⭐ YOUR OWN MODEL, ONCE THE BRIEF IS READ (Paul, 21 Oct 2026: "have the animation draw my own goal and options once
 * BRIEF_READ arrives"). With `brief`, the loop stops and the mark draws what CEE read from the user's words:
 * - one square per option, numbered as the brief's option pills are (unnumbered when the user's own Options field was
 *   sent, whose count is unknown), each carrying the user's words as its tooltip;
 * - the goal diamond, carrying the goal's words; dashed when the brief states no goal;
 * - the factors as dashed placeholders that pulse while the model is built. They claim no count or content: the
 *   client knows neither until GRAPH_READY.
 * With `ready` (the model has landed), the placeholders fill in.
 */
import { memo } from 'react'

const CSS = `
.olumi-dm-edge { stroke: rgb(var(--border-emphasis-rgb, 221 212 196)); stroke-width: 1.4; fill: none; stroke-dasharray: 60; stroke-dashoffset: 60; animation: olumi-dm-draw 6s ease-in-out infinite; }
.olumi-dm-node { opacity: 0; transform-box: fill-box; transform-origin: center; animation: olumi-dm-pop 6s ease-out infinite; }
@keyframes olumi-dm-draw { 0%, 8% { stroke-dashoffset: 60; } 30%, 88% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 60; } }
@keyframes olumi-dm-pop { 0% { opacity: 0; transform: scale(.6); } 10%, 88% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(.9); } }
@media (prefers-reduced-motion: reduce) {
  .olumi-dm-edge { animation: none; stroke-dashoffset: 0; }
  .olumi-dm-node { animation: none; opacity: 1; }
}
`

const EDGES: ReadonlyArray<{ d: string; delay: number }> = [
  { d: 'M66 18 L36 44', delay: 0.2 },
  { d: 'M66 18 L96 44', delay: 0.3 },
  { d: 'M36 50 L24 72', delay: 0.7 },
  { d: 'M36 50 L66 72', delay: 0.8 },
  { d: 'M96 50 L108 72', delay: 0.9 },
  { d: 'M24 78 L58 98', delay: 1.1 },
  { d: 'M66 78 L66 94', delay: 1.2 },
  { d: 'M108 78 L74 98', delay: 1.3 },
]

export interface DraftingModelMarkProps {
  className?: string
  /** CEE's BRIEF_READ: the user's own goal and options. Null until it arrives. */
  brief?: { goal: string | null; options: string[] } | null
  /** Number the option squares (false when the user's own free-text Options field was sent). */
  numbered?: boolean
  /** The model has landed. */
  ready?: boolean
}

const BRIEF_CSS = `
.olumi-dm-in { opacity: 0; transform-box: fill-box; transform-origin: center; animation: olumi-dm-in .45s ease-out forwards; }
.olumi-dm-line { stroke: rgb(var(--border-emphasis-rgb, 221 212 196)); stroke-width: 1.4; fill: none; stroke-dasharray: 60; stroke-dashoffset: 60; animation: olumi-dm-line .6s ease-in-out forwards; }
.olumi-dm-todo { animation: olumi-dm-pulse 1.6s ease-in-out infinite; }
@keyframes olumi-dm-in { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: scale(1); } }
@keyframes olumi-dm-line { to { stroke-dashoffset: 0; } }
@keyframes olumi-dm-pulse { 0%, 100% { opacity: .35; } 50% { opacity: .9; } }
@media (prefers-reduced-motion: reduce) {
  .olumi-dm-in { animation: none; opacity: 1; }
  .olumi-dm-line { animation: none; stroke-dashoffset: 0; }
  .olumi-dm-todo { animation: none; opacity: .6; }
}
`

/** At most four option squares fit the mark; the brief's pills still list every option. */
const MAX_DRAWN_OPTIONS = 4
const FACTOR_X = [36, 66, 96] as const
const GOAL = { x: 66, y: 98 }

function optionXs(n: number): number[] {
  if (n <= 1) return [66]
  const step = 84 / (n - 1)
  return Array.from({ length: n }, (_, i) => 24 + i * step)
}

const YourModelMark = memo(function YourModelMark({ className, brief, numbered, ready }: Required<Omit<DraftingModelMarkProps, 'brief'>> & { brief: NonNullable<DraftingModelMarkProps['brief']> }) {
  const options = brief.options.slice(0, MAX_DRAWN_OPTIONS)
  const xs = optionXs(Math.max(options.length, 1))
  const hasGoal = brief.goal !== null
  return (
    <svg viewBox="0 0 132 112" aria-hidden="true" focusable="false" data-testid="first-use-drafting-mark" data-mark="brief" data-ready={ready} className={className}>
      <style>{BRIEF_CSS}</style>
      {xs.map((x) => (
        <path key={`d${x}`} className="olumi-dm-line" d={`M66 22 L${x} 42`} />
      ))}
      {xs.map((x, i) => (
        <path key={`f${x}`} className="olumi-dm-line" style={{ animationDelay: `${0.5 + i * 0.1}s` }} d={`M${x} 54 L${FACTOR_X[Math.min(i, 2)]} 70`} />
      ))}
      {FACTOR_X.map((x, i) => (
        <path key={`g${x}`} className="olumi-dm-line" style={{ animationDelay: `${0.9 + i * 0.1}s` }} d={`M${x} 80 L${GOAL.x} 92`} />
      ))}
      <polygon className="olumi-dm-in" points="66,9 74,13.5 74,22.5 66,27 58,22.5 58,13.5" fill="var(--info)" />
      {(options.length > 0 ? options : [null]).map((label, i) => {
        const x = xs[i]
        return (
          <g key={`o${i}`} className="olumi-dm-in" style={{ animationDelay: `${0.2 + i * 0.1}s` }} data-testid="drafting-mark-option">
            {label !== null ? <title>{label}</title> : null}
            <rect x={x - 7} y={40} width="14" height="14" rx="2" fill={label !== null ? 'var(--option)' : 'none'} stroke="var(--option)" strokeDasharray={label !== null ? undefined : '3 2'} />
            {label !== null && numbered ? (
              <text x={x} y={50.5} textAnchor="middle" fontSize="9" fontWeight="600" fill="var(--text-on-color, #fff)">{i + 1}</text>
            ) : null}
          </g>
        )
      })}
      {FACTOR_X.map((x) => (
        <circle
          key={`c${x}`}
          data-testid="drafting-mark-factor"
          className={ready ? 'olumi-dm-in' : 'olumi-dm-todo'}
          cx={x}
          cy="75"
          r="6"
          fill={ready ? 'var(--factor)' : 'none'}
          stroke="var(--factor)"
          strokeDasharray={ready ? undefined : '3 2'}
        />
      ))}
      <g className="olumi-dm-in" style={{ animationDelay: '0.4s' }} data-testid="drafting-mark-goal">
        {hasGoal ? <title>{brief.goal}</title> : null}
        <polygon points="66,90 74,98 66,106 58,98" fill={hasGoal ? 'var(--goal)' : 'none'} stroke="var(--goal)" strokeDasharray={hasGoal ? undefined : '3 2'} />
      </g>
    </svg>
  )
})

export const DraftingModelMark = memo(function DraftingModelMark({ className = '', brief = null, numbered = true, ready = false }: DraftingModelMarkProps) {
  if (brief) return <YourModelMark className={className} brief={brief} numbered={numbered} ready={ready} />
  return (
    <svg
      viewBox="0 0 132 112"
      aria-hidden="true"
      focusable="false"
      data-testid="first-use-drafting-mark"
      className={className}
    >
      <style>{CSS}</style>
      {EDGES.map((e) => (
        <path key={e.d} className="olumi-dm-edge" style={{ animationDelay: `${e.delay}s` }} d={e.d} />
      ))}
      <polygon className="olumi-dm-node" style={{ animationDelay: '0s' }} points="66,9 74,13.5 74,22.5 66,27 58,22.5 58,13.5" fill="var(--info)" />
      <rect className="olumi-dm-node" style={{ animationDelay: '0.35s' }} x="29" y="40" width="14" height="14" rx="2" fill="var(--option)" />
      <rect className="olumi-dm-node" style={{ animationDelay: '0.45s' }} x="89" y="40" width="14" height="14" rx="2" fill="var(--option)" />
      <circle className="olumi-dm-node" style={{ animationDelay: '0.9s' }} cx="24" cy="75" r="6.5" fill="var(--factor)" />
      <circle className="olumi-dm-node" style={{ animationDelay: '1s' }} cx="66" cy="75" r="6.5" fill="var(--factor)" />
      <polygon className="olumi-dm-node" style={{ animationDelay: '1.1s' }} points="101,69 115,69 108,81" fill="var(--danger)" />
      <polygon className="olumi-dm-node" style={{ animationDelay: '1.5s' }} points="66,90 74,98 66,106 58,98" fill="var(--goal)" />
    </svg>
  )
})
