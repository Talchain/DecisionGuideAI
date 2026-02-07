/**
 * HeroSection Component (Restructured)
 *
 * Primary answer section for Results Panel:
 * - Two-line headline: "{Winner} performs best" + sub-line
 * - 3 data-grounded bullets (comparative, drivers, risk)
 * - Stability label with short text + "More ▸" toggle
 * - "More" expand: expanded stability text + tier coaching + nested technical detail
 *
 * Design principles:
 * - Never render PLoT story_headlines as user-facing copy
 * - Never show raw normalised values without units
 * - All factor/option names are GraphLinks (or plain text fallback)
 * - Default hero: no jargon; "More" expand: light technical permitted
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
  refs?: Array<{ id: string; label: string }>
}

/** Structured headline with main + optional sub-line */
interface StructuredHeadline {
  main: string
  sub: string | null
}

/** Props for HeroSection */
export interface HeroSectionProps {
  winnerLabel: string
  winnerId: string
  winnerGoalProbability?: number | null
  winnerWinProbability?: number | null
  runnerUpLabel?: string
  runnerUpId?: string
  runnerUpGoalProbability?: number | null
  runnerUpWinProbability?: number | null
  optionCount: number
  hasBaseline: boolean
  recommendationStability?: number
  analysisStatus: 'computed' | 'partial' | 'failed' | 'blocked'
  topDrivers?: Array<{ id: string; label: string; direction?: 'positive' | 'negative' }>
  topFragileEdge?: {
    fromId: string
    fromLabel: string
    toId: string
    toLabel: string
    alternativeWinnerLabel: string
    switchProbability?: number
    labelsResolved?: boolean
  }
  nSamples?: number
  seedUsed?: number
  responseHash?: string
  fragileEdgeCount?: number
  robustEdgeCount?: number
  goalLabel?: string
  goalThreshold?: number | null
  coachingReadiness?: 'ready' | 'close_call' | 'needs_evidence' | 'needs_framing'
  coachingReadinessScore?: number
  m2Headline?: string
  m2Bullets?: [RichText, RichText, RichText]
  m2CoachingParagraph?: RichText
  m2BiasInsights?: string[]
  onFocusNode?: (nodeId: string) => void
}

// =============================================================================
// Helpers
// =============================================================================

function formatPercent(value: number): string {
  const percent = value * 100
  if (Math.abs(percent) < 1 && percent !== 0) {
    return `${percent.toFixed(1)}%`
  }
  return `${Math.round(percent)}%`
}

