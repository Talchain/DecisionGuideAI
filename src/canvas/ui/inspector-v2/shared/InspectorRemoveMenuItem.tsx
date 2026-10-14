import { Trash2 } from 'lucide-react'
import { useShowToastSafe } from '../../../ToastContext'
import { deleteAction, type DeleteTarget } from '../../../contextMenu/actions'
import { canDeleteFromContextMenu } from '../../../contextMenu/useMenuItems'

export type InspectorRemoveTarget = Exclude<DeleteTarget, { kind: 'multi' }>

/** A new entry to the context menu's unchanged confirmation and delete action. */
export function InspectorRemoveMenuItem({ target, onRequested }: {
  target: InspectorRemoveTarget
  onRequested: (target: InspectorRemoveTarget) => void
}) {
  const showToast = useShowToastSafe()
  return (
    <button
      type="button"
      role="menuitem"
      data-testid="inspector-remove"
      onClick={() => {
        if (!canDeleteFromContextMenu()) return
        onRequested(target)
        void deleteAction(target, showToast)
      }}
      className="flex w-full items-center gap-2 rounded border border-danger/30 px-3 py-2 text-left text-danger hover:bg-panel-hover"
    >
      <Trash2 size={14} aria-hidden="true" />
      Remove
    </button>
  )
}
