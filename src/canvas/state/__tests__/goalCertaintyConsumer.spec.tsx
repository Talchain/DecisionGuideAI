/**
 * The UI consumer of CEE's stored goal-certainty fact (schemas 0.63.0; producer CEE #2270, stored writer + turn key +
 * cold read CEE #2280; DL #72 5887061638 / 5887109382). An UNEARNED 0% / 100% goal figure is never shown as a
 * percentage: the mapper stamps the option, the one chooser withholds it, and the producer's sentence is shown.
 *
 * The DL's parity row: the SAME Run through the fresh-Run TURN leg (`applyV5State`, top-level `goal_certainty`) and the
 * cold-reload READ leg (`applyScenarioAnalysisRead`, `analysis_goal_certainty`) yields the same stamped option.
 * Option rows are the served f5d503b0 Pro-price block (trimmed), with £59 at exactly 1.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { AnalysisStateV1, OlumiResponse } from '@talchain/schemas/boundary'
import { applyV5State, type V5ApplicatorStore } from '../../../v5/applyV5State'
import { applyScenarioAnalysisRead, type ScenarioAnalysisApplyStore } from '../../hydrate/applyScenarioAnalysisRead'
import { selectGoalProbability } from '../../../components/results/utils/selectGoalProbability'
import { GOAL_CERTAINTY_UNEARNED_FALLBACK, goalCertaintyFromResponse, readGoalCertainty } from '../storedGoalCertainty'
import { GoalPanel } from '../../ui/inspector-v2/panels/GoalPanel'
import { useCanvasStore } from '../../store'
import { useAuth } from '../../../contexts/AuthContext'

vi.mock('../../../contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../contexts/AuthContext')>()
  return { ...actual, useAuth: vi.fn() }
})

/** The producer's sentence shape (CEE #2270), used verbatim. */
const SAY = "I can't yet say how likely 'Raise to £59' is to reach the target: it depends on how 'Pro plan price' moves 'MRR', which isn't sized yet."
const UNEARNED_59 = { option_id: 'raise_to_59', probability_of_goal: 1, earned: false, unsized_path: { from: 'pro_plan_price', enters_goal_through: 'pro_plan_price' }, no_break_even: 'not_an_identity', say: SAY }
const EARNED_49 = { option_id: 'keep_49_price', probability_of_goal: 0, earned: true }

const BLOCK = {
  type: 'analysis_result' as const,
  summary: 's',
  leading_option_id: 'raise_to_59',
  win_probabilities: { 'Keep £49 price': 0.0001, 'Raise to £59': 0.9994, 'Raise to £54': 0.0005 },
  enrichment: {
    option_comparison: [
      { id: 'keep_49_price', option_id: 'keep_49_price', label: 'Keep £49 price', option_label: 'Keep £49 price', status: 'computed', probability_of_goal: 0, win_probability: 0.0001 },
      { id: 'raise_to_59', option_id: 'raise_to_59', label: 'Raise to £59', option_label: 'Raise to £59', status: 'computed', probability_of_goal: 1, win_probability: 0.9994 },
      { id: 'raise_to_54', option_id: 'raise_to_54', label: 'Raise to £54', option_label: 'Raise to £54', status: 'computed', probability_of_goal: 0.8311, win_probability: 0.0005 },
    ],
    robustness: { level: 'high', is_robust: true, confidence: 0.9994, recommended_option_id: 'raise_to_59' },
  },
}

type Entry = Record<string, unknown>
const optionsOf = (report: { option_probabilities: Record<string, Entry> }) => report.option_probabilities

function turnReport(extra: Record<string, unknown>) {
  const resultsComplete = vi.fn()
  const store = {
    setCurrentStage: vi.fn(), updateNode: vi.fn(), updateEdgeData: vi.fn(), setRunMeta: vi.fn(), setCeeAnalysisReady: vi.fn(),
    setAnalysisFreshness: vi.fn(), resultsComplete, nodes: [], edges: [], currentResultsHash: null,
  } as unknown as V5ApplicatorStore
  const response = { response_version: 2, assistant_text: '', blocks: [BLOCK], suggested_actions: [], insights: [], stage_indicator: 'frame', ...extra } as unknown as OlumiResponse
  applyV5State(response, store)
  expect(resultsComplete, 'the turn leg must hydrate the report').toHaveBeenCalledTimes(1)
  return resultsComplete.mock.calls[0][0].report
}

