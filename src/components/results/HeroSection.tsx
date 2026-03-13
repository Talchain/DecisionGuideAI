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

import { useState, useMemo, type ReactNode } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import { getThresholdColour } from './utils/getThresholdColour'
import { typography } from '../../styles/typography'
import { stripEncodingNotation } from './utils/cleanFactorLabel'
import { formatPercent as formatPct } from '../../utils/formatPercent'
import { GraphLink } from './GraphLink'
import { linkifyCoachingText, type LinkEntity } from './utils/linkifyCoachingText'
import { BaselineToggleCard, type BaselineOption } from './BaselineToggleCard'
import { BaselineTargetRow } from './BaselineTargetRow'
import { focusNodeById } from '../../canvas/utils/focusHelpers'
import { highlightNode, clearHighlight } from '../../canvas/utils/highlightHelpers'
import { GAP_THRESHOLD } from './buildResultsVM'
import type { DecisionState, HingeInfo, NextActionItem, RobustnessLevel } from './types'
import type { NearTieInfo } from '../../lib/mappers/types'

// =============================================================================
// Types
// =============================================================================

/** Structured span for M2 content with clickable refs */
export type RichSegment =
  | { type: 'text'; text: string }
  | { type: 'ref'; id: string; label: string }

export type RichText = RichSegment[]

/** Structured headline with main + optional sub-line */
interface StructuredHeadline {
  main: string
  sub: string | null
}

/** Win probability per option for the win gauge */
export interface OptionWinShare {
  id: string
  label: string
  winProbability: number
  isWinner: boolean
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
    alternativeWinnerId?: string
    switchProbability?: number
    labelsResolved?: boolean
  }
  nSamples?: number
  fragileEdgeCount?: number
  goalLabel?: string
  goalThreshold?: number | null
  /** Expected outcome value (mean) for context bullet 2 */
  expectedOutcome?: number | null
  /** Unit type for formatting expected outcome */
  outcomeUnit?: 'currency' | 'percent' | 'count'
  /** Symbol for currency display */
  outcomeUnitSymbol?: string
  /** v7: When true, values are normalised model scores */
  isNormalised?: boolean
  /** Win probabilities per option for win gauge */
  optionWinShares?: OptionWinShare[]
  coachingReadiness?: 'ready' | 'close_call' | 'needs_evidence' | 'needs_framing' | 'low' | 'not_ready'
  coachingReadinessScore?: number
  /** M1 coaching narrative headline (1-line summary) */
  coachingHeadline?: string
  /** M1 coaching full narrative paragraph (for "More detail" expand) */
  coachingParagraph?: string
  /** V12: Executive summary key qualifier */
  coachingKeyQualifier?: string
  /** V12 C1: M2 narrative summary for "Full analysis" expandable */
  m2NarrativeSummary?: string
  /** V12: Readiness dimensions for tooltip */
  coachingReadinessDimensions?: { evidence: number; robustness: number; clarity: number }
  /** V12: Identifiability tag from model card */
  identifiabilityTag?: string | null
  m2Headline?: string
  m2Bullets?: [RichText, RichText, RichText]
  m2CoachingParagraph?: RichText
  m2BiasInsights?: string[]
  onFocusNode?: (nodeId: string) => void
  /** V9.2 Phase 2.3: Cross-highlight — flash an option card when a GraphLink references it */
  onFlashOption?: (optionId: string) => void
  /** Whether an analysis is currently running (for baseline toggle) */
  isRunning?: boolean
  /** Callback to add baseline to decision draft */
  onAddBaseline?: () => void
  /** Callback to set a specific option as baseline by ID */
  onSetBaseline?: (optionId: string) => void
  /** Available options for baseline selection */
  baselineOptions?: BaselineOption[]
  /** Currently selected baseline option label */
  baselineLabel?: string
  /** V11: Tri-state decision classification */
  decisionState?: DecisionState
  /** V11: Deterministic hinge for coaching copy */
  hinge?: HingeInfo | null
  /** V11: Robust edge count for "Fragile edges X of Y" display */
  robustEdgeCount?: number
  /** V14: Near-tie detection for headline */
  nearTie?: NearTieInfo
  /** V14: Top coaching next action */
  topNextAction?: NextActionItem
  /** V14.1: Goal node ID for "Add target" focus */
  goalNodeId?: string
  /** V16: Robustness level from PLoT for trust summary */
  robustnessLevel?: RobustnessLevel
  /** V16: Count of factors using default estimates (ISL-sourced with sampling_stability === 0) */
  defaultEstimateCount?: number
  /** V16: Total factor count (for trust reason denominator) */
  totalFactorCount?: number
}

// =============================================================================
// Helpers
// =============================================================================

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
      expandedText: 'Result changes under different assumptions. Review key inputs.',
      coaching: 'Result changes under different assumptions. Small changes could shift the recommendation.',
    }
  }
  return {
    label: 'Highly sensitive',
    colorClass: 'text-danger',
    shortText: 'Treat as directional',
    expandedText: 'Small changes in assumptions change the result. Treat as directional.',
    coaching: 'Small changes in assumptions change the result. Consider strengthening key assumptions before committing.',
  }
}


// =============================================================================
// V16 Helpers
// =============================================================================

/** Derive trust level from readiness + robustness */
function deriveTrustLevel(
  readiness?: string,
  robustnessLevel?: RobustnessLevel,
): 'strong' | 'moderate' | 'limited' {
  if (readiness === 'ready' && robustnessLevel === 'high') return 'strong'
  if (readiness === 'ready' || robustnessLevel === 'high' || robustnessLevel === 'moderate') return 'moderate'
  return 'limited'
}

/** Derive trust reason from available signals */
function deriveTrustReason(opts: {
  defaultEstimateCount?: number
  totalFactorCount?: number
  fragileEdgeCount?: number
  robustEdgeCount?: number
  evidenceQuality?: number
}): string {
  const { defaultEstimateCount, totalFactorCount, fragileEdgeCount, robustEdgeCount, evidenceQuality } = opts

  // Priority 1: default estimates
  if (defaultEstimateCount != null && totalFactorCount != null && defaultEstimateCount > 0) {
    return `${defaultEstimateCount} of ${totalFactorCount} factors use default estimates`
  }

  // Priority 2: fragile edges ratio
  const totalEdges = (fragileEdgeCount ?? 0) + (robustEdgeCount ?? 0)
  if (totalEdges > 0 && fragileEdgeCount != null && fragileEdgeCount / totalEdges > 0.7) {
    return 'most causal links are fragile'
  }

  // Priority 3: evidence quality
  if (evidenceQuality != null && evidenceQuality < 0.5) {
    return 'evidence quality is low'
  }

  return 'review model assumptions'
}

function getHeroBorderClass(robustnessLevel?: RobustnessLevel, recommendationStability?: number): string {
  if (robustnessLevel === 'high') return 'border-success/30'
  if (robustnessLevel === 'moderate') return 'border-info/30'
  if (robustnessLevel === 'low' || robustnessLevel === 'very_low') return 'border-factor/30'
  if (recommendationStability != null) {
    if (recommendationStability >= 0.7) return 'border-success/30'
    if (recommendationStability >= 0.4) return 'border-info/30'
    return 'border-factor/30'
  }
  return 'border-panel-border'
}

// UI-SEM-021: Suppress coaching copy that contradicts low robustness (e.g. "robust", "ready to proceed")
// when the analysis robustness level is low/very_low. Prevents misleading executive-level messaging.
// Remove when PLoT/CEE provides robustness-conditioned coaching copy directly.
function shouldSuppressContradictoryExecutiveCopy(
  text: string | null | undefined,
  robustnessLevel?: RobustnessLevel,
): boolean {
  if (!text || (robustnessLevel !== 'low' && robustnessLevel !== 'very_low')) return false
  return /\brobust\b|ready to proceed/i.test(text)
}

