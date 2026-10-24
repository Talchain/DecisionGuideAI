import { useEffect, useMemo } from 'react'
import { useCanvasStore } from '../store'
import { useSavedGraph } from '../nodes/shared/savedGraph'
import { noteRecordsOf, sameNoteRecords, useNoteRecordsStore } from '../domain/noteRecords'

/**
 * Publishes the notes for the scenario on screen once the saved-graph read answers (`noteRecords.ts`), and re-lays the
 * board out once when the set of notes changes, so the cards close up where the note cards were. Renders nothing.
 */
export function NoteRecordsPublisher(): null {
  const savedGraph = useSavedGraph()
  const scenarioId = useCanvasStore((s) => s.currentScenarioId ?? null)
  const nodes = useCanvasStore((s) => s.nodes)
  const nodeIdsKey = useMemo(() => nodes.map((n) => n.id).sort().join('\u0000'), [nodes])
  useEffect(() => {
    const ids = new Set(nodeIdsKey.length > 0 ? nodeIdsKey.split('\u0000') : [])
    const next = noteRecordsOf(savedGraph, ids)
    const prev = useNoteRecordsStore.getState()
    if (prev.scenarioId === scenarioId && sameNoteRecords(prev.records, next)) return
    const idsChanged = prev.records.size !== next.size || [...next.keys()].some((id) => !prev.records.has(id))
    prev.publish(scenarioId, next)
    // A note card was drawn (or a drawn card became a note): lay the board out again without it.
    if (idsChanged && (next.size > 0 || prev.records.size > 0)) useCanvasStore.getState().setPendingLayout?.(true)
  }, [savedGraph, scenarioId, nodeIdsKey])
  return null
}
