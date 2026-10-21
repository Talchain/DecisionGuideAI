/**
 * ⭐ THE LINKS THE ENGINE LEAVES OUT FOR WANT OF A DIRECTION, DRAWN (directionNeeded.ts). A dashed line between the two
 * cards (dashed: the canvas's mark for an unconfirmed relationship) and, at its middle, "Direction needed · <whose>".
 * ⛔ Render-only, through `ViewportPortal` like ProposalGhostLayer: never in `nodes`/`edges`, so nothing can save, send,
 *   count, fit or select it; `pointer-events: none`. Text uses the counter-scaled canvas tokens only (census VIEWPORT_PORTALLED).
 */
import { memo, useMemo } from 'react'
import { ViewportPortal, useEdges, useNodes } from '@xyflow/react'
import { typography } from '../../styles/typography'
import { useSavedGraph } from './shared/savedGraph'
import { DIRECTION_NEEDED, directionNeededLinksOf } from './shared/directionNeeded'
import { otherAimSourceWords } from './shared/otherAims'

export const DIRECTION_NEEDED_TESTID = 'direction-needed-layer'
const REVERSE_OFFSET = 24

export const DirectionNeededLayer = memo(function DirectionNeededLayer() {
  const graph = useSavedGraph()
  const nodes = useNodes()
  const edges = useEdges()
  const lines = useMemo(() => {
    if (graph === null) return []
    const box = new Map(nodes.map((n) => [n.id, { x: n.position.x, y: n.position.y, w: n.measured?.width ?? n.width ?? 0, h: n.measured?.height ?? n.height ?? 0 }]))
    const links = directionNeededLinksOf(graph, new Set(box.keys()), new Set(edges.map((e) => `${e.source}->${e.target}`)))
    return links.map((l) => {
      const a = box.get(l.from)!
      const b = box.get(l.to)!
      // Bottom of the upper card to the top of the lower one (the canvas lays out top to bottom).
      const down = a.y <= b.y
      // Beside a drawn edge the other way round, offset so the two claims never sit on one line.
      const dx = l.besideReverse ? REVERSE_OFFSET : 0
      const x1 = a.x + a.w / 2 + dx, y1 = down ? a.y + a.h : a.y
      const x2 = b.x + b.w / 2 + dx, y2 = down ? b.y : b.y + b.h
      return { ...l, x1, y1, x2, y2, words: `${DIRECTION_NEEDED} · ${otherAimSourceWords(l)}` }
    })
  }, [graph, nodes, edges])
  if (lines.length === 0) return null
  return (
    <ViewportPortal>
      <div aria-hidden="true" data-testid={DIRECTION_NEEDED_TESTID} style={{ pointerEvents: 'none' }}>
        <svg className="absolute overflow-visible" style={{ left: 0, top: 0, pointerEvents: 'none' }} width={1} height={1}>
          {lines.map((l) => (
            <line key={l.id} data-testid={`direction-needed-line-${l.id}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              className="stroke-text-light" strokeWidth={1.5} strokeDasharray="6 4" />
          ))}
        </svg>
        {lines.map((l) => (
          <span key={l.id} data-testid={`direction-needed-mark-${l.id}`}
            className={`absolute rounded border border-panel-border bg-panel ${typography.edgeLabel} text-text-body`}
            style={{ left: (l.x1 + l.x2) / 2, top: (l.y1 + l.y2) / 2, transform: 'translate(-50%, -50%)', padding: '2px 8px', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
            {l.words}
          </span>
        ))}
      </div>
    </ViewportPortal>
  )
})
