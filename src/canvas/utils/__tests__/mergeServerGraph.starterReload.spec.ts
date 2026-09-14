import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasStore } from '../../store'
import { EdgeDataSchema, type EdgeData } from '../../domain/edges'
import { mergeServerGraphOnHydrate } from '../mergeServerGraph'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
import { normaliseInterventionKeys } from '../normaliseInterventionKeys'
import {
  clearImportRegistrationMarkers,
  isGraphServerAcknowledged,
  isSameAnalyticalModel,
  markGraphServerAcknowledged,
} from '../../store/importRegistrationMarker'
import { __resetAppliedEditPulseForTests } from '../appliedEditPulse'
import captured from './fixtures/starter-registration-reload.json'

// Actual hosted saved-starter → register → run → reload, 2026-09-08 17:35–17:42Z.
// UI 68ed559c; CEE hydrate request d423fc2c-18db-4247-b622-82434392bdea.
// The fixture contains the captured pre-reload canvas data and server graph,
// not an invented same-value shape. Positions are test-only layout controls.
function seed() {
  const nodes = structuredClone(captured.canvas.nodes).map((node, i) => ({
    ...node, position: { x: i * 25, y: 70 },
  }))
  const edges = structuredClone(captured.canvas.edges).map(edge => {
    // JSON imports widen enum literals. Validate the actual stored shape and
    // prove the parser did not default, strip or otherwise alter our capture.
    const data = EdgeDataSchema.parse(edge.data)
    expect(data).toEqual(edge.data)
    return { ...edge, data: data as EdgeData }
  })
  useCanvasStore.setState({
    currentScenarioId: captured.capture.scenario,
    nodes, edges, importPendingServerRegistration: false,
    lastAuthoritativeGraph: null, serverGraphIdentity: null,
    history: { past: [], future: [] },
    graphEditedSinceLastRun: false, analysisStateReady: true,
    analysisFreshnessDirty: false,
    analysisFreshness: {
      freshness: 'fresh', freshnessReason: 'restored_attestation_hashes_aligned',
      graphHashAtRun: captured.capture.graphHash,
      currentGraphHash: captured.capture.graphHash,
      computedAt: captured.capture.computedAt,
    },
    analysisStateV1: {
      run_state: { kind: 'complete_current', computed_at: captured.capture.computedAt },
      readiness: { status: 'ready', blockers: [] },
      leader_claim: { permitted: true, separation: 'separated' },
      robustness: { aggregate_level: 'low' },
      usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
      requires_rerun: false, blocked_unusable: false, contradictions: [],
    },
  })
  markGraphServerAcknowledged(captured.capture.scenario, nodes, edges)
  expect(isGraphServerAcknowledged(captured.capture.scenario, nodes, edges)).toBe(true)
  expect(nodes).toHaveLength(19)
  expect(edges).toHaveLength(39)
  return useCanvasStore.getState()
}

