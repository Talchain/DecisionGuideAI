/**
 * ⭐ D3 MILESTONE 1, STEP 2 — EACH OPTION'S CHANCE OF MEETING THE GOAL IS THE HERO HEADLINE WHEN CEE LICENSED IT
 * (DL 0df0e1 #87 6005048156 / 6006078553; Science d5 6005279728 / 6005640764; Wording c6 6005196947 + 6 Oct rulings).
 *
 * Replayed on Paul's served Run 4276f3f9, whose win-share leader was WITHHELD (exploratory): the goal chance has its OWN
 * licence (CEE's `GOAL_CHANCE_LICENSED` record), so it heads the hero even there. The UI renders the form CEE chose, by
 * identity; it compares no number. Rows: H1 (`highest`), `each` (lines in the MODEL's order, never ranked), the CONTROL
 * with no record (the hero says what it said before), and a record that disagrees with itself (not read).
 *
 * Lives in the hero's own directory: `inertness.spec.ts` forbids importing the hero from anywhere else.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCanvasStore } from '../../../../canvas/store'
import { useResultsSectionData } from '../../useResultsSectionData'
import { buildHeroModel } from '../buildHeroModel'
import type { HeroChartModel } from '../heroTypes'
import { CONVERTIBLE, CONVERTIBLE_LABEL, SCORED, SERVED_STAMP, report, resetPaulRun, seedPaulRun } from '../../__tests__/helpers/paulRun4276f3f9'

const ANGEL = 'angel_bridge'
const OUTREACH = 'current_outreach'
const labelOf = (id: string) => SCORED.find((o) => o.id === id)!.label
/** The model's option order, as CEE's records carry it (the fixture's own order). */
const MODEL_ORDER = [OUTREACH, ANGEL, CONVERTIBLE]

function licenceRecord(form: string, pct: Record<string, number>, extra: Record<string, unknown> = {}) {
  return {
    code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form, option_ids: MODEL_ORDER, pct_by_option: pct,
    target: { comparator: 'at_least', value: 1200000, unit: '£' }, ...extra,
  }
}

/** Paul's Run with a goal chance on every option, a stated target, and (optionally) CEE's licence record. */
function seed(goal: Record<string, number>, licence: Record<string, unknown> | null) {
  seedPaulRun(SERVED_STAMP)
  const s = useCanvasStore.getState() as unknown as { results: { report: Record<string, any> }; ceeAnalysisReady: Record<string, unknown> }
  const option_probabilities = Object.fromEntries(Object.entries(report.option_probabilities).map(([id, p]) =>
    [id, { ...p, ...(goal[id] !== undefined ? { goal_probability: goal[id] } : {}) }]))
  const inference_warnings = [...((s.results.report.inference_warnings as unknown[]) ?? []), ...(licence ? [licence] : [])]
  useCanvasStore.setState({
    results: { ...s.results, report: { ...s.results.report, option_probabilities, inference_warnings } },
    ceeAnalysisReady: { ...s.ceeAnalysisReady, goal_threshold_raw: 1200000, goal_threshold_unit: '£' },
  } as never)
}

function heroModel(): HeroChartModel {
  const data = renderHook(() => useResultsSectionData()).result.current
  const model = buildHeroModel(data)
  expect(model.kind, 'precondition: the Run builds a chart').toBe('chart')
  return model as HeroChartModel
}

afterEach(() => resetPaulRun())

const GOAL = { [CONVERTIBLE]: 0.62, [ANGEL]: 0.41, [OUTREACH]: 0.2 }
const FORBIDDEN = /chance of (success|reaching|hitting|target|achieving)|likely to reach target|probability of (success|reaching|hitting|meeting)/i
const CONTEST = /\bwinners?\b|\bleads\b|\bahead\b|\bbest\b|recommend|scored highest/i

