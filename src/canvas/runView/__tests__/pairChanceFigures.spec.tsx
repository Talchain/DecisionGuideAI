/**
 * `pairChanceFigures` (DL ruling, 20 Oct 2026): this run's side ONLY from `chanceFigureOf`; the earlier run's side ONLY
 * from run_delta's own licensed point or range; a withheld side shows nothing; the leader ONLY under CEE's licence.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { pairChanceFigures, runViewOf, type RunView } from '../runView'
import { PairChanceSlope, PAIR_CHANCE_SLOPE_TESTID } from '../../compare-tab/PairChanceSlope'
import type { RunDeltaGoalChanceRow } from '../../../components/results/analysisNew/runDeltaView'

const point = (n: number) => ({ kind: 'point' as const, pct: n, rounding: 'whole' as const })
const rows: RunDeltaGoalChanceRow[] = [
  { optionId: 'a', label: 'Raise prices', prior: point(41), current: point(58) },
  { optionId: 'b', label: 'Cut waste', prior: { kind: 'range', low_pct: 30, high_pct: 40, low_rounding: 'whole', high_rounding: 'whole' } as never, current: point(44) },
  { optionId: 'c', label: 'Open a café', prior: { kind: 'withheld' } as never, current: point(21) },
  { optionId: 'd', label: 'Neither side', prior: { kind: 'withheld' } as never, current: { kind: 'withheld' } as never },
]

/** This run's canonical figures, keyed by option: the ONLY source the gate may use for "this run". */
function viewWith(now: Record<string, { pct: number; words: string }>, leader?: { licence: string; id: string | null }): RunView {
  const base = runViewOf(null)
  return {
    ...base,
    chanceFigureOf: (id: string) => now[id] ?? null,
    leaderLicence: () => (leader ? leader.licence : null) as never,
    leaderOptionId: () => (leader ? leader.id : undefined),
  }
}

describe('pairChanceFigures — the chance gate for a run pair', () => {
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

  it('names a leader ONLY under a positive CEE licence with an id', () => {
    const now = { a: { pct: 58, words: 'about 58%' } }
    expect(pairChanceFigures({ goalChances: rows }, viewWith(now, { licence: 'permitted', id: 'a' })).leaderOptionId).toBe('a')
    expect(pairChanceFigures({ goalChances: rows }, viewWith(now, { licence: 'withheld', id: 'a' })).leaderOptionId).toBeNull()
    expect(pairChanceFigures({ goalChances: rows }, viewWith(now, { licence: 'permitted', id: null })).leaderOptionId).toBeNull()
    expect(pairChanceFigures({ goalChances: rows }, viewWith(now)).leaderOptionId).toBeNull()
  })

  it('no goal chances on the pair (or a framing change) → no rows', () => {
    expect(pairChanceFigures({}, viewWith({})).rows).toEqual([])
  })
})

describe('PairChanceSlope draws only what the gate returned', () => {
  it('says each side in the gate\'s words, marks only the CEE leader, and computes no difference', () => {
    const figures = pairChanceFigures({ goalChances: rows }, viewWith({ a: { pct: 58, words: 'about 58%' }, c: { pct: 21, words: 'about 21%' } }, { licence: 'permitted', id: 'a' }))
    render(<PairChanceSlope figures={figures} />)
    const chart = screen.getByTestId(PAIR_CHANCE_SLOPE_TESTID)
    const text = chart.textContent ?? ''
    expect(text).toContain('Earlier run')
    expect(text).toContain('This run')
    expect(text).toContain('Raise prices: earlier run about 41%, this run about 58%.')
    expect(text).toContain('Cut waste: earlier run between about 30% and 40%, this run not shown.')
    expect(text).not.toMatch(/\+\d|\b17\b|points?\b|best|winner|recommend/i)
    expect(chart.querySelectorAll('[data-cee-leader="true"]')).toHaveLength(1)
    expect(chart.querySelector('[data-cee-leader="true"]')?.getAttribute('data-option-id')).toBe('a')
  })

  it('renders nothing when the gate returned no rows', () => {
    const { container } = render(<PairChanceSlope figures={{ rows: [], leaderOptionId: null }} />)
    expect(container.innerHTML).toBe('')
  })
})
