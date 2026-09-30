/**
 * ⭐ R6 — A RELOAD WITH NOTHING CHANGED READS "ANALYSIS COMPLETE", NOT "RESULTS MAY BE OUTDATED".
 *
 * Paul, 28 Sep 12:39Z (export `olumi-debug-b1bffd43`, DL #72 5871346171 R6): the read carried
 * `complete_current`, `graph_hash 92f3b013…` and the `analysis_result` block with
 * `computed_against_hash 92f3b013…`; nothing was edited; the hero read "Results may be outdated",
 * because `v5AnalysisFact` is session-only and every reloaded result classified as an orphan.
 * `bootReadRunFact` writes the fact only on `applyBootRunCurrency`'s full proof PLUS the read's result
 * block carrying a non-empty `computed_against_hash` — NEVER compared with the read's raw `graph_hash`
 * (Canonical #72 5872261884: raw bytes vs canonical projection; equal on a canonical-shape graph,
 * different on a repaired-shape one). Each contrast breaks exactly one proof and must stay dimmed.
 *
 * The harness below is `bootRunCurrency.spec.tsx`'s (FIX 2), copied verbatim:
 * (FIX 2 header follows)
 *
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
import { BOOT_READ_RUN_CURRENT, bootReadRunFact } from '../applyBootRunCurrency'
import { buildRegistrationGraph } from '../../registration/buildRegistrationGraph'
import { useAnalysisState } from '../../state/analysisStateSelector'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import realStagingFixture from '../../../v5/__tests__/fixtures/v5-analysis-result.staging-real-shape.json'

// The DEPLOYED posture (`VITE_V5_CANONICAL_ANALYSIS=true`, netlify.toml): the orphan rule only exists
// under it, so a spec without it tests a surface the deployment does not render.
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isV5CanonicalAnalysisEnabled: () => true,
}))

const SCENARIO_ID = '11111111-2222-4333-8444-555555555555'
const IDENTITY = 'c'.repeat(63) + '9'
/** CEE's analysis-affecting hash — the space the card's `graph_hash_at_generation` is in. */
const READ_HASH = 'aag_v1:' + 'd'.repeat(64)
/** The served shape (`…41.123Z`); carried verbatim, never re-serialised. */
const COMPUTED_AT = '2026-09-25T10:41:41.123Z'

/** The Run card from the latest run: written on this graph, at this run. */

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


/**
 * The run's own result block, as the read carries it — the REAL staging-shaped block (renderable
 * options and probabilities), with `computed_against_hash` set as the read carries it. `null` = the
 * field is absent.
 */
function resultBlock(computedAgainst: string | null = READ_HASH) {
  const block = structuredClone(realStagingFixture.blocks[0]) as Record<string, unknown>
  delete block.computed_against_hash
  return computedAgainst === null ? block : { ...block, computed_against_hash: computedAgainst }
}

/** A reload that kept the answer (`restoredForScenarioId`): a report is on screen, no session fact. */
function seedRestoredResult(): void {
  const report = mapV5AnalysisToReport(resultBlock() as never)
  useCanvasStore.setState({
    results: { status: 'complete', progress: 100, report, hash: report.model_card.response_hash },
    hasCompletedFirstRun: true,
    v5AnalysisFact: null,
  } as never)
}

const display = () => renderHook(() => useAnalysisState()).result.current.displayState.state
/** The Reasoning tab's own stale flag (`OutputsDock`: `isStale` = displayed freshness stale|unknown). */
const reasoningTabStale = () => {
  const f = renderHook(() => useAnalysisState()).result.current.displayedFreshness
  return f === 'stale' || f === 'unknown'
}

describe('⭐ R6 — the reload proves the result current', () => {
  it('Paul\'s shape: complete_current, block computed against the read\'s hash, nothing edited → "Analysis complete"', async () => {
    seedRestoredResult()
    expect(display(), 'before the read: an orphaned result, dimmed').toBe('results_stale')
    respond(body({ analysis_result: resultBlock() }))
    await expect(hydrateCanvasFromServer(SCENARIO_ID)).resolves.toBe('merged')
    expect(useCanvasStore.getState().v5AnalysisFact).toMatchObject({
      scenarioId: SCENARIO_ID,
      hasRunAnalysisFact: true,
      freshness: 'fresh',
      freshnessReason: BOOT_READ_RUN_CURRENT,
    })
    expect(display()).toBe('complete')
    // The hero and the Reasoning tab now AGREE. Before this fix the tab already read current here
    // (it reads the currency leg), and only the hero was dimmed by the orphan rule.
    expect(reasoningTabStale(), 'the Reasoning tab shows no "Last run · model changed" row').toBe(false)
  })

  it('⭐ Canonical\'s row: a REPAIRED-SHAPE graph (canonical run hash ≠ raw read hash, complete_current) → "Analysis complete"', async () => {
    seedRestoredResult()
    respond(body({ analysis_result: resultBlock('aag_v1:' + 'e'.repeat(64)) }))
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(useCanvasStore.getState().v5AnalysisFact?.hasRunAnalysisFact).toBe(true)
    expect(display()).toBe('complete')
  })

  it('an edit after the reload still takes it off complete', async () => {
    seedRestoredResult()
    respond(body({ analysis_result: resultBlock() }))
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(display()).toBe('complete')
    act(() => useCanvasStore.getState().markGraphStructurallyEdited())
    expect(display()).toBe('results_stale')
  })
})

