/**
 * ⭐ A COLD LOAD KEEPS THE READ'S ANALYSIS MODE, ONLY WHILE THE CANVAS IS THAT READ (Canvas, DL 0df0e1; Reasoning's
 * conditions 1–3, 5 Oct).
 *
 * Driven through the REAL `hydrateCanvasFromServer` (fetch stubbed at the transport) and the real adapter parse. The
 * read's `analysis_admission` is CEE's PROJECTION shape (`projectAnalysisAdmission` at CEE 8d686a9c:
 * admitted / permitted_analysis_mode / reason_codes / graph_hash), never an `AnalysisAdmissionV1`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { fetchScenarioGraph } from '../../../adapters/cee/scenarioGraph'
import {
  useBootReadAdmissionStore,
  selectBootReadPermittedMode,
  __resetBootReadAdmissionForTests,
} from '../bootReadAdmission'
import { PERMITTED_ANALYSIS_MODES } from '../../../adapters/cee/types'
import { QUANTIFIED_MODES } from '../../../components/results/analysisNew/testWithoutLinkEligibility'

const ROUTE = '11111111-2222-4333-8444-555555555555'
const OTHER = '99999999-8888-4777-8666-555555555555'
const HASH = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90'

function body(admission: Record<string, unknown> | null, graphHash = HASH) {
  return {
    schema: 'scenario_graph.v1',
    scenario_id: ROUTE,
    graph: { nodes: [{ id: 'goal-1', kind: 'goal', label: 'Revenue' }], edges: [] },
    graph_present: true,
    graph_hash: graphHash,
    brief_text: null,
    layout_present: false,
    request_id: 'req-boot-admission',
    ...(admission ? { analysis_admission: admission } : {}),
  }
}
/** CEE's projection, as `projectAnalysisAdmission` builds it. */
const projection = (mode: unknown, over: Record<string, unknown> = {}) => ({
  admitted: true,
  permitted_analysis_mode: mode,
  semantic_quality_sufficient: true,
  reason_codes: ['READY_TO_COMPARE'],
  missing_input_codes: [],
  missing_input_count: 0,
  inputs_demanded_of_user: 0,
  inputs_waived_by_exclusion: 0,
  graph_hash: HASH,
  semantic_signals: { material_parameters_awaiting_user_node_ids: [] },
  ...over,
})
const json = (status: number, b: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => b }) as unknown as Response

const PRISTINE = useCanvasStore.getState()
let fetchSpy: ReturnType<typeof vi.fn>
beforeEach(() => {
  __resetBootReadAdmissionForTests()
  useCanvasStore.setState(PRISTINE, true)
  useCanvasStore.setState({ currentScenarioId: ROUTE, nodes: [], edges: [], serverGraphIdentity: null } as never)
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
})
afterEach(() => {
  vi.unstubAllGlobals()
})
const record = () => useBootReadAdmissionStore.getState().record
const modeNow = () => selectBootReadPermittedMode(useCanvasStore.getState(), record())

describe('the read records its mode beside the boot admission, under the same binding', () => {
  it('⭐ an admitted read for its own revision, canvas proven equal: the mode is kept and readable', async () => {
    fetchSpy.mockResolvedValue(json(200, body(projection('exploratory'))))
    await hydrateCanvasFromServer(ROUTE, { retryDelayMs: 0 })
    expect(useCanvasStore.getState().bootAdmittedRevision).toBe(HASH) // the existing binding held (instrument)
    expect(record()).toEqual({ scenarioId: ROUTE, graphHash: HASH, permittedAnalysisMode: 'exploratory' })
    expect(modeNow()).toBe('exploratory')
  })

  it('an admission naming ANOTHER revision is not this read\'s: nothing kept', async () => {
    fetchSpy.mockResolvedValue(json(200, body(projection('exploratory', { graph_hash: 'ffff0000' }))))
    await hydrateCanvasFromServer(ROUTE, { retryDelayMs: 0 })
    expect(record()).toBeNull()
  })

  it('a read CEE does not admit keeps nothing (the boot admission does not stand in either)', async () => {
    fetchSpy.mockResolvedValue(json(200, body(projection('none', { admitted: false }))))
    await hydrateCanvasFromServer(ROUTE, { retryDelayMs: 0 })
    expect(useCanvasStore.getState().bootAdmittedRevision).toBeNull()
    expect(record()).toBeNull()
  })

  it('a later read that does not qualify CLEARS an earlier one', async () => {
    fetchSpy.mockResolvedValueOnce(json(200, body(projection('exploratory'))))
    await hydrateCanvasFromServer(ROUTE, { retryDelayMs: 0 })
    expect(record()).not.toBeNull()
    useCanvasStore.setState({ serverGraphIdentity: null } as never)
    fetchSpy.mockResolvedValueOnce(json(200, body(null)))
    await hydrateCanvasFromServer(ROUTE, { retryDelayMs: 0 })
    expect(record()).toBeNull()
  })
})

