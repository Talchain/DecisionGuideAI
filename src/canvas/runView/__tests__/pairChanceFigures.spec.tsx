/**
 * `pairChanceFigures` (DL ruling, 20 Oct 2026): this run's side ONLY from `chanceFigureOf`; the earlier run's side ONLY
 * from run_delta's own licensed point or range; a withheld side shows nothing; the leader ONLY under CEE's licence.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { pairChanceFigures, runViewOf, type RunView } from '../runView'
import { PairChanceSlope, PAIR_CHANCE_SLOPE_TESTID } from '../../compare-tab/PairChanceSlope'
import type { RunDeltaGoalChanceRow } from '../../../components/results/analysisNew/runDeltaView'
import { goalChanceHeadline } from '../../compare-tab/goalChanceHeadline'

const point = (n: number) => ({ kind: 'point' as const, pct: n, rounding: 'whole' as const })
const rows: RunDeltaGoalChanceRow[] = [
  { optionId: 'a', label: 'Raise prices', prior: point(41), current: point(58) },
  { optionId: 'b', label: 'Cut waste', prior: { kind: 'range', low_pct: 30, high_pct: 40, low_rounding: 'whole', high_rounding: 'whole' } as never, current: point(44) },
  { optionId: 'c', label: 'Open a café', prior: { kind: 'withheld' } as never, current: point(21) },
  { optionId: 'd', label: 'Neither side', prior: { kind: 'withheld' } as never, current: { kind: 'withheld' } as never },
]

type Goal = { form?: string; leader?: string | null; licenceLeader?: string | null; similar?: string[]; current?: boolean; ranges?: Record<string, { lowPct: number; highPct: number }>; faces?: Record<string, string>; chanceWords?: string }
/** This run's canonical figures, keyed by option (the ONLY source for "this run"), and CEE's goal-chance facts. */
function viewWith(now: Record<string, { pct: number; words: string }>, goal: Goal = {}, comparative?: { licence: string; id: string | null }): RunView {
  const base = runViewOf(null)
  return {
    ...base,
    chanceFigureOf: (id: string) => now[id] ?? null,
    leaderLicence: () => (comparative ? comparative.licence : null) as never,
    leaderOptionId: () => (comparative ? comparative.id : undefined),
    // The served licence: its form and, for a highest form, its own leader (defaults to CEE's canonical leader).
    goalChance: (goal.form ? { form: goal.form, leaderOptionId: goal.licenceLeader !== undefined ? goal.licenceLeader : goal.leader ?? null } : null) as never,
    goalChanceDetail: () => (goal.chanceWords ? { chance_words: goal.chanceWords } : null),
    goalChanceLeaderOf: () => goal.leader ?? null,
    goalChanceSimilarOf: () => goal.similar ?? [],
    boundToCurrentCanonical: () => goal.current ?? true,
    chancesNotCurrent: () => false,
    goalChanceRange: (goal.ranges ? { optionIds: Object.keys(goal.ranges), rangeByOption: goal.ranges, horizonLine: null } : null) as never,
    servedCellOf: (id: string) => (goal.faces?.[id] !== undefined ? { kind: 'withheld', face: goal.faces[id], reasons: [] } : null),
  }
}

