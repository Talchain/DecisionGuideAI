/**
 * Edge domain types and schemas
 * British English: visualisation, colour, initialise
 */

import { z } from 'zod'

/**
 * Edge style options for visualisation
 */
export const EdgeStyleEnum = z.enum(['solid', 'dashed', 'dotted'])
export type EdgeStyle = z.infer<typeof EdgeStyleEnum>

/**
 * Edge data schema (v2)
 * Extends React Flow's base edge with semantic properties
 */
export const EdgeDataSchema = z.object({
  // Visual properties
  weight: z.number().min(0.1).max(5.0).default(1.0),
  style: EdgeStyleEnum.default('solid'),
  curvature: z.number().min(0).max(0.5).default(0.15),
  
  // Semantic properties
  label: z.string().max(50).optional(),
  confidence: z.number().min(0).max(1).optional(),
  
  // Schema version for migrations
  schemaVersion: z.literal(2).default(2),
})

export type EdgeData = z.infer<typeof EdgeDataSchema>

/**
 * Default edge data for new edges
 */
export const DEFAULT_EDGE_DATA: EdgeData = {
  weight: 1.0,
  style: 'solid',
  curvature: 0.15,
  schemaVersion: 2,
}

/**
 * Edge visual property constraints
 * Used for validation and UI controls
 */
export const EDGE_CONSTRAINTS = {
  weight: {
    min: 0.1,
    max: 5.0,
    step: 0.1,
    default: 1.0,
  },
  curvature: {
    min: 0,
    max: 0.5,
    step: 0.05,
    default: 0.15,
  },
  confidence: {
    min: 0,
    max: 1,
    step: 0.05,
    default: 0.5,
  },
} as const

/**
 * Map edge weight to stroke width (pixels)
 * Linear mapping: 0.1 → 1px, 5.0 → 6px
 */
export function weightToStrokeWidth(weight: number): number {
  const clamped = Math.max(0.1, Math.min(5.0, weight))
  return 1 + ((clamped - 0.1) / 4.9) * 5
}

/**
 * Map edge style to SVG stroke-dasharray
 */
export function styleToDashArray(style: EdgeStyle): string {
  switch (style) {
    case 'solid':
      return '0'
    case 'dashed':
      return '6 4'
    case 'dotted':
      return '2 3'
  }
}

/**
 * Clamp curvature to valid range
 */
export function clampCurvature(curvature: number): number {
  return Math.max(0, Math.min(0.5, curvature))
}

/**
 * Format confidence as percentage for UI
 */
export function formatConfidence(confidence: number | undefined): string {
  if (confidence === undefined) return 'Unknown'
  return `${Math.round(confidence * 100)}%`
}
