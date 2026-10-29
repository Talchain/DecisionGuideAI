/**
 * Paul's staging test, 29 Oct (saved scenario d12634b4 "Marketing manager or AI?", UI 7abf27fe / CEE 08f458bd): CEE's saved
 * graph carries three `goal_constraints`, two of them on FACTOR cards (`your_time`: "No more than 25% of your time";
 * `launch_time`: "Start within three months") and one on an OUTCOME (`annual_spend`, £100,000). The canvas drew
 * "Limit ≤ £100,000" on the outcome card and the two factor limits nowhere: BaseNode left every factor card out
 * (NODE-ANATOMY v3.2, "the boundary lives on the Goal"), and this Goal has no target, so it shows no limit pills.
 *
 * Now, on a PROGRAM board, each limit is said on the card its `node_id` names, through the same formatter and line the
 * outcome card uses. A board that is not a program keeps today's cards exactly (contrast below).
 *
 * Fixture: written by hand from the saved graph's `goal_constraints` as the DL read them on d12634b4 (constraint ids,
 * labels, node ids, operators, values, units and provenance), with the owner-time quote as CEE served it for the same
 * brief on 23 Oct (`accept3-marketing-r1-read.json`). The node labels are placeholders: the cards' titles are not asserted.
 * Real path: the real `hydrateCanvasFromServer` read and saved-graph read (only `fetch` stubbed), then the real cards.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup, act } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { useCanvasStore } from '../../store'
import { FactorNode } from '../FactorNode'
import { OutcomeNode } from '../OutcomeNode'
import { ConversationProvider } from '../../conversation/ConversationContext'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
import { useSavedModelProgramState } from '../shared/savedModelProgram'

vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()),
  openV5TurnStream: async () => { throw new TypeError('Failed to fetch') },
}))
vi.mock('../../../v5/eligibility', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/eligibility')>()),
  isV5Eligible: () => ({ eligible: true }),
  isV5CanonicalRunPath: () => false,
}))
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isOrchestratorV2Enabled: () => true,
  isOrchestratorStreamingEnabled: () => false,
}))
vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../../services/scenarioService', () => ({ loadScenario: async () => null, storeAnalysis: async () => undefined }))
vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../hooks/useScienceIcons', () => ({ useScienceIcons: vi.fn(() => []) }))
// A program board is opened signed in (thin client): its saved limits come from CEE's read, as on staging.
vi.mock('../../thinClient/thinClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../thinClient/thinClient')>()),
  isThinClientSession: () => true,
}))

type Json = Record<string, any>

/** The saved graph's three limits, as CEE wrote them on d12634b4. */
const GOAL_CONSTRAINTS = [
  {
    constraint_id: 'owner_time_limit', label: 'No more than 25% of your time', node_id: 'your_time', operator: '<=', value: 25,
    unit: '%', provenance: 'explicit', source_quote: 'I can\'t spend more than 25% of my time on this',
  },
  {
    constraint_id: 'launch_start_limit', label: 'Start within three months', node_id: 'launch_time', operator: '<=', value: 3,
    unit: 'month', provenance: 'explicit',
  },
  {
    constraint_id: 'annual_budget_limit', label: 'Our budget for the year is £100,000.', node_id: 'annual_spend', operator: '<=',
    value: 100000, unit: 'GBP', provenance: 'explicit', source_quote: 'Our budget for the year is £100,000.',
  },
]

/** The saved read, hand-built (see the header): a program board unless `program` is false. */
function marketingRead(program: boolean): Json {
  return {
    schema: 'scenario_graph.v1',
    scenario_id: 'd12634b4-c233-4aa1-ac31-15524fe82785',
    graph_present: true,
    graph_hash: 'd12634b4aa00ff11d12634b4aa00ff11d12634b4aa00ff11d12634b4aa00ff11',
    graph: {
      nodes: [
        { id: 'mp:decision', kind: 'decision', label: 'Marketing manager or AI?' },
        { id: 'launch_goal', kind: 'goal', label: 'Launch the next feature well', provenance: 'from_brief' },
        { id: 'hire_manager', kind: 'option', label: 'Hire a marketing manager' },
        { id: 'use_ai_tool', kind: 'option', label: 'Use an AI campaign-planning tool' },
        { id: 'your_time', kind: 'factor', label: 'Your time on the launch', provenance: 'from_brief' },
        { id: 'launch_time', kind: 'factor', label: 'Months until the campaign starts', provenance: 'from_brief' },
        { id: 'annual_spend', kind: 'outcome', label: 'Spending this year', provenance: 'from_brief' },
      ],
      edges: [],
      goal_constraints: GOAL_CONSTRAINTS,
      living_model: program ? { model_program: 'v1' } : {},
    },
  }
}

