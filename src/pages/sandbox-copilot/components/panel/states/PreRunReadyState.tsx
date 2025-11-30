/**
 * Pre-Run Ready State
 *
 * Shown when the graph is valid and ready to analyze.
 */
export function PreRunReadyState() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">✅</span>
        <h2 className="text-xl font-semibold text-charcoal-900">Ready to Analyze</h2>
      </div>

      <div className="text-storm-700 text-sm">
        <p>Your model is ready! Click Run Analysis to see predictions and insights.</p>
      </div>

      <button className="w-full py-3 px-4 bg-analytical-500 text-white rounded-lg font-medium hover:bg-analytical-600 transition-colors">
        Run Analysis
      </button>
    </div>
  )
}
