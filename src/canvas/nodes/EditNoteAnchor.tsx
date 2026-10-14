import { ViewportPortal, useStore } from '@xyflow/react'
import { EditNote, useEditNoteLifecycle } from '../editNotes/EditNote'
import { useEditNoteStore } from '../editNotes/editNoteStore'
import { useCanvasStore } from '../store'
import { GOAL_CHANCE_DRIVER_TAG_Z } from '../utils/goalChanceDriverLinks'

/** An independent viewport overlay. It is never inside a measured node, fit or routing bounds. */
export function CanvasEditNote({ inspectorOpen }: { inspectorOpen: boolean }) {
  useEditNoteLifecycle()
  const note = useEditNoteStore(s => s.note)
  const selectedNodeId = useCanvasStore(s => s.selection.nodeIds.size === 1 ? [...s.selection.nodeIds][0] : null)
  const zoom = useStore(s => s.transform[2])
  const geometry = useStore(s => {
    const node = note ? s.nodeLookup.get(note.elementId) : undefined
    if (!node) return null
    return { x: node.internals.positionAbsolute.x, y: node.internals.positionAbsolute.y + (node.measured.height ?? 0) }
  }, (a, b) => a?.x === b?.x && a?.y === b?.y)
  if (!note || !geometry || (inspectorOpen && selectedNodeId === note.elementId)) return null
  return <ViewportPortal>
    <div data-edit-note-surface="canvas" className="absolute pointer-events-auto pt-2"
      style={{ transform: `translate(${geometry.x}px, ${geometry.y}px) scale(${1 / zoom})`, transformOrigin: 'top left', width: 280, zIndex: GOAL_CHANCE_DRIVER_TAG_Z }}>
      <EditNote elementId={note.elementId} />
    </div>
  </ViewportPortal>
}
