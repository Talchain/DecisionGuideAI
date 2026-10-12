/**
 * Recovery Batch C (UI) on the MOUNTED Results surface: `ResultsBody` mounts the hero, the WinGauge and the option cards
 * from ONE `useResultsSectionData` result, so the licence's words and the joint must agree across all three.
 * Fixture words are C CEE's own (`helpers/batchCGoalChance.ts`); the Run goes through the real mapper and parser.
 *
 *   2. the WinGauge goal block is headed in the licence's words, never "Chance of meeting your goal";
 *   3. with several targets its per-option figures are the JOINT (35% / 48%), never `probability_of_goal` (60% / 70%);
 *   1. the hero's detail block says the joint's withheld line and bound, then each target on its own.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, renderHook, screen } from '@testing-library/react'
import { ResultsBody } from '../ResultsBody'
import { useResultsSectionData } from '../useResultsSectionData'
import {
  HIRING_WORDS, MARKETING_CONVERSION_TARGET_LINE, MARKETING_FRECHET_LINE, MARKETING_JOINT_WITHHELD_LINE,
  MARKETING_NEW_CUSTOMERS_TARGET_LINE, MARKETING_WORDS, hiringJourney, marketingJourney, resetJourney, seedJourney,
} from './helpers/batchCGoalChance'

function mount(): void {
  const { result, unmount } = renderHook(() => useResultsSectionData())
  const data = result.current
  unmount()
  render(<ResultsBody resultsSectionData={data} tornadoData={{ rows: [], expectedOutcome: null }} onSendMessage={() => {}} expertMode={false} />)
}
const capitalised = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

afterEach(() => { cleanup(); resetJourney() })

describe('ResultsBody: the Batch C licence, said once and alike on every mounted surface', () => {
  it('item 2 (hiring): the WinGauge goal block is headed in the chance words; "your goal" appears nowhere on the surface', () => {
    seedJourney(hiringJourney())
    mount()
    expect(screen.getByTestId('win-gauge-goal-heading')).toHaveTextContent(`${capitalised(HIRING_WORDS)}, in this model`)
    expect(screen.getByTestId('win-gauge-goal-block').closest('[role="figure"]'))
      .toHaveAttribute('aria-label', `${capitalised(HIRING_WORDS)}, in this model, by option`)
    expect(document.body.textContent).not.toMatch(/chance of meeting your goal/i)
  })

  it('item 3 (marketing, joint licensed): the WinGauge rows quote the joint, never the new-customers marginal', () => {
    seedJourney(marketingJourney('licensed'))
    mount()
    expect(screen.getByTestId('win-gauge-goal-heading')).toHaveTextContent(`${capitalised(MARKETING_WORDS)}, in this model`)
    expect(screen.getByTestId('goal-pct-hire_manager')).toHaveTextContent('35%')
    expect(screen.getByTestId('goal-pct-ai_plus_ads')).toHaveTextContent('48%')
    const gauge = screen.getByTestId('win-gauge-goal-block').textContent ?? ''
    expect(gauge).not.toMatch(/\b60%|\b70%/)
  })

  it('#2747 r1 B5 (stale): a Run not known to be current quotes no chance anywhere; the gauge says CEE\'s line, not "unlocks"', () => {
    const j = marketingJourney('licensed')
    const RUN_AGAIN = 'Run the analysis again to see the chance.'
    seedJourney(j, { ...j.canonical, staleness: { ...(j.canonical.staleness as object), stale: true }, face_when_stale: RUN_AGAIN })
    const { result, unmount } = renderHook(() => useResultsSectionData())
    const data = result.current
    unmount()
    // The licence still holds 35 / 48, but no surface may quote it for a stale Run.
    expect(data.runView!.chanceOf('hire_manager')).toEqual({ kind: 'none' })
    expect(data.recommendation.allOptions.every(o => o.goalProbability == null)).toBe(true)
    render(<ResultsBody resultsSectionData={data} tornadoData={{ rows: [], expectedOutcome: null }} onSendMessage={() => {}} expertMode={false} />)
    expect(screen.queryByTestId('goal-pct-hire_manager')).toBeNull()
    expect(screen.getByTestId('win-gauge-goal-not-current')).toHaveTextContent(RUN_AGAIN)
    expect(screen.queryByTestId('win-gauge-goal-producer-gap')).toBeNull()
    expect(document.body.textContent).not.toMatch(/\b35%|\b48%/)
  })

  /**
   * #2747 Codex round 2 (BLOCKING, reproduced): with the canonical authority absent or for another Run, `chanceOf` still
   * gave the licence's 46% and WinGauge said "Chance of meeting your goal… 46%" while the option's own cell withheld.
   * Re-scope (a): every figure passes the one authority gate, so no surface quotes it.
   */
  const r2Cases: ReadonlyArray<readonly [string, (j: ReturnType<typeof hiringJourney>) => Record<string, unknown> | null]> = [
    ['canonical absent', () => null],
    ['canonical for another Run', j => ({ ...j.canonical, run: { ...(j.canonical.run as object), run_id: 'run-an-older-one' } })],
  ]
  for (const [name, canonicalOf] of r2Cases) {
    it(`#2747 r2 B5 (${name}): no surface quotes the licence's 46% / 31%; WinGauge carries no goal figure`, () => {
      const j = hiringJourney()
      seedJourney(j, canonicalOf(j))
      const { result, unmount } = renderHook(() => useResultsSectionData())
      const data = result.current
      unmount()
      expect(data.runView!.chanceOf('hire_a_tech_lead')).toEqual({ kind: 'none' })
      expect(data.runView!.chanceFigureOf('hire_a_tech_lead')).toBeNull()
      expect(data.recommendation.allOptions.every(o => o.goalProbability == null)).toBe(true)
      render(<ResultsBody resultsSectionData={data} tornadoData={{ rows: [], expectedOutcome: null }} onSendMessage={() => {}} expertMode={false} />)
      expect(screen.queryByTestId('goal-pct-hire_a_tech_lead')).toBeNull()
      expect(screen.queryByTestId('goal-pct-hire_two_developers')).toBeNull()
      expect(document.body.textContent).not.toMatch(/\b46%|\b31%/)
    })
  }

  it('CONTROL (the gate opens): the matching current Run quotes 46% on WinGauge, and the gate gives CEE\'s words', () => {
    seedJourney(hiringJourney())
    const { result, unmount } = renderHook(() => useResultsSectionData())
    const data = result.current
    unmount()
    expect(data.runView!.chanceFigureOf('hire_a_tech_lead')).toEqual({ pct: 46, words: 'about 46%' })
    render(<ResultsBody resultsSectionData={data} tornadoData={{ rows: [], expectedOutcome: null }} onSendMessage={() => {}} expertMode={false} />)
    expect(screen.getByTestId('goal-pct-hire_a_tech_lead')).toHaveTextContent('46%')
  })

  it('item 1 (marketing, joint withheld): the hero says the withheld line, the bound, then each target, once on the surface', () => {
    seedJourney(marketingJourney('withheld'))
    mount()
    const said = [...screen.getByTestId('hero-goal-chance-detail').querySelectorAll('p')].map(p => p.textContent)
    expect(said.slice(0, 4)).toEqual([MARKETING_JOINT_WITHHELD_LINE, MARKETING_FRECHET_LINE,
      MARKETING_NEW_CUSTOMERS_TARGET_LINE, MARKETING_CONVERSION_TARGET_LINE])
    expect(screen.getAllByText(MARKETING_CONVERSION_TARGET_LINE)).toHaveLength(1)
    // No WinGauge goal figure for a withheld joint.
    expect(screen.queryByTestId('goal-pct-hire_manager')).toBeNull()
  })
})
