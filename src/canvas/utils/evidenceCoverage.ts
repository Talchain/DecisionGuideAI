/**
 * Evidence Coverage Utilities (P0.2)
 *
 * SEMANTIC DUALITY:
 * Evidence coverage can be represented in two ways:
 *
 * 1. Backend percentage (graph_quality.evidence_coverage): 0.0–1.0
 *    - Represents the engine's assessment of model evidence quality
 *    - May use different calculation methodology than local counting
 *
 * 2. Local edge provenance counts (evidencedCount/totalCount):
 *    - Counts edges where edge.data.provenance is non-empty
 *    - Used for real-time UI feedback as user adds provenance
 *
 * This module provides utilities to normalize and convert between
 * these representations for consistent UI display.
 */

import type { Edge } from '@xyflow/react'
import type { CoverageLevel } from '../components/EvidenceCoverage'

/**
 * Edge data shape for provenance checking
 */
interface EdgeWithProvenance {
  data?: {
    provenance?: string
  }
}

/**
 * Provenance values that do NOT count as real evidence.
 * - 'assumption': User assumption, not external evidence
 * - 'template': Template default, not user-provided evidence
 * - 'ai-suggested': AI weight suggestion, not external evidence
 */
const NON_EVIDENCE_PROVENANCE = ['assumption', 'template', 'ai-suggested']

/**
 * Count edges with evidence (non-empty provenance excluding non-evidence markers)
 *
 * This is the canonical counting function used across all components.
 * "Evidence" means provenance that represents actual supporting data,
 * not default placeholders like 'assumption', 'template', or AI suggestions.
 *
 * @param edges - Array of edges to count
 * @returns Object with evidenced and total counts
 */
export function countEdgesWithEvidence(edges: EdgeWithProvenance[]): { evidenced: number; total: number } {
  const total = edges.length
  const evidenced = edges.filter(e => {
    const provenance = e.data?.provenance
    return provenance && !NON_EVIDENCE_PROVENANCE.includes(provenance)
  }).length
  return { evidenced, total }
}

/**
 * Normalized evidence coverage structure
 */
export interface NormalizedEvidenceCoverage {
  /** Percentage value 0-100 */
  percentage: number
  /** Coverage level classification */
  level: CoverageLevel
  /** Source of the data */
  source: 'backend' | 'local'
  /** Display label */
  label: string
  /** Optional counts if available */
  counts?: {
    evidenced: number
    total: number
  }
}

/**
 * Calculate coverage level from percentage
 */
export function calculateCoverageLevel(percentage: number): CoverageLevel {
  if (percentage >= 100) return 'full'
  if (percentage >= 60) return 'partial'
  if (percentage > 0) return 'minimal'
  return 'none'
}

/**
 * Create normalized coverage from backend percentage (0.0–1.0)
 *
 * @param backendPercentage - Value from graph_quality.evidence_coverage (0.0–1.0)
 * @returns NormalizedEvidenceCoverage
 */
export function fromBackendPercentage(
  backendPercentage: number
): NormalizedEvidenceCoverage {
  const percentage = Math.round(backendPercentage * 100)
  const level = calculateCoverageLevel(percentage)

  return {
    percentage,
    level,
    source: 'backend',
    label: `${percentage}% (engine assessment)`,
  }
}

/**
 * Create normalized coverage from local edge counts
 *
 * @param evidencedCount - Number of edges with provenance
 * @param totalCount - Total number of edges
 * @returns NormalizedEvidenceCoverage
 */
export function fromLocalCounts(
  evidencedCount: number,
  totalCount: number
): NormalizedEvidenceCoverage {
  const percentage = totalCount > 0 ? Math.round((evidencedCount / totalCount) * 100) : 0
  const level = calculateCoverageLevel(percentage)

  return {
    percentage,
    level,
    source: 'local',
    label: `${evidencedCount}/${totalCount} edges`,
    counts: {
      evidenced: evidencedCount,
      total: totalCount,
    },
  }
}

/**
 * Get the best available evidence coverage, preferring local counts
 * for real-time accuracy, with backend fallback.
 *
 * P0.2: This function establishes the canonical priority order:
 * 1. Local edge provenance counts (most accurate, real-time)
 * 2. Backend graph_quality.evidence_coverage (engine assessment)
 * 3. Null if neither available
 *
 * @param localCounts - Local edge counts { evidenced, total }
 * @param backendPercentage - Backend evidence_coverage (0.0–1.0)
 * @returns Best available NormalizedEvidenceCoverage or null
 */
export function getBestEvidenceCoverage(
  localCounts?: { evidenced: number; total: number } | null,
  backendPercentage?: number | null
): NormalizedEvidenceCoverage | null {
  // Prefer local counts for real-time accuracy
  if (localCounts && localCounts.total > 0) {
    return fromLocalCounts(localCounts.evidenced, localCounts.total)
  }

  // Fall back to backend percentage
  if (typeof backendPercentage === 'number' && !isNaN(backendPercentage)) {
    return fromBackendPercentage(backendPercentage)
  }

  return null
}
