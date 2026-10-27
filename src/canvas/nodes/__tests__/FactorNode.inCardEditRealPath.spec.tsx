/**
 * Vision spec §3, "Inspector as the one writer | Keep | Opens beside the card; adds in-card value edit | Edits stay
 * checked and saved one way" (§2d, 23 Oct 2026). On the café board (`?ai=core-route`), a figure typed into the CARD is
 * saved through the inspector's own write (`useModelEditAuthority.proposeFactorValue` → `factor_value_edit`), reads
 * back as the person's, and it, its author and the Run that read it survive a cold reopen.
 *
 * Driven through the REAL path: the real `ConversationProvider` (`useConversation`), the real buffered transport
 * (`callV5Turn` → stubbed global `fetch`), the real core-turn parser, `applyV5State`, and on reopen the real
 * `hydrateCanvasFromServer` → `fetchScenarioGraph`. Only the stream opener (forced to the buffered path), eligibility,
 * Supabase identity, the scenario store and telemetry are stubbed.
 *
 * The bytes: `fixtures/core-turn-cafe-2604-run.served.json` is the served core Run turn on the café board (22 Oct
 * 21:49Z, spend £6.20 "user_edited"). Each reply below is that turn with only the edited figure, the revision and the
 * Run moved, named where it is built. The reopen body is the `scenario_graph.v1` envelope around that turn's own model
 * and analysis_state (the read serves the saved model and its Run; `readAfterWrite.ts`).
 *
 * CLAIM SCOPE: jsdom — the request bodies, the store and the card's words; not layout or the server's write.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import served from './fixtures/core-turn-cafe-2604-run.served.json'
import servedEditTurn from '../../../v5/__tests__/fixtures/core-freshness-5e28e10f-edit.json'
import { useCanvasStore } from '../../store'
import { FactorNode } from '../FactorNode'
import { ConversationProvider, useConversationContext } from '../../conversation/ConversationContext'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
import { useCanonicalAnalysisViewStore } from '../../stores/canonicalAnalysisViewStore'

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
// FactorNode's render-only dependencies (as `setValueRidesTheTypedWriter.spec.tsx`).
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../hooks/useScienceIcons', () => ({ useScienceIcons: vi.fn(() => []) }))

type Json = Record<string, any>
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const SCENARIO_ID = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const SPEND = 'spend'
const CUSTOMERS = 'customers'
/** The served board's revision before the edit, and the two the edit and its Run move to (this file's own labels). */
const BEFORE_REVISION = served.model.revision
const EDIT_REVISION = 'e1e1e1e1e1e1e1e1'
const EDIT_SCENARIO_REVISION = 'f'.repeat(64)
const RUN_ID = '9'.repeat(64)

/** The served graph with ONE figure moved to `raw` and stamped the person's (`user_override`, CEE's edit source). */
function graphWith(id: string, raw: number, cap: number): Json {
  const graph = clone(served.model.graph) as Json
  const node = graph.nodes.find((n: Json) => n.id === id)
  node.observed_state = { ...node.observed_state, raw_value: raw, value: raw / cap, source: 'user_override' }
  delete node.observed_state.extractionType
  return graph
}

/**
 * The core reply to the edit: the saved model, a new revision, no Run, the person's write receipt, and the verdict a
 * served core edit turn carries (`core-freshness-5e28e10f-edit.json`: the last Run is now stale).
 */
function editReply(graph: Json): Json {
  return {
    ...clone(served), assistant_text: '', cards: [], notes: [], run: null, analysis_state: clone(servedEditTurn.analysis_state),
    receipts: [{ authorised_by: 'person' }],
    model: { revision: EDIT_REVISION, scenario_revision: EDIT_SCENARIO_REVISION, graph },
  }
}

/** The core Run on the edited model: the served Run, computed against the edit's revision. */
function runReply(graph: Json): Json {
  const r = clone(served) as Json
  r.model = { revision: EDIT_REVISION, scenario_revision: EDIT_SCENARIO_REVISION, graph }
  r.run = { ...r.run, run_key: RUN_ID, run_id: RUN_ID, computed_against: EDIT_REVISION }
  return r
}

/**
 * The cold-reopen read: the scenario_graph.v1 envelope around the saved model, its Run's verdict and, when `runId` is
 * given, the stored Run it names (`canonical_analysis_view.run`, the field read-after-write checks). The view's option
 * rows are left empty: the served Run turn carries no result rows, and this file claims nothing about them.
 */
