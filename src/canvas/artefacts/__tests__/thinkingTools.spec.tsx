/**
 * The thinking tools as one instrument with the model (Paul, 18 Oct 2026: "much more beautiful, premium … interactive";
 * "it needs to easily switch between them"). The rail beside the dock, one-press switching, the figure the user sets
 * lit until seen, picking in both directions, and acting only through the model's own controls. Class rows, each with
 * its contrast.
 */
import { describe, it, afterEach, beforeEach, vi } from 'vitest'
import assert from 'node:assert/strict'
import { render, fireEvent, cleanup, act } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'
import fixture from '../../../../e2e/geometry/fixtures/mrr-17d1cd3a.fixture.json'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { OPEN_FULL_INSPECTOR_EVENT } from '../../utils/openEdgeStrengthEditor'
import { ArtefactColumn } from '../ArtefactColumn'
import { useArtefactStore } from '../artefactStore'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { setViewerScenario, __resetViewerModeForTests } from '../../../lib/viewerMode'

type Data = Record<string, unknown>
type WireEdge = Record<string, unknown> & { from: string; to: string }
const WIRE = (fixture as unknown as { draft: { edges: WireEdge[] } }).draft.edges
const served = (from: string, to: string): Data => {
  const i = WIRE.findIndex((w) => w.from === from && w.to === to)
  assert.ok(i >= 0, `${from} → ${to} is in the fixture`)
  return mapDraftEdgeToCanvas({ ...WIRE[i] }, i).data as Data
}

const SCENARIO = 'scn-thinking-tools'
const OLUMI_VALUE = { observedState: { value: 0.5, source: 'cee_inference', extractionType: 'inferred' } }
const USER_VALUE = { observedState: { value: 0.7, source: 'user_override' } }
const node = (id: string, type: string, data: Data = {}): Node => ({ id, type, position: { x: 0, y: 0 }, data: { label: id, ...data } })
const edge = (id: string, source: string, target: string, data: Data): Edge => ({ id, source, target, data })

/** f1 is Olumi's estimate (not yet checked), f2 the user's own; e1 has no strength yet, e2 is Olumi's estimate. */
const seedModel = (f1: Data = OLUMI_VALUE) => useCanvasStore.setState({
  currentScenarioId: SCENARIO,
  outcomeNodeId: 'g',
  ceeAnalysisReady: null,
  nodes: [node('f1', 'factor', f1), node('f2', 'factor', USER_VALUE), node('g', 'goal')],
  edges: [edge('e1', 'f1', 'g', served('pro_plan_price', 'mrr')), edge('e2', 'f2', 'g', served('pro_plan_price', 'monthly_new_pro_subscribers'))],
  selection: { nodeIds: new Set<string>(), edgeIds: new Set<string>(), anchorPosition: null },
} as never)

const columnOf = (view: ReturnType<typeof render>, id: string) =>
  view.container.querySelector(`[data-testid="assumption-map-mark"][data-target="${id}"]`)?.getAttribute('data-column')

beforeEach(() => {
  try { localStorage.clear() } catch { /* none */ }
  useArtefactStore.setState({ open: null, picked: null, settled: [], scenarioId: null })
  useGuidanceStore.setState({ _dispatchAction: () => {}, _isConversationBusy: () => false } as never)
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); __resetViewerModeForTests() })

