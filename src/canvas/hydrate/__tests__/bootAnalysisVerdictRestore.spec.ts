/**
 * BOOT RESTORES CEE'S ANALYSIS VERDICT — the A3 link-6 spec.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT, DERIVED AT THIS TIP
 * ═══════════════════════════════════════════════════════════════════════════
 * `fetchScenarioGraph` PARSES CEE's composed verdict off the boot response
 * (`adapters/cee/scenarioGraph.ts:296`, with the contract's own `.strict()`
 * schema). `hydrateCanvasFromServer` then consumes `graph` / `briefText` /
 * `notModelled` / `identity` and DROPS `analysisState` on the floor.
 *
 * The only consumer of that parsed verdict is `useProvisionalAnalysisDelivery`,
 * which arms solely when `analysisStateV1.run_state.kind === 'running'`
 * (`useProvisionalAnalysisDelivery.ts:248-253`) — and `hydrateGraphSlice` nulls
 * `analysisStateV1` at boot (`store.ts:6043`) BEFORE that could ever be true.
 * React runs child effects before parent effects, so the localStorage restore
 * (and its null) always precedes this hydration (`useServerGraphHydration.ts:8-15`).
 *
 * So on every ordinary reload CEE's verdict is fetched, validated, and thrown
 * away, and the panel falls back to the LOCAL derivation — which #837 had to
 * patch from the other end.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠⚠ WHY THE RESTORE IS NARROWER THAN "RESTORE THE VERDICT"
 * ═══════════════════════════════════════════════════════════════════════════
 * `AnalysisStateV1` carries NO graph hashes (derived at the vendored 0.48.0
 * bytes — `run_state.kind` IS the freshness statement, and there is no
 * `graph_hash_at_run`/`current_graph_hash` pair anywhere on it). The verdict is
 * CEE's statement about CEE'S OWN persisted graph.
 *
 * And the selector is FEATURE-DETECTED on this field: a non-null
 * `analysisStateV1` takes the WIRE branch, where `semantic` comes from
 * `mapRunStateKindToSemantic(kind, hasReport)` and the local dirty overlay is
 * NOT CONSULTED (`analysisStateSelector.ts:551-554`).
 *
 * Therefore restoring `complete_current` would produce `semantic: 'current'`,
 * `wireForcesStale: false`, `analysisChanged: false` — a green "Analysis
 * complete" OVER A CANVAS #837 HAS JUST MARKED STALE. The naive restore does
 * not rescue #837; it DEFEATS it. That is the inverted falsehood, and it is why
 * the currency-ASSERTING kind is declined here.
 *
 * The client cannot establish the precondition that would make it honest: it
 * has no access to CEE's hash function, and saying otherwise is the
 * two-hash-functions trap (`store/analysisFreshness.ts:441-445` says exactly
 * this about the sibling attestation path).
 *
 * So the restore is FAIL-CLOSED BY CONSTRUCTION: it may only ever WITHHOLD
 * currency, never assert it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'

const SCENARIO_ID = '11111111-2222-4333-8444-555555555555'
const CEE_TOKEN = 'c'.repeat(63) + '9'

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

/**
 * A verdict that VALIDATES against the vendored contract — the adapter parses
 * with `AnalysisStateV1Schema.safeParse` and a shape that fails yields `null`,
 * which would make every assertion below pass for the WRONG REASON. The
 * positive control in the first test is what proves it parses.
 */
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

const STALE_VERDICT = verdict({
  kind: 'complete_stale',
  computed_at: '2026-08-25T09:00:00.000Z',
  // `cause`, NOT `stale_cause`. The schema is `.strict()`, so the wrong spelling
  // produced a parse failure that arrived as `null` — indistinguishable from the
  // defect under test. The positive control above is the only reason that was
  // caught rather than shipped as a spec that passes for the wrong reason.
  cause: 'graph_changed',
})

const CURRENT_VERDICT = verdict({
  kind: 'complete_current',
  computed_at: '2026-08-25T09:00:00.000Z',
})

