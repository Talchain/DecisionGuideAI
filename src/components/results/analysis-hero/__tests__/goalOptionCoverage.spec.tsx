import { HERO_COPY } from '../heroCopy'
import { chanceCellOf } from './helpers/chanceCellOf'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AnalysisHeroContainer } from '../AnalysisHeroContainer'
import { buildHeroModel } from '../buildHeroModel'
import { makeHeroData, makeOption } from '../__fixtures__/hero.fixtures'
import { GOAL_IDENTITY_WITHHELD_FALLBACK, readGoalIdentityWithheld } from '../../utils/goalIdentityWithheld'
import { readGoalChanceRange } from '../../utils/goalChanceRange'
import { readGoalChanceLicence } from '../../utils/goalChanceLicence'
import t1b from './fixtures/served-t1b-f440be4a-goal-chance-records.json'
import unseen1 from './fixtures/s4ui/unseen-1.turn.json'
import unseen2 from './fixtures/s4ui/unseen-2.turn.json'
import captured1 from './fixtures/s4ui/unseen-1.hero.json'
import captured2 from './fixtures/s4ui/unseen-2.hero.json'
import noFiguresMarkup from './fixtures/s4ui/no-figures.base.html?raw'
import pointsMarkup from './fixtures/s4ui/points.base.html?raw'
import unresolvedMarkup from './fixtures/s4ui/unresolved.base.html?raw'

// Stabilise React's opaque accessibility IDs to the base replay's fresh-root
// sequence. All attributes and their cross-references still compare byte-for-byte.
const ids = vi.hoisted(() => ({ next: 0 }))
vi.mock('react', async importOriginal => {
  const react = await importOriginal<typeof import('react')>()
  return { ...react, useId: () => react.useState(() => `:r${(ids.next++).toString(32)}:`)[0] }
})
beforeEach(() => { ids.next = 0 })

// Same action-boundary mocks as containerFocusWiring.spec.tsx; the hero, model,
// range renderer and served-record readers are real. No analysis/network run.
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))
vi.mock('../../../../canvas/analysis/canonicalRunRegistry', () => ({ executeCanonicalRun: vi.fn() }))
afterEach(cleanup)

function fromTurn(turn: typeof unseen1 | typeof unseen2) {
  const enrichment = turn.blocks[0].enrichment
  const labels = new Map(turn.draft_graph.nodes.map(n => [n.id, n.label]))
  const options = enrichment.option_comparison.map(o => makeOption({ id: o.option_id, label: o.option_label }))
  const data = makeHeroData({ options, topDriverLabel: null, recommendation: {
    isNormalised: true, goalThreshold: 24000, outcomeUnit: 'currency', outcomeUnitSymbol: '£',
    goalLabel: 'monthly profit', goalFiguresWithheldMessage: readGoalIdentityWithheld(enrichment)?.message,
    storyHeadlines: {}, flipThresholds: [],
  } })
  data.goalChanceRange = readGoalChanceRange(enrichment.inference_warnings)
  data.goalChanceLicence = readGoalChanceLicence(enrichment.inference_warnings)
  data.goalChanceDriverNames = { labelOf: id => labels.get(id) ?? null, unitOf: () => null }
  return data
}

function pointControl() {
  const licence = readGoalChanceLicence(t1b.inference_warnings)!
  const options = t1b.option_comparison.map(o => makeOption({
    id: o.option_id, label: o.option_label, goalProbability: licence.pctByOption[o.option_id] / 100,
  }))
  const data = makeHeroData({ options, topDriverLabel: null, recommendation: { storyHeadlines: {}, flipThresholds: [] } })
  data.goalChanceLicence = licence
  const labels: Record<string, string> = {
    price_increase_from_current: 'Price increase from current',
    starter_tier_subscribers: 'Starter tier subscribers', monthly_recurring_revenue: 'Monthly recurring revenue',
  }
  data.goalChanceDriverNames = { labelOf: id => labels[id] ?? null, unitOf: () => null }
  return data
}

