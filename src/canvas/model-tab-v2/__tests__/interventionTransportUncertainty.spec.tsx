/**
 * ⭐⭐⭐ THE GUARANTEE, NOT THE ANSWER — real adapter → router → system error → row.
 *
 * The row's transport wording was pinned twice before this file existed, and
 * both pins tested the ANSWER by handing the seam a hand-built error. The second
 * one was worse than useless: it injected `deliveryUnverified: false` and read
 * that as proof the request never left, so the assertion agreed with a bit
 * nobody had derived.
 *
 * ── WHY A FALSY BIT IS NOT PROOF (verified at the bytes) ────────────────────
 *   · `v5Adapter` awaits `fetchFn(...)` and catches ANY rejection. It does not
 *     observe whether the server accepted the request.
 *   · `responseRouter` sets `transportMeta.network = (http_status === undefined)`
 *     — true for every fetch-threw path, by its own comment.
 *   · `isUnverifiedDelivery` is `isTransportFailure && network === false`, so a
 *     fetch rejection returns FALSE — the same value as a genuinely impossible
 *     delivery.
 *
 * So the counterexample is reachable and ordinary: CEE commits the POST, the
 * connection dies before headers reach the browser, `fetch` rejects with a
 * `TypeError` — and the old row said "Not sent … Try again", inviting the user
 * to re-send a number the model already holds.
 *
 * ── WHAT THIS FILE DOES DIFFERENTLY ────────────────────────────────────────
 * It mocks ONLY the network, and only in the one way that reproduces the
 * counterexample: the fetch stub RECORDS that it was called — that is the
 * acceptance the client can actually observe — and then rejects. Everything
 * between that and the notice is the real chain: real `callV5Turn`, real
 * parser, real `routeV5Response`, real `useConversation` inside the real
 * `ConversationProvider`, the real authority, and the real mounted panel.
 *
 * Nothing here asserts a certificate it manufactured.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Node } from '@xyflow/react'

// ── Seams only. The V5 adapter/parser/router chain stays REAL. ──────────────
// V4 transport must never be touched: `src/canvas/conversation/turnService`.
vi.mock('../../conversation/turnService', () => ({
  callOrchestratorTurn: vi.fn(),
  streamOrchestratorTurn: vi.fn(),
  OrchestratorError: class OrchestratorError extends Error {},
}))
vi.mock('../../../v5/streamedTurnTransport', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  openV5TurnStream: async () => {
    throw new TypeError('Failed to fetch')
  },
}))
vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('../../../services/scenarioService', () => ({
  loadScenario: async () => null,
  storeAnalysis: async () => undefined,
}))
vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))
/**
 * ⚠ WITHOUT THIS THERE IS NO TURN AT ALL, AND THE FIRST RUN OF THIS FILE PROVED
 * IT: `sendSystemEvent` opens with `if (!isOrchestratorV2Enabled()) return
 * SEND_BLOCKED`, and that flag comes from `netlify.toml`'s build environment,
 * which vitest never reads. So every case failed on "fetch was never called" —
 * the harness had been asserting a network that could not happen.
 *
 * It is the deployed posture, not a convenience: `VITE_ENABLE_ORCHESTRATOR_V2`
 * is `"true"` in `[build.environment]`, so production and staging both take
 * this branch. Every other flag stays REAL (`importOriginal`) — the success path
 * reads several and a hand-listed mock would throw on the first one it omitted,
 * which is the flags-mock trap this repo has paid for before.
 */
