/**
 * ⭐ THE STRIP SURVIVES THE SAME RUN RE-DELIVERED (R3 5943098072, served UI `6630bbcf` / CEE `d83b84a7`, 2 Oct).
 *
 * Measured: after the M3 amend → Apply → Re-analyse, CEE EMITTED `run_delta` on the run turn (Render
 * `run_delta_outcome` 00:07:36Z, outcome=emitted); the next turns were `caller_binds_run_delta` — the Agent route
 * re-delivers the SAME run's analysis (leader claim reshaped, so a new CONTENT hash) and carries no delta on any doubt
 * (`analysis-coaching-pass-through.ts` `runDeltaBoundToReadback`). The applicator evicted on the new hash, so the strip
 * was empty in session while a cold read showed "slight → strong".
 *
 * Driven through the REAL `applyV5State` over a stateful store (the production caller re-snapshots the canvas store
 * each envelope), with the SERVED run_delta verbatim (`fixtures-served-9a880829-run-delta.json`). Then the REAL strip
 * and the REAL Compare tab render from the resulting state.
 *
 *   SR1  run turn → follow-up turn (same run, new hash, no delta) → explain echo: the delta is kept, REBOUND to the
 *        displayed hash; the strip and Compare show the pair, and their rows equal the cold read's
 *   SR2  CONTRAST: a genuinely NEW run (different run_state.computed_at), no delta → evicted
 *   SR3  fail-closed: a new hash with NO run identity → evicted (the old behaviour)
 *   SR4  another scenario's held delta is never rebound
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { OlumiResponse, RunDelta } from '@talchain/schemas/boundary'
import { applyV5State, type V5ApplicatorStore } from '../applyV5State'
import type { StoredRunDelta } from '../../canvas/state/storedRunDelta'
import { useCanvasStore } from '../../canvas/store'
import { RunChangesSummary, RUN_CHANGES_SUMMARY_TESTID } from '../../canvas/components/RunChangesSummary'
import { CompareRunPairBody, COMPARE_RUN_PAIR_TESTID } from '../../canvas/compare-tab/CompareRunPairBody'
import { buildRunDeltaView } from '../../components/results/analysisNew/runDeltaView'
import { displayedRunDeltaView } from '../../components/results/analysisNew/displayedRunDeltaView'
import served from './fixtures-served-9a880829-run-delta.json'

vi.mock('../../canvas/utils/focusHelpers', () => ({ focusNodeById: vi.fn(), focusEdgeById: vi.fn() }))

const SERVED = served.run_delta as unknown as RunDelta
const RUN_AT = (SERVED as unknown as { endpoints: { current: { computed_at: string } } }).endpoints.current.computed_at
const SCN = 'scn-9a880829'

const block = (summary: string, leading: string | null) => ({
  type: 'analysis_result' as const, summary, leading_option_id: leading,
  win_probabilities: { integration_bug_fix_sprint: 0.4678, ai_reporting_module_sprint: 0.4218, continue_current_plan: 0.1103 },
  enrichment: {},
})
const runState = (computedAt: string | null) => (computedAt === null ? {} : { analysis_state: { run_state: { kind: 'complete_current', computed_at: computedAt } } })
const turn = (over: Record<string, unknown>): OlumiResponse =>
  ({ response_version: 2, assistant_text: '', blocks: [], suggested_actions: [], insights: [], stage_indicator: 'analyse', ...over }) as unknown as OlumiResponse

/** The production shape: each envelope sees a fresh snapshot of the store the previous one wrote. */
function statefulStore(scenarioId = SCN) {
  const state: { runDelta: StoredRunDelta | null; hash: string | null } = { runDelta: null, hash: null }
  const apply = (response: OlumiResponse) => {
    const store = {
      setCurrentStage: vi.fn(), updateNode: vi.fn(), updateEdgeData: vi.fn(), setRunMeta: vi.fn(), setCeeAnalysisReady: vi.fn(),
      resultsComplete: vi.fn((p: { hash: string }) => { state.hash = p.hash }),
      setRunDelta: vi.fn((s: StoredRunDelta | null) => { state.runDelta = s }),
      nodes: [], edges: [], currentResultsHash: state.hash, currentScenarioId: scenarioId, runDelta: state.runDelta,
    } as unknown as V5ApplicatorStore
    applyV5State(response, store)
  }
  return { state, apply }
}

