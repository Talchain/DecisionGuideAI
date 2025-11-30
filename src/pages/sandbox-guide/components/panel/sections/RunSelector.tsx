/**
 * Run Selector Component
 *
 * Allows users to select two runs from history for comparison.
 * Shows run labels, timestamps, and outcome values.
 */

import { Button } from '../../shared/Button'

export interface Run {
  id: string
  label?: string
  timestamp: number
  outcome: number
  confidence?: {
    level: string
  }
}

export interface RunSelectorProps {
  selectedRuns: [string?, string?]
  runHistory: Run[]
  onSelect: (baselineId: string, currentId: string) => void
  onCancel: () => void
}

export function RunSelector({
  selectedRuns,
  runHistory,
  onSelect,
  onCancel,
}: RunSelectorProps): JSX.Element {
  const [baseline, current] = selectedRuns

  const handleBaselineChange = (value: string) => {
    if (current && value) {
      onSelect(value, current)
    }
  }

  const handleCurrentChange = (value: string) => {
    if (baseline && value) {
      onSelect(baseline, value)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="baseline-select"
          className="text-sm font-medium text-charcoal-900 block mb-2"
        >
          Baseline (before)
        </label>
        <select
          id="baseline-select"
          value={baseline || ''}
          onChange={(e) => handleBaselineChange(e.target.value)}
          className="w-full px-3 py-2 border border-storm-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-analytical-500 focus:border-transparent"
        >
          <option value="">Select baseline...</option>
          {runHistory.map((run) => (
            <option key={run.id} value={run.id} disabled={run.id === current}>
              {run.label || `Run ${new Date(run.timestamp).toLocaleDateString()}`} -{' '}
              {run.outcome.toFixed(1)}%
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="current-select"
          className="text-sm font-medium text-charcoal-900 block mb-2"
        >
          Current (after)
        </label>
        <select
          id="current-select"
          value={current || ''}
          onChange={(e) => handleCurrentChange(e.target.value)}
          className="w-full px-3 py-2 border border-storm-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-analytical-500 focus:border-transparent"
        >
          <option value="">Select current...</option>
          {runHistory.map((run) => (
            <option key={run.id} value={run.id} disabled={run.id === baseline}>
              {run.label || `Run ${new Date(run.timestamp).toLocaleDateString()}`} -{' '}
              {run.outcome.toFixed(1)}%
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <Button
          variant="primary"
          fullWidth
          disabled={!baseline || !current}
          onClick={() => baseline && current && onSelect(baseline, current)}
        >
          Compare
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
