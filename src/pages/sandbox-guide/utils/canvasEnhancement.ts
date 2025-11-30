/**
 * Canvas Enhancement Utilities
 *
 * Utilities for visual encoding of canvas elements based on analysis results.
 * Provides functions to calculate edge thickness, colors, and node badges based on:
 * - Top drivers contribution
 * - Evidence coverage
 * - Critical gaps
 */

import type { Edge, Node } from '@xyflow/react'

export interface TopDriver {
  node_id: string
  contribution: number
  node_label?: string
  explanation?: string
}

export interface CriticalGap {
  edge_id: string
  impact_on_outcome: string
  recommendation?: string
}

/**
 * Calculate edge thickness based on driver contribution
 * Thickness indicates importance to outcome
 *
 * @param edge - The edge to calculate thickness for
 * @param topDrivers - Array of top drivers from analysis results
 * @returns Thickness in pixels (2, 3, 4, or 6)
 */
export function calculateEdgeThickness(
  edge: Edge,
  topDrivers?: TopDriver[]
): number {
  if (!topDrivers || topDrivers.length === 0) return 2

  // Check if edge connects to a top driver node
  const targetDriver = topDrivers.find((d) => d.node_id === edge.target)
  const sourceDriver = topDrivers.find((d) => d.node_id === edge.source)

  // Use highest contribution if either end is a driver
  // Source contributes less (weighted at 50%) since effect flows to target
  const contribution = Math.max(
    targetDriver?.contribution || 0,
    (sourceDriver?.contribution || 0) * 0.5
  )

  if (contribution > 0.4) return 6 // Top driver (>40%)
  if (contribution > 0.2) return 4 // Significant (>20%)
  if (contribution > 0.1) return 3 // Notable (>10%)
  return 2 // Normal
}

/**
 * Calculate edge color based on evidence count
 * Color indicates confidence level
 *
 * @param edge - The edge to calculate color for
 * @param evidenceCoverage - Map of edge IDs to evidence counts
 * @returns Hex color string
 */
export function calculateEdgeColor(
  edge: Edge,
  evidenceCoverage?: Map<string, number>
): string {
  const evidenceCount = evidenceCoverage?.get(edge.id) || 0

  // No evidence = grey (needs attention)
  if (evidenceCount === 0) return '#A0AEC0' // storm-400

  // Evidence gradient: light → dark blue as evidence increases
  if (evidenceCount === 1) return '#63B3ED' // analytical-400
  if (evidenceCount === 2) return '#4299E1' // analytical-500
  if (evidenceCount === 3) return '#3182CE' // analytical-600
  return '#2B6CB0' // analytical-700 (4+ sources)
}

/**
 * Check if edge is a critical gap (high impact, no evidence)
 *
 * @param edge - The edge to check
 * @param criticalGaps - Array of critical gaps from analysis
 * @returns True if this edge is a critical gap
 */
export function isCriticalGap(
  edge: Edge,
  criticalGaps?: CriticalGap[]
): boolean {
  if (!criticalGaps || criticalGaps.length === 0) return false
  return criticalGaps.some((gap) => gap.edge_id === edge.id)
}

/**
 * Get node badge info if node is a top driver
 *
 * @param nodeId - The node ID to check
 * @param topDrivers - Array of top drivers from analysis
 * @returns Badge info (percentage, rank) or null if not a driver
 */
export function getNodeBadge(
  nodeId: string,
  topDrivers?: TopDriver[]
): { percentage: number; rank: number } | null {
  if (!topDrivers || topDrivers.length === 0) return null

  const driverIndex = topDrivers.findIndex((d) => d.node_id === nodeId)
  if (driverIndex === -1) return null

  const driver = topDrivers[driverIndex]
  return {
    percentage: Math.round(driver.contribution * 100),
    rank: driverIndex + 1,
  }
}

/**
 * Apply visual encoding to edges
 * Enhances edges with thickness, color, and animation based on analysis
 *
 * @param edges - Array of edges to enhance
 * @param topDrivers - Top drivers from analysis
 * @param criticalGaps - Critical gaps from analysis
 * @param evidenceCoverage - Evidence count per edge
 * @returns Enhanced edges with visual encoding
 */
export function enhanceEdges(
  edges: Edge[],
  topDrivers?: TopDriver[],
  criticalGaps?: CriticalGap[],
  evidenceCoverage?: Map<string, number>
): Edge[] {
  return edges.map((edge) => {
    const thickness = calculateEdgeThickness(edge, topDrivers)
    const color = calculateEdgeColor(edge, evidenceCoverage)
    const isCritical = isCriticalGap(edge, criticalGaps)

    return {
      ...edge,
      style: {
        ...edge.style,
        strokeWidth: thickness,
        stroke: color,
      },
      animated: isCritical, // Pulse animation for critical gaps
      className: isCritical ? 'critical-gap-edge' : undefined,
      data: {
        ...edge.data,
        // Store metadata for tooltips
        visualEncoding: {
          thickness,
          color,
          isCritical,
          evidenceCount: evidenceCoverage?.get(edge.id) || 0,
        },
      },
    }
  })
}
