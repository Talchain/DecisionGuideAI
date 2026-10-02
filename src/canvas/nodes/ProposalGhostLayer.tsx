/**
 * Suggestion preview: the GHOST of a proposed change, drawn on the canvas while the latest reply offers its consent
 * chip (DL ruling 5941839936; carrier proposalPreview.ts, bridge useProposalGhostBridge.ts, geometry
 * proposalGhostGeometry.ts).
 *
 * ⛔ Render-only, through `ViewportPortal` like `TierLanes`: it never enters `nodes`/`edges`, so nothing can save, send,
 *   count, fit, select or infer over it. `pointer-events: none` throughout: Accept stays on the consent chip.
 * ⛔ Styling (DS v5): a dashed or dotted border on the canvas MEANS confidence (§11.3), so a ghost never uses one. It is
 *   a translucent card with a solid 1px `border-info`, the kind's shape badge (§10, 14px) and a "Proposed" caption;
 *   lines are solid `stroke-info` at partial opacity. Text goes through the counter-scaled canvas tokens only
 *   (`canvasTextCounterScale.census.spec.ts` declares this file in VIEWPORT_PORTALLED).
 * ⛔ Words: a link's band in the PRODUCER's words (the consent card says "as moderate" too). A keep (`keeps: true`, the
 *   Yes only records the strength the link already has) is never drawn as a change: "Record as moderate", the consent
 *   card's own verb ("Record this link strength … as moderate"). An option's status uses the card's imported words
 *   (`OPTION_TAKEN_OUT_COPY`), never restated.
 */
import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ViewportPortal, useEdges, useNodes, useReactFlow, useStore } from '@xyflow/react'
import { typography } from '../../styles/typography'
import { useProposalGhostStore } from '../stores/proposalGhostStore'
import { GHOST_CARD_HEIGHT, proposalGhostGeometry, type GhostMeasures } from '../utils/proposalGhostGeometry'
import { OPTION_TAKEN_OUT_COPY } from '../domain/optionStatus'
import type { PreviewBand, PreviewOptionStatus } from '../conversation/proposalPreview'
import { NodeShapeIndicator } from './NodeShapeIndicator'
import { NodeTypeEnum } from '../domain/nodes'

export const PROPOSAL_GHOST_TESTID = 'proposal-ghost-layer'

/** A link mark's words: a change says "Proposed", a keep says what the Yes records. */
export function ghostBandText(b: { band: PreviewBand; keeps: boolean; reverses: boolean }): string {
  if (b.keeps && !b.reverses) return `Record as ${b.band}`
  return `Proposed: ${b.band}${b.reverses ? ', direction reversed' : ''}`
}

/** An option mark's words: the card's own words, verbatim, for taken out (they carry a colon, hence the dot). */
export function ghostStatusText(status: PreviewOptionStatus): string {
  return `Proposed · ${status === 'feasible' ? 'Back in the comparison' : OPTION_TAKEN_OUT_COPY[status]}`
}

/** Where along a real edge a band mark may sit, middle first (geometry takes the first that covers nothing). */
const BAND_ALONG = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.15, 0.85] as const
const measuresKey = (m: GhostMeasures) =>
  JSON.stringify([
    [...(m.heights ?? [])], [...(m.markSizes ?? [])], [...(m.bandPaths ?? [])], [...(m.bandEdgePaths ?? [])], m.obstacles ?? [],
  ])