function reopenRead(graph: Json, revision: string, contentHash: string, runId: string | null = null): Json {
  return {
    schema: 'scenario_graph.v1', scenario_id: SCENARIO_ID, graph_present: true, graph,
    graph_hash: revision, content_hash: contentHash, analysis_state: clone(served.analysis_state),
    ...(runId === null ? {} : {
      canonical_analysis_view: {
        schema: 'canonical_analysis_view.v1', source: 'stored_run_facts', leader_licence: 'withheld', options: [],
        run: { run_id: runId, graph_hash_at_run: revision, computed_at: served.run.state.computed_at },
        staleness: { stale: false, revision: null, run_revision: null, reason: null, basis: 'analysis_graph_hash_interim',
          limitation: 'Hash equality cannot detect brief, framing or stage changes.' },
      },
    }),
  }
}

/** The store as the café board opens: the served graph through the real read path. */
async function openBoard(read: Json) {
  useCanvasStore.setState({
    nodes: [], edges: [], currentScenarioId: SCENARIO_ID, results: { status: 'idle' } as never,
    lastServerGraphHash: null, lastAuthoritativeGraph: null, analysisFreshness: null, analysisStateV1: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(read), { status: 200, headers: { 'content-type': 'application/json' } })))
  await act(async () => { await hydrateCanvasFromServer(SCENARIO_ID) })
}

let sent: Json[] = []
let replies: Json[] = []
let laterRead: Json | null = null
let graphReads = 0
function stubWire() {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (/\/scenarios\/[^/]+\/graph/.test(url)) {
      graphReads += 1
      return new Response(JSON.stringify(laterRead), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (init?.method === 'POST' && init.body) sent.push(JSON.parse(String(init.body)))
    const body = replies.shift() ?? { ...clone(served), run: null, model: null, assistant_text: '' }
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  }))
}

let conversation: ReturnType<typeof useConversationContext> | null = null
function Grab() { conversation = useConversationContext(); return null }

function card(id: string) {
  const node = useCanvasStore.getState().nodes.find(n => n.id === id) as Node
  return render(
    <ConversationProvider>
      <Grab />
      <ReactFlowProvider>
        <FactorNode
          id={id} type="factor" data={node.data as never} selected={false} isConnectable
          positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable
        />
      </ReactFlowProvider>
    </ConversationProvider>,
  )
}

async function typeOnCard(id: string, typed: string) {
  // A browser's double-click is click, click, dblclick; the first click opens the field.
  const value = screen.getByTestId(`node-value-editor-${id}`)
  fireEvent.click(value)
  fireEvent.doubleClick(screen.queryByTestId(`node-value-editor-${id}`) ?? value)
  const input = screen.getByTestId(`node-value-editor-${id}-input`)
  fireEvent.change(input, { target: { value: typed } })
  return input
}

/** The `factor_value_edit` events that reached the wire, in order. */
const valueEdits = () => sent.filter(b => b.kind === 'system_event' && b.event?.kind === 'factor_value_edit').map(b => b.event)
// Paul, 27 Oct: the value's author mark renders on THIS card's bottom row (a portal), found in that band by identity.
const markOf = (id: string) => {
  const band = `[data-testid="factor-bottom-marks-${id}"]`
  const sel = `${band} [data-testid="factor-value-source-${id}"], ${band} [data-testid="estimate-marker"]`
  return document.querySelector(sel)?.closest('[aria-label]')?.getAttribute('aria-label')
    ?? document.querySelector(`${band} [data-testid="factor-value-source-${id}"] [aria-label], ${band} [data-testid="estimate-marker"] [aria-label]`)?.getAttribute('aria-label')
}
const figureOf = (id: string) => screen.getByTestId(`node-value-editor-${id}`).textContent

