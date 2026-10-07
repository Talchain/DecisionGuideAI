import { useEffect } from 'react'
import { typography } from '../../styles/typography'
import { useCanvasStore } from '../store'
import { askAi } from '../conversation/askAi'
import { executeCanonicalRun } from '../analysis/canonicalRunRegistry'
import { useShowToastSafe } from '../ToastContext'
import { openOptionValueInput } from '../utils/openOptionValueInput'
import { OPEN_FULL_INSPECTOR_EVENT } from '../utils/openEdgeStrengthEditor'
import { requestNodeRename } from '../ui/inspector-v2/renameIntent'
import { useEditNoteStore } from './editNoteStore'
import { clearPendingEditNotes, clickAwayFromAddedCards, watchAddedCard, recordManualEditChange, watchRenameEdit } from './reportManualEditReceipt'
import type { EditNoteAction } from './deriveEditNote'

export const EDIT_NOTE_LINK_EVENT = 'olumi:edit-note-link'

/** The same words and actions are rendered by exactly one surface. */
export function EditNote({ elementId }: { elementId: string }) {
  const note = useEditNoteStore(s => s.note?.elementId === elementId ? s.note : null)
  const showToast = useShowToastSafe()
  if (!note) return null
  const act = async (action: EditNoteAction) => {
    const id = action.nodeIds?.[0] ?? elementId
    if (action.kind === 'keep') { useEditNoteStore.getState().keep(); return }
    if (action.kind === 'discuss') {
      const outcome = askAi({ intent: action.intent, nodeIds: action.nodeIds })
      if (outcome === 'sent') useEditNoteStore.getState().acted()
      return
    }
    if (action.kind === 'run') {
      useEditNoteStore.getState().acted()
      const outcome = await executeCanonicalRun({ source: 'inspector-inline-rerun' })
      if (outcome.status === 'blocked' || outcome.status === 'unavailable') showToast(outcome.reason, 'warning')
      return
    }
    useEditNoteStore.getState().acted()
    if (action.kind === 'option') openOptionValueInput(id)
    if (action.kind === 'link') {
      useCanvasStore.getState().selectNodeWithoutHistory(id)
      window.dispatchEvent(new Event(EDIT_NOTE_LINK_EVENT))
    }
    if (action.kind === 'rename') {
      useCanvasStore.getState().selectNodeWithoutHistory(id)
      requestNodeRename(id)
      window.dispatchEvent(new Event(OPEN_FULL_INSPECTOR_EVENT))
    }
  }
  return (
    <div data-edit-note={note.check} data-edit-note-element={elementId} role="status"
      className="nodrag nopan rounded-lg border border-panel-border bg-panel p-3 shadow-sm text-text-body"
      style={{ maxWidth: 280 }} onPointerDown={event => event.stopPropagation()}>
      <p className={typography.panelBody}>{note.words}</p>
      <div className="flex flex-wrap gap-2 mt-2">
        {note.actions.map(action => <button key={action.kind} type="button" onClick={() => void act(action)}
          className={`${typography.panelMeta} rounded border border-panel-border px-2 py-1 text-primary hover:bg-panel-hover`}>
          {action.label}
        </button>)}
      </div>
    </div>
  )
}

/** Observe manual model changes, never layout/selection or CEE/proposal application. */
export function useEditNoteLifecycle(): void {
  useEffect(() => {
    const unsubscribe = useCanvasStore.subscribe((state, previous) => {
      if (state.currentScenarioId !== previous.currentScenarioId) { clearPendingEditNotes(); useEditNoteStore.setState({ silences: {}, fingerprint: '' }); return }
      if (state._externalMutationActive > 0) return
      const changedIds = state.nodes.filter(n => {
        const old = previous.nodes.find(o => o.id === n.id)
        return !old || JSON.stringify(old.data) !== JSON.stringify(n.data)
      }).map(n => n.id)
      const removed = previous.nodes.some(n => !state.nodes.some(s => s.id === n.id))
      const edgeChanged = JSON.stringify(state.edges.map(e => [e.id, e.source, e.target, e.data]))
        !== JSON.stringify(previous.edges.map(e => [e.id, e.source, e.target, e.data]))
      if (changedIds.length || removed || edgeChanged) {
        // Linking this new card is still work on that card, not an edit elsewhere.
        // Keep its click-away check alive while the add receipt is in flight.
        const changedEdgeEndpoints = edgeChanged ? [...state.edges, ...previous.edges].filter(edge => {
          const old = previous.edges.find(e => e.id === edge.id)
          const now = state.edges.find(e => e.id === edge.id)
          return JSON.stringify(old && [old.source, old.target, old.data]) !== JSON.stringify(now && [now.source, now.target, now.data])
        }).flatMap(edge => [edge.source, edge.target]) : []
        recordManualEditChange([...changedIds, ...changedEdgeEndpoints])
        const notes = useEditNoteStore.getState()
        const silences = { ...notes.silences }
        for (const key of Object.keys(silences)) if (changedIds.some(id => key.startsWith(`${id}\u0000`))) delete silences[key]
        useEditNoteStore.setState({ note: null, silences })
      }
      for (const record of state.pendingStructuralAdds) {
        if (!previous.pendingStructuralAdds.some(r => r.id === record.id)) watchAddedCard(record.nodeId)
      }
      for (const intent of state.pendingStructuralRenames) {
        const label = state.nodes.find(n => n.id === intent.nodeId)?.data.label
        // The native queue is written before the local label. Capture its epoch
        // only once that label has landed, not when the hash-delayed sender wakes.
        if (typeof label === 'string' && label.trim() === intent.label.trim()) watchRenameEdit(intent.id)
      }
    })
    const clickAway = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('[data-edit-note]')) return
      const node = target?.closest('.react-flow__node')
      const state = useCanvasStore.getState()
      clickAwayFromAddedCards(node?.getAttribute('data-id') ?? null, { nodes: state.nodes, edges: state.edges, options: state.ceeAnalysisReady?.options })
    }
    document.addEventListener('pointerdown', clickAway, true)
    return () => { unsubscribe(); document.removeEventListener('pointerdown', clickAway, true); clearPendingEditNotes() }
  }, [])
}
