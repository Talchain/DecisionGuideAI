/**
 * ⛔⛔ A RUN SPEAKS UNDER ITS OWN ADMISSION — a later turn's licence about the
 * EDITED graph may not promote what the DISPLAYED run is allowed to say (#1206).
 *
 * WITNESSED on the served build, 23 Sep 2026:
 *   1. Analysis runs. The envelope that carries its `analysis_result` also carries
 *      `analysis_ready.analysis_admission.permitted_analysis_mode:
 *      'quantified_provisional'`; the producer's robustness verdict is `fragile`.
 *      The Reasoning tab correctly states no strength word and names no leader.
 *   2. The user edits one factor value. The `factor_value_edit` turn returns ONLY
 *      a `graph_patch` block — no `analysis_result` — but a NEW admission
 *      (`comparative_leader`) that belongs to the EDITED graph.
 *   3. That admission becomes the live one, `resolveEffectiveAdmission` licenses
 *      stability, and the OLD run's verdict is printed as "Sensitive".
 *
 * BINDING RULING (olumi-programme-docs#63, comment 5787026951):
 *   claim permitted = run-own admission permits it AND current admission permits it
 * — SUPPRESSION ONLY. Nothing here may license a claim today's code withholds.
 *
 * ⚠ THE REAL CHAIN, NO DOUBLES: a wire-shaped response through the REAL
 * `applyV5State`, into the REAL canvas store built exactly as production builds
 * it (`useConversation.ts`, `{ ...getState(), currentResultsHash }`), read back
 * through the REAL `useResultsSectionData`, handed to the REAL builders. A
 * hand-built `recommendation` would encode my model of the hook, not the hook —
 * and the defect lives precisely in which admission the hook hands on.
 *
 * ⚠ EVERY ARM ASSERTS ITS PRECONDITIONS FIRST — that the old run is still the
 * one displayed, that it separates the arms (Q2 true), that the producer's word
 * is `fragile`, and which admission is live. Without them an arm could go green
 * on an empty view model (CLAUDE.md trap 13).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import { applyV5State } from '../../../../v5/applyV5State'
import { useCanvasStore } from '../../../../canvas/store'
import { useResultsSectionData } from '../../useResultsSectionData'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { buildStrengthenInputsForAnalysisNew } from '../buildStrengthenInputsForAnalysisNew'
import { buildRecommendations } from '../../strengthen/buildRecommendations'
import type { AnalysisAdmissionV1, PermittedAnalysisMode } from '../../../../adapters/cee/types'

const NODES = [
  { id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Expand into Germany' } },
  { id: 'opt_b', type: 'option', position: { x: 200, y: 0 }, data: { kind: 'option', label: 'Stay domestic' } },
  { id: 'goal_1', type: 'goal', position: { x: 100, y: 200 }, data: { kind: 'goal', label: 'Reach £2m ARR' } },
  { id: 'fac_price', type: 'factor', position: { x: 100, y: 100 }, data: { kind: 'factor', label: 'Price', observedState: { value: 0.5 } } },
]

/**
 * The live V5 `analysis_result` shape. ⚠ The mapper's robustness KEEP-LIST drops
 * `near_tie`, so the leader is authorised by `decision_brief.headline_banded`
 * (the same fixture shape `withheldLeaderClaimSurvivesReload.spec.ts` derived);
 * `display_verdict` IS kept, and `level: 'high'` is what the Strengthen commit
 * row additionally requires before it may appear at all.
 */
const ANALYSIS_BLOCK = {
  type: 'analysis_result' as const,
  summary: 'Expand into Germany leads.',
  leading_option_id: 'opt_a',
  win_probabilities: { opt_a: 0.71, opt_b: 0.29 },
  enrichment: {
    robustness: { recommended_option_id: 'opt_a', display_verdict: 'fragile', level: 'high' },
    decision_brief: {
      headline_banded: { band: 'clearly_ahead', leader_option_id: 'opt_a' },
    },
    option_comparison: [
      { option_id: 'opt_a', option_label: 'Expand into Germany', win_probability: 0.71 },
      { option_id: 'opt_b', option_label: 'Stay domestic', win_probability: 0.29 },
    ],
  },
}

/** A factor-value edit turn: ONE graph_patch block and nothing else. */
const GRAPH_PATCH_BLOCK = {
  type: 'graph_patch',
  status: 'applied',
  operation: 'set_factor_value',
  target_id: 'fac_price',
  after: { value: 0.7 },
}

