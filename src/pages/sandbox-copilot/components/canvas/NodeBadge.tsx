/**
 * Node Badge Component
 *
 * Shows contribution percentage as a badge on top-driver nodes.
 * Appears in the top-right corner of the node.
 */

import { useReactFlow } from '@xyflow/react'

export interface NodeBadgeProps {
  nodeId: string
  contribution: number
  isTopDriver: boolean
}

export function NodeBadge({ nodeId, contribution, isTopDriver }: NodeBadgeProps): JSX.Element | null {
  const { getNode } = useReactFlow()
  const node = getNode(nodeId)

  if (!node) return null

  // Calculate badge position (top-right of node)
  const badgeX = (node.position?.x || 0) + (node.width || 180) - 10
  const badgeY = (node.position?.y || 0) - 10

  // Only show for significant contributions (>5%)
  if (contribution < 0.05) return null

  return (
    <div
      className="absolute pointer-events-none z-10"
      style={{
        left: `${badgeX}px`,
        top: `${badgeY}px`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div
        className={`
          px-2 py-0.5 rounded-full text-xs font-bold
          ${
            isTopDriver
              ? 'bg-analytical-600 text-white shadow-lg'
              : 'bg-analytical-100 text-analytical-800 border border-analytical-300'
          }
        `}
      >
        {Math.round(contribution * 100)}%
      </div>
    </div>
  )
}
