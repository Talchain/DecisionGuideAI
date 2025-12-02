/**
 * Compare State - Full Implementation
 *
 * Complete scenario comparison showing:
 * - Run selection UI
 * - Delta calculation and display
 * - Top 3 change drivers from explain_delta
 * - Structural differences
 * - AI recommendations
 * - Actions: Revert, view in graph, restore baseline, save scenario
 */

import { useState } from 'react'
import { useGuideStore } from '../../../hooks/useGuideStore'
import { Button } from '../../shared/Button'
import { MetricRow } from '../../shared/MetricRow'
import { ExpandableSection } from '../../shared/ExpandableSection'
import { RunSelector, type Run } from '../sections/RunSelector'

// Mock run history - in real implementation, this would come from a store
const mockRunHistory: Run[] = [
  {
    id: 'run-1',
    label: 'Baseline scenario',
    timestamp: Date.now() - 86400000 * 2,
    outcome: 15.5,
    confidence: { level: 'medium' },
  },
  {
    id: 'run-2',
    label: 'Optimistic scenario',
    timestamp: Date.now() - 86400000,
    outcome: 22.3,
    confidence: { level: 'medium' },
  },
  {
    id: 'run-3',
    label: 'Current scenario',
    timestamp: Date.now(),
    outcome: 18.7,
    confidence: { level: 'high' },
  },
]