let read: Json = {}
// The saved-graph read is cached per scenario and hash, so each opening reads its own hash.
let n = 0
async function openBoard(board: Json) {
  n += 1
  read = { ...board, graph_hash: `${board.graph_hash.slice(0, 60)}${String(n).padStart(4, '0')}` }
  useCanvasStore.setState({
    nodes: [], edges: [], currentScenarioId: board.scenario_id, results: { status: 'idle' } as never, goalConstraints: null,
    lastServerGraphHash: null, serverGraphIdentity: null, lastAuthoritativeGraph: null, analysisFreshness: null, analysisStateV1: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => (
    /\/scenarios\/[^/]+\/graph/.test(String(input))
      ? new Response(JSON.stringify(read), { status: 200, headers: { 'content-type': 'application/json' } })
      : new Response(JSON.stringify({ assistant_text: '', cards: [], notes: [], run: null, model: null }), { status: 200, headers: { 'content-type': 'application/json' } })
  )))
  await act(async () => { await hydrateCanvasFromServer(board.scenario_id) })
  // PRECONDITION: the read's three limits reached the canvas store, by identity.
  expect((useCanvasStore.getState().goalConstraints ?? []).map(c => [c.constraint_id, c.node_id]))
    .toEqual(GOAL_CONSTRAINTS.map(c => [c.constraint_id, c.node_id]))
}

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)) })

/** What the saved read answered for this board, so a contrast that shows nothing is not merely a read still pending. */
function ProgramStateProbe() {
  return <span data-testid="program-state-probe">{useSavedModelProgramState()}</span>
}

async function cards() {
  const nodeOf = (id: string) => {
    const node = useCanvasStore.getState().nodes.find(x => x.id === id) as Node
    expect(node, `node ${id} hydrated`).toBeTruthy()
    return node
  }
  const props = { selected: false, isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0, deletable: true, selectable: true, draggable: true }
  const view = render(
    <ConversationProvider>
      <ReactFlowProvider>
        <ProgramStateProbe />
        {(['your_time', 'launch_time'] as const).map(id => (
          <div key={id} data-card={id}><FactorNode id={id} type="factor" data={nodeOf(id).data as never} {...props} /></div>
        ))}
        <div data-card="annual_spend"><OutcomeNode id="annual_spend" type="outcome" data={nodeOf('annual_spend').data as never} {...props} /></div>
      </ReactFlowProvider>
    </ConversationProvider>,
  )
  // The saved-graph read has answered before anything asserts.
  await settle()
  const linesOn = (id: string) => [...view.container.querySelectorAll<HTMLElement>(`[data-card="${id}"] [data-testid="factor-constraint-lines"] > div`)]
    .map(e => e.textContent)
  return { linesOn, state: view.getByTestId('program-state-probe').textContent }
}

beforeEach(() => {
  window.history.replaceState({}, '', '/#/canvas?ai=core-route')
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/') })

describe('a program board draws every limit CEE sends on the card its node_id names', () => {
  it('⭐ d12634b4: the owner-time limit on `your_time`, the start limit on `launch_time`, the budget on `annual_spend`', async () => {
    await openBoard(marketingRead(true))
    const { linesOn, state } = await cards()
    expect(state).toBe('program')
    expect(linesOn('your_time')).toEqual(['Limit “I can\'t spend more than 25% of my time on this”'])
    // CEE's unit as sent (`month`), through the outcome card's formatter.
    expect(linesOn('launch_time')).toEqual(['Limit ≤ 3 month'])
    expect(linesOn('annual_spend')).toEqual(['Limit ≤ £100,000'])
  })

  it('CONTRAST: the same graph on a board that is not a program keeps today’s cards (no factor limit lines; the outcome’s stays)', async () => {
    await openBoard(marketingRead(false))
    const { linesOn, state } = await cards()
    expect(state).toBe('not_program')
    expect(linesOn('your_time')).toEqual([])
    expect(linesOn('launch_time')).toEqual([])
    expect(linesOn('annual_spend')).toEqual(['Limit ≤ £100,000'])
  })
})