const CURRENT = {
  run_state: { kind: 'complete_current', computed_at: '2026-09-29T09:00:00.000Z' },
  readiness: { status: 'ready', blockers: [] },
  leader_claim: { permitted: true },
  robustness: {}, usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
  requires_rerun: false, blocked_unusable: false, contradictions: [],
} as unknown as AnalysisStateV1

function readReport(goalCertainty: unknown) {
  const resultsComplete = vi.fn()
  const store = { setAnalysisStateV1: vi.fn(), resultsComplete, setLimitVerdicts: vi.fn(), currentResultsHash: null, currentScenarioId: 'scn-1' } as unknown as ScenarioAnalysisApplyStore
  applyScenarioAnalysisRead({ analysisState: CURRENT, analysisResult: BLOCK, goalCertainty, store })
  expect(resultsComplete, 'the read leg must hydrate the report').toHaveBeenCalledTimes(1)
  return resultsComplete.mock.calls[0][0].report
}

describe('readGoalCertainty — one reader, both legs', () => {
  it('absent → null (not recorded); [] → recorded, none', () => {
    expect(readGoalCertainty(undefined)).toBeNull()
    expect(readGoalCertainty({})).toBeNull()
    expect(readGoalCertainty([])).toEqual([])
  })
  it('reads earned and unearned; an unreadable certainty is UNEARNED with no sentence (fail-closed)', () => {
    expect(readGoalCertainty([UNEARNED_59, EARNED_49])).toEqual([
      { optionId: 'raise_to_59', endpoint: 1, earned: false, say: SAY },
      { optionId: 'keep_49_price', endpoint: 0, earned: true, say: null },
    ])
  })
  it('CONTRACT REFUSED → absent (the whole record): the published schema, mirrored — never a field-by-field repair', () => {
    expect(readGoalCertainty([{ option_id: 'x', probability_of_goal: 1, earned: 'yes' }])).toBeNull()
    expect(readGoalCertainty([{ option_id: 'x', probability_of_goal: 1 }])).toBeNull()
    expect(readGoalCertainty([{ option_id: 'x', probability_of_goal: 0.5, earned: true }])).toBeNull()
    // builder 5889098845: CEE refuses an earned certainty that carries a sentence, so the UI does too
    expect(readGoalCertainty([{ option_id: 'x', probability_of_goal: 1, earned: true, say: 'It will reach the target.' }])).toBeNull()
    // one bad entry refuses the record, not just itself
    expect(readGoalCertainty([EARNED_49, { ...UNEARNED_59, say: undefined }])).toBeNull()
  })
  it('the turn key is read top level first, then the additive sidecar', () => {
    expect(goalCertaintyFromResponse({ goal_certainty: [EARNED_49] })).toEqual([EARNED_49])
    expect(goalCertaintyFromResponse({ __additive__: { goal_certainty: [UNEARNED_59] } })).toEqual([UNEARNED_59])
  })
})

