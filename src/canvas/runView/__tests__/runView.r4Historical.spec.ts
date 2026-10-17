import { describe, expect, it } from 'vitest'
import { parseCanonicalAnalysisView, type CanonicalAnalysisView } from '../canonicalAnalysisView'
import { buildRunView } from '../runView'

// Synthetic selected-Run fixture, exactly the additive outbox/R4-wire-contract.md wire shape (not a staging capture).
const wire = (): CanonicalAnalysisView => ({
  schema: 'canonical_analysis_view.v1', source: 'stored_run_facts',
  run: { run_id: 'earlier-run', graph_hash_at_run: null, computed_at: '2026-10-17T18:30:00Z' },
  staleness: { stale: null, revision: 8, run_revision: 7, run_revision_source: 'recorded',
    basis: 'analysis_graph_hash_interim', reason: null,
    limitation: 'Currentness is unknown because an analysis hash is unavailable.' },
  face_when_stale: 'This earlier Run may be out of date. Run the analysis again.',
  leader_licence: 'withheld', options: [],
  historical_figures: { chance_words: 'chance of Revenue reaching £20,000/month', options: [
    { option_id: 'a', option_label: 'Recorded A', display: 'about 47%' },
    { option_id: 'b', option_label: 'Recorded B', display: 'less than 1%' },
  ] },
})
const report = { run_id: 'earlier-run', inference_warnings: [{ code: 'GOAL_CHANCE_LICENSED', form: 'each',
  target: { unit: '£/month', value: 20000, comparator: 'at_least' }, option_ids: ['a', 'b'], pct_by_option: { a: 47, b: 0 } }],
  option_probabilities: { a: { goal_probability: 0.99 }, b: { goal_probability: 0.88 }, foreign: { goal_probability: 0.77 } } }
const ctx = { goalChanceHeroSays: true, labelOf: () => 'Today’s £2m option' }
const parsed = (body: unknown) => {
  const view = parseCanonicalAnalysisView(body)
  expect(view).not.toBeNull()
  return view!
}
const oldLimitation = 'Hash equality cannot detect brief, framing or stage changes.'

