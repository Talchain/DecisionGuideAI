import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Edge, Node } from '@xyflow/react'
import { useCanvasStore } from '../../canvas/store'
import { PresentationProvider } from '../v10'
import { V10ChangeMarks, v10ChangeMarkIds } from '../V10ChangeLens'

// The lens flag is on where lenses are offered; the rest of flags stays real.
vi.mock('../../flags', async () => ({ ...await vi.importActual<object>('../../flags'), isGraphLensEnabled: () => true }))

// CEE's served driver words for one option only; the other has none. The badge must say them verbatim, or nothing.
vi.mock('../../canvas/runView/runView', async () => ({
  ...await vi.importActual<object>('../../canvas/runView/runView'),
  runViewOf: () => ({ mainDriverDetailOf: (id: string) => (id === 'opt-a' ? 'Its chance falls to about 12% when Extra books stays low.' : null) }),
}))

const UNCHECKED = { observedState: { value: 0.5, source: 'cee_inference', extractionType: 'inferred' } }
const YOURS = { observedState: { value: 0.7, source: 'user_override' } }
const node = (id: string, type: string, data: Record<string, unknown> = {}): Node => ({ id, type, position: { x: 0, y: 0 }, data: { label: id, ...data } })
const edge = (id: string, source: string, target: string): Edge => ({ id, source, target, data: {} })

// f-big: Olumi's, unchecked, moves the Run most. f-mine: the person's own, moves it more (never "worth finding out").
// f-small: Olumi's, unchecked, moves it least. f-fragile: Olumi's, unchecked, has a fragile link, moves it second.
const NODES = [node('f-big', 'factor', UNCHECKED), node('f-mine', 'factor', YOURS), node('f-small', 'factor', UNCHECKED), node('f-fragile', 'factor', UNCHECKED), node('opt-a', 'option'), node('opt-b', 'option'), node('g', 'goal')]
const EDGES = [edge('e1', 'f-big', 'g'), edge('e2', 'f-mine', 'g'), edge('e3', 'f-small', 'g'), edge('e4', 'f-fragile', 'g')]
const REPORT = {
  enrichment: { sensitivity_analysis: { factors: [
    { factor_id: 'f-mine', elasticity: 0.9 }, { factor_id: 'f-big', elasticity: 0.8 }, { factor_id: 'f-fragile', elasticity: 0.5 }, { factor_id: 'f-small', elasticity: 0.1 },
  ] } },
}

function seed(active: 'what_changes' | 'full', fragile: string[] = ['e4']) {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    nodes: NODES, edges: EDGES, outcomeNodeId: 'g',
    results: { ...state.results, status: 'complete', report: REPORT as never },
    lens: { ...state.lens, active, _fragileEdgeIds: new Set(fragile) },
  } as never)
}
function mount(id: string, type: string, presentation: 'v10' | 'current' = 'v10') {
  return render(<MemoryRouter><PresentationProvider value={presentation}><V10ChangeMarks nodeId={id} nodeType={type} /></PresentationProvider></MemoryRouter>)
}
const before = useCanvasStore.getState()
beforeEach(() => seed('what_changes'))
afterEach(() => { cleanup(); useCanvasStore.setState({ nodes: before.nodes, edges: before.edges, results: before.results, lens: before.lens, outcomeNodeId: before.outcomeNodeId } as never) })

describe('v10 "What would change": marks on the cards', () => {
  it('marks the lens\'s own fragile figure, and the one unchecked figure the Run moves most with (never the person\'s own)', () => {
    const ids = v10ChangeMarkIds(useCanvasStore.getState() as never)
    expect([...ids.canChange]).toEqual(['f-fragile'])
    expect(ids.worth, 'f-mine moves it most but is the person\'s own, so it is not worth finding out').toBe('f-big')
  })

  it('draws the marks on the right cards and no others', () => {
    mount('f-fragile', 'factor')
    expect(screen.getByTestId('v10-change-flip-f-fragile').textContent).toBe('can change the comparison')
    expect(screen.queryByTestId('v10-change-worth-f-fragile')).toBeNull()
    cleanup()
    mount('f-big', 'factor')
    expect(screen.getByTestId('v10-change-worth-f-big').textContent).toBe('worth finding out')
    cleanup()
    // CONTRAST: the person's own figure and a small mover carry nothing.
    for (const id of ['f-mine', 'f-small']) { const { unmount } = mount(id, 'factor'); expect(screen.queryByTestId(`v10-change-worth-${id}`)).toBeNull(); expect(screen.queryByTestId(`v10-change-flip-${id}`)).toBeNull(); unmount() }
  })

  it('an option card gets a driver badge saying CEE\'s own words verbatim; one with none served draws nothing', () => {
    mount('opt-a', 'option')
    expect(screen.getByTestId('v10-change-driver-opt-a').getAttribute('aria-label')).toBe('Its main driver: Its chance falls to about 12% when Extra books stays low.')
    cleanup()
    mount('opt-b', 'option')
    expect(screen.queryByTestId('v10-change-driver-opt-b')).toBeNull()
  })

  it('draws nothing in the current design, in another lens, or on a goal card', () => {
    mount('f-fragile', 'factor', 'current'); expect(screen.queryByTestId('v10-change-flip-f-fragile')).toBeNull(); cleanup()
    mount('opt-a', 'option', 'current'); expect(screen.queryByTestId('v10-change-driver-opt-a')).toBeNull(); cleanup()
    seed('full')
    mount('f-fragile', 'factor'); expect(screen.queryByTestId('v10-change-flip-f-fragile')).toBeNull(); cleanup()
    seed('what_changes')
    mount('g', 'goal'); expect(document.body.querySelector('[data-testid^="v10-change-"]')).toBeNull()
  })
})
