import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Node } from '@xyflow/react'
import { useCanvasStore } from '../../store'
import { restoreCeeAnalysisReady } from '../../ReactFlowGraph'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
import { composeAnalysisState } from '../../state/analysisStateSelector'
import { readAnalysisStateSourceFromStore } from '../../hooks/useAnalysisStateSource'
import { mapDraftEdgeToCanvas, mapDraftNodeToCanvas } from '../applyDraftResult'
import { mergeServerGraphOnHydrate } from '../mergeServerGraph'
import { __resetAppliedEditPulseForTests, PULSE_COALESCE_MS } from '../appliedEditPulse'

// Native staging reload 2026-09-08, UI 337f553f, scenario f7a0ca3f-...,
// graph-read request 16822367-42fb-4584-a8eb-661aeb8831c4. Exact intervention
// maps from RELOAD-REGRESSION-FIXTURE.json; no claim that this is a browser test.
const OPTIONS: Array<{
  id: string; label: string
  before: Record<string, unknown>; after: Record<string, unknown>
}> = [
  {
    "id": "49d90be9",
    "label": "Hire a Hands-on Technical Lead",
    "before": {
      "756a7698": 1
    },
    "after": {
      "756a7698": {
        "value": 1,
        "source": "cee_hypothesis",
        "raw_value": 1,
        "reasoning": "Olumi estimate via edge f5285b56; no stated figure is cited for this option→factor effect",
        "target_match": {
          "node_id": "756a7698",
          "confidence": "high",
          "match_type": "exact_id"
        },
        "value_confidence": "low"
      }
    }
  },
  {
    "id": "57f5d1fa",
    "label": "Status Quo: No New Hire",
    "before": {
      "2c2ae0b7": 0,
      "756a7698": 0
    },
    "after": {
      "2c2ae0b7": {
        "value": 0,
        "source": "cee_hypothesis",
        "raw_value": 0,
        "reasoning": "Model-chosen intervention level; this factor's scale is not recorded, so the amount could not be checked against the brief",
        "target_match": {
          "node_id": "2c2ae0b7",
          "confidence": "high",
          "match_type": "exact_id"
        },
        "value_confidence": "low"
      },
      "756a7698": {
        "value": 0,
        "source": "cee_hypothesis",
        "raw_value": 0,
        "reasoning": "Model-chosen intervention level; this factor's scale is not recorded, so the amount could not be checked against the brief",
        "target_match": {
          "node_id": "756a7698",
          "confidence": "high",
          "match_type": "exact_id"
        },
        "value_confidence": "low"
      }
    }
  },
  {
    "id": "be215545",
    "label": "Two Developers",
    "before": {
      "2c2ae0b7": 0.4
    },
    "after": {
      "2c2ae0b7": {
        "value": 0.4,
        "source": "cee_hypothesis",
        "raw_value": 2,
        "reasoning": "Olumi estimate via edge 9ea8081b; no stated figure is cited for this option→factor effect",
        "target_match": {
          "node_id": "2c2ae0b7",
          "confidence": "high",
          "match_type": "exact_id"
        },
        "value_confidence": "low"
      }
    }
  }
]
const SCENARIO = 'f7a0ca3f-a61b-4d5a-8ced-3a36174ad4fb'
const HASH = '2a0e10531f3a6ec9'
const COMPUTED = '2026-09-08T11:36:31.869Z'
const FACTOR = '2c2ae0b7'
const OPTION = 'be215545'
const SUPPORT = [
  { id: FACTOR, kind: 'factor', label: 'Development Headcount' },
  { id: '756a7698', kind: 'factor', label: 'Technical Leadership Capacity' },
  { id: '124ec3bb', kind: 'factor', label: 'Team Coordination Overhead' },
  { id: 'bb2d8637', kind: 'goal', label: 'Improve Productivity' },
]
const EDGE = {
  from: '756a7698', to: '124ec3bb',
  strength: { mean: -0.7, std: 0.10799999999999998 },
  effect_direction: 'negative', exists_probability: 0.8,
  provenance: { source: 'user_specified' }, provenance_display: 'user_set',
}

function wireNodes(rich = true) {
  return [
    ...SUPPORT,
    ...OPTIONS.map(option => ({
      id: option.id, kind: 'option', label: option.label,
      interventions: structuredClone(rich ? option.after : option.before),
    })),
  ]
}

function currentOption(id = OPTION) {
  const node = useCanvasStore.getState().nodes.find(n => n.id === id)
  if (!node) throw new Error('Missing fixture option ' + id)
  return node
}

function display() {
  const s = useCanvasStore.getState()
  return composeAnalysisState({
    analysisState: s.analysisStateV1, freshness: s.analysisFreshness,
    dirty: s.analysisFreshnessDirty, source: readAnalysisStateSourceFromStore().source,
    resultsStatus: s.results.status,
    importHold: s.importPendingServerRegistration, hasReport: !!s.results.report,
    hasRenderableResult: true, ceeAnalysisReadyStatus: s.ceeAnalysisReady?.status,
    aiPanelV2On: true,
  })
}

