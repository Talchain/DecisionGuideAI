/**
 * Pre-Run Ready State
 *
 * Shown when the graph is valid and ready to analyze.
 * Provides a clear CTA to run analysis.
 */

import { useCanvasStore } from '@/canvas/store'
import { useResultsRun } from '@/canvas/hooks/useResultsRun'
import { Button } from '../../shared/Button'

export function PreRunReadyState(): JSX.Element {
  const nodes = useCanvasStore((state) => state.nodes)
  const edges = useCanvasStore((state) => state.edges)
  const outcomeNodeId = useCanvasStore((state) => state.outcomeNodeId)
  const { run } = useResultsRun()

  const handleRun = () => {
    run({
      graph: {
        nodes: nodes.map((n) => ({
          id: n.id,
          data: n.data,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          data: e.data,
        })),
      },
      outcome_node: outcomeNodeId || undefined,
      seed: 1337,
    })
  }

  const nodeCount = nodes.length
  const edgeCount = edges.length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">✅</span>
        <h2 className="text-xl font-semibold text-charcoal-900">Ready to Analyze</h2>
      </div>

      <div className="text-storm-700 text-sm">
        <p>Your model is ready! Click Run Analysis to see predictions and insights.</p>
      </div>

      {/* Graph stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-storm-50 rounded-lg border border-storm-200">
          <div className="text-xs text-storm-600 mb-1">Nodes</div>
          <div className="text-2xl font-bold text-charcoal-900">{nodeCount}</div>
        </div>
        <div className="p-3 bg-storm-50 rounded-lg border border-storm-200">
          <div className="text-xs text-storm-600 mb-1">Connections</div>
          <div className="text-2xl font-bold text-charcoal-900">{edgeCount}</div>
        </div>
      </div>

      <Button variant="primary" fullWidth onClick={handleRun}>
        Run Analysis
      </Button>

      {/* Optional: Add evidence prompt */}
      <div className="p-3 bg-analytical-50 rounded-lg border border-analytical-200">
        <div className="text-xs font-medium text-analytical-800 mb-1">💡 Tip</div>
        <div className="text-xs text-charcoal-900">
          Add evidence to your connections before running to get higher confidence predictions.
        </div>
      </div>
    </div>
  )
}
