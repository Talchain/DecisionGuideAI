/**
 * Inspector State
 *
 * Shown when the user has selected a node or edge for inspection.
 */
export function InspectorState() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🔍</span>
        <h2 className="text-xl font-semibold text-charcoal-900">Inspector</h2>
      </div>

      <div className="text-storm-700 text-sm">
        <p>Details about the selected element will appear here.</p>
      </div>
    </div>
  )
}