function lines(testId: string) {
  return screen.queryAllByTestId(testId).map(node => ({ id: node.getAttribute('data-option-id'), text: node.textContent }))
}
function expectWithheld(data: ReturnType<typeof fromTurn>, ids: string[], reason?: string) {
  // Identity is always the option ID AND its label, never a numeric predicate.
  expect(lines('goal-option-withheld-line')).toEqual(ids.map(id => {
    const option = data.recommendation.allOptions.find(o => o.id === id)!
    return { id, text: reason ? `‘${option.label}’: not shown yet. ${reason}` : `‘${option.label}’: not shown yet in this model.` }
  }))
}
function expectNoBox() { expect(screen.queryByTestId('hero-lens-unavailable')).toBeNull() }
function producerReason(data: ReturnType<typeof fromTurn>) {
  return data.recommendation.goalFiguresWithheldMessage!.slice('Not shown.'.length).trim()
}
function mount(data: ReturnType<typeof fromTurn>) {
  return render(<AnalysisHeroContainer data={data} fragileEdgeCount={0} />)
}

// Frozen control markup from the original base e3f2fc82 DOM replay, already
// witnessed byte-identical in S4-UI. These references do not rebuild a baseline
// using today's implementation and must not be regenerated just to turn green.
function baseMarkup(row: 'no-figures' | 'points' | 'unresolved') {
  return { 'no-figures': noFiguresMarkup, points: pointsMarkup, unresolved: unresolvedMarkup }[row]
}

// Re-pin only authorised goal cells/availability; preserve every other byte in the points control.
function pointsMarkupWithCells(data: ReturnType<typeof fromTurn>) {
  const template = document.createElement('template')
  template.innerHTML = baseMarkup('points')
  const model = buildHeroModel(data)
  if (model.kind !== 'chart') throw new Error('Expected chart')
  for (const row of model.rows) {
    template.content.querySelector(`[data-testid="hero-option-row-${row.index}"] .text-right > span`)!.textContent = chanceCellOf(data, row.id).text
  }
  return template.innerHTML
}
function expectCellRows(data: ReturnType<typeof fromTurn>) {
  const model = buildHeroModel(data)
  expect(model.kind).toBe('chart')
  if (model.kind !== 'chart') throw new Error('Expected chart')
  expect(model.lenses).toContain('goal')
  for (const row of model.rows) expect(screen.getByTestId(`hero-option-row-${row.index}`).querySelector('.text-right > span')!.textContent).toBe(chanceCellOf(data, row.id).text ?? HERO_COPY.readout.missing)
}

