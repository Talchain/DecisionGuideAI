/**
 * A VERDICT MAY NOT BECOME AUTHORITATIVE OVER A GRAPH THE USER DOES NOT HAVE
 * — the provisional-delivery divergence guards.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT, ESTABLISHED BY EXERCISING THE REAL MODULES AT `3953d958`
 * ═══════════════════════════════════════════════════════════════════════════
 * `applyScenarioAnalysisRead` wrote CEE's verdict with NO acceptance gate. The
 * gate added for the boot leg lives in `serverGraphHydration`, and this leg
 * does not go through it.
 *
 * Its own header's safety argument is that the polling leg asks *"has the run I
 * just watched start finished?"* — premise: **the canvas has not moved since
 * that run was armed**. A REFUSED BOOT falsifies exactly that premise. After
 * `mergeRefused` the canvas holds the user's graph and CEE holds a different
 * one, and this leg READS the server graph but never merges it, so nothing
 * reconciles them before the verdict lands.
 *
 * THE SEQUENCE (pinned below, end to end, with the REAL modules):
 *   refused boot → a NEW run arms this leg → the poll delivers CEE's verdict
 *   about ITS graph as the wire authority over the user's own.
 * Boot alone cannot arm it — it arms on `running`, which is boot-declined — so
 * this needed its own repair rather than riding the boot fix.
 *
 * ⚠⚠ SCOPE, AND IT TRAVELS WITH THIS FIX EVERYWHERE:
 * REACHABLE IN CODE, CONDITIONAL ON A REFUSED BOOT, WHICH HAS NOT BEEN OBSERVED
 * LIVE. These tests prove that GIVEN a refused boot the harm follows. They do
 * NOT prove refused boots reach real users. And they are store-level: jsdom
 * cannot show the rendered sentence.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TWO HARMS, PARAMETERISED SEPARATELY — the point of the whole change
 * ═══════════════════════════════════════════════════════════════════════════
 *   `divergent_currency_claim`  MISINFORMS — a freshness claim about a graph
 *                               the user never had.
 *   `divergent_block_claim`     REMOVES THE USER'S ACTION — strictly worse, in
 *                               this module's own words.
 * They decline on the same FACT today and are still kept apart, so that
 * relaxing one can never silently relax the other. Each has its own kind-set,
 * its own reason, and its own tests below.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { fetchScenarioGraph } from '../../../adapters/cee/scenarioGraph'
import {
  runProvisionalDeliverySchedule,
  readProvisionalApplyStore,
} from '../../hooks/useProvisionalAnalysisDelivery'
import {
  applyScenarioAnalysisRead,
  DIVERGENT_DECLINED_CURRENCY_KINDS,
  DIVERGENT_DECLINED_BLOCK_KINDS,
  READ_TERMINAL_RUN_STATE_KINDS,
} from '../applyScenarioAnalysisRead'

const SCENARIO_ID = '11111111-2222-4333-8444-555555555555'
const CEE_TOKEN = 'c'.repeat(63) + '9'
const SERVER_INSTANT = '2026-08-25T09:00:00.000Z'

function envelope() {
  return {
    kind: 'graph_identity_hash',
    value: CEE_TOKEN,
    algorithm: 'sha256',
    projection_version: 'identity.v1',
    graph_schema_version: 'graph_v3',
    normaliser_version: '1',
  }
}

function verdict(runState: AnalysisStateV1['run_state']): AnalysisStateV1 {
  return {
    run_state: runState,
    readiness: { status: 'ready', blockers: [] },
    leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
    robustness: {},
    usable_for_prose: false,
    usable_for_chips: false,
    usable_for_followup: false,
    requires_rerun: true,
    blocked_unusable: false,
    contradictions: [],
  } as AnalysisStateV1
}

const SERVER_VERDICT = verdict({
  kind: 'complete_stale',
  computed_at: SERVER_INSTANT,
  cause: 'graph_changed',
})

const RUNNING_VERDICT = verdict({
  kind: 'running',
  started_at: '2026-08-25T10:00:00.000Z',
} as never)

/**
 * ⚠ `blocked_unusable: true` IS REQUIRED alongside `kind: 'blocked'`.
 * Paired with `false`, the `.strict()` schema rejects the verdict, it arrives
 * as `null`, and the leg returns `deadline` — WHICH IS INDISTINGUISHABLE FROM
 * THE GUARD WORKING. A malformed fixture manufactures the exact result these
 * tests exist to detect, so the parse control below is what makes any assertion
 * about `blocked` mean anything at all.
 */
function blockedVerdict(): AnalysisStateV1 {
  const v = verdict({ kind: 'blocked', reason_code: 'no_options', blockers: [] } as never)
  ;(v as { blocked_unusable: boolean }).blocked_unusable = true
  return v
}

