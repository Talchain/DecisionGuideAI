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
 */
import { memo, useMemo } from 'react'
import { ViewportPortal, useNodes } from '@xyflow/react'
import { typography } from '../../styles/typography'
import { useProposalGhostStore } from '../stores/proposalGhostStore'
import { proposalGhostGeometry } from '../utils/proposalGhostGeometry'
import { strengthBandWords } from '../../components/results/analysisNew/runDeltaLinkWords'
import { NodeShapeIndicator } from './NodeShapeIndicator'
import { NodeTypeEnum } from '../domain/nodes'

export const PROPOSAL_GHOST_TESTID = 'proposal-ghost-layer'

export const ProposalGhostLayer = memo(function ProposalGhostLayer() {
  const ghost = useProposalGhostStore((s) => s.ghost)
  const nodes = useNodes()
  const geo = useMemo(() => (ghost ? proposalGhostGeometry(ghost, nodes) : null), [ghost, nodes])
  if (!geo || (geo.cards.length === 0 && geo.lines.length === 0 && geo.bands.length === 0)) return null

  return (
    <ViewportPortal>
      <div aria-hidden="true" data-testid={PROPOSAL_GHOST_TESTID} style={{ pointerEvents: 'none' }}>
        <svg className="absolute overflow-visible" style={{ left: 0, top: 0, pointerEvents: 'none' }} width={1} height={1}>
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
            className="absolute flex flex-col justify-center rounded-lg border border-info bg-panel opacity-80"
            style={{ left: c.x, top: c.y, width: c.w, minHeight: c.h, padding: 12, gap: 4, pointerEvents: 'none' }}
          >
            <span className="flex items-center" style={{ gap: 4 }}>
              {kind?.success && <NodeShapeIndicator nodeKind={kind.data} size={14} />}
              <span className={`${typography.nodeLabel} text-text-light`}>Proposed</span>
            </span>
            <span className={`${typography.nodeTitle} text-text-header`}>{c.label}</span>
          </div>
          )
        })}
        {geo.bands.map((b) => (
          <span
            key={b.key}
            data-testid={`proposal-ghost-band-${b.key}`}
            className={`absolute rounded border border-info bg-panel opacity-80 ${typography.edgeLabel} text-text-header`}
            style={{ left: b.x, top: b.y, transform: 'translate(-50%, -50%)', padding: '2px 8px', whiteSpace: 'nowrap', pointerEvents: 'none' }}
          >
            Proposed: {strengthBandWords(b.band)}
          </span>
        ))}
      </div>
    </ViewportPortal>
  )
})
