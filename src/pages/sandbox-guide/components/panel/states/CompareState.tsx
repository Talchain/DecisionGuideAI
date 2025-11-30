/**
 * Compare State
 *
 * Shown when the user is in compare mode.
 * Displays comparison between scenarios (placeholder for now - full implementation in later phase).
 */

import { useCopilotStore } from '../../../hooks/useCopilotStore'
import { Button } from '../../shared/Button'
import { Card } from '../../shared/Card'

export function CompareState(): JSX.Element {
  const setCompareMode = useCopilotStore((state) => state.setCompareMode)

  const handleExitCompare = () => {
    setCompareMode(false)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚖️</span>
          <h2 className="text-xl font-semibold text-charcoal-900">Compare Scenarios</h2>
        </div>
        <button
          onClick={handleExitCompare}
          className="text-storm-600 hover:text-charcoal-900 transition-colors"
          aria-label="Exit compare mode"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Placeholder content */}
      <Card className="bg-analytical-50 border-analytical-200">
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🚧</div>
          <div className="font-medium text-charcoal-900 mb-2">Compare Mode Coming Soon</div>
          <div className="text-sm text-storm-700 mb-4">
            Side-by-side scenario comparison will be available in a future update.
          </div>
        </div>
      </Card>

      {/* What it will do */}
      <div>
        <div className="text-sm font-medium text-charcoal-900 mb-3">Planned Features:</div>
        <div className="space-y-2">
          <FeatureItem text="Compare outcomes across different scenarios" />
          <FeatureItem text="See which factors drive the differences" />
          <FeatureItem text="Identify the biggest points of leverage" />
          <FeatureItem text="Understand trade-offs between options" />
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <Button variant="outline" fullWidth onClick={handleExitCompare}>
          Exit compare mode
        </Button>
      </div>

      {/* Tip */}
      <div className="p-3 bg-mist-100 rounded-lg border border-storm-200">
        <div className="text-xs font-medium text-storm-800 mb-1">💡 Tip</div>
        <div className="text-xs text-storm-700">
          For now, you can create snapshots of different scenarios and review them individually to
          understand the impact of your changes.
        </div>
      </div>
    </div>
  )
}

function FeatureItem({ text }: { text: string }): JSX.Element {
  return (
    <div className="flex items-start gap-2">
      <svg className="w-4 h-4 text-analytical-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      <span className="text-sm text-storm-700">{text}</span>
    </div>
  )
}
