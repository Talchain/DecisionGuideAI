/**
 * ConfidenceSection Component (renamed: "What Needs Attention")
 *
 * Merged section displaying confidence tier, uncertainties, and improvements.
 * Part of the Results Panel redesign - "coaching over gates" approach.
 *
 * Features:
 * - Confidence tier from Graph Readiness with full fallback chain
 * - Tier descriptions: Strong/Fair/Needs Work
 * - Uncertainties from critiques and sensitivity analysis
 * - Evidence coverage (if available)
 * - Merged improvements with priority ordering
 * - Conditional display based on status fields
 */

import { useState, useCallback, useMemo } from 'react'
import type { ConfidenceSectionData, UncertaintyItem, CritiqueSeverity, ConfidenceTier, EvidenceGapItem, AssumptionItem, DecisionState, HingeInfo, TopAction, FlipThreshold, ConditionalWinner, InferenceWarning } from './types'
import type { ConstraintAnalysis } from '../../types/constraints'
import { focusNodeById, focusByTarget, type FocusTargetType } from '../../canvas/utils/focusHelpers'
import { highlightNode, clearHighlight } from '../../canvas/utils/highlightHelpers'
import { EMPTY_STATES } from './emptyStates'
import { typography } from '../../styles/typography'
import { MIN_STABLE_RECOMMENDATION_STABILITY, isStableRobustnessLevel } from './constants'
import { stripEncodingNotation } from './utils/cleanFactorLabel'
import { groupActionItems, type ActionGroup, type ActionItem } from './utils/groupActionItems'
import { AlertTriangle, Check, Lightbulb, Search, ArrowLeftRight, GitBranch } from 'lucide-react'

/**
 * Expandable "Why this matters" section for action items with whatCouldHappen / whatToDo data.
 * Renders a clickable text link that toggles an explanation panel.
 */
