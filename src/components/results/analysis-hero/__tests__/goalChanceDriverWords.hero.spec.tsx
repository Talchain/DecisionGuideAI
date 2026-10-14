import { canonicalTestCellsOf } from './helpers/canonicalTestCells'
/**
 * C-LOST restored: every licensed own driver follows its own cell as a separate attributed line.
 *
 * #2747 re-scope 2 (U0): the line is CEE's own sentence (`main_driver.detail`, `RunView.mainDriverDetailOf`), verbatim;
 * the UI's driver composer is deleted, so a canonical driver CEE gave no `detail` says nothing.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCanvasStore } from '../../../../canvas/store'
import { useResultsSectionData } from '../../useResultsSectionData'
import { buildHeroModel } from '../buildHeroModel'
import { runViewFromParts } from '../../../../canvas/runView/runView'
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
/** CEE's served `main_driver.detail` for EXISTENCE_CLAIM (the staging sentence; SELF-AUTHORED here, not a capture). */
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

/**
 * The hook's data held with its self-authored current canonical view (as `withCanonicalTestCells`), with CEE's served
 * `main_driver.detail` on the named options' drivers (#2747 re-scope 2: the only words a driver line may say).
 */
function heroData(details: Readonly<Record<string, string>> = {}) {
  const data = renderHook(() => useResultsSectionData()).result.current
  const canonical = canonicalTestCellsOf(data)
  const view = runViewFromParts({ run_id: 'synthetic-ui-fixture' }, data.goalChanceLicence ?? data.runView?.goalChance ?? null,
    data.goalChanceRange ?? data.runView?.goalChanceRange ?? null, {
      ...canonical,
      options: canonical.options.map(o => o.main_driver.kind === 'available' && details[o.option_id] !== undefined
        ? { ...o, main_driver: { ...o.main_driver, detail: details[o.option_id] } } : o),
    })
  return { ...data, runView: view, goalChanceRange: view.goalChanceRange }
}
function heroModel(details: Readonly<Record<string, string>> = {}): HeroChartModel {
  const model = buildHeroModel(heroData(details))
  expect(model.kind, 'precondition: the Run builds a chart').toBe('chart')
  return model as HeroChartModel
}

function subline(details: Readonly<Record<string, string>> = {}): string { return heroModel(details).subline ?? '' }
function expectOwnDriver(id: string, words: string, details: Readonly<Record<string, string>>) {
  const lines = heroModel(details).goalChanceLeadLines!
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
    const served = { [ANGEL]: SENTENCE }
    const text = subline(served)

    expect(text).toContain(`‘${optionLabel(ANGEL)}’: about 41% chance of meeting your goal, in this model.`)
    // C-LOST restored: the exact staging sentence follows its own cell, without extending that cell.
    // #2747 re-scope 2 (U0): it is CEE's served `main_driver.detail`, verbatim.
    expectOwnDriver(ANGEL, SENTENCE, served)
    expect(text.split('It rests most on')).toHaveLength(2)
    expect(text).toContain(`‘${optionLabel(OUTREACH)}’: about 20% chance of meeting your goal, in this model. ‘`)
  })

  // #2747 re-scope 2 (U0): the UI composes no driver sentence. The same claim, current on the canonical view, with no
  // served `detail`, says nothing (was: the UI worded the claim itself).
  it('a canonical driver CEE gave no detail says nothing (no UI-composed driver words)', () => {
    seed(licenceRecord('each', { driver_by_option: { [ANGEL]: EXISTENCE_CLAIM } }))
    const data = heroData()
    // CONTROL: the driver IS on the current canonical view; only its sentence is absent.
    expect(data.runView.mainDriverOf(ANGEL)).not.toBeNull()
    expect(data.runView.mainDriverDetailOf(ANGEL)).toBeNull()
    const model = buildHeroModel(data)
    expect(model.kind).toBe('chart')
    const chart = model as HeroChartModel
    expect(chart.goalChanceLeadLines!.filter(line => line.kind === 'driver')).toEqual([])
    expect(chart.subline).toContain(`‘${optionLabel(ANGEL)}’: about 41% chance of meeting your goal, in this model.`)
    expect(chart.subline).not.toMatch(/It rests most on|the chance falls|the chance is about/)
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

  // #2747 re-scope 2 (U0): CEE now words each driver and asks a shared question once (its own sentences); the hero says
  // each option's served sentence verbatim and adds no question of its own (was: the UI composed and de-duplicated).
  it('`similar`: each own driver follows its cell, CEE’s sentence verbatim; the hero adds no question of its own', () => {
    const sized = {
      quantity_id: `${LINK.from}->${LINK.to}`, kind: 'link_strength', from: LINK.from, to: LINK.to,
      side: 'low', strength: 'weaker', authored_by: 'user', user_stated_link: true,
    }
    seed(licenceRecord('similar', { similar_option_ids: [OUTREACH, ANGEL], driver_by_option: { [OUTREACH]: sized, [CONVERTIBLE]: sized } }))
    const words = `It rests most on how strongly ‘${nodeLabel(LINK.from)}’ affects ‘${nodeLabel(LINK.to)}’, at the size you set: `
      + 'if that effect is weaker than that, the chance falls.'
    const served = { [OUTREACH]: `${words} How sure are you of that size?`, [CONVERTIBLE]: words }
    const text = subline(served)

    // C-LOST restored: quoted options also retain their own driver lines.
    for (const id of MODEL_ORDER) {
      expect(text).toContain(`‘${optionLabel(id)}’: about ${PCT[id as keyof typeof PCT]}% chance of meeting your goal, in this model.`)
    }
    expectOwnDriver(OUTREACH, served[OUTREACH], served)
    expectOwnDriver(CONVERTIBLE, served[CONVERTIBLE], served)
    expect(text.split('How sure are you of that size?')).toHaveLength(2)
  })

  it('under a `highest` form all options keep their labelled own cells', () => {
    seed(licenceRecord('highest', { leader_option_id: CONVERTIBLE, next_option_id: ANGEL, driver_by_option: { [ANGEL]: EXISTENCE_CLAIM, [CONVERTIBLE]: EXISTENCE_CLAIM } }))
    // #2747 re-scope 2 (U0): each driver line is that option's served `main_driver.detail`, verbatim.
    const served = { [ANGEL]: SENTENCE, [CONVERTIBLE]: SENTENCE.replace(' Is that right?', '') }
    const text = subline(served)
    expect(text).toContain(`‘${optionLabel(OUTREACH)}’: about 20% chance of meeting your goal, in this model.`)
    // C-LOST restored: every own driver follows its labelled cell, including headline options.
    expect(text).toContain(`‘${optionLabel(ANGEL)}’: about 41% chance of meeting your goal, in this model.`)
    expect(text).toContain(`‘${optionLabel(CONVERTIBLE)}’: about 62% chance of meeting your goal, in this model.`)
    expectOwnDriver(ANGEL, served[ANGEL], served)
    expectOwnDriver(CONVERTIBLE, served[CONVERTIBLE], served)
  })
})
