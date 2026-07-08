// Minimal legible card for every node type without a dedicated vNext card
// yet (all types except option at the Stage-2 checkpoint). Shape + colour
// channels come from the design system (NodeShapeIndicator + nodeColors);
// constant width so Simple/Detailed toggling never moves nodes.

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { NodeShapeIndicator } from '../../canvas/nodes/NodeShapeIndicator'
import { nodeColors, type NodeColorType } from '../../canvas/nodes/colors'
import { useVNextSelection } from '../mode/contexts'
import type { NodeType } from '../../canvas/domain/nodes'

const NEUTRAL_COLORS = {
  bg: 'bg-panel',
  border: 'border-panel-border',
  selected: 'ring-4 ring-info/50',
} as const

export function colorsForType(type: string | undefined) {
  return (type && (nodeColors as Record<string, (typeof nodeColors)[NodeColorType]>)[type]) || NEUTRAL_COLORS
}

/** Invisible connection anchors — the surface is read-mostly, edges still
 * need handle geometry to render. */
export function VNextHandles() {
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} aria-hidden />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} aria-hidden />
    </>
  )
}

function BasicNodeVNextInner(props: NodeProps) {
  const { id, type, data } = props
  const { selectedNodeId } = useVNextSelection()
  const colors = colorsForType(type)
  const rawLabel = (data as Record<string, unknown> | undefined)?.label
  const label = typeof rawLabel === 'string' && rawLabel ? rawLabel : 'Untitled'
  const isSelected = selectedNodeId === id

  return (
    <div
      data-testid={`vnext-node-${id}`}
      className={`w-52 rounded-lg border-2 px-3 py-2 shadow-sm ${colors.bg} ${colors.border} ${isSelected ? colors.selected : ''}`}
    >
      <div className="flex items-center gap-2">
        <NodeShapeIndicator nodeKind={(type ?? 'factor') as NodeType} />
        <span className="text-sm font-medium text-text-body break-words">{label}</span>
      </div>
      <VNextHandles />
    </div>
  )
}

export const BasicNodeVNext = memo(BasicNodeVNextInner)