function WhyThisMatters({ whatCouldHappen, whatToDo }: { whatCouldHappen?: string; whatToDo?: string }) {
  const [expanded, setExpanded] = useState(false)
  if (!whatCouldHappen && !whatToDo) return null
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
        className={`${typography.panelMeta} text-info hover:underline flex items-center gap-1`}
      >
        <svg className={`w-2.5 h-2.5 transition-transform ${expanded ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="9 18 15 12 9 6" /></svg>
        Why this matters
      </button>
      {expanded && (
        <div className="mt-1.5 bg-panel-hover rounded-lg p-2 space-y-1">
          {whatCouldHappen && (
            <p className={`${typography.panelMeta} text-text-body`}>
              <strong className="text-text-header">Impact:</strong> {whatCouldHappen}
            </p>
          )}
          {whatToDo && (
            <p className={`${typography.panelMeta} text-text-body`}>
              <strong className="text-text-header">Recommendation:</strong> {whatToDo}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

interface ConfidenceSectionProps {
  data: ConfidenceSectionData
  onFocusNode?: (nodeId: string) => void
  /** Top driver label for intro nudge text */
  topDriverLabel?: string
  /** Top driver ID for GraphLink in intro */
  topDriverId?: string
  /** Number of visible drivers — gates "widest uncertainty" clause (needs ≥2) */
  visibleDriverCount?: number
  /** Multi-constraint analysis from winning option (for binding/near-miss action items) */
  winnerConstraintAnalysis?: ConstraintAnalysis
  /** V11: Hinge info for VOI promoted block */
  hinge?: HingeInfo | null
  /** V11: Decision state — controls VOI block visibility */
  decisionState?: DecisionState
  /** V11: Top action — controls impact label in VOI block */
  topAction?: TopAction | null
  /** V11: Factor IDs to exclude from action items (hinge shown in VOI block) */
  excludeFactorIds?: string[]
  /** V14.1: Coaching readiness — gates "Good foundation" display */
  coachingReadiness?: 'ready' | 'close_call' | 'needs_evidence' | 'needs_framing' | 'low' | 'not_ready'
  /** V14.1: Whether any option has winProbability > 0.5 */
  hasWinnerAbove50?: boolean
  /** Flip thresholds: tipping points where recommendation changes (from PLoT robustness) */
  flipThresholds?: FlipThreshold[]
}

const SEVERITY_CONFIG: Record<CritiqueSeverity, {
  icon: string
  bgColor: string
  borderColor: string
  textColor: string
  label?: string
}> = {
  blocker: {
    icon: '⛔',
    bgColor: 'bg-panel',
    borderColor: 'border-danger/30',
    textColor: 'text-danger',
    label: 'Blocks analysis',  // Reserved for genuine pre-run validation blockers
  },
  critical: {
    icon: '⚠',
    bgColor: 'bg-panel',
    borderColor: 'border-danger/30',
    textColor: 'text-danger',
    label: 'Critical assumption',  // For high-severity fragile edges
  },
  error: {
    icon: '✕',
    bgColor: 'bg-panel',
    borderColor: 'border-danger/30',
    textColor: 'text-danger',
  },
  warning: {
    icon: '⚠',
    bgColor: 'bg-panel',
    borderColor: 'border-warning/30',
    textColor: 'text-warning',
  },
  info: {
    icon: 'ℹ',
    bgColor: 'bg-panel',
    borderColor: 'border-panel-border',
    textColor: 'text-text-body',
  },
}

const TIER_CONFIG: Record<ConfidenceTier, {
  icon: string
  bgColor: string
  borderColor: string
  textColor: string
  label: string
  descriptionWithItems: string
  descriptionWithoutItems: string
}> = {
  strong: {
    icon: '✓',
    bgColor: 'bg-panel',
    borderColor: 'border-success/30',
    textColor: 'text-success',
    label: 'Good foundation',
    descriptionWithItems: 'Your model captures this decision well.',
    descriptionWithoutItems: 'Your model captures this decision well.',
  },
  fair: {
    icon: '⚠',
    bgColor: 'bg-panel',
    borderColor: 'border-warning/30',
    textColor: 'text-warning',
    label: 'Fair',
    descriptionWithItems: 'Your model covers the basics. Address the items below.',
    descriptionWithoutItems: 'Your model covers the basics but could use more detail.',
  },
  needs_work: {
    icon: '⚠',
    bgColor: 'bg-panel',
    borderColor: 'border-danger/30',
    textColor: 'text-danger',
    label: 'Early sketch',
    descriptionWithItems: 'Add the missing elements below before relying on the recommendation.',
    descriptionWithoutItems: 'Add more factors and connections before relying on the recommendation.',
  },
  unknown: {
    icon: '?',
    bgColor: 'bg-panel',
    borderColor: 'border-panel-border',
    textColor: 'text-text-body',
    label: 'Unknown',
    descriptionWithItems: 'Unable to assess model quality.',
    descriptionWithoutItems: 'Unable to assess model quality.',
  },
}

/**
 * Compact uncertainty card - 2-line structure
 * Line 1: Icon + edge relationship title (from → to)
 * Line 2: Consequence + inline CTA
 * v7.4 Task 7: Group-based styling - danger for Group 1, warning for Group 2
 */

/**
 * E-value indicator for fragile edge cards — gated on field presence (ISL).
 * Shows how many times wrong an assumption must be to flip the recommendation.
 * Colour tiers: > 3 = success (robust), 1.5-3 = warning (moderate), < 1.5 = danger (fragile).
 */
function EValueIndicator({ eValue }: { eValue: number }) {
  const colour = eValue > 3 ? 'text-success' : eValue >= 1.5 ? 'text-warning' : 'text-danger'
  return (
    <p className={`${typography.panelBody} ${colour} ml-6 mt-0.5`}>
      This assumption would need to be {eValue.toFixed(1)}x wrong to change the recommendation
    </p>
  )
}

/** Internal-string blocklist — used for data-layer guards (edge title extraction, filter predicates). */
const INTERNAL_PATTERN = /constraint_|observed_state|intercept=|node_id=|edge_id=|fac_[a-z_]+|opt_[a-z_]+|goal_[a-z_]+|blocks_analysis/i

function UncertaintyRow({
  item,
  onFocus,
  groupType = 'refinement',
  humanisedTitle,
  humanisedDescription,
  humanisedSuggestion,
}: {
  item: UncertaintyItem
  onFocus?: (nodeId: string) => void
  /** v7.4: Group context for styling - 'high-risk' = danger colors, 'refinement' = warning colors */
  groupType?: 'high-risk' | 'refinement'
  /** P0.1: Humanised title override (prevents raw PLoT messages leaking) */
  humanisedTitle?: string
  /** P0.1: Humanised description override */
  humanisedDescription?: string
  /** V11.2 Fix 4: Humanised suggestion for inline CTA */
  humanisedSuggestion?: string
}) {
  const handleNodeClick = useCallback((nodeId: string) => {
    if (onFocus) {
      onFocus(nodeId)
    } else {
      focusNodeById(nodeId)
    }
  }, [onFocus])

  // v7.4 Task 7: Use group-based styling instead of severity-based
  // Group 1 (high-risk): danger-bg with danger border
  // Group 2 (refinement): warning-bg with warning border
  const severity = item.severity || 'warning'
  const baseSeverityConfig = SEVERITY_CONFIG[severity]

  // v7.10 T7: Lighter card backgrounds — use panel bg with semantic border only
  const severityConfig = groupType === 'high-risk' ? {
    ...baseSeverityConfig,
    bgColor: 'bg-panel',
    borderColor: 'border-danger/30',
    textColor: 'text-danger',
  } : {
    ...baseSeverityConfig,
    bgColor: 'bg-panel',
    borderColor: 'border-warning/30',
    textColor: 'text-warning',
  }

  // Confidence pill: show when factor confidence is below 70%
  const confidencePill = (() => {
    if (item.factorConfidence == null) return null
    if (item.factorConfidence >= 0.7) return null
    if (item.factorConfidence < 0.5) {
      return {
        label: 'Low confidence',
        bgClass: 'bg-transparent',
        textClass: 'text-text-body',
        borderClass: 'border-danger/30',
      }
    }
    return {
      label: 'Medium confidence',
      bgClass: 'bg-transparent',
      textClass: 'text-text-body',
      borderClass: 'border-warning/30',
    }
  })()

  // Extract factor name from edge relationship in message for compact title
  // V12.1 Fix 4: Use from_label only (factor name), not the full edge path
  // V12.1 Fix 1: Guard against internal field names leaking
  const edgeMatch = item.message.match(/[""]([^""]+)\s*\u2192\s*([^""]+)[""]/)
  const fromLabel = edgeMatch?.[1] ? stripEncodingNotation(edgeMatch[1].trim()) : null
  const edgeTitle = fromLabel && !INTERNAL_PATTERN.test(fromLabel) ? fromLabel : null

  // v7.10 T7: consequence line removed — determine compact format from edge data
  const rawAlternativeOption = item.threshold?.alternativeOption
  const hasSpecificAlternative = typeof rawAlternativeOption === 'string'
    && stripEncodingNotation(rawAlternativeOption).trim().length > 0
    && rawAlternativeOption !== 'another option'

  // Determine if we use compact or full format
  const useCompactFormat = edgeTitle && (hasSpecificAlternative || item.code === 'SENSITIVE_ASSUMPTION')

  const isClickable = item.affectedNodes && item.affectedNodes.length > 0
  const cardClickHandler = isClickable ? () => handleNodeClick(item.affectedNodes![0]) : undefined

  return (
    <div
      className={`p-3 ${severityConfig.bgColor} border ${severityConfig.borderColor} rounded-lg transition-all ${
        isClickable ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/50' : ''
      }`}
      onClick={cardClickHandler}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cardClickHandler!() } } : undefined}
    >
      {useCompactFormat ? (
        // Compact 2-line format
        <>
          {/* Line 1: Icon + edge title + optional severity label + confidence pill + arrow */}
          <div className="flex items-start gap-2">
            {groupType === 'high-risk' ? (
              <AlertTriangle className={`w-4 h-4 ${severityConfig.textColor} flex-shrink-0 mt-0.5`} />
            ) : (
              <span className={`${severityConfig.textColor} ${typography.panelBody} flex-shrink-0 mt-0.5`}>{severityConfig.icon}</span>
            )}
            <span
              className={`${typography.panelHeader} text-text-header flex-1 min-w-0 break-words leading-snug`}
              title={edgeTitle ?? undefined}
            >
              {edgeTitle}
            </span>
            {severityConfig.label && (
              <span className={`${typography.panelBody} ${severityConfig.textColor} opacity-75 flex-shrink-0`}>
                • {severityConfig.label}
              </span>
            )}
            {confidencePill && (
              <span className={`${typography.panelMeta} px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${confidencePill.bgClass} ${confidencePill.textClass} border ${confidencePill.borderClass}`}>
                {confidencePill.label}
              </span>
            )}
            {isClickable && (
              <span className="text-text-light flex-shrink-0" aria-hidden="true">→</span>
            )}
          </div>
          {/* v7.10 T7: Per-card consequence line removed — section intro already explains risk level */}
          {typeof item.eValue === 'number' && <EValueIndicator eValue={item.eValue} />}
        </>
      ) : (
        // Full format for non-edge uncertainties
        <>
          <div className="flex items-start gap-2">
            {groupType === 'high-risk' ? (
              <AlertTriangle className={`w-4 h-4 ${severityConfig.textColor} flex-shrink-0 mt-0.5`} />
            ) : (
              <span className={`${severityConfig.textColor} ${typography.panelBody} flex-shrink-0`}>{severityConfig.icon}</span>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {(humanisedTitle || severityConfig.label) && (
                    <span className={`${typography.panelBody} text-text-header block mb-1`}>
                      {humanisedTitle || severityConfig.label}
                    </span>
                  )}
                  <p className={`${typography.panelBody} text-text-body`}>{humanisedDescription || item.displayText || 'Check and update this factor\u2019s inputs for more reliable results.'}</p>
                </div>
                {confidencePill && (
                  <span className={`${typography.panelMeta} px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 mt-0.5 ${confidencePill.bgClass} ${confidencePill.textClass} border ${confidencePill.borderClass}`}>
                    {confidencePill.label}
                  </span>
                )}
                {/* V11.2 Fix 4: Show humanised suggestion as inline CTA when clickable */}
                {isClickable && humanisedSuggestion ? (
                  <span className={`${typography.panelMeta} text-info flex-shrink-0 mt-0.5 whitespace-nowrap`}>{humanisedSuggestion}</span>
                ) : isClickable ? (
                  <span className="text-text-light flex-shrink-0 mt-0.5" aria-hidden="true">{'\u2192'}</span>
                ) : null}
              </div>
              {/* Threshold details if available */}
              {item.threshold && (
                <div className={`${typography.panelBody} text-text-light mt-1`}>
                  {item.threshold.variable && (
                    <p>
                      If {stripEncodingNotation(item.threshold.variable)}{' '}
                      {item.threshold.direction === 'positive' ? 'drops below' : 'rises above'}{' '}
                      {item.threshold.value}
                    </p>
                  )}
                  {item.threshold.alternativeOption && (
                    <p>{stripEncodingNotation(item.threshold.alternativeOption)} becomes the better choice</p>
                  )}
                </div>
              )}
              {typeof item.eValue === 'number' && <EValueIndicator eValue={item.eValue} />}
              {/* Suggestion as text when no action nodes */}
              {!isClickable && (humanisedSuggestion || item.suggestion) && (
                <p className={`${typography.panelBody} text-text-light mt-1`}>{humanisedSuggestion || item.suggestion}</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function ConfidenceSection({
  data,
  onFocusNode,
  topDriverLabel,
  topDriverId,
  visibleDriverCount = 0,
  winnerConstraintAnalysis,
  hinge,
  decisionState,
  topAction,
  excludeFactorIds,
  coachingReadiness,
  hasWinnerAbove50,
  flipThresholds,
}: ConfidenceSectionProps) {
  const [showAllUncertainties, setShowAllUncertainties] = useState(false)
  const [showAssumptions, setShowAssumptions] = useState(false)

  const {
    tier,
    uncertainties,
    topUncertainties,
    evidenceCoverage,
    improvements,
    filteredFragileEdges,
    analysisStatus,
    robustnessStatus,
    robustnessLevel,
    rankingStability,
    // Task 1: Hidden high-risk edges disclosure
    hiddenHighRiskCount,
    // Task 4 (M1 Coaching): Evidence gaps
    evidenceGaps,
    topEvidenceGaps,
    // Task 5 (M1 Coaching): Next actions
    nextActions,
    topNextActions,
    // Task 6 (M1 Coaching): Assumptions
    assumptions,
    // P0.1: Humanised critique messages
    humanisedCritiques,
    // V12: M2 evidence enhancements
    m2EvidenceEnhancements,
    // New ISL fields (gated on presence)
    conditionalWinners,
    inferenceWarnings,
  } = data

  // P0.1: Build lookup map for humanised critique display
  // V11.2 Fix 1+4: Include suggestion for CTA rendering
  const humanisedLookup = useMemo(() => {
    const map = new Map<string, { title: string; description: string; displayText: string | null; suggestion?: string }>()
    if (!humanisedCritiques) return map
    // Non-SENSITIVE_ASSUMPTION uncertainties are indexed in the same order as humanisedCritiques
    const plotCritiques = uncertainties.filter(u => u.code !== 'SENSITIVE_ASSUMPTION')
    plotCritiques.forEach((item, idx) => {
      const humanised = humanisedCritiques[idx]
      if (humanised) {
        const key = `${item.code}::${item.affectedNodes?.[0] ?? ''}`
        map.set(key, { title: humanised.title, description: humanised.description, displayText: humanised.displayText, suggestion: humanised.suggestion })
      }
    })
    return map
  }, [uncertainties, humanisedCritiques])

  const config = TIER_CONFIG[tier.tier]
  // Always show uncertainties section header with empty state if needed
  const showUncertainties = true

  // Bug 2 fix: "Good foundation" requires both high/moderate robustness AND stability >= 0.6
  // When robustnessLevel is undefined (old API), we don't apply the robustness check
  const hasNoFragileEdges = uncertainties.length === 0
  const hasStableRobustness = robustnessLevel === undefined || isStableRobustnessLevel(robustnessLevel)
  const hasLowRobustness = robustnessLevel !== undefined && !isStableRobustnessLevel(robustnessLevel)
  const hasHighStability = (rankingStability ?? 1) >= MIN_STABLE_RECOMMENDATION_STABILITY

  // V14.1: Readiness gate — "Good foundation" hidden when coaching says model needs work
  const readinessBlocks = coachingReadiness === 'needs_framing' || coachingReadiness === 'needs_evidence'

  // Determine if model is fully ready:
  // - Strong tier, no improvements, no uncertainties
  // - AND (robustness undefined OR high/moderate) AND stability >= 0.6
  // - V14.1: AND readiness is not needs_framing/needs_evidence
  // - V14.1: AND at least one option has winProbability > 0.5
  const isFullyReady = tier.tier === 'strong' && improvements.length === 0 && uncertainties.length === 0
    && hasStableRobustness && hasHighStability
    && !readinessBlocks && (hasWinnerAbove50 !== false)

  // Bug 2 fix: Low robustness warning only when robustnessLevel is explicitly low/very_low
  // OR when stability is below threshold with explicit robustness data
  const showLowRobustnessWarning = hasNoFragileEdges
    && (hasLowRobustness || (robustnessLevel !== undefined && !hasHighStability))

  // v7.10 T6: showTierWarning + tierDescription removed — tier badge now in Accordion header

  return (
    <div className="space-y-4">

      {/* V11: VOI promoted block — "Most valuable next step" */}
      {/* §15 treatment: primary left border, shadow-1, Lightbulb icon */}
      {/* V16.2: Show for ALL states (not just sensitive/indeterminate) so scroll-link target exists */}
      {decisionState && hinge && (
        <div
          id="mvs-card"
          className="bg-panel p-4 border border-success/30 border-l-[3px] border-l-success rounded-lg shadow-1"
          data-testid="voi-promoted-block"
        >
          <div className="flex items-start gap-2 mb-1">
            <Lightbulb className="w-4 h-4 text-success flex-shrink-0 mt-0.5" aria-hidden="true" />
            <h4 className={`${typography.panelHeader} text-text-header`}>
              Most valuable next step
            </h4>
          </div>
          <p className={`${typography.panelBody} text-text-body`}>
            Validate {hinge.label}.{' '}
            {hinge.reason === 'voi'
              ? 'Highest information value for your decision.'
              : 'Strongest driver, widest uncertainty.'}
          </p>
          {topAction?.couldFlip && (
            <p className={`${typography.panelMeta} text-danger mt-1`} data-testid="voi-could-flip">
              Could change the recommendation
            </p>
          )}
        </div>
      )}

      {/* CASE 1: Model is fully ready - show positive message ONLY */}
      {/* Bug 2 fix: Only show when robustness is high/moderate AND stability >= 0.6 */}
      {isFullyReady && (
        <div className="p-4 border border-success/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Check className="w-4 h-4 text-success flex-shrink-0" aria-hidden="true" />
            <span className={`${typography.panelHeader} text-success`}>
              Good foundation
            </span>
          </div>
          <p className={`${typography.panelBody} text-text-body`}>
            Your model looks good. You're ready to decide.
          </p>
        </div>
      )}

      {/* CASE 1b: Bug 2 fix - No fragile edges but low robustness/stability */}
      {showLowRobustnessWarning && (
        <div className="p-4 bg-panel border border-warning rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" aria-hidden="true" />
            <span className={`${typography.panelHeader} text-text-header`}>
              Low confidence
            </span>
          </div>
          <p className={`${typography.panelBody} text-text-body`}>
            No fragile edges, but overall confidence is low. Consider strengthening key assumptions.
          </p>
        </div>
      )}

      {/* v7.10 T6: CASE 2 tier warning card removed — readiness badge now shown
          in Accordion header via tierLabel/tierVariant props. */}

      {/* CASE 3: Strong tier but has items to address - show compact header */}
      {/* Note: Only show if not showing low robustness warning or readiness blocks */}
      {tier.tier === 'strong' && !isFullyReady && !showLowRobustnessWarning && !readinessBlocks && (
        <div className="p-3 border border-success/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-success flex-shrink-0" aria-hidden="true" />
            <p className={`${typography.panelBody} text-text-body`}>
              Good foundation, a few items to consider below
            </p>
          </div>
        </div>
      )}

      {/* Evidence coverage */}
      {evidenceCoverage && (
        <div className="p-3 border border-info/30 rounded-lg">
          <p className={`${typography.panelBody} text-text-body`}>
            <span className="font-medium">Model evidence:</span>{' '}
            {evidenceCoverage.backedByData} assumptions backed by data,{' '}
            {evidenceCoverage.needsValidation} need validation
          </p>
        </div>
      )}

      {/* V9.2: Grouped action items (replaces two-tier uncertainties + evidence gaps) */}
      {(() => {
        const severityOrder: Record<string, number> = { critical: 3, error: 2, warning: 1, blocker: 4 }
        const fragileEdges = [...uncertainties]
          .filter(item => item.code === 'SENSITIVE_ASSUMPTION')
          .sort((a, b) => {
            const aSev = severityOrder[a.severity || 'warning'] || 0
            const bSev = severityOrder[b.severity || 'warning'] || 0
            return bSev - aSev
          })
        const displayFragileEdges = showAllUncertainties ? fragileEdges : fragileEdges.slice(0, 3)
        const hiddenFragileCount = Math.max(0, fragileEdges.length - 3)

        // V11: Exclude hinge factor from displayed fragile edges (shown in VOI block)
        const excludeSet = new Set(excludeFactorIds ?? [])
        const visibleFragileEdges = excludeSet.size > 0
          ? displayFragileEdges.filter(item => !excludeSet.has(item.affectedNodes?.[0] ?? ''))
          : displayFragileEdges

        // V12.1 Fix 3: Hinge-filter nextActions before passing to groupActionItems
        const hingeNodeId = hinge?.nodeId
        const filteredNextActions = hingeNodeId
          ? (nextActions ?? []).filter(a => a.targetId !== hingeNodeId)
          : (nextActions ?? [])

        // Cross-group dedup (nextActions vs evidence gaps) is handled inside
        // groupActionItems via group1Keys — no need to add nextAction target IDs
        // to excludeFactorIds here.
        const groups = groupActionItems({
          fragileEdges: displayFragileEdges,
          evidenceGaps: evidenceGaps ?? [],
          constraintAnalysis: winnerConstraintAnalysis,
          excludeFactorIds: excludeFactorIds,
          evidenceEnhancements: m2EvidenceEnhancements,
          nextActions: filteredNextActions.length > 0 ? filteredNextActions : undefined,
        })

        // V12.1 Fix 3: Extract next-action items from Group 1 for separate rendering
        // V14.2: Only show items with specific targets — exclude generic preamble cards
        const nextActionGroupItems = groups[0].items.filter(i => i.id.startsWith('next-') && i.targetId)

        // Non-fragile-edge uncertainties (Group 2 legacy: low-confidence factors)
        // V12.4: Suppress items whose raw message matches internal-leak patterns,
        // UNLESS a humanised version is available (constraint items with humanised CTAs)
        const worthRefining = uncertainties.filter(item => {
          if (item.code === 'SENSITIVE_ASSUMPTION') return false
          if (!INTERNAL_PATTERN.test(item.message)) return true
          const key = `${item.code}::${item.affectedNodes?.[0] ?? ''}`
          return humanisedLookup.has(key)
        })

        // If nothing at all to show, render empty state
        const hasAnyContent = fragileEdges.length > 0
          || worthRefining.length > 0
          || (evidenceGaps?.length ?? 0) > 0
          || nextActionGroupItems.length > 0

        if (!hasAnyContent) {
          return (
            <div className="p-3 border border-panel-border rounded-lg">
              <p className={`${typography.panelBody} text-text-light flex items-start gap-2`}>
                <span aria-hidden="true">ℹ️</span>
                {robustnessStatus !== 'computed'
                  ? EMPTY_STATES.robustness
                  : filteredFragileEdges && filteredFragileEdges.filteredCount > 0
                    ? `No high-sensitivity assumptions found. ${filteredFragileEdges.filteredCount} other assumption${filteredFragileEdges.filteredCount === 1 ? '' : 's'} tested had lower impact.`
                    : 'No sensitive assumptions identified.'}
              </p>
            </div>
          )
        }

        // Render non-empty groups with dividers between them
        const nonEmptyGroups: Array<{ group: ActionGroup; fragileEdgeItems?: UncertaintyItem[]; refinementItems?: UncertaintyItem[] }> = []

        // Group 1: Validate before committing (fragile edges + next actions, after hinge exclusion)
        // V12.1 Fix 3: Also show Group 1 when only next-action items exist
        if (visibleFragileEdges.length > 0 || nextActionGroupItems.length > 0) {
          nonEmptyGroups.push({ group: groups[0], fragileEdgeItems: visibleFragileEdges })
        }

        // Non-SENSITIVE_ASSUMPTION uncertainties rendered alongside Group 2
        // Group 2: Investigate (evidence gaps + legacy low-confidence factors)
        if (groups[1].items.length > 0 || worthRefining.length > 0) {
          nonEmptyGroups.push({ group: groups[1], refinementItems: worthRefining })
        }

        // Groups 3 and 4 (M2 bias/pre-mortem) moved to ChallengeSection

        const ICON_MAP: Record<string, React.ElementType> = {
          AlertTriangle, Search,
        }

        return (
          <div className="space-y-4">
            {nonEmptyGroups.map((entry, groupIdx) => {
              const { group } = entry
              const IconComponent = ICON_MAP[group.icon]

              // V16.2: Validate group always expanded, other groups collapsed by default
              const isAlwaysExpanded = group.key === 'validate'
              const itemCount = group.key === 'validate'
                ? (entry.fragileEdgeItems?.length ?? 0) + nextActionGroupItems.length
                : group.items.length + (entry.refinementItems?.length ?? 0)

              const groupHeader = (
                <div className="flex items-center gap-2">
                  {IconComponent && (
                    <IconComponent className={`w-4 h-4 ${group.iconColour} flex-shrink-0`} />
                  )}
                  <h4 className={`${typography.panelHeader} text-text-header`}>
                    {group.label}
                  </h4>
                  {itemCount > 0 && (
                    <span className={`${typography.panelMeta} text-text-light`}>
                      {itemCount}
                    </span>
                  )}
                </div>
              )

              const groupContent = (
                <>
                  {group.intro && (
                    <p className={`${typography.panelMeta} text-text-light mb-2 mt-1.5`}>
                      {group.intro}
                    </p>
                  )}

                  {/* Group 1: Fragile edge cards (reuse UncertaintyRow) + next-action cards */}
                  {group.key === 'validate' && (
                    <div className="space-y-2">
                      {/* Fragile edge items first (by switch_probability descending) */}
                      {entry.fragileEdgeItems?.map((item, index) => (
                        <UncertaintyRow
                          key={`validate-${item.code}-${index}`}
                          item={item}
                          onFocus={onFocusNode}
                          groupType="high-risk"
                        />
                      ))}
                      {/* V12.1 Fix 3: Next-action items after fragile edges (by priority ascending) */}
                      {nextActionGroupItems.map((actionItem) => {
                        const canFocus = !!actionItem.targetId
                        const handleFocus = () => {
                          if (actionItem.targetId) {
                            if (onFocusNode) onFocusNode(actionItem.targetId)
                            else focusNodeById(actionItem.targetId)
                          }
                        }
                        return (
                          <div
                            key={actionItem.id}
                            className={`p-3 bg-panel border border-danger/30 rounded-lg ${canFocus ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : ''}`}
                            onClick={canFocus ? handleFocus : undefined}
                            role={canFocus ? 'button' : undefined}
                            tabIndex={canFocus ? 0 : undefined}
                            onKeyDown={canFocus ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFocus() } } : undefined}
                          >
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className={`${typography.panelHeader} text-text-header`}>{actionItem.title}</p>
                                {actionItem.subtitle && (
                                  <p className={`${typography.panelBody} text-text-light mt-0.5`}>{actionItem.subtitle}</p>
                                )}
                                {(actionItem.whatCouldHappen || actionItem.whatToDo) && (
                                  <WhyThisMatters
                                    whatCouldHappen={actionItem.whatCouldHappen}
                                    whatToDo={actionItem.whatToDo}
                                  />
                                )}
                              </div>
                              {canFocus && (
                                <span className="text-text-light flex-shrink-0" aria-hidden="true">{'\u2192'}</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Group 2: Evidence gap cards + legacy low-confidence factors */}
                  {group.key === 'investigate' && (
                    <div className="space-y-2">
                      {/* Legacy low-confidence factor cards — P0.1: humanised messages */}
                      {/* V11.2 Fix 1+4: Pass humanised suggestion for CTA rendering */}
                      {entry.refinementItems?.map((item, index) => {
                        const hKey = `${item.code}::${item.affectedNodes?.[0] ?? index}`
                        const humanised = humanisedLookup.get(hKey)
                        return (
                        <UncertaintyRow
                          key={`refine-${item.code}-${index}`}
                          item={item}
                          onFocus={onFocusNode}
                          groupType="refinement"
                          humanisedTitle={humanised?.title}
                          humanisedDescription={humanised?.description}
                          humanisedSuggestion={humanised?.suggestion}
                        />
                        )
                      })}
                      {/* Evidence gap action items — V12 B2: expandable when M2 enrichment present */}
                      {group.items.map((actionItem) => {
                        const canFocus = !!actionItem.targetId
                        const handleFocus = () => {
                          if (actionItem.targetId) {
                            if (onFocusNode) onFocusNode(actionItem.targetId)
                            else focusNodeById(actionItem.targetId)
                          }
                        }
                        // Confidence pill — outlined only per design system
                        const pill = actionItem.confidenceLevel === 'low'
                          ? { label: 'Low confidence', cls: 'bg-transparent text-text-body border-danger/30' }
                          : actionItem.confidenceLevel === 'medium'
                          ? { label: 'Medium confidence', cls: 'bg-transparent text-text-body border-warning/30' }
                          : null

                        // V14.1: VOI pill — "Check first" / "Check next"
                        const voiPill = actionItem.voiLevel
                          ? {
                              label: actionItem.voiLevel,
                              cls: actionItem.voiLevel === 'Check first'
                                ? 'text-info border-info/30'
                                : 'text-text-light border-border-default',
                            }
                          : null

                        const investigateBorderClass = actionItem.confidenceLevel === 'low'
                          ? 'border-warning/30'
                          : 'border-panel-border'

                        const cardContent = (
                          <div className="flex items-start gap-2">
                            <Search className="w-4 h-4 text-info flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                {canFocus ? (
                                  <button
                                    type="button"
                                    onClick={handleFocus}
                                    className={`${typography.panelHeader} text-info hover:text-info-hover hover:underline text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1 rounded`}
                                    aria-label={`Focus on ${actionItem.title} in model`}
                                  >
                                    {actionItem.title}
                                  </button>
                                ) : (
                                  <span className={`${typography.panelHeader} text-text-header`}>
                                    {actionItem.title}
                                  </span>
                                )}
                                {pill && (
                                  <span className={`${typography.panelMeta} px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 border ${pill.cls}`}>
                                    {pill.label}
                                  </span>
                                )}
                                {voiPill && (
                                  <span className={`${typography.panelMeta} px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 border ${voiPill.cls}`}>
                                    {voiPill.label}
                                  </span>
                                )}
                              </div>
                              {actionItem.subtitle && (
                                <p className={`${typography.panelBody} text-text-light mt-1`}>
                                  {actionItem.subtitle}
                                </p>
                              )}
                              {typeof actionItem.evpiPp === 'number' && actionItem.evpiPp > 0 && (
                                <p className={`${typography.panelMeta} text-info mt-0.5`}>
                                  Resolving could improve confidence by up to {Math.round(actionItem.evpiPp)}pp
                                </p>
                              )}
                              {(actionItem.whatCouldHappen || actionItem.whatToDo) && (
                                <WhyThisMatters
                                  whatCouldHappen={actionItem.whatCouldHappen}
                                  whatToDo={actionItem.whatToDo}
                                />
                              )}
                            </div>
                          </div>
                        )

                        return (
                          <div
                            key={actionItem.id}
                            className={`bg-panel p-3 border ${investigateBorderClass} rounded-lg ${actionItem.targetId ? 'results-card-hover' : ''}`}
                            onMouseEnter={() => actionItem.targetId && highlightNode(actionItem.targetId)}
                            onMouseLeave={clearHighlight}
                          >
                            {cardContent}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Groups 3/4 (M2) moved to ChallengeSection */}
                </>
              )

              return (
                <div key={group.key}>
                  {/* Group divider — between groups, not above first */}
                  {groupIdx > 0 && (
                    <div className="border-t border-panel-border mb-4" />
                  )}

                  {/* V16.2: Non-validate groups are collapsible (collapsed by default) */}
                  {isAlwaysExpanded ? (
                    <div>
                      <div className="mb-1.5">{groupHeader}</div>
                      {groupContent}
                    </div>
                  ) : (
                    <details className="group" data-testid={`group-${group.key}-details`}>
                      <summary className="cursor-pointer select-none list-none flex items-center justify-between mb-1.5">
                        {groupHeader}
                        <span className={`${typography.panelBody} text-info group-open:hidden`}>Show ˅</span>
                        <span className={`${typography.panelBody} text-info hidden group-open:inline`}>Hide ˄</span>
                      </summary>
                      {groupContent}
                    </details>
                  )}
                </div>
              )
            })}

            {/* Show more/fewer for Group 1 fragile edges */}
            {hiddenFragileCount > 0 && (
              <button
                onClick={() => setShowAllUncertainties(!showAllUncertainties)}
                className={`${typography.panelBody} text-info hover:underline`}
              >
                {showAllUncertainties ? 'Show fewer' : `Show ${hiddenFragileCount} more`}
              </button>
            )}
          </div>
        )
      })()}

      {/* V12.1 Fix 3: "Recommended actions" section removed — next_actions merged into Validate group above */}

      {/* Flip threshold cards — tipping points where recommendation changes */}
      {flipThresholds && flipThresholds.length > 0 && (
        <FlipThresholdCards thresholds={flipThresholds} onFocusNode={onFocusNode} />
      )}

      {/* Conditional winners — factor-dependent recommendation splits (ISL) */}
      {conditionalWinners && conditionalWinners.length > 0 && (
        <ConditionalWinnerCards winners={conditionalWinners} onFocusNode={onFocusNode} />
      )}

      {/* Inference warnings — model gaps (ISL) */}
      {inferenceWarnings && inferenceWarnings.length > 0 && (
        <InferenceWarningCard warnings={inferenceWarnings} onFocusNode={onFocusNode} />
      )}

      {/* Task 6 (M1 Coaching): Assumptions transparency link and disclosure */}
      {assumptions && assumptions.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-panel-border/50">
          <button
            onClick={() => setShowAssumptions(!showAssumptions)}
            className={`${typography.panelBody} text-text-light hover:text-text-body flex items-center gap-1`}
          >
            <span>{showAssumptions ? '▼' : '▶'}</span>
            View transparency log ({assumptions.length} assumption{assumptions.length === 1 ? '' : 's'})
          </button>

          {showAssumptions && (
            <div className="space-y-2 mt-2">
              {assumptions.map((assumption, index) => {
                const severityConfig = {
                  // §8.5 semantic filled: light bg + text-text-body (main-on-light fails contrast)
                  high: { icon: '⚠', bgColor: 'bg-panel', borderColor: 'border-danger/30', textColor: 'text-text-body' },
                  medium: { icon: '⚠', bgColor: 'bg-panel', borderColor: 'border-warning/30', textColor: 'text-text-body' },
                  low: { icon: 'ℹ', bgColor: 'bg-panel', borderColor: 'border-panel-border', textColor: 'text-text-body' },
                }[assumption.severity] ?? { icon: 'ℹ', bgColor: 'bg-panel', borderColor: 'border-panel-border', textColor: 'text-text-body' }

                const handleFocus = () => {
                  if (assumption.target) {
                    if (onFocusNode) {
                      onFocusNode(assumption.target)
                    } else {
                      // Use focusByTarget for consistency (defaults to node as assumption has no target_type)
                      focusByTarget(assumption.target)
                    }
                  }
                }

                return (
                  <div
                    key={`assumption-${index}`}
                    className={`p-2 bg-panel border border-panel-border rounded ${typography.panelBody}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={severityConfig.textColor}>{severityConfig.icon}</span>
                      <div className="flex-1">
                        {/* Task 2: Assumption message is clickable if target exists */}
                        {assumption.target ? (
                          <span
                            role="link"
                            tabIndex={0}
                            onClick={handleFocus}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFocus() } }}
                            className={`${severityConfig.textColor} cursor-pointer hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info-500 focus-visible:ring-offset-1 rounded`}
                            aria-label={`Focus on assumption in model`}
                          >
                            {assumption.message}
                          </span>
                        ) : (
                          <p className={severityConfig.textColor}>{assumption.message}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// FlipThresholdCards — tipping points where recommendation changes
// =============================================================================

const MAX_FLIP_CARDS = 3

/**
 * Renders flip threshold cards showing how much each factor must change
 * to flip the recommendation. Sorted by |margin| ascending (closest to flipping first).
 * Gated on flip_thresholds being non-empty.
 */
function FlipThresholdCards({
  thresholds,
  onFocusNode,
}: {
  thresholds: FlipThreshold[]
  onFocusNode?: (nodeId: string) => void
}) {
  const [showAll, setShowAll] = useState(false)

  // Sort by |margin| ascending — closest to flipping first
  const sorted = useMemo(() => {
    return [...thresholds]
      .filter(ft => ft.flip_value != null)
      .sort((a, b) => {
        const marginA = Math.abs((a.flip_value ?? a.current_value) - a.current_value)
        const marginB = Math.abs((b.flip_value ?? b.current_value) - b.current_value)
        return marginA - marginB
      })
  }, [thresholds])

  if (sorted.length === 0) return null

  const visible = showAll ? sorted : sorted.slice(0, MAX_FLIP_CARDS)
  const hiddenCount = Math.max(0, sorted.length - MAX_FLIP_CARDS)

  return (
    <div className="space-y-2 pt-2 border-t border-panel-border/50" data-testid="flip-threshold-cards">
      <div className="flex items-center gap-2 mb-1">
        <ArrowLeftRight className="w-4 h-4 text-warning flex-shrink-0" />
        <h4 className={`${typography.panelHeader} text-text-header`}>
          Tipping points
        </h4>
        <span className={`${typography.panelMeta} text-text-light`}>
          {sorted.length}
        </span>
      </div>
      <p className={`${typography.panelMeta} text-text-light mb-2`}>
        Changes that would flip the recommendation
      </p>
      {visible.map((ft, idx) => {
        const margin = ft.flip_value != null ? Math.abs(ft.flip_value - ft.current_value) : null
        // Progress: how far current_value is from flip_value on a 0-100 scale.
        // Uses the range [min(current,flip), max(current,flip)] to avoid negative/zero issues.
        const progressPct = (() => {
          if (ft.flip_value == null || margin == null || margin === 0) return 50
          const lo = Math.min(ft.current_value, ft.flip_value)
          const hi = Math.max(ft.current_value, ft.flip_value)
          const range = hi - lo
          if (range === 0) return 50
          return Math.min(100, Math.max(0, ((ft.current_value - lo) / range) * 100))
        })()
        const canFocus = !!ft.node_id
        const handleFocus = () => {
          if (ft.node_id) {
            if (onFocusNode) onFocusNode(ft.node_id)
            else focusNodeById(ft.node_id)
          }
        }
        const formatVal = (v: number) => {
          if (ft.unit === '$' || ft.unit === '\u00A3' || ft.unit === '\u20AC') return `${ft.unit}${v.toLocaleString()}`
          if (ft.unit === '%') return `${v.toLocaleString()}%`
          return ft.unit ? `${v.toLocaleString()} ${ft.unit}` : v.toLocaleString()
        }

        return (
          <div
            key={`${ft.node_id}-${idx}`}
            className={`p-3 bg-panel border border-warning/30 rounded-lg ${canFocus ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all' : ''}`}
            onClick={canFocus ? handleFocus : undefined}
            role={canFocus ? 'button' : undefined}
            tabIndex={canFocus ? 0 : undefined}
            onKeyDown={canFocus ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFocus() } } : undefined}
          >
            <p className={`${typography.panelHeader} text-text-header`}>
              {ft.label}: changes from {formatVal(ft.current_value)} to {formatVal(ft.flip_value!)} would flip the recommendation
            </p>
            {ft.alternative_winner_label && (
              <p className={`${typography.panelMeta} text-text-light mt-0.5`}>
                {ft.alternative_winner_label} becomes the better option
              </p>
            )}
            {/* Progress bar: current position relative to flip point */}
            <div className="mt-2 h-1.5 bg-panel-border rounded-full overflow-hidden">
              <div
                className="h-full bg-warning rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {margin != null && (
              <p className={`${typography.panelMeta} text-text-light mt-1`}>
                Margin: {formatVal(margin)}
              </p>
            )}
          </div>
        )
      })}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className={`${typography.panelBody} text-info hover:underline`}
        >
          {showAll ? 'Show fewer' : `See all ${sorted.length}`}
        </button>
      )}
    </div>
  )
}

