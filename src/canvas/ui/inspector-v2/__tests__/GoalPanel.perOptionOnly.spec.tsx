import { RUN_AGAIN_FOR_CHANCE } from '../../../runView/runView'
import { licensedTestReport } from '../../../runView/__tests__/helpers/licensedTestReport'
/**
 * GoalPanel: when NO option is put forward but the run carried every option's goal figure.
 *
 * Served f5d503b0 × CEE c0c45f0 (29 Sep 2026, Pro-price brief, £80k target): `leading_option_id: null` and no
 * `recommended_option_id` (the leader was withheld), so the panel had no single figure. It said "This run did not
 * return the share of model runs that reach this target" and "Probability data unavailable". Meanwhile the same
 * run's Analysis goal-fit lens showed < 1% / 99% / 83%. The panel denied figures the report held.
 *
 * The block below is that served `analysis_result`, trimmed to the fields the mapper reads for this decision, and
 * replayed through the REAL mapper. The panel must say where the figures are and must never pick one (no percentage).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { GoalPanel } from '../panels/GoalPanel'
import { useCanvasStore } from '../../../store'
import { useAuth } from '../../../../contexts/AuthContext'
import { GOAL_CONSTRAINT_COPY, GOAL_STRINGS } from '../inspectorStrings'
import { mapV5AnalysisToReport } from '../../../../v5/mapV5AnalysisToReport'
import type { AnalysisResultBlock } from '@talchain/schemas/boundary'

vi.mock('../../../../contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../contexts/AuthContext')>()
  return { ...actual, useAuth: vi.fn() }
})

const GOAL_NODE = { id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'MRR', goal_threshold_raw: 0.8 } }

type Entry = Record<string, unknown>
const SERVED_ENTRIES: Entry[] = [
  { id: 'keep_49_price', option_id: 'keep_49_price', label: 'Keep £49 price', option_label: 'Keep £49 price', status: 'computed', probability_of_goal: 0, probability_of_joint_goal: 1, win_probability: 0.0001 },
  { id: 'raise_to_59', option_id: 'raise_to_59', label: 'Raise to £59', option_label: 'Raise to £59', status: 'computed', probability_of_goal: 0.9874, probability_of_joint_goal: 1, win_probability: 0.9994 },
  { id: 'raise_to_54', option_id: 'raise_to_54', label: 'Raise to £54', option_label: 'Raise to £54', status: 'computed', probability_of_goal: 0.8311, probability_of_joint_goal: 1, win_probability: 0.0005 },
]

function report(entries: Entry[], robustness: Record<string, unknown>) {
  const block = {
    type: 'analysis_result',
    summary: 'This run cannot put an option forward.',
    leading_option_id: null,
    win_probabilities: { 'Keep £49 price': 0.0001, 'Raise to £59': 0.9994, 'Raise to £54': 0.0005 },
    enrichment: { option_comparison: entries, robustness },
  } as unknown as AnalysisResultBlock
  return mapV5AnalysisToReport(block) as unknown as Record<string, unknown>
}

/** Served: the robustness block carries no recommended option. */
const SERVED = report(SERVED_ENTRIES, { level: 'high', is_robust: true, confidence: 0.9994 })
/** Contrast: the same run with no goal figure on any option. */
const NO_GOAL = report(SERVED_ENTRIES.map(({ probability_of_goal: _drop, ...rest }) => rest), { level: 'high', is_robust: true, confidence: 0.9994 })
/** Control: the producer DID put one forward, so the panel shows that option's figure. */
const RECOMMENDED = report(SERVED_ENTRIES, { level: 'high', is_robust: true, confidence: 0.9994, recommended_option_id: 'raise_to_59' })

function renderWith(r: Record<string, unknown>) {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({ ...state, nodes: [GOAL_NODE], edges: [], goalThreshold: 0.8, goalConstraints: null, results: { status: 'complete', report: r } } as any)
  return render(<GoalPanel nodeId="goal1" techMode={false} onClose={() => {}} onNavigate={() => {}} />)
}

describe('GoalPanel — no option put forward, per-option goal figures present (served f5d503b0)', () => {
  beforeEach(() => {
    useCanvasStore.setState(useCanvasStore.getState(), true)
    vi.mocked(useAuth).mockReturnValue({ authenticated: true, user: { id: 'u-1', email: 'u@x.io' } } as unknown as ReturnType<typeof useAuth>)
  })

  it('SERVED: raw unlicensed figures do not advertise available per-option chances', () => {
    const { queryByTestId, container } = renderWith(SERVED)
    expect(queryByTestId('goal-probability-per-option')).toBeNull()
    expect(queryByTestId('goal-impact-per-option')).toBeNull()
    const text = container.textContent ?? ''
    expect(text).toContain(GOAL_CONSTRAINT_COPY.runForProbability)
    expect(text).toContain(GOAL_STRINGS.impactUnavailable)
    // It never picks an option: no goal percentage on this panel.
    expect(text).not.toMatch(/\d+(\.\d+)?% chance of meeting your goal/)
  })

  it('CONTRAST: with no goal figure on any option, the run’s own absence is stated', () => {
    const { queryByTestId, container } = renderWith(NO_GOAL)
    expect(queryByTestId('goal-probability-per-option')).toBeNull()
    expect(queryByTestId('goal-impact-per-option')).toBeNull()
    expect(container.textContent ?? '').toContain(GOAL_CONSTRAINT_COPY.runForProbability)
  })

  it('CONTROL: a pointer cannot license the recommended option’s raw figure', () => {
    const { queryByTestId, container } = renderWith(RECOMMENDED)
    expect(queryByTestId('goal-probability-per-option')).toBeNull()
    expect(container.textContent ?? '').toContain(RUN_AGAIN_FOR_CHANCE)
  })
  it('CONTRAST: an explicit test licence preserves the per-option availability signal without picking an option', () => {
    const { getByTestId, container } = renderWith(licensedTestReport(SERVED))
    expect(getByTestId('goal-probability-per-option').textContent).toContain(GOAL_CONSTRAINT_COPY.perOptionOnly)
    expect(container.textContent).not.toContain(GOAL_CONSTRAINT_COPY.runForProbability)
    expect(container.textContent).not.toMatch(/\d+(\.\d+)?% chance/)
  })

})
