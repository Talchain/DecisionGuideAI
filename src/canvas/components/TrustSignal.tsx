/**
 * TrustSignal - Model Quality assessment
 *
 * Shows plain-language assessment of MODEL quality (structure, evidence, balance).
 * This is DISTINCT from prediction confidence - which is shown in DecisionSummary.
 *
 * Three tiers: Good, Fair, Needs Work
 * - Plain language messages instead of percentages
 * - Basis for assessment (structure, completeness, evidence coverage)
 *
 * Features:
 * - Clear model quality statement
 * - Actionable guidance per tier
 * - Source attribution (analysis vs local)
 *
 * Note: Prediction confidence is shown once in DecisionSummary.
 * TrustSignal focuses on model construction quality.
 */

import { useState, useMemo } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Shield,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import {
  type QualityTier,
  getQualityTier,
  tierConfig as baseTierConfig,
  normalizeToPercent,
} from '../utils/qualityTiers'
import {
  IdentifiabilityBadge,
  normalizeIdentifiabilityTag,
  isIdentifiabilityWarning,
  type IdentifiabilityStatus,
} from './IdentifiabilityBadge'

interface TrustSignalProps {
  /** Start expanded */
  defaultExpanded?: boolean
}

// Extend base tier config with icons for TrustSignal
const tierConfig = {
  good: { ...baseTierConfig.good, icon: ShieldCheck },
  fair: { ...baseTierConfig.fair, icon: Shield },
  poor: { ...baseTierConfig.poor, icon: ShieldAlert },
} as const