function okBody(over: Record<string, unknown> = {}) {
  return {
    schema: 'scenario_graph.v1',
    scenario_id: SCENARIO_ID,
    graph: {
      nodes: [
        // A DIFFERENT value from the seeded canvas below, so the merge genuinely
        // `changed` the graph and #837's mark actually fires. A merge that
        // changes nothing would make the disjointness assertions vacuous.
        { id: 'factor-1', kind: 'factor', label: 'Spend', value: 250 },
        { id: 'goal-1', kind: 'goal', label: 'Profit', value: 9 },
      ],
      edges: [],
    },
    graph_present: true,
    brief_text: null,
    graph_identity_hash: envelope(),
    layout_present: false,
    request_id: 'req-boot-1',
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

function seedCanvas(): void {
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
    history: { past: [], future: [] },
    // The state `hydrateGraphSlice` leaves behind at boot (`store.ts:6043`).
    analysisStateV1: null,
    analysisFreshnessDirty: false,
  } as never)
}

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
  seedCanvas()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function storedVerdict(): AnalysisStateV1 | null {
  return useCanvasStore.getState().analysisStateV1 ?? null
}

describe('boot restores a currency-WITHHOLDING verdict CEE already sent', () => {
  it('POSITIVE CONTROL — the fixture verdict actually PARSES at the adapter', async () => {
    // Without this the whole file is vacuous: a verdict that fails
    // `AnalysisStateV1Schema.safeParse` arrives as `null`, and "the store holds
    // null" would then be indistinguishable from the defect under test.
    // Proven through the REAL adapter, not by re-parsing here.
    const { fetchScenarioGraph } = await import('../../../adapters/cee/scenarioGraph')
    fetchSpy.mockResolvedValue(
      jsonResponse(200, okBody({ analysis_state: STALE_VERDICT })),
    )
    const result = await fetchScenarioGraph(SCENARIO_ID)
    expect(result.status).toBe('graph')
    expect(result.status === 'graph' && result.analysisState).not.toBeNull()
    expect(
      result.status === 'graph' && result.analysisState?.run_state.kind,
    ).toBe('complete_stale')
  })

  it('⭐ RED-FIRST — a MERGING boot restores CEE`s `complete_stale` into the store', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, okBody({ analysis_state: STALE_VERDICT })),
    )

    const outcome = await hydrateCanvasFromServer(SCENARIO_ID)

    // The boot genuinely merged — otherwise this is not the case under test.
    expect(outcome).toBe('merged')
    // THE DEFECT: at pristine this is `null`. CEE said `complete_stale` in the
    // very response the merge came from, and the boot path dropped it.
    expect(storedVerdict()).not.toBeNull()
    expect(storedVerdict()?.run_state.kind).toBe('complete_stale')
  })

  it('the `unchanged` re-boot ALSO restores — that is the commonest boot of all', async () => {
    // The server graph has not moved since the last hydration, so
    // `hydrateCanvasFromServer` short-circuits WITHOUT merging. The verdict is
    // dropped there too, and this is precisely the boot on which a user is most
    // likely to open the panel (the module's own note at
    // `serverGraphHydration.ts:141-145` makes the same argument for the
    // context-integrity write).
    useCanvasStore.setState({
      serverGraphIdentity: { value: CEE_TOKEN, projectionVersion: 'identity.v1' },
    } as never)
    fetchSpy.mockResolvedValue(
      jsonResponse(200, okBody({ analysis_state: STALE_VERDICT })),
    )

    const outcome = await hydrateCanvasFromServer(SCENARIO_ID)

    expect(outcome).toBe('unchanged')
    expect(storedVerdict()?.run_state.kind).toBe('complete_stale')
  })

  it('a `blocked` verdict restores — the model is not analysable, and that is provable from a read', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(
        200,
        okBody({
          // `blocked_unusable: true` is REQUIRED by the contract's own
          // cross-check CC-A (0.47.0): "run_state.kind 'blocked' is produced by
          // the same status that forces blocked_unusable true; a payload
          // asserting otherwise cannot come from the producer". Without it the
          // fixture fails validation and arrives as `null` — a green-for-the-
          // wrong-reason test the positive control exists to prevent.
          analysis_state: verdict(
            { kind: 'blocked', reason_code: 'no_options', blockers: [] },
            { blocked_unusable: true },
          ),
        }),
      ),
    )
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(storedVerdict()?.run_state.kind).toBe('blocked')
  })

  it('a `refused` verdict restores — the currency of any visible result is explicitly not vouched for', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(
        200,
        okBody({
          analysis_state: verdict({ kind: 'refused', reason_code: 'declined_by_policy' }),
        }),
      ),
    )
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(storedVerdict()?.run_state.kind).toBe('refused')
  })
})

