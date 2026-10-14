const TEST_RUN_AGAIN_COPY = 'Run the analysis again to see the chance.'

/**
 * P(goal) WITHHELD for an unevaluated identity on the goal's path — the Canvas consumer of PLoT #416
 * (AIQ #72 5885033487 (2), ACK 5886183999; DL 5885276225: read the typed reason, never the reply text).
 *
 * Carrier: `enrichment.inference_warnings[]` `{ code: 'GOAL_PROBABILITY_IDENTITY_NOT_EVALUATED', node_ids, message }`,
 * with `message` in AIQ's exact words. PLoT removes `probability_of_goal` from every option; the UI ALSO withholds if
 * a figure ever arrives beside the code (fail-closed at the one chooser, `selectGoalProbability`).
 *
 * The option rows are the served f5d503b0 block (trimmed), replayed through the REAL mapper.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { GoalPanel } from '../panels/GoalPanel'
import { useCanvasStore } from '../../../store'
import { useAuth } from '../../../../contexts/AuthContext'
import { GOAL_CONSTRAINT_COPY } from '../inspectorStrings'
import { mapV5AnalysisToReport } from '../../../../v5/mapV5AnalysisToReport'
import { selectGoalProbability } from '../../../../components/results/utils/selectGoalProbability'
import {
  GOAL_IDENTITY_NOT_EVALUATED_CODE,
  GOAL_IDENTITY_WITHHELD_FALLBACK,
  readGoalIdentityWithheld,
} from '../../../../components/results/utils/goalIdentityWithheld'
import type { AnalysisResultBlock } from '@talchain/schemas/boundary'
import type { GoalCertaintyEntry } from '../../../state/storedGoalCertainty'

vi.mock('../../../../contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../contexts/AuthContext')>()
  return { ...actual, useAuth: vi.fn() }
})

/** AIQ's exact words as PLoT #416 composes them (its PR body). */
const AIQ_WORDS =
  "Not shown. 'MRR' depends on Pro plan price × Pro paying subscribers, but this run couldn't calculate it that way, so the figures for each option would be wrong."
const WARNING = { code: GOAL_IDENTITY_NOT_EVALUATED_CODE, severity: 'warning', node_ids: ['mrr'], message: AIQ_WORDS }

type Entry = Record<string, unknown>
const SERVED_ENTRIES: Entry[] = [
  { id: 'keep_49_price', option_id: 'keep_49_price', label: 'Keep £49 price', option_label: 'Keep £49 price', status: 'computed', probability_of_goal: 0, probability_of_joint_goal: 1, win_probability: 0.0001 },
  { id: 'raise_to_59', option_id: 'raise_to_59', label: 'Raise to £59', option_label: 'Raise to £59', status: 'computed', probability_of_goal: 0.9874, probability_of_joint_goal: 1, win_probability: 0.9994 },
  { id: 'raise_to_54', option_id: 'raise_to_54', label: 'Raise to £54', option_label: 'Raise to £54', status: 'computed', probability_of_goal: 0.8311, probability_of_joint_goal: 1, win_probability: 0.0005 },
]
const WITHOUT_GOAL = SERVED_ENTRIES.map(({ probability_of_goal: _drop, ...rest }) => rest)
const ROBUST = { level: 'high', is_robust: true, confidence: 0.9994, recommended_option_id: 'raise_to_59' }

function report(entries: Entry[], warnings: unknown[] | undefined, goalCertainty?: readonly GoalCertaintyEntry[]) {
  const block = {
    type: 'analysis_result',
    summary: 's',
    leading_option_id: null,
    win_probabilities: { 'Keep £49 price': 0.0001, 'Raise to £59': 0.9994, 'Raise to £54': 0.0005 },
    enrichment: { option_comparison: entries, robustness: ROBUST, ...(warnings ? { inference_warnings: warnings } : {}) },
  } as unknown as AnalysisResultBlock
  return mapV5AnalysisToReport(block, { goalCertainty }) as unknown as Record<string, unknown>
}

/** PLoT #416's shape: the code, and no goal figure on any option. */
const PRODUCER_SHAPE = report(WITHOUT_GOAL, [WARNING])
/** Fail-closed: the code arrives BESIDE figures (a producer that forgot to strip them). */
const FIGURES_BESIDE_CODE = report(SERVED_ENTRIES, [WARNING])
/**
 * Control: Paul's evaluated identity — no code, the figure shows. Its Run RECORDS that Keep £49's 0 is earned: under the
 * schemas 0.63.0 contract an unrecorded 0/1 is never shown as certain (`goalCertaintyStamp`), so the control states it.
 */
