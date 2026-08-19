/**
 * readinessStore — the readiness panel and the run path must assess the SAME
 * model (ROADMAP: readiness/run convergence).
 *
 * THE MECHANISM, derived at CEE `cbc3ea3d` (`src/routes/assist.v1.graph-readiness.ts`)
 * and at this UI tip, not inherited:
 *
 *   const GraphReadinessInput = z.object({
 *     graph: Graph,
 *     analysis_ready: AnalysisReadyPayload.optional(),
 *     scenario_id: z.string().min(1).optional(),
 *   });
 *   ...
 *   let assessedGraph: unknown = input.graph;
 *   let assessedFrom = "request_graph";
 *   if (input.scenario_id) {
 *     const persisted = await loadPersistedScenarioStateStrict(input.scenario_id);
 *     if (persisted.graph != null) { assessedGraph = persisted.graph; assessedFrom = "persisted"; }
 *   }
 *
 * So CEE runs ONE predicate (`assessRouteAdmission` →
 * `assessCanonicalAnalysisReadiness`, the same whole-model authority the TURN
 * path uses) over one of TWO inputs, and the caller picks which by supplying
 * `scenario_id` or not. The run path always reads the PERSISTED scenario. This
 * projection has never sent `scenario_id`, so the panel has always been
 * answered over `request_graph` — the browser's LOCAL copy. Same predicate,
 * two inputs, and the divergence is exactly how the panel can read "3/3 ready"
 * about a model the analysis turn never sees.
 *
 * ⚠ STATE-CLASS, and it is load-bearing rather than a nicety (CLAUDE.md
 * fixture state-class rule). A guest, or a canvas drafted but not yet saved,
 * has NO scenario id. For those callers `request_graph` is the CORRECT input —
 * CEE's own comment says so ("the fallback is not a failure path"). Two things
 * therefore have to hold at once, and they are tested separately below:
 *   · a SAVED canvas sends the id, so both authorities read the persisted model;
 *   · an UNSAVED canvas sends NO `scenario_id` KEY AT ALL. Not an empty string:
 *     CEE's schema is `z.string().min(1)`, so `""` is a validation failure, not
 *     a benign no-op — it would 400 every guest readiness request.
 *
 * ⚠ WHAT THIS CHANGE ALONE DOES TO THE PANEL, stated because it reads as a
 * regression and is not one: where the persisted graph lags the canvas, the
 * panel will start reporting the value MISSING — which is what the run path
 * has been seeing all along. Agreement is the point; the remedy for the lag is
 * the coupled CEE `options[]`-sync work, not a projection that flatters.
 *
 * Scope note (CLAUDE.md trap 3): every assertion here is on the built payload,
 * on the request body, or on module/store state. Nothing here is a visibility
 * claim — jsdom cannot make one.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import {
  buildReadinessPayload,
  useReadinessStore,
  WATCHED_ROOTS,
  type ReadinessPayloadInputs,
} from '../readinessStore'
import { useCanvasStore } from '../../store'
import { clearInflightCache } from '../../hooks/useGraphReadiness'

// ── Pure-builder half ──────────────────────────────────────────────

function factorNode(id: string, label: string): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { kind: 'factor', label },
  } as Node
}

/**
 * Build the payload with EXACTLY the declared input slice. Typed as
 * `ReadinessPayloadInputs` rather than cast to `any` deliberately: the
 * interface is half of this change, so a projection that emitted the field
 * without declaring the input would fail the typecheck gate here.
 */
function payloadFor(currentScenarioId: string | null | undefined): Record<string, unknown> {
  const nodes: Node[] = [factorNode('fac_price', 'Price'), factorNode('fac_churn', 'Churn')]
  const edges: Edge[] = []
  const inputs: ReadinessPayloadInputs = {
    nodes,
    edges,
    ceeAnalysisReady: null,
    currentBriefText: null,
    currentScenarioId,
  }
  return JSON.parse(buildReadinessPayload(inputs)) as Record<string, unknown>
}

const hasKey = (o: Record<string, unknown>, k: string): boolean =>
  Object.prototype.hasOwnProperty.call(o, k)

