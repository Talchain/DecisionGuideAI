/**
 * The reply's short lead with the full answer folded (Paul 11:02Z; DL 11:06:45Z): core's `lead: { opening, points }` on a turn's answer and on a
 * floor row is drawn first, verbatim, and the whole answer as today sits under ONE "Full answer", closed at rest. On a first draft the kept first
 * answer and the check fold under the same lead. No lead, or a malformed one, or one that says the whole answer: drawn exactly as before.
 * Real mounted ViewChat, the real stores; rows bind by `data-view` path and test id, each with a contrast. All words are invented.
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
import { floorOf, leadOf } from '../../../early'
import { FULL_ANSWER } from '../ReplyLead'

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
const KEPT_FIRST = 'Open on Sundays only if the extra covers pay for the staff.'
const LEAD = { opening: 'Sunday opening pays only if about thirty more covers come in. Nobody has counted them yet.', points: ['Count turned-away walkers for four Sundays.', 'Ask the two staff which day suits them.'] }

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

describe('a reply with core\'s lead: the lead first, the whole answer folded under one "Full answer", closed at rest', () => {
  it('PAIRED first draft: the opening and each point in core\'s words; the kept first answer, the first answer and the check all inside the ONE closed fold; the next step stays outside. CONTRAST: the same turn with no lead is drawn as today', () => {
    const view = withTurn(base, 0, { answer: [{ text: FIRST }], first_answer: { label: LABEL, heading: HEADING }, lead: LEAD } as Partial<Answer>, { early: { text: KEPT_FIRST } })
    const t0 = show(view).querySelector<HTMLElement>('[data-view-turn="chat.0"]')!
    expect(t0.querySelector('[data-view="chat.0.answer.lead.opening"]')?.textContent).toBe(LEAD.opening)
    expect([0, 1].map((i) => t0.querySelector(`[data-view="chat.0.answer.lead.points.${i}"]`)?.textContent)).toEqual(LEAD.points)
    const full = t0.querySelector<HTMLDetailsElement>('[data-testid="view-reply-full"]')!
    expect(t0.querySelectorAll('[data-testid="view-reply-full"]')).toHaveLength(1)
    expect(full.open).toBe(false)
    expect(full.querySelector('summary')?.textContent).toBe(FULL_ANSWER)
    const body = q(full, 'view-reply-full-body')!
    expect(body.contains(q(t0, 'view-chat-early'))).toBe(true) // the kept first answer folds under the lead
    expect(body.querySelector('[data-reply-label]')?.textContent).toBe(LABEL)
    expect(body.querySelector('[data-reply-heading]')?.textContent).toBe(HEADING) // the check folds under the same lead
    expect(body).toHaveTextContent(CHECK)
    expect(body).toHaveTextContent(MIDDLE) // the whole answer, not a second fold of it
    expect(q(t0, 'view-reply-fold')).toBeNull()
    const lead = q(t0, 'view-reply-lead')!
    expect(full.contains(lead)).toBe(false)
    expect(lead.compareDocumentPosition(full) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const next = q(t0, 'view-chat-next')
    if (next !== null) expect(full.contains(next)).toBe(false)
    cleanup()
    const plain = withTurn(base, 0, { answer: [{ text: FIRST }], first_answer: { label: LABEL, heading: HEADING } } as Partial<Answer>, { early: { text: KEPT_FIRST } })
    const p0 = show(plain).querySelector<HTMLElement>('[data-view-turn="chat.0"]')!
    expect(q(p0, 'view-reply-lead')).toBeNull()
    expect(q(p0, 'view-reply-full')).toBeNull()
    expect(p0.querySelector('[data-reply-heading]')?.textContent).toBe(HEADING) // today: the check shows at rest
    expect(q(p0, 'view-reply-fold')).toBeNull() // CHANGED BY DESIGN (Codex UI P1, 17 Nov): no lead, drawn whole
    expect(p0).toHaveTextContent(MIDDLE)
    expect(q(p0, 'view-chat-early')?.closest('details')).toBeNull()
  })

  it('a floor reply with core\'s lead: the lead first, the reply as today folded beneath, Keep still on each of its lines there. CONTRAST: no lead, the reply at rest as today', () => {
    const TEXT = 'A mechanic before a lease.\n\nAsk the two part-time mechanics about more hours.\n\nThen price a small unit near the station.'
    const floor = { job: 21, at: '2026-11-17T11:00:00.000Z', by: 'Ada', by_id: '7', said: 'What would the second workshop need first?', text: TEXT, prose: TEXT.split('\n\n') }
    const words = (over: Record<string, unknown>) => ({ ...base, you_id: '7', you: 'Ada', start: 'words', draft: null, version: null, proposal: null, model: null, chat: [], turn: null, floor: [{ ...floor, ...over }] } as unknown as View)
    const c = show(words({ lead: { opening: 'Hire before you rent.', points: ['Ask the two mechanics first.'] } }))
    const row = c.querySelector<HTMLElement>('[data-testid="view-floor-turn"][data-floor-job="21"]')!
    expect(row.querySelector('[data-view="floor.21.lead.opening"]')?.textContent).toBe('Hire before you rent.')
    expect(row.querySelector('[data-view="floor.21.lead.points.0"]')?.textContent).toBe('Ask the two mechanics first.')
    const full = row.querySelector<HTMLDetailsElement>('[data-testid="view-reply-full"]')!
    expect(full.open).toBe(false)
    expect(full.contains(q(row, 'view-floor-reply-text'))).toBe(true)
    expect(full.querySelectorAll('[data-testid="view-keep-idea-button"]')).toHaveLength(3)
    expect(q(row, 'view-floor-reply')!.hasAttribute('data-latest-floor')).toBe(true) // the thread still rests on Olumi's reply
    cleanup()
    const d = show(words({}))
    const r2 = d.querySelector<HTMLElement>('[data-testid="view-floor-turn"][data-floor-job="21"]')!
    expect(q(r2, 'view-reply-full')).toBeNull()
    expect(q(r2, 'view-floor-reply-text')?.closest('details')).toBeNull()
    expect(r2.querySelectorAll('[data-testid="view-keep-idea-button"]')).toHaveLength(3)
  })

  it('readers: a malformed lead is none; a lead that says the whole answer folds nothing; floorOf carries a well-formed lead', () => {
    const full = 'Hire before you rent.\n\n- Ask the two mechanics first.'
    expect(leadOf({ lead: { opening: 'Hire before you rent.', points: ['Ask first.'] } }, full)).toEqual({ opening: 'Hire before you rent.', points: ['Ask first.'] })
    expect(leadOf({ lead: { opening: 'Hire before you rent.', points: ['Ask the two mechanics first.'] } }, full)).toBeNull() // says it all: drawn as before
    expect(leadOf({ lead: { opening: ' ', points: [] } }, full)).toBeNull()
    expect(leadOf({ lead: { opening: 'Hire.', points: ['ok', 3] } }, full)).toBeNull()
    expect(leadOf({ lead: { opening: 'Hire.', points: [''] } }, full)).toBeNull()
    expect(leadOf({ lead: { opening: 'Hire.' } }, full)).toBeNull()
    expect(leadOf({}, full)).toBeNull()
    expect(leadOf({ lead: { opening: 'Hire.', points: [] } }, full)).toEqual({ opening: 'Hire.', points: [] })
    const row = { job: 3, at: 'x', by: 'Ada', by_id: '7', said: 'Q?', text: full }
    expect(floorOf({ floor: [{ ...row, lead: { opening: 'Hire.', points: [] } }] })[0]?.lead).toEqual({ opening: 'Hire.', points: [] })
    expect(floorOf({ floor: [{ ...row, lead: { opening: 'Hire.', points: [7] } }] })[0]?.lead).toBeUndefined()
  })
})
