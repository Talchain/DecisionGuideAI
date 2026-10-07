import { beforeEach, expect, it } from 'vitest'
import { useEditNoteStore, reportManualEdit } from '../editNoteStore'
import type { EditGraph, ManualEdit } from '../deriveEditNote'
const graph: EditGraph = { nodes: [
  { id: 'f', type: 'factor', data: { label: 'Developer Hires' } },
  { id: 'o', type: 'option', data: { label: 'Hire developers', interventions: { f: 2 } } },
  { id: 'g', type: 'goal', data: { label: 'Launch' } },
], edges: [] }
const edit: ManualEdit = { kind: 'factor_value_edit', elementId: 'f', accepted: true }
const report = (e = edit, after = graph) => reportManualEdit({ edit: e, before: graph, after })
beforeEach(() => useEditNoteStore.getState().reset())
it('two edits leave one note, including a quiet edit elsewhere', () => {
  report(); expect(useEditNoteStore.getState().note?.check).toBe('F1')
  report({ kind: 'structural_rename', elementId: 'o', accepted: true })
  expect(useEditNoteStore.getState().note).toBeNull()
  report(); report(); expect(useEditNoteStore.getState().note?.elementId).toBe('f')
})
it('Keep it silences this check and element until an actual change re-arms it', () => {
  report(); useEditNoteStore.getState().keep()
  report(); expect(useEditNoteStore.getState().note).toBeNull()
  const changed = structuredClone(graph); changed.nodes[0].data.observed_state = { value: 2 }
  report(edit, changed); expect(useEditNoteStore.getState().note?.check).toBe('F1')
})
it('three consecutive Keeps suppress T2/T4 for the rest of the session, T1 survives', () => {
  for (let i = 0; i < 3; i++) {
    const changed = structuredClone(graph); changed.nodes[0].data.observed_state = { value: i }
    report(edit, changed); useEditNoteStore.getState().keep()
  }
  report(); expect(useEditNoteStore.getState().note).toBeNull()
  report({ kind: 'structural_add', elementId: 'f', accepted: true })
  expect(useEditNoteStore.getState().note?.tier).toBe('T1')
  useEditNoteStore.getState().acted(); report()
  expect(useEditNoteStore.getState().note).toBeNull()
})
it('a non-Keep action resets the consecutive counter before fatigue locks', () => {
  report(); useEditNoteStore.getState().keep(); useEditNoteStore.getState().acted()
  expect(useEditNoteStore.getState().consecutiveKeeps).toBe(0)
})
it('refused edits and proposals never show a note', () => {
  report({ ...edit, accepted: false }); expect(useEditNoteStore.getState().note).toBeNull()
  report({ ...edit, origin: 'proposal' }); expect(useEditNoteStore.getState().note).toBeNull()
})
