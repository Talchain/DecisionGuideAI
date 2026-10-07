/**
 * Compare-chance (schemas 0.81.0 `run_delta.goal_chances`; lease #87 6035414740, DL rulings 1 + 2): Compare leads with each
 * option's chance of meeting the goal, Earlier → Latest, each side as ITS Run showed it. Figures only: never a direction,
 * never a leader, never "chance of leading". Goal chances keep their own licence, so they show when run shares are withheld.
 *
 * Bound by IDENTITY (option ids, producer order, exact shared words); every "absent" row has a present control.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { RunDelta, RunDeltaGoalChanceDelta } from '@talchain/schemas/boundary'
import { AnalysisStateV1Schema } from '@talchain/schemas/boundary'
import { useCanvasStore } from '../../store'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { canvasLinkOfTarget, useCanvasLight } from '../../graphChanges/rowCanvasLink'
import { buildRunDeltaView } from '../../../components/results/analysisNew/runDeltaView'
import {
  COMPARE_GOAL_CHANCE_HEADING, goalChanceCompareWords, goalChanceSideWords,
} from '../../../components/results/analysis-hero/goalChanceCopy'
import { CompareRunPairBody } from '../CompareRunPairBody'
import { COMPARE_SUPPORT_TESTID } from '../CompareSupportFigures'
import { RUN_CHANGE_LABELS, runChangeDelta } from './__fixtures__/runChangeArtefact'

vi.mock('../../graphChanges/rowCanvasLink', () => ({ canvasLinkOfTarget: vi.fn(), useCanvasLight: vi.fn() }))
const original = useCanvasStore.getState()

// Producer (model) order is opt_49 THEN opt_60, deliberately NOT descending latest chance (15% before 47%).
const GOAL_CHANCES: RunDeltaGoalChanceDelta[] = [
  { option_id: 'opt_49', prior: { kind: 'point', pct: 47, rounding: 'whole' }, current: { kind: 'point', pct: 15, rounding: 'whole' } },
  { option_id: 'opt_60', prior: { kind: 'not_recorded' }, current: { kind: 'range', low_pct: 20, high_pct: 40, low_rounding: 'whole', high_rounding: 'nearest_5' } },
]
const withGoal = (overrides: Partial<RunDelta> = {}) => runChangeDelta({ goal_chances: GOAL_CHANCES, ...overrides })
const NO_CONTEST = /chance of leading|\blead(s|ing|er)?\b|\bwinner\b|\bbest\b|\bahead\b/i
const NO_DIRECTION = /\b(higher|lower|rose|fell|moved|up|down|increased|decreased)\b/i

describe('the words: each side as its own Run showed it, figures only', () => {
  it.each([
    [{ kind: 'point', pct: 47, rounding: 'whole' }, 'about 47%'],
    [{ kind: 'point', pct: 0, rounding: 'whole' }, 'less than 1%'],
    [{ kind: 'point', pct: 100, rounding: 'nearest_5' }, 'more than 99%'],
    [{ kind: 'range', low_pct: 20, high_pct: 40, low_rounding: 'whole', high_rounding: 'whole' }, 'between about 20% and 40%'],
    [{ kind: 'withheld' }, 'not shown'],
    [{ kind: 'not_recorded' }, 'not recorded'],
  ] as const)('%j → %s', (side, words) => {
    expect(goalChanceSideWords(side)).toBe(words)
    expect(goalChanceSideWords(side)).not.toMatch(NO_DIRECTION)
  })

  it('a pair reads earlier first, and never says which way it went', () => {
    const line = goalChanceCompareWords({ kind: 'point', pct: 47, rounding: 'whole' }, { kind: 'point', pct: 15, rounding: 'whole' })
    expect(line).toBe('Earlier about 47% → Latest about 15%')
    expect(line).not.toMatch(NO_DIRECTION)
    expect(line).not.toMatch(NO_CONTEST)
    expect(COMPARE_GOAL_CHANCE_HEADING).not.toMatch(NO_CONTEST)
  })
})

describe('the view carries the producer\'s goal chances by identity', () => {
  const labelFor = (id: string) => RUN_CHANGE_LABELS.get(id) ?? null
  it('in producer order, with labels (control: a pre-0.81 delta carries none)', () => {
    expect(buildRunDeltaView(withGoal(), labelFor).goalChances).toEqual([
      { optionId: 'opt_49', label: 'Keep £49', prior: GOAL_CHANCES[0].prior, current: GOAL_CHANCES[0].current },
      { optionId: 'opt_60', label: 'Raise to £60', prior: GOAL_CHANCES[1].prior, current: GOAL_CHANCES[1].current },
    ])
    expect(buildRunDeltaView(runChangeDelta(), labelFor).goalChances).toBeUndefined()
  })

  it('withheld when the goal\'s direction changed between the Runs (control: the same pair without that row keeps them)', () => {
    const base = withGoal()
    const flipped = { ...base, input_changes: [...(base.input_changes ?? []), {
      entity_kind: 'goal', entity_id: 'goal_1', field: 'direction', label_before: 'Goal', label_after: 'Goal',
      before: { raw: 'maximise' }, after: { raw: 'minimise' }, change: 'changed',
    }] } as unknown as RunDelta
    expect(buildRunDeltaView(flipped, labelFor).goalChances).toBeUndefined()
    expect(buildRunDeltaView(base, labelFor).goalChances).toHaveLength(2)
  })
})

function seed(delta: RunDelta, permission: { permitted: boolean; producer_cause?: string } = { permitted: true }, current = true): string {
  const report = mapV5AnalysisToReport({ type: 'analysis_result', summary: 'Options compared',
    leading_option_id: 'opt_49', win_probabilities: { opt_60: 0.44, opt_49: 0.56 } })
  report.producer_leader_permission = permission
  const hash = report.model_card.response_hash
  useCanvasStore.setState({ currentScenarioId: 'scn-1',
    nodes: [...RUN_CHANGE_LABELS.keys()].map((id) => ({ id, type: id.startsWith('opt') ? 'option' : 'factor', position: { x: 0, y: 0 }, data: { label: RUN_CHANGE_LABELS.get(id) } })), edges: [],
    results: { status: 'complete', progress: 100, report, hash },
    runDelta: { delta, analysisHash: hash, scenarioId: 'scn-1' },
    analysisStateV1: AnalysisStateV1Schema.parse({
      run_state: { kind: 'complete_current', computed_at: '2026-09-30T13:09:00.000Z' }, readiness: { status: 'ready', blockers: [] },
      leader_claim: { permitted: true }, robustness: {}, usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
      requires_rerun: false, blocked_unusable: false, contradictions: [],
    }), analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' }, analysisFreshnessDirty: !current,
    importPendingServerRegistration: false, hasCompletedFirstRun: true, ceeAnalysisReady: null,
  } as never)
  return hash
}
// The RESULT heading, by its section: the inputs section has its own level-3 heading (Compare v3 rows).
const heading = () => within(document.querySelector('[data-compare-section="headline"]') as HTMLElement).getByRole('heading', { level: 3 })
const goalRows = () => within(screen.getByTestId('compare-goal-chances')).getAllByRole('listitem')
// Each row's words (read out) and its drawn pair (for the eye), by their own elements.
const goalWords = () => goalRows().map((li) => within(li).getByTestId('compare-goal-chance-words').textContent)
const goalPairs = () => goalRows().map((li) => within(li).getByTestId('compare-goal-chance-pair').textContent)

beforeEach(() => {
  useCanvasStore.setState(original, true)
  vi.mocked(canvasLinkOfTarget).mockImplementation((target) => (target ? { target, focus: vi.fn(), highlight: vi.fn() } : null))
  vi.mocked(useCanvasLight).mockReturnValue({ on: vi.fn(), off: vi.fn() })
})
afterEach(() => { cleanup(); useCanvasStore.setState(original, true) })

describe('Compare leads with each option\'s chance of meeting the goal', () => {
  it('the heading names the quantity, and each option\'s row is its two sides in producer order', () => {
    render(<CompareRunPairBody responseHash={seed(withGoal())} />)
    expect(heading()).toHaveTextContent(COMPARE_GOAL_CHANCE_HEADING)
    expect(goalRows().map((li) => li.getAttribute('data-option-id'))).toEqual(['opt_49', 'opt_60'])
    expect(goalWords()).toEqual([
      'Keep £49: Earlier about 47% → Latest about 15%',
      'Raise to £60: Earlier not recorded → Latest between about 20% and 40%',
    ])
    expect(goalPairs()).toEqual(['about 47%about 15%', 'not recordedbetween about 20% and 40%'])
    // The latest side with a figure reads a step stronger; a side without a figure stays muted.
    const [first, second] = goalRows().map((li) => [...within(li).getByTestId('compare-goal-chance-pair').querySelectorAll('span')].map((x) => x.className))
    expect(first).toEqual(['text-text-body', 'text-text-header'])
    expect(second).toEqual(['text-text-light', 'text-text-header'])
    const section = screen.getByTestId('compare-goal-chances')
    expect(section.textContent).not.toMatch(NO_DIRECTION)
    expect(screen.getByTestId('compare-run-pair').textContent).not.toMatch(NO_CONTEST)
  })

  it('run shares move behind Result details (control: without goal chances they lead, unchanged)', () => {
    render(<CompareRunPairBody responseHash={seed(withGoal())} />)
    expect(screen.queryByTestId(COMPARE_SUPPORT_TESTID)).toBeNull()
    expect(screen.queryByTestId('compare-share-results')).toBeNull()
    fireEvent.click(screen.getByTestId('compare-result-details-toggle'))
    const shares = screen.getByTestId('compare-share-results')
    // The share sentence is the run-share headline for the same pair (this fixture names no leader).
    expect(shares).toHaveTextContent('The latest run names no option')
    expect(within(shares).getByTestId(COMPARE_SUPPORT_TESTID)).toBeInTheDocument()
    cleanup()
    render(<CompareRunPairBody responseHash={seed(runChangeDelta())} />)
    expect(heading()).toHaveTextContent('The latest run names no option')
    expect(screen.getByTestId(COMPARE_SUPPORT_TESTID)).toBeInTheDocument()
    expect(screen.queryByTestId('compare-goal-chances')).toBeNull()
  })

  it('withheld run shares do not hide the goal chances (ruling 1); the not-shown reason stays (control: no goal chances → "Result comparison not shown")', () => {
    render(<CompareRunPairBody responseHash={seed(withGoal(), { permitted: false, producer_cause: 'constraint_verdict_withheld' })} />)
    expect(heading()).toHaveTextContent(COMPARE_GOAL_CHANCE_HEADING)
    expect(goalRows()).toHaveLength(2)
    expect(screen.getByTestId('compare-withheld-reason')).toBeInTheDocument()
    expect(screen.queryByTestId('compare-result-details')).toBeNull()
    cleanup()
    render(<CompareRunPairBody responseHash={seed(runChangeDelta(), { permitted: false, producer_cause: 'constraint_verdict_withheld' })} />)
    expect(heading()).toHaveTextContent('Result comparison not shown')
  })

  it('a pair whose Runs show no chance at all keeps the run-share layout (control: one figure on one side leads with goal chances)', () => {
    const none = [
      { option_id: 'opt_49', prior: { kind: 'withheld' }, current: { kind: 'withheld' } },
      { option_id: 'opt_60', prior: { kind: 'not_recorded' }, current: { kind: 'withheld' } },
    ] as RunDeltaGoalChanceDelta[]
    render(<CompareRunPairBody responseHash={seed(runChangeDelta({ goal_chances: none }))} />)
    expect(screen.queryByTestId('compare-goal-chances')).toBeNull()
    expect(heading()).toHaveTextContent('The latest run names no option')
    cleanup()
    const one = [none[0], { ...none[1], current: { kind: 'point', pct: 30, rounding: 'whole' } }] as RunDeltaGoalChanceDelta[]
    render(<CompareRunPairBody responseHash={seed(runChangeDelta({ goal_chances: one }))} />)
    expect(heading()).toHaveTextContent(COMPARE_GOAL_CHANCE_HEADING)
    expect(goalWords()).toEqual(['Keep £49: Earlier not shown → Latest not shown', 'Raise to £60: Earlier not recorded → Latest about 30%'])
  })

  it('a pair that is not the current model\'s shows no goal chances (control: the current pair does)', () => {
    render(<CompareRunPairBody responseHash={seed(withGoal(), { permitted: true }, false)} />)
    expect(screen.queryByTestId('compare-goal-chances')).toBeNull()
    cleanup()
    render(<CompareRunPairBody responseHash={seed(withGoal(), { permitted: true }, true)} />)
    expect(screen.getByTestId('compare-goal-chances')).toBeInTheDocument()
  })
})
