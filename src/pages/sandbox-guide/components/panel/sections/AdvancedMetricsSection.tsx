/**
 * AdvancedMetricsSection - Shows graph quality and advanced metrics
 *
 * Collapsed by default for progressive disclosure
 */

import type { ReportV1 } from '@/adapters/plot/types'
import { ExpandableSection } from '../../shared/ExpandableSection'
import { MetricRow } from '../../shared/MetricRow'

export interface AdvancedMetricsSectionProps {
  graphQuality?: ReportV1['graph_quality']
  critique?: string[]
}

export function AdvancedMetricsSection({
  graphQuality,
  critique,
}: AdvancedMetricsSectionProps): JSX.Element {
  if (!graphQuality && (!critique || critique.length === 0)) {
    return <></>
  }

  return (
    <div className="font-sans border-t border-storm-100">
      <ExpandableSection
        title={
          <span className="text-sm font-semibold text-charcoal-900">🔬 Advanced Metrics</span>
        }
        defaultOpen={false}
      >
        <div className="font-sans space-y-4">
          {graphQuality && (
            <div>
              <div className="font-sans text-xs font-medium text-storm-600 mb-2">Graph Quality</div>
              <div className="font-sans space-y-1">
                <MetricRow
                  label="Overall Score"
                  value={`${Math.round(graphQuality.score * 100)}%`}
                />
                <MetricRow
                  label="Completeness"
                  value={`${Math.round(graphQuality.completeness * 100)}%`}
                />
                <MetricRow
                  label="Evidence Coverage"
                  value={`${Math.round(graphQuality.evidence_coverage * 100)}%`}
                />
                <MetricRow
                  label="Balance"
                  value={`${Math.round(graphQuality.balance * 100)}%`}
                />
              </div>
              {graphQuality.recommendation && (
                <div className="font-sans mt-3 p-3 bg-analytical-50 rounded-lg border border-analytical-200">
                  <div className="font-sans text-xs font-medium text-analytical-800 mb-1">
                    Recommendation
                  </div>
                  <div className="font-sans text-xs text-charcoal-900">{graphQuality.recommendation}</div>
                </div>
              )}
            </div>
          )}

          {critique && critique.length > 0 && (
            <div>
              <div className="font-sans text-xs font-medium text-storm-600 mb-2">
                Observations ({critique.length})
              </div>
              <div className="font-sans space-y-2">
                {critique.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-2 rounded bg-storm-50 text-xs text-charcoal-900"
                  >
                    <span className="text-storm-600 mt-0.5">•</span>
                    <span className="flex-1">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ExpandableSection>
    </div>
  )
}