function seedRestored(rich = false) {
  const nodes: Node[] = wireNodes(rich).map((wire, index) => ({
    ...mapDraftNodeToCanvas(wire),
    position: { x: index * 30, y: 60 }, selected: wire.id === OPTION,
    data: { ...mapDraftNodeToCanvas(wire).data, source: 'user_override' },
  }))
  const mappedEdge = mapDraftEdgeToCanvas(EDGE, 0)
  useCanvasStore.setState({
    currentScenarioId: SCENARIO, nodes,
    edges: [{ ...mappedEdge, id: 'e-9', data: {
      ...mappedEdge.data, weightSource: 'user', directionSource: 'user',
    } }],
    ceeAnalysisReady: null, analysisStateV1: null, v5AnalysisFact: null,
    importPendingServerRegistration: false, pendingEmittedEdits: 0,
    lastAuthoritativeGraph: null, serverGraphIdentity: null,
    history: { past: [], future: [] },
    highlightedNodes: new Set(), highlightedEdges: new Set(),
  })
  useCanvasStore.getState().resultsLoadHistorical({
    id: 'captured-rerun', ts: Date.parse(COMPUTED), hash: HASH,
    report: {
      schema: 'report.v1', meta: { seed: null, response_id: 'fixture-result', elapsed_ms: 1 },
      model_card: { response_hash: HASH, response_hash_algo: 'fnv1a-64', normalized: true },
      results: { conservative: 0.2, likely: 0.6, optimistic: 0.8 },
      confidence: { level: 'low', why: 'Fixture' }, drivers: [],
    },
  }, SCENARIO)
  expect(useCanvasStore.getState().analysisFreshness?.freshnessReason).toBe('hydrated_without_capture')
  // Real boot call site via its session fallback; no cast/mocked restore or store.
  sessionStorage.setItem('olumi-cee-analysis-ready', JSON.stringify({
    options: OPTIONS.map(o => ({ id: o.id, label: o.label, status: 'ready', interventions: o.after })),
    goal_node_id: 'bb2d8637', status: 'ready', freshness: 'fresh',
    freshness_reason: 'graph_hash_match', graph_hash_at_run: HASH,
    current_graph_hash: HASH, computed_at: COMPUTED,
  }))
  sessionStorage.setItem('olumi-cee-analysis-ready-node-ids', JSON.stringify(nodes.map(n => n.id)))
  restoreCeeAnalysisReady('none', null, null, nodes)
  expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
  expect(display().semantic).toBe('current')
}

function hydrate(nodes = wireNodes()) {
  return mergeServerGraphOnHydrate({ nodes, edges: [EDGE] })
}

beforeEach(() => {
  vi.stubEnv('VITE_V5_CANONICAL_ANALYSIS', '1')
  useCanvasStore.getState().reset()
  sessionStorage.clear()
  __resetAppliedEditPulseForTests()
  vi.useFakeTimers()
  seedRestored()
})
afterEach(() => {
  __resetAppliedEditPulseForTests()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  sessionStorage.clear()
})

