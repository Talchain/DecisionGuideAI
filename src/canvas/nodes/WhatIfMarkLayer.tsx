/**
 * WHAT IF (slice 1): the held change drawn on its card, "What if: 40%", while the "What if" lens is on.
 *
 * ⛔ Its own owner (`whatIfStore`), never the proposal ghost's store: a what-if is the user's, not "Olumi proposes"
 *   (Codex AMEND risk 3). It reuses the ghost's PURE placement (`proposalGhostGeometry`, a value mark beside its card)
 *   and its mark styling, nothing else.
 * ⛔ Render-only, through `ViewportPortal`: never in `nodes`/`edges`, `pointer-events: none`, `aria-hidden` (the key
 *   card says the same in words). Text through the counter-scaled canvas tokens only (declared VIEWPORT_PORTALLED).
 */
import { memo, useMemo } from 'react'
import { ViewportPortal, useNodes, useStore } from '@xyflow/react'

import { typography } from '../../styles/typography'
import { useCanvasStore } from '../store'
import { useWhatIfStore } from '../stores/whatIfStore'
import { proposalGhostGeometry } from '../utils/proposalGhostGeometry'
import { figureText } from './ProposalGhostLayer'

export const WHAT_IF_MARK_TESTID = 'what-if-mark'
export const whatIfMarkText = (v: { value: number; unit: string }): string => `What if: ${figureText(v)}`

export const WhatIfMarkLayer = memo(function WhatIfMarkLayer() {
  const lens = useCanvasStore((s) => s.lens.active)
  const held = useWhatIfStore((s) => s.held)
  const nodes = useNodes()
  useStore((s) => s.transform[2])
  const mark = useMemo(() => {
    if (lens !== 'what_if' || held === null) return null
    const geo = proposalGhostGeometry(
      { proposalId: 'what-if', ops: [{ op: 'set_factor_value', nodeId: held.nodeId, value: held.whatIf, unit: held.unit, source: 'yours' }] },
      nodes,
      {},
    )
    return geo.values[0] ?? null
  }, [lens, held, nodes])
  if (mark === null || held === null) return null
  return (
    <ViewportPortal>
      <div aria-hidden="true" style={{ pointerEvents: 'none' }}>
        {mark.connector && (
          <svg className="absolute overflow-visible" style={{ left: 0, top: 0, pointerEvents: 'none' }} width={1} height={1}>
            <line x1={mark.connector.x1} y1={mark.connector.y1} x2={mark.connector.x2} y2={mark.connector.y2} className="stroke-info" strokeOpacity={0.55} strokeWidth={1.5} />
          </svg>
        )}
        <span
          data-testid={`${WHAT_IF_MARK_TESTID}-${held.nodeId}`}
          className={`absolute rounded border border-info bg-panel ${typography.edgeLabel} text-text-header`}
          style={{ left: mark.x, top: mark.y, transform: 'translate(-50%, -50%)', padding: '2px 8px', whiteSpace: 'nowrap', pointerEvents: 'none' }}
        >
          {whatIfMarkText({ value: held.whatIf, unit: held.unit })}
        </span>
      </div>
    </ViewportPortal>
  )
})