afterEach(() => { cleanup() })

describe('SR1 · the same run re-delivered under a new hash keeps its comparison', () => {
  it('run → caller-bound follow-up (no delta) → explain echo: strip + Compare show the pair, equal to the cold read', () => {
    const s = statefulStore()
    s.apply(turn({ blocks: [block('Integration Bug Fix Sprint now leads', 'integration_bug_fix_sprint')], run_delta: SERVED, ...runState(RUN_AT) }))
    const runHash = s.state.hash
    expect(s.state.runDelta?.analysisHash).toBe(runHash)

    // The Agent route's readback: the SAME run, leader claim reshaped → a new content hash, and no delta on doubt.
    s.apply(turn({ blocks: [block('No single option can be put forward yet', null)], ...runState(RUN_AT) }))
    expect(s.state.hash).not.toBe(runHash)
    expect(s.state.runDelta).not.toBeNull()
    expect(s.state.runDelta?.delta).toBe(SERVED)
    expect(s.state.runDelta?.analysisHash).toBe(s.state.hash)
    // The explain turn echoes that block: nothing moves.
    s.apply(turn({ blocks: [block('No single option can be put forward yet', null)], ...runState(RUN_AT) }))
    expect(s.state.runDelta?.analysisHash).toBe(s.state.hash)

    // Render from the resulting state, through the real strip and the real Compare tab.
    useCanvasStore.setState({
      runDelta: s.state.runDelta, results: { status: 'complete', hash: s.state.hash, report: {} }, currentScenarioId: SCN,
      nodes: [], edges: [], ceeAnalysisReady: null,
    } as never)
    render(<><RunChangesSummary /><CompareRunPairBody responseHash={s.state.hash} /></>)
    expect(screen.getByTestId(RUN_CHANGES_SUMMARY_TESTID)).toHaveTextContent(/slight → strong/)
    expect(screen.getByTestId(COMPARE_RUN_PAIR_TESTID)).toHaveTextContent(/slight → strong/)

    // Equal to the cold read: the in-session view's rows are the rows of the served delta itself.
    const label = () => null
    const inSession = displayedRunDeltaView(s.state.runDelta, s.state.hash, SCN, new Map())
    const cold = buildRunDeltaView(SERVED, label, label)
    expect(inSession?.inputs?.rows.map((r) => [r.key, r.before, r.after])).toEqual(cold.inputs?.rows.map((r) => [r.key, r.before, r.after]))
    expect(inSession?.comparability).toBe(cold.comparability)
  })
})

describe('SR2–SR4 · everything else still evicts', () => {
  it('SR2 CONTRAST: a genuinely new run without a delta evicts', () => {
    const s = statefulStore()
    s.apply(turn({ blocks: [block('A', 'integration_bug_fix_sprint')], run_delta: SERVED, ...runState(RUN_AT) }))
    s.apply(turn({ blocks: [block('B', null)], ...runState('2026-10-02T00:09:00.000Z') }))
    expect(s.state.runDelta).toBeNull()
  })
  it('SR3 fail-closed: a new hash with no run identity evicts', () => {
    const s = statefulStore()
    s.apply(turn({ blocks: [block('A', 'integration_bug_fix_sprint')], run_delta: SERVED, ...runState(RUN_AT) }))
    s.apply(turn({ blocks: [block('B', null)] }))
    expect(s.state.runDelta).toBeNull()
  })
  it('SR4 another scenario\'s held delta is never rebound', () => {
    const s = statefulStore()
    s.apply(turn({ blocks: [block('A', 'integration_bug_fix_sprint')], run_delta: SERVED, ...runState(RUN_AT) }))
    const held = s.state.runDelta!
    const other = statefulStore('scn-other')
    other.state.runDelta = held
    other.state.hash = held.analysisHash
    other.apply(turn({ blocks: [block('B', null)], ...runState(RUN_AT) }))
    expect(other.state.runDelta).toBeNull()
  })
})
