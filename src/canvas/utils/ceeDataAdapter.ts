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
  ReviewReadiness,
  ReadinessLevel,
  ReadinessFactor,
  BlockId,
} from '../../types/cee'
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
// Rationale Extraction
// =============================================================================

/**
 * Extract plain English rationale for "Why this option" section.
 *
 * Priority:
 * 1. CEE V1 blocks[id='drivers'] or blocks[id='recommendation']
 * 2. Legacy CEE story.key_drivers
 * 3. PLoT report.drivers
 * 4. Empty fallback
 */
export function getRationale(
  ceeReviewV1: CeeDecisionReviewPayloadV1 | null | undefined,
  ceeReview: CeeDecisionReviewPayload | null | undefined,
  report: ReportV1 | null | undefined
): Rationale {
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

  // 3. No data - assume not ready
  return {
    level: 'not_ready',
    headline: 'Run analysis to assess decision quality',
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
