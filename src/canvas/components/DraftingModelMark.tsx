/**
 * ⭐ THE DRAFTING MARK (Paul, 7 Oct 2026: "The layout looks terrible… How can you really enhance it so it looks
 * premium?"): a small model that draws itself from Olumi's own node shapes while a first brief is drafted.
 *
 * - Decision (hexagon) → two options (squares) → factors (circles) and a risk (triangle) → the goal (diamond), the
 *   same shapes and colour tokens as `NodeShapeIndicator`, so the wait previews the canvas the user is about to get.
 * - It is decoration, not information: it claims no stage, count or progress (the honesty bar on
 *   `DraftLoadingAnimation`). The loop runs on a fixed clock and is the same for every brief.
 * - Reduced motion: drawn once, fully assembled, no loop.
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

export const DraftingModelMark = memo(function DraftingModelMark({ className }: { className?: string }) {
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
