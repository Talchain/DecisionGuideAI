/**
 * ⛔ AIQ PRE-SHARE HOLD 5905251964 (R3 5905239972, 63 served captures): the hero said "Olumi doesn't hold today's level
 * of ‘the best outcome for MRR’" on Paul's MRR + cut-costs journeys while the goal held the user's £75,000 / £45,000.
 * The real cause was a TYPED producer withhold (Gate 5 / (S) / #416): every outcome absent, so nothing looked
 * "already denormalised" and `isNormalised` fired. The reason is now: the producer's own "Not shown." words; else "no
 * today's level" only with figures AND no level; else the neutral line.
 */
import { describe, expect, it } from 'vitest'
import { buildHeroModel } from '../buildHeroModel'
import { HERO_COPY } from '../heroCopy'
import type { HeroChartModel } from '../heroTypes'
import { makeHeroData, makeOption } from '../__fixtures__/hero.fixtures'

const GOAL = 'the best outcome for MRR'
const NO_LEVEL = /doesn't hold today's level/
/** CEE Gate 5's message opening (MG 5904463351 quote); the row binds the CARRIER, not these words. */
const GATE5 = 'Not shown. Olumi has not read ‘MRR’ as price × subscribers.'

const withheld = (id: string, label: string, winProbability: number) =>
  makeOption({ id, label, expected: undefined, outcome: undefined, bands: undefined, winProbability } as never)
const scored = (id: string, label: string, mean: number, winProbability: number) =>
  makeOption({ id, label, expected: mean, outcome: { mean, p10: mean - 0.03, p50: mean, p90: mean + 0.03 }, winProbability })

function hero(options: ReturnType<typeof makeOption>[], recommendation: Record<string, unknown>): HeroChartModel {
  const m = buildHeroModel(makeHeroData({ options, recommendation: { goalLabel: GOAL, goalThreshold: null, isNormalised: true, ...recommendation } }))
  expect(m.kind).toBe('chart')
  return m as HeroChartModel
}
const WITHHELD = [withheld('keep', 'Keep £49 price', 0.2), withheld('raise_59', 'Raise to £59', 0.8)]
const SCORED = [scored('keep', 'Keep £49 price', 0.41, 0.2), scored('raise_59', 'Raise to £59', 0.47, 0.8)]

describe('the outcome withhold says its true reason', () => {
  it('RED: the producer withheld every outcome and typed why → its own "Not shown." words, never "no today\'s level"', () => {
    const m = hero(WITHHELD, { goalFiguresWithheldMessage: GATE5, goalHoldsTodayLevel: true })
    expect(m.outcomeWithheldBody).toBe(GATE5)
  })

  it('RED: outcomes absent, no typed words, the goal holds its level (MRR £75k) → the neutral line', () => {
    const m = hero(WITHHELD, { goalHoldsTodayLevel: true })
    expect(m.outcomeWithheldBody).toBe(HERO_COPY.lensUnavailable.outcome)
    expect(m.outcomeWithheldBody).not.toMatch(NO_LEVEL)
  })

  it('RED: figures present but the goal HOLDS a level → never "doesn\'t hold today\'s level"', () => {
    expect(hero(SCORED, { goalHoldsTodayLevel: true }).outcomeWithheldBody).not.toMatch(NO_LEVEL)
  })

  it('NEGATIVE CONTROL (AIQ): unitless figures and a goal with NO level still say it', () => {
    expect(hero(SCORED, { goalHoldsTodayLevel: false }).outcomeWithheldBody).toMatch(NO_LEVEL)
  })
})

describe('the results hook carries both facts from the real store shape', () => {
  it('RED: the goal node\'s observedState.raw_value (MRR £75,000) and the report\'s typed withhold reach the recommendation', async () => {
    const { renderHook } = await import('@testing-library/react')
    const { useCanvasStore } = await import('../../../../canvas/store')
    const { useResultsSectionData } = await import('../../useResultsSectionData')
    useCanvasStore.setState({
      nodes: [{ id: 'mrr', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'MRR', observedState: { raw_value: 75000, unit: '£/month', source: 'brief_extraction' } } }],
      edges: [],
      results: { status: 'complete', progress: 100, hash: 'h', report: { inference_warnings: [{ code: 'GOAL_FIGURES_PRODUCT_NOT_READ', severity: 'warning', node_ids: ['mrr'], message: GATE5 }] } },
      hasCompletedFirstRun: true,
    } as never)
    const { result } = renderHook(() => useResultsSectionData())
    const rec = (result.current as unknown as { recommendation: { goalHoldsTodayLevel?: boolean; goalFiguresWithheldMessage?: string | null } }).recommendation
    expect(rec.goalHoldsTodayLevel).toBe(true)
    expect(rec.goalFiguresWithheldMessage).toBe(GATE5)
  })
})
