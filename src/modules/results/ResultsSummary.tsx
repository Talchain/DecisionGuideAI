// src/modules/results/ResultsSummary.tsx
import { useMemo } from 'react'
import type { ReportV1 } from './types'
import { ConfidenceBadge } from './ConfidenceBadge'

interface ResultsSummaryProps {
  report: ReportV1
}

export function ResultsSummary({ report }: ResultsSummaryProps) {
  const { p10, p50, p90 } = report.summary.bands
  
  const formatted = useMemo(() => ({
    p10: (p10 * 100).toFixed(1),
    p50: (p50 * 100).toFixed(1),
    p90: (p90 * 100).toFixed(1)
  }), [p10, p50, p90])

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Results Summary</h3>
        <ConfidenceBadge confidence={report.confidence} />
      </div>

      <div className="space-y-3">
        {/* Conservative (p10) */}
        <div className="flex items-center gap-3">
          <div className="w-24 text-sm font-medium text-gray-700">Conservative</div>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-amber-400 transition-all duration-300"
              style={{ width: `${p10 * 100}%` }}
              role="progressbar"
              aria-valuenow={p10 * 100}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <div className="w-16 text-sm font-semibold text-gray-900 text-right">{formatted.p10}%</div>
        </div>

        {/* Likely (p50) */}
        <div className="flex items-center gap-3">
          <div className="w-24 text-sm font-medium text-gray-700">Likely</div>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${p50 * 100}%` }}
              role="progressbar"
              aria-valuenow={p50 * 100}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <div className="w-16 text-sm font-semibold text-gray-900 text-right">{formatted.p50}%</div>
        </div>

        {/* Optimistic (p90) */}
        <div className="flex items-center gap-3">
          <div className="w-24 text-sm font-medium text-gray-700">Optimistic</div>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${p90 * 100}%` }}
              role="progressbar"
              aria-valuenow={p90 * 100}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <div className="w-16 text-sm font-semibold text-gray-900 text-right">{formatted.p90}%</div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500 space-y-1">
        <div>Seed: {report.meta.seed}</div>
        {report.meta.trace_id && <div>Run ID: {report.meta.trace_id}</div>}
      </div>
    </div>
  )
}
