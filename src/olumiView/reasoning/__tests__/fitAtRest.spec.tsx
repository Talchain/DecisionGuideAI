/**
 * Reasoning at rest fits the panel at 1232x704 (panel ~561 px; was 724 on a model with chances). jsdom has no layout, so the fit is read as
 * ROWS: each line-carrying element the tab draws at rest (section headings, rest sentences, figure rows, examine rows, commitment lines).
 * The first screen holds the lead and at most three more items; everything else is behind a press.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
const chat = vi.hoisted(() => ({ prefill: vi.fn() }))
vi.mock('../../ViewChat', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../ViewChat')>()), prefillComposer: chat.prefill }))
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../../client'
import { useViewStore } from '../../store'
import { RESTS_AT_REST, StartHere, ViewReasoningBlock } from '../../ViewReasoning'
import { controls } from '../../../styles/controls'
import { useCanvasStore } from '../../../canvas/store'
import { clearWhatIf } from '../../whatif'
import { useMe } from '../../../olumiCore/me'

const read = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', n), 'utf8'))
const real = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', `${n}.view3.json`), 'utf8'))
const ready = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
}
afterEach(() => { cleanup(); useCanvasStore.getState().clearSelection(); useViewStore.setState({ panelLevels: { reasoning: 'glance' }, expandedRests: {}, reasoningFigure: null }); clearWhatIf(); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })

const ROW = 'h3, [data-rest] > p, [data-rest-figure], [data-testid="reasoning-examine"] li, [data-testid="reasoning-commitment"] li, [data-testid="reasoning-rests-key"], [data-testid="reasoning-focus"]'
const rows = () => screen.getByTestId('view-reasoning').querySelectorAll(ROW).length
const items = () => screen.getByTestId('reasoning-examine').querySelectorAll('li').length

/**
 * (Round 3 repair: the total budget is the panel's capacity itself, 12 rows, not arithmetic on the caps; a golden that draws more is a real overflow to fix by
 * cutting rows, not by raising this number. The browser pixel geometry at 1232x704 and 1128 at 1.33 is still owed by S4 and must be attached before the row is resolved.)
 * THE FIT CRITERION (Paul's progressive-disclosure rule; S4 ruling 20 Nov round 3): at most RESTS_AT_REST (3) rest groups at rest, in core's order, the rest behind
 * ONE disclosure. With the groups capped, the at-rest TOTAL is bounded by fixed numbers that do not grow with the model:
 *  - the panel at 1232x704 holds about 12 of these rows, so everything BESIDE the rest groups' own lines (the lead, the examine and commitment items, the
 *    rests heading, core's figure-list label and the key) stays within OUTSIDE_RESTS = 9;
 *  - each rest group at rest is its own three lines at most (its option and aim, core's sentence, its first figure): PER_GROUP = 3;
 *  - so the whole tab at rest is TOTAL_AT_REST = OUTSIDE_RESTS + RESTS_AT_REST * PER_GROUP rows, plus core's one figure-list label.
 * The total is asserted on EVERY golden, european (7 groups) included: it is a count of rows because jsdom has no layout. The pixel height at 1232x704
 * (and 1128 at 1.33) is a browser measurement this file cannot make; S4 supplies it. A row count that passes here does not prove the panel fits.
 */
const CAPACITY_ROWS = 12 // what the 1232x704 panel (about 561 px) holds, from the 724 px measurement above: a fixed fact of the panel, not derived from the caps below
const OUTSIDE_RESTS = 3 // so the lead, examine and commitment items, rests heading and key leave room for the groups' own lines
const PER_GROUP = 3
const TOTAL_AT_REST = CAPACITY_ROWS
const groupRows = (g: Element) => g.querySelectorAll('p:not([data-view="run.rests_figures_heading"]), [data-rest-figure]').length
const outsideRests = () => rows() - [...document.querySelectorAll('[data-rest]')].reduce((n, g) => n + groupRows(g), 0)
const goldens = readdirSync(path.resolve('src/olumiView/golden')).filter((n) => n.endsWith('.view.json')).sort()

