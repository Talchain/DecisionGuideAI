/**
 * B3b · DL R1 (5930827933) conditions 3 and 4, on the per-claim keys CEE #2448 serves:
 *   3. the kept outcome always shows with its spread, never as a bare centre;
 *   4. an outcome resting on Olumi's estimates the user accepted (`rests_on_accepted_olumi`) says so beside it.
 * Served run `0303ef5` (pricing) with a GOAL_FIGURES warning that keeps outcomes and names one option as resting on
 * accepted estimates. Conditions 1 and 2 (user's order, no ranking from kept outcomes) are pinned by
 * `keptOutcomesNeverRankUnderAWinShareWithhold.spec.tsx`.
 */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, renderHook, screen, cleanup } from '@testing-library/react'

vi.mock('../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))

import { useCanvasStore } from '../../../canvas/store'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { useResultsSectionData } from '../useResultsSectionData'
import { OptionCards } from '../OptionCards'
import { AnalysisNewTabBody } from '../analysisNew/AnalysisNewTabBody'
import { RESTS_ON_ACCEPTED_OLUMI_LABEL } from '../utils/goalIdentityWithheld'
import type { OptionResult } from '../types'
import served from '../../../canvas/__tests__/fixtures/served-0303ef5-pricing-withheld-run.json'

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    results: { status: 'idle', progress: 0 } as never,
    nodes: [] as never,
    hasCompletedFirstRun: false,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
  } as never)
})

const ACCEPTED = '59_with_next_release'
const warning = (extra: Record<string, unknown>) => ({
  code: 'GOAL_FIGURES_TARGET_NOT_TESTABLE',
  severity: 'warning',
  message: "Not shown. Olumi can't give each option's figures for this goal from this run.",
  withheld_claims: ['goal_probability', 'joint_probability', 'win_share'],
  rests_on_accepted_olumi: [ACCEPTED],
  ...extra,
})

function mapped(extra: Record<string, unknown> = {}) {
  const ar = served.analysis_result as unknown as { enrichment: { inference_warnings: unknown[] } }
  const block = { ...ar, enrichment: { ...ar.enrichment, inference_warnings: [...ar.enrichment.inference_warnings, warning(extra)] } }
  return mapV5AnalysisToReport(block as never, {} as never) as unknown as Record<string, unknown> & {
    option_probabilities: Record<string, { outcomeRestsOnAcceptedOlumi?: true }>
  }
}

function seed() {
  useCanvasStore.setState({
    hasCompletedFirstRun: true,
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
    analysisFreshnessDirty: false,
    nodes: [
      { id: 'out1', type: 'outcome', position: { x: 0, y: 0 }, data: { label: 'MRR', kind: 'outcome' } },
      ...served.options.map((o, i) => ({ id: o.id, type: 'option', position: { x: i * 220, y: 200 }, data: { label: o.label, kind: 'option' } })),
    ] as never,
    edges: [] as never,
    results: { status: 'complete', progress: 100, report: mapped() } as never,
  } as never)
}

describe('B3b · the mapper stamps exactly the options the producer named', () => {
  it('only the named option carries the accepted-estimate stamp', () => {
    const r = mapped()
    expect(r.option_probabilities[ACCEPTED].outcomeRestsOnAcceptedOlumi).toBe(true)
    for (const id of ['keep_49_price', '54_with_next_release']) expect(r.option_probabilities[id].outcomeRestsOnAcceptedOlumi).toBeUndefined()
  })

  it('⛔ CONTRAST: an option whose outcome is itself withheld carries no stamp (there is no figure to label)', () => {
    const r = mapped({ withheld_claims: ['goal_probability', 'joint_probability', 'win_share', 'outcome'] })
    expect(r.option_probabilities[ACCEPTED].outcomeRestsOnAcceptedOlumi).toBeUndefined()
  })
})

describe('B3b · every outcome surface says it beside the figure', () => {
  it('the hook carries the stamp and the withhold onto the option', () => {
    seed()
    const rec = renderHook(() => useResultsSectionData()).result.current.recommendation
    const byId = Object.fromEntries(rec.allOptions.map((o) => [o.id, o]))
    expect(byId[ACCEPTED].outcomeRestsOnAcceptedOlumi).toBe(true)
    expect(byId[ACCEPTED].goalFigureWithheld).toBe(true)
    expect(byId.keep_49_price.outcomeRestsOnAcceptedOlumi).toBeUndefined()
  })

  it('the Reasoning tab labels the named option\'s range, and only that one', () => {
    seed()
    const data = renderHook(() => useResultsSectionData()).result.current
    render(<AnalysisNewTabBody resultsSectionData={data} isPreRun={false} isRunning={false} isStale={false} responseHash="b3b" />)
    expect(screen.getByTestId(`analysis-new-options-outcome-range-${ACCEPTED}`)).toBeInTheDocument()
    expect(screen.getByTestId(`analysis-new-options-rests-on-accepted-${ACCEPTED}`)).toHaveTextContent(RESTS_ON_ACCEPTED_OLUMI_LABEL)
    expect(screen.queryByTestId('analysis-new-options-rests-on-accepted-keep_49_price')).toBeNull()
  })
})

describe('B3b · the option card (expert block)', () => {
  const base = (over: Partial<OptionResult>): OptionResult =>
    ({ id: 'o1', label: 'Option one', expected: 120, outcome: { mean: 120, p10: 80, p50: 118, p90: 160 }, isRecommended: false, ...over }) as OptionResult
  const draw = (o: OptionResult) =>
    render(<OptionCards options={[o, base({ id: 'o2', label: 'Option two' })]} hasLeadingOption={false} expertMode />)

  it('with its spread, the accepted-estimate label sits under the range', () => {
    draw(base({ goalFigureWithheld: true, outcomeRestsOnAcceptedOlumi: true }))
    expect(screen.getByTestId('option-rests-on-accepted-o1')).toHaveTextContent(RESTS_ON_ACCEPTED_OLUMI_LABEL)
    expect(screen.queryByTestId('option-rests-on-accepted-o2')).toBeNull()
  })

  it('⛔ a withheld option with no spread shows no bare centre; CONTRAST an ordinary option keeps "Expected:"', () => {
    const bare = { mean: 120, p10: null, p50: null, p90: null } as unknown as OptionResult['outcome']
    draw(base({ goalFigureWithheld: true, outcome: bare }))
    expect(screen.queryByText(/Expected: 120/)).toBeNull()
    cleanup()
    draw(base({ outcome: bare }))
    expect(screen.getAllByText(/Expected: 120/).length).toBeGreaterThan(0)
  })
})
