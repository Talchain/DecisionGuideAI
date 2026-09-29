import { describe, expect, it, vi } from 'vitest'
import { applyV5State, type V5ApplicatorStore } from '../../../v5/applyV5State'
import { applyScenarioAnalysisRead, type ScenarioAnalysisApplyStore } from '../../hydrate/applyScenarioAnalysisRead'
import { selectGoalProbability } from '../../../components/results/utils/selectGoalProbability'
import type { AnalysisStateV1, OlumiResponse } from '@talchain/schemas/boundary'

// The served Pro-price option used by goalCertaintyConsumer.spec.tsx.
const block = {
  type: 'analysis_result', summary: 's', leading_option_id: 'raise_to_59',
  enrichment: { option_comparison: [
    { id: 'raise_to_59', option_id: 'raise_to_59', label: 'Raise to £59', status: 'computed', probability_of_goal: 1, win_probability: 0.9994 },
    { id: 'keep_49_price', option_id: 'keep_49_price', label: 'Keep £49 price', status: 'computed', probability_of_goal: 0, win_probability: 0.0001 },
    { id: 'raise_to_54', option_id: 'raise_to_54', label: 'Raise to £54', status: 'computed', probability_of_goal: 0.8311, win_probability: 0.0005 },
  ] },
}
const current = {
  run_state: { kind: 'complete_current', computed_at: '2026-09-29T09:00:00.000Z' },
  readiness: { status: 'ready', blockers: [] }, leader_claim: { permitted: true }, robustness: {},
  usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
  requires_rerun: false, blocked_unusable: false, contradictions: [],
} as unknown as AnalysisStateV1

function bothLegs(goalCertainty: unknown) {
  const turnDone = vi.fn()
  applyV5State({ response_version: 2, assistant_text: '', blocks: [block], suggested_actions: [], insights: [], stage_indicator: 'frame',
    goal_certainty: goalCertainty } as unknown as OlumiResponse, {
    setCurrentStage: vi.fn(), updateNode: vi.fn(), updateEdgeData: vi.fn(), setRunMeta: vi.fn(), setCeeAnalysisReady: vi.fn(),
    setAnalysisFreshness: vi.fn(), resultsComplete: turnDone, nodes: [], edges: [], currentResultsHash: null,
  } as unknown as V5ApplicatorStore)
  const readDone = vi.fn()
  applyScenarioAnalysisRead({ analysisState: current, analysisResult: block as never, goalCertainty,
    store: { setAnalysisStateV1: vi.fn(), resultsComplete: readDone, setLimitVerdicts: vi.fn(), currentResultsHash: null, currentScenarioId: 'scn-1' } as unknown as ScenarioAnalysisApplyStore })
  expect(turnDone).toHaveBeenCalledTimes(1)
  expect(readDone).toHaveBeenCalledTimes(1)
  return [turnDone, readDone].map(done => done.mock.calls[0][0].report.option_probabilities)
}

describe('shared-data binding: the UI needs the same valid certainty record as the Agent', () => {
  it.each([undefined, null, [], {}, [{ option_id: 'another-option', probability_of_goal: 1, earned: true }]])(
    'missing certainty cannot become a displayed 0/100: %j', (record) => {
      for (const options of bothLegs(record)) {
        expect(selectGoalProbability(options.raise_to_59).goalProbability).toBeNull()
        expect(selectGoalProbability(options.keep_49_price).goalProbability).toBeNull()
        expect(selectGoalProbability(options.raise_to_54).goalProbability).toBe(0.8311)
      }
    },
  )
  it('an earned zero for this option cannot attest a one', () => {
    for (const options of bothLegs([{ option_id: 'raise_to_59', probability_of_goal: 0, earned: true }])) {
      expect(selectGoalProbability(options.raise_to_59).goalProbability).toBeNull()
    }
  })
  it('a contract-invalid earned record cannot attest a certainty', () => {
    for (const options of bothLegs([{ option_id: 'raise_to_59', probability_of_goal: 1, earned: true, say: 'Invented assurance' }])) {
      expect(selectGoalProbability(options.raise_to_59).goalProbability).toBeNull()
    }
  })
  it('valid zero remains zero and valid one remains one on both legs', () => {
    for (const options of bothLegs([
      { option_id: 'raise_to_59', probability_of_goal: 1, earned: true },
      { option_id: 'keep_49_price', probability_of_goal: 0, earned: true },
    ])) {
      expect(selectGoalProbability(options.raise_to_59).goalProbability).toBe(1)
      expect(selectGoalProbability(options.keep_49_price).goalProbability).toBe(0)
      expect(selectGoalProbability(options.raise_to_54).goalProbability).toBe(0.8311)
    }
  })
})