const EVALUATED = report(SERVED_ENTRIES, undefined, [{ optionId: 'keep_49_price', endpoint: 0, earned: true, say: null }])

const GOAL_NODE = { id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'MRR', goal_threshold_raw: 0.8 } }
function renderWith(r: Record<string, unknown>) {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({ ...state, nodes: [GOAL_NODE], edges: [], goalThreshold: 0.8, goalConstraints: null, results: { status: 'complete', report: r } } as any)
  return render(<GoalPanel nodeId="goal1" techMode={false} onClose={() => {}} onNavigate={() => {}} />)
}
const optionsOf = (r: Record<string, unknown>) => Object.values(r.option_probabilities as Record<string, Entry>)

describe('readGoalIdentityWithheld — the one reader of the typed reason', () => {
  it('reads the code, the node ids and the producer’s words verbatim', () => {
    expect(readGoalIdentityWithheld({ inference_warnings: [WARNING] })).toEqual({ nodeIds: ['mrr'], message: AIQ_WORDS })
  })
  it('CONTRAST: another code, or none, is not a withhold', () => {
    expect(readGoalIdentityWithheld({ inference_warnings: [{ code: 'GOAL_LEVEL_FROM_IDENTITY_INPUTS', message: AIQ_WORDS }] })).toBeNull()
    expect(readGoalIdentityWithheld({})).toBeNull()
  })
  it('words that are not display-safe fall back, and the withhold still holds', () => {
    const unsafe = readGoalIdentityWithheld({ inference_warnings: [{ ...WARNING, message: 'Not shown. pro_mrr identity_evaluations missing' }] })
    expect(unsafe?.message).toBe(GOAL_IDENTITY_WITHHELD_FALLBACK)
    expect(readGoalIdentityWithheld({ inference_warnings: [{ code: GOAL_IDENTITY_NOT_EVALUATED_CODE }] })?.message).toBe(GOAL_IDENTITY_WITHHELD_FALLBACK)
  })
})

describe('the chooser withholds the goal figure on every option — the joint is untouched', () => {
  it('FAIL-CLOSED: figures beside the code → no option yields a goal figure', () => {
    for (const o of optionsOf(FIGURES_BESIDE_CODE)) {
      const d = selectGoalProbability(o as Parameters<typeof selectGoalProbability>[0])
      expect(d.goalProbability).toBeNull()
      expect(d.jointGoalProbability).toBe(1)
    }
  })
  it('CONTROL: the evaluated run keeps every option’s figure', () => {
    const shown = optionsOf(EVALUATED).map((o) => selectGoalProbability(o as Parameters<typeof selectGoalProbability>[0]).goalProbability)
    expect(shown).toEqual([0, 0.9874, 0.8311])
  })
})

describe('GoalPanel — the withheld words, and no goal percentage', () => {
  beforeEach(() => {
    useCanvasStore.setState(useCanvasStore.getState(), true)
    vi.mocked(useAuth).mockReturnValue({ authenticated: true, user: { id: 'u-1', email: 'u@x.io' } } as unknown as ReturnType<typeof useAuth>)
  })

  it.each([
    ['PLoT #416 shape (no figures)', PRODUCER_SHAPE],
    ['figures beside the code (fail-closed)', FIGURES_BESIDE_CODE],
  ])('%s → AIQ’s words once beside the target, 0 goal percentages', (_case, r) => {
    const { getByTestId, queryByTestId, container } = renderWith(r)
    expect(getByTestId('goal-probability-withheld-identity').textContent).toBe(AIQ_WORDS)
    expect(queryByTestId('goal-impact-withheld-identity')).toBeNull()
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/chance of meeting your goal/)
    expect(text).not.toContain(GOAL_CONSTRAINT_COPY.runForProbability)
    expect(text).not.toContain(GOAL_CONSTRAINT_COPY.perOptionOnly)
  })

  it('CONTROL: evaluated identity alone cannot license an older Run’s figure', () => {
    const { queryByTestId, container } = renderWith(EVALUATED)
    expect(queryByTestId('goal-probability-withheld-identity')).toBeNull()
    expect(container.textContent ?? '').not.toContain(TEST_RUN_AGAIN_COPY)
  })
})
