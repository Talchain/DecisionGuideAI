/**
 * ⭐ ON A PROGRAM BOARD THE MODEL TAB'S VALUES ARE THE PROGRAM'S (panel-data, Paul 27 Oct: "making sure that the data
 * being used is the new model").
 *
 * Served on UI fd3da3fd (program boards bffa49b0 and 7e3ba3e4): Relationships read "5 with no value yet" beside a link
 * whose coefficient the person stated (20 per specialist, 10 to 30), because the row read the legacy `strength` a program
 * link never carries; and a figure the program holds none for (asked of the person, or Olumi's figure nobody knows yet)
 * read "Placeholder: Waiting for your answer" or "Placeholder: unknown", though nothing is used in its place. The canvas link already reads the program's coefficient (`useProgramLinkFigure`) and "By definition".
 *
 * Real path (as `programQuantityState.cards.spec.tsx`): the real `hydrateCanvasFromServer` and saved-graph read (only
 * `fetch` stubbed), then the real `ModelTabBody` from the store. Fixtures: the 26 Oct acceptance run's served reads.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import capacity from '../../nodes/__tests__/fixtures/served-acceptance-capacity-read-20261026.json'
import european from '../../nodes/__tests__/fixtures/served-acceptance-european-read-20261026.json'
import paulHiring from './fixtures/paul-hiring-saved-20261027.json'
import { useCanvasStore } from '../../store'
import { ModelTabBody } from '../ModelTabBody'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'

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
vi.mock('../../../telemetry/guidanceEvents', () => ({ trackGuidance: vi.fn() }))
// A program board is opened signed in (thin client): its saved limits come from CEE's read, as on staging.
vi.mock('../../thinClient/thinClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../thinClient/thinClient')>()),
  isThinClientSession: () => true,
}))

type Json = Record<string, any>
let read: Json = {}
// The saved-graph read is cached per scenario and hash, so each opening reads its own hash.
let n = 0
async function openBoard(board: Json) {
  n += 1
  read = { ...board, graph_hash: `${board.graph_hash}${n}` }
  useCanvasStore.setState({
    nodes: [], edges: [], currentScenarioId: board.scenario_id, results: { status: 'idle' } as never,
    lastServerGraphHash: null, serverGraphIdentity: null, lastAuthoritativeGraph: null, analysisFreshness: null, analysisStateV1: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => (
    /\/scenarios\/[^/]+\/graph/.test(String(input))
      ? new Response(JSON.stringify(read), { status: 200, headers: { 'content-type': 'application/json' } })
      : new Response(JSON.stringify({ assistant_text: '', cards: [], notes: [], run: null, model: null }), { status: 200, headers: { 'content-type': 'application/json' } })
  )))
  await act(async () => { await hydrateCanvasFromServer(board.scenario_id) })
  const { nodes, edges } = useCanvasStore.getState()
  render(
    <ModelTabBody
      showDebug={false} hasDiagnostics={false} diagnostics={null} hasTrim={false}
      effectiveCorrelationId={null} correlationMismatch={false} correlationIdHeader={null} robustness={null}
      nodes={nodes} edges={edges}
    />,
  )
  // The saved-graph read has answered before anything asserts.
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
  fireEvent.click(screen.getByTestId('model-outline-v2-toggle-all'))
}
const row = (id: string) => screen.getByTestId(`model-row-v2-${id}`).textContent ?? ''

beforeEach(() => {
  window.history.replaceState({}, '', '/#/canvas?ai=core-route')
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/') })

describe('a program link says its canonical figure, or that it holds by definition', () => {
  it('capacity: the coefficient link says the stated 20 per specialist (10 to 30); the parts of the total say "By definition"', async () => {
    await openBoard(capacity)
    expect(row('additional_specialists__additional_capacity')).toContain('+20 (10–30) ticket/week/specialist')
    expect(row('existing_capacity__total_capacity')).toContain('By definition')
    expect(row('additional_capacity__total_capacity')).toContain('By definition')
    // No relationship of the program is "with no value yet".
    expect(screen.queryByTestId('model-group-v2-relationships-clause-no-value')).toBeNull()
  })
})

describe('a quantity the program holds no figure for is not a placeholder', () => {
  it('european: asked "planned_investment" and Olumi\'s unknown "pilot_acquisition_start" never read "Placeholder"; counted as no value yet', async () => {
    await openBoard(european)
    expect(row('planned_investment')).not.toContain('Placeholder')
    expect(row('pilot_acquisition_start')).not.toContain('Placeholder')
    expect(screen.queryByTestId('model-group-v2-factors-clause-placeholder')).toBeNull()
    expect(screen.getByTestId('model-group-v2-factors-clause-no-value')).toBeInTheDocument()
  })

  it('CONTRAST: a stated range with no single figure (european "expansion_timing", 6–12 months, its figure removed) keeps its words', async () => {
    const quantities = european.graph.living_model.canonical.quantities as Json[]
    expect(quantities.find((q) => q.id === 'expansion_timing')).toMatchObject({ value: null, low: 6, high: 12 })
    const nodes = (european.graph.nodes as Json[]).map((x) => x.id !== 'expansion_timing' ? x
      : { ...x, observed_state: { unit: x.observed_state.unit, range: x.observed_state.range, source: x.observed_state.source } })
    await openBoard({ ...european, graph: { ...european.graph, nodes } })
    expect(row('expansion_timing')).toContain('6–12')
  })

  it('CONTRAST: european "expansion_scale" (fixed by the structure) keeps its figure', async () => {
    await openBoard(european)
    const node = useCanvasStore.getState().nodes.find((x) => x.id === 'expansion_scale')
    expect((node?.data as Json | undefined)?.value_basis?.kind).toBe('structure')
    expect(row('expansion_scale')).not.toContain('Not set')
  })
})

describe('the Limits section lists every limit of the program', () => {
  it('Paul\'s hiring board: "Maintaining code quality" (its figure is asked) is listed with no figure, in his words', async () => {
    const limits = paulHiring.graph.living_model.canonical.limits as Json[]
    expect(limits.map((l) => l.id)).toEqual(['maintain_code_quality', 'stay_within_budget'])
    expect((paulHiring.graph.goal_constraints as Json[]).map((c) => c.constraint_id)).toEqual(['stay_within_budget'])
    await openBoard(paulHiring)
    const row = screen.getByTestId('model-goal-constraint-maintain_code_quality')
    expect(row).toHaveTextContent('Maintaining code quality · limit not captured')
    expect(row).toHaveTextContent('while maintaining code quality')
  })

  it('CONTRAST: the budget limit, listed by CEE with its figure, is listed once and keeps its figure', async () => {
    await openBoard(paulHiring)
    expect(useCanvasStore.getState().goalConstraints?.map((c) => c.constraint_id)).toEqual(['stay_within_budget'])
    expect(screen.getAllByTestId('model-goal-constraint-stay_within_budget')).toHaveLength(1)
    const row = screen.getByTestId('model-goal-constraint-stay_within_budget')
    expect(row).toHaveTextContent('£200,000')
    expect(row).not.toHaveTextContent('limit not captured')
  })
})
