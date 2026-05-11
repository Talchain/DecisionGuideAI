/**
 * CEE Data Adapter
 *
 * Extracts and normalizes data from CEE responses with fallbacks to PLoT data.
 * Used by the restructured Results Panel to get plain English rationale,
 * readiness status, improvement suggestions, and insights.
 */

import type {
  CeeDecisionReviewPayloadV1,
  ReviewBlock,
  ReadinessLevel,
  ReadinessFactor,
  BlockId,
  M1Review,
} from '../../types/cee'
import { devWarn } from '../../utils/debugLog'
import { trackEvent } from '../../lib/posthog'
import type { CeeDecisionReviewPayload } from '../decisionReview/types'
import type { ReportV1 } from '../../adapters/plot/types'

// =============================================================================
// Types
// =============================================================================

export interface Rationale {
  headline: string
  drivers: Array<{ label: string; explanation?: string }>
  source: 'cee' | 'legacy' | 'plot' | 'none'
}

export interface ReadinessData {
  level: ReadinessLevel
  headline: string
  factors: ReadinessFactor[]
  source: 'cee' | 'fallback'
}

export interface ImprovementItem {
  label: string
  description?: string
  severity?: 'low' | 'medium' | 'high'
  type: 'gap' | 'next_step'
}

export interface Insight {
  label: string
  description?: string
  severity?: 'low' | 'medium' | 'high'
  type: 'bias' | 'risk'
}

// =============================================================================
// Helper Functions
// =============================================================================

function findBlock(blocks: ReviewBlock[] | undefined, id: BlockId): ReviewBlock | undefined {
  return blocks?.find((b) => b.id === id)
}

function isValidBlock(block: ReviewBlock | undefined): block is ReviewBlock {
  return block !== undefined && block.status === 'ok'
}

// =============================================================================
// Runtime Validation Guards
// =============================================================================

/**
 * Validate that a ReviewBlock has the expected structure.
 * Used to catch malformed CEE responses at runtime.
 */
export function isValidReviewBlock(block: unknown): block is ReviewBlock {
  if (typeof block !== 'object' || block === null) return false
  const b = block as Record<string, unknown>
  return (
    typeof b.id === 'string' &&
    typeof b.status === 'string' &&
    typeof b.source === 'string'
  )
}

/**
 * Validate that a ReadinessFactor has the expected structure.
 */
export function isValidReadinessFactor(factor: unknown): factor is ReadinessFactor {
  if (typeof factor !== 'object' || factor === null) return false
  const f = factor as Record<string, unknown>
  return (
    typeof f.label === 'string' &&
    typeof f.status === 'string' &&
    ['ok', 'warning', 'blocking'].includes(f.status as string)
  )
}

/**
 * Validate CEE Decision Review payload structure.
 * Filters out invalid blocks and factors to prevent crashes.
 * Logs warnings when sanitisation is applied.
 */
