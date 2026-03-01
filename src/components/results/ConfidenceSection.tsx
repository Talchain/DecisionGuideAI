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
import type { ConfidenceSectionData, UncertaintyItem, CritiqueSeverity, ConfidenceTier, EvidenceGapItem, AssumptionItem, DecisionState, HingeInfo, TopAction } from './types'
import type { ConstraintAnalysis } from '../../types/constraints'
import { focusNodeById, focusByTarget, type FocusTargetType } from '../../canvas/utils/focusHelpers'
import { highlightNode, clearHighlight } from '../../canvas/utils/highlightHelpers'
import { EMPTY_STATES } from './emptyStates'
import { typography } from '../../styles/typography'
import { MIN_STABLE_RECOMMENDATION_STABILITY, isStableRobustnessLevel } from './constants'
import { stripEncodingNotation } from './utils/cleanFactorLabel'
import { groupActionItems, type ActionGroup, type ActionItem } from './utils/groupActionItems'
import { AlertTriangle, Search } from 'lucide-react'

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
    bgColor: 'bg-danger-50',
    borderColor: 'border-danger-300',
    textColor: 'text-danger-800',
    label: 'Blocks analysis',  // Reserved for genuine pre-run validation blockers
  },
  critical: {
    icon: '⚠',
    bgColor: 'bg-danger-50',
    borderColor: 'border-danger-200',
    textColor: 'text-danger-700',
    label: 'Critical assumption',  // For high-severity fragile edges
  },
  error: {
    icon: '✕',
    bgColor: 'bg-danger-50',
    borderColor: 'border-danger-200',
    textColor: 'text-danger-700',
  },
  warning: {
    icon: '⚠',
    bgColor: 'bg-warning-50',
    borderColor: 'border-warning-200',
    textColor: 'text-warning-700',
  },
  info: {
    icon: 'ℹ',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    textColor: 'text-slate-600',
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
    bgColor: 'bg-success-50',
    borderColor: 'border-success-200',
    textColor: 'text-success-800',
    label: 'Good foundation',
    descriptionWithItems: 'Your model captures this decision well.',
    descriptionWithoutItems: 'Your model captures this decision well.',
  },
  fair: {
    icon: '⚠',
    bgColor: 'bg-warning-50',
    borderColor: 'border-warning-200',
    textColor: 'text-warning-800',
    label: 'Fair',
    descriptionWithItems: 'Your model covers the basics. Address the items below.',
    descriptionWithoutItems: 'Your model covers the basics but could use more detail.',
  },
  needs_work: {
    icon: '⚠',
    bgColor: 'bg-danger-50',
    borderColor: 'border-danger-200',
    textColor: 'text-danger-800',
    label: 'Early sketch',
    descriptionWithItems: 'Add the missing elements below before relying on the recommendation.',
    descriptionWithoutItems: 'Add more factors and connections before relying on the recommendation.',
  },
  unknown: {
    icon: '?',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    textColor: 'text-slate-600',
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

/** Internal-string blocklist — if a raw message matches, replace with safe generic copy. */
const INTERNAL_PATTERN = /constraint_|observed_state|intercept=|node_id=|edge_id=|fac_[a-z_]+|opt_[a-z_]+|goal_[a-z_]+|blocks_analysis/i

function safeMessageFallback(message: string): string {
  const cleaned = stripEncodingNotation(message)
  if (INTERNAL_PATTERN.test(cleaned)) {
    return 'Check and update this factor\u2019s inputs for more reliable results.'
  }
  return cleaned
}

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
        bgClass: 'bg-danger-bg',
        textClass: 'text-danger',
        borderClass: 'border-danger',
      }
    }
    return {
      label: 'Medium confidence',
      bgClass: 'bg-warning-bg',
      textClass: 'text-warning',
      borderClass: 'border-warning',
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
        isClickable ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-info/50' : ''
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
                  <p className={`${typography.panelBody} text-text-body`}>{humanisedDescription || safeMessageFallback(item.message)}</p>
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
  } = data

  // P0.1: Build lookup map for humanised critique display
  // V11.2 Fix 1+4: Include suggestion for CTA rendering
  const humanisedLookup = useMemo(() => {
    const map = new Map<string, { title: string; description: string; suggestion?: string }>()
    if (!humanisedCritiques) return map
    // Non-SENSITIVE_ASSUMPTION uncertainties are indexed in the same order as humanisedCritiques
    const plotCritiques = uncertainties.filter(u => u.code !== 'SENSITIVE_ASSUMPTION')
    plotCritiques.forEach((item, idx) => {
      const humanised = humanisedCritiques[idx]
      if (humanised) {
        const key = `${item.code}::${item.affectedNodes?.[0] ?? ''}`
        map.set(key, { title: humanised.title, description: humanised.description, suggestion: humanised.suggestion })
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

      {/* V11: VOI promoted block — "Most valuable next step" for sensitive/indeterminate */}
      {decisionState && decisionState !== 'robust' && hinge && (
        <div
          className="p-4 border border-info/30 rounded-lg"
          style={{ backgroundColor: 'rgba(99,173,207,0.04)' }}
          data-testid="voi-promoted-block"
        >
          <h4 className={`${typography.panelHeader} text-text-header mb-1`}>
            Most valuable next step
          </h4>
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
            <span className="text-lg">✓</span>
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
            <span className="text-lg">⚠</span>
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
            <span className="text-success">✓</span>
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

              return (
                <div key={group.key}>
                  {/* Group divider — between groups, not above first */}
                  {groupIdx > 0 && (
                    <div className="border-t border-panel-border mb-4" />
                  )}

                  {/* Group header */}
                  <div className="flex items-center gap-2 mb-1.5">
                    {IconComponent && (
                      <IconComponent className={`w-4 h-4 ${group.iconColour} flex-shrink-0`} />
                    )}
                    <h4 className={`${typography.panelHeader} text-text-header`}>
                      {group.label}
                    </h4>
                    {(group.items.length > 0 || (entry.fragileEdgeItems?.length ?? 0) > 0) && (
                      <span className={`${typography.panelMeta} text-text-light`}>
                        {group.key === 'validate'
                          ? (entry.fragileEdgeItems?.length ?? 0) + nextActionGroupItems.length
                          : group.items.length + (entry.refinementItems?.length ?? 0)}
                      </span>
                    )}
                  </div>
                  {group.intro && (
                    <p className={`${typography.panelMeta} text-text-light mb-2`}>
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
                        // Confidence pill
                        const pill = actionItem.confidenceLevel === 'low'
                          ? { label: 'Low confidence', cls: 'bg-danger-light text-danger border-danger/30' }
                          : actionItem.confidenceLevel === 'medium'
                          ? { label: 'Medium confidence', cls: 'bg-warning-light text-warning border-warning/30' }
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

                        const hasEnrichment = actionItem.whatToDo || actionItem.whatCouldHappen

                        const cardContent = (
                          <div className="flex items-start gap-2">
                            <Search className="w-4 h-4 text-info flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                {canFocus ? (
                                  <button
                                    type="button"
                                    onClick={handleFocus}
                                    className={`${typography.panelHeader} text-info hover:text-info-hover hover:underline text-left focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-1 rounded`}
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
                            </div>
                          </div>
                        )

                        if (hasEnrichment) {
                          return (
                            <details
                              key={actionItem.id}
                              className="border border-panel-border rounded-lg overflow-hidden results-card-hover"
                              onMouseEnter={() => actionItem.targetId && highlightNode(actionItem.targetId)}
                              onMouseLeave={clearHighlight}
                            >
                              <summary className="p-3 cursor-pointer hover:bg-panel-hover">
                                {cardContent}
                              </summary>
                              <div className="px-3 pb-3 space-y-1 border-t border-panel-border pt-2">
                                {actionItem.whatToDo && (
                                  <p className={`${typography.panelBody} text-text-body`}>{actionItem.whatToDo}</p>
                                )}
                                {actionItem.whatCouldHappen && (
                                  <p className={`${typography.panelMeta} text-text-light italic`}>{actionItem.whatCouldHappen}</p>
                                )}
                              </div>
                            </details>
                          )
                        }

                        return (
                          <div
                            key={actionItem.id}
                            className={`p-3 border border-panel-border rounded-lg ${actionItem.targetId ? 'results-card-hover' : ''}`}
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


      {/* Task 6 (M1 Coaching): Assumptions transparency link and disclosure */}
      {assumptions && assumptions.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <button
            onClick={() => setShowAssumptions(!showAssumptions)}
            className={`${typography.panelBody} text-slate-500 hover:text-slate-700 flex items-center gap-1`}
          >
            <span>{showAssumptions ? '▼' : '▶'}</span>
            View transparency log ({assumptions.length} assumption{assumptions.length === 1 ? '' : 's'})
          </button>

          {showAssumptions && (
            <div className="space-y-2 mt-2">
              {assumptions.map((assumption, index) => {
                const severityConfig = {
                  high: { icon: '⚠', bgColor: 'bg-danger-50', borderColor: 'border-danger-200', textColor: 'text-danger-700' },
                  medium: { icon: '⚠', bgColor: 'bg-warning-50', borderColor: 'border-warning-200', textColor: 'text-warning-700' },
                  low: { icon: 'ℹ', bgColor: 'bg-slate-50', borderColor: 'border-slate-200', textColor: 'text-slate-600' },
                }[assumption.severity] ?? { icon: 'ℹ', bgColor: 'bg-slate-50', borderColor: 'border-slate-200', textColor: 'text-slate-600' }

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
                            className={`${severityConfig.textColor} cursor-pointer hover:underline focus:outline-none focus:ring-2 focus:ring-info-500 focus:ring-offset-1 rounded`}
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

export default ConfidenceSection