/** Extract first sentence from a paragraph (up to 150 chars) */
function extractFirstSentence(text: string): { first: string; hasMore: boolean } {
  // Find first sentence boundary: period/exclamation/question followed by whitespace + any next char,
  // or followed by closing quote + whitespace. Minimum 10 chars to avoid splitting abbreviations.
  const match = text.match(/^(.{10,150}[.!?]["']?)\s+(?:\S)/s)
  if (match) {
    return { first: match[1], hasMore: match[1].length < text.length }
  }
  // Fallback: first 150 chars
  if (text.length > 150) {
    return { first: text.slice(0, 150).trimEnd() + '…', hasMore: true }
  }
  return { first: text, hasMore: false }
}

// =============================================================================
// Sub-Components
// =============================================================================

/** V12.3: Win gauge + option card colours — shared palette for visual continuity */
export const WIN_GAUGE_COLORS = [
  'var(--success)',         // Winner — mint-500
  'var(--info)',            // Runner-up — sky-500
  'var(--option)',          // Third — lilac-400
  'var(--border-default)',  // Fourth+ — sand-200
]

/** V12.3: Indeterminate colours — sky for top two (near-tie signal), muted for rest */
export const WIN_GAUGE_COLORS_INDETERMINATE = [
  'var(--info)',            // Top option — sky-500
  'var(--info-light)',      // Second option — sky-200 (lighter, near-tie signal)
  'var(--border-default)',  // Third — sand-200
  'var(--border-default)',  // Fourth — sand-200
]

/**
 * Tailwind border classes that correspond 1-to-1 with WIN_GAUGE_COLORS by index.
 * Option cards use these to match their WinGauge segment colour without string-matching CSS vars.
 */
export const WIN_GAUGE_BORDER_CLASSES = [
  'border-2 border-success/60', // Winner — thicker, high-contrast accent
  'border-info/60',              // Runner-up — mid-contrast, visibly linked to win-bar
  'border-option/60',            // Third — mid-contrast, ordinal palette
  'border-panel-border',         // Fourth+ — neutral baseline
]

/** Indeterminate palette border classes, parallel to WIN_GAUGE_COLORS_INDETERMINATE. */
export const WIN_GAUGE_BORDER_CLASSES_INDETERMINATE = [
  'border-info/30',      // Top option — matches var(--info)
  'border-info/20',      // Second option — matches var(--info-light)
  'border-panel-border', // Third — matches var(--border-default)
  'border-panel-border', // Fourth — matches var(--border-default)
]

/**
 * Build a border-class map from option ID → Tailwind border class, using the same
 * sort order as buildSegmentColorMap. Derived from the palette arrays by index so
 * border and segment colours cannot drift independently.
 */
export function buildSegmentBorderClassMap(
  options: Array<{ id: string; winProbability?: number | null }>,
  winnerId: string | undefined,
  decisionState?: DecisionState,
): Record<string, string> {
  const classes = decisionState === 'indeterminate'
    ? WIN_GAUGE_BORDER_CLASSES_INDETERMINATE
    : WIN_GAUGE_BORDER_CLASSES
  const sorted = [...options].sort((a, b) => {
    if (a.id === winnerId && b.id !== winnerId) return -1
    if (a.id !== winnerId && b.id === winnerId) return 1
    return (b.winProbability ?? 0) - (a.winProbability ?? 0)
  })
  const map: Record<string, string> = {}
  sorted.forEach((opt, i) => {
    map[opt.id] = classes[Math.min(i, classes.length - 1)]
  })
  return map
}

/**
 * Build a colour map from option ID → CSS colour, using the same sort order
 * as WinGauge (winner first, then winProbability descending). This ensures
 * OptionCards colours match the corresponding WinGauge segment ordering
 * regardless of how cards are independently sorted.
 */
export function buildSegmentColorMap(
  options: Array<{ id: string; winProbability?: number | null; isRecommended?: boolean }>,
  winnerId: string | undefined,
  decisionState?: DecisionState,
): Record<string, string> {
  const colors = decisionState === 'indeterminate' ? WIN_GAUGE_COLORS_INDETERMINATE : WIN_GAUGE_COLORS
  const sorted = [...options].sort((a, b) => {
    if (a.id === winnerId && b.id !== winnerId) return -1
    if (a.id !== winnerId && b.id === winnerId) return 1
    return (b.winProbability ?? 0) - (a.winProbability ?? 0)
  })
  const map: Record<string, string> = {}
  sorted.forEach((opt, i) => {
    map[opt.id] = colors[Math.min(i, colors.length - 1)]
  })
  return map
}

/**
 * WinGauge — stacked horizontal bar showing win probability per option.
 * "Wins across scenarios" label + segmented bar. Legend removed in V12.4.
 */
function WinGauge({
  shares,
  decisionState,
}: {
  shares: OptionWinShare[]
  decisionState?: DecisionState
}) {
  if (shares.length === 0) return null

  const colors = decisionState === 'indeterminate' ? WIN_GAUGE_COLORS_INDETERMINATE : WIN_GAUGE_COLORS

  // Sort: winner first, then by win probability descending
  const sorted = [...shares].sort((a, b) => {
    if (a.isWinner && !b.isWinner) return -1
    if (!a.isWinner && b.isWinner) return 1
    return b.winProbability - a.winProbability
  })

  const isDeemphasised = decisionState === 'indeterminate'

  return (
    <div className={`mb-4${isDeemphasised ? ' opacity-70' : ''}`} role="figure" aria-label="Win probability distribution across options">
      <p className={`${typography.panelMeta} text-text-light mb-1`}>
        Wins across scenarios
      </p>
      {/* Stacked bar — use clamped raw percentage for width to avoid rounding gaps */}
      <div className={`flex rounded-full overflow-hidden gap-0.5${isDeemphasised ? ' h-2' : ' h-3'}`}>
        {sorted.map((share, i) => {
          const clamped = Math.max(0, Math.min(1, share.winProbability))
          const widthPct = clamped * 100
          const displayPct = Math.round(widthPct)
          if (displayPct <= 0) return null
          return (
            <div
              key={share.id}
              className="h-full rounded-full"
              style={{
                width: `${widthPct}%`,
                backgroundColor: colors[Math.min(i, colors.length - 1)],
              }}
              role="img"
              aria-label={`${stripEncodingNotation(share.label)}: ${displayPct}%`}
            />
          )
        })}
      </div>
    </div>
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
  optionCount,
  recommendationStability,
  analysisStatus,
  topDrivers,
  topFragileEdge,
  nSamples,
  fragileEdgeCount,
  goalLabel,
  goalThreshold,
  outcomeUnit,
  outcomeUnitSymbol,
  optionWinShares,
  coachingReadiness,
  coachingHeadline,
  coachingParagraph,
  coachingKeyQualifier,
  m2NarrativeSummary,
  coachingReadinessDimensions,
  identifiabilityTag,
  m2Headline,
  onFocusNode,
  isRunning,
  onAddBaseline,
  onSetBaseline,
  baselineOptions,
  baselineLabel,
  decisionState,
  robustEdgeCount,
  nearTie,
  topNextAction,
  goalNodeId,
  robustnessLevel,
  defaultEstimateCount,
  totalFactorCount,
}: HeroSectionProps) {
  // Always collapsed on first load — user expands via "More ▸" toggle
  const [isExpanded, setIsExpanded] = useState(false)
  // V16: "Show more" for insight bullet expansion (condition card detail)
  const [showMoreBullets, setShowMoreBullets] = useState(false)
  // V16: M2 narrative expansion in "More" panel
  const [narrativeExpanded, setNarrativeExpanded] = useState(false)

  // =========================================================================
  // Headline — Objective / Result format
  // =========================================================================

  const m1Headline = useMemo<StructuredHeadline>(() => {
    // Precedence 1: Partial analysis
    if (analysisStatus === 'partial') {
      return { main: 'Some analysis steps did not complete', sub: 'Results are partial' }
    }

    // Precedence 2: Low stability (< 0.55) — no clear winner
    if (recommendationStability != null && recommendationStability < 0.55) {
      return {
        main: `no clear winner, the result is sensitive to your estimates`,
        sub: `${winnerLabel} wins slightly more often`,
      }
    }

    // Precedence 3: Single option
    if (optionCount === 1) {
      return {
        main: `${winnerLabel} is your only option`,
        sub: null,
      }
    }

    // Precedence 4: Standard — winner identified
    return {
      main: `${winnerLabel} performs best`,
      sub: null,
    }
  }, [analysisStatus, recommendationStability, winnerLabel, optionCount])

  // M2 headline override (only when stability >= 0.55)
  const headline = useMemo<StructuredHeadline>(() => {
    if (m2Headline && (recommendationStability == null || recommendationStability >= 0.55)) {
      return { main: m2Headline, sub: m1Headline.sub }
    }
    return m1Headline
  }, [m2Headline, recommendationStability, m1Headline])

  // =========================================================================
  // V9.2: Condition card data (replaces bullets)
  // =========================================================================
  const conditionCard = useMemo(() => {
    if (!topFragileEdge) return null
    if (topFragileEdge.labelsResolved === false) {
      return { type: 'generic' as const }
    }
    return {
      type: 'specific' as const,
      fromId: topFragileEdge.fromId,
      fromLabel: stripEncodingNotation(topFragileEdge.fromLabel),
      toId: topFragileEdge.toId,
      toLabel: stripEncodingNotation(topFragileEdge.toLabel),
      altLabel: stripEncodingNotation(topFragileEdge.alternativeWinnerLabel),
      altId: topFragileEdge.alternativeWinnerId,
    }
  }, [topFragileEdge])

  // =========================================================================
  // Stability
  // =========================================================================
  const rawStabilityTier = getStabilityTier(recommendationStability)
  // V12.4: Override stability badge when decisionState contradicts rawStabilityTier.
  // - indeterminate: "No clear winner" headline must not show "Highly sensitive"
  // - sensitive (readiness downgrade): hero says sensitive but raw stability is green
  const stabilityTier = decisionState === 'indeterminate'
    ? { ...rawStabilityTier, label: 'Too close to call', colorClass: 'text-info' }
    : decisionState === 'sensitive' && rawStabilityTier.colorClass === 'text-success'
      ? { ...rawStabilityTier, label: 'Sensitive to assumptions', colorClass: 'text-warning' }
      : rawStabilityTier
  const stabilityPct = recommendationStability != null
    ? Math.round(recommendationStability * 100)
    : null

  // =========================================================================
  // V11: Stats grid for "More detail" expand
  // =========================================================================
  const totalRobustnessEdges = (fragileEdgeCount ?? 0) + (robustEdgeCount ?? 0)

  // =========================================================================
  // Render
  // =========================================================================

  // =========================================================================
  // V14: Build entity lookup for linkifyCoachingText
  // =========================================================================
  // Task 1: option GraphLinks use text-success for winner (non-indeterminate) or text-info for all (indeterminate)
  const linkEntities = useMemo<LinkEntity[]>(() => {
    const entities: LinkEntity[] = []
    // Options — colour by decisionState and winner status
    if (optionWinShares) {
      for (const opt of optionWinShares) {
        if (opt.label) {
          const isWinner = opt.id === winnerId
          const optClassName = decisionState === 'indeterminate'
            ? 'text-info'
            : isWinner ? 'text-success' : 'text-info'
          entities.push({ label: opt.label, nodeId: opt.id, className: optClassName })
        }
      }
    }
    // Top drivers (factors) — always text-info (no winner emphasis for factors)
    if (topDrivers) {
      for (const d of topDrivers) {
        if (d.label && !entities.some(e => e.label === d.label)) {
          entities.push({ label: d.label, nodeId: d.id })
        }
      }
    }
    return entities
  }, [optionWinShares, topDrivers, winnerId, decisionState])

  // =========================================================================
  // V14 Task 2: Near-tie headline
  // =========================================================================
  const v14Headline = useMemo(() => {
    if (analysisStatus === 'partial') {
      return { isNearTie: false as const, text: 'Some analysis steps did not complete' }
    }

    // Near-tie: use nearTie data or derive from win probability gap
    const resolveNearTie = (): { optA: string; idA: string; optB: string; idB: string } | null => {
      if (nearTie?.isTie && nearTie.tiedOptionIds.length >= 2) {
        const idA = nearTie.tiedOptionIds[0]
        const idB = nearTie.tiedOptionIds[1]
        const labelA = optionWinShares?.find(o => o.id === idA)?.label
        const labelB = optionWinShares?.find(o => o.id === idB)?.label
        if (labelA && labelB) return { optA: labelA, idA, optB: labelB, idB }
      }
      // Fallback: derive from option comparison gap using canonical threshold
      if (!nearTie && optionWinShares && optionWinShares.length >= 2) {
        const sorted = [...optionWinShares].sort((a, b) => b.winProbability - a.winProbability)
        const gap = Math.abs(sorted[0].winProbability - sorted[1].winProbability)
        if (gap < GAP_THRESHOLD) {
          return { optA: sorted[0].label, idA: sorted[0].id, optB: sorted[1].label, idB: sorted[1].id }
        }
      }
      return null
    }

    const tie = resolveNearTie()
    if (tie) {
      return { isNearTie: true as const, ...tie }
    }

    if (optionCount === 1) {
      return { isNearTie: false as const, text: `${winnerLabel} is your only option` }
    }

    return { isNearTie: false as const, text: null } // standard winner headline
  }, [analysisStatus, nearTie, optionWinShares, optionCount, winnerLabel])

  // =========================================================================
  // V14 Task 3: Decision state dot mapping
  // =========================================================================
  const decisionStateDot = useMemo(() => {
    const map: Record<DecisionState, { color: string; text: string }> = {
      indeterminate: { color: 'bg-warning text-warning', text: 'Too close to call' },
      sensitive: { color: 'bg-warning text-warning', text: 'Sensitive to assumptions' },
      robust: { color: 'bg-success text-success', text: 'Stable result' },
    }
    return decisionState ? map[decisionState] : null
  }, [decisionState])

  // =========================================================================
  // V14 Task 4: Condition card — factor-only, direction-aware
  // =========================================================================
  const v14ConditionCard = useMemo(() => {
    if (!topFragileEdge) return null
    if ((topFragileEdge.switchProbability ?? 0) <= 0.25) return null
    if (topFragileEdge.labelsResolved === false) return null

    const fromLabel = stripEncodingNotation(topFragileEdge.fromLabel)
    const altLabel = stripEncodingNotation(topFragileEdge.alternativeWinnerLabel)

    // Look up direction from topDrivers
    const driverMatch = topDrivers?.find(d => d.id === topFragileEdge.fromId)
    const isPositive = driverMatch?.direction === 'positive'

    return {
      fromId: topFragileEdge.fromId,
      fromLabel,
      toId: topFragileEdge.toId,
      altLabel,
      altId: topFragileEdge.alternativeWinnerId,
      isPositive,
    }
  }, [topFragileEdge, topDrivers])

  // V16 Task 4: M2 narrative clamped — must be before conditional returns (Rules of Hooks)
  const m2NarrativeClamped = useMemo(() => {
    if (!m2NarrativeSummary) return null
    return extractFirstSentence(m2NarrativeSummary)
  }, [m2NarrativeSummary])

  // V16 path: structured hero with headline, insight bullets, trust summary, gauge
  if (decisionState) {
    // ── V16 Task 1: Build insight bullets ───────────────────────────────────
    //
    // Bullet 1: key qualifier from coachingKeyQualifier
    // Bullet 2: hinge line — "Could change if {factor} shifts" (only when fragile edge exists)
    // Bullet 3: next action from topNextAction.action (with GraphLink on entity name)
    //
    // Task 5: Separate hinge bullet (needs qualifying v14ConditionCard) from
    // condition detail (any topFragileEdge with resolved labels).
    // When hinge bullet exists → condition detail goes in "Show more".
    // When no hinge bullet but condition detail exists → promote to default bullets.
    const hasHingeBullet = !!v14ConditionCard
    const hasConditionDetail = !!topFragileEdge
      && topFragileEdge.labelsResolved !== false

    const bullet1 = shouldSuppressContradictoryExecutiveCopy(coachingKeyQualifier?.trim() || null, robustnessLevel)
      ? null
      : coachingKeyQualifier?.trim() || null
    const bullet2 = hasHingeBullet && v14ConditionCard
      ? v14ConditionCard.fromLabel
      : null
    const bullet3NextAction = topNextAction?.action?.trim() || null

    // Condition card detail lives in "Show more" only when hinge bullet is also present.
    // Otherwise it gets promoted into the default bullets (Task 5).
    const showConditionCardInMore = hasHingeBullet && hasConditionDetail
    const promoteConditionToDefault = !hasHingeBullet && hasConditionDetail

    // Build bullets array — only non-null, max 3
    const defaultBullets: Array<{ key: string; content: ReactNode }> = []

    if (bullet1) {
      defaultBullets.push({
        key: 'qualifier',
        content: <span>{linkifyCoachingText(bullet1, linkEntities)}</span>,
      })
    }

    if (bullet2 && v14ConditionCard) {
      const hingeAltLabel = v14ConditionCard.altLabel
      const hingeAltId = v14ConditionCard.altId
      defaultBullets.push({
        key: 'hinge',
        content: (
          <>
            {'If '}
            <GraphLink
              edgeRef={{ fromId: v14ConditionCard.fromId, toId: v14ConditionCard.toId }}
              fallbackNodeId={v14ConditionCard.fromId}
              label={bullet2}
              className={`${typography.panelBody} inline`}
            >
              {bullet2}
            </GraphLink>
            {' is weaker, '}
            {hingeAltId ? (
              <GraphLink
                nodeId={hingeAltId}
                label={hingeAltLabel}
                className={`${typography.panelBody} inline`}
              >
                {hingeAltLabel}
              </GraphLink>
            ) : hingeAltLabel}
            {' overtakes'}
          </>
        ),
      })
    }

    if (bullet3NextAction && defaultBullets.length < 3) {
      const targetLabel = topNextAction?.targetLabel
      const targetId = topNextAction?.targetId
      // Bullet 3: only render when a target label is available (avoid fabricating text from free-form action string)
      if (targetLabel) {
        const scrollToMvs = () => {
          document.getElementById('mvs-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        const bulletContent = (
          <>
            <button
              type="button"
              onClick={scrollToMvs}
              className={`${typography.panelBody} text-info cursor-pointer [border-bottom:1px_dashed_currentColor] hover:[border-bottom-style:solid]`}
            >
              Next step
            </button>
            {': gather evidence on '}
            {targetId ? (
              <GraphLink
                nodeId={targetId}
                label={targetLabel}
                className={`${typography.panelBody} inline`}
              >
                {targetLabel}
              </GraphLink>
            ) : (
              <span>{targetLabel}</span>
            )}
          </>
        )
        defaultBullets.push({ key: 'action', content: bulletContent })
      }
    }

    // Task 5: Promote condition card to default bullets when no hinge bullet
    if (promoteConditionToDefault && topFragileEdge && defaultBullets.length < 3) {
      const fromLabel = stripEncodingNotation(topFragileEdge.fromLabel)
      const altLabel = stripEncodingNotation(topFragileEdge.alternativeWinnerLabel)
      const driverMatch = topDrivers?.find(d => d.id === topFragileEdge.fromId)
      const isPositive = driverMatch?.direction === 'positive'
      defaultBullets.push({
        key: 'condition-promoted',
        content: (
          <>
            {'If '}
            <GraphLink
              edgeRef={{ fromId: topFragileEdge.fromId, toId: topFragileEdge.toId }}
              fallbackNodeId={topFragileEdge.fromId}
              label={fromLabel}
              className={`${typography.panelBody} inline`}
            >
              {fromLabel}
            </GraphLink>
            {isPositive
              ? ' is weaker than expected, '
              : ' differs from your estimate, '}
            {topFragileEdge.alternativeWinnerId ? (
              <GraphLink
                nodeId={topFragileEdge.alternativeWinnerId}
                label={altLabel}
                className={`${typography.panelBody} inline ${decisionState === 'indeterminate' ? 'text-info' : 'text-success'}`}
              >
                {altLabel}
              </GraphLink>
            ) : (
              altLabel
            )}
            {' becomes the stronger option'}
          </>
        ),
      })
    }

    // ── V16 Task 3: Trust summary ─────────────────────────────────────────
    const trustLevel = deriveTrustLevel(coachingReadiness, robustnessLevel)
    const trustReason = deriveTrustReason({
      defaultEstimateCount,
      totalFactorCount,
      fragileEdgeCount,
      robustEdgeCount,
      evidenceQuality: coachingReadinessDimensions?.evidence,
    })
    const heroBorderClass = getHeroBorderClass(robustnessLevel, recommendationStability)

    const sanitizedParagraphV16 = shouldSuppressContradictoryExecutiveCopy(coachingParagraph || null, robustnessLevel)
      ? null
      : coachingParagraph || null

    return (
      <div className="space-y-4" data-testid="hero-section">
        <div className={`bg-panel border rounded-lg px-3 py-2 space-y-3 ${heroBorderClass}`}>

          {/* ── Headline: Goal / Result ──────────────────────── */}
          {v14Headline.isNearTie ? (
            <div className="space-y-0.5">
              <div className="flex items-baseline gap-1.5">
                <span className={`${typography.panelMeta} text-text-light flex-shrink-0`}>Goal</span>
                {goalNodeId ? (
                  <button
                    type="button"
                    onClick={() => focusNodeById(goalNodeId)}
                    className={`${typography.panelHeader} text-info cursor-pointer hover:underline focus:outline-none text-left`}
                  >
                    {goalLabel || 'your goal'}
                  </button>
                ) : (
                  <span className={`${typography.panelHeader} text-text-header`}>{goalLabel || 'your goal'}</span>
                )}
              </div>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className={`${typography.panelMeta} text-text-light flex-shrink-0`}>Result</span>
                <span className={`${typography.panelHeader} text-text-header`}>
                  <GraphLink nodeId={v14Headline.idA} label={v14Headline.optA} className="text-info">
                    {v14Headline.optA}
                  </GraphLink>
                  {' and '}
                  <GraphLink nodeId={v14Headline.idB} label={v14Headline.optB} className="text-info">
                    {v14Headline.optB}
                  </GraphLink>
                  {' are too close to call'}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className="flex items-baseline gap-1.5">
                <span className={`${typography.panelMeta} text-text-light flex-shrink-0`}>Goal</span>
                {goalNodeId ? (
                  <button
                    type="button"
                    onClick={() => focusNodeById(goalNodeId)}
                    className={`${typography.panelHeader} text-info cursor-pointer hover:underline focus:outline-none text-left`}
                  >
                    {goalLabel || 'your goal'}
                  </button>
                ) : (
                  <span className={`${typography.panelHeader} text-text-header`}>{goalLabel || 'your goal'}</span>
                )}
              </div>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className={`${typography.panelMeta} text-text-light flex-shrink-0`}>Result</span>
                <span className={`${typography.panelHeader} text-text-header`}>
                  {v14Headline.text ?? (
                    <>
                      <GraphLink nodeId={winnerId} label={winnerLabel} className="text-success">
                        {winnerLabel}
                      </GraphLink>
                      {' performs best'}
                    </>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* ── V16 Task 1: Insight bullets ───────────────────── */}
          {defaultBullets.length > 0 && (
            <ul
              className={`list-disc list-outside pl-4 space-y-0.5 ${typography.panelBody} text-text-body`}
              data-testid="insight-bullets"
            >
              {defaultBullets.map(b => (
                <li key={b.key}>{b.content}</li>
              ))}
            </ul>
          )}

          {/* Show more ▸ / expanded condition card detail */}
          {showConditionCardInMore && v14ConditionCard && (
            <div>
              {!showMoreBullets ? (
                <button
                  type="button"
                  onClick={() => setShowMoreBullets(true)}
                  className={`${typography.panelBody} text-info hover:underline`}
                  data-testid="show-more-bullets"
                >
                  More ▸
                </button>
              ) : (
                <div data-testid="show-more-expanded">
                  <ul
                    className={`list-disc list-outside pl-4 space-y-0.5 ${typography.panelBody} text-text-body mb-1`}
                    onMouseEnter={() => highlightNode(v14ConditionCard.fromId)}
                    onMouseLeave={clearHighlight}
                  >
                    <li>
                      {'If '}
                      <GraphLink
                        edgeRef={{ fromId: v14ConditionCard.fromId, toId: v14ConditionCard.toId }}
                        fallbackNodeId={v14ConditionCard.fromId}
                        label={v14ConditionCard.fromLabel}
                        className={`${typography.panelBody} inline`}
                      >
                        {v14ConditionCard.fromLabel}
                      </GraphLink>
                      {v14ConditionCard.isPositive
                        ? ' is weaker than expected, '
                        : ' differs from your estimate, '}
                      {v14ConditionCard.altId ? (
                        <GraphLink
                          nodeId={v14ConditionCard.altId}
                          label={v14ConditionCard.altLabel}
                          className={`${typography.panelBody} inline ${decisionState === 'indeterminate' ? 'text-info' : 'text-success'}`}
                        >
                          {v14ConditionCard.altLabel}
                        </GraphLink>
                      ) : (
                        v14ConditionCard.altLabel
                      )}
                      {' becomes the stronger option'}
                    </li>
                  </ul>
                  <button
                    type="button"
                    onClick={() => setShowMoreBullets(false)}
                    className={`${typography.panelBody} text-info hover:underline`}
                  >
                    Hide ▾
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── V16 Task 3: Trust summary ─────────────────────── */}
          <p className={`${typography.panelMeta} text-text-light truncate`} data-testid="trust-summary">
            Trust: {trustLevel}. {trustReason.charAt(0).toUpperCase()}{trustReason.slice(1)}
          </p>

          {/* ── V16 Task 2: Baseline + target row (above gauge) ── */}
          <BaselineTargetRow
            baselineOptions={baselineOptions}
            baselineLabel={baselineLabel}
            isRunning={isRunning}
            onAddBaseline={onAddBaseline}
            onSetBaseline={onSetBaseline}
            goalThreshold={goalThreshold}
            outcomeUnit={outcomeUnit}
            outcomeUnitSymbol={outcomeUnitSymbol}
            onEditTarget={goalNodeId ? () => focusNodeById(goalNodeId) : undefined}
          />

          {/* ── Win gauge ────────────────────────────────────── */}
          {optionWinShares && optionWinShares.length > 1 && (
            <WinGauge shares={optionWinShares} decisionState={decisionState} />
          )}

          {/* Goal probability line */}
          {goalThreshold != null && winnerGoalProbability != null && (
            <p className={`${typography.panelMeta} text-text-body`}>
              {winnerLabel} has a {formatPct(winnerGoalProbability, { fromDecimal: true })} chance of reaching your target of {goalThreshold}
            </p>
          )}

          {/* ── Stability badge + More / Less toggle ─────────── */}
          <div className="border-t border-panel-border pt-3">
            <div className="flex items-center gap-3">
              {stabilityTier.label && (
                <span className={`inline-flex items-center gap-1.5 bg-transparent border border-current/30 px-2 py-0.5 rounded-full ${stabilityTier.colorClass}`} data-testid="decision-state-pill">
                  {decisionStateDot && (
                    <span className={`w-2 h-2 rounded-full ${decisionStateDot.color.split(' ')[0]} flex-shrink-0`} />
                  )}
                  <span className={`${typography.panelMeta} text-text-body`}>
                    {stabilityTier.label}
                  </span>
                </span>
              )}
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className={`flex items-center gap-1 ${typography.panelBody} text-info hover:text-info-hover flex-shrink-0`}
                aria-expanded={isExpanded}
                aria-controls="hero-more-content"
              >
                {isExpanded ? 'Hide ▾' : 'More ▸'}
              </button>
            </div>
          </div>

          {/* ── "More" expand ─────────────────────────────────── */}
          {isExpanded && (
            <div
              id="hero-more-content"
              className="mt-3 pt-3 border-t border-panel-border space-y-3"
            >
              {/* V16 Task 4: M2 narrative — clamped to first sentence with Read more toggle */}
              {m2NarrativeClamped ? (
                <div>
                  <p className={`${typography.panelMeta} text-text-light italic mb-1`}>AI-enhanced analysis</p>
                  <p className={`${typography.panelBody} text-text-body`}>
                    {narrativeExpanded ? m2NarrativeSummary : m2NarrativeClamped.first}
                    {m2NarrativeClamped.hasMore && !narrativeExpanded && (
                      <>
                        {' '}
                        <button
                          type="button"
                          onClick={() => setNarrativeExpanded(true)}
                          className={`${typography.panelBody} text-info cursor-pointer`}
                          data-testid="read-more-narrative"
                        >
                          Read more ▾
                        </button>
                      </>
                    )}
                    {narrativeExpanded && (
                      <>
                        {' '}
                        <button
                          type="button"
                          onClick={() => setNarrativeExpanded(false)}
                          className={`${typography.panelBody} text-info cursor-pointer`}
                        >
                          Read less ▴
                        </button>
                      </>
                    )}
                  </p>
                </div>
              ) : sanitizedParagraphV16 ? (
                <p className={`${typography.panelBody} text-text-body`}>
                  {sanitizedParagraphV16}
                </p>
              ) : null}

              {/* Readiness bars */}
              {coachingReadinessDimensions && (
                <div data-testid="readiness-bars">
                  <p className={`${typography.panelMeta} text-text-header font-medium mb-2`}>Readiness</p>
                  {(['evidence', 'robustness', 'clarity'] as const).map(dim => {
                    const value = coachingReadinessDimensions[dim]
                    if (value == null) return null
                    const pct = Math.round(value * 100)
                    const fillColor = getThresholdColour(value)
                    const label = dim === 'clarity' ? 'Framing' : dim.charAt(0).toUpperCase() + dim.slice(1)
                    return (
                      <div key={dim} className="flex items-center gap-2 mb-1">
                        <span className={`${typography.panelMeta} text-text-light text-right`} style={{ width: 80 }}>
                          {label}
                        </span>
                        <div className="flex-1 bg-panel-border rounded-full" style={{ height: 4 }}>
                          <div
                            className={`${fillColor} rounded-full`}
                            style={{ width: `${pct}%`, height: 4 }}
                          />
                        </div>
                        <span className={`${typography.panelMeta} text-text-light`} style={{ width: 30 }}>
                          {pct}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Stats grid */}
              <dl className={`grid grid-cols-2 gap-x-4 gap-y-1 ${typography.panelMeta}`}>
                {winnerWinProbability != null && (
                  <>
                    <dt className="text-text-light">Win likelihood</dt>
                    <dd className="text-text-header">{Math.round(winnerWinProbability * 100)}%</dd>
                  </>
                )}
                {stabilityPct != null && (
                  <>
                    <dt className="text-text-light">Robustness</dt>
                    <dd className="text-text-header">
                      {stabilityPct}%{stabilityTier.label && ` (${stabilityTier.label.toLowerCase()})`}
                    </dd>
                  </>
                )}
                {fragileEdgeCount != null && (
                  <>
                    <dt className="text-text-light">Fragile edges</dt>
                    <dd className="text-text-header">
                      {fragileEdgeCount}{totalRobustnessEdges > 0 && ` of ${totalRobustnessEdges}`}
                    </dd>
                  </>
                )}
                {nSamples != null && (
                  <>
                    <dt className="text-text-light">Sampling</dt>
                    <dd className="text-text-header">{nSamples.toLocaleString()} simulations</dd>
                  </>
                )}
              </dl>

              {/* Identifiability advisory */}
              {(() => {
                const identMap: Record<string, { label: string; colorClass: string }> = {
                  partially_identifiable: { label: 'Structural validity: Some limitations', colorClass: 'text-info' },
                  not_backdoor_identifiable: { label: 'Structural validity: Treat as directional', colorClass: 'text-warning' },
                }
                const mapped = identifiabilityTag ? identMap[identifiabilityTag] : null
                if (!mapped) return null
                return (
                  <div className={`flex items-start gap-1.5 ${typography.panelMeta} ${mapped.colorClass}`}>
                    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{mapped.label}</span>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      </div>
    )
  }

  // =========================================================================
  // Legacy path: V9.2 layout (when decisionState is not provided)
  // =========================================================================
  return (
    <div className="space-y-4" data-testid="hero-section">
      {/* Main hero card */}
      {/* TODO: Legacy V9.2 fallback — use getHeroBorderClass() when decisionState
          is guaranteed. Low risk: decisionState is always provided in production. */}
      <div className="p-4 bg-panel border border-panel-border rounded-lg">
        {/* V9.2 Headline — Goal / Result format */}
        <div className="space-y-0.5">
          <div className="flex items-baseline gap-1.5">
            <span className={`${typography.panelMeta} text-text-light flex-shrink-0`}>Goal</span>
            {goalNodeId ? (
              <button
                type="button"
                onClick={() => focusNodeById(goalNodeId)}
                className={`${typography.panelHeader} text-info cursor-pointer hover:underline focus:outline-none text-left`}
              >
                {goalLabel || 'your goal'}
              </button>
            ) : (
              <span className={`${typography.panelHeader} text-text-header`}>{goalLabel || 'your goal'}</span>
            )}
          </div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className={`${typography.panelMeta} text-text-light flex-shrink-0`}>Result</span>
            <span className={`${typography.panelHeader} ${recommendationStability != null && recommendationStability < 0.55 ? 'text-text-header' : 'text-success'}`}>{headline.main}</span>
          </div>
        </div>
        {headline.sub && (
          <p className={`${typography.panelBody} text-text-body mt-1`}>
            {headline.sub}
          </p>
        )}

        {/* V14: Condition card — factor-only language, no arrow notation */}
        {conditionCard && conditionCard.type === 'specific' && (
          <div
            className="mt-3 mb-3 p-3 border border-danger/30 rounded-lg flex items-start gap-2 results-card-hover"
            onMouseEnter={() => highlightNode(conditionCard.fromId)}
            onMouseLeave={clearHighlight}
          >
            <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
            <p className={`${typography.panelBody} text-text-body`}>
              {'If '}
              <GraphLink
                nodeId={conditionCard.fromId}
                label={conditionCard.fromLabel}
                onFocus={onFocusNode}
                className={`${typography.panelBody} inline`}
              >
                {conditionCard.fromLabel}
              </GraphLink>
              {' differs from your estimate, '}
              {conditionCard.altId ? (
                <GraphLink
                  nodeId={conditionCard.altId}
                  label={conditionCard.altLabel}
                  className={`${typography.panelBody} inline`}
                >
                  {conditionCard.altLabel}
                </GraphLink>
              ) : (
                conditionCard.altLabel
              )}
              {' becomes the stronger option'}
            </p>
          </div>
        )}

        {/* V9.2: 1-line coaching narrative (hidden when More is expanded) */}
        {coachingHeadline && !isExpanded && !shouldSuppressContradictoryExecutiveCopy(coachingHeadline, robustnessLevel) && (
          <p
            className={`${typography.panelMeta} text-text-light mb-3 line-clamp-1`}
            style={{ fontSize: 11 }}
          >
            {coachingHeadline}
          </p>
        )}

        {/* Win gauge — stacked bar showing win probability per option */}
        {optionWinShares && optionWinShares.length > 1 && (
          <WinGauge shares={optionWinShares} />
        )}

        {/* V9.2: Goal probability line — bridges "which wins most" and "does it hit my target" */}
        {goalThreshold != null && winnerGoalProbability != null && (
          <p className={`${typography.panelMeta} text-text-body mb-3`}>
            {winnerLabel} has a {formatPct(winnerGoalProbability, { fromDecimal: true })} chance of reaching your target of {goalThreshold}
          </p>
        )}

        {/* V9.2: Baseline row — after win gauge, before "More detail" toggle */}
        {optionCount > 1 && (
          <div className="mt-2 pt-2 border-t border-panel-border">
            <BaselineToggleCard
              show={true}
              isRunning={isRunning}
              onAddBaseline={onAddBaseline}
              onSetBaseline={onSetBaseline}
              options={baselineOptions}
              baselineLabel={baselineLabel}
            />
          </div>
        )}

        {/* Stability + More toggle */}
        <div className="border-t border-panel-border pt-3">
          <div className="flex items-center gap-3">
            {stabilityTier.label && (
              <span className={`inline-flex items-center gap-1.5 bg-transparent border border-current/30 px-2 py-0.5 rounded-full ${stabilityTier.colorClass}`}>
                <span className={`${typography.panelMeta} text-text-body`}>
                  {stabilityTier.label}
                </span>
              </span>
            )}
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`flex items-center gap-1 ${typography.panelBody} text-info hover:text-info-hover flex-shrink-0`}
              aria-expanded={isExpanded}
              aria-controls="hero-more-content"
            >
              {isExpanded ? 'Hide ▾' : 'More ▸'}
            </button>
          </div>
        </div>

        {/* V9.2: "More detail" expand — narrative + stability summary */}
        {isExpanded && (
          <div
            id="hero-more-content"
            className="mt-3 pt-3 border-t border-panel-border space-y-3"
          >
            {/* Full narrative paragraph from coaching */}
            {coachingParagraph && (
              <p className={`${typography.panelBody} text-text-body`}>
                {coachingParagraph}
              </p>
            )}

            {/* 3-row stability summary */}
            <dl className={`grid grid-cols-2 gap-x-4 gap-y-1 ${typography.panelMeta}`}>
              {stabilityPct != null && (
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
              {nSamples != null && (
                <>
                  <dt className="text-text-light">Convergence</dt>
                  <dd className="text-text-header">{nSamples.toLocaleString()} simulations</dd>
                </>
              )}
            </dl>
          </div>
        )}
      </div>
    </div>
  )
}

export default HeroSection
