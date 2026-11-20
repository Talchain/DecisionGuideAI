/**
 * Reasoning at rest fits the panel at 1232x704 (panel ~561 px; was 724 on a model with chances). jsdom has no layout, so the fit is read as
 * ROWS: each line-carrying element the tab draws at rest (section headings, rest sentences, figure rows, examine rows, commitment lines).
 * The first screen holds the lead and at most three more items; everything else is behind a press.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
const chat = vi.hoisted(() => ({ prefill: vi.fn() }))
vi.mock('../../ViewChat', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../ViewChat')>()), prefillComposer: chat.prefill }))
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../../client'
import { useViewStore } from '../../store'
import { StartHere, ViewReasoningBlock } from '../../ViewReasoning'
import { controls } from '../../../styles/controls'
import { clearWhatIf } from '../../whatif'
import { useMe } from '../../../olumiCore/me'

const read = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', n), 'utf8'))
const real = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', `${n}.view3.json`), 'utf8'))
const ready = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
}
afterEach(() => { cleanup(); clearWhatIf(); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })

const ROW = 'h3, [data-rest] > p, [data-rest-figure], [data-testid="reasoning-examine"] li, [data-testid="reasoning-commitment"] li, [data-testid="reasoning-rests-key"], [data-testid="reasoning-focus"]'
const rows = () => screen.getByTestId('view-reasoning').querySelectorAll(ROW).length
const items = () => screen.getByTestId('reasoning-examine').querySelectorAll('li').length

/**
 * THE FIT CRITERION, TWO FIXED NUMBERS (neither scales with the count of rest groups):
 *  - the panel at 1232x704 holds about 12 of these rows (the figure this file has always held), of which one rest group's three lines were part, so
 *    everything BESIDE the rest groups' own lines (the lead, the examine and commitment items, the rests heading, core's figure-list label and the key)
 *    stays within OUTSIDE_RESTS = 9 rows, however many groups there are;
 *  - each rest group at rest is its own three lines at most (its option and aim, core's sentence, its first figure): PER_GROUP = 3.
 * A4 draws every group's headline share at rest, so a model with many groups is taller than the panel by design: this spec does NOT claim the total fits.
 * The total is a geometry question, read at 1232x704 by S4 (see the lane reply), never inferred from this row count.
 */
const OUTSIDE_RESTS = 9
const PER_GROUP = 3
const groupRows = (g: Element) => g.querySelectorAll('p:not([data-view="run.rests_figures_heading"]), [data-rest-figure]').length
const outsideRests = () => rows() - [...document.querySelectorAll('[data-rest]')].reduce((n, g) => n + groupRows(g), 0)

describe('Reasoning at rest fits the 1232x704 panel', () => {
  it('european (the model that measured 724 px against a 561 px panel): at rest the lead and at most three more items, every rest group with its first figure and nothing beside the groups past the fixed budget, the further figures behind presses; opening them draws more rows', () => {
    ready(read('european.view.json')); render(<ViewReasoningBlock />)
    const atRest = rows()
    const groups = [...document.querySelectorAll('[data-rest]')]
    expect([outsideRests() <= OUTSIDE_RESTS, groups.every((g) => groupRows(g) <= PER_GROUP), items() <= 4, groups.length > 1, document.querySelectorAll('[data-rest-figure]').length], `rows at rest: ${atRest}, outside the groups: ${outsideRests()}`).toEqual([true, true, true, true, groups.length])
    fireEvent.click(screen.getByTestId('reasoning-rests-more'))
    expect(rows(), 'CONTRAST: the folded rows are one press away, not deleted').toBeGreaterThan(atRest)
  })
  it('CONTRAST: a short model (bakery, one rest) draws it whole at rest, with no press to fold anything, inside the same two fixed numbers', () => {
    ready(read('bakery.view.json')); render(<ViewReasoningBlock />)
    const groups = [...document.querySelectorAll('[data-rest]')]
    expect([groups.length, outsideRests() <= OUTSIDE_RESTS, groups.every((g) => groupRows(g) <= PER_GROUP)]).toEqual([1, true, true])
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