describe('the tool rail', () => {
  it('stands beside the model with every tool; one press opens, another switches, the same one closes', () => {
    seedModel()
    const view = render(<ArtefactColumn isStale={false} isBusy={false} />)
    assert.deepEqual(view.getAllByRole('tab').map((t) => t.getAttribute('data-testid')), ['artefact-rail-assumptions', 'artefact-rail-premortem'])
    assert.equal(view.queryByTestId('artefact-column'), null, 'nothing is open until the user presses')
    assert.equal(view.getByTestId('artefact-rail-assumptions-count').textContent, '3', 'three figures are not yet the user\'s')

    fireEvent.click(view.getByTestId('artefact-rail-assumptions'))
    assert.equal(view.getByTestId('artefact-column').getAttribute('data-artefact'), 'assumptions')
    fireEvent.click(view.getByTestId('artefact-rail-premortem'))
    assert.equal(view.getByTestId('artefact-column').getAttribute('data-artefact'), 'premortem', 'one press switches')
    assert.ok(view.getByTestId('premortem-not-yet'), 'with no worksheet yet, the tool says what it is and how to ask for it')
    fireEvent.click(view.getByTestId('artefact-rail-premortem'))
    assert.equal(view.queryByTestId('artefact-column'), null, 'the same press again closes it')
  })

  it('CONTRAST: an empty canvas shows no rail; an overlay panel hides it', () => {
    useCanvasStore.setState({ currentScenarioId: SCENARIO, nodes: [], edges: [] } as never)
    const empty = render(<ArtefactColumn isStale={false} isBusy={false} />)
    assert.equal(empty.queryByTestId('artefact-rail'), null)
    cleanup()
    seedModel()
    const hidden = render(<ArtefactColumn isStale={false} isBusy={false} hidden />)
    assert.equal(hidden.queryByTestId('artefact-rail'), null)
  })

  it('the dock remounting the rail keeps the open tool; another scenario starts closed', () => {
    seedModel()
    const first = render(<ArtefactColumn isStale={false} isBusy={false} />)
    fireEvent.click(first.getByTestId('artefact-rail-assumptions'))
    first.unmount()
    const again = render(<ArtefactColumn isStale={false} isBusy={false} />)
    assert.equal(again.getByTestId('artefact-column').getAttribute('data-artefact'), 'assumptions')
    act(() => { useCanvasStore.setState({ currentScenarioId: 'scn-another' } as never) })
    assert.equal(again.queryByTestId('artefact-column'), null)
  })
})

describe('a figure the user sets stays lit until seen', () => {
  it('a figure that becomes the user\'s own moves to yours, lit as yours just now, until the user looks at it', () => {
    seedModel()
    useArtefactStore.setState({ scenarioId: SCENARIO, open: 'assumptions' })
    const view = render(<ArtefactColumn isStale={false} isBusy={false} />)
    assert.equal(columnOf(view, 'f1'), 'unchecked', 'POSITIVE CONTROL: f1 starts as Olumi\'s, not yet checked')
    assert.deepEqual(useArtefactStore.getState().settled, [], 'opening the model lights nothing')

    act(() => { useCanvasStore.setState((s) => ({ nodes: s.nodes.map((n) => (n.id === 'f1' ? node('f1', 'factor', USER_VALUE) : n)) })) })
    assert.equal(columnOf(view, 'f1'), 'yours')
    assert.deepEqual(useArtefactStore.getState().settled, ['node:f1'], 'only the figure that moved is lit, never f2, which was already yours')
    fireEvent.click(view.getByTestId('assumption-map-filter-yours'))
    const row = view.getAllByTestId('assumption-map-item').find((b) => b.getAttribute('data-target') === 'f1')!
    assert.ok(row.querySelector('[data-testid="assumption-map-settled"]'), 'its row says it is yours just now')

    fireEvent.mouseEnter(row)
    assert.deepEqual(useArtefactStore.getState().settled, [], 'seen, it stops being lit')
  })

  it('the list the user is working through stays put: the figure they set is listed under it, its card still open', () => {
    seedModel()
    useArtefactStore.setState({ scenarioId: SCENARIO, open: 'assumptions' })
    const view = render(<ArtefactColumn isStale={false} isBusy={false} />)
    fireEvent.click(view.getByTestId('assumption-map-filter-unchecked'))
    fireEvent.click(view.getAllByTestId('assumption-map-item').find((b) => b.getAttribute('data-target') === 'f1')!)
    assert.equal(view.getByTestId('assumption-map-figure').getAttribute('data-target'), 'f1')

    act(() => { useCanvasStore.setState((s) => ({ nodes: s.nodes.map((n) => (n.id === 'f1' ? node('f1', 'factor', USER_VALUE) : n)) })) })
    assert.equal(view.getByTestId('assumption-map-filter-unchecked').getAttribute('aria-pressed'), 'true', 'the chosen list does not move')
    const moved = view.getByTestId('assumption-map-moved')
    assert.ok(moved.querySelector('[data-testid="assumption-map-item"][data-target="f1"]'), 'f1 is listed as moved to yours')
    assert.equal(view.getByTestId('assumption-map-figure').getAttribute('data-target'), 'f1', 'its card stays open')
  })

  it('CONTRAST: a figure that moves away from yours, or stays where it was, is never lit', () => {
    seedModel(USER_VALUE)
    useArtefactStore.setState({ scenarioId: SCENARIO, open: 'assumptions' })
    render(<ArtefactColumn isStale={false} isBusy={false} />)
    act(() => { useCanvasStore.setState((s) => ({ nodes: s.nodes.map((n) => (n.id === 'f1' ? node('f1', 'factor', OLUMI_VALUE) : n)) })) })
    act(() => { useCanvasStore.setState((s) => ({ nodes: [...s.nodes] })) })
    assert.deepEqual(useArtefactStore.getState().settled, [])
  })
})

