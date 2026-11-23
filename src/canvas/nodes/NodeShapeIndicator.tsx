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
  /**
   * An outlined, dashed shape in the kind's colour with a transparent interior, never solid: what is not yet verified (V12's assumption marker, Paul 16 Nov).
   * Absent everywhere else, so every other reader draws exactly as before.
   */
  dashedOutline?: boolean
}

/** Entity colour classes and the SVG's fallback presentation attributes. */
const SHAPE_COLOURS: Record<NodeType, { ink: string; paint: string }> = {
  factor: { ink: 'text-factor', paint: 'var(--factor)' },
  option: { ink: 'text-option', paint: 'var(--option)' },
  goal: { ink: 'text-goal', paint: 'var(--goal)' },
  decision: { ink: 'text-text-light', paint: 'var(--text-light)' },
  risk: { ink: 'text-danger', paint: 'var(--danger)' },
  outcome: { ink: 'text-success', paint: 'var(--success)' },
  action: { ink: 'text-success', paint: 'var(--success)' },
  constraint: { ink: 'text-text-light', paint: 'var(--text-light)' },
}

export function NodeShapeIndicator({ nodeKind, size = 12, className, fillOverride, stroke, strokeWidth, dashedOutline = false }: NodeShapeIndicatorProps) {
  const { ink, paint: kindFill } = SHAPE_COLOURS[nodeKind] ?? SHAPE_COLOURS.factor
  const svgProps = {
    width: size, height: size, viewBox: '0 0 12 12', fill: 'none', 'aria-hidden': true,
    'data-node-shape': nodeKind, className: `shrink-0 ${ink}${className ? ` ${className}` : ''}`,
  }
  const fill = fillOverride ?? (dashedOutline ? 'none' : kindFill)
  const paint = { fill, className: fillOverride === undefined && !dashedOutline ? 'fill-current' : undefined }
  // Spread onto every shape element. Empty when no stroke was asked for, so the
  // default rendering is byte-identical to the stroke-less shape.
  const outline = dashedOutline
    ? { stroke: kindFill, strokeWidth: 1, strokeDasharray: '2 1.5', className: 'stroke-current', strokeLinejoin: 'round' as const }
    : stroke
      ? { stroke, strokeWidth: strokeWidth ?? 0.6, strokeLinejoin: 'round' as const }
      : {}

  switch (nodeKind) {
    case 'factor':
      // Circle
      return (
        <svg {...svgProps}>
          <circle cx="6" cy="6" r="5" {...paint} {...outline} />
        </svg>
      )

    case 'option':
      // Square
      return (
        <svg {...svgProps}>
          <rect x="1" y="1" width="10" height="10" rx="1" {...paint} {...outline} />
        </svg>
      )

    case 'goal':
      // Diamond
      return (
        <svg {...svgProps}>
          <polygon points="6,1 11,6 6,11 1,6" {...paint} {...outline} />
        </svg>
      )

    case 'decision':
      // Hexagon — FLAT-TOP, pointed left and right (contract v3.1 FRAME-03:
      // question `M6 2h12l6 10-6 10H6L0 12z`, ÷2 into this 12-unit box and inset
      // half a unit so an outline stroke is never clipped at the viewBox edge).
      // It was pointy-top, which read as a rotated option square at 11px.
      return (
        <svg {...svgProps}>
          <polygon points="3.25,1.5 8.75,1.5 11.5,6 8.75,10.5 3.25,10.5 0.5,6" {...paint} {...outline} />
        </svg>
      )

    case 'risk':
      // Inverted triangle (pointing down). Contract v3.1 OR-09: `M1 2h22L12 22z`
      // ÷2 — 11 wide × 10 tall, the SAME extents as the outcome triangle below,
      // so ▲ and ▼ differ only in direction, never in optical size.
      return (
        <svg {...svgProps}>
          <polygon points="0.5,1 11.5,1 6,11" {...paint} {...outline} />
        </svg>
      )

    case 'outcome':
      // Upward triangle (positive result — outcome achieved). Contract v3.1
      // OR-09: `m12 2 11 20H1z` ÷2, in the same 12-unit box as every other kind
      // (it was the lone 14-unit box, so ▲ and ▼ rendered at different sizes).
      return (
        <svg {...svgProps}>
          <polygon points="6,1 11.5,11 0.5,11" {...paint} {...outline} />
        </svg>
      )

    case 'action':
      // Small filled circle (same as outcome, different colour)
      return (
        <svg {...svgProps}>
          <circle cx="6" cy="6" r="5" {...paint} {...outline} />
        </svg>
      )

    case 'constraint':
      // A limit (DL from Paul's test, 17 Nov: a limit read as a goal): an outlined square in the kind's grey, the key's own limit glyph,
      // so it never reads as an option's filled square or a goal's diamond. Dashed where it is an assumption.
      return (
        <svg {...svgProps}>
          <rect x="1.75" y="1.75" width="8.5" height="8.5" rx="1.5" fill={fillOverride ?? 'none'} stroke={kindFill} className="stroke-current" strokeWidth={1.5} {...(dashedOutline ? { strokeDasharray: '2 1.5' } : {})} />
        </svg>
      )

    default:
      // Small square for unrecognised legacy inputs.
      return (
        <svg {...svgProps}>
          <rect x="1" y="1" width="10" height="10" rx="2" {...paint} {...outline} />
        </svg>
      )
  }
}
