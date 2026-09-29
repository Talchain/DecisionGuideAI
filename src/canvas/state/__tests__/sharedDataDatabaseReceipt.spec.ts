import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { applyV5State } from '../../../v5/applyV5State'
import { applyScenarioAnalysisRead } from '../../hydrate/applyScenarioAnalysisRead'
import { selectGoalProbability } from '../../../components/results/utils/selectGoalProbability'
import { mapRunStateKindToDisplayedFreshness } from '../analysisStateSelector'

// Produced by the CEE test using real local Postgres and its production writer.
// No mirrored result fixture: both consumers read the actual persisted Run bytes.
const receiptPath = process.env.SHARED_DATA_RECEIPT_PATH
const suite = receiptPath ? describe : describe.skip
const receipt = receiptPath ? JSON.parse(readFileSync(receiptPath, 'utf8')) : null

function store() {
  return {
    setCurrentStage: vi.fn(), updateNode: vi.fn(), updateEdgeData: vi.fn(),
    setRunMeta: vi.fn(), setCeeAnalysisReady: vi.fn(), setAnalysisFreshness: vi.fn(),
    setAnalysisStateV1: vi.fn(), resultsComplete: vi.fn(), setLimitVerdicts: vi.fn(),
    resultsWithholdLeaderClaim: vi.fn(), noteRunCompletedWithoutVerdict: vi.fn(),
    nodes: [], edges: [], currentResultsHash: null, currentScenarioId: receipt.scenarioId,
    graphAcceptedForCanvas: true,
  }
}

suite('shared-data: actual database Run → live UI / cold UI → stale → rerun', () => {
  it.each(['current', 'reopened'])('%s: both UI delivery paths preserve the AI certainty decisions', (phase) => {
    const { read, agentCertainty } = receipt[phase]
    const live = store()
    applyV5State({ response_version: 2, assistant_text: '', blocks: [read.analysis_result],
      suggested_actions: [], insights: [], stage_indicator: 'analyse', analysis_state: read.analysis_state,
      goal_certainty: read.analysis_goal_certainty } as never, live as never)
    const cold = store()
    applyScenarioAnalysisRead({ analysisState: read.analysis_state, analysisResult: read.analysis_result,
      goalCertainty: read.analysis_goal_certainty, store: cold as never })
    expect(mapRunStateKindToDisplayedFreshness(read.analysis_state.run_state.kind)).toBe('fresh')
    for (const consumer of [live, cold]) {
      expect(consumer.resultsComplete).toHaveBeenCalledTimes(1)
      const report = consumer.resultsComplete.mock.calls[0][0].report
      for (const decision of agentCertainty.options) {
        const displayed = selectGoalProbability(report.option_probabilities[decision.option_id])
        expect(displayed.goalProbability).toBe(decision.earned ? decision.probability_of_goal : null)
        if (!decision.earned) expect(displayed.goalCertaintyUnearned?.say).toBe(decision.say)
      }
    }
  })

  it('the committed edit arrives as stale without rehydrating old figures', () => {
    const { read } = receipt.stale
    const cold = store()
    applyScenarioAnalysisRead({ analysisState: read.analysis_state, analysisResult: read.analysis_result,
      goalCertainty: read.analysis_goal_certainty, store: cold as never })
    expect(cold.resultsComplete).not.toHaveBeenCalled()
    expect(cold.setAnalysisStateV1).toHaveBeenCalledWith(read.analysis_state)
    expect(mapRunStateKindToDisplayedFreshness(read.analysis_state.run_state.kind)).toBe('stale')
    expect(cold.resultsWithholdLeaderClaim).toHaveBeenCalled()
  })

  it.each(['turn', 'read'])('%s: two Runs with identical numbers cannot reuse the first Run\'s permission', (leg) => {
    const read = receipt.current.read
    const held = store()
    held.resultsComplete.mockImplementation(({ hash }) => { held.currentResultsHash = hash })
    const apply = (state: unknown, certainty: unknown) => {
      if (leg === 'turn') applyV5State({ response_version: 2, assistant_text: '', blocks: [read.analysis_result],
        suggested_actions: [], insights: [], stage_indicator: 'analyse', analysis_state: state,
        goal_certainty: certainty } as never, held as never)
      else applyScenarioAnalysisRead({ analysisState: state as never, analysisResult: read.analysis_result,
        goalCertainty: certainty, store: held as never })
    }
    const firstCertainty = read.analysis_goal_certainty.map(({ option_id, probability_of_goal }: any) =>
      ({ option_id, probability_of_goal, earned: true }))
    apply(read.analysis_state, firstCertainty)
    const next = structuredClone(read.analysis_state)
    next.run_state.computed_at = new Date(Date.parse(next.run_state.computed_at) + 1000).toISOString()
    apply(next, read.analysis_goal_certainty)
    expect(held.resultsComplete).toHaveBeenCalledTimes(2)
    const lastReport = held.resultsComplete.mock.calls.at(-1)![0].report
    for (const decision of receipt.current.agentCertainty.options) {
      const displayed = selectGoalProbability(lastReport.option_probabilities[decision.option_id])
      expect(displayed.goalProbability).toBeNull()
      expect(displayed.goalCertaintyUnearned?.say).toBe(decision.say)
    }
  })
})