describe('the adapter carries the read\'s mode only under its own revision binding (a wire field any reader may use)', () => {
  it('⭐ the admission names this read\'s revision: the mode is carried', async () => {
    fetchSpy.mockResolvedValue(json(200, body(projection('quantified_provisional'))))
    const r = await fetchScenarioGraph(ROUTE, { retryDelayMs: 0 })
    expect(r.status).toBe('graph')
    expect(r.status === 'graph' ? r.permittedAnalysisMode : 'not a graph').toBe('quantified_provisional')
  })
  it('⭐ the admission names ANOTHER revision: no mode, even though the literal is valid', async () => {
    fetchSpy.mockResolvedValue(json(200, body(projection('quantified_provisional', { graph_hash: 'ffff0000' }))))
    const r = await fetchScenarioGraph(ROUTE, { retryDelayMs: 0 })
    expect(r.status === 'graph' ? r.permittedAnalysisMode : 'not a graph').toBeNull()
  })
})

describe('contract: the mode literals are the ONE list the button compares against (Reasoning condition 2)', () => {
  it.each([...PERMITTED_ANALYSIS_MODES])('the read\'s "%s" is kept verbatim', async (mode) => {
    fetchSpy.mockResolvedValue(json(200, body(projection(mode))))
    await hydrateCanvasFromServer(ROUTE, { retryDelayMs: 0 })
    expect(record()?.permittedAnalysisMode).toBe(mode)
  })

  it('a literal outside the list is not a mode: nothing kept', async () => {
    fetchSpy.mockResolvedValue(json(200, body(projection('quantified'))))
    await hydrateCanvasFromServer(ROUTE, { retryDelayMs: 0 })
    expect(record()).toBeNull()
  })

  it('every mode the button accepts is a literal of that list', () => {
    for (const m of QUANTIFIED_MODES) expect(PERMITTED_ANALYSIS_MODES as readonly string[]).toContain(m)
    expect(QUANTIFIED_MODES.size).toBeGreaterThan(0)
  })
})

describe('⭐ the getter answers only while the canvas IS the read (Reasoning condition 1)', () => {
  const bound = { scenarioId: ROUTE, graphHash: HASH, permittedAnalysisMode: 'exploratory' as const }
  const canvas = { currentScenarioId: ROUTE, bootAdmittedRevision: HASH, lastServerGraphHash: HASH, pendingEmittedEdits: 0, importPendingServerRegistration: false }

  it('control: the same scenario, revision and screen: the mode', () => {
    expect(selectBootReadPermittedMode(canvas, bound)).toBe('exploratory')
  })
  it('⭐ the store moved to another scenario: null', () => {
    expect(selectBootReadPermittedMode({ ...canvas, currentScenarioId: OTHER }, bound)).toBeNull()
  })
  it('⭐ the boot revision is no longer the recorded one (cleared, or another read): null', () => {
    expect(selectBootReadPermittedMode({ ...canvas, bootAdmittedRevision: null }, bound)).toBeNull()
    expect(selectBootReadPermittedMode({ ...canvas, bootAdmittedRevision: 'other-hash' }, bound)).toBeNull()
  })
  it('⭐ the revision on screen moved (an edit or a turn since): null', () => {
    expect(selectBootReadPermittedMode({ ...canvas, lastServerGraphHash: 'moved-hash' }, bound)).toBeNull()
  })
  it('an edit is queued, or an import awaits registration: null', () => {
    expect(selectBootReadPermittedMode({ ...canvas, pendingEmittedEdits: 1 }, bound)).toBeNull()
    expect(selectBootReadPermittedMode({ ...canvas, importPendingServerRegistration: true }, bound)).toBeNull()
  })
  it('nothing recorded: null', () => {
    expect(selectBootReadPermittedMode(canvas, null)).toBeNull()
  })
})
