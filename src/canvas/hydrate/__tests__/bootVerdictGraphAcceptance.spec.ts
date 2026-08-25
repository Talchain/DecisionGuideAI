/**
 * BOOT'S ANALYSIS VERDICT IS GATED ON GRAPH ACCEPTANCE — the A3 truth spec.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT, DERIVED AT `01755479` (deployed staging tip)
 * ═══════════════════════════════════════════════════════════════════════════
 * `hydrateCanvasFromServer` calls `applyBootAnalysisVerdict`
 * (`serverGraphHydration.ts:192`) BEFORE it knows whether the graph that
 * carried that verdict was accepted — the `merge.accepted` gate is fifty lines
 * further down (`:242`). So on every boot where the MERGE REFUSES, CEE's
 * verdict is still written into `analysisStateV1`.
 *
 * That store field is FEATURE-DETECTED by the selector: a non-null
 * `analysisStateV1` takes the WIRE branch, where the local dirty overlay is not
 * consulted (`analysisStateSelector.ts:551-554`). So the refused server graph's
 * verdict becomes AUTHORITATIVE over the user's own local graph — a graph it
 * has, by the refusal's own definition, nothing to say about.
 *
 * The user is then told "Model changed since this analysis" about a model the
 * analysis never ran on. This is a System-A truth defect: the product asserts
 * something false about the user's own model.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE FOUR REFUSALS, AND WHY EACH ONE MATTERS HERE
 * ═══════════════════════════════════════════════════════════════════════════
 * `mergeServerGraphOnHydrate` refuses on four named reasons
 * (`mergeServerGraph.ts:103-131`), and this spec exercises ALL FOUR rather than
 * only the one Codex's trigger names — a fix aimed at `zeroOverlap` alone would
 * leave three live doors, and the predicate guards one property, not one case:
 *
 *   `zeroOverlap`         Codex's trigger. Two unrelated graphs; the server's
 *                         verdict describes THEIRS, the canvas holds OURS.
 *   `importUnregistered`  The sharpest one. The canvas holds an import the
 *                         server has NEVER SEEN (ROADMAP 2.467/2.503), so
 *                         CEE's verdict is necessarily about the older model.
 *   `emptyServerGraph`    CEE has no graph; a verdict about nothing.
 *   `unusableShape`       Not a graph at all.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ BOTH DIRECTIONS, DELIBERATELY (trap 22b)
 * ═══════════════════════════════════════════════════════════════════════════
 * One predicate here guards two OPPOSITE harms:
 *
 *   too narrow → a refused graph's verdict still lands  (the LIE this closes)
 *   too wide   → an ACCEPTED graph's verdict is dropped (re-opens #842, the
 *                defect whose fix this is layered on top of)
 *
 * A fix that closes the gap must be re-measured against the defect it was
 * written to close, so the accepted-positive block below re-asserts #842's
 * `merged` AND `unchanged` restores with the SAME fixtures. They are not
 * decoration: they are the other door.
 *
 * ⚠ `unchanged` IS AN ACCEPTED PATH, AND THAT IS THE SUBTLE PART. It
 * short-circuits BEFORE the merge runs, so "apply after `merge.accepted`" read
 * literally would drop it. It is accepted because the identity token it matches
 * on is only ever recorded AFTER a merge was accepted
 * (`serverGraphHydration.ts:253`, gated on `!merge.accepted` returning above) —
 * so a token match is proof of a PRIOR acceptance of that exact server graph.
 * Pinned here so that reasoning is a test rather than a comment.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'

const SCENARIO_ID = '11111111-2222-4333-8444-555555555555'
const CEE_TOKEN = 'c'.repeat(63) + '9'

/** The exact instant CEE stamped the verdict — the IDENTITY this spec binds to. */
const COMPUTED_AT = '2026-08-25T09:00:00.000Z'

function envelope(value = CEE_TOKEN, projection = 'identity.v1') {
  return {
    kind: 'graph_identity_hash',
    value,
    algorithm: 'sha256',
    projection_version: projection,
    graph_schema_version: 'graph_v3',
    normaliser_version: '1',
  }
}

function verdict(
  runState: AnalysisStateV1['run_state'],
  over: Partial<AnalysisStateV1> = {},
): AnalysisStateV1 {
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
    ...over,
  } as AnalysisStateV1
}