describe('fresh Run (turn) and cold reload (read): the same Run yields the same stamped option (DL parity row)', () => {
  it('both legs stamp £59 as unearned with the producer’s sentence, and leave the others alone', () => {
    const turn = optionsOf(turnReport({ goal_certainty: [UNEARNED_59, EARNED_49] }))
    const read = optionsOf(readReport([UNEARNED_59, EARNED_49]))
    for (const r of [turn, read]) {
      expect(r.raise_to_59.goalCertaintyUnearned).toEqual({ say: SAY })
      expect(r.keep_49_price.goalCertaintyUnearned).toBeUndefined()
      expect(r.raise_to_54.goalCertaintyUnearned).toBeUndefined()
    }
    expect(turn.raise_to_59).toEqual(read.raise_to_59)
  })
  it('ABSENT is never earned (schemas 0.63.0): on both legs every displayed 0/1 is withheld behind the fallback; the interior figure is not', () => {
    for (const r of [optionsOf(turnReport({})), optionsOf(readReport(undefined))]) {
      expect(r.raise_to_59.goalCertaintyUnearned).toEqual({ say: null })
      expect(r.keep_49_price.goalCertaintyUnearned).toEqual({ say: null })
      expect(r.raise_to_54.goalCertaintyUnearned).toBeUndefined()
    }
  })
  it('RECORDED [] attests no 0/1: the 0/1 figures are withheld, the interior figure shows (absent vs [] differ only by the record)', () => {
    const r = optionsOf(turnReport({ goal_certainty: [] }))
    expect(r.raise_to_59.goalCertaintyUnearned).toEqual({ say: null })
    expect(r.raise_to_54.goalCertaintyUnearned).toBeUndefined()
    expect(selectGoalProbability(r.raise_to_54 as never).goalProbability).toBe(0.8311)
  })
  it('a CONFLICTING record (two valid decisions for one option and endpoint) is never earned — either order, both legs', () => {
    const unearnedAlt = { option_id: 'raise_to_59', probability_of_goal: 1, earned: false, unsized_path: { from: 'pro_plan_price', enters_goal_through: 'pro_plan_price' }, no_break_even: 'no_exact_figure', say: SAY }
    const earned59 = { option_id: 'raise_to_59', probability_of_goal: 1, earned: true }
    for (const record of [[earned59, unearnedAlt], [unearnedAlt, earned59]]) {
      expect(optionsOf(turnReport({ goal_certainty: record })).raise_to_59.goalCertaintyUnearned).toEqual({ say: null })
      expect(optionsOf(readReport(record)).raise_to_59.goalCertaintyUnearned).toEqual({ say: null })
    }
    // control: one earned decision alone shows the figure
    expect(optionsOf(turnReport({ goal_certainty: [earned59] })).raise_to_59.goalCertaintyUnearned).toBeUndefined()
  })
  it('a decision binds by (option, endpoint): an earned decision for the OPPOSITE endpoint attests nothing', () => {
    const opposite = { option_id: 'raise_to_59', probability_of_goal: 0, earned: true }
    expect(optionsOf(turnReport({ goal_certainty: [opposite, EARNED_49] })).raise_to_59.goalCertaintyUnearned).toEqual({ say: null })
    expect(optionsOf(turnReport({ goal_certainty: [{ ...opposite, probability_of_goal: 1 }, EARNED_49] })).raise_to_59.goalCertaintyUnearned).toBeUndefined()
  })
  it('the chooser withholds ONLY the unearned figure', () => {
    const r = optionsOf(turnReport({ goal_certainty: [UNEARNED_59, EARNED_49] }))
    const d59 = selectGoalProbability(r.raise_to_59 as never)
    expect(d59.goalProbability).toBeNull()
    expect(d59.goalCertaintyUnearned).toEqual({ say: SAY })
    expect(selectGoalProbability(r.keep_49_price as never).goalProbability).toBe(0)
    expect(selectGoalProbability(r.raise_to_54 as never).goalProbability).toBe(0.8311)
  })
})

describe('GoalPanel — the unearned 100% is said as the producer’s sentence, never as a percentage', () => {
  const GOAL_NODE = { id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'MRR', goal_threshold_raw: 0.8 } }
  const renderWith = (report: unknown) => {
    useCanvasStore.setState({ ...useCanvasStore.getState(), nodes: [GOAL_NODE], edges: [], goalThreshold: 0.8, goalConstraints: null, results: { status: 'complete', report } } as never)
    return render(<GoalPanel nodeId="goal1" techMode={false} onClose={() => {}} onNavigate={() => {}} />)
  }
  beforeEach(() => {
    useCanvasStore.setState(useCanvasStore.getState(), true)
    vi.mocked(useAuth).mockReturnValue({ authenticated: true, user: { id: 'u-1', email: 'u@x.io' } } as never)
  })

  it('UNEARNED: both arms show the sentence; no "100%"', () => {
    const { getByTestId, container } = renderWith(turnReport({ goal_certainty: [UNEARNED_59] }))
    expect(getByTestId('goal-probability-certainty-unearned').textContent).toBe(SAY)
    expect(getByTestId('goal-impact-certainty-unearned').textContent).toBe(SAY)
    expect(container.textContent ?? '').not.toMatch(/More than 99% chance of meeting your goal/)
  })
  it('no sentence from the producer → the fallback, still no percentage', () => {
    const { getByTestId, container } = renderWith(turnReport({ goal_certainty: [{ ...UNEARNED_59, say: undefined }] }))
    expect(getByTestId('goal-probability-certainty-unearned').textContent).toBe(GOAL_CERTAINTY_UNEARNED_FALLBACK)
    expect(container.textContent ?? '').not.toMatch(/More than 99% chance of meeting your goal/)
  })
  it('AIQ 5888121329: an identity-mismatch certainty with no sentence names no cause (never "sized")', () => {
    const mismatch = { option_id: 'raise_to_59', probability_of_goal: 1, earned: false, identity_mismatch: { node_id: 'mrr', reason: 'operand_not_parent' }, no_break_even: 'operand_not_parent' }
    const { getByTestId } = renderWith(turnReport({ goal_certainty: [mismatch] }))
    const text = getByTestId('goal-probability-certainty-unearned').textContent ?? ''
    expect(text).toBe(GOAL_CERTAINTY_UNEARNED_FALLBACK)
    expect(text).not.toMatch(/sized/i)
  })

  it('CONTROL: an EARNED 100% keeps the figure', () => {
    const { queryByTestId, container } = renderWith(turnReport({ goal_certainty: [{ option_id: 'raise_to_59', probability_of_goal: 1, earned: true }] }))
    expect(queryByTestId('goal-probability-certainty-unearned')).toBeNull()
    expect(container.textContent ?? '').toContain('More than 99% chance of meeting your goal')
  })
})