describe('Reasoning at rest fits the 1232x704 panel', () => {
  it('european (the model that measured 724 px against a 561 px panel): at most three rest groups at rest, each with its first figure; the other groups and the further figures behind ONE press; opening it draws more rows', () => {
    ready(read('european.view.json')); render(<ViewReasoningBlock />)
    const atRest = rows()
    const groups = [...document.querySelectorAll('[data-rest]')]
    expect([groups.length, groups.every((g) => groupRows(g) <= PER_GROUP), outsideRests() <= OUTSIDE_RESTS, items() <= 4], `rows at rest: ${atRest}, outside the groups: ${outsideRests()}`).toEqual([RESTS_AT_REST, true, true, true])
    expect(atRest, 'the TOTAL at rest, not only what is left after subtracting the groups').toBeLessThanOrEqual(TOTAL_AT_REST)
    expect(screen.getAllByTestId('reasoning-rests-more'), 'ONE press for everything folded').toHaveLength(1)
    fireEvent.click(screen.getByTestId('reasoning-rests-more'))
    expect(rows(), 'CONTRAST: the folded rows are one press away, not deleted').toBeGreaterThan(atRest)
    expect(document.querySelectorAll('[data-rest]').length, 'opened: every group, in core\'s order').toBeGreaterThan(RESTS_AT_REST)
  })
  for (const name of goldens) {
    it(`${name}: whatever core sends, the Reasoning tab at rest draws at most ${RESTS_AT_REST} rest groups and its total rows stay within the fixed budget`, () => {
      const view = read(name)
      expect(view.model, `${name}: a golden with no model cannot show it fits; fail rather than skip`).not.toBeNull()
      ready(view); render(<ViewReasoningBlock />)
      const groups = [...document.querySelectorAll('[data-rest]')]
      expect([groups.length <= RESTS_AT_REST, groups.every((g) => groupRows(g) <= PER_GROUP), rows() <= TOTAL_AT_REST], `${name}: ${rows()} rows, ${groups.length} groups`).toEqual([true, true, true])
    })
  }
  // Pricing, not bakery: bakery has one group and two figures, so its second figure folds; pricing is the one golden that is whole at rest.
  it('CONTRAST: a short model (pricing, one rest with one figure) draws it whole at rest, with no press to fold anything, inside the same fixed numbers', () => {
    ready(read('pricing.view.json')); render(<ViewReasoningBlock />)
    const groups = [...document.querySelectorAll('[data-rest]')]
    // The fixed numbers are ONE budget: the panel's 12 rows. OUTSIDE_RESTS (3) is what is left beside a FULL three groups (3 x PER_GROUP); a model with one group has the
    // rows of the two empty group slots as well, so what may sit outside its groups is the budget less the groups it actually draws.
    expect([groups.length, outsideRests() <= TOTAL_AT_REST - groups.length * PER_GROUP, rows() <= TOTAL_AT_REST, groups.every((g) => groupRows(g) <= PER_GROUP), screen.queryByTestId('reasoning-rests-more')?.getAttribute('aria-expanded') ?? null], `rows ${rows()}, outside ${outsideRests()}`).toEqual([1, true, true, true, null])
  })
})

describe('Reasoning: putting a question in the message box is never the primary action', () => {
  it('app-launch with text-only questions: the lead\'s press is the quiet secondary (not the green action), and a list row\'s press is an icon beside core\'s words; a challenge\'s press (the card) stays the green action', () => {
    const view = structuredClone(read('app-launch.view.json')); (view.model as unknown as { questions?: unknown }).questions = []
    ready(view)
    render(<StartHere model={view.model!} />)
    const lead = screen.getByTestId('reasoning-question')
    expect([lead.className.includes(controls.act), lead.className.includes('border-panel-border')]).toEqual([false, true])
    fireEvent.click(lead)
    expect(chat.prefill.mock.calls).toEqual([[view.model!.coaching_questions![0]]])
    cleanup()
    render(<ViewReasoningBlock />)
    const press = screen.getAllByTestId('reasoning-question')[0]!
    expect([press.textContent, press.closest('li')!.querySelector('[data-view-words]')!.textContent!.length > 0]).toEqual(['', true])
    cleanup()
    // CONTRAST: a challenged card leads with the green "show" action.
    const cap = real('capacity'); ready(cap)
    render(<StartHere model={cap.model!} />)
    const show = screen.queryByTestId('reasoning-challenge-show')
    expect([show !== null, show?.className.includes(controls.act)]).toEqual([true, true])
  })
})

