import { beforeEach, expect, it } from 'vitest'
import { reportManualEditReceipt, clearPendingEditNotes } from '../reportManualEditReceipt'
import { useEditNoteStore } from '../editNoteStore'
import type { EditGraph } from '../deriveEditNote'

// SELF-AUTHORED: the canvas edge shape (`strength_mean`, `direction`) and CEE's committed `draft_graph` link shape
// (`from`/`to`, `strength.mean`, `effect_direction`). A note needs the COMMITTED link to carry what was asked.
const graph = (mean: number): EditGraph => ({
  nodes: [
    { id: 'a', type: 'factor', data: { label: 'Demand' } },
    { id: 'b', type: 'goal', data: { label: 'Growth' } },
    { id: 'o', type: 'option', data: { label: 'Launch', interventions: {} } },
  ],
  edges: [{ id: 'ab', source: 'a', target: 'b', data: { strength_mean: mean, direction: 'positive' } }],
})
const lastRun = { visible: true, runId: 'run-1',
  drivers: { o: { kind: 'link_strength' as const, from: 'a', to: 'b', strength: 'stronger' as const, authoredBy: 'user' as const, userStatedLink: true } } }
const send = (committedMean: number, after: EditGraph) => reportManualEditReceipt({
  event: { type: 'edge_strength_edit', payload: { from: 'a', to: 'b', magnitude: 0.55, direction_intent: 'preserve' } },
  response: { draft_graph: { nodes: [], edges: [{ from: 'a', to: 'b', strength: { mean: committedMean }, effect_direction: 'positive' }] } },
  before: graph(0.3), after, lastRun,
})

beforeEach(() => { clearPendingEditNotes(); useEditNoteStore.getState().reset() })

it('a committed resize of the driver link earns S1', () => {
  send(0.55, graph(0.55))
  expect(useEditNoteStore.getState().note).toMatchObject({ check: 'S1', elementId: 'ab' })
})
it('a refused edit earns no note: the canvas shows the new size, CEE\'s committed link keeps the old one', () => {
  send(0.3, graph(0.55))
  expect(useEditNoteStore.getState().note).toBeNull()
})