describe('buildReadinessPayload — scenario_id reaches CEE so both authorities read the persisted model', () => {
  // ── Positive control first (CLAUDE.md trap 13) ───────────────────
  //
  // Three assertions below are ABSENCE claims. They are worth nothing until
  // the same helper is shown capable of producing a PRESENCE, and until the
  // payload it parses is shown to be a real payload rather than `{}` — an
  // absence probe over an empty object passes forever.
  it('positive control: the helper builds a real payload and CAN emit scenario_id', () => {
    const saved = payloadFor('scn_control_9f2a')
    expect(((saved.graph as { nodes: unknown[] }).nodes ?? []).length).toBe(2)
    expect(hasKey(saved, 'scenario_id')).toBe(true)
  })

  it('sends the scenario_id the store holds, by identity, when the canvas IS saved', () => {
    // Bound by IDENTITY to the exact id under test, and asserted for TWO
    // distinct ids. A single id would also be satisfied by a hardcoded
    // constant or by any other string the builder happened to have to hand;
    // two distinct ids can only be satisfied by reading the input.
    expect(payloadFor('scn_alpha_7c31').scenario_id).toBe('scn_alpha_7c31')
    expect(payloadFor('scn_beta_4e08').scenario_id).toBe('scn_beta_4e08')
  })

  it('omits the scenario_id KEY entirely for a guest canvas that was never saved', () => {
    // `null` is the canvas store's initial value (`store.ts` — currentScenarioId
    // is set only by save/load). CEE assesses `request_graph` for this caller,
    // which is the correct answer for it.
    const guest = payloadFor(null)
    expect(hasKey(guest, 'scenario_id')).toBe(false)
    expect(guest.scenario_id).toBeUndefined()
    // …and the rest of the payload is still fully formed, so the absence above
    // is an absence of ONE key, not of the whole request.
    expect(((guest.graph as { nodes: unknown[] }).nodes ?? []).length).toBe(2)
  })

  it('omits the scenario_id KEY when the id is undefined (pre-hydration canvas)', () => {
    const preHydration = payloadFor(undefined)
    expect(hasKey(preHydration, 'scenario_id')).toBe(false)
  })

  it('never sends an empty string — CEE types the field z.string().min(1), so "" is a 400', () => {
    const empty = payloadFor('')
    expect(hasKey(empty, 'scenario_id')).toBe(false)
    expect(empty.scenario_id).not.toBe('')
  })

  it('names currentScenarioId as a watched root, so saving re-asks the question', () => {
    expect([...WATCHED_ROOTS]).toContain('currentScenarioId')
  })
})

// ── Wire half: the body CEE actually receives ──────────────────────
//
// The builder tests above prove the projection. These prove the REQUEST — a
// correct builder whose output never reaches `fetch` would satisfy every
// assertion above (CLAUDE.md trap 16: a symbol proves presence-in-repo, never
// presence-on-the-wire).

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })

function okResponse() {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () =>
      Promise.resolve({
        readiness_score: 88,
        readiness_level: 'ready',
        can_run_analysis: true,
        confidence_explanation: 'Ready to analyse',
        improvements: [],
      }),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  }
}

function requestBody(callIndex: number): Record<string, unknown> {
  const init = mockFetch.mock.calls[callIndex]?.[1]
  return JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
}

function seedCanvas(currentScenarioId: string | null) {
  useCanvasStore.setState({
    nodes: [factorNode('fac_price', 'Price'), factorNode('fac_churn', 'Churn')] as never,
    edges: [] as never,
    ceeAnalysisReady: null,
    currentBriefText: null,
    currentScenarioId,
  } as never)
}

describe('readinessStore request — the wire carries the scenario id, and only when there is one', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockFetch.mockReset()
    mockFetch.mockResolvedValue(okResponse())
    useReadinessStore.getState().reset()
    clearInflightCache()
  })

  afterEach(() => {
    useReadinessStore.getState().reset()
    clearInflightCache()
    vi.useRealTimers()
  })

  it('posts scenario_id for a SAVED canvas, bound to that canvas’s id', async () => {
    seedCanvas('scn_wire_1d4b')
    useReadinessStore.getState().startListening()
    await vi.runAllTimersAsync()

    // Positive control: a request was actually made. Zero requests would make
    // every body assertion below vacuous.
    expect(mockFetch).toHaveBeenCalled()
    expect(requestBody(0).scenario_id).toBe('scn_wire_1d4b')
  })

  it('posts NO scenario_id key for a guest canvas', async () => {
    seedCanvas(null)
    useReadinessStore.getState().startListening()
    await vi.runAllTimersAsync()

    expect(mockFetch).toHaveBeenCalled()
    const body = requestBody(0)
    // The request is real and fully formed…
    expect(((body.graph as { nodes: unknown[] }).nodes ?? []).length).toBe(2)
    // …and carries no scenario_id at all, so CEE assesses request_graph.
    expect(hasKey(body, 'scenario_id')).toBe(false)
  })

  it('asks again when an unsaved canvas is SAVED, because the assessed model changes', async () => {
    // This is the behavioural reason `currentScenarioId` must be a watched
    // root. Nothing else about the model moves here: the same nodes, the same
    // edges, the same brief. Only the assessed SOURCE changes — guest/local to
    // persisted — and that is a different question, so it must be re-asked.
    seedCanvas(null)
    useReadinessStore.getState().startListening()
    await vi.runAllTimersAsync()
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(hasKey(requestBody(0), 'scenario_id')).toBe(false)

    clearInflightCache()
    useCanvasStore.setState({ currentScenarioId: 'scn_saved_88ac' } as never)
    await vi.runAllTimersAsync()

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(requestBody(1).scenario_id).toBe('scn_saved_88ac')
  })
})
