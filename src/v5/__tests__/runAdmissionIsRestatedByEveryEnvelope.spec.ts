/**
 * THE RUN'S OWN ADMISSION — WHERE IT IS WRITTEN, WHAT REPLACES IT, WHAT DROPS IT
 * (#1206; binding ruling olumi-programme-docs#63, comment 5787026951).
 *
 * `ReportV1.run_analysis_admission` records the admission the displayed result
 * was delivered under, so a later turn's licence about the EDITED graph cannot
 * promote what that result may claim. The user-visible consequence is pinned end
 * to end by `components/results/analysisNew/__tests__/
 * aRunSpeaksUnderItsOwnAdmission.spec.ts`; this file pins the STORE contract
 * that rests on:
 *
 *   · RE-STATED BY EVERY ENVELOPE CARRYING THE RESULT, duplicate hash included.
 *     CEE re-emits a byte-identical `analysis_result` on follow-up turns, so the
 *     content hash says "same result", never "same admission". An update keyed
 *     on a hash change would let the FIRST envelope's admission govern a result
 *     the producer has since re-stated. (Ruling item 2.)
 *   · ABSENT ON THE ENVELOPE ⇒ REMOVED, never a refusal. (Ruling item 4.)
 *   · PERSISTED WITH ITS REPORT on a duplicate-hash turn too — the autosave's
 *     dirty check is graph-only — and restored with it.
 *   · DROPPED WHENEVER THE REPORT IS REPLACED OR CLEARED by any other writer,
 *     by construction, because it lives on the report. (Ruling item 3.)
 *   · UNTOUCHED BY A RESULT THIS TURN REFUSED as not about the current graph.
 *
 * ⚠ NO DOUBLES: the real `applyV5State` against the real canvas store, built as
 * production builds it (`{ ...getState(), currentResultsHash }`).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import { applyV5State } from '../applyV5State'
import { mapV5AnalysisToReport } from '../mapV5AnalysisToReport'
import { useCanvasStore } from '../../canvas/store'
import { loadAutosave } from '../../canvas/store/scenarios'
import { restoreAnalysisFromAutosave } from '../../canvas/store/restoreAnalysisFromAutosave'
import type { AnalysisAdmissionV1, PermittedAnalysisMode } from '../../adapters/cee/types'

const NODES = [
  { id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Expand' } },
  { id: 'opt_b', type: 'option', position: { x: 200, y: 0 }, data: { kind: 'option', label: 'Hold' } },
  { id: 'goal_1', type: 'goal', position: { x: 100, y: 200 }, data: { kind: 'goal', label: 'Grow ARR' } },
]

const BLOCK = {
  type: 'analysis_result' as const,
  summary: 'Expand leads.',
  leading_option_id: 'opt_a',
  win_probabilities: { opt_a: 0.71, opt_b: 0.29 },
  enrichment: { robustness: { display_verdict: 'fragile' } },
}

const admission = (mode: PermittedAnalysisMode): AnalysisAdmissionV1 => ({
  permitted_analysis_mode: mode,
  reasons: mode === 'comparative_leader' ? [] : [{ field: 'permitted_analysis_mode', message: 'Set one estimate first.' }],
})

function turn(
  mode: PermittedAnalysisMode | 'absent',
  opts: { block?: typeof BLOCK; optionIds?: readonly string[] } = {},
): OlumiResponse {
  const ids = opts.optionIds ?? ['opt_a', 'opt_b']
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [opts.block ?? BLOCK],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
    analysis_ready: {
      status: 'ready',
      goal_node_id: 'goal_1',
      freshness: 'fresh',
      options: ids.map((id) => ({ id, status: 'ready', interventions: {} })),
      ...(mode === 'absent' ? {} : { analysis_admission: admission(mode) }),
    },
  } as unknown as OlumiResponse
}

/** EXACTLY the production construction — `useConversation.ts`. */
function apply(response: OlumiResponse) {
  const snap = useCanvasStore.getState()
  return applyV5State(response, { ...snap, currentResultsHash: snap.results?.hash ?? null } as never)
}

const recorded = () => useCanvasStore.getState().results.report?.run_analysis_admission?.permitted_analysis_mode
const persisted = () => loadAutosave()?.analysis?.report?.run_analysis_admission?.permitted_analysis_mode

beforeEach(() => {
  localStorage.clear()
  useCanvasStore.setState({
    nodes: NODES,
    edges: [],
    results: { status: 'idle', progress: 0 },
    ceeAnalysisReady: null,
    retainedAnalysisAdmission: null,
    analysisStateV1: null,
    runDelta: null,
    currentScenarioId: 'scn-run-admission',
  } as never)
})