describe('CEE #2369 — the producer STRIPS the unearned figure; the stored decision still gives the reason (AIQ 5913601080)', () => {
  const STRIPPED = {
    ...BLOCK,
    enrichment: {
      ...BLOCK.enrichment,
      option_comparison: BLOCK.enrichment.option_comparison.map((o) => {
        if (o.option_id !== 'raise_to_59') return o
        const { probability_of_goal: _stripped, ...rest } = o
        return rest
      }),
    },
  }
  const strippedTurnReport = (goal_certainty: unknown) => {
    const resultsComplete = vi.fn()
    const store = {
      setCurrentStage: vi.fn(), updateNode: vi.fn(), updateEdgeData: vi.fn(), setRunMeta: vi.fn(), setCeeAnalysisReady: vi.fn(),
      setAnalysisFreshness: vi.fn(), resultsComplete, nodes: [], edges: [], currentResultsHash: null,
    } as unknown as V5ApplicatorStore
    applyV5State({ response_version: 2, assistant_text: '', blocks: [STRIPPED], suggested_actions: [], insights: [], stage_indicator: 'frame', goal_certainty } as unknown as OlumiResponse, store)
    return resultsComplete.mock.calls[0][0].report as { option_probabilities: Record<string, Entry> }
  }
  it('⭐ no figure + one stored UNEARNED decision → £59 carries the producer\'s sentence; still no figure', () => {
    const o = optionsOf(strippedTurnReport([UNEARNED_59, EARNED_49])).raise_to_59
    expect(o.goalCertaintyUnearned).toEqual({ say: SAY })
    expect(selectGoalProbability(o as Parameters<typeof selectGoalProbability>[0]).goalProbability).toBeNull()
  })
  it('CONTROL: no figure and no decision for the option → nothing stamped (no invented reason)', () => {
    expect(optionsOf(strippedTurnReport([EARNED_49])).raise_to_59.goalCertaintyUnearned).toBeUndefined()
  })
  it('⭐ AIQ acceptance: the Goal panel says the producer’s sentence, and no percentage', () => {
    useCanvasStore.setState(useCanvasStore.getState(), true)
    vi.mocked(useAuth).mockReturnValue({ authenticated: true, user: { id: 'u-1', email: 'u@x.io' } } as never)
    const GOAL_NODE = { id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'MRR', goal_threshold_raw: 0.8 } }
    useCanvasStore.setState({ ...useCanvasStore.getState(), nodes: [GOAL_NODE], edges: [], goalThreshold: 0.8, goalConstraints: null, results: { status: 'complete', report: strippedTurnReport([UNEARNED_59, EARNED_49]) } } as never)
    const { getByTestId, container } = render(<GoalPanel nodeId="goal1" techMode={false} onClose={() => {}} onNavigate={() => {}} />)
    expect(getByTestId('goal-probability-certainty-unearned').textContent).toBe(SAY)
    expect(container.textContent ?? '').not.toMatch(/More than 99% chance of meeting your goal/)
  })
  it('CONTROL: an interior figure beside a decision is untouched (£54 at 0.8311)', () => {
    const o = optionsOf(strippedTurnReport([UNEARNED_59, EARNED_49])).raise_to_54
    expect(o.goalCertaintyUnearned).toBeUndefined()
    expect(selectGoalProbability(o as Parameters<typeof selectGoalProbability>[0]).goalProbability).toBe(0.8311)
  })
})
