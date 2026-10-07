import { resolveGoalTarget } from '../domain/goalTarget'
import { unwrapInterventionValue } from '../utils/labelUtils'
import { reportManualEdit, useEditNoteStore } from './editNoteStore'
import type { EditGraph, EditNoteInput, LastRunSnapshot, ManualEdit } from './deriveEditNote'

let manualEditRevision = 0
const renameRevisions = new Map<string, number>()
export function currentManualEditRevision(): number { return manualEditRevision }
export function watchRenameEdit(intentId: string): void {
  if (!renameRevisions.has(intentId)) renameRevisions.set(intentId, manualEditRevision)
}
export function takeRenameEditRevision(intentId: string): number | undefined {
  const revision = renameRevisions.get(intentId)
  renameRevisions.delete(intentId)
  return revision
}
export function recordManualEditChange(elementIds: readonly string[]): void {
  manualEditRevision += 1
  for (const id of pendingAdds.keys()) if (!elementIds.includes(id)) { pendingAdds.delete(id); clickedAway.delete(id) }
}
const pendingAdds = new Map<string, EditNoteInput | null>()
const clickedAway = new Set<string>()
/** A new manual card is watched from creation, even if its receipt arrives after click-away. */
export function watchAddedCard(id: string): void { pendingAdds.set(id, null); clickedAway.delete(id) }
export function clickAwayFromAddedCards(insideId: string | null, after: EditGraph): void {
  for (const [id, input] of pendingAdds) {
    if (id === insideId) continue
    clickedAway.add(id)
    if (input) {
      pendingAdds.delete(id); clickedAway.delete(id)
      reportManualEdit({ ...input, after })
    }
  }
}
// Keep held rename epochs until their sender consumes them: clearing on Run would
// let an old queued gesture acquire a fresh epoch when the first hash arrives.
export function clearPendingEditNotes(): void { manualEditRevision += 1; pendingAdds.clear(); clickedAway.clear(); useEditNoteStore.getState().clear() }

/** Adapt only this canvas's typed manual events, after the existing receipt reconciliation. */
export function reportManualEditReceipt(input: {
  revision?: number
  event: { type: string; payload?: unknown }
  response: unknown
  before: EditGraph
  after: EditGraph
  lastRun?: LastRunSnapshot
}): void {
  const { event, before, after } = input
  const p = (event.payload ?? {}) as Record<string, unknown>
  if (p.intent === 'confirm_current') return
  if (p.applied_from !== undefined) { clearPendingEditNotes(); return }
  const kinds: readonly string[] = ['factor_value_edit', 'option_intervention_edit', 'goal_target_edit', 'edge_strength_edit', 'structural_delete', 'structural_add', 'structural_add_edge', 'structural_rename']
  if (!kinds.includes(event.type)) return
  const elementId = event.type === 'factor_value_edit' ? p.target_id
    : event.type === 'option_intervention_edit' ? p.option_id
      : event.type === 'goal_target_edit' ? p.goal_node_id
        : event.type === 'edge_strength_edit' ? (p.edge_id ?? before.edges.find(e => e.source === p.from && e.target === p.to)?.id)
          : event.type === 'structural_delete' ? (
            (Array.isArray(p.removed_node_ids) ? p.removed_node_ids.find(id => typeof id === 'string') : undefined)
            ?? (() => { const removed = Array.isArray(p.removed_edges) ? p.removed_edges[0] as Record<string, unknown> | undefined : undefined
              return before.edges.find(e => e.source === removed?.from && e.target === removed?.to)?.id })()
            ?? p.edge_id ?? p.node_id ?? p.target_id) : p.node_id
  if (event.type === 'structural_add_edge') {
    // The release already reported the unsized local link. This is its later committed counterpart,
    // including connected-add paths that do not go through a draw gesture.
    const edge = after.edges.find(e => e.source === p.from && e.target === p.to)
    if (!edge || (input.revision !== undefined && input.revision !== manualEditRevision)) return
    const rawEdges = (input.response as { draft_graph?: { edges?: unknown } } | null)?.draft_graph?.edges
    const accepted = Array.isArray(rawEdges) && rawEdges.some(e => (e.from ?? e.source) === p.from && (e.to ?? e.target) === p.to)
    reportManualEdit({ edit: { kind: 'structural_add_edge', elementId: edge.id, accepted }, before, after })
    return
  }
  if (typeof elementId !== 'string') return
  if (input.revision !== undefined && input.revision !== manualEditRevision
    && !(event.type === 'structural_add' && pendingAdds.has(elementId))) return
  const draft = (input.response as { draft_graph?: { nodes?: unknown; edges?: unknown } } | null)?.draft_graph
  const raw = draft?.nodes
  const receiptNode = Array.isArray(raw) ? raw.find(n => n?.id === elementId) as Record<string, unknown> | undefined : undefined
  const current = after.nodes.find(n => n.id === elementId)
  let accepted = false
  if (event.type === 'edge_strength_edit') {
    const receiptEdges = draft?.edges
    const receiptEdge = Array.isArray(receiptEdges) ? receiptEdges.find(e => e?.id === elementId || ((e?.from ?? e?.source) === p.from && (e?.to ?? e?.target) === p.to)) as Record<string, unknown> | undefined : undefined
    const currentEdge = after.edges.find(e => e.id === elementId)
    accepted = !!receiptEdge && !!currentEdge
  } else if (event.type === 'structural_delete') {
    accepted = !!draft && !after.nodes.some(n => n.id === elementId) && !after.edges.some(e => e.id === elementId)
      && !(Array.isArray(draft.nodes) && draft.nodes.some(n => n?.id === elementId))
      && !(Array.isArray(draft.edges) && draft.edges.some(e => e?.id === elementId))
  } else if (receiptNode && current) {
    const receiptData = (receiptNode.data ?? receiptNode) as Record<string, unknown>
    if (event.type === 'factor_value_edit') {
      const value = (receiptData.observed_state ?? receiptData.observedState) as { value?: unknown } | undefined
      const now = (current.data.observedState ?? current.data.observed_state) as { value?: unknown } | undefined
      accepted = typeof p.value === 'number' && value?.value === p.value && now?.value === p.value
    } else if (event.type === 'option_intervention_edit') {
      const factorId = String(p.factor_id ?? '')
      const settings = receiptData.interventions as Record<string, unknown> | undefined
      const now = current.data.interventions as Record<string, unknown> | undefined
      accepted = unwrapInterventionValue(settings?.[factorId]).value === p.value
        && unwrapInterventionValue(now?.[factorId]).value === p.value
    } else if (event.type === 'goal_target_edit') {
      accepted = Number(resolveGoalTarget(receiptData)?.raw) === p.raw_value
        && Number(resolveGoalTarget(current.data)?.raw) === p.raw_value
    } else if (event.type === 'structural_rename') {
      accepted = receiptData.label === p.label && current.data.label === p.label
    } else if (event.type === 'structural_add') accepted = true
  }
  const report: EditNoteInput = { edit: { kind: event.type as ManualEdit['kind'], elementId,
    accepted, factorId: typeof p.factor_id === 'string' ? p.factor_id : undefined,
    userFigure: event.type === 'edge_strength_edit' ? true : undefined }, before, after, lastRun: input.lastRun }
  if (event.type === 'structural_add') {
    if (!accepted) { pendingAdds.delete(elementId); clickedAway.delete(elementId); return }
    if (!clickedAway.has(elementId)) { pendingAdds.set(elementId, report); return }
    pendingAdds.delete(elementId); clickedAway.delete(elementId)
  }
  reportManualEdit(report)
}
