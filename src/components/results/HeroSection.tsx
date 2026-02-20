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

import { useState, useMemo } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { typography } from '../../styles/typography'
import { stripEncodingNotation } from './utils/cleanFactorLabel'
import { formatPercent as formatPct } from '../../utils/formatPercent'
import { GraphLink } from './GraphLink'
import { normaliseGoalLabel } from '../../utils/normaliseGoalLabel'
import { BaselineToggleCard, type BaselineOption } from './BaselineToggleCard'
import type { DecisionState, HingeInfo, EvidenceLevel } from './types'

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
  coachingReadiness?: 'ready' | 'close_call' | 'needs_evidence' | 'needs_framing'
  coachingReadinessScore?: number
  /** M1 coaching narrative headline (1-line summary) */
  coachingHeadline?: string
  /** M1 coaching full narrative paragraph (for "More detail" expand) */
  coachingParagraph?: string
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
  /** V11: Evidence quality level for meta strip badge */
  evidenceLevel?: EvidenceLevel
  /** V11: Robust edge count for "Fragile edges X of Y" display */
  robustEdgeCount?: number
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
// Sub-Components
// =============================================================================

/** Win gauge colours — winner gets success, others rotate through palette */
const WIN_GAUGE_COLORS = [
  'var(--success)',       // Winner
  'var(--info-light)',    // Runner-up
  'var(--border-default)', // Third
  'var(--warning-light)', // Fourth (rare)
]

/** V11: Indeterminate colours — stone for top two, muted for rest */
const WIN_GAUGE_COLORS_INDETERMINATE = [
  'var(--factor)',         // Top option
  'var(--factor)',         // Second option
  'var(--border-default)', // Third
  'var(--border-default)', // Fourth
]

/**
 * WinGauge — stacked horizontal bar showing win probability per option.
 * "Wins across scenarios" label, segmented bar, and legend.
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

  return (
    <div className="mb-4" role="figure" aria-label="Win probability distribution across options">
      <p className={`${typography.panelMeta} text-text-light mb-1`}>
        Wins across scenarios
      </p>
      {/* Stacked bar — use clamped raw percentage for width to avoid rounding gaps */}
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
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
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
        {sorted.map((share, i) => {
          const clamped = Math.max(0, Math.min(1, share.winProbability))
          const pct = Math.round(clamped * 100)
          if (pct <= 0) return null
          const color = colors[Math.min(i, colors.length - 1)]
          return (
            <span
              key={share.id}
              className={`flex items-center gap-1.5 ${typography.panelMeta} ${share.isWinner ? 'text-text-header' : 'text-text-light'}`}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              {stripEncodingNotation(share.label)} {formatPct(clamped, { fromDecimal: true })}
            </span>
          )
        })}
      </div>
    </div>
  )
}


// =============================================================================
// V11: Evidence Badge
// =============================================================================

const EVIDENCE_BADGE_CONFIG: Record<EvidenceLevel, { label: string; bg: string; text: string; tooltip: string }> = {
  good: {
    label: 'Evidence: Good',
    bg: 'bg-success-light',
    text: 'text-success',
    tooltip: 'Based on stability and proportion of fragile edges.',
  },
  fair: {
    label: 'Evidence: Fair',
    bg: 'bg-goal-light',
    text: 'text-goal',
    tooltip: 'Based on stability and proportion of fragile edges.',
  },
  needs_work: {
    label: 'Evidence: Needs work',
    bg: 'bg-danger-light',
    text: 'text-danger',
    tooltip: 'Based on stability and proportion of fragile edges.',
  },
}

// =============================================================================
// V11: MetaStrip — single-row evidence + baseline + target
// =============================================================================

