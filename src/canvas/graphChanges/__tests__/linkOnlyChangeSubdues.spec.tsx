/**
 * A LINK-ONLY CHANGE READS ON THE CANVAS (audit 5942900903 (a); served `d48cd152`: with Compare open on R3's M3 pair,
 * links subdued 18/19 but cards 0/16, because cards subdued only when a CARD was marked).
 *
 *   L1  the REAL writer (`setRunChangesHighlight`) records the two cards at the ends of every marked link, exactly
 *   L2  BaseNode, fed L1's own output: a card that is neither marked nor an end of a marked link is subdued; an end
 *       of the marked link is NOT; CONTROL: a projection that marks nothing subdues nothing
 *   L3  "added" only where the canvas element IS the added thing: an added LINK reads added; a goal's added limit
 *       reads changed on the goal; an added option reads added
 */
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { DecisionNode } from '../../nodes/DecisionNode'
import { buildGraphChangesView } from '../graphChangesView'
import type { RunDeltaView } from '../../../components/results/analysisNew/runDeltaView'

vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual<Record<string, unknown>>('@xyflow/react')), Handle: () => null }))
let state: Record<string, unknown> = {}
vi.mock('../../store', () => ({ useCanvasStore: vi.fn((selector: (s: unknown) => unknown) => selector(state)) }))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate: null, isResultsMode: false, predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))
vi.mock('../../nodes/shared/NodePopover', () => ({ NodePopover: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))

const ME = 'decision-1'
const base = {
  edges: [], nodes: [], results: { status: 'complete', report: null }, highlightedNodes: new Set(), dimmedNodeIds: new Set(),
  editedSinceRunNodeIds: new Set(), lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
  goalThreshold: null, goalConstraints: [], ceeAnalysisReady: null, lodRung: 'full', viewMode: 'expert',
}

/** L1's writer, run for real against the actual store module (this file's `../../store` mock is for the render). */
async function writeHighlight(edges: Array<{ id: string; source: string; target: string }>, edgeMarks: Array<[string, 'changed' | 'added']>) {
  const real = await vi.importActual<typeof import('../../store')>('../../store')
  real.useCanvasStore.setState({ edges } as never)
  real.useCanvasStore.getState().setRunChangesHighlight({ nodeMarks: new Map(), edgeMarks: new Map(edgeMarks) })
  return real.useCanvasStore.getState().analysisHighlight
}

function renderCard(analysisHighlight: unknown, extra: Record<string, unknown> = {}) {
  state = { ...base, analysisHighlight, ...extra }
  render(
    <ReactFlowProvider>
      <DecisionNode {...({ id: ME, type: 'decision', position: { x: 0, y: 0 }, selected: false, isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0, data: { label: 'Should we hire?', type: 'decision' } } as unknown as React.ComponentProps<typeof DecisionNode>)} />
    </ReactFlowProvider>,
  )
  return screen.getByRole('group', { name: /^Question:/i })
}
const subdued = (el: HTMLElement) => el.closest('[data-run-change-subdued]')?.getAttribute('data-run-change-subdued') ?? el.getAttribute('data-run-change-subdued')

beforeEach(() => { state = { ...base, analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() } } })

describe('L1 · the writer records the ends of every marked link', () => {
  it('exactly the two ends of the marked link; an unmarked link adds nothing', async () => {
    const h = await writeHighlight([{ id: 'e1', source: 'a', target: 'b' }, { id: 'e2', source: 'c', target: 'd' }], [['e1', 'changed']])
    expect([...(h.contextNodeIds ?? [])].sort()).toEqual(['a', 'b'])
  })
})

describe('L2 · a link-only change subdues the cards it does not touch', () => {
  it('a card off the changed link is subdued', async () => {
    const h = await writeHighlight([{ id: 'e1', source: 'a', target: 'b' }], [['e1', 'changed']])
    expect(subdued(renderCard(h))).toBe('true')
  })
  it('a card at an END of the changed link stays at full strength', async () => {
    const h = await writeHighlight([{ id: 'e1', source: ME, target: 'b' }], [['e1', 'changed']])
    expect(subdued(renderCard(h))).not.toBe('true')
  })
  it('CONTROL: a projection that marks nothing subdues nothing', async () => {
    const h = await writeHighlight([{ id: 'e1', source: 'a', target: 'b' }], [])
    expect(subdued(renderCard(h))).not.toBe('true')
  })
})

describe('L2b · WHERE THIS CHANGE FLOWS: the subdue yields while a C1 row\'s element is selected', () => {
  const lit = { runChangesRouteFocusId: 'e1', selection: { nodeIds: new Set(), edgeIds: new Set(['e1']) } }
  it('route requested AND its link selected → a card off the changed link is NOT subdued (the route focus owns prominence)', async () => {
    const h = await writeHighlight([{ id: 'e1', source: 'a', target: 'b' }], [['e1', 'changed']])
    expect(subdued(renderCard(h, lit))).not.toBe('true')
  })
  it('CONTROL: requested but the selection is elsewhere → subdued as before', async () => {
    const h = await writeHighlight([{ id: 'e1', source: 'a', target: 'b' }], [['e1', 'changed']])
    expect(subdued(renderCard(h, { ...lit, selection: { nodeIds: new Set(), edgeIds: new Set(['e9']) } }))).toBe('true')
  })
})

describe('L3 · "added" only where the element IS the added thing', () => {
  const graph = {
    nodes: [{ id: 'goal_1', kind: 'goal' }, { id: 'opt_new', kind: 'option' }, { id: 'f1', kind: 'factor' }],
    edges: [{ id: 'e-f1-goal', source: 'f1', target: 'goal_1' }],
  }
  const view = (rows: unknown[]) => ({ inputs: { coverage: 'complete', rows }, movements: [], attributable: false }) as unknown as RunDeltaView
  it('an added link → edge "added"; an added limit → goal "changed"; an added option → "added"', () => {
    const v = buildGraphChangesView(view([
      { key: 'k1', kind: 'link', entityId: 'f1->goal_1', field: 'strength', change: 'added', linkEnds: { from: 'f1', to: 'goal_1' } },
      { key: 'k2', kind: 'constraint', entityId: 'c1', field: 'value', change: 'added' },
      { key: 'k3', kind: 'option', entityId: 'opt_new', field: 'option', change: 'added', optionId: 'opt_new' },
    ]), graph, false)
    expect(v.edgeMarks.get('e-f1-goal')).toBe('added')
    expect(v.nodeMarks.get('goal_1')).toBe('changed')
    expect(v.nodeMarks.get('opt_new')).toBe('added')
  })
})
