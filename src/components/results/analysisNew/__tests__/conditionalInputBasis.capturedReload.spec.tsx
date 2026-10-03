import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, renderHook, screen } from '@testing-library/react'
vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))
import { useCanvasStore } from '../../../../canvas/store'
import capture from './b3-captured-census-read.fixture.json'
import { hydrateCanvasFromServer } from '../../../../canvas/hydrate/serverGraphHydration'
import { useResultsSectionData } from '../../useResultsSectionData'
import { useAnalysisNewViewModel } from '../useAnalysisNewViewModel'
import { AtAGlance } from '../sections/AtAGlance'
import { mapV5AnalysisToReport } from '../../../../v5/mapV5AnalysisToReport'
import { logger } from '../../../../lib/logger'
import { AnalysisStateV1Schema } from '@talchain/schemas/boundary'

// Graph/census/mode/hash are produced by the real CEE admission authority on an
// existing captured graph. Only the analysis_result below is an offline mapper
// fixture, NOT a computation or served acceptance witness.
const SCENARIO = '11111111-2222-4333-8444-555555555555'
const RUN_HASH = 'd'.repeat(16) // intentionally differs from the stored-graph CAS hash
const TID = 'analysis-new-glance-conditional-input-basis'
const options = capture.graph.nodes.filter((n) => n.kind === 'option')
const probabilities = [0.78, 0.14, 0.08]
type CensusCase = 'actual' | 'empty' | 'mismatch' | 'absent'

function readBody(kind: CensusCase, current = true) {
  const fixture = kind === 'empty' ? capture.known_empty : capture
  const graphHash = fixture.reference_hash.slice(0, 16)
  const admission: Record<string, unknown> = structuredClone(fixture.projection)
  if (kind === 'absent') delete admission.semantic_signals
  if (kind === 'mismatch') admission.graph_hash = 'f'.repeat(64)
  return {
    schema: 'scenario_graph.v1', scenario_id: SCENARIO, graph_present: true, graph: fixture.graph,
    layout_present: false, graph_hash: graphHash, graph_identity_hash: {
      kind: 'graph_identity_hash', value: 'c'.repeat(64), algorithm: 'sha256',
      projection_version: 'identity.v1', graph_schema_version: 'graph_v3', normaliser_version: '1',
    },
    analysis_admission: admission,
    analysis_state: {
      run_state: { kind: current ? 'complete_current' : 'complete_stale', computed_at: '2026-10-03T00:00:00.000Z', ...(!current ? { cause: 'graph_changed' } : {}) },
      readiness: { status: 'ready', blockers: [] }, leader_claim: current ? { permitted: true } : { permitted: false, withheld_reason: 'analysis_out_of_date' }, robustness: {},
      usable_for_prose: true, usable_for_chips: current, usable_for_followup: true,
      requires_rerun: !current, blocked_unusable: false, contradictions: [],
    },
    analysis_result: current ? {
      type: 'analysis_result', summary: 'Keep £49 Price leads in this offline mapper fixture.', leading_option_id: options[0].id,
      win_probabilities: Object.fromEntries(options.map((n, i) => [n.id, probabilities[i]])), computed_against_hash: RUN_HASH,
      enrichment: {
        analysis_status: 'ok',
        option_comparison: options.map((n, i) => ({ option_id: n.id, option_label: n.label, status: 'computed',
          win_probability: probabilities[i], outcome: { mean: 0.62 - i * 0.2, p10: 0.2, p50: 0.5, p90: 0.8 },
        })),
        robustness: { near_tie: { is_tie: false, top_option_id: options[0].id, second_option_id: options[1].id, gap: 0.64, threshold: 0.1 } },
        decision_brief: { headline_banded: { band: 'clearly_ahead', leader_option_id: options[0].id, robustness_gated: false } },
      },
    } : null,
    request_id: 'b3-captured-canonical-reload',
  }
}

function MountedResult() {
  const data = useResultsSectionData()
  const vm = useAnalysisNewViewModel({ data, isPreRun: false, isRunning: false, isStale: false })
  return <AtAGlance reanalyseBlocked={false} isRunning={false} reanalyseBlockedReason={null} glance={vm.atAGlance} />
}

async function coldRead(kind: CensusCase, current = true, licensed = true) {
  const body = readBody(kind, current)
  expect(AnalysisStateV1Schema.safeParse(body.analysis_state).success).toBe(true)
  expect(body.analysis_admission.admitted).toBe(true)
  expect(body.analysis_admission.permitted_analysis_mode).toBe('comparative_leader')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body }))
  expect(await hydrateCanvasFromServer(SCENARIO)).toBe('merged')
  if (current) {
    expect(useCanvasStore.getState().analysisFreshness?.freshness).toBe('fresh')
    expect(useCanvasStore.getState().analysisStateV1?.leader_claim.permitted).toBe(true)
    expect(Object.keys(useCanvasStore.getState().results.report!.option_probabilities!)).toHaveLength(3)
    const { result } = renderHook(() => {
      const data = useResultsSectionData()
      return { recommendation: data.recommendation, glance: useAnalysisNewViewModel({ data, isPreRun: false, isRunning: false, isStale: false }).atAGlance }
    })
    expect(result.current.recommendation.leaderDesignationPermitted).toBe(licensed)
    if (licensed) expect(result.current.glance.headline).not.toBeNull()
    else expect(result.current.glance.headline).toBeNull()
  }
  render(<MountedResult />)
}

