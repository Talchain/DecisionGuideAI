/**
 * Radial Quick-Add Menu - P0-7
 * Circular menu for fast node creation with Q keyboard shortcut
 * Shows 6 node type options in radial segments
 */

import { useEffect, useState } from 'react'
import { NODE_REGISTRY, type NodeType } from '../domain/nodes'

interface RadialQuickAddMenuProps {
  position: { x: number; y: number }
  onSelect: (nodeType: NodeType) => void
  onCancel: () => void
}

const MENU_RADIUS = 80
const SEGMENT_COUNT = 6

// Top 6 most common node types from NODE_REGISTRY
const QUICK_NODE_TYPES: NodeType[] = [
  'decision',
  'outcome',
  'option',
  'factor',
  'risk',
  'goal'
]

export function RadialQuickAddMenu({ position, onSelect, onCancel }: RadialQuickAddMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)

  // Handle ESC key to cancel
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  // Calculate segment angle and position
  const getSegmentPath = (index: number): string => {
    const anglePerSegment = (2 * Math.PI) / SEGMENT_COUNT
    const startAngle = index * anglePerSegment - Math.PI / 2 // Start from top
    const endAngle = startAngle + anglePerSegment

    const innerRadius = 20
    const outerRadius = MENU_RADIUS

    const x1 = Math.cos(startAngle) * innerRadius
    const y1 = Math.sin(startAngle) * innerRadius
    const x2 = Math.cos(startAngle) * outerRadius
    const y2 = Math.sin(startAngle) * outerRadius
    const x3 = Math.cos(endAngle) * outerRadius
    const y3 = Math.sin(endAngle) * outerRadius
    const x4 = Math.cos(endAngle) * innerRadius
    const y4 = Math.sin(endAngle) * innerRadius

    return `M ${x1} ${y1} L ${x2} ${y2} A ${outerRadius} ${outerRadius} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${innerRadius} ${innerRadius} 0 0 0 ${x1} ${y1} Z`
  }

  const getLabelPosition = (index: number): { x: number; y: number } => {
    const anglePerSegment = (2 * Math.PI) / SEGMENT_COUNT
    const angle = index * anglePerSegment - Math.PI / 2 + anglePerSegment / 2
    const labelRadius = (MENU_RADIUS + 20) / 2

    return {
      x: Math.cos(angle) * labelRadius,
      y: Math.sin(angle) * labelRadius
    }
  }

  return (
    <div
      className="fixed z-[4000] pointer-events-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -50%)'
      }}
    >
      {/* Center dot */}
      <div
        className="absolute w-2 h-2 bg-info-500 rounded-full"
        style={{ left: '-4px', top: '-4px' }}
      />

      {/* SVG radial menu */}
      <svg
        width={MENU_RADIUS * 2 + 20}
        height={MENU_RADIUS * 2 + 20}
        viewBox={`${-MENU_RADIUS - 10} ${-MENU_RADIUS - 10} ${MENU_RADIUS * 2 + 20} ${MENU_RADIUS * 2 + 20}`}
        style={{
          position: 'absolute',
          left: `${-MENU_RADIUS - 10}px`,
          top: `${-MENU_RADIUS - 10}px`,
          pointerEvents: 'all'
        }}
      >
        {QUICK_NODE_TYPES.slice(0, SEGMENT_COUNT).map((nodeType, index) => {
          const def = NODE_REGISTRY[nodeType]
          const isHovered = selectedIndex === index

          return (
            <g key={nodeType}>
              <path
                d={getSegmentPath(index)}
                fill={isHovered ? 'var(--info-500)' : 'var(--surface-app)'}
                stroke="var(--surface-border)"
                strokeWidth="1.5"
                onMouseEnter={() => setSelectedIndex(index)}
                onMouseLeave={() => setSelectedIndex(-1)}
                onClick={() => onSelect(nodeType)}
                style={{ cursor: 'pointer' }}
              />
              <text
                x={getLabelPosition(index).x}
                y={getLabelPosition(index).y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
                fontWeight="500"
                fill={isHovered ? 'var(--text-on-info)' : 'var(--text-secondary)'}
                pointerEvents="none"
              >
                {def?.label.split(' ')[0] || nodeType}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
