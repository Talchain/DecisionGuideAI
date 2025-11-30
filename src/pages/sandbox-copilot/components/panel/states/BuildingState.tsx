/**
 * Building State
 *
 * Shown when the user is actively building their graph
 * but it's not yet ready to run.
 */
export function BuildingState() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🔨</span>
        <h2 className="text-xl font-semibold text-charcoal-900">Building Your Model</h2>
      </div>

      <div className="text-storm-700 text-sm">
        <p>Keep adding nodes and connections to build your decision model.</p>
      </div>
    </div>
  )
}