describe('pairChanceFigures — the chance gate for a run pair', () => {
  it("an option with no figure keeps its row in CEE's own words, never a mark (contrast: without a served face it is dropped)", () => {
    const now = { a: { pct: 58, words: 'about 58%' } }
    const out = pairChanceFigures({ goalChances: rows }, viewWith(now, { faces: { d: 'No change, by assumption' } }))
    const d = out.rows.find(r => r.optionId === 'd')
    expect(d).toEqual({ optionId: 'd', label: 'Neither side', earlier: null, now: null, note: 'No change, by assumption' })
    expect(pairChanceFigures({ goalChances: rows }, viewWith(now)).rows.find(r => r.optionId === 'd')).toBeUndefined()
    render(<PairChanceSlope figures={out} />)
    const li = screen.getByTestId(PAIR_CHANCE_SLOPE_TESTID).querySelector('[data-option-id="d"]')!
    expect(li.textContent).toBe('Neither sideNo change, by assumption')
    expect(li.querySelector('[data-mark]')).toBeNull()
  })

  it('words alone are no chart: with no figure on either run, no rows (the face does not open the chart)', () => {
    const onlyD = rows.filter(r => r.optionId === 'd')
    expect(pairChanceFigures({ goalChances: onlyD }, viewWith({}, { faces: { d: 'No change, by assumption' } })).rows).toEqual([])
  })

  it("this run's side comes ONLY from chanceFigureOf, never from run_delta's current side", () => {
    const out = pairChanceFigures({ goalChances: rows }, viewWith({ a: { pct: 58, words: 'about 58%' } }))
    const byId = Object.fromEntries(out.rows.map(r => [r.optionId, r]))
    expect(byId.a.now?.words).toBe('about 58%')
    // Discriminator: run_delta says 44 for b and 21 for c this run, but the canonical view licenses neither.
    expect(byId.b.now).toBeNull()
    expect(byId.c).toBeUndefined()
  })

  it("the earlier side is run_delta's own licensed point or range, worded by the screen's rule", () => {
    const out = pairChanceFigures({ goalChances: rows }, viewWith({ a: { pct: 58, words: 'about 58%' }, c: { pct: 21, words: 'about 21%' } }))
    const byId = Object.fromEntries(out.rows.map(r => [r.optionId, r]))
    expect(byId.a.earlier?.words).toBe('about 41%')
    expect(byId.b.earlier?.words).toBe('between about 30% and 40%')
    expect(byId.c.earlier).toBeNull()
    expect(byId.c.now?.words).toBe('about 21%')
    expect(byId.d).toBeUndefined()
  })

  it("the claim is CEE's GOAL-CHANCE leader, never the comparative leader (the most runs supported)", () => {
    const now = { a: { pct: 58, words: 'about 58%' } }
    // Discriminator: CEE's comparative leader is b (permitted); its goal-chance leader is a.
    const both = pairChanceFigures({ goalChances: rows }, viewWith(now, { form: 'highest', leader: 'a' }, { licence: 'permitted', id: 'b' }))
    expect(both.claim).toEqual({ kind: 'highest', optionId: 'a' })
    // Comparative leader alone → no goal-chance claim at all.
    expect(pairChanceFigures({ goalChances: rows }, viewWith(now, {}, { licence: 'permitted', id: 'b' })).claim).toBeNull()
    // A goal leader on a form that names none, or on a Run not known to be current → no claim.
    expect(pairChanceFigures({ goalChances: rows }, viewWith(now, { form: 'each', leader: 'a' })).claim).toBeNull()
    expect(pairChanceFigures({ goalChances: rows }, viewWith(now, { form: 'highest', leader: 'a', current: false })).claim).toBeNull()
    // DL 21 Oct: only a highest form is worded, and only for the licence's own leader; similar / all-miss carry no claim.
    expect(pairChanceFigures({ goalChances: rows }, viewWith(now, { form: 'similar', similar: ['a', 'b'] })).claim).toBeNull()
    expect(pairChanceFigures({ goalChances: rows }, viewWith(now, { form: 'all_likely_to_miss' })).claim).toBeNull()
    expect(pairChanceFigures({ goalChances: rows }, viewWith(now, { form: 'highest', leader: 'a', licenceLeader: 'b' })).claim).toBeNull()
  })

  it("not current (stale, another run, or none) → no figure on EITHER side and no claim; the pair is flagged (contrast: current)", () => {
    const now = { a: { pct: 58, words: 'about 58%' } }
    const stale = pairChanceFigures({ goalChances: rows }, viewWith(now, { form: 'highest', leader: 'a', current: false }))
    expect(stale).toEqual({ rows: [], claim: null, chanceWords: null, notCurrent: true })
    const fresh = pairChanceFigures({ goalChances: rows }, viewWith(now, { form: 'highest', leader: 'a' }))
    expect(fresh.notCurrent).toBe(false)
    expect(fresh.rows.find(r => r.optionId === 'a')?.earlier?.words).toBe('about 41%')
  })

  it("the caption is CEE's served chance_words, or none", () => {
    const now = { a: { pct: 58, words: 'about 58%' } }
    const words = 'chance of ‘Weekly orders’ being at least 150 a week'
    expect(pairChanceFigures({ goalChances: rows }, viewWith(now, { chanceWords: words })).chanceWords).toBe(words)
    expect(pairChanceFigures({ goalChances: rows }, viewWith(now)).chanceWords).toBeNull()
  })

  it("this run's RANGE comes from the gate's matched goalChanceRange, said as a range, never a point", () => {
    const out = pairChanceFigures({ goalChances: rows }, viewWith({}, { ranges: { b: { lowPct: 0, highPct: 23 } } }))
    const b = out.rows.find(r => r.optionId === 'b')
    expect(b?.now).toEqual({ kind: 'range', words: 'between less than 1% and 23%', scaleLow: 0, scaleHigh: 23 })
    // A point figure still wins where the canonical cell is a figure; an option with neither stays not shown.
    const both = pairChanceFigures({ goalChances: rows }, viewWith({ b: { pct: 44, words: 'about 44%' } }, { ranges: { b: { lowPct: 0, highPct: 23 } } }))
    expect(both.rows.find(r => r.optionId === 'b')?.now?.words).toBe('about 44%')
    expect(out.rows.find(r => r.optionId === 'a')?.now).toBeNull()
  })

  it('no goal chances on the pair (or a framing change) → no rows', () => {
    expect(pairChanceFigures({}, viewWith({})).rows).toEqual([])
  })
})