function unrelatedGraph() {
  return {
    nodes: [
      { id: 'server-a', kind: 'factor', label: 'Their factor' },
      { id: 'server-b', kind: 'goal', label: 'Their goal' },
    ],
    edges: [],
  }
}

function okBody(over: Record<string, unknown> = {}) {
  return {
    schema: 'scenario_graph.v1',
    scenario_id: SCENARIO_ID,
    graph: unrelatedGraph(),
    graph_present: true,
    brief_text: null,
    graph_identity_hash: envelope(),
    layout_present: false,
    request_id: 'divergence-guard',
    ...over,
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response
}

/** The user's OWN graph. Node ids deliberately disjoint from the server's. */
function seedLocalCanvas(over: Record<string, unknown> = {}): void {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [
      { id: 'local-1', type: 'factor', position: { x: 10, y: 20 }, data: { label: 'My spend', kind: 'factor' } },
      { id: 'local-2', type: 'goal', position: { x: 300, y: 400 }, data: { label: 'My profit', kind: 'goal' } },
    ] as never,
    edges: [] as never,
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    importPendingServerRegistration: false,
    history: { past: [], future: [] },
    analysisStateV1: null,
    analysisFreshnessDirty: false,
    ...over,
  } as never)
}

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
  seedLocalCanvas()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const storedVerdict = () => useCanvasStore.getState().analysisStateV1 ?? null
const canvasIds = () => useCanvasStore.getState().nodes.map((n: { id: string }) => n.id)
const immediate = async () => {}

function poll() {
  return runProvisionalDeliverySchedule({
    scenarioId: SCENARIO_ID,
    userId: null,
    signal: new AbortController().signal,
    read: fetchScenarioGraph,
    wait: immediate,
    delays: [0],
  })
}

/** Drive the real refused boot, then arm a new run. Returns at the armed state. */
async function refusedBootThenNewRun(): Promise<void> {
  fetchSpy.mockResolvedValue(jsonResponse(200, okBody({ analysis_state: SERVER_VERDICT })))
  expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('mergeRefused')
  expect(storedVerdict()).toBeNull()
  useCanvasStore.getState().setAnalysisStateV1(RUNNING_VERDICT)
}

// ═══════════════════════════════════════════════════════════════════════════
describe('the two kind-sets partition the terminal set — derived, not mirrored', () => {
  it('their union EQUALS READ_TERMINAL_RUN_STATE_KINDS, with no overlap', () => {
    // Trap 12d: derivation proves agreement, a corpus proves completeness. This
    // is the completeness half — a NEW terminal kind landing in neither set
    // would slip through both guards unclassified, and this REDs if it does.
    const union = [...DIVERGENT_DECLINED_CURRENCY_KINDS, ...DIVERGENT_DECLINED_BLOCK_KINDS]
    expect([...union].sort()).toEqual([...READ_TERMINAL_RUN_STATE_KINDS].sort())
    expect(new Set(union).size).toBe(union.length)
  })
})

