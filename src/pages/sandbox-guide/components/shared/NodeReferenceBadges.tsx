/**
 * Node and Edge Reference Badges
 *
 * Interactive badges that represent nodes and edges in insights.
 * Clicking a badge highlights the corresponding element on the canvas.
 */

import { useCanvasStore } from '../../../../canvas/store'

export interface NodeBadgeProps {
  nodeId: string
  label?: string
  onClick?: (nodeId: string) => void
  className?: string
}

export interface EdgeBadgeProps {
  edgeId: string
  label?: string
  onClick?: (edgeId: string) => void
  className?: string
}

/**
 * NodeBadge - Clickable badge for node references
 *
 * Features:
 * - Shows node label or falls back to ID
 * - Highlights node on hover
 * - Focuses node on click
 * - Visual indicator with node icon
 */
export function NodeBadge({ nodeId, label, onClick, className = '' }: NodeBadgeProps): JSX.Element {
  const nodes = useCanvasStore((state) => state.nodes)
  const node = nodes.find((n) => n.id === nodeId)

  // Get label from node data if not provided
  const displayLabel = label || node?.data?.label || nodeId

  const handleClick = () => {
    if (onClick) {
      onClick(nodeId)
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`
        inline-flex items-center gap-1 px-2 py-1
        text-xs font-medium rounded
        bg-analytical-50 hover:bg-analytical-100
        text-analytical-700 hover:text-analytical-900
        border border-analytical-200 hover:border-analytical-400
        transition-all duration-150
        ${className}
      `}
      title={`Click to view ${displayLabel} (${nodeId})`}
    >
      {/* Node icon */}
      <svg
        className="w-3 h-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="10" strokeWidth="2" />
      </svg>
      <span>{displayLabel}</span>
    </button>
  )
}

/**
 * EdgeBadge - Clickable badge for edge references
 *
 * Features:
 * - Shows edge label or falls back to ID
 * - Highlights edge on hover
 * - Focuses edge on click
 * - Visual indicator with arrow icon
 */
export function EdgeBadge({ edgeId, label, onClick, className = '' }: EdgeBadgeProps): JSX.Element {
  const edges = useCanvasStore((state) => state.edges)
  const edge = edges.find((e) => e.id === edgeId)

  // Get label from edge data if not provided
  const displayLabel = label || edge?.data?.label || edgeId

  const handleClick = () => {
    if (onClick) {
      onClick(edgeId)
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`
        inline-flex items-center gap-1 px-2 py-1
        text-xs font-medium rounded
        bg-storm-50 hover:bg-storm-100
        text-storm-700 hover:text-storm-900
        border border-storm-200 hover:border-storm-400
        transition-all duration-150
        ${className}
      `}
      title={`Click to view ${displayLabel} (${edgeId})`}
    >
      {/* Arrow icon */}
      <svg
        className="w-3 h-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M13 7l5 5m0 0l-5 5m5-5H6"
        />
      </svg>
      <span>{displayLabel}</span>
    </button>
  )
}
