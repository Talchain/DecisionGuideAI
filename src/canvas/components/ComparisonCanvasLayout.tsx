/**
 * ComparisonCanvasLayout - Side-by-side canvas view for scenario comparison
 *
 * Replaces the main canvas when comparison mode is active.
 * Shows Scenario A and Scenario B in a vertical split with synced pan/zoom.
 */

import { useState, useMemo, useRef, useCallback } from 'react'
import { ReactFlowProvider, type ReactFlowInstance } from '@xyflow/react'
import { X, Link2, Link2Off, Maximize2, Plus, Minus, RefreshCw, Equal, Target } from 'lucide-react'
import { useCanvasStore } from '../store'
import { MiniCanvas } from './MiniCanvas'
import { typography } from '../../styles/typography'
import type { ComparisonResult } from '../snapshots/types'

/**
 * Format an outcome value with appropriate unit.
 * Task 6: Display correct units from goal node metadata.
 *
 * @param value - Outcome value in user units
 * @param unit - Optional unit string (e.g., '%', '£', 'pts')
 * @returns Formatted string (e.g., "10%", "£1,234", "42")
 */
function formatOutcome(value: number, unit?: string): string {
  // Round to reasonable precision
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Number(value.toFixed(1))

  // Format based on unit type
  if (unit === '%' || unit === 'percent' || unit === 'percentage') {
    return `${rounded}%`
  }
  if (unit === '£' || unit === 'GBP') {
    return `£${rounded.toLocaleString()}`
  }
  if (unit === '$' || unit === 'USD') {
    return `$${rounded.toLocaleString()}`
  }
  if (unit === '€' || unit === 'EUR') {
    return `€${rounded.toLocaleString()}`
  }
  if (unit) {
    return `${rounded.toLocaleString()} ${unit}`
  }

  // Default: plain number (assume percentage-like for backwards compatibility)
  return `${rounded}%`
}

/**
 * Outcomes Comparison Bar - Shows outcome predictions side by side
 */
