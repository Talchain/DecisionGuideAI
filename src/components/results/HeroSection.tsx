/**
 * HeroSection Component (P1 Task 1)
 *
 * Restructured hero section for Results Panel with:
 * - M1 deterministic headline with precedence rules
 * - 3 data-grounded bullets (comparative, drivers, risk)
 * - Stability label (single line, tiered)
 * - "Learn more" expand with coaching narrative
 *
 * Design principles:
 * - Never render PLoT story_headlines as user-facing copy
 * - Never show raw normalised values without units
 * - Default hero: no jargon; "Learn more" expand: light technical permitted
 */

import { useState, useCallback, useMemo } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { typography } from '../../styles/typography'
import { stripEncodingNotation } from './utils/cleanFactorLabel'
import { focusNodeById } from '../../canvas/utils/focusHelpers'

// =============================================================================
// Types
// =============================================================================

/** Structured span for M2 content with clickable refs */
export type RichSegment =
  | { type: 'text'; text: string }
  | { type: 'ref'; id: string; label: string }

export type RichText = RichSegment[]

/** M1 bullet data */
interface M1Bullet {
  text: string
  /** Optional refs for clickable elements (M1 uses pre-computed refs) */
  refs?: Array<{ id: string; label: string }>
}

/** Props for HeroSection */
export interface HeroSectionProps {
  // Recommendation data
  winnerLabel: string
  winnerId: string
  winnerGoalProbability?: number | null
  runnerUpLabel?: string
  runnerUpId?: string
  runnerUpGoalProbability?: number | null
  optionCount: number
  hasBaseline: boolean

  // Stability/robustness
  recommendationStability?: number
  analysisStatus: 'computed' | 'partial' | 'failed' | 'blocked'

  // Drivers (top 2 for bullet)
  topDrivers?: Array<{ id: string; label: string; direction?: 'positive' | 'negative' }>

  // Fragile edge (top 1 for bullet)
  topFragileEdge?: {
    fromId: string
    fromLabel: string
    toId: string
    toLabel: string
    alternativeWinnerLabel: string
    switchProbability?: number
  }

  // Technical details for "Learn more" expand
  nSamples?: number
  seedUsed?: number
  responseHash?: string
  fragileEdgeCount?: number
  robustEdgeCount?: number

  // Goal info
  goalLabel?: string
  goalThreshold?: number | null

  // M2 content slots (optional, swaps in after M2 loads)
  m2Headline?: string
  m2Bullets?: [RichText, RichText, RichText]
  m2CoachingParagraph?: RichText
  m2BiasInsights?: string[]