/** Stability tier with label, colour, short text, expanded text, and coaching. */
function getStabilityTier(stability: number | undefined): {
  label: string
  colorClass: string
  shortText: string
  expandedText: string
  coaching: string | null
} {
  if (stability == null) {
    return { label: '', colorClass: '', shortText: '', expandedText: '', coaching: null }
  }
  if (stability >= 0.85) {
    return {
      label: 'Stable result',
      colorClass: 'text-success',
      shortText: 'Even if estimates are off',
      expandedText: 'Result stays the same even if estimates are off.',
      coaching: null, // No coaching for stable results
    }
  }
  if (stability >= 0.70) {
    return {
      label: 'Mostly stable',
      colorClass: 'text-success',
      shortText: 'Under most assumptions',
      expandedText: 'Result stays the same under most assumptions.',
      coaching: 'The analysis is consistent under most assumptions. A few edge cases could shift the outcome.',
    }
  }
  if (stability >= 0.55) {
    return {
      label: 'Sensitive to assumptions',
      colorClass: 'text-warning',
      shortText: 'Review key inputs',
      expandedText: 'Result changes under different assumptions — review key inputs.',
      coaching: 'Result changes under different assumptions — small changes could shift the recommendation.',
    }
  }
  return {
    label: 'Highly sensitive',
    colorClass: 'text-danger',
    shortText: 'Treat as directional',
    expandedText: 'Small changes in assumptions change the result — treat as directional.',
    coaching: 'Small changes in assumptions change the result — consider strengthening key assumptions before committing.',
  }
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * GraphLink — Clickable element that focuses a node on the canvas.
 * C9: Dev-only console warning when falling back to plain text.
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
  if (!nodeId) {
    if (import.meta.env.DEV) {
      console.warn(`GraphLink fallback: node ${nodeId} ("${label}") not found in graph`)
    }
    return <span className={className}>{label}</span>
  }

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

/** Render RichText (structured spans from M2). */
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

/** Render M1 bullet text with clickable GraphLinks for refs. */
function M1BulletRenderer({
  bullet,
  onFocusNode,
}: {
  bullet: M1Bullet
  onFocusNode?: (nodeId: string) => void
}) {
  const { text, refs } = bullet

  if (!refs || refs.length === 0) {
    return <>{text}</>
  }

  const segments: Array<{ type: 'text'; text: string } | { type: 'ref'; id: string; label: string }> = []

  let remainingText = text

  const sortedRefs = [...refs].sort((a, b) => {
    const posA = text.indexOf(a.label)
    const posB = text.indexOf(b.label)
    return posA - posB
  })

  for (const ref of sortedRefs) {
    const index = remainingText.indexOf(ref.label)
    if (index === -1) continue

    if (index > 0) {
      segments.push({ type: 'text', text: remainingText.slice(0, index) })
    }
    segments.push({ type: 'ref', id: ref.id, label: ref.label })
    remainingText = remainingText.slice(index + ref.label.length)
  }

  if (remainingText.length > 0) {
    segments.push({ type: 'text', text: remainingText })
  }

  return (
    <>
      {segments.map((segment, i) => {
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
  winnerWinProbability,
  runnerUpLabel,
  runnerUpId,
  runnerUpGoalProbability,
  runnerUpWinProbability,
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
  coachingReadiness,
  coachingReadinessScore,
  m2Headline,
  m2Bullets,
  m2CoachingParagraph,
  m2BiasInsights,
  onFocusNode,
}: HeroSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // =========================================================================
  // Headline (two-line: main + sub)
  // =========================================================================
  const m1Headline = useMemo<StructuredHeadline>(() => {
    // Precedence 1: Partial analysis
    if (analysisStatus === 'partial') {
      return { main: 'Some analysis steps did not complete', sub: 'Results are partial' }
    }

    // Precedence 2: Low stability (< 0.55) AND close options
    if (recommendationStability != null && recommendationStability < 0.55) {
      return {
        main: 'No clear winner — results are sensitive to assumptions',
        sub: `Options perform similarly — ${winnerLabel} wins slightly more often`,
      }
    }

    // Precedence 3: Goal probability present
    if (winnerGoalProbability != null && goalThreshold != null) {
      return {
        main: `${winnerLabel} performs best`,
        sub: `${formatPercent(winnerGoalProbability)} chance of hitting your target`,
      }
    }

    // Precedence 4: Fallback — no target set
    return {
      main: `${winnerLabel} performs best`,
      sub: optionCount > 1 ? 'Set a success target to see the likelihood of achieving your goal' : null,
    }
  }, [analysisStatus, recommendationStability, winnerGoalProbability, goalThreshold, winnerLabel, optionCount])

  // M2 headline override (only when stability >= 0.55)
  const headline = useMemo<StructuredHeadline>(() => {
    if (m2Headline && (recommendationStability == null || recommendationStability >= 0.55)) {
      return { main: m2Headline, sub: m1Headline.sub }
    }
    return m1Headline
  }, [m2Headline, recommendationStability, m1Headline])

  // =========================================================================
  // Bullets (3 data-grounded)
  // =========================================================================
  const m1Bullets = useMemo<M1Bullet[]>(() => {
    const bullets: M1Bullet[] = []
    const isLowStability = recommendationStability != null && recommendationStability < 0.55

    // Bullet 1: Comparative
    if (optionCount === 1) {
      bullets.push({
        text: 'Only one option analysed — consider adding alternatives for comparison',
      })
    } else if (winnerGoalProbability != null && runnerUpGoalProbability != null && goalThreshold != null) {
      const suffix = isLowStability ? ' — a narrow gap' : ''
      bullets.push({
        text: `${formatPercent(winnerGoalProbability)} vs ${formatPercent(runnerUpGoalProbability)} chance of achieving your goal${suffix}`,
        refs: [
          { id: winnerId, label: winnerLabel },
          ...(runnerUpId && runnerUpLabel ? [{ id: runnerUpId, label: runnerUpLabel }] : []),
        ],
      })
    } else if (isLowStability) {
      bullets.push({
        text: `Options perform similarly — ${winnerLabel} wins slightly more often`,
        refs: [{ id: winnerId, label: winnerLabel }],
      })
    } else if (winnerWinProbability != null && runnerUpLabel) {
      // Concrete win probability comparison — complement fallback when runner-up wp missing
      const rwp = runnerUpWinProbability ?? (optionCount === 2 ? 1 - winnerWinProbability : null)
      const suffix = rwp != null ? ` vs ${formatPercent(rwp)} for ${runnerUpLabel}` : ` of simulations`
      bullets.push({
        text: `Wins ${formatPercent(winnerWinProbability)}${suffix}`,
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

      if (topFragileEdge.labelsResolved === false) {
        bullets.push({
          text: "Some assumptions could change the result — expand 'What needs attention' for details",
        })
      } else {
        bullets.push({
          text: `If ${fromLabel} → ${toLabel} is weaker than expected, ${altLabel} becomes stronger`,
          refs: [
            { id: topFragileEdge.fromId, label: fromLabel },
            { id: topFragileEdge.toId, label: toLabel },
          ],
        })
      }
    } else {
      bullets.push({
        text: 'No assumptions tested could change this result',
      })
    }

    return bullets
  }, [
    optionCount, winnerGoalProbability, runnerUpGoalProbability, goalThreshold,
    winnerLabel, winnerId, runnerUpLabel, runnerUpId,
    winnerWinProbability, runnerUpWinProbability,
    topDrivers, topFragileEdge, recommendationStability,
  ])

  const bullets = m2Bullets ?? m1Bullets

  // =========================================================================
  // Stability
  // =========================================================================
  const stabilityTier = getStabilityTier(recommendationStability)
  const stabilityPct = recommendationStability != null
    ? Math.round(recommendationStability * 100)
    : null

  // =========================================================================
  // "More" expand content
  // =========================================================================
  const hasM2Coaching = m2CoachingParagraph && m2CoachingParagraph.length > 0
  const hasBiasInsights = m2BiasInsights && m2BiasInsights.length > 0

  // =========================================================================
  // Render
  // =========================================================================
  return (
    <div className="space-y-4" data-testid="hero-section">
      {/* Main hero card */}
      <div className="p-4 bg-panel border border-panel-border rounded-lg">
        {/* Headline — two-line */}
        <h2 className={`${typography.h3} text-text-header`}>
          {headline.main}
        </h2>
        {headline.sub && (
          <p className={`${typography.body} text-text-body mt-1 mb-3`}>
            {headline.sub}
          </p>
        )}
        {!headline.sub && <div className="mb-3" />}

        {/* 3 Bullets */}
        <ul className="space-y-2 mb-4">
          {(Array.isArray(bullets) ? bullets : m1Bullets).map((bullet, index) => {
            const isRichText = Array.isArray(bullet) && bullet.length > 0 && typeof bullet[0] === 'object' && 'type' in bullet[0]

            return (
              <li
                key={index}
                className={`flex items-start gap-2 ${typography.body} text-text-body`}
              >
                <span className="text-text-light flex-shrink-0 mt-0.5">·</span>
                <span className="flex-1 min-w-0">
                  {isRichText ? (
                    <RichTextRenderer
                      content={bullet as RichText}
                      onFocusNode={onFocusNode}
                    />
                  ) : (
                    <M1BulletRenderer
                      bullet={bullet as M1Bullet}
                      onFocusNode={onFocusNode}
                    />
                  )}
                </span>
              </li>
            )
          })}
        </ul>

        {/* Stability + More toggle */}
        <div className="border-t border-panel-border pt-3">
          <div className="flex items-center gap-3">
            {stabilityTier.label && (
              <span className={`${typography.caption} ${stabilityTier.colorClass} font-medium`}>
                {stabilityTier.label}
              </span>
            )}
            {stabilityTier.shortText && (
              <span className={`${typography.caption} text-text-light`}>
                {stabilityTier.shortText}
              </span>
            )}
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`flex items-center gap-1 ${typography.caption} text-info hover:text-info-hover flex-shrink-0`}
              aria-expanded={isExpanded}
              aria-controls="hero-more-content"
            >
              <span>{isExpanded ? 'Less' : 'More'}</span>
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>

        {/* "More" expand — inside the hero card */}
        {isExpanded && (
          <div
            id="hero-more-content"
            className="mt-3 pt-3 space-y-4"
          >
            {/* Expanded stability explanation */}
            {stabilityTier.expandedText && (
              <div className="space-y-2">
                <p className={`${typography.body} text-text-body`}>
                  {stabilityTier.expandedText}
                </p>
                {stabilityPct != null && (
                  <p className={`${typography.caption} text-text-light`}>
                    We varied each assumption in your model — the recommendation stayed the same in {stabilityPct}% of variations.
                  </p>
                )}
              </div>
            )}

            {/* Tier-gated coaching (only when stability < 0.85) */}
            {stabilityTier.coaching && (
              <div className="p-3 bg-info-light border border-info/30 rounded-lg">
                <p className={`${typography.caption} text-text-body`}>
                  {stabilityTier.coaching}
                </p>
              </div>
            )}

            {/* M2 coaching paragraph */}
            {hasM2Coaching && (
              <div className="space-y-2">
                <p className={`${typography.body} text-text-body`}>
                  <RichTextRenderer
                    content={m2CoachingParagraph!}
                    onFocusNode={onFocusNode}
                  />
                </p>
              </div>
            )}

            {/* M2 bias insights */}
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

            {/* Nested technical detail — P1-3: Olumi styled */}
            <details className="group bg-panel border border-panel-border rounded-xl">
              <summary className={`px-4 py-3 ${typography.label} text-text-body font-medium cursor-pointer hover:text-text-header select-none`}>
                Technical detail
              </summary>
              <dl className={`px-4 pb-3 grid grid-cols-2 gap-x-4 gap-y-1 ${typography.caption}`}>
                {recommendationStability != null && (
                  <>
                    <dt className="text-text-light">Stability</dt>
                    <dd className="text-text-header">{stabilityPct}%</dd>
                  </>
                )}
                {fragileEdgeCount != null && (
                  <>
                    <dt className="text-text-light">Fragile edges</dt>
                    <dd className="text-text-header">{fragileEdgeCount}</dd>
                  </>
                )}
                {robustEdgeCount != null && (
                  <>
                    <dt className="text-text-light">Stable edges</dt>
                    <dd className="text-text-header">{robustEdgeCount}</dd>
                  </>
                )}
                {nSamples != null && (
                  <>
                    <dt className="text-text-light">Simulations run</dt>
                    <dd className="text-text-header">{nSamples.toLocaleString()}</dd>
                  </>
                )}
                {seedUsed != null && (
                  <>
                    <dt className="text-text-light">Seed</dt>
                    <dd className="text-text-header font-mono">{seedUsed}</dd>
                  </>
                )}
                {responseHash && (
                  <>
                    <dt className="text-text-light">Result hash</dt>
                    <dd className="text-text-header font-mono truncate" title={responseHash}>
                      {responseHash.slice(0, 12)}...
                    </dd>
                  </>
                )}
              </dl>
            </details>
          </div>
        )}
      </div>
    </div>
  )
}

export default HeroSection
