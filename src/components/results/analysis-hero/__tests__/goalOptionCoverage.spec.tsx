import { canonicalTestCellsOf, withCanonicalTestCells } from './helpers/canonicalTestCells'
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
import { runViewFromParts } from '../../../../canvas/runView/runView'
import type { CanonicalAnalysisView } from '../../../../canvas/runView/canonicalAnalysisView'
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
  Object.assign(data, withCanonicalTestCells(data))
  return render(<AnalysisHeroContainer data={data} fragileEdgeCount={0} />)
}
/**
 * #2747 re-scope 2 (U0): the same self-authored current canonical view as `mount` (`withCanonicalTestCells`), edited as
 * CEE would serve it (a driver's `detail`, a range cell without its `face`), through the real gate.
 */
function mountServed(data: ReturnType<typeof fromTurn>, edit: (view: CanonicalAnalysisView) => CanonicalAnalysisView) {
  const view = runViewFromParts({ run_id: 'synthetic-ui-fixture' }, data.goalChanceLicence ?? data.runView?.goalChance ?? null,
    data.goalChanceRange ?? data.runView?.goalChanceRange ?? null, edit(canonicalTestCellsOf(data)))
  Object.assign(data, { runView: view, goalChanceRange: view.goalChanceRange })
  return render(<AnalysisHeroContainer data={data} fragileEdgeCount={0} />)
}
const withDriverDetails = (details: Readonly<Record<string, string>>) => (view: CanonicalAnalysisView): CanonicalAnalysisView => ({
  ...view,
  options: view.options.map(o => o.main_driver.kind === 'available' && details[o.option_id] !== undefined
    ? { ...o, main_driver: { ...o.main_driver, detail: details[o.option_id] } } : o),
})
const withoutRangeFaces = (view: CanonicalAnalysisView): CanonicalAnalysisView => ({
  ...view,
  options: view.options.map(o => o.cell.kind === 'range' ? { ...o, cell: { kind: 'range' as const, display: o.cell.display, detail: o.cell.detail } } : o),
})

/**
 * #2747 re-scope 2 (U0): a range line says CEE's served range face verbatim (`faceOf` → the range cell's `face`), then its
 * action, and composes nothing: the captured UI link clause ("It depends most on …") is no longer said. The face is the
 * captured line's own first sentence (CEE's served face shape), checked against the held canonical cell by option id.
 */
const FACE_END = ' chance of meeting your goal, in this model.'
const capturedFace = (text: string) => text.slice(0, text.indexOf(FACE_END) + FACE_END.length)
function servedRangeLines(data: ReturnType<typeof fromTurn>, captured: typeof captured1 | typeof captured2) {
  return captured.dom.range_lines.map(r => {
    const face = capturedFace(r.text)
    expect(data.runView!.servedCellOf(r.option_id)).toMatchObject({ kind: 'range', face })
    return { id: r.option_id, text: `${face} ${r.buttons[0].text}` }
  })
}
const COMPOSED_RANGE_WORDS = /depends most on|isn’t sized in the model yet|which Olumi assumed/
function expectNoComposedRangeWords() {
  for (const line of lines('goal-chance-range-line')) expect(line.text).not.toMatch(COMPOSED_RANGE_WORDS)
}
/** CEE's served `main_driver.detail` for t1b's two drivers: the frozen base lead's own words (`points.base.html`). */
const POINT_DETAILS: Readonly<Record<string, string>> = {
  raise_prices_by_10: 'It rests most on how strongly ‘Price increase from current’ affects ‘Monthly recurring revenue’, at the size you set: '
    + 'if that effect is weaker than that, the chance falls. How sure are you of that size?',
  launch_starter_tier: 'It rests most on how strongly ‘Starter tier subscribers’ affects ‘Monthly recurring revenue’, at the size you set: '
    + 'if that effect is weaker than that, the chance falls. How sure are you of that size?',
}

// Frozen control markup from the original base e3f2fc82 DOM replay, already
// witnessed byte-identical in S4-UI. These references do not rebuild a baseline
// using today's implementation and must not be regenerated just to turn green.
function baseMarkup(row: 'no-figures' | 'points' | 'unresolved') {
  return { 'no-figures': noFiguresMarkup, points: pointsMarkup, unresolved: unresolvedMarkup }[row]
}

