/**
 * E4 "What you said" (DL 19 Nov, URL 2), mounted through the real chat panel (ViewChat) and bound to core's typed field `view.intake.figures[]`
 * by figure id. The mark is read from `record` alone. Each row names what fails if the change is reverted.
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
import { IN_MODEL, NOT_IN_MODEL, resetRemovedIntake, type IntakeFigure } from '../IntakeSheet'

vi.mock('../../../../canvas/hooks/useSelectionContext', () => ({ useSelectionContext: () => null }))

const DIR = path.resolve('src/olumiView')
const base = (): View => { const v = JSON.parse(readFileSync(path.join(DIR, 'fixtures/session', 'goal-understand.view3.json'), 'utf8')) as View; return { ...v, chat: v.chat.map((t) => ({ ...t, by_id: v.you_id })) } as View }
const q = (c: ParentNode, id: string) => c.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const mount = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null })
  return render(<><ViewChat /><ViewComposer /></>).container
}
// Invented quotes; `record` is a real record id of the fixture's model (its first card) or null.
const withIntake = (v: View, figures: IntakeFigure[]): View => ({ ...v, intake: { figures } } as unknown as View)
const FIGS = (v: View): IntakeFigure[] => [
  { figure_id: 'f_a', quote: 'an invented figure of 40 a week', unit: 'item/week', stated: null, record: v.model!.cards[0]!.id },
  { figure_id: 'f_b', quote: 'an invented limit of 3 people', unit: 'person', stated: 'at_most', record: null },
]
const open = (c: HTMLElement) => act(() => { fireEvent.click(q(c, 'view-intake-toggle')!) })
const marks = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[data-intake-figure]')].map((e) => [e.getAttribute('data-intake-figure'), e.querySelector('[data-intake-mark]')?.textContent])

beforeEach(() => { useUIStore.setState({ activeOutputTab: 'olumi' } as never); setTeamFetch((async () => new Response('{}', { status: 201 })) as never) })
afterEach(() => { cleanup(); resetRemovedIntake() })

describe('E4 What you said (view.intake)', () => {
  it('each figure core read is listed in its quote, folded at rest, marked by `record` alone; CONTRAST: the same View without the field draws no sheet', () => {
    const v = base(), c = mount(withIntake(v, FIGS(v)))
    expect(q(c, 'view-intake')).not.toBeNull()
    expect([q(c, 'view-intake-rows'), q(c, 'view-intake-missing')?.textContent]).toEqual([null, `1 ${NOT_IN_MODEL}`])
    open(c)
    expect(marks(c)).toEqual([['f_a', IN_MODEL], ['f_b', NOT_IN_MODEL]])
    expect(c.querySelector('[data-intake-figure="f_a"]')?.textContent).toContain('an invented figure of 40 a week')
    cleanup()
    expect(q(mount(v), 'view-intake'), 'CONTRAST: no intake, no sheet').toBeNull()
  })
  it('the mark follows the typed record, never the words: the same quotes with record swapped swap their marks', () => {
    const v = base(), [a, b] = FIGS(v)
    const c = mount(withIntake(v, [{ ...a!, record: null }, { ...b!, record: v.model!.cards[0]!.id }]))
    open(c)
    expect(marks(c)).toEqual([['f_a', NOT_IN_MODEL], ['f_b', IN_MODEL]])
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
    const more = [...FIGS(v), { figure_id: 'f_c', quote: 'an invented third figure of 5%', unit: '%', stated: null, record: null }]
    expect(q(mount(withIntake(v, more)), 'view-intake'), 'a new figure is a new list').not.toBeNull()
  })
})