// =============================================================================
// ConditionalWinnerCards — factor-dependent recommendation splits (ISL)
// =============================================================================

const MAX_CONDITIONAL_CARDS = 3

/**
 * Renders conditional winner cards showing where the recommendation changes
 * based on factor values. Gated on conditional_winners[] being non-empty.
 */
function ConditionalWinnerCards({
  winners,
  onFocusNode,
}: {
  winners: ConditionalWinner[]
  onFocusNode?: (nodeId: string) => void
}) {
  const visible = winners.slice(0, MAX_CONDITIONAL_CARDS)

  return (
    <div className="space-y-2 pt-2 border-t border-panel-border/50" data-testid="conditional-winner-cards">
      <div className="flex items-center gap-2 mb-1">
        <GitBranch className="w-4 h-4 text-info flex-shrink-0" />
        <h4 className={`${typography.panelHeader} text-text-header`}>
          Conditional recommendations
        </h4>
      </div>
      {visible.map((w, idx) => {
        const canFocus = !!w.factor_id
        const handleFocus = () => {
          if (w.factor_id) {
            if (onFocusNode) onFocusNode(w.factor_id)
            else focusNodeById(w.factor_id)
          }
        }
        return (
          <div
            key={`${w.factor_id}-${idx}`}
            className={`p-3 bg-panel border border-info/30 rounded-lg ${canFocus ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all' : ''}`}
            onClick={canFocus ? handleFocus : undefined}
            role={canFocus ? 'button' : undefined}
            tabIndex={canFocus ? 0 : undefined}
            onKeyDown={canFocus ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFocus() } } : undefined}
          >
            <p className={`${typography.panelHeader} text-text-header`}>
              When {w.factor_label} rises above {w.split_value.toLocaleString()}{w.split_unit ?? ''}, {w.high_bucket.winner_label} overtakes {w.low_bucket.winner_label}
            </p>
            <div className={`${typography.panelMeta} text-text-light mt-1 flex gap-4`}>
              <span>Above: {w.high_bucket.winner_label} ({Math.round(w.high_bucket.win_probability * 100)}%)</span>
              <span>Below: {w.low_bucket.winner_label} ({Math.round(w.low_bucket.win_probability * 100)}%)</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// =============================================================================
// InferenceWarningCard — model gap warnings (ISL)
// =============================================================================

/**
 * Renders inference warning card when ISL reports MISSING_ROOT_VALUE entries.
 * Shows count of affected factors with action chip to navigate.
 */
function InferenceWarningCard({
  warnings,
  onFocusNode,
}: {
  warnings: InferenceWarning[]
  onFocusNode?: (nodeId: string) => void
}) {
  // Only show MISSING_ROOT_VALUE warnings
  const relevant = warnings.filter(w => w.code === 'MISSING_ROOT_VALUE')
  if (relevant.length === 0) return null

  // Build ID→label map from all warnings
  const labelMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const w of relevant) {
      const ids = w.affected_nodes ?? []
      const labels = w.affected_labels ?? []
      ids.forEach((id, i) => {
        if (!map.has(id)) map.set(id, labels[i] ?? id)
      })
    }
    return map
  }, [relevant])
  const allLabels = [...labelMap.entries()].map(([id, label]) => ({ id, label }))

  return (
    <div className="pt-2 border-t border-panel-border/50" data-testid="inference-warnings">
      <div
        className="p-3 bg-panel border border-warning/30 rounded-lg"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className={`${typography.panelHeader} text-text-header`}>
              Model gaps: {uniqueNodes.length} factor{uniqueNodes.length !== 1 ? 's' : ''} used default values
            </p>
            {/* List affected factor labels with focus action */}
            {allLabels.length > 0 && (
              <ul className={`${typography.panelMeta} text-text-light mt-1 space-y-0.5`}>
                {allLabels.map((entry, i) => (
                  <li key={entry.id} className="flex items-center gap-1">
                    <span className="text-warning">{'\u2022'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (onFocusNode) onFocusNode(entry.id)
                        else focusNodeById(entry.id)
                      }}
                      className="text-info hover:underline text-left"
                    >
                      {entry.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConfidenceSection
