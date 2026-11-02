import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Edge, Node } from '@xyflow/react'
import { useCanvasStore } from '../../canvas/store'
import { PresentationProvider } from '../v10'
import { V10ChangeMarks } from '../V10ChangeLens'

// The lens flag is on where lenses are offered; the rest of flags stays real.
vi.mock('../../flags', async () => ({ ...await vi.importActual<object>('../../flags'), isGraphLensEnabled: () => true }))

const SENTENCE = 'Its chance falls to about 12% when Extra books stays low.'
// CEE's served driver words for one option only; the other has none. The badge must say them verbatim, or nothing.
vi.mock('../../canvas/runView/runView', async () => ({
  ...await vi.importActual<object>('../../canvas/runView/runView'),
  runViewOf: () => ({ mainDriverDetailOf: (id: string) => (id === 'opt-a' ? SENTENCE : null) }),
}))

const UNCHECKED = { observedState: { value: 0.5, source: 'cee_inference', extractionType: 'inferred' } }
const node = (id: string, type: string, data: Record<string, unknown> = {}): Node => ({ id, type, position: { x: 0, y: 0 }, data: { label: id, ...data } })
const edge = (id: string, source: string, target: string): Edge => ({ id, source, target, data: {} })
const NODES = [node('f-fragile', 'factor', UNCHECKED), node('f-big', 'factor', UNCHECKED), node('opt-a', 'option'), node('opt-b', 'option'), node('g', 'goal')]
const EDGES = [edge('e1', 'f-fragile', 'g'), edge('e2', 'f-big', 'g')]
// f-big moves the Run most and is Olumi's, unchecked; e1 is fragile. Neither may put anything on a figure card.
const REPORT = { enrichment: { sensitivity_analysis: { factors: [{ factor_id: 'f-big', elasticity: 0.8 }, { factor_id: 'f-fragile', elasticity: 0.5 }] } } }

function seed(active: 'what_changes' | 'full', lodRung: string = 'full') {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    nodes: NODES, edges: EDGES, outcomeNodeId: 'g', lodRung,
    results: { ...state.results, status: 'complete', report: REPORT as never },
    lens: { ...state.lens, active, _fragileEdgeIds: new Set(['e1']) },
  } as never)
}
function mount(id: string, type: string, presentation: 'v10' | 'current' = 'v10') {
  return render(<MemoryRouter><PresentationProvider value={presentation}><V10ChangeMarks nodeId={id} nodeType={type} /></PresentationProvider></MemoryRouter>)
}
const before = useCanvasStore.getState()
beforeEach(() => seed('what_changes'))
afterEach(() => { cleanup(); useCanvasStore.setState({ nodes: before.nodes, edges: before.edges, results: before.results, lens: before.lens, outcomeNodeId: before.outcomeNodeId, lodRung: before.lodRung } as never) })

describe('v10 "What would change": the option driver badge', () => {
  it('rests as an icon only; CEE\'s sentence arrives verbatim on hover (described by, not labelled), and never as default text', async () => {
    mount('opt-a', 'option')
    const badge = screen.getByTestId('v10-change-driver-opt-a')
    expect(badge.textContent, 'no words at rest').toBe('')
    expect(document.body.textContent).not.toContain(SENTENCE)
    expect(badge.getAttribute('aria-label')).toBe('Its main driver')
    await act(async () => { fireEvent.mouseEnter(badge) })
    const said = await screen.findByText(SENTENCE, {}, { timeout: 2000 })
    expect(said.textContent).toBe(SENTENCE)
    const disclosure = said.closest('[role="tooltip"]') as HTMLElement
    expect(badge.getAttribute('aria-describedby'), 'the tooltip describes the badge').toBe(disclosure.id)
  })

  it('the disclosure carries Olumi\'s own mark beside the verbatim sentence, never a sparkle (the AI wrote it)', async () => {
    mount('opt-a', 'option')
    await act(async () => { fireEvent.mouseEnter(screen.getByTestId('v10-change-driver-opt-a')) })
    const disclosure = (await screen.findByText(SENTENCE, {}, { timeout: 2000 })).closest('[role="tooltip"]') as HTMLElement
    expect(disclosure.querySelector('svg[data-icon="olumi-ai"]'), 'the Olumi mark').not.toBeNull()
    expect(disclosure.querySelector('.lucide-sparkles')).toBeNull()
  })

  it('an option CEE served no sentence for draws nothing', () => {
    mount('opt-b', 'option')
    expect(screen.queryByTestId('v10-change-driver-opt-b')).toBeNull()
  })

  it('draws nothing at the line rung, where the card\'s own marks drop', () => {
    seed('what_changes', 'line')
    mount('opt-a', 'option')
    expect(screen.queryByTestId('v10-change-driver-opt-a')).toBeNull()
  })

  it('draws nothing in the current design, or in another lens', () => {
    mount('opt-a', 'option', 'current'); expect(screen.queryByTestId('v10-change-driver-opt-a')).toBeNull(); cleanup()
    seed('full')
    mount('opt-a', 'option'); expect(screen.queryByTestId('v10-change-driver-opt-a')).toBeNull()
  })
})

describe('v10 "What would change": nothing on figure cards', () => {
  it('a fragile figure and the figure the Run moves most with carry no chip and no "worth finding out" words', () => {
    for (const id of ['f-fragile', 'f-big']) {
      const { container, unmount } = mount(id, 'factor')
      expect(container.querySelector('[data-testid^="v10-change-"]'), id).toBeNull()
      expect(document.body.textContent).not.toMatch(/worth finding out|can change the comparison/)
      unmount()
    }
  })
})