it('Detail orders finite shares within their own option and aim, and a canvas selection opens that figure’s four statuses', () => {
  const view = { ...read('bakery.view.json'), gated: false }
  const figures = view.model!.run!.rests[0]!.figures!
  const [high, low] = figures
  figures.reverse()
  figures.push({ ...low!, id: 'bad-share', share: NaN })
  ready(view)
  render(<ViewReasoningBlock />)
  expect([...document.querySelectorAll('[data-rest-figure]')].map((e) => e.getAttribute('data-rest-figure'))).toEqual([high!.id])
  fireEvent.click(screen.getByRole('button', { name: 'Detail' }))
  expect([...document.querySelectorAll('[data-rest-figure]')].map((e) => e.getAttribute('data-rest-figure'))).toEqual([high!.id, low!.id])
  fireEvent.click(screen.getByRole('button', { name: 'Glance' }))
  const scrollIntoView = vi.fn()
  const previous = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView })
  try {
    act(() => useCanvasStore.getState().selectNodes([low!.id]))
    const selected = document.querySelector(`[data-rest-figure="${low!.id}"] button`)
    expect(selected).toHaveAttribute('aria-pressed', 'true')
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
    expect([...screen.getByTestId('reasoning-figure-loop').querySelectorAll('dt')].map((e) => e.textContent)).toEqual(['Assumption', 'Evidence', 'Examined', 'Next'])
  } finally {
    if (previous) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', previous)
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
  }
})

it('joins evidence and answer history by record, and next actions by figure and aim', () => {
  const view = { ...read('bakery.view.json'), gated: false }
  const run = view.model!.run!
  const rest = run.rests[0]!, driver = rest.figures![0]!
  const evidence: View['evidence'][number] = {
    id: 1, at: '', by: 'Ada', by_id: view.you_id, text: 'Observed in April', source: null, link: null,
    concerns: [driver.id], stance: 'supports', version: null, considered: null,
    stance_text: 'Supports', switch_text: '', mark_label: '', mark_title: '', bears_on_text: null,
  }
  view.evidence = [evidence, { ...evidence, id: 2, concerns: [rest.option] }]
  view.reasoning = { examined: [{
    id: 'answered-elsewhere', question_id: 'q1', question: 'Observed in April', about: rest.option,
    supplied: { by: 'Ada', by_id: view.you_id, text: 'Yes', at: '' },
    bound: driver.id, finding: null, mentioned: [driver.id], limits: null, proposal_id: null, olumi: true,
  }] }
  const next = run.find_out![0]!
  const nextFigure = next.figures.find((f) => f.id === driver.id)!
  run.find_out = [
    { ...next, aim: 'different-aim', figures: [{ ...nextFigure, line: 'Check for the other aim' }] },
    { ...next, aim: rest.aim, figures: [{ ...nextFigure, line: 'Check the current aim' }] },
  ]
  ready(view)
  useCanvasStore.getState().selectNodes([driver.id])
  render(<ViewReasoningBlock />)
  const loop = screen.getByTestId('reasoning-figure-loop')
  expect(loop.querySelector('[data-loop-status="Evidence"] dd')).toHaveTextContent('1 linked · 0 considered')
  expect(loop.querySelector('[data-loop-status="Examined"] dd')).toHaveTextContent('Still open')
  expect(loop.querySelector('[data-loop-status="Next"] dd')).toHaveTextContent('Check the current aim')
})