describe('picking, in both directions, and acting through the model\'s own controls', () => {
  it('selecting a figure on the canvas picks it in the map and opens it in place', () => {
    seedModel()
    useArtefactStore.setState({ scenarioId: SCENARIO, open: 'assumptions' })
    const view = render(<ArtefactColumn isStale={false} isBusy={false} />)
    assert.equal(view.queryByTestId('assumption-map-figure'), null)
    act(() => { useCanvasStore.setState({ selection: { nodeIds: new Set<string>(), edgeIds: new Set(['e2']), anchorPosition: null } } as never) })
    assert.equal(useArtefactStore.getState().picked, 'edge:e2')
    assert.equal(view.getByTestId('assumption-map-figure').getAttribute('data-target'), 'e2')
    assert.equal(view.getByTestId('assumption-map-filter-unchecked').getAttribute('aria-pressed'), 'true', 'its state\'s list is in view')
  })

  it('CONTRAST: selecting something that is not a figure, or two things, picks nothing', () => {
    seedModel()
    useArtefactStore.setState({ scenarioId: SCENARIO, open: 'assumptions' })
    const view = render(<ArtefactColumn isStale={false} isBusy={false} />)
    act(() => { useCanvasStore.setState({ selection: { nodeIds: new Set(['g']), edgeIds: new Set<string>(), anchorPosition: null } } as never) })
    act(() => { useCanvasStore.setState({ selection: { nodeIds: new Set(['f1']), edgeIds: new Set(['e2']), anchorPosition: null } } as never) })
    assert.equal(useArtefactStore.getState().picked, null)
    assert.equal(view.queryByTestId('assumption-map-figure'), null)
  })

  it('a link\'s strength is set in the link\'s own editor; nothing in the tool writes the model', () => {
    seedModel()
    useArtefactStore.setState({ scenarioId: SCENARIO, open: 'assumptions', picked: 'edge:e1' })
    const raised: string[] = []
    const onRaise = () => raised.push('inspector')
    window.addEventListener(OPEN_FULL_INSPECTOR_EVENT, onRaise)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    // The model's own content: selection is presentation, not a write.
    const modelOf = () => JSON.stringify([
      useCanvasStore.getState().nodes.map(({ id, type, data }) => ({ id, type, data })),
      useCanvasStore.getState().edges.map(({ id, source, target, data }) => ({ id, source, target, data })),
    ])
    const before = modelOf()
    const view = render(<ArtefactColumn isStale={false} isBusy={false} />)
    const figure = view.getByTestId('assumption-map-figure')
    assert.equal(figure.getAttribute('data-target'), 'e1')
    fireEvent.click(view.getByTestId('assumption-map-figure-edit'))
    window.removeEventListener(OPEN_FULL_INSPECTOR_EVENT, onRaise)
    assert.equal(view.getByTestId('assumption-map-figure-edit').textContent, 'Set its strength')
    assert.deepEqual(raised, ['inspector'])
    assert.deepEqual([...useCanvasStore.getState().selection.edgeIds], ['e1'], 'the link is selected for its editor')
    assert.equal(modelOf(), before)
  })

  it('CONTRAST: a viewer reads the figure and can show it on the model, nothing more', () => {
    seedModel()
    setViewerScenario(SCENARIO)
    useArtefactStore.setState({ scenarioId: SCENARIO, open: 'assumptions', picked: 'edge:e1' })
    const view = render(<ArtefactColumn isStale={false} isBusy={false} />)
    const figure = view.getByTestId('assumption-map-figure')
    assert.deepEqual([...figure.querySelectorAll('button')].map((b) => b.getAttribute('data-testid')), ['assumption-map-figure-show'])
  })
})
