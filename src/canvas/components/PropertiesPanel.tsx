/**
 * Properties panel with inspector routing
 * Shows NodeInspector or EdgeInspector based on selection
 */
import { NodeInspector } from '../ui/NodeInspector'
import { EdgeInspector } from '../ui/EdgeInspector'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'

export function PropertiesPanel() {
  const selection = useCanvasStore(s => s.selection)
  const nodeId = selection.nodeIds.size === 1 ? [...selection.nodeIds][0] : null
  const edgeId = selection.edgeIds.size === 1 ? [...selection.edgeIds][0] : null

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
