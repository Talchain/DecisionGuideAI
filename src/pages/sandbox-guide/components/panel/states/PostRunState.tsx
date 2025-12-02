/**
 * Post-Run State - Analysis Results Display
 *
 * Shows rich insights from PLoT and CEE after analysis completes.
 * This is the most critical state - where Olumi proves its value.
 *
 * CRITICAL RULES:
 * - Never show contradictory signals (blocker + positive outcome)
 * - Always use node labels, never IDs
 * - Always provide context for numbers (baseline comparison)
 * - Make everything actionable with specific buttons
 * - Progressive disclosure (max 7 items before expand)
 */

import { useResultsStore } from '@/canvas/stores/resultsStore'
import { Badge } from '../../shared/Badge'
import { Button } from '../../shared/Button'
import { ExpandableSection } from '../../shared/ExpandableSection'
import { MetricRow } from '../../shared/MetricRow'
import { TopDriversSection } from '../sections/TopDriversSection'
import { RisksSection } from '../sections/RisksSection'
import { AdvancedMetricsSection } from '../sections/AdvancedMetricsSection'
import { VerificationBadge } from '../sections/VerificationBadge'
import { ProvenancePanel } from '../sections/ProvenancePanel'
import { SeverityStyledCritiques } from '../sections/SeverityStyledCritiques'
import { BiasMitigation } from '../sections/BiasMitigation'