const admission = (mode: PermittedAnalysisMode): AnalysisAdmissionV1 => ({
  permitted_analysis_mode: mode,
  reasons:
    mode === 'comparative_leader'
      ? []
      : [
          {
            field: 'permitted_analysis_mode',
            message: 'No result can be called stable or robust until you have set at least one estimate.',
          },
        ],
})

/** `mode === 'absent'` is an OLDER PRODUCER: readiness with no admission key at all. */
function analysisReady(mode: PermittedAnalysisMode | 'absent') {
  return {
    status: 'ready',
    goal_node_id: 'goal_1',
    freshness: 'fresh',
    options: [
      { id: 'opt_a', status: 'ready', interventions: {} },
      { id: 'opt_b', status: 'ready', interventions: {} },
    ],
    ...(mode === 'absent' ? {} : { analysis_admission: admission(mode) }),
  }
}

function envelope(blocks: unknown[], mode: PermittedAnalysisMode | 'absent', stage: string): OlumiResponse {
  return {
    response_version: 2,
    assistant_text: '',
    blocks,
    suggested_actions: [],
    insights: [],
    stage_indicator: stage,
    analysis_ready: analysisReady(mode),
  } as unknown as OlumiResponse
}

/** EXACTLY the production construction and bracket — `useConversation.ts`. */
function applyAsProductionDoes(response: OlumiResponse) {
  const snap = useCanvasStore.getState()
  snap.beginExternalGraphMutation?.('envelope_apply')
  try {
    return applyV5State(response, { ...snap, currentResultsHash: snap.results?.hash ?? null } as never)
  } finally {
    useCanvasStore.getState().endExternalGraphMutation?.()
  }
}

/** Step 1: the run lands, under `runMode`. */
function runTheAnalysis(runMode: PermittedAnalysisMode | 'absent') {
  applyAsProductionDoes(envelope([ANALYSIS_BLOCK], runMode, 'analyse'))
  const hash = useCanvasStore.getState().results?.hash
  expect(hash, 'precondition: the run must have hydrated a report').toBeTruthy()
  return hash as string
}

/** Steps 2–3: the user edits a factor; CEE answers with a graph patch and a NEW admission. */
function editAFactorValue(liveMode: PermittedAnalysisMode | 'absent') {
  // The local optimistic edit first — the real chokepoint, as the user drives it.
  useCanvasStore.getState().updateNode('fac_price', {
    data: { observedState: { value: 0.7 } },
  } as never)
  applyAsProductionDoes(envelope([GRAPH_PATCH_BLOCK], liveMode, 'evaluate'))
}

/** What the Reasoning tab would render — the real hook, then the real builders. */
function readTheReasoningTab() {
  const { result } = renderHook(() => useResultsSectionData())
  const data = result.current
  const rec = data.recommendation
  // HARNESS PRECONDITION — the ID-space trap: no options means every assertion
  // below is about an empty view model rather than about admission.
  expect(rec?.allOptions?.length, 'harness precondition: both options must be built').toBe(2)
  const vm = buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })
  const strengthen = buildRecommendations(
    buildStrengthenInputsForAnalysisNew({ data, guidanceItems: [], biasSignals: null, currentStage: null }),
  )
  return {
    rec,
    glanceWord: vm.atAGlance.verdict?.label ?? null,
    checksCode: vm.checks.items.find((i) => i.id === 'robustness')?.code,
    commitRow: strengthen.find((r) => r.id === 'strengthen:commit'),
  }
}

/** The preconditions every arm needs, asserted rather than assumed. */
function expectTheOldRunIsStillDisplayed(hash: string, liveMode: PermittedAnalysisMode | 'absent') {
  const s = useCanvasStore.getState()
  expect(s.results?.hash, 'precondition: the graph-only turn must not have replaced the displayed run').toBe(hash)
  expect(
    s.ceeAnalysisReady?.analysis_admission?.permitted_analysis_mode,
    'precondition: the graph-only turn’s admission must be the LIVE one',
  ).toBe(liveMode === 'absent' ? undefined : liveMode)
}

beforeEach(() => {
  localStorage.clear()
  useCanvasStore.setState({
    nodes: NODES,
    edges: [],
    results: { status: 'idle', progress: 0 },
    runMeta: {},
    hasCompletedFirstRun: false,
    rawV2Response: null,
    ceeAnalysisReady: null,
    retainedAnalysisAdmission: null,
    analysisStateV1: null,
    runDelta: null,
    currentScenarioId: 'scn-own-admission',
  } as never)
})

