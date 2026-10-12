/**
 * Run-5 judge, operator finding (DL ruling, 12 Oct): capacity step 6 said "No option moved beyond ordinary run-to-run
 * variation." (the chat analysis card and the Reasoning tab's "What we have", `runDeltaSentence`) and, on the canvas
 * run summary, "Too small to tell apart from ordinary run-to-run variation." (`runChangesSummaryLines`), while the goal
 * chance moved 37% → 63%. Only the WIN SHARE was unchanged (0.87985 both Runs). Both claims are UI-composed from the
 * win-share movements. Ruling: where the pair shows a goal chance, no movement claim is read from the win share; the line
 * is omitted and no words replace it. It is kept where no goal chance is shown.
 *
 * Bodies: run 5's capacity step 6 `run_delta`, verbatim (fixtures/run5-capacity-step3-step6.json), through the real
 * reader `buildRunDeltaView`. The step-3 and step-6 faces are the served cells the pair's two sides belong to.
 */
import { describe, expect, it } from 'vitest'
import type { RunDelta } from '@talchain/schemas/boundary'
import fixture from './fixtures/run5-capacity-step3-step6.json'
import { buildRunDeltaView, pairShowsAGoalChance } from '../runDeltaView'
import { runDeltaSentence } from '../commitmentSynthesis'
import { runChangesSummaryLines } from '../../../../canvas/graphChanges/runChangesSummaryLines'

const labels = fixture.labels as Record<string, string>
const SERVED = fixture.run_delta as unknown as RunDelta
const viewOf = (delta: RunDelta) => buildRunDeltaView(delta, (id) => labels[id] ?? null)
const withGoalChances = (goal_chances: unknown): RunDelta => ({ ...SERVED, goal_chances } as unknown as RunDelta)
const withoutGoalChances = (): RunDelta => {
  const copy: Record<string, unknown> = { ...(SERVED as unknown as Record<string, unknown>) }
  delete copy.goal_chances
  return copy as unknown as RunDelta
}
const CHANGED = 'Since the last run, Additional specialists, Add one specialist changed from 1 specialists to 2 specialists.'
const NONE_MOVED = 'No option moved beyond ordinary run-to-run variation.'
const TOO_SMALL = 'Too small to tell apart from ordinary run-to-run variation.'

describe('run 5 capacity step 6: no movement claim from the win share beside a goal chance', () => {
  it('the fixture is the served pair: the chance moved 37% → 63%; the win share did not move', () => {
    expect(fixture.step3_face).toContain('about 37% chance of meeting your goal')
    expect(fixture.step6_face).toContain('about 63% chance of meeting your goal')
    const add = SERVED.goal_chances!.find((g) => g.option_id === 'add_one_specialist')!
    expect([add.prior, add.current]).toEqual([{ kind: 'point', pct: 37, rounding: 'whole' }, { kind: 'point', pct: 63, rounding: 'whole' }])
    expect(SERVED.win_probabilities.map((w) => [w.prior, w.current, w.noise_verdict]))
      .toEqual([[0.87985, 0.87985, 'within_noise'], [0.12015, 0.12015, 'within_noise']])
    expect(pairShowsAGoalChance(viewOf(SERVED))).toBe(true)
  })

  it('⭐ the chat card / Reasoning sentence says what changed, and no "No option moved…"', () => {
    const text = runDeltaSentence(viewOf(SERVED), { isStale: false })
    expect(text).toBe(CHANGED)
    expect(text).not.toMatch(/moved|run-to-run/i)
  })

  it('⭐ the canvas run summary keeps its Changed row and draws no Moved line ("Too small…" is not said)', () => {
    const lines = runChangesSummaryLines(viewOf(SERVED), false, null)
    expect(lines.changed.map((c) => c.row.subject)).toEqual(['Additional specialists, Add one specialist'])
    expect(lines.moved).toEqual([])
    expect(lines.movedNote).toBeNull()
  })

  it('CONTRAST: the chance UNCHANGED (63% → 63%) is still a shown chance, so still no win-share movement claim', () => {
    const unchanged = withGoalChances([
      { option_id: 'keep_current_staffing', prior: { kind: 'withheld' }, current: { kind: 'withheld' } },
      { option_id: 'add_one_specialist', prior: { kind: 'point', pct: 63, rounding: 'whole' }, current: { kind: 'point', pct: 63, rounding: 'whole' } },
    ])
    expect(runDeltaSentence(viewOf(unchanged), { isStale: false })).toBe(CHANGED)
    expect(runChangesSummaryLines(viewOf(unchanged), false, null).movedNote).toBeNull()
  })

  it('CONTRAST: a range on one side only is a shown chance too', () => {
    const range = withGoalChances([{ option_id: 'add_one_specialist', prior: { kind: 'withheld' },
      current: { kind: 'range', low_pct: 40, high_pct: 70, low_rounding: 'whole', high_rounding: 'nearest_5' } }])
    expect(runDeltaSentence(viewOf(range), { isStale: false })).toBe(CHANGED)
  })

  it('KEPT where no goal chance is shown: every side withheld or not recorded, or no goal_chances at all', () => {
    for (const delta of [
      withGoalChances([
        { option_id: 'keep_current_staffing', prior: { kind: 'withheld' }, current: { kind: 'withheld' } },
        { option_id: 'add_one_specialist', prior: { kind: 'withheld' }, current: { kind: 'not_recorded' } },
      ]),
      withGoalChances([]),
      withoutGoalChances(),
    ]) {
      expect(pairShowsAGoalChance(viewOf(delta))).toBe(false)
      expect(runDeltaSentence(viewOf(delta), { isStale: false })).toBe(`${CHANGED} ${NONE_MOVED}`)
      expect(runChangesSummaryLines(viewOf(delta), false, null).movedNote).toBe(TOO_SMALL)
    }
  })

  it('the same rule for a beyond-noise win-share move: beside a shown chance it is not said; with none, it is', () => {
    const moved = { ...SERVED, win_probabilities: [
      { option_id: 'add_one_specialist', prior: 0.6, current: 0.88, noise_verdict: 'signal' },
      { option_id: 'keep_current_staffing', prior: 0.4, current: 0.12, noise_verdict: 'signal' },
    ] } as unknown as RunDelta
    expect(runDeltaSentence(viewOf(moved), { isStale: false })).toBe(CHANGED)
    expect(runChangesSummaryLines(viewOf(moved), false, null).moved).toEqual([])
    const movedNoChance = { ...(moved as unknown as Record<string, unknown>), goal_chances: [] } as unknown as RunDelta
    expect(runChangesSummaryLines(viewOf(movedNoChance), false, null).moved.length).toBeGreaterThan(0)
  })
})
