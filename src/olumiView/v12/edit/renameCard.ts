import type { ViewCard } from '../../client'
import { useViewStore } from '../../store'
import { editGateNow } from './editGate'
import { useLaneInspector } from './inspectorStore'

// Core's View labels cards through title_short (view/canvas-fields.ts:25–34).
// Older Views omit it, and the title producer deliberately omits process labels.
// In those cases use the same labelled families as Core's /rename (app/edits.ts:218–219, contract/form.ts).
const LABELLED = new Set(['quantity', 'goal', 'limit', 'option', 'process', 'risk'])
export function canRenameCard(card: ViewCard): boolean {
  if (card.title_short === undefined || card.family === 'process') return LABELLED.has(card.family)
  return card.title_short !== null
}

export function openRenameCard(id: string): boolean {
  const card = useViewStore.getState().view?.model?.cards.find((c) => c.id === id)
  if (card === undefined || !canRenameCard(card) || !editGateNow().ok) return false
  return useLaneInspector.getState().show({ kind: 'details', target: { kind: 'card', id }, edit: 'name' })
}
