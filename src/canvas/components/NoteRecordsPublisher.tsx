import { useEffect } from 'react'
import { useCanvasStore } from '../store'
import { useSavedGraph } from '../nodes/shared/savedGraph'
import { noteRecordsOf, sameNoteRecords, useNoteRecordsStore } from '../domain/noteRecords'

/**
 * Publishes the notes for the scenario on screen once its saved-graph read answers (`noteRecords.ts`). While a read is
 * pending (`null`) the scenario's last notes stay, so a refresh never blinks them. Renders nothing; moves nothing.
 */
export function NoteRecordsPublisher(): null {
  const savedGraph = useSavedGraph()
  const scenarioId = useCanvasStore((s) => s.currentScenarioId ?? null)
  const nodes = useCanvasStore((s) => s.nodes)
  useEffect(() => {
    const prev = useNoteRecordsStore.getState()
    if (savedGraph === null) {
      if (prev.scenarioId !== scenarioId) prev.publish(scenarioId, new Map())
      return
    }
    const next = noteRecordsOf(savedGraph, nodes)
    if (prev.scenarioId === scenarioId && sameNoteRecords(prev.records, next)) return
    prev.publish(scenarioId, next)
  }, [savedGraph, scenarioId, nodes])
  return null
}
