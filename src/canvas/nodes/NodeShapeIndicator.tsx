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
  /**
   * ⭐ An optional outline on the shape itself (contract v3.1 FRAME-03 / OR-05:
   * `.node .shape svg` carries `stroke:#FEFEFE;stroke-width:1.2` in a 24-unit
   * box). The canvas connector glyph passes the panel colour here so the bare
   * shape separates from the card border it sits on WITHOUT the white tile it
   * used to need. Absent everywhere else, so the legend, inspector and outline
   * render exactly as before.
   */
  stroke?: string
  /** In viewBox units (12-unit box), so 0.6 here = the contract's 1.2 in 24. */
  strokeWidth?: number
}

/**
 * Shared fill colours per node type (Design System v4 entity colours).
 * Using CSS custom properties defined by Tailwind colour tokens.
 */
const SHAPE_FILLS: Record<NodeType, string> = {
  factor:     'var(--factor)',
  option:     'var(--option)',
  goal:       'var(--goal)',
  decision:   'var(--info)',
  risk:       'var(--danger)',
  outcome:    'var(--success)',
  action:     'var(--success)',
  constraint: 'var(--text-light)',
}

export function NodeShapeIndicator({ nodeKind, size = 12, className, fillOverride, stroke, strokeWidth }: NodeShapeIndicatorProps) {
  const fill = fillOverride ?? SHAPE_FILLS[nodeKind] ?? SHAPE_FILLS.factor
  // Spread onto every shape element. Empty when no stroke was asked for, so the
  // default rendering is byte-identical to the stroke-less shape.
  const outline = stroke
    ? { stroke, strokeWidth: strokeWidth ?? 0.6, strokeLinejoin: 'round' as const }
    : {}

  switch (nodeKind) {
    case 'factor':
      // Circle
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className={className} style={{ flexShrink: 0 }}>
          <circle cx="6" cy="6" r="5" fill={fill} {...outline} />
        </svg>
      )

    case 'option':
      // Square
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className={className} style={{ flexShrink: 0 }}>
          <rect x="1" y="1" width="10" height="10" rx="1" fill={fill} {...outline} />
        </svg>
      )

    case 'goal':
      // Diamond
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className={className} style={{ flexShrink: 0 }}>
          <polygon points="6,1 11,6 6,11 1,6" fill={fill} {...outline} />
        </svg>
      )

    case 'decision':
      // Hexagon — FLAT-TOP, pointed left and right (contract v3.1 FRAME-03:
      // question `M6 2h12l6 10-6 10H6L0 12z`, ÷2 into this 12-unit box and inset
      // half a unit so an outline stroke is never clipped at the viewBox edge).
      // It was pointy-top, which read as a rotated option square at 11px.
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className={className} style={{ flexShrink: 0 }}>
          <polygon points="3.25,1.5 8.75,1.5 11.5,6 8.75,10.5 3.25,10.5 0.5,6" fill={fill} {...outline} />
        </svg>
      )

    case 'risk':
      // Inverted triangle (pointing down). Contract v3.1 OR-09: `M1 2h22L12 22z`
      // ÷2 — 11 wide × 10 tall, the SAME extents as the outcome triangle below,
      // so ▲ and ▼ differ only in direction, never in optical size.
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className={className} style={{ flexShrink: 0 }}>
          <polygon points="0.5,1 11.5,1 6,11" fill={fill} {...outline} />
        </svg>
      )

    case 'outcome':
      // Upward triangle (positive result — outcome achieved). Contract v3.1
      // OR-09: `m12 2 11 20H1z` ÷2, in the same 12-unit box as every other kind
      // (it was the lone 14-unit box, so ▲ and ▼ rendered at different sizes).
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className={className} style={{ flexShrink: 0 }}>
          <polygon points="6,1 11.5,11 0.5,11" fill={fill} {...outline} />
        </svg>
      )

    case 'action':
      // Small filled circle (same as outcome, different colour)
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className={className} style={{ flexShrink: 0 }}>
          <circle cx="6" cy="6" r="5" fill={fill} {...outline} />
        </svg>
      )

    case 'constraint':
    default:
      // Small square (constraint falls through: shape exists but CEE never emits constraint nodes — see NodeTypeEnum JSDoc)
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className={className} style={{ flexShrink: 0 }}>
          <rect x="1" y="1" width="10" height="10" rx="2" fill={fill} {...outline} />
        </svg>
      )
  }
}
