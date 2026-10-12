/**
 * Recovery Batch C (UI) on the MOUNTED Results surface: `ResultsBody` mounts the hero and the option cards
 * from ONE `useResultsSectionData` result, so the licence's words and the joint must agree across both.
 * Fixture words are C CEE's own (`helpers/batchCGoalChance.ts`); the Run goes through the real mapper and parser.
 * #2747 re-scope 2 (U0, DL ruling (A)): the WinGauge is deleted; the hero rows say CEE's served faces verbatim, and no
 * win share is said anywhere on the surface.
 *
 *   2. the hero says CEE's faces verbatim, never "Chance of meeting your goal", and no win share;
 *   3. with several targets its per-option faces are the JOINT (35% / 48%), never `probability_of_goal` (60% / 70%);
 *   1. the hero's detail block says the joint's withheld line and bound, then each target on its own.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, renderHook, screen } from '@testing-library/react'
import { ResultsBody } from '../ResultsBody'
import { useResultsSectionData } from '../useResultsSectionData'
import {
  HIRING_TECH_LEAD_FACE, HIRING_TWO_DEVS_FACE, MARKETING_CONVERSION_TARGET_LINE, MARKETING_FRECHET_LINE,
  MARKETING_JOINT_WITHHELD_LINE, MARKETING_NEW_CUSTOMERS_TARGET_LINE, hiringJourney, marketingFace, marketingJourney,
  resetJourney, seedJourney,
} from './helpers/batchCGoalChance'

function mount(): void {
  const { result, unmount } = renderHook(() => useResultsSectionData())
  const data = result.current
  unmount()
  render(<ResultsBody resultsSectionData={data} tornadoData={{ rows: [], expectedOutcome: null }} onSendMessage={() => {}} expertMode={false} />)
}
/** The hero row for one option, bound by option id (identity, never by value). */
const heroRowOf = (optionId: string): HTMLElement => {
  const row = document.querySelector<HTMLElement>(`[data-testid^="hero-option-row-"][data-option-id="${optionId}"]`)
  expect(row).not.toBeNull()
  return row!
}
/** No win share in any form (#2747 re-scope 2, DL ruling (A)): no readout, no share sentence. */
const expectNoWinShareOnSurface = (): void => {
  expect(document.querySelector('[data-testid^="win-pct-"]')).toBeNull()
  expect(document.body.textContent).not.toMatch(/supported (in|by) \S+ of (simulated scenarios|runs)/i)
}

afterEach(() => { cleanup(); resetJourney() })

describe('ResultsBody: the Batch C licence, said once and alike on every mounted surface', () => {
  // #2747 re-scope 2 (U0, DL ruling (A)): was 'item 2 (hiring): the WinGauge goal block is headed in the chance words; …'.
  // The gauge's heading/aria assertions are deleted with the gauge; the hero rows now pin CEE's faces verbatim.
  it('item 2 (hiring): the hero says CEE\'s faces verbatim, no win share (55% / 40%); "your goal" appears nowhere on the surface', () => {
    seedJourney(hiringJourney())
    mount()
    expect(heroRowOf('hire_a_tech_lead')).toHaveTextContent(HIRING_TECH_LEAD_FACE)
    expect(heroRowOf('hire_two_developers')).toHaveTextContent(HIRING_TWO_DEVS_FACE)
    expectNoWinShareOnSurface()
    expect(document.body.textContent).not.toMatch(/\b55%|\b40%/)
    expect(document.body.textContent).not.toMatch(/chance of meeting your goal/i)
  })

  // #2747 re-scope 2 (U0, DL ruling (A)): was 'item 3 (marketing, joint licensed): the WinGauge rows quote the joint, …'.
  // The gauge is deleted; the hero rows are the per-option faces, quoted from CEE verbatim (the joint), never the marginal.
  it('item 3 (marketing, joint licensed): the hero rows quote CEE\'s joint faces verbatim, never the new-customers marginal', () => {
    seedJourney(marketingJourney('licensed'))
    mount()
    const manager = heroRowOf('hire_manager')
    const aiAds = heroRowOf('ai_plus_ads')
    expect(manager).toHaveTextContent(marketingFace('Hire a marketing manager', 35))
    expect(aiAds).toHaveTextContent(marketingFace('AI planning plus advertising', 48))
    expect(manager.textContent).not.toMatch(/\b60%|\b70%/)
    expect(aiAds.textContent).not.toMatch(/\b60%|\b70%/)
    expectNoWinShareOnSurface()
  })

  it('#2747 r1 B5 (stale): a Run not known to be current quotes no chance anywhere; the hero says CEE\'s line, not "unlocks"', () => {
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
    // #2747 re-scope 2 (U0, DL ruling (A)): the gauge is deleted; CEE's stale line is said by the hero rows, verbatim.
    expect(heroRowOf('hire_manager')).toHaveTextContent(RUN_AGAIN)
    expect(heroRowOf('ai_plus_ads')).toHaveTextContent(RUN_AGAIN)
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

  // #2747 re-scope 2 (U0, DL ruling (A)): was 'CONTROL (the gate opens): the matching current Run quotes 46% on WinGauge, …';
  // the gauge is deleted, so the control is the hero row saying CEE's 46% face verbatim.
  it('CONTROL (the gate opens): the matching current Run quotes CEE\'s 46% face verbatim on the hero, and the gate gives CEE\'s words', () => {
    seedJourney(hiringJourney())
    const { result, unmount } = renderHook(() => useResultsSectionData())
    const data = result.current
    unmount()
    expect(data.runView!.chanceFigureOf('hire_a_tech_lead')).toEqual({ pct: 46, words: 'about 46%' })
    render(<ResultsBody resultsSectionData={data} tornadoData={{ rows: [], expectedOutcome: null }} onSendMessage={() => {}} expertMode={false} />)
    expect(heroRowOf('hire_a_tech_lead')).toHaveTextContent(HIRING_TECH_LEAD_FACE)
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
