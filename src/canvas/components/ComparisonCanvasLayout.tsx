/**
 * ComparisonCanvasLayout - Side-by-side canvas view for scenario comparison
 *
 * Replaces the main canvas when comparison mode is active.
 * Shows Scenario A and Scenario B in a vertical split with synced pan/zoom.
 */

import { useState, useMemo } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { X, Link2, Link2Off, Maximize2, Plus, Minus, RefreshCw, Equal, TrendingUp, TrendingDown, Target } from 'lucide-react'
import { useCanvasStore } from '../store'
import { MiniCanvas } from './MiniCanvas'
import { useSyncedViewports } from '../hooks/useSyncedViewports'
import { typography } from '../../styles/typography'
import type { ComparisonResult } from '../snapshots/types'

/**
 * Outcomes Comparison Bar - Shows outcome predictions side by side
 */
function OutcomesComparisonBar({
  scenarioALabel,
  scenarioBLabel,
  apiResponse,
}: {
  scenarioALabel: string
  scenarioBLabel: string
  apiResponse?: {
    base_scenario?: { id: string; name: string; outcome_predictions: Record<string, number> }
    alternative_scenarios?: Array<{ id: string; name: string; outcome_predictions: Record<string, number> }>
  } | null
}) {
  // Extract outcomes from API response
  const outcomes = useMemo(() => {
    if (!apiResponse) return null

    // Get first outcome from each scenario's predictions
    const baseOutcome = apiResponse.base_scenario?.outcome_predictions
    const altScenario = apiResponse.alternative_scenarios?.[0]
    const altOutcome = altScenario?.outcome_predictions

    if (!baseOutcome || !altOutcome) return null

    // Get the first outcome key (typically there's one main outcome)
    const outcomeKey = Object.keys(baseOutcome)[0]
    if (!outcomeKey) return null

    const valueA = baseOutcome[outcomeKey]
    const valueB = altOutcome[outcomeKey]
    const delta = valueB - valueA
    const isBetter = delta > 0

    return {
      labelA: apiResponse.base_scenario?.name || scenarioALabel,
      labelB: altScenario?.name || scenarioBLabel,
      valueA,
      valueB,
      delta,
      isBetter,
    }
  }, [apiResponse, scenarioALabel, scenarioBLabel])

  if (!outcomes) {
    return null
  }

  return (
    <div
      className="px-4 py-3 bg-gradient-to-r from-sky-50 to-mint-50 border-b border-sand-200"
      role="region"
      aria-label="Outcome comparison"
    >
      <div className="flex items-center justify-between gap-8">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-sky-600" aria-hidden="true" />
          <span className={`${typography.labelSmall} text-ink-600`}>Predicted Outcomes:</span>
        </div>

        <div className="flex items-center gap-8">
          {/* Scenario A */}
          <div className="flex items-center gap-2">
            <span className={`${typography.caption} text-ink-500`}>{outcomes.labelA}:</span>
            <span className={`${typography.body} font-bold text-ink-900`}>
              {(outcomes.valueA * 100).toFixed(0)}%
            </span>
          </div>

          {/* Divider with delta */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white shadow-sm">
            {outcomes.isBetter ? (
              <TrendingUp className="w-4 h-4 text-mint-600" />
            ) : outcomes.delta < 0 ? (
              <TrendingDown className="w-4 h-4 text-carrot-600" />
            ) : (
              <Equal className="w-4 h-4 text-ink-400" />
            )}
            <span
              className={`${typography.bodySmall} font-semibold ${
                outcomes.isBetter ? 'text-mint-700' : outcomes.delta < 0 ? 'text-carrot-700' : 'text-ink-600'
              }`}
            >
              {outcomes.delta > 0 ? '+' : ''}{(outcomes.delta * 100).toFixed(0)}%
            </span>
          </div>

          {/* Scenario B */}
          <div className="flex items-center gap-2">
            <span className={`${typography.caption} text-ink-500`}>{outcomes.labelB}:</span>
            <span className={`${typography.body} font-bold ${outcomes.isBetter ? 'text-mint-700' : 'text-ink-900'}`}>
              {(outcomes.valueB * 100).toFixed(0)}%
            </span>
            {outcomes.isBetter && (
              <span className={`${typography.caption} px-1.5 py-0.5 rounded bg-mint-100 text-mint-700 font-medium`}>
                Better
              </span>
            )}
          </div>
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
        <div className="border border-danger-200 rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-danger-50 border-b border-danger-200">
            <h4 className={`${typography.body} font-medium text-danger-900`}>
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
  const {
    setInstanceA,
    setInstanceB,
    onMoveEndA,
    onMoveEndB,
    fitBoth,
  } = useSyncedViewports({ enabled: syncEnabled })

  // Safety check - shouldn't render if not active
  if (!comparisonMode.active || !comparisonMode.scenarioA || !comparisonMode.scenarioB) {
    return null
  }

  const { scenarioA, scenarioB, comparison, apiResponse } = comparisonMode

  return (
    // Note: Parent in ReactFlowGraph is position:absolute, not flex, so use h-full w-full
    <div className="h-full w-full flex flex-col">
      {/* Header with controls - minimal padding to maximize canvas space */}
      <div className="px-3 py-1.5 bg-white border-b border-sand-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className={`${typography.h4} text-ink-900`}>Scenario Comparison</h2>
          <span className={`${typography.caption} text-ink-500`}>
            {scenarioA.label} vs {scenarioB.label}
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
                onClick={fitBoth}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-sand-100 text-ink-600 hover:bg-sand-200 text-sm transition-colors"
                title="Fit both canvases to view"
              >
                <Maximize2 className="w-4 h-4" />
                <span>Fit Both</span>
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
        scenarioALabel={scenarioA.label}
        scenarioBLabel={scenarioB.label}
        apiResponse={apiResponse}
      />

      {/* Content - conditional based on selected view */}
      {selectedView === 'split' ? (
        /* Side-by-side canvases */
        <div className="flex-1 flex min-h-0">
          {/* Scenario A - Left */}
          <div className="flex-1 flex flex-col min-h-0 border-r border-sand-300">
            <div className="px-4 py-2 bg-white border-b border-sand-200 flex items-center justify-between">
              <div>
                <h3 className={`${typography.body} font-medium text-ink-900`}>
                  {scenarioA.label}
                </h3>
                <p className={`${typography.caption} text-ink-500`}>
                  {scenarioA.nodes.length} nodes, {scenarioA.edges.length} edges
                </p>
              </div>
            </div>
            {/* ReactFlow requires explicit dimensions - use relative + absolute positioning */}
            <div className="flex-1 min-h-0 relative bg-paper-white">
              <ReactFlowProvider>
                <MiniCanvas
                  nodes={scenarioA.nodes}
                  edges={scenarioA.edges}
                  onInit={setInstanceA}
                  onMoveEnd={onMoveEndA}
                  ariaLabel={`Scenario A: ${scenarioA.label}`}
                  className="absolute inset-0"
                />
              </ReactFlowProvider>
            </div>
          </div>

          {/* Scenario B - Right */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 py-2 bg-white border-b border-sand-200 flex items-center justify-between">
              <div>
                <h3 className={`${typography.body} font-medium text-ink-900`}>
                  {scenarioB.label}
                </h3>
                <p className={`${typography.caption} text-ink-500`}>
                  {scenarioB.nodes.length} nodes, {scenarioB.edges.length} edges
                </p>
              </div>
            </div>
            {/* ReactFlow requires explicit dimensions - use relative + absolute positioning */}
            <div className="flex-1 min-h-0 relative bg-paper-white">
              <ReactFlowProvider>
                <MiniCanvas
                  nodes={scenarioB.nodes}
                  edges={scenarioB.edges}
                  onInit={setInstanceB}
                  onMoveEnd={onMoveEndB}
                  ariaLabel={`Scenario B: ${scenarioB.label}`}
                  className="absolute inset-0"
                />
              </ReactFlowProvider>
            </div>
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
