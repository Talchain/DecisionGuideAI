/**
 * ⭐ FIX 2 — A RELOAD WITH NOTHING CHANGED KEEPS A CURRENT RUN CARD CURRENT.
 *
 * Served defect (R&C #69 5831180703 row R5b, UI `5f8d9095` · CEE `4809203`):
 * after a plain reload the Run card read "Olumi can't confirm this still
 * matches your latest analysis." although nothing had changed. The CEE contract
 * this binds to is measured on served (Canonical State #69 5830227291, C1–C3):
 * the read's `graph_hash` is the turn's hash, and its `computed_at` is the
 * fact's string byte for byte.
 *
 * Driven through the REAL `hydrateCanvasFromServer` → `fetchScenarioGraph`
 * (the fetch is stubbed with the read's body; no model call anywhere), then
 * read back through the Run card's own hook, `useCoachingCurrency`.
 *
 * THE FIXTURE: the read's graph is built FROM the canvas's own registration
 * projection, so "the canvas carries exactly what CEE read" holds by
 * construction — the positive case. Each negative breaks exactly one proof.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import {
  applyBootRunCurrency,
  BOOT_READ_RUN_CURRENT,
  BOOT_RUN_CURRENCY_DECLINE_REASONS,
  type BootRunCurrencyDeclineReason,
} from '../applyBootRunCurrency'
import { buildRegistrationGraph } from '../../registration/buildRegistrationGraph'
import { useCoachingCurrency } from '../../../v5/blocks/useCoachingCurrency'
import { mergeServerGraphOnHydrate } from '../../utils/mergeServerGraph'
import servedPricing from './fixtures/pricing-provisional-poll.json'

const SCENARIO_ID = '11111111-2222-4333-8444-555555555555'
const IDENTITY = 'c'.repeat(63) + '9'
/** CEE's analysis-affecting hash — the space the card's `graph_hash_at_generation` is in. */
const READ_HASH = 'aag_v1:' + 'd'.repeat(64)
/** The served shape (`…41.123Z`); carried verbatim, never re-serialised. */
const COMPUTED_AT = '2026-09-25T10:41:41.123Z'

/** The Run card from the latest run: written on this graph, at this run. */
const RUN_CARD = { sourceHandler: 'run_analysis', createdAt: COMPUTED_AT }

function verdict(runState: AnalysisStateV1['run_state'], over: Partial<AnalysisStateV1> = {}): AnalysisStateV1 {
  return {
    run_state: runState,
    readiness: { status: 'ready', blockers: [] },
    leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
    robustness: {},
    usable_for_prose: false,
    usable_for_chips: false,
    usable_for_followup: false,
    requires_rerun: false,
    blocked_unusable: false,
    contradictions: [],
    ...over,
  } as AnalysisStateV1
}
const CURRENT = verdict({ kind: 'complete_current', computed_at: COMPUTED_AT })

const CANVAS_NODES = [
  { id: 'factor-1', type: 'factor', position: { x: 10, y: 20 }, data: { label: 'Price', kind: 'factor', value: 49 } },
  { id: 'goal-1', type: 'goal', position: { x: 300, y: 400 }, data: { label: 'Revenue', kind: 'goal' } },
]

/** The read's graph: the canvas's own projection, so every projected value is carried. */
function readGraphOfCanvas() {
  const built = buildRegistrationGraph(CANVAS_NODES as never, [] as never)
  if (!built.ok) throw new Error(`fixture: projection failed (${built.reason})`)
  return JSON.parse(JSON.stringify(built.graph)) as { nodes: Array<Record<string, unknown>>; edges: unknown[] }
}

function body(over: Record<string, unknown> = {}) {
  return {
    schema: 'scenario_graph.v1',
    scenario_id: SCENARIO_ID,
    graph: readGraphOfCanvas(),
    graph_present: true,
    brief_text: null,
    graph_identity_hash: {
      kind: 'graph_identity_hash',
      value: IDENTITY,
      algorithm: 'sha256',
      projection_version: 'identity.v1',
      graph_schema_version: 'graph_v3',
      normaliser_version: '1',
    },
    layout_present: false,
    request_id: 'req-boot-run-currency',
    graph_hash: READ_HASH,
    analysis_state: CURRENT,
    ...over,
  }
}

function respond(b: unknown): void {
  fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => b } as unknown as Response)
}

