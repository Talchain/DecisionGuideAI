/**
 * Scenario Comparison Utilities
 *
 * Computes edge-level differences between two analysis results.
 * Used for Compare view to show top-5 edge diffs with provenance.
 *
 * NOTE: Uses shared formatters from @/lib/format for consistency.
 * For baseline detection and "vs." text, use @/canvas/utils/baselineDetection.
 */

import type { StoredRun } from '../store/runHistory'
import { formatDeltaPercent as sharedFormatDeltaPercent } from '@/lib/format'

export interface EdgeDiff {
  edgeId: string
  label: string // human-readable edge label (e.g., "Node A → Node B")
  runA: { value: number; provenance?: string }
  runB: { value: number; provenance?: string }
  delta: number // absolute difference
  deltaPercent: number // percentage change
  impactScore: number // normalized impact (0-1) for ranking
}

/**
 * Compare two runs and compute edge-level differences
 * Returns top N edges by impact score
 */
export function compareRuns(runA: StoredRun, runB: StoredRun, topN = 5): EdgeDiff[] {
  // Extract edge data from reports
  const edgesA = extractEdgeData(runA)
  const edgesB = extractEdgeData(runB)

  // Find common edges and compute deltas
  const diffs: EdgeDiff[] = []

  for (const edgeIdA of Object.keys(edgesA)) {
    if (edgesB[edgeIdA]) {
      const edgeA = edgesA[edgeIdA]
      const edgeB = edgesB[edgeIdA]

      const delta = Math.abs(edgeB.value - edgeA.value)
      const deltaPercent = edgeA.value !== 0
        ? ((edgeB.value - edgeA.value) / edgeA.value) * 100
        : 0

      // Impact score: weight by both absolute delta and percentage change
      const impactScore = computeImpactScore(delta, deltaPercent)

      diffs.push({
        edgeId: edgeIdA,
        label: edgeA.label,
        runA: { value: edgeA.value, provenance: edgeA.provenance },
        runB: { value: edgeB.value, provenance: edgeB.provenance },
        delta,
        deltaPercent,
        impactScore
      })
    }
  }

  // Sort by impact score (descending) and return top N
  return diffs
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, topN)
}

/**
 * Extract edge data from a stored run
 * Returns map of edgeId -> {value, label, provenance}
 */
function extractEdgeData(run: StoredRun): Record<string, { value: number; label: string; provenance?: string }> {
  const edges: Record<string, { value: number; label: string; provenance?: string }> = {}

  // Extract from drivers if available
  if (run.drivers) {
    for (const driver of run.drivers) {
      if (driver.kind === 'edge' && driver.id) {
        edges[driver.id] = {
          value: 1.0, // Default impact value (drivers don't have numeric values)
          label: driver.label || driver.id,
          provenance: undefined
        }
      }
    }
  }

  // Extract from report if available (report may have more detailed edge data)
  if (run.report && run.report.explain_delta?.top_drivers) {
    for (const driver of run.report.explain_delta.top_drivers) {
      if (driver.kind === 'edge' && driver.edge_id) {
        edges[driver.edge_id] = {
          value: Math.abs(driver.impact ?? 0),
          label: driver.label || driver.edge_id,
          provenance: undefined // Report doesn't include provenance
        }
      }
    }
  }

  return edges
}

/**
 * Compute impact score for an edge diff
 * Combines absolute delta and percentage change
 */
function computeImpactScore(delta: number, deltaPercent: number): number {
  // Normalize delta (assume max meaningful delta is 1.0)
  const normalizedDelta = Math.min(delta, 1.0)

  // Normalize percentage (assume max meaningful change is 100%)
  const normalizedPercent = Math.min(Math.abs(deltaPercent) / 100, 1.0)

  // Weighted combination: 60% absolute delta, 40% percentage change
  return normalizedDelta * 0.6 + normalizedPercent * 0.4
}

/**
 * Format delta percentage for display
 * @deprecated Use formatDeltaPercent from @/lib/format instead
 */
export const formatDeltaPercent = sharedFormatDeltaPercent

/**
 * Format edge value for display
 */
export function formatEdgeValue(value: number): string {
  return value.toFixed(3)
}
