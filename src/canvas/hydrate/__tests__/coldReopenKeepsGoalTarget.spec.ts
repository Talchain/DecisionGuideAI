/**
 * A cold reopen keeps the goal target CEE holds (verifier joined diagnosis, 19 Oct: C3 "at least 80 litres left" read
 * goalThreshold 80 before a reopen and null after it, so the goal card said "Needs input"). The read's own
 * `current_read.analysis_ready.goal_threshold_raw` carries it; it is adopted through the same sync a turn runs, read-only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasStore } from '../../store'
import { mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import fixture from '../../domain/__tests__/fixtures/served-graph-read-77d5c480.json'

const scenarioId = fixture._source.scenario_id
const GOAL = fixture.current_read.analysis_ready.goal_node_id

function coldRead(currentRead: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({
    schema: 'scenario_graph.v1', graph_present: true, scenario_id: scenarioId,
    graph: fixture.graph, current_read: currentRead, layout_present: false,
  }) }))
  return hydrateCanvasFromServer(scenarioId)
}
const goalData = () => JSON.stringify(useCanvasStore.getState().nodes.find(n => n.id === GOAL)?.data)

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear()
  useCanvasStore.setState({ currentScenarioId: scenarioId, nodes: fixture.graph.nodes.map(n => mapDraftNodeToCanvas(n as never)), edges: [],
    ceeAnalysisReady: null, goalThreshold: null, goalThresholdRepresentation: null, lastAuthoritativeGraph: null,
    serverGraphIdentity: null, results: { status: 'idle', report: null }, analysisFreshnessDirty: false, goalConstraints: [],
  } as never)
})
afterEach(() => { vi.unstubAllGlobals() })

describe('a cold reopen keeps the goal target the read carries', () => {
  it('goal_threshold_raw on the read becomes the canvas target, raw, and the goal node is not written', async () => {
    expect(fixture.current_read.analysis_ready.goal_threshold_raw).toBe(126000)
    const before = goalData()
    expect(await coldRead(fixture.current_read)).toBe('merged')
    expect(useCanvasStore.getState().ceeAnalysisReady).toBeNull()
    expect(useCanvasStore.getState().goalThreshold).toBe(126000)
    expect(useCanvasStore.getState().goalThresholdRepresentation).toBe('raw')
    expect(goalData()).toBe(before)
  })

  it('CONTRAST: a read with no goal target leaves the target unset', async () => {
    const { goal_threshold: _n, goal_threshold_raw: _r, ...rest } = fixture.current_read.analysis_ready
    await coldRead({ ...fixture.current_read, analysis_ready: rest })
    expect(useCanvasStore.getState().goalThreshold).toBeNull()
  })

  it('CONTRAST: a target the canvas already holds is never replaced by the read', async () => {
    useCanvasStore.setState({ goalThreshold: 100000, goalThresholdRepresentation: 'raw' } as never)
    await coldRead(fixture.current_read)
    expect(useCanvasStore.getState().goalThreshold).toBe(100000)
  })
})