  // Callbacks
  onFocusNode?: (nodeId: string) => void
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format probability (0-1) as percentage.
 * Shows one decimal for small values (< 1%) to avoid rounding to 0%.
 */
function formatPercent(value: number): string {
  const percent = value * 100
  if (Math.abs(percent) < 1 && percent !== 0) {
    return `${percent.toFixed(1)}%`
  }
  return `${Math.round(percent)}%`
}

/**
 * Get stability tier label and color.
 * Per P0 spec:
 * - >= 0.85: "Stable result"
 * - >= 0.70: "Mostly stable"
 * - >= 0.55: "Sensitive to assumptions"
 * - < 0.55: "Highly sensitive"
 */
function getStabilityTier(stability: number | undefined): {
  label: string
  colorClass: string
} {
  if (stability == null) {
    return { label: '', colorClass: '' }
  }
  if (stability >= 0.85) {
    return { label: 'Stable result', colorClass: 'text-success' }
  }
  if (stability >= 0.70) {
    return { label: 'Mostly stable', colorClass: 'text-success' }
  }
  if (stability >= 0.55) {
    return { label: 'Sensitive to assumptions', colorClass: 'text-warning' }
  }
  return { label: 'Highly sensitive', colorClass: 'text-danger' }
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * GraphLink - Clickable element that focuses a node on the canvas.
 * Styling: Inherit text colour, underline on hover, cursor pointer.
 */
function GraphLink({
  nodeId,
  label,
  onFocus,
  className = '',
}: {
  nodeId: string
  label: string
  onFocus?: (nodeId: string) => void
  className?: string
}) {
  const handleClick = useCallback(() => {
    if (onFocus) {
      onFocus(nodeId)
    } else {
      focusNodeById(nodeId)
    }
  }, [nodeId, onFocus])

  return (
    <span
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
      className={`cursor-pointer hover:underline focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-1 rounded ${className}`}
      aria-label={`Focus on ${label} in model`}
    >
      {label}
    </span>
  )
}

/**
 * Render RichText (structured spans from M2).
 * - text segments: plain span
 * - ref segments: GraphLink
 */
function RichTextRenderer({
  content,
  onFocusNode,
}: {
  content: RichText
  onFocusNode?: (nodeId: string) => void
}) {
  return (
    <>
      {content.map((segment, i) => {
        if (segment.type === 'text') {
          return <span key={i}>{segment.text}</span>
        }
        return (
          <GraphLink
            key={i}
            nodeId={segment.id}
            label={segment.label}
            onFocus={onFocusNode}
          />
        )
      })}
    </>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export function HeroSection({
  winnerLabel,
  winnerId,
  winnerGoalProbability,
  runnerUpLabel,
  runnerUpId,
  runnerUpGoalProbability,
  optionCount,
  hasBaseline,
  recommendationStability,
  analysisStatus,
  topDrivers,
  topFragileEdge,
  nSamples,
  seedUsed,
  responseHash,
  fragileEdgeCount,
  robustEdgeCount,
  goalLabel,
  goalThreshold,
  m2Headline,
  m2Bullets,
  m2CoachingParagraph,
  m2BiasInsights,
  onFocusNode,
}: HeroSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // =========================================================================
  // M1 Headline (Task 2: Deterministic templates with precedence)
  // =========================================================================
  const m1Headline = useMemo(() => {
    // Precedence rule 1: Partial analysis
    if (analysisStatus === 'partial') {
      return 'Some analysis steps did not complete — results are partial'
    }

    // Precedence rule 2: Low stability (< 0.55)
    if (recommendationStability != null && recommendationStability < 0.55) {
      return 'No clear front-runner — results are sensitive to assumptions'
    }

    // Precedence rule 3: Goal probability present
    if (winnerGoalProbability != null && goalThreshold != null) {
      return `${winnerLabel} performs strongest — ${formatPercent(winnerGoalProbability)} chance of achieving your goal`
    }

    // Precedence rule 4: Fallback
    return `${winnerLabel} performs strongest`
  }, [analysisStatus, recommendationStability, winnerGoalProbability, goalThreshold, winnerLabel])

  // Use M2 headline if available AND stability is not low (per spec: keep M1 when stability < 0.55)
  const headline = useMemo(() => {
    if (m2Headline && (recommendationStability == null || recommendationStability >= 0.55)) {
      return m2Headline
    }
    return m1Headline
  }, [m2Headline, recommendationStability, m1Headline])

  // =========================================================================
  // M1 Bullets (Task 2: Exactly 3 data-grounded bullets)
  // =========================================================================
  const m1Bullets = useMemo<M1Bullet[]>(() => {
    const bullets: M1Bullet[] = []

    // Bullet 1: Comparative
    if (optionCount === 1) {
      bullets.push({
        text: 'Only one option analysed — consider adding alternatives for comparison',
      })
    } else if (winnerGoalProbability != null && runnerUpGoalProbability != null && goalThreshold != null) {
      bullets.push({
        text: `${formatPercent(winnerGoalProbability)} vs ${formatPercent(runnerUpGoalProbability)} chance of achieving your goal`,
        refs: [
          { id: winnerId, label: winnerLabel },
          ...(runnerUpId && runnerUpLabel ? [{ id: runnerUpId, label: runnerUpLabel }] : []),
        ],
      })
    } else {
      bullets.push({
        text: `${winnerLabel} outperforms alternatives most consistently`,
        refs: [{ id: winnerId, label: winnerLabel }],
      })
    }

    // Bullet 2: Top drivers
    if (topDrivers && topDrivers.length >= 2) {
      const cleanLabel1 = stripEncodingNotation(topDrivers[0].label)
      const cleanLabel2 = stripEncodingNotation(topDrivers[1].label)
      bullets.push({
        text: `${cleanLabel1} and ${cleanLabel2} are the biggest drivers`,
        refs: [
          { id: topDrivers[0].id, label: cleanLabel1 },
          { id: topDrivers[1].id, label: cleanLabel2 },
        ],
      })
    } else if (topDrivers && topDrivers.length === 1) {
      const cleanLabel = stripEncodingNotation(topDrivers[0].label)
      bullets.push({
        text: `${cleanLabel} is the biggest driver`,
        refs: [{ id: topDrivers[0].id, label: cleanLabel }],
      })
    } else {
      bullets.push({
        text: 'No dominant drivers identified — outcome is balanced across factors',
      })
    }

    // Bullet 3: Fragile edge / risk
    if (topFragileEdge) {
      const fromLabel = stripEncodingNotation(topFragileEdge.fromLabel)
      const toLabel = stripEncodingNotation(topFragileEdge.toLabel)
      const altLabel = stripEncodingNotation(topFragileEdge.alternativeWinnerLabel)
      bullets.push({
        text: `If the link between ${fromLabel} and ${toLabel} is weaker than expected, ${altLabel} becomes the stronger option`,
        refs: [
          { id: topFragileEdge.fromId, label: fromLabel },
          { id: topFragileEdge.toId, label: toLabel },
        ],
      })
    } else {
      bullets.push({
        text: 'Result is stable across all assumptions tested',
      })
    }

    return bullets
  }, [
    optionCount,
    winnerGoalProbability,
    runnerUpGoalProbability,
    goalThreshold,
    winnerLabel,
    winnerId,
    runnerUpLabel,
    runnerUpId,
    topDrivers,
    topFragileEdge,
  ])

  // Use M2 bullets if available
  const bullets = m2Bullets ?? m1Bullets

  // =========================================================================
  // Stability label
  // =========================================================================
  const stabilityTier = getStabilityTier(recommendationStability)

  // =========================================================================
  // "Learn more" content (Task 3)
  // =========================================================================
  const m1CoachingNarrative = useMemo(() => {
    if (!nSamples) return null

    const stabilityPct = recommendationStability != null
      ? `${Math.round(recommendationStability * 100)}%`
      : 'unknown'

    // Build narrative based on available data
    let narrative = `Based on ${nSamples.toLocaleString()} simulated scenarios, `

    if (winnerGoalProbability != null && runnerUpGoalProbability != null && goalThreshold != null) {
      narrative += `${winnerLabel} achieves the goal in ${formatPercent(winnerGoalProbability)} of cases compared to ${formatPercent(runnerUpGoalProbability)} for ${runnerUpLabel ?? 'the runner-up'}. `
    } else {
      narrative += `${winnerLabel} outperforms alternatives most consistently. `
    }

    narrative += `The result stays the same in ${stabilityPct} of assumption tests.`

    if (topFragileEdge) {
      const fromLabel = stripEncodingNotation(topFragileEdge.fromLabel)
      const toLabel = stripEncodingNotation(topFragileEdge.toLabel)
      narrative += ` The most sensitive assumption is the relationship between ${fromLabel} and ${toLabel}.`
    }

    return narrative
  }, [
    nSamples,
    recommendationStability,
    winnerLabel,
    winnerGoalProbability,
    runnerUpLabel,
    runnerUpGoalProbability,
    goalThreshold,
    topFragileEdge,
  ])

  // Use M2 coaching paragraph if available
  const hasM2Coaching = m2CoachingParagraph && m2CoachingParagraph.length > 0
  const hasBiasInsights = m2BiasInsights && m2BiasInsights.length > 0

  // =========================================================================
  // Render
  // =========================================================================
  return (
    <div className="space-y-4" data-testid="hero-section">
      {/* Main hero card */}
      <div className="p-4 bg-panel border border-panel-border rounded-lg">
        {/* Headline */}
        <h2 className={`${typography.h3} text-text-header mb-3`}>
          {headline}
        </h2>

        {/* 3 Bullets */}
        <ul className="space-y-2 mb-4">
          {(Array.isArray(bullets) ? bullets : m1Bullets).map((bullet, index) => {
            // M2 bullets are RichText arrays
            const isRichText = Array.isArray(bullet) && bullet.length > 0 && typeof bullet[0] === 'object' && 'type' in bullet[0]

            return (
              <li
                key={index}
                className={`flex items-start gap-2 ${typography.body} text-text-body`}
              >
                <span className="text-text-light flex-shrink-0 mt-0.5">•</span>
                <span>
                  {isRichText ? (
                    <RichTextRenderer
                      content={bullet as RichText}
                      onFocusNode={onFocusNode}
                    />
                  ) : (
                    (bullet as M1Bullet).text
                  )}
                </span>
              </li>
            )
          })}
        </ul>

        {/* Stability label + Learn more link */}
        <div className="flex items-center justify-between border-t border-panel-border pt-3">
          {stabilityTier.label && (
            <span className={`${typography.caption} ${stabilityTier.colorClass}`}>
              {stabilityTier.label}
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center gap-1 ${typography.caption} text-info hover:text-info-hover`}
            aria-expanded={isExpanded}
            aria-controls="hero-learn-more"
          >
            {isExpanded ? (
              <>
                <span>Show less</span>
                <ChevronDown className="w-3 h-3" />
              </>
            ) : (
              <>
                <span>Learn more</span>
                <ChevronRight className="w-3 h-3" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* "Learn more" expand (Task 3) */}
      {isExpanded && (
        <div
          id="hero-learn-more"
          className="p-4 bg-panel border border-panel-border rounded-lg space-y-4"
        >
          {/* Section 1: Coaching narrative (M2 or M1 fallback) */}
          {(hasM2Coaching || m1CoachingNarrative) && (
            <div className="space-y-2">
              <h4 className={`${typography.label} text-text-header`}>
                Analysis summary
              </h4>
              <p className={`${typography.body} text-text-body`}>
                {hasM2Coaching ? (
                  <RichTextRenderer
                    content={m2CoachingParagraph!}
                    onFocusNode={onFocusNode}
                  />
                ) : (
                  m1CoachingNarrative
                )}
              </p>
            </div>
          )}

          {/* Section 2: Bias insights (M2 only) */}
          {hasBiasInsights && (
            <div className="space-y-2">
              <h4 className={`${typography.label} text-text-header`}>
                Questions to consider
              </h4>
              <ul className="space-y-2">
                {m2BiasInsights!.map((insight, i) => (
                  <li
                    key={i}
                    className="p-3 bg-info-light border border-info/30 rounded-lg"
                  >
                    <p className={`${typography.body} text-text-body`}>
                      {insight}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Section 3: Technical detail (always present) */}
          <div className="space-y-2">
            <h4 className={`${typography.label} text-text-header`}>
              Technical details
            </h4>
            <dl className={`grid grid-cols-2 gap-x-4 gap-y-1 ${typography.caption} text-text-light`}>
              {recommendationStability != null && (
                <>
                  <dt>Stability</dt>
                  <dd>{Math.round(recommendationStability * 100)}% of assumption tests</dd>
                </>
              )}
              {fragileEdgeCount != null && (
                <>
                  <dt>Fragile assumptions</dt>
                  <dd>{fragileEdgeCount}</dd>
                </>
              )}
              {robustEdgeCount != null && (
                <>
                  <dt>Stable assumptions</dt>
                  <dd>{robustEdgeCount}</dd>
                </>
              )}
              {nSamples != null && (
                <>
                  <dt>Scenarios simulated</dt>
                  <dd>{nSamples.toLocaleString()}</dd>
                </>
              )}
              {seedUsed != null && (
                <>
                  <dt>Seed</dt>
                  <dd className="font-mono">{seedUsed}</dd>
                </>
              )}
              {responseHash && (
                <>
                  <dt>Result hash</dt>
                  <dd className="font-mono truncate" title={responseHash}>
                    {responseHash.slice(0, 12)}...
                  </dd>
                </>
              )}
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}

export default HeroSection