beforeEach(() => {
  vi.useFakeTimers()
  clearImportRegistrationMarkers()
  useCanvasStore.getState().reset()
  __resetAppliedEditPulseForTests()
})
afterEach(() => {
  __resetAppliedEditPulseForTests()
  clearImportRegistrationMarkers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function expectCurrent(before: ReturnType<typeof seed>) {
  const after = useCanvasStore.getState()
  expect.soft(after.analysisFreshnessDirty).toBe(false)
  expect.soft(after.graphEditedSinceLastRun).toBe(false)
  expect.soft(after.analysisStateReady).toBe(true)
  expect.soft(after.analysisStateV1).toEqual(before.analysisStateV1)
  expect.soft(after.history === before.history).toBe(true)
  expect.soft(after.nodes.map(n => n.position)).toEqual(before.nodes.map(n => n.position))
}

describe('captured saved-starter no-edit reload', () => {
  it('keeps the parsed server read current without a new registration acknowledgement', async () => {
    const before = seed()
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      schema: 'scenario_graph.v1', scenario_id: captured.capture.scenario,
      graph_present: true, graph: captured.serverGraph,
      request_id: 'captured-starter-reload', analysis_state: before.analysisStateV1,
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    expect(await hydrateCanvasFromServer(captured.capture.scenario)).toBe('merged')
    expect(fetch).toHaveBeenCalledTimes(1)
    expectCurrent(before)
    const after = useCanvasStore.getState()
    expect(isGraphServerAcknowledged(captured.capture.scenario, after.nodes, after.edges)).toBe(true)
  })

  it('retains currentness and its exact-model acknowledgement across actual server hydration', () => {
    const before = seed()
    expect(mergeServerGraphOnHydrate(structuredClone(captured.serverGraph)).accepted).toBe(true)
    expectCurrent(before)
    const after = useCanvasStore.getState()
    expect.soft(isGraphServerAcknowledged(captured.capture.scenario, after.nodes, after.edges)).toBe(true)
    expect.soft(isSameAnalyticalModel(before.nodes, before.edges, after.nodes, after.edges)).toBe(true)
  })

  it('isolates no-edit option JSON round-trip from every edge overlay', () => {
    const before = seed()
    mergeServerGraphOnHydrate({ nodes: structuredClone(captured.serverGraph.nodes), edges: [] })
    expectCurrent(before)
  })

  it('isolates acquisition of explicit directed edge type from every option overlay', () => {
    const before = seed()
    mergeServerGraphOnHydrate({ nodes: [], edges: structuredClone(captured.serverGraph.edges) })
    expectCurrent(before)
    expect(useCanvasStore.getState().edges.every(e => e.data?.edge_type === 'directed')).toBe(true)
  })

  it('also retains currentness when the option maps are read in the opposite insertion order', () => {
    const before = seed()
    const nodes = structuredClone(captured.serverGraph.nodes).map(node => {
      if (!('interventions' in node) || !node.interventions) return node
      return { ...node, interventions: Object.fromEntries(Object.entries(node.interventions).reverse()) }
    })
    mergeServerGraphOnHydrate({ nodes, edges: captured.serverGraph.edges })
    expectCurrent(before)
  })

  it.each([
    ['strength', { strength: { mean: 0.91, std: 0.13 } }],
    ['uncertainty', { strength: { ...captured.serverGraph.edges[0].strength, std: 0.91 } }],
    ['direction', { effect_direction: 'negative', strength: { mean: -0.91, std: 0.13 } }],
    ['non-default edge type', { edge_type: 'undirected' }],
  ])('still invalidates a real edge %s change', (_name, delta) => {
    seed()
    mergeServerGraphOnHydrate({
      nodes: captured.serverGraph.nodes,
      edges: captured.serverGraph.edges.map((edge, i) => i === 0 ? { ...edge, ...delta } : edge),
    })
    const after = useCanvasStore.getState()
    expect(after.analysisFreshnessDirty).toBe(true)
    expect(after.analysisStateReady).toBe(false)
    expect(isGraphServerAcknowledged(captured.capture.scenario, after.nodes, after.edges)).toBe(false)
  })

  it('keeps a real changed intervention unacknowledged and marks the result stale', () => {
    seed()
    const graph = structuredClone(captured.serverGraph)
    const option = graph.nodes.find(n => n.id === 'opt_rudderstack')!
    if (!('interventions' in option) || !option.interventions) throw new Error('Missing captured interventions')
    option.interventions.fac_annual_cost = { ...option.interventions.fac_annual_cost, value: 0.9 }
    mergeServerGraphOnHydrate(graph)
    const after = useCanvasStore.getState()
    expect(after.analysisFreshnessDirty).toBe(true)
    expect(after.graphEditedSinceLastRun).toBe(true)
    expect(after.analysisStateReady).toBe(false)
    expect(isGraphServerAcknowledged(captured.capture.scenario, after.nodes, after.edges)).toBe(false)
  })

  it('does not clear an already dirty result on the same no-edit readback', () => {
    seed()
    useCanvasStore.getState().markGraphStructurallyEdited()
    mergeServerGraphOnHydrate(structuredClone(captured.serverGraph))
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(useCanvasStore.getState().analysisStateReady).toBe(false)
  })
})

describe('registration identity of the derived option-key index', () => {
  it('acknowledges the same target membership in a different order without changing input bytes', () => {
    const before = seed()
    const original = JSON.stringify(before.nodes)
    const reordered = before.nodes.map(node => node.type === 'option' ? {
      ...node, data: { ...node.data, interventionKeys: [...(node.data.interventionKeys as string[])].reverse() },
    } : node)
    expect(JSON.stringify(reordered)).not.toBe(original)
    expect(isGraphServerAcknowledged(captured.capture.scenario, reordered, before.edges)).toBe(true)
    expect(JSON.stringify(before.nodes)).toBe(original)
  })

  it.each([
    ['removed key', (keys: string[]) => keys.slice(1)],
    ['new key', (keys: string[]) => [...keys, 'unacknowledged-target']],
    ['duplicate key', (keys: string[]) => [...keys, keys[0]]],
    ['malformed index', (keys: string[]) => [...keys, null]],
  ])('does not acknowledge a %s', (_name, change) => {
    const before = seed()
    const changed = before.nodes.map(node => node.id === 'opt_rudderstack' ? {
      ...node, data: { ...node.data, interventionKeys: change(node.data.interventionKeys as string[]) },
    } : node)
    expect(isGraphServerAcknowledged(captured.capture.scenario, changed, before.edges)).toBe(false)
  })

  it('does not make other arrays or non-option fields order-insensitive', () => {
    const before = seed()
    const nodes = before.nodes.map(node => node.type === 'factor' ? {
      ...node, data: { ...node.data, interventionKeys: ['first', 'second'], prior: { range: [0.1, 0.9] } },
    } : node)
    markGraphServerAcknowledged(captured.capture.scenario, nodes, before.edges)
    for (const delta of [{ interventionKeys: ['second', 'first'] }, { prior: { range: [0.9, 0.1] } }]) {
      const changed = nodes.map(node => node.type === 'factor' ? { ...node, data: { ...node.data, ...delta } } : node)
      expect(isGraphServerAcknowledged(captured.capture.scenario, changed, before.edges)).toBe(false)
    }
  })

  it('leaves unknown index shapes untouched rather than sanitising them', () => {
    for (const interventionKeys of [null, 'factor', ['factor', null], { factor: true }]) {
      const node = { interventionKeys }
      expect(normaliseInterventionKeys(node)).toBe(node)
    }
  })
})