function OutcomesComparisonBar({
  scenarios,
  apiResponse,
  goalUnit,
}: {
  scenarios: Array<{ label: string; optionId?: string }>
  apiResponse?: {
    base_scenario?: { id: string; name: string; outcome_predictions: Record<string, number> }
    alternative_scenarios?: Array<{ id: string; name: string; outcome_predictions: Record<string, number> }>
    option_comparison?: Array<{ option_id: string; option_label: string; outcome?: { mean: number; p10: number; p50: number; p90: number }; expected_outcome?: number; win_probability?: number }>
    analysis_status?: string
  } | null
  goalUnit?: string
}) {
  const outcomes = useMemo(() => {
    if (!apiResponse) {
      return scenarios.map((scenario) => ({
        label: scenario.label,
        value: null,
        isBest: false,
        status: 'loading' as const,
      }))
    }

    if (apiResponse.option_comparison?.length) {
      const values = scenarios.map((scenario) => {
        const match = apiResponse.option_comparison?.find((opt) => opt.option_id === scenario.optionId)
        const value = match?.outcome?.mean ?? match?.expected_outcome ?? null
        return {
          label: match?.option_label || scenario.label,
          value,
          winProbability: match?.win_probability,
          status: apiResponse.analysis_status === 'failed' ? 'error' : 'ready',
        }
      })

      const best = values
        .filter((item) => item.value !== null)
        .sort((a, b) => (b.winProbability ?? b.value ?? 0) - (a.winProbability ?? a.value ?? 0))[0]

      return values.map((item) => ({
        ...item,
        isBest: best?.label === item.label,
      }))
    }

    const base = apiResponse.base_scenario
    const alternatives = apiResponse.alternative_scenarios ?? []
    const all = base ? [base, ...alternatives] : alternatives

    if (!all.length) {
      return scenarios.map((scenario) => ({
        label: scenario.label,
        value: null,
        isBest: false,
        status: 'loading' as const,
      }))
    }

    const values = all.map((scenario) => {
      const predictions = scenario.outcome_predictions
      const key = Object.keys(predictions || {})[0]
      const value = key ? predictions[key] : null
      return {
        label: scenario.name,
        value,
        status: 'ready' as const,
      }
    })

    const best = values.filter((item) => item.value !== null)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0]

    return values.map((item) => ({
      ...item,
      isBest: best?.label === item.label,
    }))
  }, [apiResponse, scenarios])

  if (!outcomes.length) {
    return null
  }

  return (
    <div
      className="px-4 py-3 bg-gradient-to-r from-sky-50 to-mint-50 border-b border-sand-200"
      role="region"
      aria-label="Outcome comparison"
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-sky-600" aria-hidden="true" />
          <span className={`${typography.labelSmall} text-ink-600`}>Predicted Outcomes:</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {outcomes.map((outcome) => (
            <div
              key={outcome.label}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm ${
                outcome.isBest ? 'bg-mint-50 border-mint-200' : 'bg-white border-sand-200'
              }`}
            >
              <span className={`${typography.caption} text-ink-500`}>{outcome.label}</span>
              <span
                className={`${typography.bodySmall} font-semibold ${
                  outcome.isBest ? 'text-mint-700' : 'text-ink-900'
                }`}
              >
                {outcome.value === null ? '—' : formatOutcome(outcome.value, goalUnit)}
              </span>
              {outcome.isBest && (
                <span className={`${typography.caption} px-1.5 py-0.5 rounded bg-mint-100 text-mint-700 font-medium`}>
                  Best
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Collapsible stats bar showing change summary between scenarios
 */
function ComparisonStatsBar({ comparison }: { comparison: ComparisonResult | null }) {
  if (!comparison) return null

  const added = comparison.added.nodes.length + comparison.added.edges.length
  const removed = comparison.removed.nodes.length + comparison.removed.edges.length
  const modified = comparison.modified.nodes.length + comparison.modified.edges.length
  const unchanged = comparison.unchanged.nodes.length + comparison.unchanged.edges.length

  const stats = [
    {
      label: 'Added',
      count: added,
      icon: Plus,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      label: 'Removed',
      count: removed,
      icon: Minus,
      color: 'text-danger-600',
      bgColor: 'bg-danger-50',
    },
    {
      label: 'Modified',
      count: modified,
      icon: RefreshCw,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      label: 'Unchanged',
      count: unchanged,
      icon: Equal,
      color: 'text-ink-500',
      bgColor: 'bg-sand-50',
    },
  ]

  return (
    <details className="border-b border-sand-200 bg-sand-50">
      <summary
        className={`px-3 py-1.5 cursor-pointer text-ink-600 hover:text-ink-800 flex items-center gap-2 ${typography.caption}`}
      >
        <span className="font-medium">Structural changes:</span>
        <span className="text-ink-500">
          +{added} Added, -{removed} Removed, ~{modified} Modified
        </span>
      </summary>
      <div
        className="flex items-center gap-3 px-3 py-2 bg-white border-t border-sand-100"
        role="region"
        aria-label="Comparison statistics"
      >
        {stats.map(({ label, count, icon: Icon, color, bgColor }) => (
          <div
            key={label}
            className={`flex items-center gap-1.5 px-2 py-1 rounded ${bgColor}`}
            title={`${count} ${label.toLowerCase()}`}
          >
            <Icon className={`w-3.5 h-3.5 ${color}`} aria-hidden="true" />
            <span className={`${typography.labelSmall} ${color}`}>
              {count} {label}
            </span>
          </div>
        ))}
      </div>
    </details>
  )
}

/**
 * Changes Only view - list of all changes between scenarios
 */
function ChangesView({ comparison }: { comparison: ComparisonResult }) {
  const hasChanges =
    comparison.added.nodes.length > 0 ||
    comparison.added.edges.length > 0 ||
    comparison.removed.nodes.length > 0 ||
    comparison.removed.edges.length > 0 ||
    comparison.modified.nodes.length > 0 ||
    comparison.modified.edges.length > 0

  if (!hasChanges) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <Equal className="w-12 h-12 text-ink-300 mx-auto mb-3" />
          <p className={`${typography.body} text-ink-600`}>No differences found</p>
          <p className={`${typography.caption} text-ink-500 mt-1`}>
            Both scenarios are identical
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      {/* Added items */}
      {(comparison.added.nodes.length > 0 || comparison.added.edges.length > 0) && (
        <div className="border border-emerald-200 rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-emerald-50 border-b border-emerald-200">
            <h4 className={`${typography.body} font-medium text-emerald-900`}>
              Added ({comparison.added.nodes.length + comparison.added.edges.length})
            </h4>
          </div>
          <div className="p-3 space-y-1">
            {comparison.added.nodes.map((node) => (
              <div key={node.id} className={`${typography.body} text-ink-700`}>
                <Plus className="w-3.5 h-3.5 inline mr-1.5 text-emerald-600" />
                Node: {(node.data as { label?: string })?.label || node.id}
              </div>
            ))}
            {comparison.added.edges.map((edge, i) => (
              <div key={`${edge.source}-${edge.target}-${i}`} className={`${typography.body} text-ink-700`}>
                <Plus className="w-3.5 h-3.5 inline mr-1.5 text-emerald-600" />
                Edge: {edge.source} → {edge.target}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Removed items */}
      {(comparison.removed.nodes.length > 0 || comparison.removed.edges.length > 0) && (
        <div className="border border-danger/30 rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-danger-light border-b border-danger/30">
            <h4 className={`${typography.body} font-medium text-danger`}>
              Removed ({comparison.removed.nodes.length + comparison.removed.edges.length})
            </h4>
          </div>
          <div className="p-3 space-y-1">
            {comparison.removed.nodes.map((node) => (
              <div key={node.id} className={`${typography.body} text-ink-700`}>
                <Minus className="w-3.5 h-3.5 inline mr-1.5 text-danger-600" />
                Node: {(node.data as { label?: string })?.label || node.id}
              </div>
            ))}
            {comparison.removed.edges.map((edge, i) => (
              <div key={`${edge.source}-${edge.target}-${i}`} className={`${typography.body} text-ink-700`}>
                <Minus className="w-3.5 h-3.5 inline mr-1.5 text-danger-600" />
                Edge: {edge.source} → {edge.target}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modified items */}
      {(comparison.modified.nodes.length > 0 || comparison.modified.edges.length > 0) && (
        <div className="border border-amber-200 rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-amber-50 border-b border-amber-200">
            <h4 className={`${typography.body} font-medium text-amber-900`}>
              Modified ({comparison.modified.nodes.length + comparison.modified.edges.length})
            </h4>
          </div>
          <div className="p-3 space-y-1">
            {comparison.modified.nodes.map((node) => (
              <div key={node.id} className={`${typography.body} text-ink-700`}>
                <RefreshCw className="w-3.5 h-3.5 inline mr-1.5 text-amber-600" />
                Node: {(node.data as { label?: string })?.label || node.id}
              </div>
            ))}
            {comparison.modified.edges.map((edge, i) => (
              <div key={`${edge.source}-${edge.target}-${i}`} className={`${typography.body} text-ink-700`}>
                <RefreshCw className="w-3.5 h-3.5 inline mr-1.5 text-amber-600" />
                Edge: {edge.source} → {edge.target}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Side-by-side comparison layout replacing the main canvas
 */
export function ComparisonCanvasLayout() {
  const comparisonMode = useCanvasStore((s) => s.comparisonMode)
  const exitComparisonMode = useCanvasStore((s) => s.exitComparisonMode)

  const [selectedView, setSelectedView] = useState<'split' | 'changes'>('split')
  const [syncEnabled, setSyncEnabled] = useState(true)
  const instancesRef = useRef<Array<ReactFlowInstance | null>>([])

  const setInstance = useCallback((index: number) => (instance: ReactFlowInstance) => {
    instancesRef.current[index] = instance
  }, [])

  const handleMoveEnd = useCallback(
    (index: number) => (_: unknown, viewport: { x: number; y: number; zoom: number }) => {
      if (!syncEnabled) return
      instancesRef.current.forEach((instance, idx) => {
        if (idx === index || !instance) return
        instance.setViewport(viewport)
      })
    },
    [syncEnabled]
  )

  const fitAll = useCallback(() => {
    instancesRef.current.forEach((instance) => {
      instance?.fitView({ padding: 0.12, duration: 200 })
    })
  }, [])

  // Safety check - shouldn't render if not active
  if (!comparisonMode.active || comparisonMode.scenarios.length < 2) {
    return null
  }

  const { scenarios, comparison, apiResponse, hasMoreOptions, allOptionsCount } = comparisonMode
  const scenarioSummaries = scenarios.map((scenario) => ({
    label: scenario.label,
    optionId: scenario.optionId,
  }))

  return (
    // Note: Parent in ReactFlowGraph is position:absolute, not flex, so use h-full w-full
    <div className="h-full w-full flex flex-col">
      {/* Header with controls - minimal padding to maximize canvas space */}
      <div className="px-3 py-1.5 bg-white border-b border-sand-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className={`${typography.h4} text-ink-900`}>Scenario Comparison</h2>
          <span className={`${typography.caption} text-ink-500`}>
            {scenarios.length} options
            {hasMoreOptions ? ` (showing 4 of ${allOptionsCount})` : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-sand-100 rounded-md p-0.5" role="tablist">
            <button
              onClick={() => setSelectedView('split')}
              className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                selectedView === 'split'
                  ? 'bg-white shadow-sm text-ink-900'
                  : 'text-ink-600 hover:text-ink-900'
              }`}
              role="tab"
              aria-selected={selectedView === 'split'}
            >
              Side-by-Side
            </button>
            <button
              onClick={() => setSelectedView('changes')}
              className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                selectedView === 'changes'
                  ? 'bg-white shadow-sm text-ink-900'
                  : 'text-ink-600 hover:text-ink-900'
              }`}
              role="tab"
              aria-selected={selectedView === 'changes'}
            >
              Changes Only
            </button>
          </div>

          {/* Sync toggle - only visible in split view */}
          {selectedView === 'split' && (
            <>
              <button
                onClick={() => setSyncEnabled(!syncEnabled)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors ${
                  syncEnabled
                    ? 'bg-sky-100 text-sky-700 hover:bg-sky-200'
                    : 'bg-sand-100 text-ink-600 hover:bg-sand-200'
                }`}
                title={syncEnabled ? 'Disable synced pan/zoom' : 'Enable synced pan/zoom'}
                aria-pressed={syncEnabled}
              >
                {syncEnabled ? (
                  <Link2 className="w-4 h-4" />
                ) : (
                  <Link2Off className="w-4 h-4" />
                )}
                <span>{syncEnabled ? 'Synced' : 'Independent'}</span>
              </button>

              {/* Fit both */}
              <button
                onClick={fitAll}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-sand-100 text-ink-600 hover:bg-sand-200 text-sm transition-colors"
                title="Fit all canvases to view"
              >
                <Maximize2 className="w-4 h-4" />
                <span>Fit All</span>
              </button>
            </>
          )}

          {/* Exit comparison */}
          <button
            onClick={exitComparisonMode}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-danger-100 text-danger-700 hover:bg-danger-200 text-sm transition-colors"
            title="Exit comparison mode"
          >
            <X className="w-4 h-4" />
            <span>Exit</span>
          </button>
        </div>
      </div>

      {/* Stats bar showing change summary */}
      <ComparisonStatsBar comparison={comparison} />

      {/* Outcomes comparison bar - shows predicted outcome differences */}
      <OutcomesComparisonBar
        scenarios={scenarioSummaries}
        apiResponse={apiResponse}
      />

      {/* Content - conditional based on selected view */}
      {selectedView === 'split' ? (
        <div className="flex-1 min-h-0 p-3">
          <div className="grid gap-3 h-full" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            {scenarios.map((scenario, index) => (
              <div key={scenario.label} className="flex flex-col min-h-0 border border-sand-200 rounded-lg overflow-hidden bg-white">
                <div className="px-4 py-2 border-b border-sand-200">
                  <h3 className={`${typography.body} font-medium text-ink-900`}>
                    {scenario.label}
                  </h3>
                  <p className={`${typography.caption} text-ink-500`}>
                    {scenario.nodes.length} nodes, {scenario.edges.length} edges
                  </p>
                </div>
                <div className="flex-1 min-h-0 relative bg-paper-white">
                  <ReactFlowProvider>
                    <MiniCanvas
                      nodes={scenario.nodes}
                      edges={scenario.edges}
                      onInit={setInstance(index)}
                      onMoveEnd={handleMoveEnd(index)}
                      ariaLabel={`Scenario ${index + 1}: ${scenario.label}`}
                      className="absolute inset-0"
                    />
                  </ReactFlowProvider>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : comparison ? (
        /* Changes Only view */
        <ChangesView comparison={comparison} />
      ) : (
        /* Fallback if no comparison data */
        <div className="flex-1 flex items-center justify-center p-8">
          <p className={`${typography.body} text-ink-500`}>
            No comparison data available
          </p>
        </div>
      )}
    </div>
  )
}
