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
import type { ConfidenceSectionData, UncertaintyItem, ImprovementItem, CritiqueSeverity, ConfidenceTier } from './types'
import { focusNodeById } from '../../canvas/utils/focusHelpers'
import { EMPTY_STATES } from './emptyStates'
import { typography } from '../../styles/typography'
import { MIN_STABLE_RECOMMENDATION_STABILITY, isStableRobustnessLevel } from './constants'

interface ConfidenceSectionProps {
  data: ConfidenceSectionData
  onFocusNode?: (nodeId: string) => void
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
    label: 'Blocks analysis',
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

  // Format threshold message if present
  const alternativeOption = item.threshold?.alternativeOption
  const hasSpecificAlternative = typeof alternativeOption === 'string'
    && alternativeOption.trim().length > 0
    && alternativeOption !== 'another option'
  const thresholdMessage = item.threshold && hasSpecificAlternative
    ? `If ${item.threshold.variable} ${item.threshold.direction === 'positive' ? 'drops below' : 'rises above'} ${item.threshold.value.toFixed(1)}, "${alternativeOption}" becomes the better choice`
    : null

  return (
    <div className={`p-3 ${severityConfig.bgColor} border ${severityConfig.borderColor} rounded-lg`}>
      <div className="flex items-start gap-2">
        <span className={`${severityConfig.textColor} text-sm flex-shrink-0`}>{severityConfig.icon}</span>
        <div className="flex-1 min-w-0">
          {severityConfig.label && (
            <span className={`text-xs ${severityConfig.textColor} block mb-1`}>
              {severityConfig.label}
            </span>
          )}
          <p className={`text-sm ${severityConfig.textColor}`}>{item.message}</p>
        </div>
      </div>
      {thresholdMessage && (
        <p className="text-xs text-warning-700 mt-1 bg-warning-50 px-2 py-1 rounded">
          {thresholdMessage}
        </p>
      )}
      {/* Show suggestion as text only if no actionable button */}
      {item.suggestion && (!item.affectedNodes || item.affectedNodes.length === 0) && (
        <p className="text-xs text-slate-500 mt-1">
          {item.suggestion}
        </p>
      )}
      {/* Show single button for first affected node (not per-node to avoid duplicates) */}
      {item.affectedNodes && item.affectedNodes.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          <button
            onClick={() => handleNodeClick(item.affectedNodes![0])}
            className="text-xs px-2 py-0.5 bg-info-100 text-info-700 rounded hover:bg-info-200 transition-colors"
            title={`Focus on canvas`}
          >
            {item.suggestion || 'Validate this assumption'}
          </button>
        </div>
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
          <p className="text-sm text-slate-700">{item.action}</p>
          {item.reason && item.reason !== item.action && (
            <p className="text-xs text-slate-500 mt-1">{item.reason}</p>
          )}
          {item.effortMinutes && (
            <span className="text-xs text-slate-400 mt-1 inline-block">
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
}: ConfidenceSectionProps) {
  const [showAllUncertainties, setShowAllUncertainties] = useState(false)
  const [showAllImprovements, setShowAllImprovements] = useState(false)

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

  return (
    <div className="space-y-4">
      {/* CASE 1: Model is fully ready - show positive message ONLY */}
      {/* Bug 2 fix: Only show when robustness is high/moderate AND stability >= 0.6 */}
      {isFullyReady && (
        <div className="p-4 bg-success-50 border border-success-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">✓</span>
            <span className="text-sm font-semibold text-success-800">
              Good foundation
            </span>
          </div>
          <p className="text-sm text-success-700">
            Your model looks good. You're ready to decide.
          </p>
        </div>
      )}

      {/* CASE 1b: Bug 2 fix - No fragile edges but low robustness/stability */}
      {showLowRobustnessWarning && !showTierWarning && (
        <div className="p-4 bg-warning-50 border border-warning-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">⚠</span>
            <span className="text-sm font-semibold text-warning-800">
              Low confidence
            </span>
          </div>
          <p className="text-sm text-warning-700">
            No fragile edges, but overall confidence is low. Consider strengthening key assumptions.
          </p>
        </div>
      )}

      {/* CASE 2: Tier warning - show for fair/needs_work (NOT for strong) */}
      {showTierWarning && (
        <div className={`p-4 rounded-lg border ${config.bgColor} ${config.borderColor}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{config.icon}</span>
            <span className={`text-sm font-semibold ${config.textColor}`}>
              {config.label}
            </span>
          </div>
          <p className={`text-sm ${config.textColor}`}>
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
            <p className="text-sm text-success-800">
              Good foundation — a few items to consider below
            </p>
          </div>
        </div>
      )}

      {/* Evidence coverage */}
      {evidenceCoverage && (
        <div className="p-3 bg-info-50 border border-info-200 rounded-lg">
          <p className="text-sm text-info-800">
            <span className="font-medium">Model evidence:</span>{' '}
            {evidenceCoverage.backedByData} assumptions backed by data,{' '}
            {evidenceCoverage.needsValidation} need validation
          </p>
        </div>
      )}

      {/* Uncertainties */}
      {showUncertainties && (
        <div className="space-y-2">
          <h4 className="text-xs text-slate-500 uppercase tracking-wide">
            Uncertainties
          </h4>
          {uncertainties.length === 0 ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-sm text-slate-600 flex items-start gap-2">
                <span aria-hidden="true">ℹ️</span>
                {/* Bug 4 fix: Different message based on robustness status */}
                {robustnessStatus !== 'computed'
                  ? EMPTY_STATES.robustness
                  : filteredFragileEdges && filteredFragileEdges.filteredCount > 0
                    ? `No high-sensitivity assumptions found. ${filteredFragileEdges.filteredCount} assumption${filteredFragileEdges.filteredCount === 1 ? '' : 's'} changed the best option in <${Math.round(filteredFragileEdges.threshold * 100)}% of scenarios.`
                    : 'No sensitive assumptions identified at the current threshold.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayUncertainties.map((item, index) => (
                <UncertaintyRow
                  key={`${item.code}-${index}`}
                  item={item}
                  onFocus={onFocusNode}
                />
              ))}
            </div>
          )}

          {hiddenUncertaintyCount > 0 && (
            <button
              onClick={() => setShowAllUncertainties(!showAllUncertainties)}
              className="text-xs text-sky-600 hover:text-sky-700"
            >
              {showAllUncertainties ? 'Show fewer' : `+${hiddenUncertaintyCount} more items`}
            </button>
          )}

          {/* Filtered items disclosure */}
          {filteredFragileEdges && filteredFragileEdges.filteredCount > 0 && (
            <p className="text-xs text-slate-400 mt-2">
              {filteredFragileEdges.description}
            </p>
          )}
        </div>
      )}

      {/* Improvements */}
      <div className="space-y-2">
        <h4 className="text-xs text-slate-500 uppercase tracking-wide">
          Improvements
        </h4>
        {improvements.length === 0 ? (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-sm text-slate-600 flex items-start gap-2">
              <span aria-hidden="true">ℹ️</span>
              {/* Show different message when analysis completed with no improvements */}
              {analysisStatus === 'computed' || analysisStatus === 'partial'
                ? 'No improvements identified — your model structure is sound.'
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
            className="text-xs text-sky-600 hover:text-sky-700"
          >
            {showAllImprovements ? 'Show fewer' : `+${hiddenImprovementCount} more items`}
          </button>
        )}
      </div>
    </div>
  )
}

export default ConfidenceSection