vi.mock('../../../flags', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isOrchestratorV2Enabled: () => true,
    isOrchestratorStreamingEnabled: () => false,
  }
})
vi.mock('../../../v5/eligibility', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isV5Eligible: () => ({ eligible: true }),
  isV5CanonicalRunPath: () => false,
}))
/**
 * ⚠⚠ `importOriginal` SPREAD, AND THE PARTIAL FACTORY IS WHY THIS FILE FAILED.
 *
 * A `vi.mock` factory REPLACES the module. The two-export version left every
 * other member undefined, and a SUCCESSFUL apply reaches the real
 * `appliedEditPulse`, which calls `fitNodesOnCanvas(...)` — so the receipt tests
 * only broke once they started working, with an uncaught `TypeError` raised from
 * a delayed timer during teardown rather than from any assertion.
 *
 * That is CLAUDE.md trap 12 in its original form, and the fix is the one the
 * trap prescribes: spread the real module and override only what this file needs
 * to stay out of the DOM. `fitNodesOnCanvas` is deliberately left REAL — it
 * fail-closes to a no-op when no canvas fit is registered, which is exactly the
 * jsdom case, so the pulse runs the same code a browser would.
 *
 * ⏱ ON THE PULSE'S OWN TIMER, since it is the other half of the return: it
 * schedules a `PULSE_DURATION_MS` clear that outlives the test. It is left to
 * fire rather than cancelled, because with the module whole its callback only
 * writes EMPTY highlight sets into a module-level store that outlives every
 * test, and nothing here reads highlight state. Flushing 2s per case to prove
 * that would cost more than it establishes. If a future assertion in this file
 * ever reads highlights, that reasoning stops holding and the timer must be
 * controlled — stated here so the next reader inherits the condition, not just
 * the decision.
 */
vi.mock('../../utils/focusHelpers', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

// The one declaration that decides whether this surface offers the control.
const authority = vi.hoisted(() => ({ value: 'server_graph' as string }))
vi.mock('../../mutations/mutationAuthority', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    get CANONICAL_EDIT_AUTHORITY() {
      return {
        ...(actual.CANONICAL_EDIT_AUTHORITY as Record<string, string>),
        modelOptionIntervention: authority.value,
      }
    },
  }
})

import { useCanvasStore } from '../../store'
import { ConversationProvider, useOptionalConversationContext } from '../../conversation/ConversationContext'
import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { openOutlineGroups } from './openOutlineGroups'

const OPTION = 'opt_leeds'
const FACTOR = 'fac_capex'
const GOAL = 'goal_service'
const HASH = '9f2c1b0ae4d37c5a'
const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'

function nodes(): Node[] {
  return [
    {
      id: FACTOR, type: 'factor', position: { x: 0, y: 0 },
      data: { label: 'Capital expenditure', kind: 'factor' },
    },
    {
      id: OPTION, type: 'option', position: { x: 0, y: 0 },
      data: { label: 'Open Leeds', kind: 'option', interventions: { [FACTOR]: 0.2 } },
    },
    // ⚠ A GOAL IS NOT DECORATION HERE. `analysis_ready.goal_node_id` is
    // `z.string().optional()` — NOT nullable — and `analysis_ready` is FATAL to
    // the parse when it fails its schema ("it carries the turn's substance").
    // The first version of the receipt fixture carried `goal_node_id: null`,
    // borrowed from the RECEIPT's own nullable convention, so the whole response
    // failed to parse, routed as an error, and never reached the reconcile. The
    // value simply stayed at 0.2 and said nothing about why.
    {
      id: GOAL, type: 'goal', position: { x: 0, y: 0 },
      data: { label: 'Service quality', kind: 'goal' },
    },
  ] as unknown as Node[]
}

/** Captured so a test can take the in-flight lock the way a real turn does. */
let conversation: ReturnType<typeof useOptionalConversationContext> = null
function CaptureConversation() {
  conversation = useOptionalConversationContext()
  return null
}

/**
 * ⚠ THE NODES PROP IS A STORE SUBSCRIPTION, as it is in production: `OutputsDock`
 * reads `nodes: s.nodes` and threads it down through `ModelTabBody`. A fixed
 * array here would make the applied receipt invisible to the row — the seam this
 * file exists to prove.
 */
function StoreBoundPanel() {
  const storeNodes = useCanvasStore(s => s.nodes)
  const scenarioId = useCanvasStore(s => s.currentScenarioId)
  const baseHash = useCanvasStore(s => s.lastServerGraphHash)
  return (
    <ModelTabV2Panel
      nodes={storeNodes as Node[]}
      edges={[]}
      goalThreshold={null}
      currentScenarioId={scenarioId}
      lastServerGraphHash={baseHash}
    />
  )
}

function renderMounted() {
  const n = nodes()
  useCanvasStore.setState(
    { nodes: n, edges: [], lastServerGraphHash: HASH, currentScenarioId: SCENARIO } as never,
    false,
  )
  render(
    <ConversationProvider>
      <CaptureConversation />
      <StoreBoundPanel />
    </ConversationProvider>,
  )
  openOutlineGroups()
  fireEvent.click(screen.getByTestId(`model-row-v2-${OPTION}`))
}