export function CompareState(): JSX.Element {
  const { setCompareMode } = useGuideStore()
  const [selectedRuns, setSelectedRuns] = useState<[string?, string?]>([
    undefined,
    undefined,
  ])

  const handleSelect = (baselineId: string, currentId: string) => {
    setSelectedRuns([baselineId, currentId])
  }

  const handleCancel = () => {
    setCompareMode(false)
  }

  const handleChangeSelection = () => {
    setSelectedRuns([undefined, undefined])
  }

  // If no runs selected yet, show selector
  if (!selectedRuns[0] || !selectedRuns[1]) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🔀</span>
            <h2 className="text-xl font-semibold text-charcoal-900">
              Compare Scenarios
            </h2>
          </div>
          <p className="text-sm text-storm-600">
            Select two runs to see what changed and why
          </p>
        </div>

        <RunSelector
          selectedRuns={selectedRuns}
          runHistory={mockRunHistory}
          onSelect={handleSelect}
          onCancel={handleCancel}
        />
      </div>
    )
  }

  // Get the two runs
  const baseline = mockRunHistory.find((r) => r.id === selectedRuns[0])
  const current = mockRunHistory.find((r) => r.id === selectedRuns[1])

  if (!baseline || !current) {
    return <div className="p-6">Error loading runs</div>
  }

  // Calculate delta
  const baselineOutcome = baseline.outcome
  const currentOutcome = current.outcome
  const delta = currentOutcome - baselineOutcome
  const deltaPercent = (delta / baselineOutcome) * 100

  // Mock change attribution (in real implementation, comes from explain_delta)
  const mockAttribution = {
    primary_drivers: [
      {
        description: 'Increased evidence strength for key relationships',
        change_type: 'weight_changed',
        contribution_to_delta: 0.6,
        contribution_pct: 60,
        affected_node_labels: ['Market demand', 'Product quality'],
      },
      {
        description: 'Added new competitive advantage factor',
        change_type: 'node_added',
        contribution_to_delta: 0.25,
        contribution_pct: 25,
        affected_node_labels: ['Innovation capacity'],
      },
      {
        description: 'Removed outdated risk assumption',
        change_type: 'node_removed',
        contribution_to_delta: 0.15,
        contribution_pct: 15,
        affected_node_labels: ['Legacy tech risk'],
      },
    ],
  }

  return (
    <div className="divide-y divide-storm-100">
      {/* Header */}
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🔀</span>
          <h2 className="text-xl font-semibold text-charcoal-900">
            Scenario Comparison
          </h2>
        </div>

        {/* Scenario Labels */}
        <div className="flex items-center gap-3 text-sm mb-4">
          <div className="px-3 py-1 bg-storm-100 rounded-full text-storm-700">
            {baseline.label || `Run ${new Date(baseline.timestamp).toLocaleDateString()}`}
          </div>
          <span className="text-storm-400">→</span>
          <div className="px-3 py-1 bg-analytical-100 rounded-full text-analytical-700">
            {current.label || `Run ${new Date(current.timestamp).toLocaleDateString()}`}
          </div>
        </div>

        <Button size="sm" variant="ghost" onClick={handleChangeSelection}>
          ← Change selection
        </Button>
      </div>

      {/* Delta Summary */}
      <div className="p-6 bg-mist-50">
        <div className="text-xs uppercase tracking-wide text-storm-500 mb-2">
          Change in Outcome
        </div>
        <div className="flex items-baseline gap-3">
          <div className="text-2xl font-bold text-charcoal-900">
            {baselineOutcome.toFixed(1)}%
          </div>
          <span className="text-storm-400">→</span>
          <div className="text-2xl font-bold text-charcoal-900">
            {currentOutcome.toFixed(1)}%
          </div>
          <div
            className={`
            text-lg font-semibold ml-2
            ${delta > 0 ? 'text-practical-600' : 'text-creative-600'}
          `}
          >
            {delta > 0 ? '↑' : '↓'} {Math.abs(deltaPercent).toFixed(1)}%
          </div>
        </div>
        <div className="text-sm text-storm-600 mt-1">
          {delta > 0 ? 'Improved' : 'Decreased'} by {Math.abs(delta).toFixed(1)}{' '}
          percentage points
        </div>
      </div>

      {/* Change Attribution */}
      <div className="p-6">
        <div className="text-sm font-medium text-charcoal-900 mb-3">
          What changed:
        </div>

        <div className="space-y-3">
          {mockAttribution.primary_drivers.slice(0, 3).map((driver, idx) => (
            <div
              key={idx}
              className="p-4 bg-white border border-storm-200 rounded-lg hover:border-analytical-300 transition"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="font-medium text-charcoal-900 mb-1">
                    {idx + 1}. {driver.description}
                  </div>
                  <div className="text-xs text-storm-600">
                    {formatChangeType(driver.change_type)}
                  </div>
                </div>
                <div
                  className={`
                    text-sm font-semibold px-2 py-1 rounded ml-2
                    ${
                      driver.contribution_to_delta > 0
                        ? 'bg-practical-100 text-practical-700'
                        : 'bg-creative-100 text-creative-700'
                    }
                  `}
                >
                  {driver.contribution_pct}%
                </div>
              </div>

              {driver.affected_node_labels &&
                driver.affected_node_labels.length > 0 && (
                  <div className="text-xs text-storm-600 mt-2">
                    Affects: {driver.affected_node_labels.join(', ')}
                  </div>
                )}

              <div className="mt-3 flex gap-2">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => console.log('Revert:', driver)}
                >
                  Revert
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => console.log('View in graph:', driver)}
                >
                  View in graph
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Structural Differences */}
      <ExpandableSection title="Graph changes" defaultOpen={false}>
        <div className="space-y-2 text-sm">
          <MetricRow label="Nodes added" value={1} />
          <MetricRow label="Nodes removed" value={1} />
          <MetricRow label="Edges changed" value={2} />
        </div>
      </ExpandableSection>

      {/* AI Recommendation */}
      <div className="p-6 bg-analytical-50">
        <div className="flex items-start gap-2">
          <span className="text-xl">🤖</span>
          <div>
            <div className="text-sm font-medium text-analytical-900 mb-1">
              Recommendation
            </div>
            <div className="text-sm text-analytical-700">
              {generateRecommendation(baseline, current, delta)}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-6 space-y-2">
        <Button
          variant="outline"
          fullWidth
          onClick={() => console.log('Restore baseline:', baseline)}
        >
          Restore baseline scenario
        </Button>
        <Button
          variant="primary"
          fullWidth
          onClick={() => console.log('Save current:', current)}
        >
          Save current as new scenario
        </Button>
        <Button variant="ghost" fullWidth onClick={() => setCompareMode(false)}>
          Exit compare mode
        </Button>
      </div>
    </div>
  )
}

// Helper functions
function formatChangeType(type: string): string {
  const types: Record<string, string> = {
    edge_removed: 'Connection removed',
    edge_added: 'Connection added',
    weight_changed: 'Strength adjusted',
    node_added: 'Factor added',
    node_removed: 'Factor removed',
    belief_changed: 'Belief updated',
  }
  return types[type] || type
}

function generateRecommendation(
  baseline: Run,
  current: Run,
  delta: number
): string {
  // No significant change
  if (Math.abs(delta) < 0.5) {
    return 'Changes had minimal impact. Consider testing more significant variations.'
  }

  // Improved outcome with same/better confidence
  if (
    delta > 0 &&
    (current.confidence?.level || 'low') >= (baseline.confidence?.level || 'low')
  ) {
    return 'Current scenario performs better with similar or higher confidence. This looks promising.'
  }

  // Decreased outcome
  if (delta < 0) {
    return 'Outcome decreased. Review the change drivers above to understand what caused the drop.'
  }

  // Improved but confidence dropped
  if (
    delta > 0 &&
    (current.confidence?.level || 'high') < (baseline.confidence?.level || 'high')
  ) {
    return 'Outcome improved but confidence decreased. Add evidence to strengthen this scenario before deciding.'
  }

  return 'Review the change drivers above to understand trade-offs between scenarios.'
}