describe('⭐ BOTH DIRECTIONS — the restore may never ASSERT currency', () => {
  it('`complete_current` is DECLINED — restoring it would render "Analysis complete" over a canvas #837 marked stale', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, okBody({ analysis_state: CURRENT_VERDICT })),
    )

    const outcome = await hydrateCanvasFromServer(SCENARIO_ID)
    expect(outcome).toBe('merged')

    // Declined: the store stays on the DERIVED branch, where #837's dirty
    // overlay is still consulted. Restoring the wire verdict here would switch
    // the selector to the wire branch and silence that overlay outright.
    expect(storedVerdict()).toBeNull()
  })

  it('a genuinely-current model is NOT marked stale by this change', async () => {
    // The inverse harm. Marking unconditionally converts silence into a
    // permanent false alarm, which users learn to ignore. Nothing in the
    // restore path may fabricate a stale claim from a `complete_current` read.
    fetchSpy.mockResolvedValue(
      jsonResponse(200, okBody({ analysis_state: CURRENT_VERDICT })),
    )
    await hydrateCanvasFromServer(SCENARIO_ID)

    const held = storedVerdict()
    expect(held?.run_state.kind).not.toBe('complete_stale')
    expect(held?.run_state.kind).not.toBe('refused')
  })

  it('a NON-TERMINAL `never_run` read restores nothing — it is indistinguishable from in-flight', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, okBody({ analysis_state: verdict({ kind: 'never_run' }) })),
    )
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(storedVerdict()).toBeNull()
  })

  it('an ABSENT verdict leaves the store exactly as boot left it', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody()))
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(storedVerdict()).toBeNull()
  })

  it('a MALFORMED verdict is absence, never authority', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, okBody({ analysis_state: { run_state: { kind: 'not_a_kind' } } })),
    )
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(storedVerdict()).toBeNull()
  })
})

describe('the restore and #837`s stale mark are DISJOINT writes', () => {
  it('⭐ restoring the verdict does NOT clear the dirty overlay the merge just set', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, okBody({ analysis_state: STALE_VERDICT })),
    )

    await hydrateCanvasFromServer(SCENARIO_ID)

    // #837: `mergeServerGraphOnHydrate` calls `markGraphStructurallyEdited()`
    // when the merge `changed` the graph. Both facts must stand together — the
    // restore writes `analysisStateV1`, the mark writes the freshness trio, and
    // neither may stand on the other's field.
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(storedVerdict()?.run_state.kind).toBe('complete_stale')
  })

  it('the DECLINED path also leaves #837`s mark standing', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, okBody({ analysis_state: CURRENT_VERDICT })),
    )
    await hydrateCanvasFromServer(SCENARIO_ID)
    // The decline must be a NO-OP, not a write of `null` over a live mark.
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })
})

describe('a non-graph answer restores nothing — a refusal is never a verdict', () => {
  it('404 (not readable) writes no verdict', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(404, {}))
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('notReadable')
    expect(storedVerdict()).toBeNull()
  })

  it('a 200 with no graph writes no verdict', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, {
        schema: 'scenario_graph.v1',
        scenario_id: SCENARIO_ID,
        graph_present: false,
        request_id: 'req-absent',
        analysis_state: STALE_VERDICT,
      }),
    )
    expect(await hydrateCanvasFromServer(SCENARIO_ID)).toBe('absent')
    expect(storedVerdict()).toBeNull()
  })
})