export function sanitizeCeeReviewPayload(
  payload: CeeDecisionReviewPayloadV1 | null | undefined
): CeeDecisionReviewPayloadV1 | null {
  if (!payload) return null

  // Track sanitisation changes for observability
  const originalBlockCount = Array.isArray(payload.blocks) ? payload.blocks.length : 0
  const originalFactorCount = Array.isArray(payload.readiness?.factors) ? payload.readiness.factors.length : 0

  // Ensure blocks is an array and filter invalid entries
  const blocks = Array.isArray(payload.blocks)
    ? payload.blocks.filter(isValidReviewBlock)
    : []

  // Ensure readiness factors are valid
  const readiness = payload.readiness
    ? {
        ...payload.readiness,
        factors: Array.isArray(payload.readiness.factors)
          ? payload.readiness.factors.filter(isValidReadinessFactor)
          : [],
      }
    : undefined

  // Track removed items
  const removedBlocks = originalBlockCount - blocks.length
  const removedFactors = originalFactorCount - (readiness?.factors?.length ?? 0)

  // Log warning and emit telemetry if sanitisation was applied.
  // Telemetry tracks shape failure frequency — needed to justify backend retry
  // implementation. A frontend retry would require a new orchestrator turn with
  // a system_event like 'review_shape_failure' so CEE can re-extract the review
  // with a tighter prompt. Not currently implemented because the LLM extraction
  // happens entirely on the CEE backend; the frontend only receives the result.
  if (removedBlocks > 0 || removedFactors > 0) {
    devWarn('CEE Sanitisation', 'Applied to CeeReviewPayload', {
      removedBlocks,
      removedFactors,
      originalBlockCount,
      originalFactorCount,
      finalBlockCount: blocks.length,
      finalFactorCount: readiness?.factors?.length ?? 0,
    })
    trackEvent('ui.cee_review.shape_sanitised', {
      removed_blocks: removedBlocks,
      removed_factors: removedFactors,
      original_block_count: originalBlockCount,
      final_block_count: blocks.length,
    })
  }

  return {
    ...payload,
    blocks,
    readiness,
  }
}

/**
 * Validate M1 Review payload structure.
 * Ensures arrays are arrays, filters invalid insights/guidance entries.
 * Returns null if payload is null/undefined.
 */
export function sanitizeM1Review(
  payload: M1Review | null | undefined
): M1Review | null {
  if (!payload) return null

  // Ensure insights is an array of valid items
  const insights = Array.isArray(payload.insights)
    ? payload.insights.filter(
        (i) => i && typeof i.id === 'string' && typeof i.content === 'string'
      )
    : null

  // Ensure improvement_guidance is an array of valid items
  const improvement_guidance = Array.isArray(payload.improvement_guidance)
    ? payload.improvement_guidance.filter(
        (g) => g && typeof g.action === 'string' && typeof g.reason === 'string'
      )
    : null

  return {
    ...payload,
    insights,
    improvement_guidance,
  }
}

// =============================================================================
// Rationale Extraction
// =============================================================================

/**
 * Returns decision rationale from the best available source.
 *
 * Priority order (highest to lowest):
 * 0. M1 Review (m1Review.rationale) - Enhanced contextualised narrative from PLoT /v2/run CEE enrichment
 * 1. CEE Review V1 (ceeReviewV1.blocks) - Structured review blocks (drivers/recommendation)
 * 2. Legacy CEE (ceeReview.story) - Original narrative format
 * 3. Report drivers (report.drivers) - Fallback to raw driver data from PLoT
 * 4. Empty fallback - Generic "No rationale available" message
 *
 * Components should not need to know the source - this function
 * provides a unified interface regardless of which data is available.
 * The `source` field in the return value indicates which data was used,
 * useful for debugging but not for conditional UI rendering.
 *
 * @param ceeReviewV1 - CEE V1 review payload (structured blocks format)
 * @param ceeReview - Legacy CEE review payload (story format)
 * @param report - PLoT report with driver data
 * @param m1Review - M1 Review enrichment from PLoT /v2/run
 * @returns Unified Rationale object with headline, drivers, and source indicator
 */