describe('the run’s own admission is re-stated by every envelope that carries the result', () => {
  it('a NEW result records the admission from its own envelope', () => {
    const r = apply(turn('quantified_provisional'))
    expect(r.applied, 'precondition: the result must have hydrated').toContain('analysis_result:results_hydrated')
    expect(recorded()).toBe('quantified_provisional')
  })

  it('⭐ DUPLICATE-RESULT CONTROL — the same result re-delivered under a different admission REPLACES the record', () => {
    apply(turn('quantified_provisional'))
    const hash = useCanvasStore.getState().results.hash

    const r = apply(turn('comparative_leader'))
    // Precondition: this really was the duplicate-hash arm. Without it the arm
    // could pass on a build that merely re-hydrated a new report.
    expect(r.applied, 'precondition: the duplicate must have been deduped, not re-hydrated')
      .not.toContain('analysis_result:results_hydrated')
    expect(useCanvasStore.getState().results.hash).toBe(hash)

    expect(recorded(), 'a hash-gated update would leave the first envelope’s admission in force')
      .toBe('comparative_leader')
  })

  it('…in the withholding direction too — the producer may re-state a narrower admission over the same result', () => {
    apply(turn('comparative_leader'))
    const r = apply(turn('quantified_provisional'))
    expect(r.applied).not.toContain('analysis_result:results_hydrated')
    expect(recorded()).toBe('quantified_provisional')
  })

  it('LEGACY — an envelope carrying the result but NO admission removes the record; absence is never a refusal', () => {
    apply(turn('quantified_provisional'))
    expect(recorded()).toBe('quantified_provisional')

    const r = apply(turn('absent'))
    expect(r.applied).not.toContain('analysis_result:results_hydrated')
    const report = useCanvasStore.getState().results.report
    expect(report, 'the result itself must survive').toBeTruthy()
    expect(report && 'run_analysis_admission' in report, 'removed, not written as an empty slot').toBe(false)
  })

  it('a first result from an older producer carries no record at all', () => {
    apply(turn('absent'))
    const report = useCanvasStore.getState().results.report
    expect(report).toBeTruthy()
    expect(report && 'run_analysis_admission' in report).toBe(false)
  })
})

describe('it travels with its report — persisted, restored, and dropped when the report goes', () => {
  it('reaches the PERSISTED record, including on a duplicate-hash turn the graph-only autosave would skip', () => {
    apply(turn('quantified_provisional'))
    expect(persisted()).toBe('quantified_provisional')

    apply(turn('comparative_leader'))
    expect(persisted(), 'a live-only record would be lost on reload').toBe('comparative_leader')
  })

  it('is restored with its report after a reload', () => {
    apply(turn('quantified_provisional'))
    // Everything a reload destroys.
    useCanvasStore.setState({ results: { status: 'idle', progress: 0 } } as never)
    expect(recorded(), 'precondition: the page really was emptied').toBeUndefined()

    expect(
      restoreAnalysisFromAutosave(loadAutosave(), useCanvasStore.getState().resultsLoadHistorical),
    ).toBe(true)
    expect(recorded()).toBe('quantified_provisional')
  })

  it('is DROPPED when another writer replaces the report (the read leg’s write), never inherited by it', () => {
    apply(turn('quantified_provisional'))
    const other = mapV5AnalysisToReport({ ...BLOCK, summary: 'Hold leads, on a rerun.' } as never)
    expect(other.model_card.response_hash, 'precondition: a genuinely different result')
      .not.toBe(useCanvasStore.getState().results.hash)

    useCanvasStore.getState().resultsComplete({
      report: other,
      hash: other.model_card.response_hash,
      resultsSource: 'conversation',
      enrichment: null,
      rawV2Response: null,
    })
    expect(useCanvasStore.getState().results.hash).toBe(other.model_card.response_hash)
    expect(recorded(), 'a report with no recorded admission must read as none').toBeUndefined()
  })

  it('is cleared with the results — `resultsReset` and a decision-context reset', () => {
    apply(turn('quantified_provisional'))
    useCanvasStore.getState().resultsReset()
    expect(recorded()).toBeUndefined()

    apply(turn('quantified_provisional'))
    expect(recorded(), 'precondition').toBe('quantified_provisional')
    useCanvasStore.getState().resetCanvas()
    expect(recorded()).toBeUndefined()
  })

  it('is NOT touched by a result this turn refused as not about the current graph', () => {
    apply(turn('quantified_provisional'))
    const foreign = turn('comparative_leader', {
      block: { ...BLOCK, summary: 'A foreign model’s result.' },
      optionIds: ['opt_foreign_1', 'opt_foreign_2'],
    })
    const r = apply(foreign)
    expect(
      r.deferred.map((d) => d.reason),
      'precondition: the foreign result must have been refused',
    ).toContain('analysis_result_not_about_current_graph')
    expect(recorded()).toBe('quantified_provisional')
  })
})
