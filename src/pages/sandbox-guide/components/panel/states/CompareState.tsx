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

import { useState, useEffect } from 'react'
import { useGuideStore } from '../../../hooks/useGuideStore'
import { useCanvasStore } from '../../../../../canvas/store'
import { Button } from '../../shared/Button'
import { MetricRow } from '../../shared/MetricRow'
import { ExpandableSection } from '../../shared/ExpandableSection'
import { RunSelector, type Run } from '../sections/RunSelector'
import { useCompareData } from '../../../hooks/useCompareData'
import { loadRuns, type StoredRun } from '../../../../../canvas/store/runHistory'

/**
 * Convert StoredRun to Run format expected by RunSelector
 */
function convertStoredRunToRun(storedRun: StoredRun): Run {
  return {
    id: storedRun.id,
    label: storedRun.summary || `Run ${new Date(storedRun.ts).toLocaleDateString()}`,
    timestamp: storedRun.ts,
    outcome: storedRun.report?.outcome?.value ?? 0,
    confidence: storedRun.report?.outcome?.confidence
      ? { level: storedRun.report.outcome.confidence.level }
      : undefined,
  }
}

export function CompareState(): JSX.Element {
  const { setCompareMode, setJourneyStage } = useGuideStore()
  const hydrateGraphSlice = useCanvasStore((state) => state.hydrateGraphSlice)
  const resultsLoadHistorical = useCanvasStore((state) => state.resultsLoadHistorical)
  const setHighlightedNodes = useCanvasStore((state) => state.setHighlightedNodes)

  const [selectedRuns, setSelectedRuns] = useState<[string?, string?]>([
    undefined,
    undefined,
  ])
  const [runHistory, setRunHistory] = useState<Run[]>([])

  // Load run history from localStorage
  useEffect(() => {
    const storedRuns = loadRuns()
    const convertedRuns = storedRuns.map(convertStoredRunToRun)
    setRunHistory(convertedRuns)
  }, [])

  // Use the compare data hook to fetch real data
  const compareData = useCompareData({
    baselineRunId: selectedRuns[0] || null,
    currentRunId: selectedRuns[1] || null,
  })

  const handleSelect = (baselineId: string, currentId: string) => {
    setSelectedRuns([baselineId, currentId])
  }

  const handleCancel = () => {
    setCompareMode(false)
  }

  const handleChangeSelection = () => {
    setSelectedRuns([undefined, undefined])
  }

  // Action handlers
  const handleRestoreBaseline = () => {
    const { baseline } = compareData
    if (!baseline || !baseline.graph) {
      console.warn('No baseline graph to restore')
      return
    }

    // Restore baseline graph
    hydrateGraphSlice({
      nodes: baseline.graph.nodes,
      edges: baseline.graph.edges,
    })

    // Load baseline results
    resultsLoadHistorical(baseline)

    // Exit compare mode and go to post-run
    setCompareMode(false)
    setJourneyStage('post-run')
  }

  const handleViewInGraph = (nodeId: string) => {
    // Highlight the node in the graph
    setHighlightedNodes([nodeId])

    // Could also center the viewport on the node if needed
    // This would require accessing the ReactFlow instance
  }

  const handleExitCompare = () => {
    setCompareMode(false)
    // Stay in post-run state if we have results, otherwise go to building
    setJourneyStage('post-run')
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
          runHistory={runHistory}
          onSelect={handleSelect}
          onCancel={handleCancel}
        />
      </div>
    )
  }

  // Get the two runs from compareData
  const { baseline, current, delta, changeDrivers, structuralDiff, loading, error } = compareData

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-storm-600">Loading comparison data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-sm text-red-600">Error: {error}</div>
        <Button variant="ghost" onClick={handleChangeSelection} className="mt-4">
          ← Change selection
        </Button>
      </div>
    )
  }

  if (!baseline || !current) {
    return <div className="p-6">Error loading runs</div>
  }

  // Extract outcome values from reports
  const baselineOutcome = baseline.report?.outcome?.value ?? 0
  const currentOutcome = current.report?.outcome?.value ?? 0

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
            {baseline.summary || `Run ${new Date(baseline.ts).toLocaleDateString()}`}
          </div>
          <span className="text-storm-400">→</span>
          <div className="px-3 py-1 bg-analytical-100 rounded-full text-analytical-700">
            {current.summary || `Run ${new Date(current.ts).toLocaleDateString()}`}
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
          {delta && (
            <div
              className={`
              text-lg font-semibold ml-2
              ${delta.direction === 'increase' ? 'text-practical-600' : delta.direction === 'decrease' ? 'text-creative-600' : 'text-storm-600'}
            `}
            >
              {delta.direction === 'increase' ? '↑' : delta.direction === 'decrease' ? '↓' : '='}{' '}
              {Math.abs(delta.percentage).toFixed(1)}%
            </div>
          )}
        </div>
        {delta && (
          <div className="text-sm text-storm-600 mt-1">
            {delta.direction === 'increase'
              ? 'Improved'
              : delta.direction === 'decrease'
              ? 'Decreased'
              : 'No change'}{' '}
            by {Math.abs(delta.value).toFixed(1)} percentage points
          </div>
        )}
      </div>

      {/* Change Attribution */}
      <div className="p-6">
        <div className="text-sm font-medium text-charcoal-900 mb-3">
          What changed:
        </div>

        {changeDrivers.length > 0 ? (
          <div className="space-y-3">
            {changeDrivers.slice(0, 3).map((driver, idx) => (
              <div
                key={idx}
                className="p-4 bg-white border border-storm-200 rounded-lg hover:border-analytical-300 transition"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-medium text-charcoal-900 mb-1">
                      {idx + 1}. {driver.nodeLabel}
                    </div>
                    <div className="text-xs text-storm-600">
                      Contribution: {driver.contribution.toFixed(2)}
                    </div>
                  </div>
                  <div
                    className={`
                      text-sm font-semibold px-2 py-1 rounded ml-2
                      ${
                        driver.direction === 'positive'
                          ? 'bg-practical-100 text-practical-700'
                          : 'bg-creative-100 text-creative-700'
                      }
                    `}
                  >
                    {driver.direction === 'positive' ? '+' : '-'}
                    {Math.abs(driver.contribution * 100).toFixed(0)}%
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => handleViewInGraph(driver.nodeId)}
                  >
                    View in graph
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-storm-600 p-4 bg-storm-50 rounded">
            No change drivers available. This may indicate no significant changes between runs or
            explain_delta data is not available.
          </div>
        )}
      </div>

      {/* Structural Differences */}
      <ExpandableSection title="Graph changes" defaultOpen={false}>
        <div className="space-y-2 text-sm">
          {structuralDiff ? (
            <>
              <MetricRow label="Nodes added" value={structuralDiff.nodesAdded} />
              <MetricRow label="Nodes removed" value={structuralDiff.nodesRemoved} />
              <MetricRow label="Edges added" value={structuralDiff.edgesAdded} />
              <MetricRow label="Edges removed" value={structuralDiff.edgesRemoved} />
            </>
          ) : (
            <div className="text-sm text-storm-600 p-2">
              Structural diff data not available
            </div>
          )}
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
              {delta ? generateRecommendation(baseline, current, delta.value) : 'Unable to generate recommendation'}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-6 space-y-2">
        <Button
          variant="outline"
          fullWidth
          onClick={handleRestoreBaseline}
          disabled={!baseline?.graph}
        >
          Restore baseline scenario
        </Button>
        <Button variant="ghost" fullWidth onClick={handleExitCompare}>
          Exit compare mode
        </Button>
      </div>
    </div>
  )
}

