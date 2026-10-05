/**
 * C10a — the reason for an absent comparison belongs to the displayed analysis, not the latest readiness turn.
 * Integrator #87 5993813414: CEE carried `unrequested_run_in_pair` on Run, then conversational turns at
 * 11:28:21Z and 11:28:37Z replaced analysis_ready without that reason and Compare showed its generic line.
 *
 * R1  a Run carrying analysis_result + the reason, without run_delta, shows runDeltaSentence's exact words.
 * R2  RED against base: a later conversation carries readiness without the reason and no analysis_result;
 *     base replaces ceeAnalysisReady, so its unbound selector loses the Run's explanation.
 * R3  a later Run with another content hash and a delta renders the pair and clears the old reason.
 * R4  a reason bound to another scenario or another displayed hash never appears (base also lacks these guards).
 *
 * Real applyV5State payloads and a fresh store snapshot per turn, matching the production caller.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { OlumiResponse, RunDelta } from '@talchain/schemas/boundary'
import type { CEEAnalysisReady } from '../../adapters/cee/types'
import { applyV5State, type V5ApplicatorStore } from '../applyV5State'
import type { StoredRunDelta, StoredRunDeltaAbsence } from '../../canvas/state/storedRunDelta'
import { useCanvasStore } from '../../canvas/store'
import { CompareRunPairBody, COMPARE_RUN_PAIR_TESTID } from '../../canvas/compare-tab/CompareRunPairBody'
import { COMMITMENT_COPY, runDeltaSentence } from '../../components/results/analysisNew/commitmentSynthesis'
import served from './fixtures-served-9a880829-run-delta.json'

vi.mock('../../canvas/utils/focusHelpers', () => ({ focusNodeById: vi.fn(), focusEdgeById: vi.fn() }))

const SCENARIO = 'scn-c10a'
const REASON = 'unrequested_run_in_pair'
const GENERIC = 'The two most recent runs of this model are compared here.'
const DEDICATED = "This run is not compared with Olumi's automatic first pass; the next re-run will show what moved."
const DELTA = served.run_delta as unknown as RunDelta
const OPTION_IDS = ['integration_bug_fix_sprint', 'ai_reporting_module_sprint', 'continue_current_plan']
const NODES = ['goal-c10a', ...OPTION_IDS].map(id => ({ id, position: { x: 0, y: 0 }, data: { label: id } }))

const analysis = (summary: string) => ({
  type: 'analysis_result' as const,
  summary,
  leading_option_id: 'integration_bug_fix_sprint',
  win_probabilities: { integration_bug_fix_sprint: 0.4678, ai_reporting_module_sprint: 0.4218, continue_current_plan: 0.1103 },
  enrichment: {},
})

const readiness = (reason?: string) => ({
  status: 'ready',
  goal_node_id: 'goal-c10a',
  options: OPTION_IDS.map(id => ({ id, status: 'ready', interventions: {} })),
  freshness: 'fresh',
  ...(reason === undefined ? {} : { run_delta_absence_reason: reason }),
})

const turn = (over: Record<string, unknown>): OlumiResponse => ({
  response_version: 2,
  assistant_text: '',
  blocks: [],
  suggested_actions: [],
  insights: [],
  stage_indicator: 'analyse',
  ...over,
}) as unknown as OlumiResponse

function statefulStore() {
  const state: {
    hash: string | null
    runDelta: StoredRunDelta | null
    runDeltaAbsence: StoredRunDeltaAbsence | null
    ceeAnalysisReady: CEEAnalysisReady | null
  } = { hash: null, runDelta: null, runDeltaAbsence: null, ceeAnalysisReady: null }
  const apply = (response: OlumiResponse) => {
    const store = {
      setCurrentStage: vi.fn(),
      updateNode: vi.fn(),
      updateEdgeData: vi.fn(),
      setRunMeta: vi.fn(),
      setCeeAnalysisReady: vi.fn((value: CEEAnalysisReady | null) => { state.ceeAnalysisReady = value }),
      resultsComplete: vi.fn((value: { hash: string }) => { state.hash = value.hash }),
      setRunDelta: vi.fn((value: StoredRunDelta | null) => { state.runDelta = value }),
      setRunDeltaAbsence: vi.fn((value: StoredRunDeltaAbsence | null) => { state.runDeltaAbsence = value }),
      nodes: NODES,
      edges: [],
      currentResultsHash: state.hash,
      currentScenarioId: SCENARIO,
      runDelta: state.runDelta,
      runDeltaAbsence: state.runDeltaAbsence,
    } as unknown as V5ApplicatorStore
    applyV5State(response, store)
  }
  return { state, apply }
}

function show(
  state: ReturnType<typeof statefulStore>['state'],
  responseHash = state.hash,
  scenarioId = SCENARIO,
) {
  useCanvasStore.setState({
    runDelta: state.runDelta,
    runDeltaAbsence: state.runDeltaAbsence,
    ceeAnalysisReady: state.ceeAnalysisReady,
    currentScenarioId: scenarioId,
    results: { status: 'complete', hash: state.hash, report: {} },
    nodes: NODES,
    edges: [],
  } as never)
  render(<CompareRunPairBody responseHash={responseHash} />)
}

function expectDedicatedSentence() {
  // Pin the words as well as the shared producer so a generic fallback cannot satisfy this row.
  expect(runDeltaSentence(null, { isStale: false, absenceReason: REASON })).toBe(DEDICATED)
  expect(COMMITMENT_COPY.sinceLastRun.notComparedWithFirstPass).toBe(DEDICATED)
  expect(screen.getByText(DEDICATED, { exact: true }).textContent).toBe(DEDICATED)
  const empty = screen.getByTestId(`${COMPARE_RUN_PAIR_TESTID}-empty`)
  expect(empty).toHaveAttribute('data-absence-reason', REASON)
  expect(empty).not.toHaveTextContent(GENERIC)
  expect(screen.queryByTestId(COMPARE_RUN_PAIR_TESTID)).toBeNull()
}

let priorCanvasState: ReturnType<typeof useCanvasStore.getState>
beforeEach(() => {
  priorCanvasState = useCanvasStore.getState()
  useCanvasStore.setState({
    runDelta: null,
    runDeltaAbsence: null,
    ceeAnalysisReady: null,
    currentScenarioId: SCENARIO,
    results: { status: 'idle' },
    analysisStateV1: null,
    nodes: NODES,
    edges: [],
  } as never)
})
afterEach(() => {
  cleanup()
  useCanvasStore.setState(priorCanvasState, true)
})

describe('C10a · absent-comparison reason remains bound to its Run', () => {
  it('R1: the Run without a delta shows the dedicated runDeltaSentence wording', () => {
    const s = statefulStore()
    s.apply(turn({ blocks: [analysis('The requested Run completed')], analysis_ready: readiness(REASON) }))
    expect(s.state.hash).not.toBeNull()
    expect(s.state.runDelta).toBeNull()
    show(s.state)
    expectDedicatedSentence()
  })

  it('R2: a later conversational readiness turn without the reason preserves the displayed Run explanation', () => {
    const s = statefulStore()
    s.apply(turn({ blocks: [analysis('The requested Run completed')], analysis_ready: readiness(REASON) }))
    const runHash = s.state.hash
    s.apply(turn({ assistant_text: 'Here is why that assumption matters.', analysis_ready: readiness() }))
    expect(s.state.hash).toBe(runHash)
    expect(s.state.ceeAnalysisReady).not.toHaveProperty('run_delta_absence_reason')
    show(s.state)
    expectDedicatedSentence()
  })

  it('R3: a later Run with a different hash and a delta shows the pair without a stale reason', () => {
    const s = statefulStore()
    s.apply(turn({ blocks: [analysis('The requested Run completed')], analysis_ready: readiness(REASON) }))
    const priorHash = s.state.hash
    s.apply(turn({ blocks: [analysis('The next Run completed after the link changed')], analysis_ready: readiness(), run_delta: DELTA }))
    expect(s.state.hash).not.toBe(priorHash)
    expect(s.state.runDelta?.analysisHash).toBe(s.state.hash)
    expect(s.state.runDeltaAbsence).toBeNull()
    show(s.state)
    expect(screen.getByTestId(COMPARE_RUN_PAIR_TESTID)).toHaveTextContent('slight → strong')
    expect(screen.queryByTestId(`${COMPARE_RUN_PAIR_TESTID}-empty`)).toBeNull()
    expect(screen.queryByText(DEDICATED, { exact: true })).toBeNull()
  })

  it.each(['another scenario', 'another hash'] as const)('R4: the reason never shows for %s', mismatch => {
    const s = statefulStore()
    s.apply(turn({ blocks: [analysis('The requested Run completed')], analysis_ready: readiness(REASON) }))
    // Keep the original reason in both slices: only the bound selector's identity guard may exclude it.
    show(s.state, mismatch === 'another hash' ? 'another-analysis-hash' : s.state.hash,
      mismatch === 'another scenario' ? 'scn-other' : SCENARIO)
    const empty = screen.getByTestId(`${COMPARE_RUN_PAIR_TESTID}-empty`)
    expect(screen.getByText(GENERIC, { exact: true }).textContent).toBe(GENERIC)
    expect(empty).not.toHaveAttribute('data-absence-reason')
    expect(screen.queryByText(DEDICATED, { exact: true })).toBeNull()
  })
})