export function getRationale(
  ceeReviewV1: CeeDecisionReviewPayloadV1 | null | undefined,
  ceeReview: CeeDecisionReviewPayload | null | undefined,
  report: ReportV1 | null | undefined,
  m1Review?: M1Review | null
): Rationale {
  // 0. Try M1 Review rationale (highest priority - direct from PLoT /v2/run)
  if (m1Review?.rationale?.summary) {
    return {
      headline: m1Review.rationale.summary,
      drivers: m1Review.rationale.key_driver
        ? [{ label: m1Review.rationale.key_driver, explanation: m1Review.rationale.confidence_explanation }]
        : [],
      source: 'cee',
    }
  }

  // 1. Try CEE V1 blocks
  if (ceeReviewV1?.blocks) {
    const driversBlock = findBlock(ceeReviewV1.blocks, 'drivers')
    const recommendationBlock = findBlock(ceeReviewV1.blocks, 'recommendation')

    if (isValidBlock(driversBlock)) {
      return {
        headline: driversBlock.summary,
        drivers:
          driversBlock.items?.map((item) => ({
            label: item.label,
            explanation: item.description,
          })) ?? [],
        source: 'cee',
      }
    }

    if (isValidBlock(recommendationBlock)) {
      return {
        headline: recommendationBlock.summary,
        drivers: [],
        source: 'cee',
      }
    }
  }

  // 2. Try legacy CEE story
  if (ceeReview?.story) {
    const { headline, key_drivers } = ceeReview.story
    if (headline || (key_drivers && key_drivers.length > 0)) {
      return {
        headline: headline ?? 'Based on your model',
        drivers:
          key_drivers?.map((d) => ({
            label: d.label,
            explanation: d.why,
          })) ?? [],
        source: 'legacy',
      }
    }
  }

  // 3. Try PLoT report drivers
  if (report?.drivers && report.drivers.length > 0) {
    const topDriver = report.drivers[0]
    return {
      headline: `Key driver: ${topDriver.label}`,
      drivers: report.drivers.slice(0, 3).map((d) => ({
        label: d.label,
        explanation: undefined,
      })),
      source: 'plot',
    }
  }

  // 4. No data available
  return {
    headline: '',
    drivers: [],
    source: 'none',
  }
}

// =============================================================================
// Readiness Extraction
// =============================================================================

/**
 * Extract decision quality readiness status.
 *
 * Priority:
 * 1. CEE V1 readiness
 * 2. Synthesized fallback from graph_quality
 */
export function getReadiness(
  ceeReviewV1: CeeDecisionReviewPayloadV1 | null | undefined,
  report: ReportV1 | null | undefined
): ReadinessData {
  // 1. Try CEE V1 readiness
  if (ceeReviewV1?.readiness) {
    return {
      level: ceeReviewV1.readiness.level,
      headline: ceeReviewV1.readiness.headline,
      factors: ceeReviewV1.readiness.factors,
      source: 'cee',
    }
  }

  // 2. Synthesize from graph_quality
  if (report?.graph_quality) {
    const { score, completeness, evidence_coverage, balance } = report.graph_quality
    const normalizedScore = score * 100

    let level: ReadinessLevel
    let headline: string

    if (normalizedScore >= 70) {
      level = 'ready'
      headline = 'Analysis is reliable for decision-making'
    } else if (normalizedScore >= 40) {
      level = 'caution'
      headline = 'Analysis provides directional guidance'
    } else {
      level = 'not_ready'
      headline = 'Model needs improvement before relying on results'
    }

    const factors: ReadinessFactor[] = []

    // Completeness factor
    if (completeness !== undefined) {
      factors.push({
        label: 'Graph completeness',
        status: completeness >= 0.7 ? 'ok' : completeness >= 0.4 ? 'warning' : 'blocking',
      })
    }

    // Evidence factor
    if (evidence_coverage !== undefined) {
      factors.push({
        label: 'Evidence coverage',
        status: evidence_coverage >= 0.7 ? 'ok' : evidence_coverage >= 0.4 ? 'warning' : 'blocking',
      })
    }

    // Balance factor
    if (balance !== undefined) {
      factors.push({
        label: 'Factor balance',
        status: balance >= 0.7 ? 'ok' : balance >= 0.4 ? 'warning' : 'blocking',
      })
    }

    return {
      level,
      headline,
      factors,
      source: 'fallback',
    }
  }

  // 3. No data available - show as unavailable, not as "not ready"
  // This distinguishes between CEE timeout (transient unavailability) and
  // legitimate analysis issues. Using 'caution' avoids implying user action.
  return {
    level: 'caution',
    headline: 'AI review unavailable',
    factors: [],
    source: 'fallback',
  }
}

