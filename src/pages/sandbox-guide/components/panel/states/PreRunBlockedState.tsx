/**
 * Pre-Run Blocked State
 *
 * Shown when the graph has blocking issues that prevent analysis.
 * Displays dynamic blockers from journey detection logic.
 */

import { useCanvasStore } from '@/canvas/store'
import { findBlockers } from '../../../utils/journeyDetection'
import { Button } from '../../shared/Button'

export function PreRunBlockedState(): JSX.Element {
  const nodes = useCanvasStore((state) => state.nodes)
  const edges = useCanvasStore((state) => state.edges)

  const blockers = findBlockers({ nodes, edges })

  return (
    <div className="p-6 space-y-6 font-sans">
      <div className="flex items-center gap-3">
        <span className="text-2xl">⚠️</span>
        <h2 className="text-xl font-semibold text-charcoal-900">Cannot Run Analysis</h2>
      </div>

      <div className="text-storm-700 text-sm">
        <p>Your model needs a few things before it can be analyzed:</p>
      </div>

      <div className="space-y-2">
        {blockers.map((blocker, idx) => (
          <div key={idx} className="flex items-start gap-2 text-sm">
            <span className="text-creative-600">•</span>
            <span className="text-storm-700">{blocker}</span>
          </div>
        ))}

        {blockers.length === 0 && (
          <div className="text-sm text-storm-600">
            <p>Checking graph structure...</p>
          </div>
        )}
      </div>

      {/* Helpful actions */}
      <div className="space-y-2">
        <Button variant="outline" fullWidth>
          Add outcome node
        </Button>
        <Button variant="outline" fullWidth>
          Add decision node
        </Button>
      </div>

      {/* Helpful tip */}
      <div className="p-3 bg-analytical-50 rounded-lg border border-analytical-200">
        <div className="text-xs font-medium text-analytical-800 mb-1">💡 Tip</div>
        <div className="text-xs text-charcoal-900">
          A valid decision model needs at least one outcome (what you're trying to achieve) and one
          decision (the choice you need to make).
        </div>
      </div>
    </div>
  )
}
