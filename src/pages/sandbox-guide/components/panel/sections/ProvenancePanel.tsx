/**
 * Provenance Panel
 *
 * Shows evidence coverage and data sources for the model.
 * Answers: "Is my model based on data or assumptions?"
 *
 * Displays:
 * - Evidence coverage (edges with provenance / total edges)
 * - Progress bar visualization
 * - List of data sources
 * - Warning when no external evidence exists
 */

import { FileText, AlertTriangle } from 'lucide-react'
import { useState } from 'react'

interface ProvenancePanelProps {
  provenance?: {
    sources: string[]
    source_count: number
    edges_with_provenance: number
    edges_total: number
  }
}

export function ProvenancePanel({ provenance }: ProvenancePanelProps): JSX.Element | null {
  const [expanded, setExpanded] = useState(false)

  if (!provenance) return null

  const coverage =
    provenance.edges_total > 0
      ? (provenance.edges_with_provenance / provenance.edges_total) * 100
      : 0

  const isLowCoverage = coverage < 50

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

          {/* Sources list */}
          {provenance.source_count > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-storm-700">Sources:</p>
              <ul className="space-y-1">
                {provenance.sources.slice(0, 5).map((source, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-storm-600 flex items-start gap-1"
                  >
                    <span className="text-analytical-500 mt-0.5" aria-hidden="true">
                      •
                    </span>
                    <span>{source}</span>
                  </li>
                ))}
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