// Helper function
function generateRecommendation(
  baseline: StoredRun,
  current: StoredRun,
  deltaValue: number
): string {
  // No significant change
  if (Math.abs(deltaValue) < 0.5) {
    return 'Changes had minimal impact. Consider testing more significant variations.'
  }

  const baselineConfidence = baseline.report?.outcome?.confidence?.level || 'low'
  const currentConfidence = current.report?.outcome?.confidence?.level || 'low'

  const confidenceLevels: Record<string, number> = { low: 1, medium: 2, high: 3 }
  const baselineConfidenceScore = confidenceLevels[baselineConfidence] || 1
  const currentConfidenceScore = confidenceLevels[currentConfidence] || 1

  // Improved outcome with same/better confidence
  if (deltaValue > 0 && currentConfidenceScore >= baselineConfidenceScore) {
    return 'Current scenario performs better with similar or higher confidence. This looks promising.'
  }

  // Decreased outcome
  if (deltaValue < 0) {
    return 'Outcome decreased. Review the change drivers above to understand what caused the drop.'
  }

  // Improved but confidence dropped
  if (deltaValue > 0 && currentConfidenceScore < baselineConfidenceScore) {
    return 'Outcome improved but confidence decreased. Add evidence to strengthen this scenario before deciding.'
  }

  return 'Review the change drivers above to understand trade-offs between scenarios.'
}
