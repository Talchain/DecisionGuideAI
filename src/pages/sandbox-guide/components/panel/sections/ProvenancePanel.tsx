/**
 * Provenance Panel
 *
 * Shows evidence coverage and data sources for the model.
 * Answers: "Is my model based on data or assumptions?"
 *
 * Displays:
 * - Evidence coverage (edges with provenance / total edges)
 * - Evidence freshness quality indicators
 * - Progress bar visualization
 * - List of data sources with quality badges
 * - Warning when no external evidence exists
 */

import { FileText, AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import type { EvidenceFreshness } from '../../../../../types/plot'
import { EvidenceQualityBadge } from '../../shared/EvidenceQualityBadge'
import { useCanvasStore } from '../../../../../canvas/store'

interface ProvenancePanelProps {
  provenance?: {
    sources: string[]
    source_count: number
    edges_with_provenance: number
    edges_total: number
  }
  evidenceFreshness?: EvidenceFreshness
}

export function ProvenancePanel({ provenance, evidenceFreshness }: ProvenancePanelProps): JSX.Element | null {
  const [expanded, setExpanded] = useState(false)
  const edges = useCanvasStore((state) => state.edges)

  if (!provenance) return null

  const coverage =
    provenance.edges_total > 0
      ? (provenance.edges_with_provenance / provenance.edges_total) * 100
      : 0

  const isLowCoverage = coverage < 50

  // Create lookup map for edge freshness
  const edgeFreshnessMap = new Map(
    evidenceFreshness?.edge_freshness.map((ef) => [ef.edge_id, ef]) || []
  )

  return (
    <div className="border border-storm-200 rounded-lg overflow-hidden font-sans">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-storm-50 transition"
        aria-expanded={expanded}
        aria-label="Evidence coverage details"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-storm-600" aria-hidden="true" />
          <span className="text-sm font-medium text-storm-900">Evidence Coverage</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium ${
              isLowCoverage ? 'text-amber-600' : 'text-green-600'
            }`}
          >
            {provenance.edges_with_provenance}/{provenance.edges_total} edges
          </span>
          <span className="text-storm-400" aria-hidden="true">
            {expanded ? '▼' : '▶'}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 bg-storm-25" role="region" aria-label="Evidence coverage details">
          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-storm-600">
              <span>Coverage</span>
              <span>{Math.round(coverage)}%</span>
            </div>
            <div className="h-2 bg-storm-200 rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round(coverage)} aria-valuemin={0} aria-valuemax={100}>
              <div
                className={`h-full transition-all ${
                  isLowCoverage ? 'bg-amber-500' : 'bg-green-500'
                }`}
                style={{ width: `${coverage}%` }}
              />
            </div>
          </div>

          {/* Evidence Freshness Summary */}
          {evidenceFreshness && (
            <div className="space-y-2 p-3 bg-white border border-storm-200 rounded">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-storm-700">Data Quality:</p>
                <EvidenceQualityBadge quality={evidenceFreshness.overall_quality} />
              </div>
              {(evidenceFreshness.stale_count > 0 || evidenceFreshness.aging_count > 0) && (
                <div className="text-xs text-storm-600 space-y-1">
                  {evidenceFreshness.fresh_count > 0 && (
                    <div className="flex items-center gap-2">
                      <EvidenceQualityBadge quality="FRESH" showLabel={false} />
                      <span>{evidenceFreshness.fresh_count} fresh</span>
                    </div>
                  )}
                  {evidenceFreshness.aging_count > 0 && (
                    <div className="flex items-center gap-2">
                      <EvidenceQualityBadge quality="AGING" showLabel={false} />
                      <span>{evidenceFreshness.aging_count} aging</span>
                    </div>
                  )}
                  {evidenceFreshness.stale_count > 0 && (
                    <div className="flex items-center gap-2">
                      <EvidenceQualityBadge quality="STALE" showLabel={false} />
                      <span>{evidenceFreshness.stale_count} stale</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Sources list */}
          {provenance.source_count > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-storm-700">Sources:</p>
              <ul className="space-y-1">
                {provenance.sources.slice(0, 5).map((source, idx) => {
                  // Try to find matching edge for this source
                  const matchingEdge = edges.find((e) => e.data?.provenance === source)
                  const freshness = matchingEdge ? edgeFreshnessMap.get(matchingEdge.id) : undefined

                  return (
                    <li
                      key={idx}
                      className="text-xs text-storm-600 flex items-start gap-2"
                    >
                      <span className="text-analytical-500 mt-0.5" aria-hidden="true">
                        •
                      </span>
                      <span className="flex-1">{source}</span>
                      {freshness && (
                        <EvidenceQualityBadge
                          quality={freshness.quality}
                          ageDays={freshness.age_days}
                          showLabel={false}
                        />
                      )}
                    </li>
                  )
                })}
                {provenance.sources.length > 5 && (
                  <li className="text-xs text-analytical-600 pl-3">
                    +{provenance.sources.length - 5} more
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded">
              <AlertTriangle
                className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <p className="text-xs font-medium text-amber-900">
                  No external evidence
                </p>
                <p className="text-xs text-amber-700">
                  Model based on assumptions only. Consider gathering supporting data.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
