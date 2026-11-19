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
import { cleanup, fireEvent, render } from '@testing-library/react'
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { setPagePerson } from '../../../../olumiCore/team/api'
import { useMe } from '../../../../olumiCore/me'
import type { View, ViewTurn } from '../../../client'
import { useViewStore } from '../../../store'
import { useUIStore } from '../../../../stores/uiStore'
import { ViewChat, useViewChat } from '../../../ViewChat'
import { floorOf, leadOf } from '../../../early'
import { FULL_ANSWER } from '../ReplyLead'
import { LEAD_WORDS, SHOW_WHOLE_FIRST } from '../../../ViewChat'
import { typography } from '../../../../styles/typography'

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
  it('PAIRED first draft (Codex 19:46:53Z, the current answer has the authority position): core\'s lead FIRST, the check under core\'s heading in the one closed fold, then the first answer beneath as earlier material under core\'s label (its opening at rest, the rest one press away); nothing said twice. CONTRASTS: a first answer that is its opening alone has nothing to press; a reply that ends at the first answer has no fold; a lead with no first answer folds the whole reply as before; no lead is drawn as today', () => {
    const OPENING = 'The tea room can open on Sundays if thirty more covers a day pay for the staff.'
    const view = withTurn(base, 0, { answer: [{ text: FIRST }], first_answer: { label: LABEL, heading: HEADING }, lead: LEAD } as Partial<Answer>, { early: { text: KEPT_FIRST } })
    const t0 = show(view).querySelector<HTMLElement>('[data-view-turn="chat.0"]')!
    const label = t0.querySelector<HTMLElement>('[data-reply-label]')!, opening = t0.querySelector<HTMLElement>('[data-reply-para][data-reply-opening]')!, heading = t0.querySelector<HTMLElement>('[data-reply-heading]')!
    const lead = q(t0, 'view-reply-lead')!, full = t0.querySelector<HTMLDetailsElement>('[data-testid="view-reply-full"]')!
    // In this order: the lead (the current answer), its fold, then the earlier first answer under core's label.
    const order = [lead, full, label, opening]
    for (let k = 0; k + 1 < order.length; k++) expect(order[k]!.compareDocumentPosition(order[k + 1]!) & Node.DOCUMENT_POSITION_FOLLOWING, `order ${k}`).toBeTruthy()
    expect([label.textContent, opening.textContent]).toEqual([LABEL, OPENING])
    expect([label, opening, lead].map((e) => e.closest('details')), 'at rest, outside any fold').toEqual([null, null, null])
    expect(t0.querySelector('[data-view="chat.0.answer.lead.opening"]')?.textContent).toBe(LEAD.opening)
    expect([0, 1].map((i) => t0.querySelector(`[data-view="chat.0.answer.lead.points.${i}"]`)?.textContent)).toEqual(LEAD.points)
    // ONE fold, closed: core's check heading, then the check's own words, and the kept first answer; the first answer's label and words are NOT in it.
    expect(t0.querySelectorAll('[data-testid="view-reply-full"]')).toHaveLength(1)
    expect([full.open, full.querySelector('summary')?.textContent]).toEqual([false, FULL_ANSWER])
    const body = q(full, 'view-reply-full-body')!
    expect([body.contains(heading), heading.textContent]).toEqual([true, HEADING])
    expect(body).toHaveTextContent(CHECK)
    const checkPara = [...body.querySelectorAll<HTMLElement>('[data-reply-para]')].find((e) => e.textContent === CHECK)!
    expect(heading.compareDocumentPosition(checkPara) & Node.DOCUMENT_POSITION_FOLLOWING, 'the heading opens the check').toBeTruthy()
    expect(body.contains(q(t0, 'view-chat-early'))).toBe(true)
    // (The kept first answer, where an older turn carries one, keeps its own caption inside the fold: bound by element, not by the label's words.)
    expect([body.querySelector('[data-reply-label]'), ...[OPENING, MIDDLE].map((x) => body.textContent!.includes(x))], 'the first answer is said once, beneath').toEqual([null, false, false])
    for (const x of [OPENING, HEADING, CHECK]) expect(t0.textContent!.split(x).length - 1, x).toBe(1)
    expect(t0.querySelectorAll('[data-reply-label]')).toHaveLength(1)
    // Paul, 19 Nov (one expansion, not three): the first answer is drawn WHOLE at rest under core's label, its later detail once and outside the
    // fold; there is no second "Show the whole first answer". CONTRAST: the check stays in the one "Full answer" fold (asserted above).
    expect(q(t0, 'view-reply-fold'), 'no second fold').toBeNull()
    expect([t0.textContent!.split(MIDDLE).length - 1, body.textContent!.includes(MIDDLE), t0.textContent!.includes('Two of the staff want one free weekend day.')]).toEqual([1, false, true])
    const next = q(t0, 'view-chat-next')
    if (next !== null) expect(full.contains(next)).toBe(false)
    cleanup()
    // CONTRAST 1, a first answer that is its opening alone: nothing to press for; the lead leads and the fold holds core's heading and the check.
    const SHORT = [LABEL, '', OPENING, '', HEADING, '', CHECK].join('\n')
    const l0 = show(withTurn(base, 0, { answer: [{ text: SHORT }], first_answer: { label: LABEL, heading: HEADING }, lead: LEAD } as Partial<Answer>)).querySelector<HTMLElement>('[data-view-turn="chat.0"]')!
    expect([q(l0, 'view-reply-fold'), l0.querySelector('[data-reply-para][data-reply-opening]')?.textContent, q(q(l0, 'view-reply-full')!, 'view-reply-full-body')!.textContent, q(l0, 'view-reply-lead')!.compareDocumentPosition(l0.querySelector('[data-reply-label]')!) & Node.DOCUMENT_POSITION_FOLLOWING ? 'lead first' : 'label first'])
      .toEqual([null, OPENING, `${HEADING}${CHECK}`, 'lead first'])
    cleanup()
    // CONTRAST 2, the reply ends at the first answer (core sends no heading): the lead, nothing to fold, and the first answer beneath.
    const ENDS = [LABEL, '', OPENING].join('\n')
    const e0 = show(withTurn(base, 0, { answer: [{ text: ENDS }], first_answer: { label: LABEL, heading: null }, lead: LEAD } as Partial<Answer>)).querySelector<HTMLElement>('[data-view-turn="chat.0"]')!
    expect([e0.querySelector('[data-reply-label]')?.textContent, e0.querySelector('[data-reply-para][data-reply-opening]')?.textContent, q(e0, 'view-reply-full'), e0.querySelector('[data-reply-heading]'), q(e0, 'view-reply-lead')!.compareDocumentPosition(e0.querySelector('[data-reply-label]')!) & Node.DOCUMENT_POSITION_FOLLOWING ? 'lead first' : 'label first'])
      .toEqual([LABEL, OPENING, null, null, 'lead first'])
    cleanup()
    // CONTRAST 2b, core's heading with nothing after it (no check to fold): no fold is drawn over a bare heading.
    const BARE = [LABEL, '', OPENING, '', HEADING].join('\n')
    const b0 = show(withTurn(base, 0, { answer: [{ text: BARE }], first_answer: { label: LABEL, heading: HEADING }, lead: LEAD } as Partial<Answer>)).querySelector<HTMLElement>('[data-view-turn="chat.0"]')!
    expect([q(b0, 'view-reply-full'), q(b0, 'view-reply-lead') !== null, b0.querySelector('[data-reply-para][data-reply-opening]')?.textContent]).toEqual([null, true, OPENING])
    cleanup()
    // CONTRAST 3, a lead and NO first answer (any later reply): unchanged, the lead first and the whole reply in the one fold.
    const PLAIN = 'A later reply in two paragraphs.\n\nIts second paragraph.'
    const p1 = show(withTurn(base, 0, { answer: [{ text: PLAIN }], lead: LEAD } as Partial<Answer>)).querySelector<HTMLElement>('[data-view-turn="chat.0"]')!
    const pf = p1.querySelector<HTMLDetailsElement>('[data-testid="view-reply-full"]')!
    expect([pf.open, q(pf, 'view-reply-full-body')!.textContent, p1.querySelector('[data-reply-label]'), q(p1, 'view-reply-lead')!.compareDocumentPosition(pf) & Node.DOCUMENT_POSITION_FOLLOWING ? 'lead first' : 'fold first'])
      .toEqual([false, 'A later reply in two paragraphs.Its second paragraph.', null, 'lead first'])
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

  it('the panel\'s one large line, on the NEWEST reply: the CURRENT answer\'s lead is the large line, and an earlier first answer beneath it never is, however short. With NO lead (a reply stored before leads existed) the first answer under core\'s label is still never the large line, and nothing is folded or reordered. CONTRASTS: a no-lead reply with no first answer keeps its large opening; a lead with no first answer is the large line', () => {
    const newest = base.chat.map((t) => t.answer !== null).lastIndexOf(true), turn = `chat.${newest}`
    const OPENING = 'Open on Sundays only if thirty more covers a day pay for the staff.'
    const TEXT = [LABEL, '', OPENING, '', HEADING, '', CHECK].join('\n')
    const big = (e: Element | null | undefined) => e != null && e.className.includes(typography.viewPanelHeadline)
    expect([OPENING, LEAD.opening].map((x) => x.trim().split(/\s+/).length <= LEAD_WORDS), 'fixture: both are short enough to be the large line').toEqual([true, true])
    const t = show(withTurn(base, newest, { answer: [{ text: TEXT }], first_answer: { label: LABEL, heading: HEADING }, lead: LEAD } as Partial<Answer>)).querySelector<HTMLElement>(`[data-view-turn="${turn}"]`)!
    expect([big(q(t, 'view-reply-lead')!.querySelector('[data-reply-opening]')), big(t.querySelector('[data-reply-para][data-reply-opening]'))], 'the lead, not the earlier answer').toEqual([true, false])
    cleanup()
    // No lead (a reply stored before leads existed, or one whose lead is not well formed): drawn whole in stored order, nothing folded (the check at rest under
    // core's heading), and the first answer under core's label is NOT the large line: it would stand largest above its own check.
    const n = show(withTurn(base, newest, { answer: [{ text: TEXT }], first_answer: { label: LABEL, heading: HEADING } } as Partial<Answer>)).querySelector<HTMLElement>(`[data-view-turn="${turn}"]`)!
    const under = n.querySelector<HTMLElement>('[data-reply-para][data-reply-opening]')
    expect([q(n, 'view-reply-lead'), q(n, 'view-reply-full'), under?.textContent, big(under), n.querySelector('[data-reply-label]')?.textContent, n.querySelector('[data-reply-heading]')?.closest('details') ?? null]).toEqual([null, null, OPENING, false, LABEL, null])
    expect(n.querySelector('[data-reply-label]')!.compareDocumentPosition(under!) & Node.DOCUMENT_POSITION_FOLLOWING, 'stored order kept: the label, then the first answer').toBeTruthy()
    cleanup()
    // CONTRAST, the same words with NO first answer from core (no label line): an ordinary newest reply keeps its large opening.
    const o = show(withTurn(base, newest, { answer: [{ text: [OPENING, '', CHECK].join('\n') }] } as Partial<Answer>)).querySelector<HTMLElement>(`[data-view-turn="${turn}"]`)!
    const plain = o.querySelector<HTMLElement>('[data-reply-para][data-reply-opening]')
    expect([plain?.textContent, big(plain), o.querySelector('[data-reply-label]')]).toEqual([OPENING, true, null])
    cleanup()
    const c = show(withTurn(base, newest, { answer: [{ text: 'A later reply.\n\nIts second paragraph.' }], lead: LEAD } as Partial<Answer>)).querySelector<HTMLElement>(`[data-view-turn="${turn}"]`)!
    expect(big(q(c, 'view-reply-lead')!.querySelector('[data-reply-opening]'))).toBe(true)
  })

  it('a floor reply with core\'s lead: the lead first, the reply as today folded beneath, Keep is the one chooser beside the lead (the fold offers none, so each entry has one control). CONTRAST: no lead, the reply at rest as today', () => {
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
    expect(full.querySelectorAll('[data-testid="view-keep-idea-button"]')).toHaveLength(0)
    expect(full.contains(q(row, 'view-keep-choose'))).toBe(false)
    expect(q(row, 'view-keep-choose')).not.toBeNull()
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
