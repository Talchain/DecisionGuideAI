/**
 * NodeShapeIndicator
 * Renders a small inline SVG shape representing the node type.
 * Design System v4 §10.1 — Three-channel system: Shapes (what it is).
 *
 * Sizes: 12–14px. Colours match entity colour tokens.
 */

import type { NodeType } from '../domain/nodes'

interface NodeShapeIndicatorProps {
  nodeKind: NodeType
  size?: number
  className?: string
  fillOverride?: string
}

/**
 * Shared fill colours per node type (Design System v4 entity colours).
 * Using CSS custom properties defined by Tailwind colour tokens.
 */
const SHAPE_FILLS: Record<NodeType, string> = {
  factor:     'var(--color-factor,     #B0A899)',
  option:     'var(--color-option,     #AAA7E4)',
  goal:       'var(--color-goal,       #F5C433)',
  decision:   'var(--color-info,       #2B7FA2)',
  risk:       'var(--color-danger,     #EA7B4B)',
  outcome:    'var(--color-success,    #67C89E)',
  action:     'var(--color-success,    #67C89E)',
  constraint: 'var(--color-text-light, #94A3B8)',
}

export function NodeShapeIndicator({ nodeKind, size = 12, className, fillOverride }: NodeShapeIndicatorProps) {
  const fill = fillOverride ?? SHAPE_FILLS[nodeKind] ?? SHAPE_FILLS.factor
  const half = size / 2

  switch (nodeKind) {
    case 'factor':
      // Circle
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className={className} style={{ flexShrink: 0 }}>
          <circle cx="6" cy="6" r="5" fill={fill} />
        </svg>
      )

    case 'option':
      // Square
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className={className} style={{ flexShrink: 0 }}>
          <rect x="1" y="1" width="10" height="10" rx="1" fill={fill} />
        </svg>
      )

    case 'goal':
      // Diamond
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className={className} style={{ flexShrink: 0 }}>
          <polygon points="6,1 11,6 6,11 1,6" fill={fill} />
        </svg>
      )

    case 'decision':
      // Hexagon
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className={className} style={{ flexShrink: 0 }}>
          <polygon points="6,1 10.2,3.5 10.2,8.5 6,11 1.8,8.5 1.8,3.5" fill={fill} />
        </svg>
      )

    case 'risk':
      // Inverted triangle (pointing down)
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className={className} style={{ flexShrink: 0 }}>
          <polygon points="1,1 11,1 6,11" fill={fill} />
        </svg>
      )

    case 'outcome':
      // Upward triangle (positive result — outcome achieved)
      return (
        <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true" className={className} style={{ flexShrink: 0 }}>
          <polygon points="7,1 13,13 1,13" fill={fill} />
        </svg>
      )

    case 'action':
      // Small filled circle (same as outcome, different colour)
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className={className} style={{ flexShrink: 0 }}>
          <circle cx="6" cy="6" r="5" fill={fill} />
        </svg>
      )

    case 'constraint':
    default:
      // Small square (constraint falls through: shape exists but CEE never emits constraint nodes — see NodeTypeEnum JSDoc)
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className={className} style={{ flexShrink: 0 }}>
          <rect x="1" y="1" width="10" height="10" rx="2" fill={fill} />
        </svg>
      )
  }
}