describe('⭐ DIVERGENT — a verdict about a graph the user does not have is WITHHELD', () => {
  it('POSITIVE CONTROL — the boot genuinely refuses, so the divergence is real', async () => {
    await refusedBootThenNewRun()
    expect(canvasIds()).toEqual(['local-1', 'local-2'])
    expect(useCanvasStore.getState().lastAuthoritativeGraph).toBeNull()
    // And the store view actually reports divergence — otherwise every
    // assertion below would pass because the guard never ran.
    expect(readProvisionalApplyStore().graphAcceptedForCanvas).toBe(false)
  })

  it('⭐ MISINFORMATION HARM — `complete_stale` is withheld, and NOTHING is written', async () => {
    await refusedBootThenNewRun()

    expect(await poll()).toBe('withheld')

    // The armed `running` verdict is still standing — withholding must not
    // DESTROY a belief, only decline to add a false one.
    expect(storedVerdict()?.run_state.kind).toBe('running')
    expect(canvasIds()).toEqual(['local-1', 'local-2'])
  })

  it('⭐ ACTION-REMOVAL HARM — a `blocked` verdict is withheld (the worse half)', async () => {
    await refusedBootThenNewRun()
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody({ analysis_state: blockedVerdict() })))

    // PARSE CONTROL FIRST — prove the fixture survives `.strict()`, or a
    // rejected verdict would fake this exact result.
    const parsed = await fetchScenarioGraph(SCENARIO_ID)
    expect(parsed.status === 'graph' && parsed.analysisState?.run_state.kind).toBe('blocked')

    expect(await poll()).toBe('withheld')
    expect(storedVerdict()?.run_state.kind).toBe('running')
  })

  it('the two harms are reported as DIFFERENT reasons, never fused', () => {
    const divergent = { graphAcceptedForCanvas: false, setAnalysisStateV1: () => {} }
    const currency = applyScenarioAnalysisRead({
      analysisState: SERVER_VERDICT, analysisResult: null, store: divergent,
    })
    const block = applyScenarioAnalysisRead({
      analysisState: blockedVerdict(), analysisResult: null, store: divergent,
    })
    expect(currency).toEqual({ outcome: 'declined', kind: 'complete_stale', reason: 'divergent_currency_claim' })
    expect(block).toEqual({ outcome: 'declined', kind: 'blocked', reason: 'divergent_block_claim' })
    // The load-bearing assertion: the reasons DIFFER. A single fused predicate
    // would still withhold both and pass every test above.
    expect(currency.outcome === 'declined' && currency.reason)
      .not.toBe(block.outcome === 'declined' && block.reason)
  })

  it('a divergent read writes no RESULTS either — declined before hydration', async () => {
    const writes: string[] = []
    const out = applyScenarioAnalysisRead({
      analysisState: SERVER_VERDICT,
      analysisResult: { type: 'analysis_result' },
      store: {
        graphAcceptedForCanvas: false,
        setAnalysisStateV1: () => writes.push('verdict'),
        resultsComplete: () => writes.push('results'),
        currentResultsHash: null,
      },
    })
    expect(out.outcome).toBe('declined')
    // Showing results computed on a graph the user does not have is the same
    // lie with a bigger surface.
    expect(writes).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('⭐ THE OTHER DOOR — an honest canvas still receives its verdict', () => {
  it('an ACCEPTED boot leaves no divergence, and delivery proceeds', async () => {
    useCanvasStore.setState({
      nodes: [
        { id: 'server-a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Their factor', kind: 'factor' } },
        { id: 'server-b', type: 'goal', position: { x: 1, y: 1 }, data: { label: 'Their goal', kind: 'goal' } },
      ] as never,
    } as never)
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody({ analysis_state: SERVER_VERDICT })))
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('merged')
    expect(readProvisionalApplyStore().graphAcceptedForCanvas).toBe(true)

    useCanvasStore.getState().setAnalysisStateV1(RUNNING_VERDICT)
    expect(await poll()).toBe('delivered')
    expect(storedVerdict()?.run_state.kind).toBe('complete_stale')
    expect((storedVerdict()?.run_state as { computed_at?: string })?.computed_at).toBe(SERVER_INSTANT)
  })

  it('an EMPTY canvas is NOT divergent — there is no local graph to misdescribe', async () => {
    // The over-fix this guards against: treating an empty canvas as divergent
    // would withhold the verdict on a fresh scenario, closing the lie by
    // opening a gap. The zero-overlap guard calls this case "the whole point".
    seedLocalCanvas({ nodes: [] as never })
    expect(readProvisionalApplyStore().graphAcceptedForCanvas).toBe(true)

    useCanvasStore.getState().setAnalysisStateV1(RUNNING_VERDICT)
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody({ analysis_state: SERVER_VERDICT })))
    expect(await poll()).toBe('delivered')
    expect(storedVerdict()?.run_state.kind).toBe('complete_stale')
  })

  it('an UNSUPPLIED store field fails OPEN — a caller without the concept is unchanged', () => {
    const out = applyScenarioAnalysisRead({
      analysisState: SERVER_VERDICT,
      analysisResult: null,
      store: { setAnalysisStateV1: () => {} },
    })
    expect(out.outcome).toBe('applied')
  })

  it('`graphAcceptedForCanvas: true` applies the verdict, including `blocked`', () => {
    const seen: string[] = []
    const out = applyScenarioAnalysisRead({
      analysisState: blockedVerdict(),
      analysisResult: null,
      store: { graphAcceptedForCanvas: true, setAnalysisStateV1: () => seen.push('w') },
    })
    expect(out).toEqual({ outcome: 'applied', kind: 'blocked', resultsHydrated: false })
    expect(seen).toEqual(['w'])
  })
})

describe('the pre-existing declines are untouched by the divergence guards', () => {
  it('a NON-TERMINAL kind is still `notYet`, even when divergent', () => {
    const out = applyScenarioAnalysisRead({
      analysisState: RUNNING_VERDICT,
      analysisResult: null,
      store: { graphAcceptedForCanvas: false, setAnalysisStateV1: () => {} },
    })
    // Ordering matters: the H4 guard must win, or `running` would be reported
    // as a divergence decline and the caller would stop polling a live run.
    expect(out).toEqual({ outcome: 'notYet', reason: 'non_terminal_kind' })
  })

  it('an ABSENT verdict is still `no_verdict`, even when divergent', () => {
    const out = applyScenarioAnalysisRead({
      analysisState: null,
      analysisResult: null,
      store: { graphAcceptedForCanvas: false, setAnalysisStateV1: () => {} },
    })
    expect(out).toEqual({ outcome: 'notYet', reason: 'no_verdict' })
  })
})