/** The state an ordinary reload leaves before the read lands (`resultsLoadHistorical`). */
function seedReloadedCanvas(over: Record<string, unknown> = {}): void {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: JSON.parse(JSON.stringify(CANVAS_NODES)),
    edges: [],
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    importPendingServerRegistration: false,
    pendingEmittedEdits: 0,
    history: { past: [], future: [] },
    analysisStateV1: null,
    analysisFreshness: { freshness: 'unknown', freshnessReason: 'hydrated_without_capture' },
    analysisFreshnessDirty: false,
    ...over,
  } as never)
}

const PRISTINE_SET_VERDICT = useCanvasStore.getState().setAnalysisStateV1
let fetchSpy: ReturnType<typeof vi.fn>
let verdictWrites: Array<AnalysisStateV1 | null>

beforeEach(() => {
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
  seedReloadedCanvas()
  verdictWrites = []
  useCanvasStore.setState({
    setAnalysisStateV1: (v: AnalysisStateV1 | null) => {
      verdictWrites.push(v)
      PRISTINE_SET_VERDICT(v)
    },
  } as never)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const runCard = () => renderHook(() => useCoachingCurrency(READ_HASH, RUN_CARD))

describe('⭐ the reload keeps a current Run card current', () => {
  it('accepted merge, canvas equal to the read: the verdict AND its hash are restored, and the card reads current', async () => {
    respond(body())
    expect(runCard().result.current, 'before the read: not current').not.toBe('current')

    await expect(hydrateCanvasFromServer(SCENARIO_ID)).resolves.toBe('merged')

    const st = useCanvasStore.getState()
    expect(verdictWrites).toEqual([CURRENT])
    expect(st.analysisStateV1?.run_state).toEqual({ kind: 'complete_current', computed_at: COMPUTED_AT })
    expect(st.analysisFreshness).toMatchObject({
      freshness: 'fresh',
      freshnessReason: BOOT_READ_RUN_CURRENT,
      currentGraphHash: READ_HASH,
      graphHashAtRun: READ_HASH,
      computedAt: COMPUTED_AT,
    })
    expect(st.analysisFreshnessDirty).toBe(false)
    expect(runCard().result.current).toBe('current')
  })

  it('the unchanged exit (identity already applied) restores too', async () => {
    seedReloadedCanvas({ serverGraphIdentity: { value: IDENTITY, projectionVersion: 'identity.v1' } })
    respond(body())
    await expect(hydrateCanvasFromServer(SCENARIO_ID)).resolves.toBe('unchanged')
    expect(useCanvasStore.getState().analysisFreshness?.currentGraphHash).toBe(READ_HASH)
    expect(runCard().result.current).toBe('current')
  })

  it('an EARLIER run\'s card on the same graph still reads as an earlier run, never current', async () => {
    respond(body())
    await hydrateCanvasFromServer(SCENARIO_ID)
    const earlier = renderHook(() =>
      useCoachingCurrency(READ_HASH, { sourceHandler: 'run_analysis', createdAt: '2026-09-25T09:00:00.000Z' }),
    )
    expect(earlier.result.current).not.toBe('current')
  })

  it('an edit AFTER the restore takes the card off current', async () => {
    respond(body())
    await hydrateCanvasFromServer(SCENARIO_ID)
    const card = runCard()
    expect(card.result.current).toBe('current')
    act(() => useCanvasStore.getState().markGraphStructurallyEdited())
    expect(card.result.current).not.toBe('current')
  })
})

describe('every proof it needs, each broken alone: nothing is written and the card stays unconfirmed', () => {
  async function expectNoRestore(): Promise<void> {
    const st = useCanvasStore.getState()
    expect(verdictWrites, 'no currency verdict written').not.toContainEqual(CURRENT)
    expect(st.analysisFreshness?.currentGraphHash, 'no hash adopted').toBeUndefined()
    expect(runCard().result.current).not.toBe('current')
  }

  it('the canvas holds a value the read lacks (the observed_state 0.7 case)', async () => {
    seedReloadedCanvas({
      nodes: [
        { ...CANVAS_NODES[0], data: { ...CANVAS_NODES[0].data, observed_state: { value: 0.7 } } },
        CANVAS_NODES[1],
      ],
    })
    respond(body())
    await expect(hydrateCanvasFromServer(SCENARIO_ID)).resolves.toBe('merged')
    await expectNoRestore()
  })

  it('an edit is still between the user and CEE', async () => {
    seedReloadedCanvas({ pendingEmittedEdits: 1 })
    respond(body())
    await hydrateCanvasFromServer(SCENARIO_ID)
    await expectNoRestore()
  })

  it('the read carries no graph_hash', async () => {
    respond(body({ graph_hash: undefined }))
    await hydrateCanvasFromServer(SCENARIO_ID)
    await expectNoRestore()
  })

  it('the boot merge changed the model (CEE holds a different value): the merge marks it, so nothing is restored', async () => {
    const g = readGraphOfCanvas()
    g.nodes = g.nodes.map((n) => (n.id === 'factor-1' ? { ...n, label: 'Price per seat' } : n))
    respond(body({ graph: g }))
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(useCanvasStore.getState().analysisFreshnessDirty, 'precondition: the merge marked a change').toBe(true)
    await expectNoRestore()
  })

  it('CEE said the analysis is stale: the existing stale restore runs, and no hash is adopted', async () => {
    const stale = verdict({ kind: 'complete_stale', computed_at: COMPUTED_AT, cause: 'graph_changed' })
    respond(body({ analysis_state: stale }))
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(useCanvasStore.getState().analysisStateV1?.run_state.kind).toBe('complete_stale')
    await expectNoRestore()
  })

  it('the scenario on screen is not the one read', async () => {
    respond(body())
    const pending = hydrateCanvasFromServer(SCENARIO_ID)
    useCanvasStore.setState({ currentScenarioId: '99999999-2222-4333-8444-555555555555' } as never)
    await pending
    await expectNoRestore()
  })
})

/** The served pricing read's graph (CEE `c673223`-era bytes; see the fixture README). */
function servedGraph(): { nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> } {
  const find = (o: unknown): unknown => {
    if (o && typeof o === 'object') {
      const r = o as Record<string, unknown>
      const g = r.graph as { nodes?: unknown } | undefined
      if (g && Array.isArray(g.nodes)) return g
      for (const v of Object.values(r)) {
        const hit = find(v)
        if (hit) return hit
      }
    }
    return null
  }
  const g = find(servedPricing)
  if (!g) throw new Error('fixture: no graph in the served read')
  return JSON.parse(JSON.stringify(g))
}

/** The canvas a reload of the served scenario restores: the served graph, merged once. */
function seedCanvasFromServedRead(): void {
  seedReloadedCanvas({ nodes: [], edges: [] })
  mergeServerGraphOnHydrate(servedGraph() as never)
  const { nodes, edges } = useCanvasStore.getState()
  seedReloadedCanvas({ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) })
}

describe('the REVERSE direction: CEE holds a value the canvas lacks (pre-review 5831362210)', () => {
  const CACHED_IDENTITY = { serverGraphIdentity: { value: IDENTITY, projectionVersion: 'identity.v1' } }

  it('POSITIVE CONTROL on served bytes: the served pricing read, reloaded over its own canvas, restores', async () => {
    seedCanvasFromServedRead()
    respond(body({ graph: servedGraph() }))
    await expect(hydrateCanvasFromServer(SCENARIO_ID)).resolves.toBe('merged')
    expect(useCanvasStore.getState().analysisFreshnessDirty, 'the reload merge is idempotent').toBe(false)
    expect(useCanvasStore.getState().analysisFreshness?.currentGraphHash).toBe(READ_HASH)
  })

  it('unchanged exit: the read carries a factor observed_state the canvas lacks, so nothing is restored', async () => {
    seedReloadedCanvas(CACHED_IDENTITY)
    const g = readGraphOfCanvas()
    g.nodes = g.nodes.map((n) => (n.id === 'factor-1' ? { ...n, observed_state: { value: 0.4 } } : n))
    respond(body({ graph: g }))
    await expect(hydrateCanvasFromServer(SCENARIO_ID)).resolves.toBe('unchanged')
    expect(useCanvasStore.getState().analysisFreshness?.currentGraphHash).toBeUndefined()
    expect(verdictWrites).not.toContainEqual(CURRENT)
    expect(runCard().result.current).not.toBe('current')
  })

  it('unchanged exit, served bytes: the read carries an option intervention the canvas lacks, so nothing is restored', async () => {
    seedCanvasFromServedRead()
    const optionId = String(servedGraph().nodes.find((n) => n.kind === 'option' && n.interventions)?.id)
    const stripped = useCanvasStore.getState().nodes.map((n) => {
      if (n.id !== optionId) return n
      const data = { ...(n.data as Record<string, unknown>) }
      delete data.interventions
      delete data.interventionKeys
      return { ...n, data }
    })
    useCanvasStore.setState({ nodes: stripped, ...CACHED_IDENTITY } as never)
    respond(body({ graph: servedGraph() }))
    await expect(hydrateCanvasFromServer(SCENARIO_ID)).resolves.toBe('unchanged')
    expect(useCanvasStore.getState().analysisFreshness?.currentGraphHash).toBeUndefined()
    expect(verdictWrites).not.toContainEqual(CURRENT)
  })

  it('the edge default comes from the contract: an edge CEE marks bidirected is not the canvas\'s directed edge', async () => {
    seedCanvasFromServedRead()
    useCanvasStore.setState(CACHED_IDENTITY as never)
    const g = servedGraph()
    g.edges = g.edges.map((e, i) => (i === 0 ? { ...e, edge_type: 'bidirected' } : e))
    respond(body({ graph: g }))
    await expect(hydrateCanvasFromServer(SCENARIO_ID)).resolves.toBe('unchanged')
    expect(useCanvasStore.getState().analysisFreshness?.currentGraphHash).toBeUndefined()
    expect(verdictWrites).not.toContainEqual(CURRENT)
  })

  it('merged exit: the read adds an observed_state the canvas lacks, so nothing is restored', async () => {
    const g = readGraphOfCanvas()
    g.nodes = g.nodes.map((n) => (n.id === 'factor-1' ? { ...n, observed_state: { value: 0.4 } } : n))
    respond(body({ graph: g }))
    await expect(hydrateCanvasFromServer(SCENARIO_ID)).resolves.toBe('merged')
    expect(useCanvasStore.getState().analysisFreshness?.currentGraphHash).toBeUndefined()
    expect(verdictWrites).not.toContainEqual(CURRENT)
    expect(runCard().result.current).not.toBe('current')
  })
})

describe('applyBootRunCurrency — each decline reason is reachable, and names itself', () => {
  function run(over: Partial<Parameters<typeof applyBootRunCurrency>[0]> = {}, storeOver: Record<string, unknown> = {}) {
    const writes: unknown[] = []
    let hash: string | undefined
    const outcome = applyBootRunCurrency({
      analysisState: CURRENT,
      graphHash: READ_HASH,
      canvasProvenEqualToRead: true,
      store: {
        analysisFreshnessDirty: false,
        setAnalysisStateV1: (v) => writes.push(v),
        setAnalysisFreshness: (raw) => {
          hash = (raw as { current_graph_hash: string }).current_graph_hash
        },
        readCurrentGraphHash: () => hash,
        ...storeOver,
      },
      ...over,
    })
    return { outcome, writes }
  }

  const cases: Array<[BootRunCurrencyDeclineReason, () => ReturnType<typeof run>]> = [
    ['no_verdict', () => run({ analysisState: null })],
    ['not_current', () => run({ analysisState: verdict({ kind: 'never_run' } as never) })],
    ['no_computed_at', () => run({ analysisState: verdict({ kind: 'complete_current', computed_at: '  ' }) })],
    ['no_graph_hash', () => run({ graphHash: null })],
    ['canvas_not_proven_equal', () => run({ canvasProvenEqualToRead: false })],
    ['edited_since_read', () => run({}, { analysisFreshnessDirty: true })],
    [
      'closes_run_gate',
      () =>
        run({
          analysisState: verdict(
            { kind: 'complete_current', computed_at: COMPUTED_AT },
            { readiness: { status: 'blocked', blockers: [] } as never },
          ),
        }),
    ],
    ['freshness_not_taken', () => run({}, { readCurrentGraphHash: () => 'aag_v1:other' })],
  ]

  it.each(cases)('%s: declined, and the verdict is never written', (reason, arrange) => {
    const { outcome, writes } = arrange()
    expect(outcome).toEqual({ outcome: 'declined', reason })
    expect(writes).toEqual([])
  })

  it('the cases cover every declared reason', () => {
    expect(cases.map(([r]) => r).sort()).toEqual([...BOOT_RUN_CURRENCY_DECLINE_REASONS].sort())
  })

  it('the positive: restored, the verdict written once, computed_at passed through untouched', () => {
    const { outcome, writes } = run()
    expect(outcome).toEqual({ outcome: 'restored' })
    expect(writes).toEqual([CURRENT])
    expect((writes[0] as AnalysisStateV1).run_state).toHaveProperty('computed_at', COMPUTED_AT)
  })
})
