import { beforeEach, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { EditNote, useEditNoteLifecycle } from '../EditNote'
import { CanvasEditNote } from '../../nodes/EditNoteAnchor'
import { useEditNoteStore, reportManualEdit } from '../editNoteStore'
import { reportManualEditReceipt, watchAddedCard, clickAwayFromAddedCards, clearPendingEditNotes, currentManualEditRevision, recordManualEditChange, takeRenameEditRevision } from '../reportManualEditReceipt'
import { InlineRerunPrompt } from '../../ui/inspector-v2/shared/InlineRerunPrompt'
import { FactorControllablePanel } from '../../ui/inspector-v2/panels/FactorControllablePanel'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { buildAskAiQuestion } from '../../conversation/askAi'
import { executeCanonicalRun, registerCanonicalRunner } from '../../analysis/canonicalRunRegistry'
import { runCanvasUndo } from '../../undo/undoCommand'
import type { EditGraph } from '../deriveEditNote'
const viewport = vi.hoisted(() => ({ zoom: 1 }))
vi.mock('@xyflow/react', async original => ({ ...(await original<Record<string, unknown>>()),
  ViewportPortal: ({ children }: { children: unknown }) => children,
  useStore: (selector: (state: unknown) => unknown) => selector({ transform: [0, 0, viewport.zoom], nodeLookup: new Map([
    ['f', { internals: { positionAbsolute: { x: 40, y: 60 } }, measured: { height: 160 } }],
  ]) }),
}))
vi.mock('../../conversation/revealOlumi', () => ({ revealOlumiSurface: vi.fn() }))
const nodes = [
  { id: 'f', type: 'factor', position: { x: 40, y: 60 }, data: { label: 'Developer Hires', category: 'controllable', observedState: { value: 0, unit: 'people', source: 'user' } } },
  { id: 'o', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Hire two developers', interventions: { f: 2 } } },
  { id: 'b', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Carry on as now', interventions: {} } },
  { id: 'g', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Launch' } },
]
const graph = (): EditGraph => ({ nodes: useCanvasStore.getState().nodes, edges: useCanvasStore.getState().edges })
const fireF1 = () => reportManualEdit({ edit: { kind: 'factor_value_edit', elementId: 'f', accepted: true }, before: graph(), after: graph() })
beforeEach(() => {
  viewport.zoom = 1
  clearPendingEditNotes(); useEditNoteStore.getState().reset()
  useCanvasStore.setState({ nodes: structuredClone(nodes), edges: [{ id: 'fg', source: 'f', target: 'g' }],
    selection: { nodeIds: new Set(['f']), edgeIds: new Set(), anchorPosition: null },
    ceeAnalysisReady: null, pendingStructuralAdds: [], pendingStructuralRenames: [], currentScenarioId: 'scenario',
    lastAuthoritativeGraph: null, lastServerGraphHash: null,
    hasCompletedFirstRun: false, results: { status: 'idle' }, v5AnalysisFact: null,
  } as never)
})
it('one canvas note pinned outside cards, with unchanged geometry', () => {
  fireF1(); const before = structuredClone(useCanvasStore.getState().nodes)
  const { container } = render(<CanvasEditNote inspectorOpen={false} />)
  expect(container.querySelectorAll('[data-edit-note="F1"]')).toHaveLength(1)
  const overlay = container.querySelector('[data-edit-note-surface="canvas"]') as HTMLElement
  expect(overlay.style.transform).toBe('translate(40px, 220px) scale(1)')
  expect(overlay.style.zIndex).toBe('1')
  expect(overlay.style.width).toBe('280px')
  expect(useCanvasStore.getState().nodes).toEqual(before)
})
it('S1 renders exact words with Run again as its primary button', () => {
  const before: EditGraph = { nodes: [...nodes], edges: [{ id: 'edge', source: 'f', target: 'g', data: { strength: 0.2 } }] }
  const after = structuredClone(before); after.edges[0].data!.strength = 0.7
  reportManualEdit({ edit: { kind: 'edge_strength_edit', elementId: 'edge', accepted: true }, before, after,
    lastRun: { visible: true, runId: 'run', drivers: { o: { kind: 'link_strength', from: 'f', to: 'g', strength: 'stronger', authoredBy: 'user', userStatedLink: true } } } })
  const { container } = render(<EditNote elementId="edge" />)
  const note = container.querySelector('[data-edit-note="S1"][data-edit-note-element="edge"]')!
  expect(note).toHaveTextContent('The chance for ‘Hire two developers’ rests most on this link, so this change could move it a lot. Run again to see.')
  expect(note.querySelector('button')?.textContent).toBe('Run again')
})
it('open inspector replaces rerun slot, even when the edit happened on the card', () => {
  fireF1()
  const { container } = render(<><CanvasEditNote inspectorOpen /><FactorControllablePanel nodeId="f" techMode={false} onClose={() => {}} onNavigate={() => {}} readOnly /></>)
  expect(container.querySelectorAll('[data-edit-note="F1"]')).toHaveLength(1)
  expect(container.querySelector('[data-edit-note-surface="canvas"]')).toBeNull()
  expect(container.querySelector('[data-testid="inline-rerun"]')).toBeNull()
  expect(screen.getByRole('button', { name: 'Discuss with Olumi' })).toBeEnabled()
})
it('slot takes priority over rerun and remains bound to the edited element', () => {
  fireF1(); const { container } = render(<><InlineRerunPrompt elementId="f" visible /><InlineRerunPrompt elementId="g" visible={false} /></>)
  expect(container.querySelectorAll('[data-edit-note]')).toHaveLength(1)
  expect(screen.queryByTestId('inline-rerun')).toBeNull()
})
it('Discuss goes through existing askAi with new intent and element id; no auto-send or figures', () => {
  const dispatch = vi.fn(); useGuidanceStore.setState({ _dispatchAction: dispatch, _isConversationBusy: () => false })
  fireF1(); render(<EditNote elementId="f" />)
  expect(dispatch).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Discuss with Olumi' }))
  expect(dispatch).toHaveBeenCalledWith({ id: 'ask:lever-today', source: 'chip',
    label: 'Should ‘Developer Hires’ be today’s value, or something the options change?',
    message: 'Should ‘Developer Hires’ be today’s value, or something the options change?' })
  const built = buildAskAiQuestion({ intent: 'lever-today', nodeIds: ['f'] })
  expect(built.nodeIds).toEqual(['f']); expect(built.question).not.toMatch(/\d/)
  expect(useEditNoteStore.getState().note).toBeNull()
})
it('connect/differentiate questions name their intended labels only', () => {
  expect(buildAskAiQuestion({ intent: 'connect', nodeIds: ['f'] }).question)
    .toBe('How does ‘Developer Hires’ affect this decision, and what should it link to?')
  const q = buildAskAiQuestion({ intent: 'differentiate', nodeIds: ['o', 'b'] }).question
  expect(q).toBe('How does ‘Hire two developers’ differ from ‘Carry on as now’ in practice, and what should each change in the model?')
  expect(q).not.toMatch(/\d/)
})
it('Run and Undo clear note, through the existing entry points', async () => {
  const runner = vi.fn(async () => ({ status: 'dispatched' as const })); const unregister = registerCanonicalRunner(runner)
  fireF1(); await executeCanonicalRun(); expect(useEditNoteStore.getState().note).toBeNull(); expect(runner).toHaveBeenCalledOnce()
  unregister(); fireF1(); await runCanvasUndo('undo'); expect(useEditNoteStore.getState().note).toBeNull()
})
it('choosing Run interrupts consecutive Keeps', async () => {
  const unregister = registerCanonicalRunner(async () => ({ status: 'dispatched' as const }))
  useEditNoteStore.setState({ consecutiveKeeps: 2 })
  const before = graph(), after = structuredClone(before)
  after.nodes.find(n => n.id === 'g')!.data.goal_threshold_raw = 10
  reportManualEdit({ edit: { kind: 'goal_target_edit', elementId: 'g', accepted: true }, before, after })
  render(<EditNote elementId="g" />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Run' })))
  expect(useEditNoteStore.getState().consecutiveKeeps).toBe(0)
  expect(useEditNoteStore.getState().fatigued).toBe(false)
  unregister()
})
it('Keep it clears the mounted note and three Keeps suppress further F1 surfaces', () => {
  fireF1(); const { container } = render(<EditNote elementId="f" />)
  for (let i = 0; i < 3; i++) {
    if (i) act(() => {
      const changed = graph(); const next = structuredClone(changed)
      next.nodes[0].data.observedState = { value: i }
      reportManualEdit({ edit: { kind: 'factor_value_edit', elementId: 'f', accepted: true }, before: changed, after: next })
    })
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(container.querySelector('[data-edit-note]')).toBeNull()
  }
  act(fireF1); expect(container.querySelector('[data-edit-note]')).toBeNull()
})
it('receipt gating: applied factor surfaces only after landing, refused reply never does', () => {
  const before = graph(); const event = { type: 'factor_value_edit', payload: { target_id: 'f', value: 2 } }
  reportManualEditReceipt({ event, response: { assistant_text: 'Not saved' }, before, after: graph() })
  expect(useEditNoteStore.getState().note).toBeNull()
  const after = structuredClone(before); after.nodes[0].data.observedState = { value: 2 }
  const response = { draft_graph: { nodes: [{ id: 'f', observed_state: { value: 2 } }] } }
  reportManualEditReceipt({ event, response, before, after: before })
  expect(useEditNoteStore.getState().note).toBeNull()
  reportManualEditReceipt({ event, response, before, after })
  expect(useEditNoteStore.getState().note).toMatchObject({ check: 'F1', elementId: 'f' })
})
it('new card waits for click-away, including click-away before its receipt; connected twin is quiet', () => {
  const before = graph(); const after = structuredClone(before)
  after.nodes.push({ id: 'c', type: 'factor', data: { label: 'Contractor hours' } })
  const input = { event: { type: 'structural_add', payload: { node_id: 'c' } }, response: { draft_graph: { nodes: [{ id: 'c', kind: 'factor', label: 'Contractor hours' }] } }, before, after }
  watchAddedCard('c'); reportManualEditReceipt(input)
  expect(useEditNoteStore.getState().note).toBeNull()
  clickAwayFromAddedCards('c', after); expect(useEditNoteStore.getState().note).toBeNull()
  clickAwayFromAddedCards(null, after); expect(useEditNoteStore.getState().note?.check).toBe('A1')
  clearPendingEditNotes(); watchAddedCard('c'); clickAwayFromAddedCards(null, after); reportManualEditReceipt(input)
  expect(useEditNoteStore.getState().note?.check).toBe('A1')
  clearPendingEditNotes(); watchAddedCard('c'); reportManualEditReceipt(input)
  after.edges.push({ id: 'cg', source: 'c', target: 'g' })
  clickAwayFromAddedCards(null, after); expect(useEditNoteStore.getState().note).toBeNull()
})
it('no proposal receipt can produce a note; only manual typed edit kinds are accepted', () => {
  reportManualEditReceipt({ event: { type: 'accept_proposal' }, response: {}, before: graph(), after: graph() })
  expect(useEditNoteStore.getState().note).toBeNull()
})
it('linking a new card before its receipt preserves its click-away check', () => {
  const Lifecycle = () => { useEditNoteLifecycle(); return null }
  render(<Lifecycle />)
  const before = graph()
  act(() => useCanvasStore.setState({ nodes: [...useCanvasStore.getState().nodes,
    { id: 'c', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Contractor hours' } }],
  } as never))
  watchAddedCard('c')
  const revision = currentManualEditRevision()
  act(() => useCanvasStore.setState({ edges: [...useCanvasStore.getState().edges,
    { id: 'cb', source: 'c', target: 'b' }],
  } as never))
  reportManualEditReceipt({ revision, event: { type: 'structural_add', payload: { node_id: 'c' } },
    response: { draft_graph: { nodes: [{ id: 'c', kind: 'factor', label: 'Contractor hours' }] } }, before, after: graph() })
  expect(useEditNoteStore.getState().note).toBeNull()
  clickAwayFromAddedCards(null, graph())
  expect(useEditNoteStore.getState().note).toMatchObject({ check: 'A2', elementId: 'c',
    words: '‘Contractor hours’ doesn’t reach ‘Launch’ yet, so it can’t change any option’s chance.' })
})
it('next manual edit anywhere clears the note; layout changes and selection do not', () => {
  const Lifecycle = () => { useEditNoteLifecycle(); return null }
  render(<Lifecycle />); act(fireF1)
  act(() => useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map(n => ({ ...n, position: { x: 90, y: 90 } })) }))
  expect(useEditNoteStore.getState().note?.check).toBe('F1')
  act(() => useCanvasStore.getState().selectNodeWithoutHistory('g'))
  expect(useEditNoteStore.getState().note?.check).toBe('F1')
  act(() => useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map(n => n.id === 'g' ? { ...n, data: { ...n.data, label: 'New goal' } } : n) }))
  expect(useEditNoteStore.getState().note).toBeNull()
})
it('fatigue persists across scenario changes for the session', () => {
  const Lifecycle = () => { useEditNoteLifecycle(); return null }
  render(<Lifecycle />)
  act(() => useEditNoteStore.setState({ fatigued: true, consecutiveKeeps: 3 }))
  act(() => useCanvasStore.setState({ currentScenarioId: 'different-scenario' }))
  expect(useEditNoteStore.getState().fatigued).toBe(true)
  act(fireF1); expect(useEditNoteStore.getState().note).toBeNull()
})
it('a late receipt after an edit elsewhere or Run cannot resurrect a note', () => {
  const before = graph(); const after = structuredClone(before); after.nodes[0].data.observedState = { value: 2 }
  const revision = currentManualEditRevision()
  recordManualEditChange(['g'])
  reportManualEditReceipt({ revision, event: { type: 'factor_value_edit', payload: { target_id: 'f', value: 2 } },
    response: { draft_graph: { nodes: [{ id: 'f', observed_state: { value: 2 } }] } }, before, after })
  expect(useEditNoteStore.getState().note).toBeNull()
})
it.each(['another edit', 'Run'])('a rename held for a server hash cannot surface after %s', action => {
  const Lifecycle = () => { useEditNoteLifecycle(); return null }
  render(<Lifecycle />)
  const before = graph()
  act(() => useCanvasStore.getState().updateNodeLabel('f', 'Carry on as now'))
  const intent = useCanvasStore.getState().pendingStructuralRenames.at(-1)!
  expect(intent.nodeId).toBe('f')
  if (action === 'Run') clearPendingEditNotes()
  else act(() => useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map(n =>
    n.id === 'g' ? { ...n, data: { ...n.data, label: 'Next launch' } } : n),
  }))
  // This is the sender's original-gesture lookup, after the held queue can finally drain.
  const revision = takeRenameEditRevision(intent.id) ?? currentManualEditRevision()
  reportManualEditReceipt({ revision, event: { type: 'structural_rename', payload: { node_id: 'f', label: 'Carry on as now' } },
    response: { draft_graph: { nodes: [{ id: 'f', kind: 'factor', label: 'Carry on as now' }] } }, before, after: graph() })
  expect(useEditNoteStore.getState().note).toBeNull()
})
it('an unrequested confirmation is not a value edit note', () => {
  reportManualEditReceipt({ event: { type: 'factor_value_edit', payload: { target_id: 'f', value: 0, intent: 'confirm_current' } },
    response: { draft_graph: { nodes: [{ id: 'f', observed_state: { value: 0 } }] } }, before: graph(), after: graph() })
  expect(useEditNoteStore.getState().note).toBeNull()
})
it('canvas note keeps its 280px screen width at the fitted zoom without entering layout', () => {
  viewport.zoom = 0.5; fireF1()
  const before = structuredClone(useCanvasStore.getState().nodes)
  const { container } = render(<CanvasEditNote inspectorOpen={false} />)
  const overlay = container.querySelector('[data-edit-note-surface="canvas"]') as HTMLElement
  expect(overlay.style.transform).toBe('translate(40px, 220px) scale(2)')
  expect(overlay.style.width).toBe('280px')
  expect(useCanvasStore.getState().nodes).toEqual(before)
})
it('applied-from proposal acceptance never shows a manual note, even with an applied factor receipt', () => {
  fireF1() // An earlier manual note must not survive an approved change to this card.
  const before = graph(); const after = structuredClone(before); after.nodes[0].data.observedState = { value: 2 }
  reportManualEditReceipt({ event: { type: 'factor_value_edit', payload: { target_id: 'f', value: 2,
    applied_from: { round_id: 'proposal-round', participant_id: 'author' } } },
    response: { draft_graph: { nodes: [{ id: 'f', observed_state: { value: 2 } }] } }, before, after })
  expect(useEditNoteStore.getState().note).toBeNull()
})