describe('a run speaks under its own admission', () => {
  it('⛔ THE WITNESS — a later licence about the EDITED graph does not let the OLD run state a strength word or name a leader', () => {
    const hash = runTheAnalysis('quantified_provisional')

    // Before the edit: the refusal is in force, and the run really does separate
    // and really does carry a `fragile` verdict — so what follows is about the
    // admission and nothing else.
    const before = readTheReasoningTab()
    expect(before.rec?.verdict?.hasLeadingOption, 'Q2 must be TRUE, or this is the tied-arms case').toBe(true)
    expect(before.rec?.robustnessVerdict, 'the producer’s word must be present to be withheld').toBe('fragile')
    expect(before.glanceWord).toBeNull()
    expect(before.rec?.leaderDesignationPermitted).toBe(false)

    editAFactorValue('comparative_leader')
    expectTheOldRunIsStillDisplayed(hash, 'comparative_leader')

    const after = readTheReasoningTab()
    expect(after.rec?.verdict?.hasLeadingOption, 'Q2 is untouched by the edit').toBe(true)
    expect(after.rec?.robustnessVerdict).toBe('fragile')
    // ⭐ THE RED. The run was admitted at `quantified_provisional`; a licence
    // about a graph it was never computed over does not make its verdict sayable.
    expect(after.glanceWord, 'the glance must state no strength word for this run').toBeNull()
    expect(after.checksCode, '"What we checked" must not state one either').toBe('robustness_not_established')
    expect(after.commitRow, 'Strengthen must not say these numbers "held up under stress-testing"').toBeUndefined()
    expect(after.rec?.leaderDesignationPermitted, 'and no leader may be designated from this run').toBe(false)
  })

  it('LICENSED STALE CONTROL — run permits and the live admission still permits: the claims remain', () => {
    const hash = runTheAnalysis('comparative_leader')
    editAFactorValue('comparative_leader')
    expectTheOldRunIsStillDisplayed(hash, 'comparative_leader')

    const after = readTheReasoningTab()
    expect(after.rec?.verdict?.hasLeadingOption).toBe(true)
    expect(after.glanceWord).toBe('Sensitive')
    expect(after.checksCode).toBe('robustness_sensitive')
    expect(after.commitRow, 'a licensed run keeps its commit row').toBeDefined()
    expect(after.rec?.leaderDesignationPermitted).toBe(true)
  })

  it('CURRENT-STRICTER CONTROL — run permits but the live admission refuses: still suppressed (today’s behaviour)', () => {
    const hash = runTheAnalysis('comparative_leader')
    editAFactorValue('quantified_provisional')
    expectTheOldRunIsStillDisplayed(hash, 'quantified_provisional')

    const after = readTheReasoningTab()
    expect(after.rec?.verdict?.hasLeadingOption).toBe(true)
    expect(after.glanceWord).toBeNull()
    expect(after.checksCode).toBe('robustness_not_established')
    expect(after.commitRow).toBeUndefined()
    expect(after.rec?.leaderDesignationPermitted).toBe(false)
  })

  it('LEGACY CONTROL — the run’s envelope carries NO admission: behaviour is exactly today’s, absence is never a refusal', () => {
    const hash = runTheAnalysis('absent')
    expect(readTheReasoningTab().glanceWord, 'an older producer’s run states its word').toBe('Sensitive')

    editAFactorValue('comparative_leader')
    expectTheOldRunIsStillDisplayed(hash, 'comparative_leader')

    const after = readTheReasoningTab()
    expect(after.glanceWord).toBe('Sensitive')
    expect(after.checksCode).toBe('robustness_sensitive')
    expect(after.commitRow).toBeDefined()
    expect(after.rec?.leaderDesignationPermitted).toBe(true)
  })

  it('LEGACY CONTROL, both sides — no admission on either turn: today’s behaviour', () => {
    const hash = runTheAnalysis('absent')
    editAFactorValue('absent')
    expectTheOldRunIsStillDisplayed(hash, 'absent')

    const after = readTheReasoningTab()
    expect(after.glanceWord).toBe('Sensitive')
    expect(after.rec?.leaderDesignationPermitted).toBe(true)
  })
})