function MetaStrip({
  evidenceLevel,
  baselineLabel,
  goalThreshold,
  onSetBaseline,
  onAddBaseline,
  baselineOptions,
  isRunning,
}: {
  evidenceLevel?: EvidenceLevel
  baselineLabel?: string
  goalThreshold?: number | null
  onSetBaseline?: (id: string) => void
  onAddBaseline?: () => void
  baselineOptions?: BaselineOption[]
  isRunning?: boolean
}) {
  const badge = evidenceLevel ? EVIDENCE_BADGE_CONFIG[evidenceLevel] : null

  return (
    <div className="flex items-center gap-4 flex-wrap" data-testid="meta-strip">
      {/* Evidence badge */}
      {badge && (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full ${badge.bg} ${badge.text} ${typography.panelMeta}`}
          title={badge.tooltip}
          data-testid="evidence-badge"
        >
          {badge.label}
        </span>
      )}
      {/* Baseline */}
      {baselineOptions && baselineOptions.length > 0 && (
        <BaselineToggleCard
          show={true}
          isRunning={isRunning}
          onAddBaseline={onAddBaseline}
          onSetBaseline={onSetBaseline}
          options={baselineOptions}
          baselineLabel={baselineLabel}
        />
      )}
      {/* Target */}
      {goalThreshold != null && (
        <span className={`${typography.panelMeta} text-text-light`}>
          Target: <span className="text-text-body">{goalThreshold}</span>
        </span>
      )}
    </div>
  )
}

// =============================================================================
// V11: HeroRows — per-state structured rows
// =============================================================================

function HeroRows({
  decisionState,
  goalLabel,
  goalThreshold,
  winnerLabel,
  winnerId,
  winnerWinProbability,
  runnerUpLabel,
  runnerUpWinProbability,
  hinge,
  onFocusNode,
}: {
  decisionState: DecisionState
  goalLabel?: string
  goalThreshold?: number | null
  winnerLabel: string
  winnerId: string
  winnerWinProbability?: number | null
  runnerUpLabel?: string
  runnerUpWinProbability?: number | null
  hinge?: HingeInfo | null
  onFocusNode?: (nodeId: string) => void
}) {
  const goalDisplay = goalThreshold != null
    ? `${goalThreshold}`
    : goalLabel && goalLabel !== 'your goal'
      ? normaliseGoalLabel(goalLabel)
      : 'your goal'

  const winPct = winnerWinProbability != null
    ? Math.round(winnerWinProbability * 100)
    : null

  const runnerUpPct = runnerUpWinProbability != null
    ? Math.round(runnerUpWinProbability * 100)
    : null

  const hingeLink = hinge ? (
    <GraphLink
      nodeId={hinge.nodeId}
      label={hinge.label}
      onFocus={onFocusNode}
      className={`${typography.panelBody} inline`}
    />
  ) : null

  return (
    <dl className="space-y-2" data-testid="hero-rows">
      {/* Row 1: Goal */}
      <div className="flex gap-2">
        <dt className={`${typography.panelMeta} text-text-light w-24 flex-shrink-0`}>Goal</dt>
        <dd className={`${typography.panelBody} text-text-header`}>{goalDisplay}</dd>
      </div>

      {/* Row 2: Leads / Result */}
      {decisionState === 'indeterminate' ? (
        <div className="flex gap-2">
          <dt className={`${typography.panelMeta} text-text-light w-24 flex-shrink-0`}>Result</dt>
          <dd className={`${typography.panelBody} text-text-body`}>
            No clear winner{winPct != null && runnerUpPct != null && (
              <> ({winPct}% vs {runnerUpPct}%)</>
            )}
          </dd>
        </div>
      ) : (
        <div className="flex gap-2">
          <dt className={`${typography.panelMeta} text-text-light w-24 flex-shrink-0`}>Leads</dt>
          <dd className={`${typography.panelBody}`}>
            <span className="text-success font-medium">{winnerLabel}</span>
            {winPct != null && (
              <span className="text-text-light"> ({winPct}% win likelihood)</span>
            )}
          </dd>
        </div>
      )}

      {/* Row 3: Status / Validate / Resolve */}
      {decisionState === 'robust' && (
        <div className="flex gap-2">
          <dt className={`${typography.panelMeta} text-text-light w-24 flex-shrink-0`}>Status</dt>
          <dd>
            <div className="px-3 py-2 rounded-lg border border-success/30 bg-success-light/30">
              <p className={`${typography.panelBody} text-text-body`}>
                No single assumption could flip this.
                {hingeLink && (
                  <> Validate {hingeLink}</>
                )}
              </p>
            </div>
          </dd>
        </div>
      )}

      {decisionState === 'sensitive' && hinge && (
        <div className="flex gap-2">
          <dt className={`${typography.panelMeta} text-danger w-24 flex-shrink-0`}>Validate first</dt>
          <dd>
            <div className="px-3 py-2 rounded-lg bg-danger-light/30 border border-danger/20">
              <p className={`${typography.panelBody} text-text-body`}>
                {hingeLink}
              </p>
            </div>
          </dd>
        </div>
      )}

      {decisionState === 'indeterminate' && hinge && (
        <div className="flex gap-2">
          <dt className={`${typography.panelMeta} text-danger w-24 flex-shrink-0`}>Resolve first</dt>
          <dd>
            <div className="px-3 py-2 rounded-lg bg-danger-light/30 border border-danger/20">
              <p className={`${typography.panelBody} text-text-body`}>
                {hingeLink}
              </p>
            </div>
          </dd>
        </div>
      )}
    </dl>
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
  fragileEdgeCount,
  goalLabel,
  goalThreshold,
  expectedOutcome,
  outcomeUnit,
  outcomeUnitSymbol,
  isNormalised,
  optionWinShares,
  coachingReadiness,
  coachingReadinessScore,
  coachingHeadline,
  coachingParagraph,
  m2Headline,
  m2Bullets,
  m2CoachingParagraph,
  m2BiasInsights,
  onFocusNode,
  onFlashOption,
  isRunning,
  onAddBaseline,
  onSetBaseline,
  baselineOptions,
  baselineLabel,
  decisionState,
  hinge,
  evidenceLevel,
  robustEdgeCount,
}: HeroSectionProps) {
  // v7.4 Task 6: Default expand state based on robustness level
  // low/very_low stability (< 0.70) defaults to expanded ("Sensitive" or "Highly sensitive")
  // moderate/high stability (>= 0.70) defaults to collapsed ("Mostly stable" or "Stable")
  const shouldDefaultExpand = recommendationStability != null && recommendationStability < 0.70
  const [isExpanded, setIsExpanded] = useState(shouldDefaultExpand)

  // =========================================================================
  // Headline — V9.2: merged "To achieve [goal], [winner] performs best"
  // =========================================================================
  const goalPrefix = goalLabel && goalLabel !== 'your goal'
    ? normaliseGoalLabel(goalLabel)
    : 'your goal'

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
  const stabilityTier = getStabilityTier(recommendationStability)
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

  // V11 path: structured hero rows + meta strip when decisionState is provided
  if (decisionState) {
    return (
      <div className="space-y-4" data-testid="hero-section">
        <div className="p-4 bg-panel border border-panel-border rounded-lg space-y-4">
          {/* Meta strip */}
          <MetaStrip
            evidenceLevel={evidenceLevel}
            baselineLabel={baselineLabel}
            goalThreshold={goalThreshold}
            onSetBaseline={onSetBaseline}
            onAddBaseline={onAddBaseline}
            baselineOptions={baselineOptions}
            isRunning={isRunning}
          />

          {/* Structured hero rows */}
          <HeroRows
            decisionState={decisionState}
            goalLabel={goalLabel}
            goalThreshold={goalThreshold}
            winnerLabel={winnerLabel}
            winnerId={winnerId}
            winnerWinProbability={winnerWinProbability}
            runnerUpLabel={runnerUpLabel}
            runnerUpWinProbability={runnerUpWinProbability}
            hinge={hinge}
            onFocusNode={onFocusNode}
          />

          {/* Win gauge */}
          {optionWinShares && optionWinShares.length > 1 && (
            <WinGauge shares={optionWinShares} decisionState={decisionState} />
          )}

          {/* V9.2: Goal probability line */}
          {goalThreshold != null && winnerGoalProbability != null && (
            <p className={`${typography.panelMeta} text-text-body`}>
              {winnerLabel} has a {formatPct(winnerGoalProbability, { fromDecimal: true })} chance of reaching your target of {goalThreshold}
            </p>
          )}

          {/* More / Less toggle */}
          <div className="border-t border-panel-border pt-3">
            <div className="flex items-center gap-3">
              {stabilityTier.label && (
                <span className="inline-flex items-center gap-1.5 bg-sand-50 px-2 py-0.5 rounded-full">
                  <span className={`${typography.panelMeta} ${stabilityTier.colorClass}`}>
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
                <span>{isExpanded ? 'Less' : 'More'}</span>
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>

          {/* "More detail" expand — V11 stats grid */}
          {isExpanded && (
            <div
              id="hero-more-content"
              className="mt-3 pt-3 border-t border-panel-border space-y-3"
            >
              {coachingParagraph && (
                <p className={`${typography.panelBody} text-text-body`}>
                  {coachingParagraph}
                </p>
              )}

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
      <div className="p-4 bg-panel border border-panel-border rounded-lg">
        {/* V9.2 Headline — merged "To achieve [goal], [winner] performs best" */}
        <h2 className={`${typography.panelHeader} text-[15px] leading-snug`}>
          <span className="text-text-header">To achieve {goalPrefix},</span>{' '}
          <span className={recommendationStability != null && recommendationStability < 0.55 ? 'text-text-header' : 'text-success'}>{headline.main}</span>
        </h2>
        {headline.sub && (
          <p className={`${typography.panelBody} text-text-body mt-1`}>
            {headline.sub}
          </p>
        )}

        {/* V9.2: Condition card — top fragile edge warning. Inline sentence layout. */}
        {conditionCard && (
          <div className="mt-3 mb-3 p-3 border border-danger/30 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
            <p className={`${typography.panelBody} text-text-body`}>
              {conditionCard.type === 'generic' ? (
                'Some estimates could change the recommendation, review key inputs below.'
              ) : (
                <>
                  {'If '}
                  <GraphLink
                    nodeId={conditionCard.fromId}
                    label={`${conditionCard.fromLabel} \u2192 ${conditionCard.toLabel}`}
                    onFocus={onFocusNode}
                    className={`${typography.panelBody} inline`}
                  />
                  {' is weaker than expected, '}
                  {conditionCard.altId && onFlashOption ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onFlashOption(conditionCard.altId!) }}
                      className="text-info hover:underline inline"
                    >
                      {conditionCard.altLabel}
                    </button>
                  ) : (
                    conditionCard.altLabel
                  )}
                  {' becomes stronger'}
                </>
              )}
            </p>
          </div>
        )}

        {/* V9.2: 1-line coaching narrative (hidden when More is expanded) */}
        {coachingHeadline && !isExpanded && (
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
              <span className="inline-flex items-center gap-1.5 bg-sand-50 px-2 py-0.5 rounded-full">
                <span className={`${typography.panelMeta} ${stabilityTier.colorClass}`}>
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
              <span>{isExpanded ? 'Less' : 'More'}</span>
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
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
