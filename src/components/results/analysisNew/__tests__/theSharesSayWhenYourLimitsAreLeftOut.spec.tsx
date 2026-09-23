/**
 * ⭐ THE SHARES SAY WHEN YOUR LIMITS ARE LEFT OUT (RC 5803875794 P0 #3; RC
 * 5803995225, Panel: "When a material constraint is unevaluated, label the
 * result as partial/limited rather than an overall winner").
 *
 * THE USER PROBLEM (Paul's staging test, scenario 099b031f, 23 Sep ~21:40Z):
 * the decision had two requirements, £20k MRR AND churn under 4%. The engine
 * could not score the churn limit and CEE said
 * `leader_claim {permitted:false, withheld_reason:'constraint_verdict_withheld'}`.
 * "How the options compare" correctly withheld the ORDER, but drew 81% / 17% / 2%
 * with nothing saying the churn limit is not in them. The withheld cause
 * rendered only when NO option carried a figure (`noneNumbered`), which is not
 * the run Paul met.
 *
 * THE RULE: on exactly that reason, the section states once, above the shares,
 * that they compare the goal only — and gives the producer's cause. Wording
 * matches Canvas's option-card qualifier (programme-docs #63 5804041993).
 * Any other reason (`separation_unavailable`) and any permitted run: unchanged.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))
import { openAllSections } from './openNamedGroups'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { OptionsComparison } from '../sections/OptionsComparison'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { ANALYSIS_NEW_COPY as COPY, leaderWithholdCause } from '../analysisNewCopy'
import { useCanvasStore } from '../../../../canvas/store'
import { decisionWithLeaderWithheld, genuineDecision } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

/** The exact token CEE sent on Paul's run. */
const LIMITS_UNSCORED = 'constraint_verdict_withheld'
const OTHER_REASON = 'separation_unavailable'
const TESTID = 'analysis-new-options'

function vmFor(data: ResultsSectionDataReturn, reason: string | null) {
  return buildAnalysisNewViewModel({
    data: data as never,
    producerLeaderWithholdReason: reason,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    responseHash: 'limits-left-out',
  } as never)
}

function renderSection(data: ResultsSectionDataReturn, reason: string | null) {
  const vm = vmFor(data, reason)
  render(
    <OptionsComparison
      options={vm.optionsComparison}
      leaderWithholdCause={vm.checks.leaderWithholdCause}
      sharesExcludeLimits={vm.checks.sharesExcludeLimits}
      defaultOpen
    />,
  )
  return vm
}

const qualifier = () => screen.queryByTestId(`${TESTID}-goal-only`)

afterEach(() => {
  cleanup()
  useCanvasStore.setState({ analysisStateV1: null } as never)
})

describe('the view model says when the shares leave the limits out', () => {
  it('⭐ a withheld leader because the limits could not be checked → sharesExcludeLimits', () => {
    const vm = vmFor(decisionWithLeaderWithheld(), LIMITS_UNSCORED)
    expect(vm.checks.items.find((i) => i.id === 'leader')?.code, 'PRECONDITION').toBe('leader_not_assessed')
    expect(vm.checks.sharesExcludeLimits).toBe(true)
  })

  it('⛔ CONTRAST: another withhold reason is not about the limits', () => {
    expect(vmFor(decisionWithLeaderWithheld(), OTHER_REASON).checks.sharesExcludeLimits).toBe(false)
  })

  it('⛔ CONTRAST: an entitled run carrying a stale reason says nothing', () => {
    const vm = vmFor(genuineDecision(), LIMITS_UNSCORED)
    expect(vm.checks.items.find((i) => i.id === 'leader')?.code).not.toBe('leader_not_assessed')
    expect(vm.checks.sharesExcludeLimits).toBe(false)
  })
})

describe('"How the options compare" states it above the shares', () => {
  it('⭐ shares on screen + limits unscored → "Goal only" and the cause, once', () => {
    renderSection(decisionWithLeaderWithheld(), LIMITS_UNSCORED)
    const section = screen.getByTestId(TESTID)
    // PRECONDITION: this is the run Paul met — the options DO carry figures.
    expect(within(section).getAllByText(/%/).length, 'PRECONDITION: shares on screen').toBeGreaterThan(0)
    const line = qualifier()
    expect(line).not.toBeNull()
    expect(line!.textContent).toContain(COPY.optionFigures.goalOnlyQualifier)
    expect(line!.textContent).toContain(leaderWithholdCause(LIMITS_UNSCORED) as string)
    expect(within(section).getAllByText((_, el) => el?.getAttribute('data-testid') === `${TESTID}-goal-only`)).toHaveLength(1)
  })

  it('⛔ CONTRAST: another withhold reason adds no "Goal only" line', () => {
    renderSection(decisionWithLeaderWithheld(), OTHER_REASON)
    expect(qualifier()).toBeNull()
  })

  it('⛔ CONTRAST: an entitled run adds no "Goal only" line', () => {
    renderSection(genuineDecision(), LIMITS_UNSCORED)
    expect(qualifier()).toBeNull()
  })

  it('the qualifier never claims a leader or a limit verdict', () => {
    expect(COPY.optionFigures.goalOnlyQualifier).not.toMatch(/lead|best|win|recommend/i)
    expect(COPY.optionFigures.goalOnlyQualifier).not.toContain('—')
  })
})

describe('wired: the tab body reads the reason CEE sent from the store', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      analysisStateV1: { leader_claim: { permitted: false, withheld_reason: LIMITS_UNSCORED } },
    } as never)
  })

  it('⭐ the served tab shows the qualifier on the reason CEE sent', () => {
    render(
      <AnalysisNewTabBody
        resultsSectionData={decisionWithLeaderWithheld()}
        isPreRun={false}
        isRunning={false}
        isStale={false}
        responseHash="limits-left-out"
      />,
    )
    openAllSections()
    expect(qualifier()).not.toBeNull()
  })
})
