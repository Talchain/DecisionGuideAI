/** The canvas's reader of Olumi's notes (`noteRecordsModel.ts` holds the derivation and the published store). */
import { useCanvasStore } from '../store'
import { useNoteRecordsStore, type NoteRecord } from './noteRecordsModel'

export * from './noteRecordsModel'

const EMPTY: ReadonlyMap<string, NoteRecord> = new Map()

/** The notes for the scenario on screen; another scenario's are never shown, even before its own read answers. */
export function useNoteRecords(): ReadonlyMap<string, NoteRecord> {
  const scenarioId = useCanvasStore((s) => s.currentScenarioId ?? null)
  const { scenarioId: of, records } = useNoteRecordsStore()
  return of === scenarioId ? records : EMPTY
}