export function TrustSignal({ defaultExpanded = false }: TrustSignalProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const results = useCanvasStore((s) => s.results)
  const graphHealth = useCanvasStore((s) => s.graphHealth)
  const report = results?.report

  // Task 3.2: Extract identifiability status from model_card
  const identifiability = useMemo((): IdentifiabilityStatus | null => {
    const modelCard = report?.model_card as { identifiability_tag?: string } | undefined
    if (!modelCard?.identifiability_tag) return null
    return normalizeIdentifiabilityTag(modelCard.identifiability_tag)
  }, [report])

  // Extract quality metrics
  const metrics = useMemo(() => {
    const graphQuality = report?.graph_quality

    // If we have backend graph_quality, use that
    // Note: Backend returns 0-1 scale, we normalize to 0-100 for tier calculation
    if (graphQuality) {
      return {
        score: normalizeToPercent(graphQuality.score) ?? 0,
        completeness: normalizeToPercent(graphQuality.completeness),
        evidenceCoverage: normalizeToPercent(graphQuality.evidence_coverage),
        balance: normalizeToPercent(graphQuality.balance),
        issuesCount: graphQuality.issues_count ?? 0,
        recommendation: graphQuality.recommendation,
        source: 'analysis' as const,
      }
    }

    // Fallback to local graph health if available (already 0-100)
    if (graphHealth) {
      return {
        score: graphHealth.score,
        completeness: null,
        evidenceCoverage: null,
        balance: null,
        issuesCount: graphHealth.issues?.length ?? 0,
        recommendation: null,
        source: 'local' as const,
      }
    }

    return null
  }, [report, graphHealth])

  // Empty state
  if (!metrics) {
    return (
      <div className="p-4 bg-sand-50 border border-sand-200 rounded-xl">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-sand-400 flex-shrink-0" />
          <div>
            <p className={`${typography.body} text-sand-600`}>No quality data</p>
            <p className={`${typography.caption} text-sand-500`}>Run analysis to see model quality assessment</p>
          </div>
        </div>
      </div>
    )
  }

  const tier = getQualityTier(metrics.score)
  const config = tierConfig[tier]
  const TierIcon = config.icon

  return (
    <div className="bg-paper-50 border border-sand-200 rounded-xl overflow-hidden" data-testid="trust-signal">
      {/* Header - always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-sand-50 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-ink-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-ink-500" />
          )}
          <span className={`${typography.body} font-medium text-ink-800`}>Model Quality</span>
        </div>

        {/* Tier badge - no percentages */}
        <div className="flex items-center gap-2">
          <TierIcon className={`h-4 w-4 ${config.iconColor}`} aria-hidden="true" />
          <span className={`${typography.caption} px-2 py-0.5 rounded-full font-medium ${config.bgColor} ${config.textColor}`}>
            {config.label}
          </span>
        </div>
      </button>

      {/* Expanded content - plain language */}
      {isExpanded && (
        <div className="border-t border-sand-200 px-4 py-4 space-y-4">
          {/* Main message */}
          <div className={`p-3 rounded-lg ${config.bgColor} border ${config.borderColor}`}>
            <div className="flex items-start gap-3">
              <TierIcon className={`h-5 w-5 ${config.iconColor} flex-shrink-0 mt-0.5`} aria-hidden="true" />
              <div>
                <p className={`${typography.body} font-medium ${config.textColor}`}>
                  {config.message}
                </p>
                <p className={`${typography.caption} ${config.textColor} opacity-80 mt-1`}>
                  {config.guidance}
                </p>
              </div>
            </div>
          </div>

          {/* Task 3.2: Identifiability Status - Task 6: Hide 'unknown' status post-analysis */}
          {identifiability && identifiability !== 'unknown' && (
            <div
              className="space-y-2"
              data-testid="identifiability-section"
            >
              <p className={`${typography.caption} font-medium text-ink-600 uppercase tracking-wide`}>
                Causal Analysis
              </p>
              <IdentifiabilityBadge
                status={identifiability}
                showExplanation={isIdentifiabilityWarning(identifiability)}
              />
            </div>
          )}

          {/* Basis for assessment */}
          <div className="space-y-2">
            <p className={`${typography.caption} font-medium text-ink-600 uppercase tracking-wide`}>
              Based on
            </p>
            <div className="grid grid-cols-1 gap-2">
              {/* Completeness indicator */}
              {metrics.completeness !== null && (
                <AssessmentFactor
                  label="Graph completeness"
                  status={metrics.completeness >= 70 ? 'good' : metrics.completeness >= 40 ? 'fair' : 'poor'}
                />
              )}

              {/* Evidence coverage indicator */}
              {metrics.evidenceCoverage !== null && (
                <AssessmentFactor
                  label="Evidence coverage"
                  status={metrics.evidenceCoverage >= 70 ? 'good' : metrics.evidenceCoverage >= 40 ? 'fair' : 'poor'}
                />
              )}

              {/* Balance indicator */}
              {metrics.balance !== null && (
                <AssessmentFactor
                  label="Factor balance"
                  status={metrics.balance >= 70 ? 'good' : metrics.balance >= 40 ? 'fair' : 'poor'}
                />
              )}

              {/* Fallback when no detailed metrics */}
              {metrics.source === 'local' && (
                <AssessmentFactor
                  label="Local graph structure"
                  status={tier}
                />
              )}
            </div>
          </div>

          {/* Issues count - Task 7: Only show when quality is not Good (avoid mixed messages) */}
          {metrics.issuesCount > 0 && tier !== 'good' && (
            <div className="flex items-center gap-2 pt-2 border-t border-sand-100">
              <AlertTriangle className="h-4 w-4 text-carrot-500" />
              <span className={`${typography.caption} text-carrot-600`}>
                {metrics.issuesCount} issue{metrics.issuesCount !== 1 ? 's' : ''} to address
              </span>
            </div>
          )}

          {/* Backend recommendation - Task 7: Only show when quality is not Good to avoid
              contradicting "Model Quality: Good" with "Consider adding more..." suggestions */}
          {metrics.recommendation && tier !== 'good' && (
            <p className={`${typography.caption} text-ink-500 pt-2 border-t border-sand-100`}>
              {metrics.recommendation}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// Plain language explanations for each quality factor
const PLAIN_LANGUAGE: Record<string, Record<QualityTier, string>> = {
  'Graph completeness': {
    good: "You've described a comprehensive model",
    fair: "You've included the main factors",
    poor: "Consider adding more relevant factors",
  },
  'Evidence coverage': {
    good: "Your estimates are well-documented",
    fair: "You've estimated the key uncertainties",
    poor: "Some factors lack estimates",
  },
  'Factor balance': {
    good: "Good mix of positive and negative factors",
    fair: "Consider both risks and opportunities",
    poor: "Model may be missing key perspectives",
  },
  'Local graph structure': {
    good: "Well-structured decision model",
    fair: "Reasonable model structure",
    poor: "Model structure needs improvement",
  },
}

// Assessment factor indicator - shows status without percentages
interface AssessmentFactorProps {
  label: string
  status: QualityTier
}

function AssessmentFactor({ label, status }: AssessmentFactorProps) {
  const statusConfig = {
    good: { icon: CheckCircle2, color: 'text-mint-600', bg: 'bg-mint-100', text: 'Strong' },
    fair: { icon: Shield, color: 'text-banana-600', bg: 'bg-banana-100', text: 'Adequate' },
    poor: { icon: AlertTriangle, color: 'text-carrot-600', bg: 'bg-carrot-100', text: 'Weak' },
  }

  const conf = statusConfig[status]
  const Icon = conf.icon
  const plainLanguage = PLAIN_LANGUAGE[label]?.[status]

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex-1 min-w-0">
        <span className={`${typography.caption} text-ink-600 block`}>{label}</span>
        {plainLanguage && (
          <span className={`${typography.caption} text-ink-500 block truncate`}>{plainLanguage}</span>
        )}
      </div>
      <div className={`flex items-center gap-1 px-2 py-0.5 rounded flex-shrink-0 ${conf.bg}`}>
        <Icon className={`h-3 w-3 ${conf.color}`} aria-hidden="true" />
        <span className={`${typography.caption} font-medium ${conf.color}`}>{conf.text}</span>
      </div>
    </div>
  )
}