describe('option intervention representation on reload', () => {
  it('captured restore → parsed graph read → real store stays current and retains rich metadata', async () => {
    const before = useCanvasStore.getState()
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      schema: 'scenario_graph.v1', scenario_id: SCENARIO, graph_present: true,
      graph: { nodes: wireNodes(), edges: [EDGE] }, request_id: 'captured-reload-fixture',
      analysis_state: {
        run_state: { kind: 'complete_current', computed_at: COMPUTED },
        readiness: { status: 'unknown', blockers: [] },
        leader_claim: { permitted: true, separation: 'separated' },
        robustness: { aggregate_level: 'low' }, usable_for_prose: true,
        usable_for_chips: true, usable_for_followup: true,
        requires_rerun: false, blocked_unusable: false, contradictions: [],
      },
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    expect(await hydrateCanvasFromServer(SCENARIO)).toBe('merged')
    expect(fetch).toHaveBeenCalledTimes(1)
    for (const option of OPTIONS) {
      expect(currentOption(option.id).data.interventions).toEqual(option.after)
      expect(currentOption(option.id).data.source).toBe('user_override')
    }
    expect(currentOption().selected).toBe(true)
    expect(currentOption().position).toEqual(before.nodes.find(n => n.id === OPTION)?.position)
    expect(useCanvasStore.getState().edges[0]).toBe(before.edges[0])
    expect.soft(useCanvasStore.getState().history).toBe(before.history)
    expect.soft(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
    expect.soft(useCanvasStore.getState().graphEditedSinceLastRun).toBe(before.graphEditedSinceLastRun)
    expect.soft(useCanvasStore.getState().analysisStateReady).toBe(before.analysisStateReady)
    expect.soft(useCanvasStore.getState().analysisFreshness).toBe(before.analysisFreshness)
    expect.soft(display().semantic).toBe('current')
    vi.advanceTimersByTime(PULSE_COALESCE_MS)
    expect.soft(useCanvasStore.getState().highlightedNodes.size).toBe(0)
  })

  it('keeps rich → scalar as canonical replacement plus invalidation, not an equivalence waiver', () => {
    seedRestored(true)
    expect(hydrate(wireNodes(false)).changed).toBe(true)
    expect(currentOption().data.interventions).toEqual(OPTIONS.find(o => o.id === OPTION)?.before)
    expect(display().semantic).toBe('changed')
    expect(useCanvasStore.getState().history.past).toHaveLength(1)
  })

  it('keeps repeated identical rich hydration idempotent after acquisition', () => {
    hydrate()
    const before = useCanvasStore.getState()
    expect(display().semantic).toBe('current')
    expect(hydrate().changed).toBe(false)
    expect(useCanvasStore.getState().nodes).toBe(before.nodes)
    expect(useCanvasStore.getState().history).toBe(before.history)
  })

  it('does not clear a prior genuine dirty overlay during metadata acquisition', () => {
    useCanvasStore.getState().markGraphStructurallyEdited()
    const before = useCanvasStore.getState()
    hydrate()
    expect(currentOption().data.interventions).toEqual(OPTIONS.find(o => o.id === OPTION)?.after)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(useCanvasStore.getState().graphEditedSinceLastRun).toBe(true)
    expect(useCanvasStore.getState().analysisStateReady).toBe(false)
    expect(useCanvasStore.getState().history).toBe(before.history)
    expect(display().semantic).toBe('changed')
  })

  it.each([
    ['numeric value', { [FACTOR]: { value: 0.6 } }],
    ['retarget', { '756a7698': { value: 0.4 } }],
    ['removed target', {}],
    ['added zero target', { [FACTOR]: { value: 0.4 }, '756a7698': { value: 0 } }],
    ['null value', { [FACTOR]: { value: null } }],
    ['string value', { [FACTOR]: { value: '0.4' } }],
    ['boolean value', { [FACTOR]: { value: true } }],
    ['array value', { [FACTOR]: [0.4] }],
    ['non-finite value', { [FACTOR]: { value: Infinity } }],
    ['invalid additional target', { [FACTOR]: { value: 0.4 }, '756a7698': null }],
  ])('still invalidates a real %s change; equivalent siblings do not pulse', (_name, interventions) => {
    const nodes = wireNodes().map(node => node.id === OPTION ? { ...node, interventions } : node)
    const before = useCanvasStore.getState()
    hydrate(nodes)
    expect(currentOption().data.interventions).toEqual(interventions)
    expect(useCanvasStore.getState().history.past).toHaveLength(before.history.past.length + 1)
    expect(useCanvasStore.getState()).toMatchObject({
      analysisFreshnessDirty: true, graphEditedSinceLastRun: true, analysisStateReady: false,
    })
    expect(display().semantic).toBe('changed')
    vi.advanceTimersByTime(PULSE_COALESCE_MS)
    expect([...useCanvasStore.getState().highlightedNodes]).toEqual([OPTION])
  })

  it('does not waive changes to already-rich reasoning/provenance because values match', () => {
    seedRestored(true)
    const nodes = wireNodes().map(node => node.id === OPTION ? {
      ...node, interventions: { [FACTOR]: { value: 0.4, source: 'user_specified' } },
    } : node)
    hydrate(nodes)
    expect(display().semantic).toBe('changed')
    expect(currentOption().data.interventions).toEqual({ [FACTOR]: { value: 0.4, source: 'user_specified' } })
  })

  it('still invalidates an addition, stores acquired metadata, and invents no overwrite/pulse', () => {
    const history = useCanvasStore.getState().history
    hydrate([...wireNodes(), { id: 'new-factor', kind: 'factor', label: 'New factor' }])
    expect(currentOption().data.interventions).toEqual(OPTIONS.find(o => o.id === OPTION)?.after)
    expect(useCanvasStore.getState().nodes.some(n => n.id === 'new-factor')).toBe(true)
    expect(display().semantic).toBe('changed')
    expect.soft(useCanvasStore.getState().history).toBe(history)
    vi.advanceTimersByTime(PULSE_COALESCE_MS)
    expect.soft(useCanvasStore.getState().highlightedNodes.size).toBe(0)
  })

  it('does not waive another changed node field beside equivalent interventions', () => {
    hydrate(wireNodes().map(node => node.id === OPTION ? { ...node, value: 0.8 } : node))
    expect(display().semantic).toBe('changed')
    expect(currentOption().data.value).toBe(0.8)
  })

  it('does not waive a node kind change beside equivalent interventions', () => {
    hydrate(wireNodes().map(node => node.id === OPTION ? { ...node, kind: 'factor' } : node))
    expect(display().semantic).toBe('changed')
    expect(currentOption().type).toBe('factor')
  })

  it('preserves the unregistered-import refusal and the local model', () => {
    useCanvasStore.setState({ importPendingServerRegistration: true })
    const nodes = useCanvasStore.getState().nodes
    expect(hydrate()).toMatchObject({ accepted: false, refusedReason: 'importUnregistered' })
    expect(useCanvasStore.getState().nodes).toBe(nodes)
  })
})