function commit(value: string) {
  fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-value`))
  fireEvent.change(screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-input`), {
    target: { value },
  })
  fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-save`))
}

function noticeText(): string {
  return screen.queryByTestId(`model-detail-v2-intervention-${FACTOR}-notice`)?.textContent ?? ''
}

function interventionInStore(): unknown {
  const option = useCanvasStore.getState().nodes.find(n => n.id === OPTION)
  return ((option?.data as { interventions?: Record<string, unknown> })?.interventions ?? {})[FACTOR]
}

beforeEach(() => {
  conversation = null
  authority.value = 'server_graph'
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  cleanup()
})

describe('a fetch that was MADE and then rejected', () => {
  it('⭐ the row claims neither sent nor saved, and offers no retry it cannot justify', async () => {
    // The stub records the call FIRST — that record is the acceptance the client
    // can actually observe — and only then rejects, exactly as a connection
    // dropped after CEE committed would appear here.
    const fetchStub = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    vi.stubGlobal('fetch', fetchStub)

    renderMounted()
    commit('0.6')

    // The request LEFT. Whatever the row says next, it may not say otherwise.
    await waitFor(() => expect(fetchStub).toHaveBeenCalled())
    await waitFor(() => expect(noticeText()).toMatch(/could not confirm/i))

    expect(noticeText()).not.toMatch(/not sent/i)
    expect(noticeText()).not.toMatch(/try again/i)
    expect(noticeText()).not.toMatch(/still in flight/i)
    // And no local optimistic value stands in for the answer.
    expect(interventionInStore()).toBe(0.2)
  })

  it('⭐ CONTRAST: a genuine SEND_BLOCKED makes NO fetch at all, and only it says "not sent"', async () => {
    // A turn is taken and never settles, so the sender refuses the dispatch
    // outright. That is the ONE pre-dispatch proof on this path — a fact about
    // the client's own behaviour, not an inference about the network's — and it
    // is the only settlement entitled to claim the edit was not sent.
    const fetchStub = vi.fn(() => new Promise<Response>(() => {}))
    vi.stubGlobal('fetch', fetchStub)

    renderMounted()
    await waitFor(() => expect(conversation).not.toBeNull())
    await act(async () => {
      void conversation?.sendMessage('take the lock')
      await Promise.resolve()
    })
    const callsBeforeEdit = fetchStub.mock.calls.length

    commit('0.6')
    await waitFor(() => expect(noticeText()).toMatch(/still in flight/i))

    // ZERO fetches for the edit itself — the proof, stated as a count rather
    // than inferred from the copy.
    expect(fetchStub.mock.calls.length).toBe(callsBeforeEdit)
    expect(noticeText()).toMatch(/not sent/i)
    expect(interventionInStore()).toBe(0.2)
  })
})

/**
 * ⭐⭐⭐ THE APPLIED HALF, END TO END — a real canonical receipt settles the row.
 *
 * Everything else on this surface proves what happens when the turn FAILS. This
 * proves the one that matters: CEE commits, returns the committed postimage as
 * the canonical receipt CEE #1408 attaches, and the number the user typed stops
 * being a claim and becomes the model.
 *
 * ⚠ THE VALUE ARRIVES THROUGH THE REAL RECEIVER, NOT A STORE WRITE. Real
 * `callV5Turn` → real parser → real `routeV5Response` → `useConversation`'s
 * applied-edit branch → `reconcileAppliedGraph` → `overlayNode` →
 * `data.interventions` → the row's canonical settlement. Only `fetch` is mocked.
 * Nothing here injects the value the assertion then reads back.
 *
 * ⚠ AND `analysis_ready.options` CARRIES THE SAME NUMBER, DELIBERATELY.
 * `reconcileAppliedGraph` finishes by calling `backfillInterventionsOntoOptionNodes`
 * from `ceeAnalysisReady`, so a fixture whose readiness disagreed with its own
 * receipt would silently overwrite the committed value — and would be lying
 * about CEE, whose arm derives both from ONE authority
 * (`buildCanonicalAnalysisReadyFromGraph`) precisely so they cannot disagree.
 */
describe('a committed receipt, through the real receiver', () => {
  /** The canonical committed receipt CEE #1408 attaches, as the wire carries it. */
  function committedBody() {
    // ⚠ ATOMIC RECONCILE: a canvas node absent from the receipt is DELETED, so
    // the receipt carries the whole committed graph, exactly as CEE's does.
    const wireNodes = [
      { id: FACTOR, kind: 'factor', label: 'Capital expenditure' },
      { id: OPTION, kind: 'option', label: 'Open Leeds', interventions: { [FACTOR]: 0.6 } },
      { id: GOAL, kind: 'goal', label: 'Service quality' },
    ]
    return {
      response_version: 2,
      assistant_text: 'Set the effect of Open Leeds on Capital expenditure to 0.6.',
      blocks: [],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'analyse',
      graph_hash: 'committed-hash-after-edit',
      draft_graph: {
        nodes: wireNodes,
        edges: [],
        node_count: wireNodes.length,
        edge_count: 0,
        // The three a canonical transactional producer must own.
        options: [
          { id: OPTION, label: 'Open Leeds', interventions: { [FACTOR]: 0.6 }, is_baseline: false },
        ],
        goal_node_id: GOAL,
        goal_constraints: [],
      },
      analysis_ready: {
        status: 'ready',
        options: [
          { id: OPTION, label: 'Open Leeds', interventions: { [FACTOR]: 0.6 }, is_baseline: false },
        ],
        goal_node_id: GOAL,
      },
    }
  }

  it('⭐ the typed number becomes the model, and the row stops claiming', async () => {
    const body = committedBody()
    const fetchStub = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response))
    vi.stubGlobal('fetch', fetchStub)

    renderMounted()
    commit('0.6')

    // ⭐ SELF-DIAGNOSING, AND IT EARNED THE LINE. When this fixture's
    // `analysis_ready` was invalid the response failed to parse and routed as an
    // error, and the only symptom was `expected 0.2 to be 0.6` — a value
    // assertion reporting a parse failure. A turn that FAILED says so here.
    await waitFor(() => expect(fetchStub).toHaveBeenCalled())
    expect(noticeText(), 'the turn failed before the receipt could apply').toBe('')

    // The value lands in the CANONICAL store — the model the rest of the
    // surface reads — carried by the receipt, not written by this test.
    await waitFor(() => expect(interventionInStore()).toBe(0.6))

    // And the row settles: no pending claim, no notice, nothing left to press.
    await waitFor(() =>
      expect(
        screen.queryByTestId(`model-detail-v2-intervention-${FACTOR}-pending`),
      ).not.toBeInTheDocument(),
    )
    expect(noticeText()).toBe('')
    expect(
      screen.queryByTestId(`model-detail-v2-intervention-${FACTOR}-save`),
    ).not.toBeInTheDocument()

    // ⭐ AND IT IS VISIBLE, which is the acceptance wording and not a synonym
    // for the store assertion above: the row renders from the projection, so
    // this is the last hop between a committed value and a user seeing it.
    await waitFor(() =>
      expect(
        screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-value`).textContent ?? '',
      ).toContain('0.6'),
    )
  })

  it('⚠ DISCRIMINATING TWIN: a receipt carrying a DIFFERENT value does not settle it', async () => {
    // Without this, the case above would pass on a row that clears whenever any
    // response arrives — which is the optimistic receipt wearing a server hat.
    const body = committedBody()
    ;(body.draft_graph.nodes[1] as { interventions: Record<string, number> }).interventions[FACTOR] = 0.9
    ;(body.draft_graph.options[0] as { interventions: Record<string, number> }).interventions[FACTOR] = 0.9
    ;(body.analysis_ready.options[0] as { interventions: Record<string, number> }).interventions[FACTOR] = 0.9
    const fetchStub = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response))
    vi.stubGlobal('fetch', fetchStub)

    renderMounted()
    commit('0.6')

    await waitFor(() => expect(interventionInStore()).toBe(0.9))
    // The server moved the model to something the user did not type, so the row
    // must NOT report their number as settled.
    expect(
      screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-pending`),
    ).toBeInTheDocument()
  })
})