/**
 * `complete_stale` is the ONLY boot-restorable kind
 * (`BOOT_RESTORABLE_RUN_STATE_KINDS`), which is what makes it the right fixture:
 * every other kind is already declined upstream by `applyBootAnalysisVerdict`,
 * so a spec built on one of those would pass at pristine for the WRONG REASON —
 * the verdict would be absent because the KIND was declined, not because the
 * graph was refused. Codex's trigger names this kind for exactly that reason.
 *
 * ⚠ `cause`, NOT `stale_cause` — the contract schema is `.strict()` and the
 * wrong spelling arrives as `null`, indistinguishable from the fix working.
 * The positive control below is what proves it parses.
 */
const STALE_VERDICT = verdict({
  kind: 'complete_stale',
  computed_at: COMPUTED_AT,
  cause: 'graph_changed',
})

/** A server graph that SHARES node ids with the seeded canvas — merge ACCEPTS. */
function overlappingGraph() {
  return {
    nodes: [
      { id: 'factor-1', kind: 'factor', label: 'Spend', value: 250 },
      { id: 'goal-1', kind: 'goal', label: 'Profit', value: 9 },
    ],
    edges: [],
  }
}

/** A server graph sharing NO node ids with the seeded canvas — merge REFUSES. */
function unrelatedGraph() {
  return {
    nodes: [
      { id: 'unrelated-a', kind: 'factor', label: 'Other' },
      { id: 'unrelated-b', kind: 'goal', label: 'Elsewhere' },
    ],
    edges: [],
  }
}

