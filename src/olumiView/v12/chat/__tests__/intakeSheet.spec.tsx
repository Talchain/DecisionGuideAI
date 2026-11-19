/**
 * E4 "What you said" (DL 19 Nov; field shape Codex 12:26Z, URL 2), mounted through the real chat panel (ViewChat) and bound to core's typed field
 * `view.intake.figures[]` by source. What a row says about the model is read from `record` alone: an id (in the model, shows that record),
 * null (not in the model yet), "unknown" (no claim). Each row names what fails if the change is reverted.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { setTeamFetch } from '../../../../olumiCore/team/api'
import { useUIStore } from '../../../../stores/uiStore'
import type { View } from '../../../client'
import { useViewStore } from '../../../store'
import { ViewChat, ViewComposer } from '../../../ViewChat'
import { IN_MODEL, NOT_IN_MODEL, resetRemovedIntake, UNKNOWN, type IntakeFigure } from '../IntakeSheet'

vi.mock('../../../../canvas/hooks/useSelectionContext', () => ({ useSelectionContext: () => null }))
const pressed = vi.hoisted(() => ({ ids: [] as string[] }))
vi.mock('../../../reasoning/tabRing', async (orig) => ({ ...(await orig<object>()), pressCard: (id: string) => { pressed.ids.push(id) } }))

const DIR = path.resolve('src/olumiView')
const base = (): View => { const v = JSON.parse(readFileSync(path.join(DIR, 'fixtures/session', 'goal-understand.view3.json'), 'utf8')) as View; return { ...v, chat: v.chat.map((t) => ({ ...t, by_id: v.you_id })) } as View }
const q = (c: ParentNode, id: string) => c.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const mount = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null })
  return render(<><ViewChat /><ViewComposer /></>).container
}
// Invented quotes; `record` is a real record id of the fixture's model (its first card), null, or "unknown".
const withIntake = (v: View, figures: IntakeFigure[]): View => ({ ...v, intake: { figures } } as unknown as View)
const at = (row: number, start: number, end: number) => ({ row, start, end })
const FIGS = (v: View): IntakeFigure[] => [
  { source: { row: 'brief', start: 4, end: 20 }, quote: 'an invented figure of 40 a week', unit: 'item/week', stated: { value: { point: 40 }, bound: null }, record: v.model!.cards[0]!.id },
  { source: at(0, 30, 44), quote: 'an invented limit of 3 people', unit: 'person', stated: { value: { point: 3 }, bound: 'at_most' }, record: null },
  { source: at(1, 0, 18), quote: 'maybe an invented 10%', unit: '%', stated: null, record: UNKNOWN },
]
const open = (c: HTMLElement) => act(() => { fireEvent.click(q(c, 'view-intake-toggle')!) })
const marks = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[data-intake-source]')].map((e) => [e.getAttribute('data-intake-source'), e.querySelector('[data-intake-mark]')?.textContent ?? null])

beforeEach(() => { useUIStore.setState({ activeOutputTab: 'olumi' } as never); setTeamFetch((async () => new Response('{}', { status: 201 })) as never); pressed.ids = [] })
afterEach(() => { cleanup(); resetRemovedIntake() })

describe('E4 What you said (view.intake)', () => {
  it('each figure is listed in its quote, folded at rest, marked by `record` alone: id = in your model, null = not yet, "unknown" = no claim; CONTRAST: without the field no sheet', () => {
    const v = base(), c = mount(withIntake(v, FIGS(v)))
    expect([q(c, 'view-intake') !== null, q(c, 'view-intake-rows'), q(c, 'view-intake-missing')?.textContent]).toEqual([true, null, `1 ${NOT_IN_MODEL}`])
    open(c)
    expect(marks(c)).toEqual([['brief:4:20', IN_MODEL], ['0:30:44', NOT_IN_MODEL], ['1:0:18', null]])
    expect(c.querySelector('[data-intake-source="1:0:18"]')?.textContent, 'unknown: the words, with their uncertainty, and nothing else').toBe('“maybe an invented 10%”')
    cleanup()
    expect(q(mount(v), 'view-intake'), 'CONTRAST: no intake, no sheet').toBeNull()
  })
  it('the mark follows the typed record, never the words: the same quotes with records rotated rotate their marks', () => {
    const v = base(), [a, b, u] = FIGS(v)
    const c = mount(withIntake(v, [{ ...a!, record: UNKNOWN }, { ...b!, record: v.model!.cards[0]!.id }, { ...u!, record: null }]))
    open(c)
    expect(marks(c)).toEqual([['brief:4:20', null], ['0:30:44', IN_MODEL], ['1:0:18', NOT_IN_MODEL]])
  })
  it('a record id links to that record: pressing "in your model" reaches the workspace with that id', () => {
    const v = base(), id = v.model!.cards[0]!.id, c = mount(withIntake(v, FIGS(v)))
    open(c)
    act(() => { fireEvent.click(c.querySelector<HTMLElement>(`[data-intake-show="${id}"]`)!) })
    expect(pressed.ids).toEqual([id])
  })
  it('core dbf5aba7 shape: a figure whose row is not known (source null) shows its words with no claim; CONTRAST: a malformed source is dropped, not guessed', () => {
    const v = base(), c = mount(withIntake(v, [...FIGS(v), { source: null, quote: 'an invented unplaced 12', unit: null, stated: null, record: UNKNOWN }, { source: { row: -1, start: 0, end: 2 }, quote: 'an invented bad 7', unit: null, stated: null, record: null } as unknown as IntakeFigure]))
    open(c)
    expect(marks(c)).toEqual([['brief:4:20', IN_MODEL], ['0:30:44', NOT_IN_MODEL], ['1:0:18', null], ['none:3:an invented unplaced 12', null]])
    expect(q(c, 'view-intake-missing')?.textContent, 'the dropped row is not counted').toBe(`1 ${NOT_IN_MODEL}`)
  })
  it('never before the first model: with no model the sheet is not drawn; CONTRAST: the same intake with a model is', () => {
    const v = base()
    expect(q(mount(withIntake({ ...v, model: null } as View, FIGS(v))), 'view-intake')).toBeNull()
    cleanup()
    expect(q(mount(withIntake(v, FIGS(v))), 'view-intake')).not.toBeNull()
  })
  it('REMOVE: pressed, the sheet is gone, not folded; CONTRAST: the chevron only folds it; a new figure brings it back', () => {
    const v = base(), c = mount(withIntake(v, FIGS(v)))
    open(c); open(c)
    expect([q(c, 'view-intake') !== null, q(c, 'view-intake-rows')]).toEqual([true, null])
    act(() => { fireEvent.click(q(c, 'view-intake-remove')!) })
    expect(q(c, 'view-intake')).toBeNull()
    cleanup()
    const more = [...FIGS(v), { source: at(2, 0, 9), quote: 'an invented third figure of 5', unit: null, stated: null, record: null }]
    expect(q(mount(withIntake(v, more)), 'view-intake'), 'a new figure is a new list').not.toBeNull()
  })
  it('one sentence is drawn once: figures with the same source row and quote are grouped, one status line per distinct status with its count; the head count stays per figure; CONTRAST: another row is another sentence', () => {
    const v = base(), id = v.model!.cards[0]!.id, one = { unit: null, stated: null } as const
    const same = 'an invented question sentence'
    const figs: IntakeFigure[] = [
      { ...one, source: at(0, 0, 4), quote: same, record: null }, { ...one, source: at(0, 5, 9), quote: same, record: null }, { ...one, source: at(0, 10, 14), quote: same, record: id },
      { ...one, source: at(1, 0, 4), quote: same, record: null },
    ]
    const c = mount(withIntake(v, figs))
    expect(q(c, 'view-intake-missing')?.textContent).toBe(`3 ${NOT_IN_MODEL}`)
    open(c)
    const lis = [...c.querySelectorAll<HTMLElement>('[data-intake-source]')]
    expect(lis.map((l) => l.textContent)).toEqual([`“${same}”${NOT_IN_MODEL} · 2${IN_MODEL}`, `“${same}”${NOT_IN_MODEL}`])
    expect(lis[0]!.querySelectorAll('[data-intake-show]')).toHaveLength(1)
    act(() => { fireEvent.click(lis[0]!.querySelector<HTMLElement>(`[data-intake-show="${id}"]`)!) })
    expect(pressed.ids).toEqual([id])
  })
})
