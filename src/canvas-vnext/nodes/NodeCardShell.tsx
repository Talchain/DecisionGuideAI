// Shared chrome for Stage-3 node cards: shape+colour channels, constant
// width, vNext-local selection ring, invisible handles — same contract as
// BasicNodeVNext/OptionNodeVNext.

import type { ReactNode } from 'react'
import { NodeShapeIndicator } from '../../canvas/nodes/NodeShapeIndicator'
import { useVNextSelection } from '../mode/contexts'
import { colorsForType, VNextHandles } from './BasicNodeVNext'
import { STALE_CLAIM_MARKER } from '../vm/strings'
import type { NodeType } from '../../canvas/domain/nodes'

export function NodeCardShell({
  nodeId,
  nodeKind,
  label,
  testid,
  children,
}: {
  nodeId: string
  nodeKind: string
  label: string
  testid: string
  children?: ReactNode
}) {
  const { selectedNodeId } = useVNextSelection()
  const colors = colorsForType(nodeKind)
  const isSelected = selectedNodeId === nodeId

  return (
    <div
      data-testid={testid}
      className={`w-52 rounded-lg border-2 px-3 py-2 shadow-sm ${colors.bg} ${'border' in colors ? colors.border : ''} ${isSelected ? colors.selected : ''}`}
    >
      <div className="flex items-center gap-2">
        <NodeShapeIndicator nodeKind={nodeKind as NodeType} />
        <span className="text-sm font-medium text-text-body break-words">{label}</span>
      </div>
      {children}
      <VNextHandles />
    </div>
  )
}

/**
 * Result-derived content block: dims when stale and renders the undimmed
 * "From a previous run" marker beneath (UI-SEM-076 / amendment A7 — the
 * marker itself is never dimmed).
 */
export function ResultDimBlock({
  dim,
  markerTestId,
  children,
}: {
  dim: boolean
  markerTestId: string
  children: ReactNode
}) {
  return (
    <>
      <div className={dim ? 'opacity-60' : undefined}>{children}</div>
      {dim && (
        <p data-testid={markerTestId} className="mt-1 text-xs italic text-text-light">
          {STALE_CLAIM_MARKER}
        </p>
      )}
    </>
  )
}
