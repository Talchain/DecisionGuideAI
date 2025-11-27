/**
 * Properties panel with inspector routing
 * Shows NodeInspector or EdgeInspector based on selection
 */
import { NodeInspector } from '../ui/NodeInspector'
import { EdgeInspector } from '../ui/EdgeInspector'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'

export function PropertiesPanel() {
  // React #185 FIX: Return primitive values from selectors to prevent re-renders
  // on every store update. Selecting the entire `selection` object (which contains
  // Sets) causes infinite loops since Set references change on each store update.
  const nodeId = useCanvasStore(s => {
    const ids = s.selection.nodeIds
    if (ids.size !== 1) return null
    return ids.values().next().value ?? null
  })
  const edgeId = useCanvasStore(s => {
    const ids = s.selection.edgeIds
    if (ids.size !== 1) return null
    return ids.values().next().value ?? null
  })

  const wrapper = (children: React.ReactNode) => (
    <div className="fixed right-6 top-24 w-80 rounded-2xl shadow bg-white border border-gray-200/50 max-h-[calc(100vh-7rem)] overflow-y-auto">
      <div className="p-6">{children}</div>
    </div>
  )

  if (nodeId) return wrapper(<NodeInspector nodeId={nodeId} onClose={() => {}} />)
  if (edgeId) return wrapper(<EdgeInspector edgeId={edgeId} onClose={() => {}} />)

  return wrapper(
    <p className={`${typography.body} text-gray-600`}>Select a node or edge to edit its details.</p>
  )
}
