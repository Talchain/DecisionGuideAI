/**
 * Recovery Batch C (UI): the hero says the C licence AS SERVED. Paul's hiring (a change from today) and marketing (two
 * targets) journeys, through the real V5 mapper, the real canonical parser and the real Results hook (fixture words are
 * C CEE's own, see `batchCGoalChance.ts`).
 *
 *   1. the chance words, the notes, the status quo ("No change, by assumption"), the joint headline OR its withheld line
 *      with the bound, and each target's own line, in CEE's order;
 *   2. the licence's words, never the generic "chance of meeting your goal";
 *   3. with several targets the per-option figure is the JOINT (35 / 48), never `probability_of_goal` (60 / 70).
 *
 * Lives in the hero's own directory: `inertness.spec.ts` forbids importing the hero from anywhere else.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, renderHook, screen } from '@testing-library/react'
import { useResultsSectionData } from '../../useResultsSectionData'
import { buildHeroModel } from '../buildHeroModel'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import type { HeroChartModel } from '../heroTypes'
import {
  HIRING_NOTES, HIRING_STATUS_QUO_FACE, HIRING_STATUS_QUO_LINE, HIRING_TECH_LEAD_FACE, HIRING_TWO_DEVS_FACE, HIRING_WORDS,
  MARKETING_CONVERSION_TARGET_LINE, MARKETING_FRECHET_LINE, MARKETING_JOINT_WITHHELD_LINE, MARKETING_NEW_CUSTOMERS_TARGET_LINE,
  MARKETING_NOTES, MARKETING_WORDS, hiringJourney, marketingFace, marketingJourney, resetJourney, seedJourney,
} from '../../__tests__/helpers/batchCGoalChance'

const GENERIC = /chance of meeting your goal/
const data = () => renderHook(() => useResultsSectionData()).result.current
function hero(): HeroChartModel {
  const model = buildHeroModel(data())
  expect(model.kind, 'precondition: the Run builds a chart').toBe('chart')
  return model as HeroChartModel
}
const detailOf = (m: HeroChartModel) => (m.goalChanceDetailLines ?? []).map(l => [l.kind, l.text])

afterEach(() => { cleanup(); resetJourney() })

describe('Batch C hiring: a change from today, said in the licence\'s own words', () => {
  it('items 1 + 2: the headline says each option\'s chance in the chance words; each line is CEE\'s face; never "your goal"', () => {
    seedJourney(hiringJourney())
    const m = hero()
    expect(m.headline).toBe(`In this model, on current information, each option’s ${HIRING_WORDS}:`)
    const cells = (m.goalChanceLeadLines ?? []).filter(l => l.kind === 'cell')
    expect(cells.map(l => [l.id, l.text, l.why])).toEqual([
      ['hire_a_tech_lead', HIRING_TECH_LEAD_FACE, undefined],
      ['hire_two_developers', HIRING_TWO_DEVS_FACE, undefined],
      ['carry_on', `‘Carry on with the current team’: ${HIRING_STATUS_QUO_FACE}`, HIRING_STATUS_QUO_LINE],
    ])
    expect(`${m.headline} ${m.subline}`).not.toMatch(GENERIC)
  })

  it('item 1: the notes are said once beside the chances, in order; the status quo line is not said twice (its cell\'s "Why?" says it)', () => {
    seedJourney(hiringJourney())
    const m = hero()
    expect(detailOf(m)).toEqual(HIRING_NOTES.map(n => ['note', n]))
    render(<AnalysisHeroPanel model={m} rerunDisabled={false} />)
    const block = screen.getByTestId('hero-goal-chance-detail')
    expect([...block.querySelectorAll('p')].map(p => p.textContent)).toEqual(HIRING_NOTES)
    expect(screen.getByText(`‘Carry on with the current team’: ${HIRING_STATUS_QUO_FACE}`)).toBeInTheDocument()
  })

  it('provisional (C CEE amendment 7): a chance resting on Olumi\'s starting value says so in the headline, in CEE\'s words', () => {
    const j = hiringJourney()
    const licence = (j.block.enrichment as { inference_warnings: Record<string, unknown>[] }).inference_warnings[0]
    Object.assign(licence, { olumi_estimate_value_count: 1 })
    seedJourney(j)
    expect(hero().headline).toBe(`In this model, on current information, each option’s ${HIRING_WORDS}, using Olumi's estimates for 1 starting value (see Check estimates):`)
  })

  it('CONTROL (freshness, RunView\'s cell rule): a stale canonical view says no detail and no chance words', () => {
    const j = hiringJourney()
    seedJourney(j, { ...j.canonical, staleness: { ...(j.canonical.staleness as object), stale: true } })
    const m = hero()
    expect(m.goalChanceDetailLines).toBeUndefined()
    expect(m.headline).not.toContain(HIRING_WORDS)
  })

  it('CONTROL (no Batch C detail): the same Run without `goal_chance` keeps the pre-C headline words', () => {
    const j = hiringJourney()
    const { goal_chance: _drop, ...canonical } = j.canonical
    seedJourney(j, canonical)
    const m = hero()
    expect(m.goalChanceDetailLines).toBeUndefined()
    expect(m.headline).not.toContain(HIRING_WORDS)
  })
})

describe('Batch C marketing: two targets; the joint is the headline, each target below', () => {
  it('items 1-3 (joint licensed): the headline in the joint\'s words; each option\'s line quotes the JOINT; each target on its own', () => {
    seedJourney(marketingJourney('licensed'))
    const m = hero()
    expect(m.headline).toBe(`In this model, on current information, each option’s ${MARKETING_WORDS}:`)
    expect((m.goalChanceLeadLines ?? []).filter(l => l.kind === 'cell').map(l => l.text)).toEqual([
      marketingFace('Hire a marketing manager', 35), marketingFace('AI planning plus advertising', 48),
    ])
    // Item 3, by identity: the row values ARE the joint; the new-customers marginal (60 / 70) is never the figure.
    expect(Object.fromEntries(m.rows.map(r => [r.id, r.goal.value]))).toEqual({ hire_manager: 0.35, ai_plus_ads: 0.48 })
    expect(detailOf(m)).toEqual([
      ['target', MARKETING_NEW_CUSTOMERS_TARGET_LINE], ['target', MARKETING_CONVERSION_TARGET_LINE], ['note', MARKETING_NOTES[0]],
    ])
    expect(`${m.headline} ${m.subline}`).not.toMatch(GENERIC)
  })

  it('item 1 (joint withheld): the withheld line and the bound lead, then each target; no option is quoted a chance', () => {
    seedJourney(marketingJourney('withheld'))
    const m = hero()
    expect(detailOf(m)).toEqual([
      ['joint_withheld', MARKETING_JOINT_WITHHELD_LINE], ['joint_bound', MARKETING_FRECHET_LINE],
      ['target', MARKETING_NEW_CUSTOMERS_TARGET_LINE], ['target', MARKETING_CONVERSION_TARGET_LINE], ['note', MARKETING_NOTES[0]],
    ])
    render(<AnalysisHeroPanel model={m} rerunDisabled={false} />)
    const said = [...screen.getByTestId('hero-goal-chance-detail').querySelectorAll('p')].map(p => p.textContent)
    expect(said.slice(0, 2)).toEqual([MARKETING_JOINT_WITHHELD_LINE, MARKETING_FRECHET_LINE])
    // No marginal product or single-target figure is promoted to the headline.
    expect(m.headline).not.toMatch(/\d+%/)
    expect(m.rows.every(r => r.goal.value === null)).toBe(true)
  })
})
