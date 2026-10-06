/**
 * G4/G5 phase 2, P3 — the driver sentence REACHES THE HERO, under its own option's chance line (DL rulings 6 Oct 2026).
 *
 * `goalChanceDriverWords.spec.ts` pins the words. This file pins the wiring on Paul's served Run 4276f3f9: CEE's
 * `driver_by_option` claim on the licence record, the canvas labels the results hook supplies, and the hero's subline.
 * Placement is the ruled one: after the option's own line under the `each` form; no sentence under a `highest` form.
 *
 * Lives in the hero's own directory: `inertness.spec.ts` forbids importing the hero from anywhere else.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCanvasStore } from '../../../../canvas/store'
import { useResultsSectionData } from '../../useResultsSectionData'
import { buildHeroModel } from '../buildHeroModel'
import type { HeroChartModel } from '../heroTypes'
import { CONVERTIBLE, SCORED, SERVED_STAMP, fx, report, resetPaulRun, seedPaulRun } from '../../__tests__/helpers/paulRun4276f3f9'

const ANGEL = 'angel_bridge'
const OUTREACH = 'current_outreach'
const optionLabel = (id: string) => SCORED.find((o) => o.id === id)!.label
const MODEL_ORDER = [OUTREACH, ANGEL, CONVERTIBLE]
const PCT = { [OUTREACH]: 20, [ANGEL]: 41, [CONVERTIBLE]: 62 }
const GOAL = { [CONVERTIBLE]: 0.62, [ANGEL]: 0.41, [OUTREACH]: 0.2 }

/** A link of the Run's own model whose two ends the canvas labels. */
const nodeLabel = (id: string) => fx.draft.nodes.find((n) => n.id === id)?.label
const LINK = fx.draft.edges.find((e) => nodeLabel(e.from) && nodeLabel(e.to))!
const EXISTENCE_CLAIM = {
  quantity_id: `${LINK.from}->${LINK.to}`, kind: 'link_existence', from: LINK.from, to: LINK.to,
  side: 'absent', pct_if_side: 30, pct_if_side_rounding: 'nearest_5', authored_by: 'olumi', user_stated_link: false,
}
const SENTENCE = `It rests most on Olumi’s own assumption that ‘${nodeLabel(LINK.from)}’ affects ‘${nodeLabel(LINK.to)}’: `
  + 'in the model runs without that link, the chance is about 30%. Is that right?'

function licenceRecord(form: string, extra: Record<string, unknown> = {}) {
  return {
    code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form, option_ids: MODEL_ORDER, pct_by_option: PCT,
    target: { comparator: 'at_least', value: 1200000, unit: '£' }, ...extra,
  }
}

/** Paul's Run with a goal chance on every option, a stated target and CEE's licence record. */
function seed(licence: Record<string, unknown>) {
  seedPaulRun(SERVED_STAMP)
  const s = useCanvasStore.getState() as unknown as { results: { report: Record<string, any> }; ceeAnalysisReady: Record<string, unknown> }
  const option_probabilities = Object.fromEntries(Object.entries(report.option_probabilities).map(([id, p]) =>
    [id, { ...p, ...(GOAL[id as keyof typeof GOAL] !== undefined ? { goal_probability: GOAL[id as keyof typeof GOAL] } : {}) }]))
  const inference_warnings = [...((s.results.report.inference_warnings as unknown[]) ?? []), licence]
  useCanvasStore.setState({
    results: { ...s.results, report: { ...s.results.report, option_probabilities, inference_warnings } },
    ceeAnalysisReady: { ...s.ceeAnalysisReady, goal_threshold_raw: 1200000, goal_threshold_unit: '£' },
  } as never)
}

function subline(): string {
  const data = renderHook(() => useResultsSectionData()).result.current
  const model = buildHeroModel(data)
  expect(model.kind, 'precondition: the Run builds a chart').toBe('chart')
  return (model as HeroChartModel).subline ?? ''
}

afterEach(() => resetPaulRun())

describe('P3 — the hero says what an option’s chance rests on most, under that option’s own line', () => {
  it('precondition: the fixture has a link whose two ends the canvas labels', () => {
    expect(nodeLabel(LINK.from)).toEqual(expect.any(String))
    expect(nodeLabel(LINK.to)).toEqual(expect.any(String))
  })

  it('`each`: the sentence follows the option CEE made the claim for, and no other option', () => {
    seed(licenceRecord('each', { driver_by_option: { [ANGEL]: EXISTENCE_CLAIM } }))
    const text = subline()

    expect(text).toContain(`‘${optionLabel(ANGEL)}’: about 41% chance of meeting your goal, in this model. ${SENTENCE}`)
    expect(text.split('It rests most on')).toHaveLength(2) // once
    expect(text).toContain(`‘${optionLabel(OUTREACH)}’: about 20% chance of meeting your goal, in this model. ‘`)
  })

  it('CONTROL: the same record with no claim says nothing about what the chance rests on', () => {
    seed(licenceRecord('each'))
    const text = subline()

    expect(text).toContain(`‘${optionLabel(ANGEL)}’: about 41% chance of meeting your goal, in this model.`)
    expect(text).not.toContain('It rests most on')
  })

  it('a claim that names a node the canvas has no label for says nothing', () => {
    seed(licenceRecord('each', { driver_by_option: { [ANGEL]: { ...EXISTENCE_CLAIM, from: 'not_on_this_canvas' } } }))
    expect(subline()).not.toContain('It rests most on')
  })

  it('CEE’s "no driver" for an option says nothing', () => {
    seed(licenceRecord('each', { no_driver_by_option: { [ANGEL]: 'below_resolution', [OUTREACH]: 'correlated', [CONVERTIBLE]: 'none' } }))
    expect(subline()).not.toContain('It rests most on')
  })

  it('`similar`: an option quoted in the headline has no line, so the first option SHOWN asks about a link the user sized, not the first in the model', () => {
    const sized = {
      quantity_id: `${LINK.from}->${LINK.to}`, kind: 'link_strength', from: LINK.from, to: LINK.to,
      side: 'low', strength: 'weaker', authored_by: 'user', user_stated_link: true,
    }
    seed(licenceRecord('similar', { similar_option_ids: [OUTREACH, ANGEL], driver_by_option: { [OUTREACH]: sized, [CONVERTIBLE]: sized } }))
    const text = subline()

    expect(text).toContain(`‘${optionLabel(CONVERTIBLE)}’: about 62% chance of meeting your goal, in this model. `
      + `It rests most on how strongly ‘${nodeLabel(LINK.from)}’ affects ‘${nodeLabel(LINK.to)}’, at the size you set: `
      + 'if that effect is weaker than that, the chance falls. How sure are you of that size?')
    expect(text.split('It rests most on')).toHaveLength(2) // once: the quoted option has no line to carry one
    expect(text.split('How sure are you of that size?')).toHaveLength(2)
  })

  it('under a `highest` form there is no per-option line, so no sentence', () => {
    seed(licenceRecord('highest', { leader_option_id: CONVERTIBLE, next_option_id: ANGEL, driver_by_option: { [ANGEL]: EXISTENCE_CLAIM, [CONVERTIBLE]: EXISTENCE_CLAIM } }))
    expect(subline()).not.toContain('It rests most on')
  })
})
