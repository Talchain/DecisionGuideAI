/**
 * Post-Run State
 *
 * Shown after analysis is complete.
 * This is where we'll show the rich PLoT/CEE insights.
 */
export function PostRunState() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">📊</span>
        <h2 className="text-xl font-semibold text-charcoal-900">Analysis Complete</h2>
      </div>

      <div className="text-storm-700 text-sm">
        <p>Your analysis results are ready. Insights and recommendations will appear here.</p>
      </div>
    </div>
  )
}