describe('each proof broken alone: no fact, the result stays dimmed', () => {
  async function expectDimmed(b: Record<string, unknown>): Promise<void> {
    seedRestoredResult()
    respond(body(b))
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(useCanvasStore.getState().v5AnalysisFact, 'no fact written').toBeNull()
    expect(display()).toBe('results_stale')
    expect(reasoningTabStale()).toBe(true)
  }

  /**
   * ⛔ AIQ pre-share hold (#75 5903405445; R3 row S1–S5): when the read itself says the held Run cannot be current
   * (no result block, a rerun asked, P0's C2 contradiction), the held Run is DROPPED — the same-browser reload is the
   * fresh browser's, with no earlier figures on screen — rather than kept dimmed.
   */
  async function expectDropped(b: Record<string, unknown>): Promise<void> {
    seedRestoredResult()
    respond(body(b))
    await hydrateCanvasFromServer(SCENARIO_ID)
    const st = useCanvasStore.getState() as unknown as { v5AnalysisFact: unknown; results: { report?: unknown }; analysisFreshness: unknown }
    expect(st.v5AnalysisFact, 'no fact written').toBeNull()
    expect(st.results.report ?? null, 'the earlier Run is not on screen').toBeNull()
    expect(st.analysisFreshness ?? null).toBeNull()
    expect(display()).not.toBe('complete')
  }

  it('the block carries no computed_against_hash', () => expectDimmed({ analysis_result: resultBlock(null) }))
  // A current read with no block: P0's 'no_result' decline dims it; it is not evidence of a newer Run, so it is kept.
  it('the read carries no result block', () => expectDimmed({}))
  it('C2: a newer partial Run requiring rerun and no result never revives the cached report as current', () =>
    expectDropped({
      analysis_state: verdict({ kind: 'complete_current', computed_at: COMPUTED_AT }, {
        requires_rerun: true,
        contradictions: ['fact_status_success_but_degraded_newer'],
      }),
      analysis_result: null,
    }))

  it('a rerun-required read cannot mark cached results fresh even if an older result block is present', async () => {
    seedRestoredResult()
    respond(body({
      analysis_state: verdict({ kind: 'complete_current', computed_at: COMPUTED_AT }, { requires_rerun: true }),
      analysis_result: resultBlock(),
    }))
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(useCanvasStore.getState().v5AnalysisFact).toBeNull()
    expect(useCanvasStore.getState().analysisFreshness?.currentGraphHash).toBeUndefined()
    expect(display()).toBe('results_stale')
    expect(reasoningTabStale()).toBe(true)
  })
  it('C2: a newer degraded Run cannot revive an older result when requires_rerun is false', () =>
    expectDropped({
      analysis_state: verdict({ kind: 'complete_current', computed_at: COMPUTED_AT }, {
        requires_rerun: false,
        contradictions: ['fact_status_success_but_degraded_newer'],
      }),
      analysis_result: resultBlock(),
    }))
  it('CEE says complete_stale, not complete_current', () =>
    expectDimmed({ analysis_state: verdict({ kind: 'complete_stale', computed_at: COMPUTED_AT } as never), analysis_result: resultBlock() }))
  it('the canvas holds a value the read lacks (not proven equal)', async () => {
    seedReloadedCanvas({
      nodes: [
        { id: 'factor-1', type: 'factor', position: { x: 10, y: 20 }, data: { label: 'Price', kind: 'factor', value: 49, observed_state: { value: 0.7 } } },
        { id: 'goal-1', type: 'goal', position: { x: 300, y: 400 }, data: { label: 'Revenue', kind: 'goal' } },
      ],
    })
    await expectDimmed({ analysis_result: resultBlock() })
  })
})

describe('bootReadRunFact, pure', () => {
  it('binds to the scenario and to the block\'s own report hash', () => {
    const fact = bootReadRunFact({ scenarioId: SCENARIO_ID, analysisResult: resultBlock(), now: 1 })
    expect(fact?.analysisHash).toBe(mapV5AnalysisToReport(resultBlock() as never).model_card.response_hash)
    expect(fact?.scenarioId).toBe(SCENARIO_ID)
  })
  it('declines a non-block, a wrong type, an absent or blank computed_against_hash', () => {
    expect(bootReadRunFact({ scenarioId: SCENARIO_ID, analysisResult: null, now: 1 })).toBeNull()
    expect(bootReadRunFact({ scenarioId: SCENARIO_ID, analysisResult: { ...resultBlock(), type: 'x' }, now: 1 })).toBeNull()
    expect(bootReadRunFact({ scenarioId: SCENARIO_ID, analysisResult: resultBlock(null), now: 1 })).toBeNull()
    expect(bootReadRunFact({ scenarioId: SCENARIO_ID, analysisResult: resultBlock('  '), now: 1 })).toBeNull()
  })

  it('accepts a canonical hash that differs from the raw read hash (never compared)', () => {
    expect(bootReadRunFact({ scenarioId: SCENARIO_ID, analysisResult: resultBlock('aag_v1:' + 'e'.repeat(64)), now: 1 })).not.toBeNull()
  })
})