beforeEach(() => {
  window.history.replaceState({}, '', '/#/canvas?ai=core-route')
  Element.prototype.scrollIntoView = vi.fn()
  sent = []; replies = []; laterRead = null; graphReads = 0; conversation = null
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/') })

describe('in-card value edit on the café board, through the real conversation', () => {
  it('⭐ edit in the card → saved through factor_value_edit → Run → cold reopen: the figure, "by you" and the Run survive', async () => {
    await openBoard(reopenRead(clone(served.model.graph), BEFORE_REVISION, served.model.scenario_revision))
    stubWire()
    const after = graphWith(SPEND, 6.8, 8.125)
    replies.push(editReply(after), runReply(after))
    // The edit's own read-after-write is served the saved model (no Run yet).
    laterRead = reopenRead(after, EDIT_REVISION, EDIT_SCENARIO_REVISION)
    useCanonicalAnalysisViewStore.getState().adopt(SCENARIO_ID, null)
    const view = card(SPEND)
    expect(figureOf(SPEND), 'PRECONDITION: the served £6.20').toContain('6.20')

    const input = await typeOnCard(SPEND, '6.8')
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }) })
    await waitFor(() => expect(sent).toHaveLength(1))
    // The one write, in the factor's own unit: the inspector's `factor_value_edit`, nothing else.
    expect(sent[0]).toMatchObject({ kind: 'system_event', scenario_id: SCENARIO_ID })
    expect(sent[0].event).toEqual({ kind: 'factor_value_edit', target_id: SPEND, field: 'value', value: 6.8 / 8.125, raw_value: 6.8, unit: '£ per customer' })
    await waitFor(() => expect(useCanvasStore.getState().lastServerGraphHash).toBe(EDIT_REVISION))
    view.rerender(<></>)
    cleanup()
    card(SPEND)
    expect(figureOf(SPEND)).toContain('6.80')
    expect(markOf(SPEND)).toBe('Average spend per customer: Set by you')

    // The Run, as the after-change runner sends it. The read-after-write that follows is served the saved model and
    // this Run, as the scenario read would be.
    laterRead = reopenRead(after, EDIT_REVISION, EDIT_SCENARIO_REVISION, RUN_ID)
    await act(async () => {
      await conversation!.sendMessage('Run analysis', { hidden: true, turnType: 'run_analysis', debugInitiatedBy: 'automatic', debugSource: 'after-change' })
    })
    expect(sent).toHaveLength(2)
    expect(sent[1].event ?? null, 'the Run carries no value of its own: CEE reads the saved model').toBeNull()
    expect(useCanvasStore.getState().analysisStateV1?.run_state.kind).toBe('complete_current')
    expect(useCanvasStore.getState().lastServerGraphHash).toBe(EDIT_REVISION)
    // The Run turn named what the read must serve (the saved model and this Run); the read served it, so read-after-write
    // confirmed it and adopted that Run's view (`checkReadAfterWrite`). Another Run there would never be adopted.
    await waitFor(() => expect(useCanonicalAnalysisViewStore.getState().view?.run?.run_id).toBe(RUN_ID))
    expect(graphReads).toBeGreaterThan(0)

    // Cold reopen: nothing local survives; the scenario read is the only source.
    cleanup()
    vi.unstubAllGlobals()
    useCanonicalAnalysisViewStore.getState().adopt(SCENARIO_ID, null)
    await openBoard(reopenRead(after, EDIT_REVISION, EDIT_SCENARIO_REVISION, RUN_ID))
    card(SPEND)
    expect(figureOf(SPEND)).toContain('6.80')
    expect(markOf(SPEND)).toBe('Average spend per customer: Set by you')
    expect(useCanvasStore.getState().lastServerGraphHash).toBe(EDIT_REVISION)
    // The Run that read the edited figure is the one the reopened scenario names.
    const adopted = useCanonicalAnalysisViewStore.getState()
    expect(adopted.scenarioId).toBe(SCENARIO_ID)
    expect(adopted.view?.run).toEqual(expect.objectContaining({ run_id: RUN_ID, graph_hash_at_run: EDIT_REVISION }))
  })

  it('⭐ an observable factor is edited in the card too, because the inspector writes its value: Weekly customers', async () => {
    await openBoard(reopenRead(clone(served.model.graph), BEFORE_REVISION, served.model.scenario_revision))
    stubWire()
    replies.push(editReply(graphWith(CUSTOMERS, 450, 525)))
    card(CUSTOMERS)
    const input = await typeOnCard(CUSTOMERS, '450')
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }) })
    await waitFor(() => expect(valueEdits()).toHaveLength(1))
    expect(valueEdits()[0]).toEqual({ kind: 'factor_value_edit', target_id: CUSTOMERS, field: 'value', value: 450 / 525, raw_value: 450, unit: 'customers per week' })
  })

  it('⭐ the open field names the factor\'s unit beside it and reads ".5" as 0.5 (never 5): one write of £0.50', async () => {
    await openBoard(reopenRead(clone(served.model.graph), BEFORE_REVISION, served.model.scenario_revision))
    stubWire()
    replies.push(editReply(graphWith(SPEND, 0.5, 8.125)))
    card(SPEND)
    const input = await typeOnCard(SPEND, '.5')
    expect(input.getAttribute('type'), 'the number field it always was: no unit can be typed into it').toBe('number')
    expect(screen.getByTestId(`node-value-editor-${SPEND}-scale`)).toHaveTextContent('£ per customer')
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }) })
    await waitFor(() => expect(valueEdits()).toHaveLength(1))
    expect(valueEdits()[0]).toEqual({ kind: 'factor_value_edit', target_id: SPEND, field: 'value', value: 0.5 / 8.125, raw_value: 0.5, unit: '£ per customer' })
  })

  it.each(['-£6.80', '6.8junk', '6.80 EUR', '$6.80'])('NEGATIVE: "%s" never reaches the writer: the number field holds no such text, nothing is sent, the model is unchanged', async (typed) => {
    await openBoard(reopenRead(clone(served.model.graph), BEFORE_REVISION, served.model.scenario_revision))
    stubWire()
    card(SPEND)
    const input = await typeOnCard(SPEND, typed)
    // A number field keeps no unit or letters (the browser's own rule; jsdom applies it): the text is not readable as a figure.
    expect((input as HTMLInputElement).value).not.toBe(typed)
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }) })
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })
    expect(sent, 'nothing reached the wire').toEqual([])
    const node = useCanvasStore.getState().nodes.find(n => n.id === SPEND)!
    expect((node.data as Json).observedState.raw_value, 'the model is unchanged').toBe(6.2)
  })

  it.each([
    ['no cap', { value: 0.25, raw_value: 0.25, unit: '%', source: 'user_override' }],
    ['a cap of 100', { value: 0.0025, raw_value: 0.25, cap: 100, unit: '%', source: 'user_override' }],
  ])('a percent stored as a 0–1 ratio (%s) keeps the field it had before this PR: opens at 0.25, nothing beside it; unchanged saves nothing (labelled synthetic: spend re-stamped a % factor)', async (_shape, observed) => {
    const graph = clone(served.model.graph) as Json
    const spend = graph.nodes.find((n: Json) => n.id === SPEND)
    spend.label = 'Repeat-visit rate'
    spend.observed_state = observed
    await openBoard(reopenRead(graph, BEFORE_REVISION, served.model.scenario_revision))
    stubWire()
    card(SPEND)
    expect(figureOf(SPEND), 'PRECONDITION: the card reads 25%').toContain('25%')
    fireEvent.click(screen.getByTestId(`node-value-editor-${SPEND}`))
    const input = screen.getByTestId(`node-value-editor-${SPEND}-input`)
    expect(input).toHaveValue(0.25)
    expect(screen.queryByTestId(`node-value-editor-${SPEND}-scale`), 'no "%" and no hint beside it, as before').toBeNull()
    expect(screen.queryByTestId(`node-value-editor-${SPEND}-prefix`)).toBeNull()
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }) })
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })
    expect(sent).toEqual([])
    expect(figureOf(SPEND)).toContain('25%')
  })

  it('NEGATIVE: an external factor\'s card keeps its value read-only, as its inspector pane writes only the range (labelled synthetic: Weekly customers re-stamped external)', async () => {
    const graph = clone(served.model.graph) as Json
    graph.nodes.find((n: Json) => n.id === CUSTOMERS).category = 'external'
    await openBoard(reopenRead(graph, BEFORE_REVISION, served.model.scenario_revision))
    stubWire()
    card(CUSTOMERS)
    expect(screen.queryByTestId(`node-value-editor-${CUSTOMERS}`)).toBeNull()
    expect(screen.getByTestId('factor-recorded-value')).toHaveTextContent('420')
  })

  it('§2d: the author glyph turns to yours while the field holds a new figure, and back on Escape (labelled synthetic: spend re-stamped Olumi\'s estimate)', async () => {
    const graph = clone(served.model.graph) as Json
    const spend = graph.nodes.find((n: Json) => n.id === SPEND)
    spend.observed_state.source = 'cee_hypothesis'
    delete spend.observed_state.extractionType
    await openBoard(reopenRead(graph, BEFORE_REVISION, served.model.scenario_revision))
    stubWire()
    card(SPEND)
    const atRest = markOf(SPEND)
    expect(atRest).not.toMatch(/you/i)
    const input = await typeOnCard(SPEND, '6.8')
    expect(markOf(SPEND)).toBe('Average spend per customer: Yours once you save it')
    fireEvent.change(input, { target: { value: '6.2' } })
    expect(markOf(SPEND), 'back to the figure it opened with: not a new figure of yours').toBe(atRest)
    fireEvent.change(input, { target: { value: '7' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(markOf(SPEND)).toBe(atRest)
    expect(sent).toEqual([])
  })
})
