import { memo } from 'react'
import type { ReportV1 } from '../../../adapters/plot'

interface SummaryCardProps {
  report: ReportV1
  onCopyHash?: () => void
}

const formatNumber = (value: number, units?: string, unitSymbol?: string): string => {
  if (units === 'currency' && unitSymbol) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: unitSymbol === '$' ? 'USD' : 'GBP'
    }).format(value)
  }
  if (units === 'percent' || unitSymbol === '%') {
    return `${value}%`
  }
  return value.toString()
}

export const SummaryCard = memo<SummaryCardProps>(({ report, onCopyHash }) => {
  const { results, confidence, model_card } = report
  const hasHash = model_card?.response_hash

  return (
    <div className="bg-white border rounded-lg p-6 mb-6" data-testid="summary-card">
      <div className="text-center mb-4">
        <div className="text-3xl font-bold text-gray-900 mb-2" data-testid="summary-likely">
          {formatNumber(results.likely, results.units, results.unitSymbol)}
        </div>
        <div className="text-sm text-gray-600 mb-3">
          Most likely outcome based on your current plan
        </div>
        <div className="flex justify-center gap-4 text-sm">
          <span className="text-gray-600" data-testid="summary-conservative">
            Conservative: {formatNumber(results.conservative, results.units, results.unitSymbol)}
          </span>
          <span className="text-gray-600" data-testid="summary-optimistic">
            Optimistic: {formatNumber(results.optimistic, results.units, results.unitSymbol)}
          </span>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Conservative assumes headwinds; optimistic assumes tailwinds
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <div 
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            confidence.level === 'high' ? 'bg-green-100 text-green-800' :
            confidence.level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}
          data-testid="confidence-badge"
          title={`Why: ${confidence.why}`}
        >
          {confidence.level.charAt(0).toUpperCase() + confidence.level.slice(1)} Confidence
        </div>

        {hasHash && (
          <button
            onClick={onCopyHash}
            className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            data-testid="hash-pill"
            aria-label="Copy verification hash"
          >
            Verified
          </button>
        )}
      </div>
    </div>
  )
})

SummaryCard.displayName = 'SummaryCard'
