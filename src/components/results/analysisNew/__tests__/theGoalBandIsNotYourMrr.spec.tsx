/**
 * Paul's test (27 Sep, export 17d1cd3a, served e8ba18e6): "Inspect values and
 * units" printed the status quo's MRR median as "£15,320" beside a stated
 * £75,000. The engine's goal samples carry no intercept, so the band is a model
 * level, not the user's MRR (MG #70 5854878511; DL 5854887316 item 1: "don't
 * show raw goal samples as the user's unit"). `goalBandIsInUserUnits` is the
 * one switch; today it is false on every run.
 *
 * The in-user-units path stays pinned by `aboutThisAnalysis.spec` and
 * `theAxisOmitsTheModelScale.spec`, which mock the switch on.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

const conversation = { sendSystemEvent: () => Promise.resolve(undefined) }
vi.mock('../../../../canvas/conversation/ConversationContext', () => ({
  useOptionalConversationContext: () => conversation,
  useConversationContext: () => conversation,
  ConversationProvider: ({ children }: { children: unknown }) => children,
}))
vi.mock('../../../../canvas/ToastContext', () => ({
  useShowToastSafe: () => vi.fn(),
  ToastProvider: ({ children }: { children: unknown }) => children,
}))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { ABOUT_COPY, AboutThisAnalysis, formatModelScore } from '../sections/AboutThisAnalysis'
import type { AboutOutcomeFormat } from '../sections/AboutThisAnalysis'
import { OptionsComparison } from '../sections/OptionsComparison'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { goalBandIsInUserUnits } from '../goalBandUnits'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { decisionWithLeaderWithheld } from './analysisNewFixtures'

type Outcome = { mean: number; p10: number; p50: number; p90: number }
// Paul's export 17d1cd3a, `option_comparison[*].outcome` (two of three options).
const PAULS_BAND: Record<string, Outcome> = {
  opt_a: { mean: 14912, p10: 1050.76, p50: 15320.35, p90: 28331.59 },
  opt_b: { mean: 17330, p10: 1162, p50: 17975, p90: 32896 },
}
const GBP_MRR: AboutOutcomeFormat = { unit: 'currency', symbol: '£', isNormalised: false }

function withOutcomes(outcomes: Record<string, Outcome>): ResultsSectionDataReturn {
  const data = decisionWithLeaderWithheld()
  return {
    ...data,
    recommendation: {
      ...data.recommendation,
      allOptions: data.recommendation.allOptions.map((o) => (outcomes[o.id] ? { ...o, outcome: outcomes[o.id] } : o)),
    },
  }
}
const vmOf = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false, responseHash: 'paul-band' })

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

describe("the goal band is not the user's MRR", () => {
  it('PRECONDITION: the switch is off today', () => {
    expect(goalBandIsInUserUnits()).toBe(false)
  })

  it('⭐ the values table prints model levels, no £, under a caption that says so', () => {
    const vm = vmOf(withOutcomes(PAULS_BAND))
    render(<AboutThisAnalysis vm={vm} outcomeFormat={GBP_MRR} />)
    fireEvent.click(screen.getByTestId('analysis-new-about-toggle'))
    fireEvent.click(screen.getByTestId('analysis-new-about-detail-values-toggle'))
    const body = screen.getByTestId('analysis-new-about-detail-values-body')
    // POSITIVE CONTROL: the rows are there, with Paul's figures as model levels.
    expect(screen.getByTestId('analysis-new-about-values-opt_a-mid')).toHaveTextContent(formatModelScore(15320.35))
    expect(body.textContent ?? '').not.toMatch(/£/)
    expect(within(body).getByTestId('analysis-new-about-values-not-your-units')).toHaveTextContent(
      ABOUT_COPY.values.notYourUnits,
    )
  })

  it('⭐ the Modelled outcome axis says Lower … Higher and prints no tick figures', () => {
    const vm = vmOf(withOutcomes(PAULS_BAND))
    render(<OptionsComparison options={vm.optionsComparison} />)
    fireEvent.click(screen.getByTestId('analysis-new-options-toggle'))
    // POSITIVE CONTROL: the outcome lens is drawn.
    expect(screen.getByTestId('analysis-new-options-outcome-range-opt_a')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-options-axis-ticks')).toBeNull()
    expect(screen.getByTestId('analysis-new-options-axis-end-lower')).toHaveTextContent(COPY.optionFigures.axisLower)
    expect(screen.getByTestId('analysis-new-options-axis-end-higher')).toHaveTextContent(COPY.optionFigures.axisHigher)
    const text = screen.getByTestId('analysis-new-options-axis').textContent ?? ''
    expect(text).not.toMatch(/\d/)
  })
})
