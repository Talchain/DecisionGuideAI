/**
 * W2 (Paul 0950 point 6: "the full answer shouldn't duplicate what's already displayed"): core's lead IS the reply's first paragraph, word for word, and it is drawn
 * above the fold, so "Full answer" leaves out exactly that one paragraph and keeps every other line, cite and check. A paragraph that differs from the lead by one
 * word stays. The setup is replyLead.spec.tsx's: real mounted ViewChat, the real stores; invented words only.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { setPagePerson } from '../../../../olumiCore/team/api'
import { useMe } from '../../../../olumiCore/me'
import type { View, ViewTurn } from '../../../client'
import { useViewStore } from '../../../store'
import { useUIStore } from '../../../../stores/uiStore'
import { ViewChat, useViewChat } from '../../../ViewChat'

const golden = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${n}.view.json`), 'utf8'))
type Answer = NonNullable<ViewTurn['answer']>
const withTurn = (v: View, i: number, a: Partial<Answer>, over: Record<string, unknown> = {}): View =>
  ({ ...v, chat: v.chat.map((t, j) => (j === i && t.answer !== null ? { ...t, ...over, answer: { ...t.answer, ...a } } : t)) })
const show = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null })
  return render(<ViewChat />).container
}
const q = (c: ParentNode, id: string) => c.querySelector<HTMLElement>(`[data-testid="${id}"]`)

// A first draft in core's shape (core's label line, the answer, core's check heading, the check), as panel.spec draws it today.
const LABEL = 'A first answer from your brief and general knowledge, written before the model. Not checked against the model.'
const HEADING = 'Olumi’s check against the model'
const MIDDLE = 'What each side rests on:'
const CHECK = 'The model holds the staff cost but not the extra covers, so it cannot yet say which way it falls.'
const FIRST = [LABEL, '', 'The tea room can open on Sundays if thirty more covers a day pay for the staff.', '', MIDDLE, '', '- Sunday walkers leave when the room is full.', '- Two of the staff want one free weekend day.', '', HEADING, '', CHECK].join('\n')

let base: View
beforeEach(() => {
  base = golden('proposal')
  useUIStore.setState({ activeOutputTab: 'olumi' } as never)
  setPagePerson(null); useMe.setState({ me: { id: '7', name: 'Ada' } } as never)
})
afterEach(() => {
  cleanup(); setPagePerson(null); useMe.setState({ me: null } as never)
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, stale: false, at: null })
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, gone: null })
})

const OPEN = 'Hire before you rent: the mechanics decide the second workshop.'
const REST = 'Ask the two part-time mechanics about more hours.'
const AFTER = 'Then price a small unit near the station.'
/** How many times these words are drawn in this element (by exact text of a drawn span). */
const drawnTimes = (el: ParentNode, words: string) => [...el.querySelectorAll('span, p, li')].filter((n) => n.children.length === 0 && n.textContent === words).length

describe('"Full answer" never repeats the lead it sits under', () => {
  it('a reply whose first paragraph IS the lead: the fold leaves that paragraph out and keeps the rest, so the lead is drawn once. CONTRAST: one word different, the paragraph stays', () => {
    const turn = (opening: string) => withTurn(base, 0, { answer: [{ text: [OPEN, '', REST, '', AFTER].join('\n') }], lead: { opening, points: [] } } as Partial<Answer>)
    let t0 = show(turn(OPEN)).querySelector<HTMLElement>('[data-view-turn="chat.0"]')!
    let full = q(t0, 'view-reply-full-body')!
    expect([drawnTimes(t0, OPEN), drawnTimes(full, OPEN), drawnTimes(full, REST), drawnTimes(full, AFTER)]).toEqual([1, 0, 1, 1])
    cleanup()
    const near = 'Hire before you rent: mechanics decide the second workshop.'
    t0 = show(turn(near)).querySelector<HTMLElement>('[data-view-turn="chat.0"]')!
    full = q(t0, 'view-reply-full-body')!
    expect([drawnTimes(full, OPEN), drawnTimes(full, REST), drawnTimes(t0, near)]).toEqual([1, 1, 1])
  })

  it('a floor reply with core\'s lead: the fold leaves the lead\'s paragraph out and keeps the rest; with no lead the reply is drawn whole, as before', () => {
    const TEXT = [OPEN, '', REST, '', AFTER].join('\n')
    const floor = { job: 21, at: '2026-11-17T11:00:00.000Z', by: 'Ada', by_id: '7', said: 'What would the second workshop need first?', text: TEXT, prose: TEXT.split('\n\n') }
    const words = (over: Record<string, unknown>) => ({ ...base, you_id: '7', you: 'Ada', start: 'words', draft: null, version: null, proposal: null, model: null, chat: [], turn: null, floor: [{ ...floor, ...over }] } as unknown as View)
    let row = show(words({ lead: { opening: OPEN, points: [] } })).querySelector<HTMLElement>('[data-testid="view-floor-turn"][data-floor-job="21"]')!
    const full = q(row, 'view-reply-full-body')!
    expect([drawnTimes(row, OPEN), drawnTimes(full, OPEN), drawnTimes(full, REST), drawnTimes(full, AFTER)]).toEqual([1, 0, 1, 1])
    cleanup()
    row = show(words({})).querySelector<HTMLElement>('[data-testid="view-floor-turn"][data-floor-job="21"]')!
    expect([q(row, 'view-reply-full'), drawnTimes(row, OPEN), drawnTimes(row, REST)]).toEqual([null, 1, 1])
  })

  it('a first draft: only the check (under core\'s heading) is looked at, so a lead that matches the first answer\'s opening leaves the first answer whole, as earlier material', () => {
    const OPENING = 'The tea room can open on Sundays if thirty more covers a day pay for the staff.'
    const t0 = show(withTurn(base, 0, { answer: [{ text: FIRST }], first_answer: { label: LABEL, heading: HEADING }, lead: { opening: OPENING, points: [] } } as Partial<Answer>)).querySelector<HTMLElement>('[data-view-turn="chat.0"]')!
    expect([drawnTimes(t0, OPENING), drawnTimes(t0, CHECK), t0.querySelector('[data-reply-label]')?.textContent]).toEqual([2, 1, LABEL])
  })

  it('a first draft whose check is nothing but the lead keeps its heading and that paragraph, so the fold still says it is the check', () => {
    const t0 = show(withTurn(base, 0, { answer: [{ text: FIRST }], first_answer: { label: LABEL, heading: HEADING }, lead: { opening: CHECK, points: [] } } as Partial<Answer>)).querySelector<HTMLElement>('[data-view-turn="chat.0"]')!
    expect([drawnTimes(t0, CHECK), t0.querySelector('[data-reply-heading]')?.textContent]).toEqual([2, HEADING])
  })
})