// =============================================================================
// Improvement Suggestions
// =============================================================================

/**
 * Extract actionable improvement suggestions.
 *
 * Priority:
 * 1. CEE V1 blocks[id='gaps'] + blocks[id='next_steps']
 * 2. Legacy CEE story.next_actions
 * 3. PLoT report.insights.next_steps
 */
export function getImprovements(
  ceeReviewV1: CeeDecisionReviewPayloadV1 | null | undefined,
  ceeReview: CeeDecisionReviewPayload | null | undefined,
  report: ReportV1 | null | undefined
): ImprovementItem[] {
  const improvements: ImprovementItem[] = []

  // 1. Try CEE V1 blocks
  if (ceeReviewV1?.blocks) {
    const gapsBlock = findBlock(ceeReviewV1.blocks, 'gaps')
    const nextStepsBlock = findBlock(ceeReviewV1.blocks, 'next_steps')

    if (isValidBlock(gapsBlock) && gapsBlock.items) {
      improvements.push(
        ...gapsBlock.items.map((item) => ({
          label: item.label,
          description: item.description,
          severity: item.severity,
          type: 'gap' as const,
        }))
      )
    }

    if (isValidBlock(nextStepsBlock) && nextStepsBlock.items) {
      improvements.push(
        ...nextStepsBlock.items.map((item) => ({
          label: item.label,
          description: item.description,
          severity: item.severity,
          type: 'next_step' as const,
        }))
      )
    }

    if (improvements.length > 0) {
      return improvements
    }
  }

  // 2. Try legacy CEE story
  if (ceeReview?.story?.next_actions) {
    return ceeReview.story.next_actions.map((action) => ({
      label: action.label,
      description: action.why,
      type: 'next_step' as const,
    }))
  }

  // 3. Try PLoT insights
  if (report?.insights?.next_steps) {
    return report.insights.next_steps.map((step) => ({
      label: step,
      type: 'next_step' as const,
    }))
  }

  return []
}

// =============================================================================
// Insights (Biases + Risks)
// =============================================================================

/**
 * Extract insights about biases and risks.
 *
 * Priority:
 * 1. CEE V1 blocks[id='biases'] + blocks[id='risks']
 * 2. PLoT report.insights.risks
 */
export function getInsights(
  ceeReviewV1: CeeDecisionReviewPayloadV1 | null | undefined,
  report: ReportV1 | null | undefined
): Insight[] {
  const insights: Insight[] = []

  // 1. Try CEE V1 blocks
  if (ceeReviewV1?.blocks) {
    const biasesBlock = findBlock(ceeReviewV1.blocks, 'biases')
    const risksBlock = findBlock(ceeReviewV1.blocks, 'risks')

    if (isValidBlock(biasesBlock) && biasesBlock.items) {
      insights.push(
        ...biasesBlock.items.map((item) => ({
          label: item.label,
          description: item.description,
          severity: item.severity,
          type: 'bias' as const,
        }))
      )
    }

    if (isValidBlock(risksBlock) && risksBlock.items) {
      insights.push(
        ...risksBlock.items.map((item) => ({
          label: item.label,
          description: item.description,
          severity: item.severity,
          type: 'risk' as const,
        }))
      )
    }

    if (insights.length > 0) {
      return insights
    }
  }

  // 2. Try PLoT insights.risks
  if (report?.insights?.risks) {
    return report.insights.risks.map((risk) => ({
      label: risk,
      type: 'risk' as const,
    }))
  }

  return []
}

// =============================================================================
// Convenience: Check if CEE data is available
// =============================================================================

export function hasCeeData(
  ceeReviewV1: CeeDecisionReviewPayloadV1 | null | undefined,
  ceeReview: CeeDecisionReviewPayload | null | undefined
): boolean {
  return !!(ceeReviewV1?.blocks?.length || ceeReview?.story)
}
