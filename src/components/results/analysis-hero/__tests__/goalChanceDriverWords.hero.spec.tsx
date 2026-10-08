/** C-LOST restored: every licensed own driver follows its own cell as a separate attributed line. */
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

function heroModel(): HeroChartModel {
  const data = renderHook(() => useResultsSectionData()).result.current
  const model = buildHeroModel(data)
  expect(model.kind, 'precondition: the Run builds a chart').toBe('chart')
  return model as HeroChartModel
}

function subline(): string { return heroModel().subline ?? '' }
function expectOwnDriver(id: string, words: string) {
  const lines = heroModel().goalChanceLeadLines!
  const index = lines.findIndex(line => line.id === id && line.kind === 'driver')
  expect(index).toBeGreaterThan(0)
  expect(lines[index]).toMatchObject({ id, kind: 'driver', text: words })
  expect(lines[index - 1]).toMatchObject({ id, kind: 'cell' })
  expect(lines[index - 1].text).not.toContain(words)
}

afterEach(() => resetPaulRun())

describe('WS5 — hero lead lines keep their own cells when driver claims are present', () => {
  it('precondition: the fixture has a link whose two ends the canvas labels', () => {
    expect(nodeLabel(LINK.from)).toEqual(expect.any(String))
    expect(nodeLabel(LINK.to)).toEqual(expect.any(String))
  })

  it('`each`: the own cell is not extended by the option driver', () => {
    seed(licenceRecord('each', { driver_by_option: { [ANGEL]: EXISTENCE_CLAIM } }))
    const text = subline()

    expect(text).toContain(`‘${optionLabel(ANGEL)}’: about 41% chance of meeting your goal, in this model.`)
    // C-LOST restored: the exact staging sentence follows its own cell, without extending that cell.
    expectOwnDriver(ANGEL, SENTENCE)
    expect(text.split('It rests most on')).toHaveLength(2)
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

  it('`similar`: each own driver follows its cell; shared question is asked once', () => {
    const sized = {
      quantity_id: `${LINK.from}->${LINK.to}`, kind: 'link_strength', from: LINK.from, to: LINK.to,
      side: 'low', strength: 'weaker', authored_by: 'user', user_stated_link: true,
    }
    seed(licenceRecord('similar', { similar_option_ids: [OUTREACH, ANGEL], driver_by_option: { [OUTREACH]: sized, [CONVERTIBLE]: sized } }))
    const text = subline()

    // C-LOST restored: quoted options also retain their own driver lines.
    for (const id of MODEL_ORDER) {
      expect(text).toContain(`‘${optionLabel(id)}’: about ${PCT[id as keyof typeof PCT]}% chance of meeting your goal, in this model.`)
    }
    const words = `It rests most on how strongly ‘${nodeLabel(LINK.from)}’ affects ‘${nodeLabel(LINK.to)}’, at the size you set: `
      + 'if that effect is weaker than that, the chance falls.'
    expectOwnDriver(OUTREACH, `${words} How sure are you of that size?`)
    expectOwnDriver(CONVERTIBLE, words)
    expect(text.split('How sure are you of that size?')).toHaveLength(2)
  })

  it('under a `highest` form all options keep their labelled own cells', () => {
    seed(licenceRecord('highest', { leader_option_id: CONVERTIBLE, next_option_id: ANGEL, driver_by_option: { [ANGEL]: EXISTENCE_CLAIM, [CONVERTIBLE]: EXISTENCE_CLAIM } }))
    const text = subline()
    expect(text).toContain(`‘${optionLabel(OUTREACH)}’: about 20% chance of meeting your goal, in this model.`)
    // C-LOST restored: every own driver follows its labelled cell, including headline options.
    expect(text).toContain(`‘${optionLabel(ANGEL)}’: about 41% chance of meeting your goal, in this model.`)
    expect(text).toContain(`‘${optionLabel(CONVERTIBLE)}’: about 62% chance of meeting your goal, in this model.`)
    expectOwnDriver(ANGEL, SENTENCE)
    expectOwnDriver(CONVERTIBLE, SENTENCE.replace(' Is that right?', ''))
  })
})
