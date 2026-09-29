import { describe, expect, it, vi } from 'vitest'
import { applyV5State } from '../applyV5State'
import { applyScenarioAnalysisRead } from '../../canvas/hydrate/applyScenarioAnalysisRead'
import { selectGoalProbability } from '../../components/results/utils/selectGoalProbability'
import { useCanvasStore } from '../../canvas/store'

const block = { type: 'analysis_result', summary: 'A', leading_option_id: 'a', computed_against_hash: 'same-model',
  enrichment: { option_comparison: [{ option_id: 'a', option_label: 'A', status: 'computed',
    win_probability: 0.8, probability_of_goal: 0 }] } }
const verdict = { run_state: { kind: 'complete_current', computed_at: '2026-09-29T11:00:00.000Z' },
  readiness: { status: 'ready', blockers: [] }, leader_claim: { permitted: true }, robustness: {},
  usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
  requires_rerun: false, blocked_unusable: false, contradictions: [] }
const certainty = [{ option_id: 'a', probability_of_goal: 0, earned: true }]

describe('Run delivery identity stays distinct from block-content identity', () => {
  it.each(['turn', 'read', 'alternating turn/read'])('%s: new Run and new permission land, redelivery dedupes, permission alone does not clear dirty state', (leg) => {
    const store = {
      setCurrentStage: vi.fn(), updateNode: vi.fn(), updateEdgeData: vi.fn(), setRunMeta: vi.fn(),
      setCeeAnalysisReady: vi.fn(), setAnalysisFreshness: vi.fn(), setAnalysisStateV1: vi.fn(),
      noteRunCompletedWithoutVerdict: vi.fn(), resultsComplete: vi.fn(), nodes: [], edges: [],
      currentScenarioId: 'scenario-a', currentResultsHash: null as string | null, currentResultsReport: null as any,
    }
    store.resultsComplete.mockImplementation(({ report, hash }) => {
      store.currentResultsReport = report; store.currentResultsHash = hash
    })
    let delivery = 0
    const apply = (state: unknown, decision: unknown) => {
      if (leg === 'turn' || (leg === 'alternating turn/read' && delivery++ % 2 === 0)) applyV5State({ response_version: 2, assistant_text: '', blocks: [block],
        suggested_actions: [], insights: [], stage_indicator: 'analyse', analysis_state: state,
        goal_certainty: decision } as never, store as never)
      else applyScenarioAnalysisRead({ analysisState: state as never, analysisResult: block,
        goalCertainty: decision, store: store as never })
    }
    apply(verdict, certainty)
    const contentHash = store.currentResultsHash
    expect(selectGoalProbability(store.currentResultsReport.option_probabilities.a).goalProbability).toBe(0)
    apply(verdict, certainty)
    expect(store.resultsComplete).toHaveBeenCalledTimes(1)

    const secondRun = { ...verdict, run_state: { ...verdict.run_state, computed_at: '2026-09-29T11:01:00.000Z' } }
    apply(secondRun, certainty)
    expect(store.resultsComplete).toHaveBeenCalledTimes(2)
    expect(store.noteRunCompletedWithoutVerdict).toHaveBeenCalledTimes(2)
    expect(store.currentResultsHash).toBe(contentHash)

    // Defensive same-Run permission correction: the old earned zero cannot survive.
    apply(secondRun, undefined)
    expect(store.resultsComplete).toHaveBeenCalledTimes(3)
    expect(selectGoalProbability(store.currentResultsReport.option_probabilities.a).goalProbability).toBeNull()
    expect(store.noteRunCompletedWithoutVerdict).toHaveBeenCalledTimes(2)
    expect(store.currentResultsHash).toBe(contentHash)
    apply(secondRun, undefined)
    expect(store.resultsComplete).toHaveBeenCalledTimes(3)
  })

  it('the real store refreshes permission without resetting dirty state or manufacturing a comparison snapshot', () => {
    const previous = useCanvasStore.getState()
    try {
      const held = { model_card: { response_hash: 'same-content' } }
      const next = { ...held, v5_run_receipt: { identity: null, goal_certainty: null } }
      const priorSnapshot = { options: {} }
      useCanvasStore.setState({
        results: { ...previous.results, status: 'complete', hash: 'same-content', report: held, finishedAt: 123 },
        graphEditedSinceLastRun: true, analysisFreshnessDirty: true, previousReport: priorSnapshot,
        currentScenarioLastRunAt: '2026-09-29T11:00:00.000Z',
      } as never)
      useCanvasStore.getState().resultsComplete({ report: next as never, hash: 'same-content', reportRefreshOnly: true })
      const after = useCanvasStore.getState()
      expect(after.results.report).toBe(next)
      expect(after.results.finishedAt).toBe(123)
      expect(after.graphEditedSinceLastRun).toBe(true)
      expect(after.analysisFreshnessDirty).toBe(true)
      expect(after.previousReport).toBe(priorSnapshot)
      expect(after.currentScenarioLastRunAt).toBe('2026-09-29T11:00:00.000Z')
    } finally { useCanvasStore.setState(previous) }
  })
})