// Restore-box mutant (comment only, as requested): remove goalOptionCoverage
// from the model passed to AnalysisHeroPanel, retaining it for the option lines.
// The unseen rows' expectNoBox() turns RED while both ranges and both labelled
// withholding lines remain, so the range/count checks alone cannot pass it.
describe('S4-UI: every option has a labelled goal figure or its own withholding line', () => {
  it.each([
    ['unseen-1', unseen1, captured1, ['loyalty_app', 'carry_on_as_now']],
    ['unseen-2', unseen2, captured2, ['carry_on_as_now', 'launch_loyalty_app']],
  ] as const)('%s: exact served ranges plus two identity-specific lines, without a run-wide box', (_row, turn, captured, missing) => {
    const data = fromTurn(turn)
    mount(data)
    const expectedRanges = captured.dom.range_lines.map(r => ({ id: r.option_id, text: r.text }))
    expect(lines('goal-chance-range-line')).toEqual(expectedRanges)
    expectWithheld(data, [...missing], producerReason(data))
    expectNoBox()
    fireEvent.click(screen.getByRole('tab', { name: /Goal fit/ }))
    expect(lines('goal-chance-range-line')).toEqual(expectedRanges)
    expectWithheld(data, [...missing], producerReason(data))
    expectNoBox()
  })

  it('withheld-only control: shared cells make the goal lens available, without extra coverage lines', () => {
    const data = fromTurn(unseen1)
    data.goalChanceRange = null
    mount(data)
    expectCellRows(data)
    expectNoBox()
    expect(lines('goal-option-withheld-line')).toEqual([])
  })

  it('all-points control: only shared goal cell text changes; every other markup byte remains identical', () => {
    const data = pointControl()
    const { container } = mount(data)
    expect(container.innerHTML).toBe(pointsMarkupWithCells(data))
    expect(lines('goal-option-withheld-line')).toEqual([])
    fireEvent.click(screen.getByRole('tab', { name: /Goal fit/ }))
    expect(container.innerHTML).toBe(pointsMarkupWithCells(data))
    expect(screen.queryByRole('tab', { name: /Likely outcome/ })).toBeNull()
    expectNoBox()
    for (const option of data.recommendation.allOptions) {
      expect(screen.getByTestId('hero-subline').textContent).toContain(`‘${option.label}’:`)
    }
  })

  it('swap: ranges and withholding follow the swapped option IDs and labels', () => {
    const data = fromTurn(unseen1)
    const range = data.goalChanceRange!
    const before = [...range.optionIds]
    const after = ['loyalty_app', 'carry_on_as_now']
    data.goalChanceRange = { ...range, optionIds: after,
      rangeByOption: Object.fromEntries(after.map((id, i) => [id, range.rangeByOption[before[i]]])),
    }
    mount(data)
    expect(lines('goal-chance-range-line')).toEqual(captured1.dom.range_lines.map((r, i) => ({
      id: after[i], text: r.text.replace(`‘${data.recommendation.allOptions.find(o => o.id === before[i])!.label}’:`,
        `‘${data.recommendation.allOptions.find(o => o.id === after[i])!.label}’:`),
    })))
    expectWithheld(data, before, producerReason(data))
    expectNoBox()
  })

  it.each(['absent', 'reader fallback without producer words'] as const)('no-reason fallback: %s', kind => {
    const data = fromTurn(unseen1)
    data.recommendation.goalFiguresWithheldMessage = kind === 'absent' ? undefined : GOAL_IDENTITY_WITHHELD_FALLBACK
    if (kind !== 'absent') data.confidence.inferenceWarnings = [{
      code: 'GOAL_FIGURES_TARGET_NOT_TESTABLE', severity: 'warning', affected_nodes: [],
    }]
    mount(data)
    expectWithheld(data, ['loyalty_app', 'carry_on_as_now'])
    expect(lines('goal-chance-range-line')).toEqual(captured1.dom.range_lines.map(r => ({ id: r.option_id, text: r.text })))
    expectNoBox()
  })

  it('partial points: only the extra option receives its labelled fallback line', () => {
    const data = pointControl()
    data.recommendation.allOptions.push(makeOption({ id: 'extra', label: 'Explore another route' }))
    mount(data)
    expectWithheld(data, ['extra'])
    expectNoBox()
    for (const option of data.recommendation.allOptions.filter(o => o.id !== 'extra')) {
      expect(screen.getByTestId('hero-subline').textContent).toContain(`‘${option.label}’:`)
    }
  })

  it('producer-fallback: preserves the producer’s explicit fallback words as its reason', () => {
    const data = fromTurn(unseen1)
    data.recommendation.goalFiguresWithheldMessage = GOAL_IDENTITY_WITHHELD_FALLBACK
    data.confidence.inferenceWarnings = [{ code: 'GOAL_FIGURES_TARGET_NOT_TESTABLE', severity: 'warning',
      affected_nodes: [], message: GOAL_IDENTITY_WITHHELD_FALLBACK }]
    mount(data)
    expectWithheld(data, ['loyalty_app', 'carry_on_as_now'], producerReason(data))
    expect(lines('goal-chance-range-line')).toEqual(captured1.dom.range_lines.map(r => ({ id: r.option_id, text: r.text })))
    expectNoBox()
  })

  it('unresolved labels: honest gap markers and withheld cells, with no phantom figure coverage', () => {
    const data = fromTurn(unseen1)
    data.goalChanceDriverNames = { labelOf: () => null, unitOf: () => null }
    mount(data)
    expectCellRows(data)
    expect(lines('goal-chance-range-line')).toEqual([])
    expect(lines('goal-option-withheld-line')).toEqual([])
    expectNoBox()
  })

  it('licensed-without-row-values: names the licensed options without duplicate withheld lines', () => {
    const data = pointControl()
    data.recommendation.allOptions.forEach(o => { o.goalProbability = undefined })
    data.recommendation.isNormalised = true
    const model = buildHeroModel(data)
    expect(model.kind).toBe('chart')
    if (model.kind !== 'chart') throw new Error('Expected a chart')
    expect(model.rows.map(row => ({ id: row.id, label: row.label, value: row.goal.value }))).toEqual(
      data.recommendation.allOptions.map(o => ({ id: o.id, label: o.label, value: null })),
    )
    mount(data)
    expect(lines('goal-option-withheld-line')).toEqual([])
    for (const option of data.recommendation.allOptions) {
      expect(screen.getByTestId('hero-subline').textContent).toContain(`‘${option.label}’:`)
    }
    expect(screen.queryByTestId('hero-lens-unavailable')?.textContent ?? '').not.toMatch(/^Not shown\./)
  })
})