export const ProposalGhostLayer = memo(function ProposalGhostLayer() {
  const ghost = useProposalGhostStore((s) => s.ghost)
  const nodes = useNodes()
  const edges = useEdges()
  const { screenToFlowPosition } = useReactFlow()
  // Measured, not guessed: a card's height and a band's size follow the counter-scaled text (so they change with the
  // zoom: re-render on zoom), and a band sits on the real edge's DRAWN path. Re-measure after every render; the values
  // depend on label, zoom and edge route only, so this settles in one pass.
  useStore((s) => s.transform[2])
  const layerRef = useRef<HTMLDivElement>(null)
  const [measures, setMeasures] = useState<GhostMeasures>({})
  const geo = useMemo(() => (ghost ? proposalGhostGeometry(ghost, nodes, measures) : null), [ghost, nodes, measures])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- after EVERY render by design; equal measures bail out
  useLayoutEffect(() => {
    const root = layerRef.current
    const heights = new Map<string, number>()
    const markSizes = new Map<string, { w: number; h: number }>()
    const bandPaths = new Map<string, Array<{ x: number; y: number }>>()
    const bandEdgePaths = new Map<string, string>()
    root?.querySelectorAll<HTMLElement>('[data-ghost-id]').forEach((el) => heights.set(el.dataset.ghostId!, el.offsetHeight))
    root?.querySelectorAll<HTMLElement>('[data-ghost-mark]').forEach((el) => {
      if (el.offsetWidth > 0) markSizes.set(el.dataset.ghostMark!, { w: el.offsetWidth, h: el.offsetHeight })
    })
    const flow = root?.closest('.react-flow')
    for (const op of ghost?.ops ?? []) {
      if ((op.op !== 'set_link_strength' && op.op !== 'update_edge') || !flow) continue
      const edge = edges.find((e) => e.source === op.fromId && e.target === op.toId)
      const path = edge
        ? flow.querySelector<SVGPathElement>(`.react-flow__edge[data-id="${CSS.escape(edge.id)}"] path.react-flow__edge-path`)
        : null
      const length = path && typeof path.getTotalLength === 'function' ? path.getTotalLength() : 0
      const d = path?.getAttribute('d')
      if (!path || !d || !(length > 0)) continue
      bandEdgePaths.set(`${op.fromId}->${op.toId}`, d)
      bandPaths.set(`${op.fromId}->${op.toId}`, BAND_ALONG.map((t) => {
        const q = path.getPointAtLength(length * t)
        return { x: Math.round(q.x), y: Math.round(q.y) }
      }))
    }
    // The edges' own labels (sign, strength), in flow units: a ghost must not cover them.
    const obstacles: Array<{ x: number; y: number; w: number; h: number }> = []
    flow?.querySelectorAll<HTMLElement>('.react-flow__edgelabel-renderer > *').forEach((el) => {
      const r = el.getBoundingClientRect()
      if (r.width === 0) return
      const a = screenToFlowPosition({ x: r.left, y: r.top })
      const b = screenToFlowPosition({ x: r.right, y: r.bottom })
      obstacles.push({ x: Math.round(a.x), y: Math.round(a.y), w: Math.round(b.x - a.x), h: Math.round(b.y - a.y) })
    })
    const next = { heights, markSizes, bandPaths, bandEdgePaths, obstacles }
    setMeasures((prev) => (measuresKey(prev) === measuresKey(next) ? prev : next))
  })
  if (!geo || geo.cards.length + geo.lines.length + geo.bands.length + geo.statuses.length === 0) return null

  return (
    <ViewportPortal>
      <div ref={layerRef} aria-hidden="true" data-testid={PROPOSAL_GHOST_TESTID} style={{ pointerEvents: 'none' }}>
        <svg className="absolute overflow-visible" style={{ left: 0, top: 0, pointerEvents: 'none' }} width={1} height={1}>
          {[...geo.bands, ...geo.statuses].map((b) => (
            <g key={b.key}>
              {'edgePath' in b && b.edgePath && (
                <path
                  data-testid={`proposal-ghost-edge-${b.key}`}
                  d={b.edgePath}
                  fill="none"
                  className="stroke-info"
                  strokeOpacity={0.35}
                  strokeWidth={6}
                  strokeLinecap="round"
                />
              )}
              {b.connector && (
                <line
                  data-testid={`proposal-ghost-connector-${b.key}`}
                  x1={b.connector.x1}
                  y1={b.connector.y1}
                  x2={b.connector.x2}
                  y2={b.connector.y2}
                  className="stroke-info"
                  strokeOpacity={0.55}
                  strokeWidth={1.5}
                />
              )}
            </g>
          ))}
          {geo.lines.map((l) => (
            <line
              key={l.key}
              data-testid={`proposal-ghost-line-${l.key}`}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              className="stroke-info"
              strokeOpacity={0.55}
              strokeWidth={1.5}
            />
          ))}
        </svg>
        {geo.cards.map((c) => {
          // The wire's kind, validated: an unknown kind draws no shape rather than a wrong one.
          const kind = c.kind ? NodeTypeEnum.safeParse(c.kind) : null
          return (
          <div
            key={c.id}
            data-testid={`proposal-ghost-node-${c.id}`}
            data-ghost-id={c.id}
            className="absolute flex flex-col justify-center rounded-lg border border-info bg-panel opacity-80"
            style={{ left: c.x, top: c.y, width: c.w, minHeight: GHOST_CARD_HEIGHT, padding: 12, gap: 4, pointerEvents: 'none' }}
          >
            <span className="flex items-center" style={{ gap: 4 }}>
              {kind?.success && <NodeShapeIndicator nodeKind={kind.data} size={14} />}
              <span className={`${typography.nodeLabel} text-text-light`}>Proposed</span>
            </span>
            <span className={`${typography.nodeTitle} text-text-header`}>{c.label}</span>
          </div>
          )
        })}
        {[
          ...geo.bands.map((b) => ({ key: b.key, testid: `proposal-ghost-band-${b.key}`, x: b.x, y: b.y, text: ghostBandText(b) })),
          ...geo.statuses.map((st) => ({
            key: st.key, testid: `proposal-ghost-status-${st.optionId}`, x: st.x, y: st.y, text: ghostStatusText(st.status),
          })),
        ].map((m) => (
          <span
            key={m.key}
            data-testid={m.testid}
            data-ghost-mark={m.key}
            className={`absolute rounded border border-info bg-panel opacity-80 ${typography.edgeLabel} text-text-header`}
            style={{ left: m.x, top: m.y, transform: 'translate(-50%, -50%)', padding: '2px 8px', whiteSpace: 'nowrap', pointerEvents: 'none' }}
          >
            {m.text}
          </span>
        ))}
      </div>
    </ViewportPortal>
  )
})