function okBody(over: Record<string, unknown> = {}) {
  return {
    schema: 'scenario_graph.v1',
    scenario_id: SCENARIO_ID,
    graph: overlappingGraph(),
    graph_present: true,
    brief_text: null,
    graph_identity_hash: envelope(),
    layout_present: false,
    request_id: 'req-boot-acceptance',
    ...over,
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

/**
 * A NON-EMPTY canvas — load-bearing. The `zeroOverlap` guard only fires when
 * `store.nodes.length > 0`; an empty canvas hydrates in full and is the
 * OPPOSITE case. Seeded with the state `hydrateGraphSlice` leaves at boot.
 */
function seedCanvas(over: Record<string, unknown> = {}): void {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [
      {
        id: 'factor-1',
        type: 'factor',
        position: { x: 10, y: 20 },
        data: { label: 'Spend', kind: 'factor', value: 100 },
      },
      {
        id: 'goal-1',
        type: 'goal',
        position: { x: 300, y: 400 },
        data: { label: 'Profit', kind: 'goal', value: 5 },
      },
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
let verdictWrites: (AnalysisStateV1 | null)[]

/**
 * ⚠ CAPTURED ONCE, AT MODULE LOAD — and that is not a style choice.
 *
 * Re-reading the action inside `beforeEach` wraps the wrapper installed by the
 * PREVIOUS test, and because every layer closes over the same module-level
 * `verdictWrites` binding, each one pushes into the CURRENT array. The write
 * count then tracks the TEST INDEX rather than the code under test — measured
 * here at pristine as 8 and 9 writes for a leg that writes at most once.
 *
 * It was caught only because the assertion is an exact count. A `toHaveLength`
 * of "at least one", or an assertion on the store field alone, would have
 * absorbed it silently and left every refusal assertion below resting on an
 * instrument that grows without bound (trap 20: a probe whose answer tracks
 * something other than its input is reporting on itself).
 */
const PRISTINE_SET_ANALYSIS_STATE_V1 = useCanvasStore.getState().setAnalysisStateV1

beforeEach(() => {
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
  seedCanvas()

  // ⚠ WHY A WRITE LOG AND NOT JUST `analysisStateV1 === null`.
  //
  // `applyBootAnalysisVerdict`'s contract distinguishes WRITING NOTHING from
  // writing `null` — "not `null`, which would replace a standing belief with a
  // claim of ignorance" (`applyScenarioAnalysisRead.ts:402-405`). A store field
  // that reads `null` cannot tell those apart, because boot seeds it to `null`.
  // Recording the CALLS makes "the boot leg did not touch this seam" assertable
  // rather than inferred, and it is the assertion a future refactor that writes
  // an explicit `null` on the refusal path would have to break loudly.
  verdictWrites = []
  useCanvasStore.setState({
    setAnalysisStateV1: (v: AnalysisStateV1 | null) => {
      verdictWrites.push(v)
      PRISTINE_SET_ANALYSIS_STATE_V1(v)
    },
  } as never)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function storedVerdict(): AnalysisStateV1 | null {
  return useCanvasStore.getState().analysisStateV1 ?? null
}

// ═══════════════════════════════════════════════════════════════════════════
// POSITIVE CONTROLS — without these the whole file is vacuous
// ═══════════════════════════════════════════════════════════════════════════
describe('positive controls — the fixtures are capable of the thing being denied', () => {
  it('the stale verdict PARSES at the real adapter (not silently null)', async () => {
    const { fetchScenarioGraph } = await import('../../../adapters/cee/scenarioGraph')
    fetchSpy.mockResolvedValue(
      jsonResponse(200, okBody({ analysis_state: STALE_VERDICT })),
    )
    const result = await fetchScenarioGraph(SCENARIO_ID)
    expect(result.status).toBe('graph')
    expect(result.status === 'graph' && result.analysisState?.run_state.kind).toBe(
      'complete_stale',
    )
    // Bind by IDENTITY, not by kind alone — another verdict could be a
    // `complete_stale` too. This is the exact object the refusal tests deny.
    expect(
      result.status === 'graph' &&
        (result.analysisState?.run_state as { computed_at?: string })?.computed_at,
    ).toBe(COMPUTED_AT)
  })

  it('⭐ CONTRAST CONTROL — the SAME verdict IS restored when the graph is ACCEPTED', async () => {
    // The discriminating half. Every refusal assertion below claims an ABSENCE;
    // an absence claim needs a contrast that reads PRESENT in the same run, or
    // it is indistinguishable from a fixture that never worked (trap 13e).
    fetchSpy.mockResolvedValue(
      jsonResponse(200, okBody({ analysis_state: STALE_VERDICT })),
    )
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('merged')
    expect(storedVerdict()?.run_state.kind).toBe('complete_stale')
    expect(verdictWrites).toHaveLength(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ RED-FIRST — THE REFUSAL-NEGATIVE. A refused graph's verdict must not land.
// ═══════════════════════════════════════════════════════════════════════════
describe('⭐ a REFUSED server graph never makes its verdict authoritative', () => {
  it('`zeroOverlap` — Codex`s trigger: an unrelated graph`s `complete_stale` must NOT land', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(
        200,
        okBody({ graph: unrelatedGraph(), analysis_state: STALE_VERDICT }),
      ),
    )

    const outcome = await hydrateCanvasFromServer(SCENARIO_ID)

    // The merge genuinely refused — otherwise this is not the case under test.
    expect(outcome).toBe('mergeRefused')
    // And the canvas was genuinely left alone, so the verdict has nothing to
    // describe. (`lastAuthoritativeGraph` is recorded only on the accepted path.)
    expect(useCanvasStore.getState().lastAuthoritativeGraph).toBeNull()

    // THE DEFECT: at pristine `analysisStateV1` holds the refused graph's
    // `complete_stale`, and the selector's WIRE branch then tells the user their
    // OWN model changed since an analysis that never ran on it.
    expect(storedVerdict()).toBeNull()
    expect(verdictWrites).toEqual([])
  })

  it('`importUnregistered` — a verdict must not land over an import the server has never seen', async () => {
    // The sharpest case: the canvas holds the user's imported work and CEE's
    // verdict is necessarily about the PRE-IMPORT model.
    seedCanvas({ importPendingServerRegistration: true })
    fetchSpy.mockResolvedValue(
      // An OVERLAPPING graph, so the only thing refusing is the import hold —
      // this fails for the named reason rather than incidentally.
      jsonResponse(200, okBody({ analysis_state: STALE_VERDICT })),
    )

    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('mergeRefused')
    expect(storedVerdict()).toBeNull()
    expect(verdictWrites).toEqual([])
  })

  it('`emptyServerGraph` — a verdict about a graph CEE does not have must NOT land', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(
        200,
        okBody({ graph: { nodes: [], edges: [] }, analysis_state: STALE_VERDICT }),
      ),
    )

    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('mergeRefused')
    expect(storedVerdict()).toBeNull()
    expect(verdictWrites).toEqual([])
  })

  it('⚠ `unusableShape` is UNREACHABLE from the wire — the adapter filters it first', async () => {
    // MEASURED, NOT ASSUMED, and it corrects this spec's own first draft, which
    // asserted `mergeRefused` here and RED-ed with `'unusable'`.
    //
    // `mergeServerGraphOnHydrate`'s `unusableShape` guard (`mergeServerGraph.ts:194`)
    // cannot be reached through `hydrateCanvasFromServer`: the adapter rejects a
    // non-object `graph` at `scenarioGraph.ts:267,274` and returns
    // `{ status: 'unusable' }`, which the hydration leg handles on its NON-GRAPH
    // path — before the verdict call site exists at all.
    //
    // So of the merge's four refusal reasons, exactly THREE are reachable here.
    // Recorded as a fact rather than deleted, because a later change to the
    // adapter's shape guard would make the fourth reachable and this test is
    // where that shows up: it would stop returning `'unusable'`.
    fetchSpy.mockResolvedValue(
      jsonResponse(
        200,
        okBody({ graph: 'not-a-graph', analysis_state: STALE_VERDICT }),
      ),
    )

    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('unusable')
    expect(storedVerdict()).toBeNull()
    expect(verdictWrites).toEqual([])
  })

  it('a refusal does not DESTROY a verdict already standing — it writes nothing at all', async () => {
    // The other way a "fix" could be wrong: clearing the seam instead of not
    // touching it. A standing belief must survive a boot that refused the graph.
    const standing = verdict({
      kind: 'complete_stale',
      computed_at: '2026-08-24T08:00:00.000Z',
      cause: 'graph_changed',
    })
    useCanvasStore.setState({ analysisStateV1: standing } as never)
    fetchSpy.mockResolvedValue(
      jsonResponse(
        200,
        okBody({ graph: unrelatedGraph(), analysis_state: STALE_VERDICT }),
      ),
    )

    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('mergeRefused')
    // Bound by IDENTITY: the ORIGINAL instant, not merely "a complete_stale".
    expect(
      (storedVerdict()?.run_state as { computed_at?: string })?.computed_at,
    ).toBe('2026-08-24T08:00:00.000Z')
    expect(verdictWrites).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ THE OTHER DOOR — the ACCEPTED-POSITIVE. #842 must still work, unchanged.
// ═══════════════════════════════════════════════════════════════════════════
describe('⭐ BOTH DIRECTIONS — an ACCEPTED graph still restores its verdict', () => {
  it('the `merged` boot restores `complete_stale` — #842 intact', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, okBody({ analysis_state: STALE_VERDICT })),
    )

    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('merged')
    expect(storedVerdict()?.run_state.kind).toBe('complete_stale')
    expect(
      (storedVerdict()?.run_state as { computed_at?: string })?.computed_at,
    ).toBe(COMPUTED_AT)
    expect(verdictWrites).toHaveLength(1)
  })

  it('the `unchanged` re-boot ALSO restores — a token match is proof of a PRIOR acceptance', async () => {
    // The commonest boot of all, and the one the gate must not swallow. It
    // short-circuits before the merge, so a literal "after merge.accepted" fix
    // would silently drop it — this is the test that catches that over-fix.
    useCanvasStore.setState({
      serverGraphIdentity: { value: CEE_TOKEN, projectionVersion: 'identity.v1' },
    } as never)
    fetchSpy.mockResolvedValue(
      jsonResponse(200, okBody({ analysis_state: STALE_VERDICT })),
    )

    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('unchanged')
    expect(storedVerdict()?.run_state.kind).toBe('complete_stale')
    expect(verdictWrites).toHaveLength(1)
  })

  it('an idempotent ACCEPTED merge (server matched the canvas) still restores', async () => {
    // `accepted: true, changed: false` — the combination a caller must NOT treat
    // as a refusal (`mergeServerGraph.ts:162-167`). Gating on `changed` instead
    // of `accepted` would break exactly here.
    seedCanvas({
      nodes: [
        {
          id: 'factor-1',
          type: 'factor',
          position: { x: 10, y: 20 },
          data: { label: 'Spend', kind: 'factor', value: 250 },
        },
        {
          id: 'goal-1',
          type: 'goal',
          position: { x: 300, y: 400 },
          data: { label: 'Profit', kind: 'goal', value: 9 },
        },
      ] as never,
    })
    fetchSpy.mockResolvedValue(
      jsonResponse(200, okBody({ analysis_state: STALE_VERDICT })),
    )

    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('merged')
    expect(storedVerdict()?.run_state.kind).toBe('complete_stale')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// The declines that must survive the reordering
// ═══════════════════════════════════════════════════════════════════════════
describe('the kind-level declines are unaffected by the acceptance gate', () => {
  it('`complete_current` is still DECLINED on an ACCEPTED merge', async () => {
    // The currency decline lives in `applyBootAnalysisVerdict` and must not be
    // weakened by moving WHERE that function is called from.
    fetchSpy.mockResolvedValue(
      jsonResponse(
        200,
        okBody({
          analysis_state: verdict({
            kind: 'complete_current',
            computed_at: COMPUTED_AT,
          }),
        }),
      ),
    )

    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('merged')
    expect(storedVerdict()).toBeNull()
    expect(verdictWrites).toEqual([])
  })

  it('a 404 (not readable) writes no verdict — the non-graph legs are untouched', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(404, { error: 'not found' }))
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('notReadable')
    expect(verdictWrites).toEqual([])
  })
})
