/**
 * Pre-Run Blocked State
 *
 * Shown when the graph has blocking issues that prevent analysis.
 */
export function PreRunBlockedState() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">⚠️</span>
        <h2 className="text-xl font-semibold text-charcoal-900">Cannot Run Analysis</h2>
      </div>

      <div className="text-storm-700 text-sm">
        <p>Your model needs a few things before it can be analyzed:</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-start gap-2 text-sm">
          <span className="text-creative-600">•</span>
          <span className="text-storm-700">At least one outcome node</span>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <span className="text-creative-600">•</span>
          <span className="text-storm-700">At least one decision node</span>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <span className="text-creative-600">•</span>
          <span className="text-storm-700">Connections between nodes</span>
        </div>
      </div>
    </div>
  )
}
