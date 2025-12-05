/**
 * Node Badge Component
 *
 * Shows rank and contribution percentage as a badge on top-driver nodes.
 * Appears in the top-right corner of the node.
 * Color varies by rank (1-3 get distinct colors).
 */

import { useReactFlow } from '@xyflow/react'

export interface NodeBadgeProps {
  nodeId: string
  percentage: number
  rank: number
  position?: 'top-right' | 'top-left'
}

export function NodeBadge({
  nodeId,
  percentage,
  rank,
  position = 'top-right',
}: NodeBadgeProps): JSX.Element | null {
  const { getNode } = useReactFlow()
  const node = getNode(nodeId)

  if (!node) return null

  // Don't show badge if contribution is negligible
  if (percentage < 5) return null

  // Calculate badge position
  const baseX = node.position?.x || 0
  const baseY = node.position?.y || 0
  const nodeWidth = node.width || 180
  const nodeHeight = node.height || 60

  const badgeX =
    position === 'top-right' ? baseX + nodeWidth : baseX
  const badgeY = baseY

  // Color by rank (top 1-3 get different colors)
  const colorClasses = {
    1: 'bg-analytical-600 border-analytical-700',
    2: 'bg-analytical-500 border-analytical-600',
    3: 'bg-analytical-400 border-analytical-500',
  }[rank] || 'bg-analytical-400 border-analytical-500'

  return (
    <div
      className="absolute pointer-events-none z-10"
      style={{
        left: `${badgeX}px`,
        top: `${badgeY}px`,
        transform:
          position === 'top-right'
            ? 'translate(50%, -50%)'
            : 'translate(-50%, -50%)',
      }}
      role="status"
      aria-label={`Rank ${rank}: Contributes ${percentage}% to outcome`}
    >
      <div
        className={`
          px-2 py-1
          ${colorClasses}
          text-white
          rounded-full text-xs font-bold
          shadow-lg border-2 border-white
        `}
      >
        #{rank} {percentage}%
      </div>
    </div>
  )
}
