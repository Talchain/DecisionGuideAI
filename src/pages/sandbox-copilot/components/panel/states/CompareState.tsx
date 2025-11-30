/**
 * Compare State
 *
 * Shown when the user is in compare mode.
 */
export function CompareState() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">⚖️</span>
        <h2 className="text-xl font-semibold text-charcoal-900">Compare</h2>
      </div>

      <div className="text-storm-700 text-sm">
        <p>Comparison view will show differences between scenarios here.</p>
      </div>
    </div>
  )
}