// C-CELL: authorize the full cell's wrapping readout column (DL r6-4); preserve every other markup byte.
function pointsMarkupWithCells(data: ReturnType<typeof fromTurn>) {
  const template = document.createElement('template')
  template.innerHTML = baseMarkup('points')
  const model = buildHeroModel(data)
  if (model.kind !== 'chart') throw new Error('Expected chart')
  for (const row of model.rows) {
    const readout = template.content.querySelector(`[data-testid="hero-option-row-${row.index}"] .text-right > span`)!
    readout.textContent = chanceCellOf(data, row.id).text
    readout.parentElement!.classList.replace('whitespace-nowrap', 'min-w-0')
    readout.parentElement!.classList.add('break-words', 'whitespace-normal')
    // Retain class order for the byte-level control.
    readout.parentElement!.className = readout.parentElement!.className.replace('min-w-0 text-right text-text-light break-words whitespace-normal', 'min-w-0 break-words whitespace-normal text-right text-text-light')
    const button = readout.closest('button')!
    button.className = button.className.replace('grid-cols-[1.5rem_minmax(0,1fr)_auto_0.875rem]', 'grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_0.875rem]')
  }
  // #2747 re-scope 2 round 2 (DL rules C and D): authorise the headline and the lens caption only. The frozen base headline is the UI's own
  // composition around its own target words ("each option’s chance of meeting your goal (at least £126,000 / month):"); with
  // no CEE chance words served (none in t1b) the hero says the neutral headline. Every other byte stays frozen.
  const headline = template.content.querySelector('[data-testid="hero-headline"]')!
  expect(headline.textContent).toBe('In this model, on current information, each option’s chance of meeting your goal (at least £126,000 / month):')
  headline.textContent = 'Here is how your options compare.'
  // …and the Goal fit lens caption, the UI's own words for what each value is a chance of (deleted with caption.goalOnly).
  const caption = template.content.querySelector('[data-testid="hero-caption"]')!
  expect(caption.textContent).toBe('Each value is the chance that option meets every target this run scored.')
  caption.closest('p')!.remove()
  return template.innerHTML
}
// C-CELL: the lead now has separate labelled cell lines, tested independently of the retained markup control.
function withoutLeadMarkup(markup: string) {
  const template = document.createElement('template')
  template.innerHTML = markup
  template.content.querySelector('[data-testid="hero-subline"]')!.replaceWith(document.createComment('lead-lines'))
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
    // #2747 re-scope 2 (U0): CEE's served face verbatim, then the action (was the captured UI-composed line).
    const expectedRanges = servedRangeLines(data, captured)
    expect(lines('goal-chance-range-line')).toEqual(expectedRanges)
    expectNoComposedRangeWords()
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

  it('all-points control: own cell lead lines and wrapping column change; all other markup stays identical', () => {
    const data = pointControl()
    // #2747 re-scope 2 (U0): the drivers carry CEE's served `detail` (the only words a driver line may say).
    const { container } = mountServed(data, withDriverDetails(POINT_DETAILS))
    for (const option of data.recommendation.allOptions) {
      const cell = chanceCellOf(data, option.id)
      const prefix = `‘${option.label}’: `
      const ownText = cell.text!.startsWith(prefix) ? cell.text : prefix + cell.text
      expect(screen.getByTestId('hero-subline').querySelector(`[data-option-id="${option.id}"] p`)!.textContent).toBe(ownText)
    }
    // C-LOST restored: the historical driver words survive, immediately after their own cells.
    const base = document.createElement('template')
    base.innerHTML = pointsMarkup
    const priorLead = base.content.querySelector('[data-testid="hero-subline"]')!.textContent!
    const driverLines = screen.getByTestId('hero-subline').querySelectorAll('[data-line-kind="driver"]')
    expect(driverLines).toHaveLength(2)
    // #2747 re-scope 2 (U0): each driver line is ITS option's served detail, verbatim.
    expect(Object.fromEntries([...driverLines].map(d => [d.getAttribute('data-option-id'), d.textContent]))).toEqual(POINT_DETAILS)
    for (const driver of driverLines) {
      expect(priorLead).toContain(driver.textContent)
      expect(driver.previousElementSibling!.getAttribute('data-line-kind')).toBe('cell')
      expect(driver.previousElementSibling!.getAttribute('data-option-id')).toBe(driver.getAttribute('data-option-id'))
    }
    // #2747 re-scope 2 (U0): the base lead's licence-composed disclosure lines are no longer said on the hero.
    expect(priorLead).toContain('These chances also count')
    expect(screen.getByTestId('hero-subline').textContent).not.toMatch(/These chances also count|Olumi isn’t saying whether|might not hold/)
    expect(withoutLeadMarkup(container.innerHTML)).toBe(withoutLeadMarkup(pointsMarkupWithCells(data)))
    expect(lines('goal-option-withheld-line')).toEqual([])
    fireEvent.click(screen.getByRole('tab', { name: /Goal fit/ }))
    expect(withoutLeadMarkup(container.innerHTML)).toBe(withoutLeadMarkup(pointsMarkupWithCells(data)))
    expect(screen.queryByRole('tab', { name: /Likely outcome/ })).toBeNull()
    expectNoBox()
    for (const option of data.recommendation.allOptions) {
      expect(screen.getByTestId('hero-subline').textContent).toContain(`‘${option.label}’:`)
    }
  })

  // #2747 re-scope 2 (U0): a canonical driver CEE gave no `detail` says nothing; the UI composes no driver words.
  it('all-points control without served details: the drivers say nothing, the own cells stay', () => {
    const data = pointControl()
    mount(data)
    // CONTROL: the drivers are on the current canonical view; only their sentence is absent.
    expect(data.runView!.mainDriverOf('raise_prices_by_10')).not.toBeNull()
    expect(data.runView!.mainDriverDetailOf('raise_prices_by_10')).toBeNull()
    expect(screen.getByTestId('hero-subline').querySelectorAll('[data-line-kind="driver"]')).toHaveLength(0)
    expect(screen.getByTestId('hero-subline').querySelectorAll('[data-line-kind="cell"]')).toHaveLength(3)
    expect(screen.getByTestId('hero-subline').textContent).not.toMatch(/It rests most on|the chance falls/)
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
    // #2747 re-scope 2 (U0): each line is the swapped option's served face verbatim, then its action.
    expect(lines('goal-chance-range-line')).toEqual(captured1.dom.range_lines.map((r, i) => {
      const face = capturedFace(r.text).replace(`‘${data.recommendation.allOptions.find(o => o.id === before[i])!.label}’:`,
        `‘${data.recommendation.allOptions.find(o => o.id === after[i])!.label}’:`)
      expect(data.runView!.servedCellOf(after[i])).toMatchObject({ kind: 'range', face })
      return { id: after[i], text: `${face} ${r.buttons[0].text}` }
    }))
    expectNoComposedRangeWords()
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
    // #2747 re-scope 2 (U0): CEE's served face verbatim, then the action (was the captured UI-composed line).
    expect(lines('goal-chance-range-line')).toEqual(servedRangeLines(data, captured1))
    expectNoComposedRangeWords()
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
    // #2747 re-scope 2 (U0): CEE's served face verbatim, then the action (was the captured UI-composed line).
    expect(lines('goal-chance-range-line')).toEqual(servedRangeLines(data, captured1))
    expectNoComposedRangeWords()
    expectNoBox()
  })

  // #2747 re-scope 2 (U0): the range line no longer resolves canvas labels (it says CEE's served face, which carries CEE's
  // own labels), so unresolved canvas labels change nothing there and no raw id can be exposed. What now withholds the
  // line is a range cell CEE served with no face: that says nothing (the old `[]` negative, kept on its new condition).
  it('unresolved labels: the range lines say CEE’s served faces verbatim, exposing no raw id; the hero rows keep their cells', () => {
    const data = fromTurn(unseen1)
    data.goalChanceDriverNames = { labelOf: () => null, unitOf: () => null }
    mount(data)
    expectCellRows(data)
    expect(lines('goal-chance-range-line')).toEqual(servedRangeLines(data, captured1))
    const linkIds = Object.values(data.goalChanceRange!.rangeByOption).flatMap(e => e.kind === 'stated_time' ? [] : [e.from, e.to])
    expect(linkIds.length).toBeGreaterThan(0)
    for (const line of lines('goal-chance-range-line')) for (const id of linkIds) expect(line.text).not.toContain(id)
    expectWithheld(data, ['loyalty_app', 'carry_on_as_now'], producerReason(data))
    expectNoBox()
  })

  it('a range cell CEE served with no face: no range line, honest cells, no phantom figure coverage', () => {
    const data = fromTurn(unseen1)
    mountServed(data, withoutRangeFaces)
    // CONTROL: the ranges are still held through the gate; only their served sentence is absent.
    expect(data.goalChanceRange?.optionIds.length).toBe(2)
    expectCellRows(data)
    expect(lines('goal-chance-range-line')).toEqual([])
    expectWithheld(data, ['loyalty_app', 'carry_on_as_now'], producerReason(data))
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