describe('PairChanceSlope draws only what the gate returned', () => {
  it('says each side in the gate\'s words, marks only the CEE leader, and computes no difference', () => {
    const figures = pairChanceFigures({ goalChances: rows }, viewWith({ a: { pct: 58, words: 'about 58%' }, c: { pct: 21, words: 'about 21%' } }, { form: 'highest', leader: 'a' }))
    render(<PairChanceSlope figures={figures} />)
    const chart = screen.getByTestId(PAIR_CHANCE_SLOPE_TESTID)
    const text = chart.textContent ?? ''
    expect(text).toContain('Earlier run')
    expect(text).toContain('This run')
    expect(text).toContain('Raise prices: earlier run about 41%, this run about 58%')
    expect(text).toContain('Cut waste: earlier run between about 30% and 40%, this run not shown')
    expect(text).not.toMatch(/\+\d|\b17\b|points?\b|best|winner|recommend/i)
    expect(chart.querySelectorAll('[data-goal-chance-leader="true"]')).toHaveLength(1)
    expect(chart.querySelector('[data-goal-chance-leader="true"]')?.getAttribute('data-option-id')).toBe('a')
  })

  it('renders nothing when the gate returned no rows', () => {
    const { container } = render(<PairChanceSlope figures={{ rows: [], claim: null, chanceWords: null, notCurrent: false }} />)
    expect(container.innerHTML).toBe('')
  })
})

describe("goalChanceHeadline says CEE's goal-chance claim, in the gate's words", () => {
  const label = (id: string) => ({ a: 'Raise prices', b: 'Cut waste', c: 'Open a café' } as Record<string, string>)[id] ?? null
  const now = { a: { pct: 58, words: 'about 58%' }, c: { pct: 21, words: 'about 21%' } }
  const say = (goal: Goal) => goalChanceHeadline(pairChanceFigures({ goalChances: rows }, viewWith(now, goal)), label)

  it('highest: names the option, with its chance on each side', () => {
    expect(say({ form: 'highest', leader: 'a' })).toBe('In this model, Raise prices is the most likely to meet your goal: about 41% on the earlier run, about 58% on this run')
  })
  it('highest with only this run shown: no earlier figure is invented', () => {
    expect(say({ form: 'highest', leader: 'c' })).toBe('In this model, Open a café is the most likely to meet your goal (about 21% on this run)')
  })
  it('every option likely to miss, with the highest named', () => {
    expect(say({ form: 'highest_all_likely_to_miss', leader: 'a' })).toBe('In this model, every option is likely to miss your goal; Raise prices has the highest chance: about 41% on the earlier run, about 58% on this run')
  })
  it('similar and all-likely-to-miss have no UI sentence (DL 12 and 21 Oct: CEE\'s words or none)', () => {
    expect(say({ form: 'similar', similar: ['a', 'b', 'c'] })).toBeNull()
    expect(say({ form: 'all_likely_to_miss' })).toBeNull()
  })
  it('no goal-chance claim → null, so the existing headline stands; and never "best", "still" or a difference', () => {
    expect(say({})).toBeNull()
    for (const goal of [{ form: 'highest', leader: 'a' }, { form: 'highest_all_likely_to_miss', leader: 'a' }]) {
      expect(say(goal)).not.toMatch(/best|winner|recommend|still|changed|\+\d|points?\b/i)
    }
  })
})