export function PostRunState(): JSX.Element {
  const report = useResultsStore((state) => state.results.report)
  const ceeReview = useResultsStore((state) => state.runMeta.ceeReview)

  // Safety: Should not happen, but guard against empty results
  if (!report) {
    return (
      <div className="p-6">
        <div className="text-storm-700 text-sm">No results available</div>
      </div>
    )
  }

  // CRITICAL: Never show positive outcome if there are blockers
  const blockers = report.decision_readiness?.blockers || []
  if (blockers.length > 0) {
    return (
      <div className="p-6 space-y-6 font-sans">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <h2 className="text-xl font-semibold text-charcoal-900">Analysis Incomplete</h2>
        </div>
        <div className="space-y-2">
          {blockers.map((blocker, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm">
              <span className="text-creative-600">•</span>
              <span className="text-storm-700">{blocker}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Destructure with safe defaults
  const {
    results,
    confidence,
    insights,
    drivers = [],
    critique,
    graph_quality,
  } = report

  // Validate required data
  if (!results || typeof results.likely !== 'number') {
    return (
      <div className="p-6">
        <div className="text-storm-700 text-sm">Analysis results are incomplete or malformed</div>
      </div>
    )
  }

  // Use CEE headline if available, fall back to PLoT summary
  const headline = ceeReview?.story?.headline || insights?.summary

  // Get confidence badge variant
  const getConfidenceVariant = (level: string) => {
    switch (level) {
      case 'high':
        return 'success'
      case 'medium':
        return 'warning'
      case 'low':
        return 'error'
      default:
        return 'neutral'
    }
  }

  // Extract verification and provenance data from ceeReview/report (will be undefined until backend provides it)
  const verification = (ceeReview as any)?.trace?.verification
  const provenance = (report as any)?.model_card?.provenance_summary
  const ceeCritiques = (ceeReview as any)?.critique
  const biasFindings = (ceeReview as any)?.bias?.findings

  return (
    <div className="divide-y divide-storm-100">
      {/* Header */}
      <div className="p-6 bg-practical-50 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <h2 className="text-xl font-semibold text-charcoal-900">Analysis Complete</h2>
          </div>
          <VerificationBadge verification={verification} />
        </div>
        <ProvenancePanel provenance={provenance} />
      </div>

      {/* TIER 1: Always Visible - Key Insight */}
      {headline && (
        <div className="p-6 bg-white">
          <div className="mb-4">
            <div className="text-xs uppercase tracking-wide text-storm-500 mb-2">Key Insight</div>
            <p className="text-lg text-charcoal-900 leading-relaxed">{headline}</p>
          </div>
        </div>
      )}

      {/* Expected Outcome with Context */}
      <div className="p-6 bg-white">
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-storm-500">Expected Outcome</div>

          <div className="flex items-baseline gap-3">
            <div className="text-4xl font-bold text-charcoal-900">
              {results.units === 'percent' || !results.units
                ? `${Math.round(results.likely * 100)}%`
                : results.unitSymbol
                  ? `${results.unitSymbol}${results.likely.toLocaleString()}`
                  : results.likely.toLocaleString()}
            </div>
          </div>

          {/* Range Visualization */}
          <div className="mt-4">
            <div className="text-xs text-storm-600 mb-2">Range of possibilities:</div>
            <div className="relative h-2 bg-storm-100 rounded-full overflow-hidden">
              <div
                className="absolute h-full bg-gradient-to-r from-creative-300 via-analytical-400 to-practical-400"
                style={{
                  left: `${
                    results.units === 'percent' || !results.units
                      ? results.conservative * 100
                      : 0
                  }%`,
                  right: `${
                    results.units === 'percent' || !results.units
                      ? 100 - results.optimistic * 100
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-storm-600 mt-1">
              <span>
                Conservative:{' '}
                {results.units === 'percent' || !results.units
                  ? `${Math.round(results.conservative * 100)}%`
                  : results.unitSymbol
                    ? `${results.unitSymbol}${results.conservative.toLocaleString()}`
                    : results.conservative.toLocaleString()}
              </span>
              <span>
                Optimistic:{' '}
                {results.units === 'percent' || !results.units
                  ? `${Math.round(results.optimistic * 100)}%`
                  : results.unitSymbol
                    ? `${results.unitSymbol}${results.optimistic.toLocaleString()}`
                    : results.optimistic.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Confidence */}
      <div className="p-6 bg-white">
        <ExpandableSection
          title={
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-storm-500">Confidence</span>
              <Badge variant={getConfidenceVariant(confidence.level)}>{confidence.level}</Badge>
            </div>
          }
          defaultOpen={confidence.level === 'low'}
        >
          <div className="mt-3 space-y-2 text-sm">
            <p className="text-storm-700">{confidence.why}</p>
            {graph_quality && (
              <div className="mt-3">
                <MetricRow
                  label="Graph Quality"
                  value={`${Math.round(graph_quality.score * 100)}%`}
                />
                <MetricRow
                  label="Evidence Coverage"
                  value={`${Math.round(graph_quality.evidence_coverage * 100)}%`}
                />
              </div>
            )}
          </div>
        </ExpandableSection>
      </div>

      {/* TIER 2: Top Drivers */}
      {drivers && drivers.length > 0 && <TopDriversSection drivers={drivers} limit={3} />}

      {/* Issues & Recommendations - Use CEE critiques if available, otherwise show risks */}
      {ceeCritiques && ceeCritiques.length > 0 ? (
        <SeverityStyledCritiques critiques={ceeCritiques} />
      ) : (
        insights?.risks && insights.risks.length > 0 && (
          <RisksSection risks={insights.risks} limit={3} />
        )
      )}

      {/* Bias Mitigation - Show AI-suggested fixes for structural problems */}
      {biasFindings && biasFindings.length > 0 && (
        <BiasMitigation findings={biasFindings} />
      )}

      {/* Next Steps (from CEE or PLoT) */}
      {(ceeReview?.story?.next_actions || insights?.next_steps) && (
        <div className="p-6">
          <div className="text-sm font-medium text-charcoal-900 mb-3">✅ Recommended Next Steps</div>
          <div className="space-y-2">
            {(ceeReview?.story?.next_actions || insights?.next_steps || []).map((action, idx) => {
              const actionText = typeof action === 'string' ? action : action.label
              const actionWhy = typeof action === 'object' ? action.why : undefined
              return (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <span className="text-analytical-600 mt-0.5">→</span>
                  <div className="flex-1">
                    <span className="text-storm-700">{actionText}</span>
                    {actionWhy && <div className="text-xs text-storm-600 mt-1">{actionWhy}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TIER 3: Advanced Details (Collapsed) */}
      <AdvancedMetricsSection graphQuality={graph_quality} critique={critique} />

      {/* Primary Actions */}
      <div className="p-6 space-y-2">
        <Button variant="outline" fullWidth>
          Compare scenarios
        </Button>
        <Button variant="outline" fullWidth>
          Add evidence
        </Button>
        <Button variant="primary" fullWidth>
          Improve confidence
        </Button>
      </div>
    </div>
  )
}
