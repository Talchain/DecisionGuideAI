import { useEffect } from 'react'
import { useCanvasStore } from '../canvas/store'
import { requestOlumiAttention } from '../canvas/utils/olumiAttention'
import { focusAssistantTarget } from '../canvas/utils/assistantFocusCamera'
import { isOlumiCoreLane } from './lane'
import { markNoteShown, useReloadNoteStore } from './reloadNote'

/** The cards Olumi's pointer (focus halo and camera) can land on (`applyCoreTurn.ts`'s POINTER_KINDS). */
const POINTER_KINDS = new Set(['factor', 'option', 'goal', 'risk', 'outcome'])
const NOTE_KINDS = new Set([...POINTER_KINDS, 'constraint'])

/**
 * Applies the note a reload brought back (`reloadNote.ts`) the moment its card is on the canvas, exactly as a live turn's note is
 * applied: held beside the card, with the assistant focus on it. Renders nothing. Off the olumi-core lane it does nothing.
 */
export function ReloadNoteApplier(): null {
  const offer = useReloadNoteStore((s) => s.offer)
  const scenarioId = useCanvasStore((s) => s.currentScenarioId ?? null)
  const nodes = useCanvasStore((s) => s.nodes)
  useEffect(() => {
    if (!offer || !isOlumiCoreLane() || offer.scenarioId !== scenarioId) return
    const card = nodes.find((n) => n.id === offer.note.element_id)
    const kind = typeof card?.type === 'string' ? card.type : null
    const label = (card?.data as { label?: unknown } | undefined)?.label
    if (!card || kind === null || !NOTE_KINDS.has(kind)) return
    requestOlumiAttention({ nodeIds: [card.id], edgeIds: [], note: { body: offer.note.text.trim() }, ...(offer.revision ? { modelVersion: offer.revision } : {}) })
    if (POINTER_KINDS.has(kind) && typeof label === 'string' && label !== '') focusAssistantTarget({ id: card.id, kind: 'node', label, scenarioId })
    markNoteShown(offer.note)
    useReloadNoteStore.getState().set(null)
  }, [offer, scenarioId, nodes])
  return null
}