function holdSameReport() {
  const report = mapV5AnalysisToReport(readBody('actual').analysis_result as never)
  useCanvasStore.setState({ results: { status: 'complete', progress: 100, report, hash: report.model_card.response_hash },
    analysisFreshness: { freshness: 'unknown', freshnessReason: 'hydrated_without_capture' } } as never)
  return report
}

beforeEach(() => {
  vi.spyOn(logger, 'debug')
  useCanvasStore.setState({ currentScenarioId: SCENARIO, nodes: [], edges: [], lastAuthoritativeGraph: null, serverGraphIdentity: null,
    importPendingServerRegistration: false, pendingEmittedEdits: 0, history: { past: [], future: [] },
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    ceeAnalysisReady: null, retainedAnalysisAdmission: null, v5AnalysisFact: null,
    results: useCanvasStore.getInitialState().results, runMeta: {}, rawV2Response: null,
  } as never)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

function expectNamedBasis() {
  const text = screen.getByTestId(TID).textContent!
  expect(text).toContain('Olumi’s estimates')
  for (const id of capture.reference_census) {
    expect(text).toContain(capture.graph.nodes.find((n) => n.id === id)!.label)
  }
}

describe('B3-8 captured authority → real canonical reader → mounted result (offline contract)', () => {
  it('CONTROL: an older projection without the census says unavailable', async () => {
    expect(capture.reference_census).toHaveLength(3)
    expect(capture.projection.semantic_signals.material_parameters_awaiting_user_node_ids).toEqual(capture.reference_census)
    await coldRead('absent')
    expect(screen.getByTestId(TID)).toHaveTextContent('unavailable')
  })
  it('the actual producer census survives the actual cold-read consumers', async () => {
    await coldRead('actual')
    expect(useCanvasStore.getState().results.report!.run_analysis_admission).toBeUndefined()
    expectNamedBasis()
  })
  it(' an authoritative known-empty census does not become unavailable', async () => {
    expect(capture.known_empty.reference_census).toEqual([])
    await coldRead('empty')
    expect(screen.queryByTestId(TID)).not.toBeInTheDocument()
  })
  it(' a same-report-hash restore still carries the accepted current census', async () => {
    const report = holdSameReport()
    await coldRead('actual')
    expect(useCanvasStore.getState().results.hash).toBe(report.model_card.response_hash)
    expect(logger.debug).toHaveBeenCalledWith('server_graph_hydration.boot_run_currency', expect.objectContaining({ runRead: 'alreadyHeld' }))
    expectNamedBasis()
  })
  it('a same-hash read without a census clears the older named disclosure', async () => {
    const report = holdSameReport()
    useCanvasStore.setState({ results: { ...useCanvasStore.getState().results,
      report: { ...report, current_read_input_basis: capture.projection } } })
    await coldRead('absent')
    expect(logger.debug).toHaveBeenCalledWith('server_graph_hydration.boot_run_currency', expect.objectContaining({ runRead: 'alreadyHeld' }))
    expect(screen.getByTestId(TID)).toHaveTextContent('unavailable')
    expect(screen.getByTestId(TID)).not.toHaveTextContent('Olumi’s estimates')
  })
  it('the graph census cannot replace the original Run permission record', async () => {
    const report = holdSameReport()
    const originalRunAdmission = { structurally_analysable: true,
      permitted_analysis_mode: 'quantified_provisional' as const, semantic_quality_sufficient: true, reasons: [] }
    useCanvasStore.setState({ results: { ...useCanvasStore.getState().results,
      report: { ...report, run_analysis_admission: originalRunAdmission } } })
    await coldRead('actual', true, false)
    expect(useCanvasStore.getState().results.report!.run_analysis_admission).toEqual(originalRunAdmission)
    expect(screen.queryByTestId(TID)).not.toBeInTheDocument()
  })
  it('CONTROL: schema-valid stale read suppresses the held current report', async () => {
    holdSameReport()
    await coldRead('actual', false)
    expect(useCanvasStore.getState().analysisStateV1?.run_state.kind).toBe('complete_stale')
    expect(useCanvasStore.getState().results.report).toBeUndefined()
    expect(useCanvasStore.getState().analysisFreshness?.freshness).not.toBe('fresh')
    expect(screen.queryByTestId(TID)).not.toBeInTheDocument()
  })
  it('CONTROL: mismatched census subject leaves the licensed result but no named basis', async () => {
    await coldRead('mismatch')
    expect(useCanvasStore.getState().analysisFreshness?.freshness).toBe('fresh')
    expect(screen.getByTestId(TID)).toHaveTextContent('unavailable')
    expect(screen.getByTestId(TID)).not.toHaveTextContent('Olumi’s estimates')
  })
})
