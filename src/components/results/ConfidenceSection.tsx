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

import { useState, useCallback } from 'react'
import type { ConfidenceSectionData, UncertaintyItem, ImprovementItem, CritiqueSeverity, ConfidenceTier, EvidenceGapItem, NextActionItem, AssumptionItem } from './types'
import { CappedList } from './CappedList'
import { focusNodeById, focusByTarget, type FocusTargetType } from '../../canvas/utils/focusHelpers'
import { EMPTY_STATES } from './emptyStates'
import { typography } from '../../styles/typography'
import { MIN_STABLE_RECOMMENDATION_STABILITY, isStableRobustnessLevel } from './constants'
import { stripEncodingNotation } from './utils/cleanFactorLabel'

/**
 * Task C (M1 Coaching): Convert VOI (Value of Information) to impact label.
 * Thresholds: >= 0.7 high, >= 0.4 medium, < 0.4 lower
 * Guards against undefined/NaN to avoid misleading "Lower impact" display.
 */
function voiToImpact(voi: number | undefined | null): string | null {
  if (!Number.isFinite(voi)) return null
  if (voi >= 0.7) return 'High impact if resolved'
  if (voi >= 0.4) return 'Medium impact if resolved'
  return 'Lower impact if resolved'
}

interface ConfidenceSectionProps {
  data: ConfidenceSectionData
  onFocusNode?: (nodeId: string) => void
  /** Top driver label for intro nudge text */
  topDriverLabel?: string
  /** Top driver ID for GraphLink in intro */
  topDriverId?: string
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
    label: 'Partial picture',
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
 */
function UncertaintyRow({
  item,
  onFocus,
}: {
  item: UncertaintyItem
  onFocus?: (nodeId: string) => void
}) {
  const handleNodeClick = useCallback((nodeId: string) => {
    if (onFocus) {
      onFocus(nodeId)
    } else {
      focusNodeById(nodeId)
    }
  }, [onFocus])

  // Get severity config (default to warning)
  const severity = item.severity || 'warning'
  const severityConfig = SEVERITY_CONFIG[severity]

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

  // Extract edge relationship from message for compact title
  // Pattern: If "X → Y" changes... or similar
  const edgeMatch = item.message.match(/[""]([^""]+)\s*→\s*([^""]+)[""]/)
  const hasEdgeTitle = edgeMatch && edgeMatch[1] && edgeMatch[2]

  // Truncate labels to max 25 chars for compact display
  const truncate = (s: string, max: number) => s.length > max ? s.slice(0, max - 1) + '…' : s
  // Patch 1: Clean encoding notation from edge titles to avoid "(0/1)" leaks
  const edgeTitle = hasEdgeTitle
    ? `${truncate(stripEncodingNotation(edgeMatch[1].trim()), 25)} → ${truncate(stripEncodingNotation(edgeMatch[2].trim()), 25)}`
    : null

  // Format compact consequence (P0-4: clean encoding from alternativeOption)
  const rawAlternativeOption = item.threshold?.alternativeOption
  const alternativeOption = typeof rawAlternativeOption === 'string'
    ? stripEncodingNotation(rawAlternativeOption)
    : rawAlternativeOption
  const hasSpecificAlternative = typeof alternativeOption === 'string'
    && alternativeOption.trim().length > 0
    && alternativeOption !== 'another option'
  const consequence = hasSpecificAlternative
    ? `If wrong, ${alternativeOption} could win`
    : 'Could change the recommendation'

  // Determine if we use compact or full format
  const useCompactFormat = hasEdgeTitle && (hasSpecificAlternative || item.code === 'SENSITIVE_ASSUMPTION')

  return (
    <div className={`p-3 ${severityConfig.bgColor} border ${severityConfig.borderColor} rounded-lg`}>
      {useCompactFormat ? (
        // Compact 2-line format
        <>
          {/* Line 1: Icon + edge title + optional severity label + confidence pill */}
          <div className="flex items-center gap-2">
            <span className={`${severityConfig.textColor} ${typography.panelBody} flex-shrink-0`}>{severityConfig.icon}</span>
            <span className={`${typography.panelHeader} ${severityConfig.textColor} truncate flex-1 min-w-0`}>
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
          </div>
          {/* Line 2: Consequence + inline CTA */}
          <div className="flex items-center justify-between gap-2 mt-1 ml-6">
            <span className={`${typography.panelBody} ${severityConfig.textColor} opacity-90`}>
              {consequence}
            </span>
            {item.affectedNodes && item.affectedNodes.length > 0 && (
              <button
                onClick={() => handleNodeClick(item.affectedNodes![0])}
                className={`${typography.panelBody} px-2 py-0.5 bg-white/50 hover:bg-white/80 rounded transition-colors flex-shrink-0`}
                style={{ minHeight: '28px' }}
              >
                Review this assumption
              </button>
            )}
          </div>
        </>
      ) : (
        // Full format for non-edge uncertainties
        <>
          <div className="flex items-start gap-2">
            <span className={`${severityConfig.textColor} ${typography.panelBody} flex-shrink-0`}>{severityConfig.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {severityConfig.label && (
                    <span className={`${typography.panelBody} ${severityConfig.textColor} block mb-1`}>
                      {severityConfig.label}
                    </span>
                  )}
                  <p className={`${typography.panelBody} ${severityConfig.textColor}`}>{stripEncodingNotation(item.message)}</p>
                </div>
                {confidencePill && (
                  <span className={`${typography.panelMeta} px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 mt-0.5 ${confidencePill.bgClass} ${confidencePill.textClass} border ${confidencePill.borderClass}`}>
                    {confidencePill.label}
                  </span>
                )}
              </div>
              {/* Threshold details if available */}
              {item.threshold && (
                <div className={`${typography.panelBody} ${severityConfig.textColor} mt-1 opacity-90`}>
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
              {item.suggestion && !(item.affectedNodes && item.affectedNodes.length > 0) && (
                <p className={`${typography.panelBody} ${severityConfig.textColor} mt-1 opacity-75`}>{item.suggestion}</p>
              )}
            </div>
          </div>
          {item.affectedNodes && item.affectedNodes.length > 0 && (
            <div className="flex justify-end mt-2">
              <button
                onClick={() => handleNodeClick(item.affectedNodes![0])}
                className={`${typography.panelBody} px-2 py-1 bg-white/50 hover:bg-white/80 rounded transition-colors`}
                style={{ minHeight: '28px' }}
              >
                {item.suggestion || 'Review this assumption'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ImprovementRow({
  item,
}: {
  item: ImprovementItem
}) {
  return (
    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
      <div className="flex items-start gap-2">
        <span className="text-slate-400 mt-0.5">□</span>
        <div className="flex-1">
          <p className={`${typography.panelBody} text-slate-700`}>{item.action}</p>
          {item.reason && item.reason !== item.action && (
            <p className={`${typography.panelBody} text-slate-500 mt-1`}>{item.reason}</p>
          )}
          {item.effortMinutes && (
            <span className={`${typography.panelBody} text-slate-500 mt-1 inline-block`}>
              ~{item.effortMinutes} min
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function ConfidenceSection({
  data,
  onFocusNode,
  topDriverLabel,
  topDriverId,
}: ConfidenceSectionProps) {
  const [showAllUncertainties, setShowAllUncertainties] = useState(false)
  const [showAllImprovements, setShowAllImprovements] = useState(false)
  const [showAssumptions, setShowAssumptions] = useState(false)

  const {
    tier,
    uncertainties,
    topUncertainties,
    evidenceCoverage,
    improvements,
    topImprovements,
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
  } = data

  const config = TIER_CONFIG[tier.tier]
  const displayUncertainties = showAllUncertainties ? uncertainties : topUncertainties
  const hiddenUncertaintyCount = uncertainties.length - topUncertainties.length
  const displayImprovements = showAllImprovements ? improvements : topImprovements
  const hiddenImprovementCount = improvements.length - topImprovements.length

  // Always show uncertainties section header with empty state if needed
  const showUncertainties = true

  // Bug 2 fix: "Good foundation" requires both high/moderate robustness AND stability >= 0.6
  // When robustnessLevel is undefined (old API), we don't apply the robustness check
  const hasNoFragileEdges = uncertainties.length === 0
  const hasStableRobustness = robustnessLevel === undefined || isStableRobustnessLevel(robustnessLevel)
  const hasLowRobustness = robustnessLevel !== undefined && !isStableRobustnessLevel(robustnessLevel)
  const hasHighStability = (rankingStability ?? 1) >= MIN_STABLE_RECOMMENDATION_STABILITY

  // Determine if model is fully ready:
  // - Strong tier, no improvements, no uncertainties
  // - AND (robustness undefined OR high/moderate) AND stability >= 0.6
  const isFullyReady = tier.tier === 'strong' && improvements.length === 0 && uncertainties.length === 0
    && hasStableRobustness && hasHighStability

  // Bug 2 fix: Low robustness warning only when robustnessLevel is explicitly low/very_low
  // OR when stability is below threshold with explicit robustness data
  const showLowRobustnessWarning = hasNoFragileEdges
    && (hasLowRobustness || (robustnessLevel !== undefined && !hasHighStability))

  // Show tier warning only for non-strong tiers
  const showTierWarning = tier.tier !== 'strong'
  // Determine if there are items to address below (for dynamic description)
  const hasItemsToAddress = uncertainties.length > 0 || improvements.length > 0
  const tierDescription = hasItemsToAddress ? config.descriptionWithItems : config.descriptionWithoutItems

  // Intro nudge: show when there are actionable items and a top driver
  const totalActionableItems = uncertainties.length + improvements.length
  const showIntroNudge = totalActionableItems > 0 && topDriverLabel

  return (
    <div className="space-y-4">
      {/* Intro nudge — cognitive prompt */}
      {showIntroNudge && (
        <div className={`p-2.5 bg-panel-hover rounded-lg ${typography.panelHeader} text-text-body leading-relaxed`}>
          <strong className="text-text-header">{totalActionableItems} item{totalActionableItems === 1 ? '' : 's'} could affect your decision.</strong>{' '}
          Your biggest driver ({topDriverId ? (
            <button
              type="button"
              onClick={() => {
                if (onFocusNode) onFocusNode(topDriverId)
                else focusNodeById(topDriverId)
              }}
              className="text-info font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-1 rounded"
            >
              {stripEncodingNotation(topDriverLabel)}
            </button>
          ) : (
            <span className="text-info font-medium">{stripEncodingNotation(topDriverLabel)}</span>
          )}) also has the widest uncertainty — is your estimate solid enough to rely on?
        </div>
      )}

      {/* CASE 1: Model is fully ready - show positive message ONLY */}
      {/* Bug 2 fix: Only show when robustness is high/moderate AND stability >= 0.6 */}
      {isFullyReady && (
        <div className="p-4 bg-success-50 border border-success-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">✓</span>
            <span className={`${typography.panelHeader} text-success-800`}>
              Good foundation
            </span>
          </div>
          <p className={`${typography.panelBody} text-success-700`}>
            Your model looks good. You're ready to decide.
          </p>
        </div>
      )}

      {/* CASE 1b: Bug 2 fix - No fragile edges but low robustness/stability */}
      {showLowRobustnessWarning && !showTierWarning && (
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

      {/* CASE 2: Tier warning - show for fair/needs_work (NOT for strong) */}
      {showTierWarning && (
        <div className={`p-4 rounded-lg border ${config.bgColor} ${config.borderColor}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{config.icon}</span>
            <span className={`${typography.panelHeader} ${config.textColor}`}>
              {config.label}
            </span>
          </div>
          <p className={`${typography.panelBody} ${config.textColor}`}>
            {tierDescription}
          </p>
        </div>
      )}

      {/* CASE 3: Strong tier but has items to address - show compact header */}
      {/* Note: Only show if not showing low robustness warning */}
      {tier.tier === 'strong' && !isFullyReady && !showLowRobustnessWarning && (
        <div className="p-3 bg-success-50 border border-success-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-success-600">✓</span>
            <p className={`${typography.panelBody} text-success-800`}>
              Good foundation — a few items to consider below
            </p>
          </div>
        </div>
      )}

      {/* Evidence coverage */}
      {evidenceCoverage && (
        <div className="p-3 bg-info-50 border border-info-200 rounded-lg">
          <p className={`${typography.panelBody} text-info-800`}>
            <span className="font-medium">Model evidence:</span>{' '}
            {evidenceCoverage.backedByData} assumptions backed by data,{' '}
            {evidenceCoverage.needsValidation} need validation
          </p>
        </div>
      )}

      {/* P2-3: Uncertainties - Two-tier ranked list */}
      {showUncertainties && (() => {
        // Split uncertainties into two tiers per brief:
        // - "Could change the decision" = severity critical, error, or blocker (flip probability > 20%)
        // - "Worth refining" = severity warning or info
        const highImpactSeverities: CritiqueSeverity[] = ['blocker', 'critical', 'error']
        const couldChangeDecision = displayUncertainties.filter(
          item => highImpactSeverities.includes(item.severity || 'warning')
        )
        const worthRefining = displayUncertainties.filter(
          item => !highImpactSeverities.includes(item.severity || 'warning')
        )

        return (
          <div className="space-y-4">
            {uncertainties.length === 0 ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className={`${typography.panelBody} text-slate-600 flex items-start gap-2`}>
                  <span aria-hidden="true">ℹ️</span>
                  {/* Bug 4 fix: Different message based on robustness status */}
                  {robustnessStatus !== 'computed'
                    ? EMPTY_STATES.robustness
                    : filteredFragileEdges && filteredFragileEdges.filteredCount > 0
                      ? `No high-sensitivity assumptions found. ${filteredFragileEdges.filteredCount} assumption${filteredFragileEdges.filteredCount === 1 ? '' : 's'} changed the best option in <${Math.round(filteredFragileEdges.threshold * 100)}% of simulations.`
                      : 'No sensitive assumptions identified at the current threshold.'}
                </p>
              </div>
            ) : (
              <>
                {/* Tier 1: Could change the decision */}
                {couldChangeDecision.length > 0 && (
                  <div className="space-y-2">
                    <h4 className={`${typography.panelHeader} text-slate-500 tracking-wide`}>
                      Could change the decision
                    </h4>
                    <div className="space-y-2">
                      {couldChangeDecision.map((item, index) => (
                        <UncertaintyRow
                          key={`high-${item.code}-${index}`}
                          item={item}
                          onFocus={onFocusNode}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Tier 2: Worth refining */}
                {worthRefining.length > 0 && (
                  <div className="space-y-2">
                    <h4 className={`${typography.panelHeader} text-slate-500 tracking-wide`}>
                      Worth refining
                    </h4>
                    <div className="space-y-2">
                      {worthRefining.map((item, index) => (
                        <UncertaintyRow
                          key={`low-${item.code}-${index}`}
                          item={item}
                          onFocus={onFocusNode}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {hiddenUncertaintyCount > 0 && (
              <button
                onClick={() => setShowAllUncertainties(!showAllUncertainties)}
                className={`${typography.panelBody} text-sky-600 hover:text-sky-700`}
              >
                {showAllUncertainties ? 'Show fewer' : `+${hiddenUncertaintyCount} more items`}
              </button>
            )}

            {/* Task 1: Hidden high-risk edges disclosure (above threshold but cut by display limit) */}
            {hiddenHighRiskCount !== undefined && hiddenHighRiskCount > 0 && (
              <p className={`${typography.panelBody} text-slate-500 mt-2`}>
                {hiddenHighRiskCount} more assumption{hiddenHighRiskCount === 1 ? '' : 's'} above threshold not shown
              </p>
            )}

            {/* Filtered items disclosure (below threshold) */}
            {filteredFragileEdges && filteredFragileEdges.filteredCount > 0 && (
              <p className={`${typography.panelBody} text-slate-500 mt-2`}>
                {filteredFragileEdges.description}
              </p>
            )}
          </div>
        )
      })()}

      {/* Task 11: Evidence Gaps - consolidated into "What needs attention" */}
      {evidenceGaps && evidenceGaps.length > 0 && (
        <div className="space-y-2">
          <h4 className={`${typography.panelHeader} text-slate-500 tracking-wide`}>
            Evidence gaps
          </h4>
          <CappedList<EvidenceGapItem>
            items={evidenceGaps}
            maxVisible={3}
            getKey={(gap) => gap.factorId}
            renderItem={(gap) => {
              // Task 4: Focus fallback - target_node_id → factor_id → hide CTA
              const focusTarget = gap.targetNodeId ?? gap.factorId ?? null
              const canFocus = focusTarget !== null

              const handleFocus = () => {
                if (canFocus) {
                  if (onFocusNode) {
                    onFocusNode(focusTarget!)
                  } else {
                    focusNodeById(focusTarget!)
                  }
                }
              }

              // Task 7: Clean encoding notation from factor label
              const cleanedFactorLabel = stripEncodingNotation(gap.factorLabel)

              return (
                <div className="w-full text-left p-3 bg-panel border border-panel-border rounded-lg">
                  <div className="flex-1 min-w-0">
                    {/* Task 2: Factor label is clickable instead of separate CTA */}
                    {canFocus ? (
                      <span
                        role="link"
                        tabIndex={0}
                        onClick={handleFocus}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFocus() } }}
                        className={`${typography.panelHeader} text-text-body cursor-pointer hover:underline focus:outline-none focus:ring-2 focus:ring-info-500 focus:ring-offset-1 rounded`}
                        aria-label={`Focus on ${cleanedFactorLabel} in model`}
                      >
                        {cleanedFactorLabel}
                      </span>
                    ) : (
                      <p className={`${typography.panelHeader} text-text-body`}>
                        {cleanedFactorLabel}
                      </p>
                    )}
                    {gap.suggestion && (
                      <p className={`${typography.panelBody} text-text-light mt-1`}>
                        {gap.suggestion}
                      </p>
                    )}
                    {/* Task C: VOI impact label (only show if VOI is valid) */}
                    {voiToImpact(gap.voi) && (
                      <span className={`${typography.panelBody} text-text-light mt-1 block`}>
                        {voiToImpact(gap.voi)}
                      </span>
                    )}
                  </div>
                </div>
              )
            }}
            overflowLabel={(n) => `+${n} more`}
            dedupeFn={(gap) => gap.factorId}
            sortFn={(a, b) => b.voi - a.voi}
            emptyMessage="No evidence gaps identified"
            expandButtonAriaLabel="Show more evidence gaps"
          />
        </div>
      )}

      {/* Task 5 (M1 Coaching): Next Actions - "Recommended actions" */}
      {nextActions && nextActions.length > 0 && (
        <div className="space-y-2">
          <h4 className={`${typography.panelHeader} text-slate-500 tracking-wide`}>
            Recommended actions
          </h4>
          <CappedList<NextActionItem>
            items={nextActions}
            maxVisible={3}
            getKey={(action) => `${action.action}::${action.targetId ?? ''}`}
            renderItem={(action, index) => {
              const handleFocus = () => {
                if (action.targetId) {
                  if (onFocusNode) {
                    onFocusNode(action.targetId)
                  } else {
                    // Use unified focus handler for proper target type resolution
                    focusByTarget(action.targetId, action.targetType as FocusTargetType)
                  }
                }
              }

              return (
                <div className="w-full text-left p-3 bg-panel border border-panel-border rounded-lg">
                  <div className="flex-1 min-w-0">
                    {/* Task D: Bold the first action item for visual weight */}
                    {/* Task 2: Action text is clickable if target exists */}
                    {action.targetId ? (
                      <span
                        role="link"
                        tabIndex={0}
                        onClick={handleFocus}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFocus() } }}
                        className={`${typography.panelBody} text-text-body cursor-pointer hover:underline focus:outline-none focus:ring-2 focus:ring-info-500 focus:ring-offset-1 rounded`}
                        aria-label={`Focus on ${action.targetLabel || action.action} in model`}
                      >
                        {action.action}
                      </span>
                    ) : (
                      <p className={`${typography.panelBody} text-text-body`}>
                        {action.action}
                      </p>
                    )}
                    {action.rationale && (
                      <p className={`${typography.panelBody} text-text-light mt-1`}>
                        {action.rationale}
                      </p>
                    )}
                  </div>
                </div>
              )
            }}
            overflowLabel={(n) => `+${n} more`}
            dedupeFn={(action) => `${action.action}::${action.targetId ?? ''}`}
            sortFn={(a, b) => a.priority - b.priority}
            emptyMessage="No recommended actions"
            expandButtonAriaLabel="Show more recommended actions"
          />
        </div>
      )}

      {/* Improvements */}
      <div className="space-y-2">
        <h4 className={`${typography.panelHeader} text-slate-500 tracking-wide`}>
          Improvements
        </h4>
        {improvements.length === 0 ? (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <p className={`${typography.panelBody} text-slate-600 flex items-start gap-2`}>
              <span aria-hidden="true">ℹ️</span>
              {/* Task 3 + P2 Polish: Show context-appropriate message when no improvements */}
              {analysisStatus === 'computed' || analysisStatus === 'partial'
                ? (tier.tier === 'strong' || robustnessLevel === 'high' || robustnessLevel === 'moderate'
                    ? 'Model structure is sound — focus on strengthening assumptions and framing.'
                    : 'No structural issues detected. Focus on the assumptions above.')
                : EMPTY_STATES.improvements}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayImprovements.map((item, index) => (
              <ImprovementRow
                key={`${item.action.slice(0, 20)}-${index}`}
                item={item}
              />
            ))}
          </div>
        )}

        {hiddenImprovementCount > 0 && (
          <button
            onClick={() => setShowAllImprovements(!showAllImprovements)}
            className={`${typography.panelBody} text-sky-600 hover:text-sky-700`}
          >
            {showAllImprovements ? 'Show fewer' : `+${hiddenImprovementCount} more items`}
          </button>
        )}
      </div>

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