describe('R4 selected Run: unknown currentness is historical, never current', () => {
  it.each(['chance of Revenue reaching £20,000/month', 'chance of Delivery capacity reaching 52 orders/day'])(
    'keeps the exact face and every option’s own historical display: %s', chance_words => {
      const body = wire()
      const historical = { ...body.historical_figures!, chance_words }
      const canonical = parsed({ ...body, historical_figures: historical })
      expect(canonical).toEqual({ ...body, historical_figures: historical })
      expect(canonical.staleness.stale).toBeNull()
      const view = buildRunView(report, canonical)
      expect(view.chancesNotCurrent()).toBe(true)
      expect(view.notCurrentLine()).toBe(body.face_when_stale)
      for (const option of historical.options) {
        expect(view.chanceCellOf(option.option_id, ctx)).toEqual({ kind: 'withheld',
          text: [body.face_when_stale, chance_words, option.option_label, option.display].join('\n') })
        expect(view.chanceFigureOf(option.option_id)).toBeNull()
        expect(view.chanceOf(option.option_id)).toEqual({ kind: 'none' })
        expect(view.servedCellOf(option.option_id)).toBeNull()
        expect(view.mainDriverOf(option.option_id)).toBeNull()
        expect(view.mainDriverDetailOf(option.option_id)).toBeNull()
      }
      expect(view.boundToCurrentCanonical()).toBe(false)
      expect(view.goalChanceRange).toBeNull()
      expect(view.goalChanceDetail()).toBeNull()
      expect(view.leaderLicence()).toBe('withheld')
      // A run-wide warning reaches even an unrelated option, but never carries another option's figure or label.
      expect(view.chanceCellOf('foreign', ctx)).toEqual({ kind: 'withheld', text: body.face_when_stale })
    })

  it('does not fill absent historical words/labels from today’s model or the held report', () => {
    const body = { ...wire(), historical_figures: { options: [{ option_id: 'a', display: 'between about 30% and 50%' }] } }
    const view = buildRunView(report, parsed(body))
    expect(view.chanceCellOf('a', ctx)).toEqual({ kind: 'withheld', text: `${body.face_when_stale}\nbetween about 30% and 50%` })
    expect(view.chanceFigureOf('a')).toBeNull()
    expect(view.chanceCellOf('b', ctx)).toEqual({ kind: 'withheld', text: body.face_when_stale })
  })

  it('shows the unknown face even when no historical figure is licensed', () => {
    const { historical_figures: _, ...body } = wire()
    const view = buildRunView(report, parsed(body))
    expect(view.notCurrentLine()).toBe(body.face_when_stale)
    expect(view.chanceCellOf('a', ctx)).toEqual({ kind: 'withheld', text: body.face_when_stale })
  })

  it('false is unchanged: only current options supply cells/figures, ignoring historical displays', () => {
    const body = wire()
    const canonical = parsed({ ...body, staleness: { ...body.staleness, stale: false, limitation: oldLimitation },
      options: [{ option_id: 'a', cell: { kind: 'figure', display: 'about 47%' }, main_driver: { kind: 'not_recorded' } }],
      historical_figures: { options: [{ option_id: 'a', display: 'about 99%' }] } })
    const view = buildRunView(report, canonical)
    expect(view.chanceCellOf('a', ctx)).toEqual({ kind: 'figure', text: 'about 47%' })
    expect(view.chanceFigureOf('a')).toEqual({ pct: 47, words: 'about 47%' })
    expect(view.boundToCurrentCanonical()).toBe(true)
    expect(view.chancesNotCurrent()).toBe(false)
    expect(view.notCurrentLine()).toBeNull()
  })

  it('true is unchanged: the served stale face alone, no current or historical figure cell', () => {
    const body = wire()
    const view = buildRunView(report, parsed({ ...body, staleness: { ...body.staleness, stale: true, limitation: oldLimitation } }))
    expect(view.chanceCellOf('a', ctx)).toEqual({ kind: 'withheld', text: body.face_when_stale })
    expect(view.notCurrentLine()).toBe(body.face_when_stale)
    expect(view.chanceFigureOf('a')).toBeNull()
  })

  it('older CEE with additive fields absent retains the existing empty unknown cell', () => {
    const { historical_figures: _, face_when_stale: __, ...body } = wire()
    const canonical = parsed({ ...body, staleness: { ...body.staleness, limitation: oldLimitation } })
    expect(canonical.historical_figures).toBeUndefined()
    const view = buildRunView(report, canonical)
    expect(view.chanceCellOf('a', ctx)).toEqual({ kind: 'none', text: null })
    expect(view.notCurrentLine()).toBeNull()
    expect(view.chanceFigureOf('a')).toBeNull()
    expect(buildRunView(report).chanceCellOf('a', ctx)).toEqual({ kind: 'withheld', text: 'Chance not shown yet' })
  })

  it('never attaches the selected Run’s history to another Run', () => {
    const view = buildRunView({ run_id: 'another-run' }, parsed(wire()))
    expect(view.chanceCellOf('a', ctx)).toEqual({ kind: 'none', text: null })
    expect(view.notCurrentLine()).toBeNull()
  })

  it('never shows a bare historical figure when the producer supplies no earlier-Run face', () => {
    const { face_when_stale: _, ...body } = wire()
    const view = buildRunView(report, parsed(body))
    expect(view.chanceCellOf('a', ctx)).toEqual({ kind: 'none', text: null })
    expect(view.chanceFigureOf('a')).toBeNull()
  })

  it.each([null, { options: '47%' }, { chance_words: 47, options: [] },
    { options: [{ option_id: 'a', display: 47 }] }, { options: [{ option_id: 'a', option_label: null, display: '47%' }] },
    { options: [{ option_id: 'a', display: '47%' }, { option_id: 'a', display: '52%' }] },
  ])('drops malformed historical evidence without dropping the earlier-Run face: %j', historical_figures => {
    const body = wire()
    const canonical = parsed({ ...body, historical_figures })
    expect(canonical.historical_figures).toBeUndefined()
    expect(buildRunView(report, canonical).chanceCellOf('a', ctx)).toEqual({ kind: 'withheld', text: body.face_when_stale })
  })
})
