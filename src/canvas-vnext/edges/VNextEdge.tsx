// vNext edge renderer.
//
// Visual channels come from the EdgeVisualVM (UI-SEM-075): colour = polarity
// tokens, width = strength band, dash = existence certainty, arrowhead =
// direction (stroke-coloured, causal edges only). Structural edges render as
// thin neutral lines with no claims.
//
// The Relationship Card anchors here via EdgeLabelRenderer: hover opens the
// read-only card after 300ms (100ms leave grace — StyledEdge's timing);
// click pins it (dialog mode) via the vNext-local selection context.

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type EdgeProps } from '@xyflow/react'
import { AlertTriangle } from 'lucide-react'
import { useGraphExperienceVMContext } from '../vm/useGraphExperienceVM'
import { useVNextSelection } from '../mode/contexts'
import { RelationshipCard } from './RelationshipCard'
import { STALE_CLAIM_MARKER } from '../vm/strings'

const HOVER_ENTER_MS = 300
const HOVER_LEAVE_MS = 100

function VNextEdgeInner(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd } = props
  const vm = useGraphExperienceVMContext()
  const { pinnedEdgeId, pinEdge } = useVNextSelection()
  const rf = useReactFlow()

  const visual = vm.edgeVisuals[id]
  const card = vm.relationshipCards[id]

  const [hovered, setHovered] = useState(false)
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current)
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    },
    [],
  )

  const handleEnter = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
    if (!enterTimerRef.current) {
      enterTimerRef.current = setTimeout(() => {
        setHovered(true)
        enterTimerRef.current = null
      }, HOVER_ENTER_MS)
    }
  }, [])

  const handleLeave = useCallback(() => {
    if (enterTimerRef.current) {
      clearTimeout(enterTimerRef.current)
      enterTimerRef.current = null
    }
    leaveTimerRef.current = setTimeout(() => {
      setHovered(false)
      leaveTimerRef.current = null
    }, HOVER_LEAVE_MS)
  }, [])

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const handleFocusEdge = useCallback(() => {
    // Pan-only: preserve the user's zoom.
    rf.setCenter(labelX, labelY, { zoom: rf.getViewport().zoom, duration: 300 })
  }, [rf, labelX, labelY])

  if (!visual || !card) {
    // VM not built for this edge (shouldn't happen) — neutral fallback line.
    return <BaseEdge id={id} path={edgePath} style={{ stroke: 'var(--text-light)', strokeWidth: 1 }} />
  }

  const isPinned = pinnedEdgeId === id
  const showHoverCard = hovered && !isPinned
  const dimFragile = visual.isFragile && card.isStaleResult

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={visual.isStructural ? undefined : (markerEnd as string | undefined)}
        style={{
          stroke: visual.strokeColor,
          strokeWidth: visual.strokeWidth,
          strokeDasharray: visual.dashArray,
        }}
      />
      {/* Wide invisible hit area for hover/click (the visible path is thin). */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onClick={() => pinEdge(id)}
        data-testid={`vnext-edge-hit-${id}`}
      />

      <EdgeLabelRenderer>
        {visual.isFragile && !isPinned && !showHoverCard && (
          <button
            type="button"
            data-testid={`vnext-fragile-chip-${id}`}
            title={dimFragile ? `${STALE_CLAIM_MARKER} — fragility from the last analysis` : 'This link can flip the result'}
            onClick={() => pinEdge(id)}
            className={`rounded-full border border-warning/30 bg-panel p-1 shadow-sm ${dimFragile ? 'opacity-60' : ''}`}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
          >
            <AlertTriangle size={12} className="text-warning" aria-hidden />
            <span className="sr-only">Fragile relationship</span>
          </button>
        )}

        {(showHoverCard || isPinned) && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, calc(-100% - 10px)) translate(${labelX}px, ${labelY}px)`,
              zIndex: 1000,
              pointerEvents: 'all',
            }}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
          >
            <RelationshipCard
              card={card}
              mode={isPinned ? 'pinned' : 'hover'}
              onClose={() => pinEdge(null)}
              onFocusEdge={handleFocusEdge}
            />
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}

export const VNextEdge = memo(VNextEdgeInner)