describe('D3 step 2 — the goal chance heads the hero on its OWN licence (CEE decides; the UI renders by identity)', () => {
  it('H1 on a WITHHELD win-share Run: CEE licensed "highest" → c6\'s sentence, the stated target, CEE\'s figures', () => {
    seed(GOAL, licenceRecord('highest', { [OUTREACH]: 20, [ANGEL]: 41, [CONVERTIBLE]: 62 }, { leader_option_id: CONVERTIBLE, next_option_id: ANGEL }))
    const model = heroModel()
    expect(model.headline).toBe(
      `In this model, on current information, ‘${CONVERTIBLE_LABEL}’ has the highest chance of meeting your goal (at least £1,200,000): `
      + `about 62%, against about 41% for ‘${labelOf(ANGEL)}’.`,
    )
    expect(model.headline).not.toMatch(FORBIDDEN)
    expect(model.headline).not.toMatch(CONTEST)
  })

  it('CONTROL: the same figures with NO licence record → no goal-chance sentence (the hero says what it said before)', () => {
    seed(GOAL, null)
    expect(heroModel().headline).not.toMatch(/chance of meeting your goal/)
  })

  it('EACH (no superlative): the headline ends in a colon and the lines follow in the MODEL\'s order, never ranked by chance', () => {
    seed(GOAL, licenceRecord('each', { [OUTREACH]: 20, [ANGEL]: 41, [CONVERTIBLE]: 62 }))
    const model = heroModel()
    expect(model.headline).toBe('In this model, on current information, each option’s chance of meeting your goal (at least £1,200,000):')
    expect(model.subline).toBe(MODEL_ORDER.map((id) => `‘${labelOf(id)}’: about ${({ [OUTREACH]: 20, [ANGEL]: 41, [CONVERTIBLE]: 62 } as Record<string, number>)[id]}% chance of meeting your goal, in this model.`).join(' '))
    expect(model.subline).not.toMatch(CONTEST)
  })

  it('H2 (DL 0df0e1 6 Oct; Rehearsal12 48 / 43 / <1; c6 "similar"): in the MODEL\'s order; the rest as lines, <1% as c6 says', () => {
    seed({ [OUTREACH]: 0.004, [ANGEL]: 0.43, [CONVERTIBLE]: 0.48 },
      licenceRecord('about_the_same', { [OUTREACH]: 0, [ANGEL]: 43, [CONVERTIBLE]: 48 }, { same_option_ids: [ANGEL, CONVERTIBLE] }))
    const model = heroModel()
    expect(model.headline).toBe(`In this model, on current information, ‘${labelOf(ANGEL)}’ and ‘${CONVERTIBLE_LABEL}’ have similar `
      + 'chances of meeting your goal (at least £1,200,000): about 43% and about 48%.')
    expect(model.headline).not.toMatch(CONTEST)
    expect(model.headline).not.toMatch(/highest|most likely|strongest/i)
    expect(model.subline).toBe(`‘${labelOf(OUTREACH)}’: less than 1% chance of meeting your goal, in this model.`)
    expect(`${model.headline} ${model.subline}`).not.toMatch(/about the same|about 0%|about 100%/)
  })

  it('PER OPTION (d5 #87 6007421281; c6 6 Oct): one option withheld for its own path keeps its place with c6\'s withheld line', () => {
    const { [ANGEL]: _withheld, ...rest } = GOAL
    seed(rest, licenceRecord('each', { [OUTREACH]: 20, [CONVERTIBLE]: 62 }, { withheld_option_ids: [ANGEL] }))
    const model = heroModel()
    expect(model.headline).toBe('In this model, on current information, each option’s chance of meeting your goal (at least £1,200,000):')
    expect(model.subline).toBe([
      `‘${labelOf(OUTREACH)}’: about 20% chance of meeting your goal, in this model.`,
      `‘${labelOf(ANGEL)}’: Olumi can’t yet say its chance of meeting your goal, in this model.`,
      `‘${labelOf(CONVERTIBLE)}’: about 62% chance of meeting your goal, in this model.`,
    ].join(' '))
    expect(model.subline).not.toMatch(/unknown|\b0%/)
  })

  it('a record naming a withheld option under a SUPERLATIVE disagrees with itself: not read', () => {
    seed(GOAL, licenceRecord('highest', { [OUTREACH]: 20, [CONVERTIBLE]: 62 },
      { withheld_option_ids: [ANGEL], leader_option_id: CONVERTIBLE, next_option_id: OUTREACH }))
    expect(heroModel().headline).not.toMatch(/chance of meeting your goal/)
  })

  it('a record that disagrees with itself ("highest" naming no option) is not read: no goal-chance sentence', () => {
    seed(GOAL, licenceRecord('highest', { [OUTREACH]: 20, [ANGEL]: 41, [CONVERTIBLE]: 62 }))
    expect(heroModel().headline).not.toMatch(/chance of meeting your goal/)
  })
})
