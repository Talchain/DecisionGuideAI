import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'
import { useSavedGraph } from '../nodes/shared/savedGraph'
import { noteRecordsOf, sameNoteRecords, useNoteRecordsStore } from '../domain/noteRecords'

/**
 * Publishes the notes for the scenario on screen (`noteRecords.ts`). While a new read is pending (`null`) the scenario's
 * last saved graph stands in, and the notes are always derived against the CURRENT cards, so a refresh never blinks them
 * and a record drawn as a card is never also a note. Renders nothing; moves nothing.
 */
export function NoteRecordsPublisher(): null {
  const read = useSavedGraph()
  const scenarioId = useCanvasStore((s) => s.currentScenarioId ?? null)
  const nodes = useCanvasStore((s) => s.nodes)
  const last = useRef<{ scenarioId: string | null; graph: unknown }>({ scenarioId: null, graph: null })
  useEffect(() => {
    if (read !== null) last.current = { scenarioId, graph: read }
    const savedGraph = read ?? (last.current.scenarioId === scenarioId ? last.current.graph : null)
    const next = noteRecordsOf(savedGraph, nodes)
    const prev = useNoteRecordsStore.getState()
    if (prev.scenarioId === scenarioId && sameNoteRecords(prev.records, next)) return
    prev.publish(scenarioId, next)
  }, [read, scenarioId, nodes])
  return null
}
