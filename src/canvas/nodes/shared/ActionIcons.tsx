/**
 * ActionIcons — Confirm + Edit icons, absolute bottom-right of node card.
 * Confirm: shown when extractionType === 'inferred' (marks value as user-reviewed).
 * Edit: shown when value exists or needs input (opens inspector).
 */
import { useCallback } from 'react'
import { Check, Pencil } from 'lucide-react'
import { useCanvasStore } from '../../store'

interface ActionIconsProps {
  nodeId: string
  showConfirm?: boolean
  showEdit?: boolean
  onConfirm?: () => void
}

export function ActionIcons({ nodeId, showConfirm, showEdit, onConfirm }: ActionIconsProps) {
  if (!showConfirm && !showEdit) return null

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const store = useCanvasStore.getState()
    // Select the node and open inspector
    store.onSelectionChange({ nodes: [{ id: nodeId } as any], edges: [] })
    store.setShowInspectorPanel(true)
  }, [nodeId])

  const handleConfirm = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onConfirm?.()
  }, [onConfirm])

  return (
    <div className="absolute bottom-2 right-2.5 flex gap-0.5">
      {showConfirm && (
        <button
          type="button"
          className="p-0.5 rounded bg-success/10 hover:bg-success/20 transition-colors nodrag nopan"
          title="Confirm value"
          onClick={handleConfirm}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Check size={11} className="text-success" />
        </button>
      )}
      {showEdit && (
        <button
          type="button"
          className="p-0.5 rounded bg-info/10 hover:bg-info/20 transition-colors nodrag nopan"
          title="Edit"
          onClick={handleEdit}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Pencil size={11} className="text-info" />
        </button>
      )}
    </div>
  )
}
