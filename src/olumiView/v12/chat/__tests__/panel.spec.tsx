/**
 * sx-panel (PANEL-SPEC, 16 Nov 2026): the right-hand panel carries the coaching cleanly. One row per behaviour, bound by identity (test ids,
 * `data-view` paths, core's exact words read back from the View) with a contrast, on core's recorded Views (golden/proposal: a proposal waiting
 * and a newest reply with a real move, the state every benchmark journey of 17 Nov ends in; fixtures/session/after-find-first: no proposal,
 * the newest reply's move is the step; golden/bakery: a figure the chances wait on). Long replies are added in the shape core sends them
 * (first draft: core's label line, the answer, core's check heading, the check; later replies: an opening paragraph, then lists of 6 to 21
 * items), with invented words.
 *
 * 1. One next step, at the top, its button in view at rest.   2. The opening of every reply shows; a long reply folds its tail; one 18 px line.
 * 3. No second rendering of what is drawn elsewhere.          4. One input for one thing.
 * 5. No form open unless asked.                               6. The composer keeps its four method icons and its menu.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import type { View, ViewTurn } from '../../../client'
import { useViewStore } from '../../../store'
import { useUIStore } from '../../../../stores/uiStore'
import { REST_ITEMS, REVIEW_CHANGES, SHOW_LESS, SHOW_WHOLE_FIRST, SHOW_WHOLE_REPLY, ViewChat, ViewComposer, useViewChat } from '../../../ViewChat'
import { typography } from '../../../../styles/typography'

const golden = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${n}.view.json`), 'utf8'))
const session = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/session', `${n}.view3.json`), 'utf8'))
const show = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null })
  return render(<ViewChat />).container
}
const q = <T extends Element = HTMLElement>(c: ParentNode, id: string) => c.querySelector<T & HTMLElement>(`[data-testid="${id}"]`)
const qa = (c: ParentNode, id: string) => [...c.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)]
const before = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
const words = (parts: readonly ({ text: string } | { cite: string })[]) => parts.map((p) => ('text' in p ? p.text : '')).join('')
type Answer = NonNullable<ViewTurn['answer']>
const withAnswer = (v: View, i: number, a: Partial<Answer>): View => ({ ...v, chat: v.chat.map((t, j) => (j === i && t.answer !== null ? { ...t, answer: { ...t.answer, ...a } } : t)) })

beforeEach(() => useUIStore.setState({ activeOutputTab: 'olumi' } as never))
afterEach(() => {
  cleanup()
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, at: null })
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, gone: null })
})

// Invented words in core's real shapes (benchmark round 0, 17 Nov: every first answer carries `first_answer` and its heading; later replies run
// 700 to 3,400 characters with up to 21 list items and no Why lines).
const LABEL = 'A first answer from your brief and general knowledge, written before the model. Not checked against the model.'
const HEADING = 'Olumi’s check against the model'
const OPENING = 'The tea room can open on Sundays if the extra staff cost is covered by at least thirty more covers a day, which nobody has counted yet.'
const FIRST = [
  LABEL, '', OPENING, '', 'What each side rests on:', '',
  '- Sunday walkers ask for tables and leave when the room is full.', '- Two of the staff have said they want one free weekend day.',
  '- The kitchen would need a second delivery on Saturday.', '- The landlord allows Sunday trading from spring.', '- A trial month would show the real count.',
  '', 'One middle path is to open for lunch only.', '', HEADING, '', 'The model holds the staff cost but not the extra covers, so it cannot yet say which way it falls.',
].join('\n')
const LATER_OPEN = 'Counting the turned-away walkers is the quickest way to size this.'
const ITEMS = ['Keep a tally by the door for four Sundays.', 'Note the time each group leaves.', 'Ask the bakery for a Saturday slot.', 'Check last spring’s takings.', 'Ask the two staff which day suits.', 'Price a lunch-only menu.']
const LATER = [LATER_OPEN, '', ...ITEMS.map((x) => `- ${x}`), '', 'Bring the tally back and Olumi will put it on the covers card.'].join('\n')

describe('1. one next step, at the top, with its button in view at rest', () => {
  it('a waiting proposal: its card sits above the conversation, closed, with Approve drawn at rest; the change list waits for a press', () => {
    const view = golden('proposal'), p = view.proposal!
    const c = show(view)
    const top = q(c, 'view-chat-pinned')!, scroll = q(c, 'view-chat-scroll')!
    expect(top).not.toBeNull()
    expect(before(top, scroll)).toBe(true) // above the thread, never under it
    expect(scroll.contains(top)).toBe(false)
    expect(qa(c, 'view-next-step')).toHaveLength(1) // ONE step on the panel
    const review = q(top, 'view-proposal-review')!
    expect(review.getAttribute('data-open')).toBe('false') // closed at rest
    expect(q(top, 'view-proposal-row')!.textContent).toBe(`${p.heading} · ${p.on}`) // core's words, exactly
    const approve = q(top, 'view-approve')!
    expect(approve).toHaveTextContent(p.actions?.approve ?? 'Approve')
    expect(approve.closest('[hidden]')).toBeNull() // in view at rest, not inside a hidden body
    expect(q(top, 'view-changes')).toBeNull() // the list is read on a press, never approved blind from it
    // CONTRAST: opening the row draws the list under the same card, Approve still there once.
    fireEvent.click(q(top, 'view-proposal-row')!)
    expect(review.getAttribute('data-open')).toBe('true')
    expect(q(top, 'view-changes')).not.toBeNull()
    expect(qa(c, 'view-approve')).toHaveLength(1)
  })

  it('the newest reply\'s move is the step: drawn once, in the card at the top, filled, in core\'s words; the reply does not draw it again', () => {
    const view = session('after-find-first'), k = view.chat.length - 1, next = view.chat[k]!.answer!.next
    expect([view.proposal, next.newest, typeof next.move]).toEqual([null, true, 'string']) // the fixture's own state, bound here
    const c = show(view)
    const top = q(c, 'view-chat-step')!, scroll = q(c, 'view-chat-scroll')!
    expect(before(top, scroll)).toBe(true)
    const step = q(top, 'view-next-step')!
    expect(step.getAttribute('data-step')).toBe('move')
    const tap = q(step, 'view-next-move')!
    expect(tap.getAttribute('data-move')).toBe(next.move)
    expect(tap.querySelector(`[data-view="chat.${k}.answer.next.label"]`)?.textContent).toBe(next.label)
    expect(step.querySelector(`[data-view="chat.${k}.answer.next.text.0.text"]`)?.textContent).toBe(words(next.text).length > 0 ? (next.text[0] as { text: string }).text : null)
    // Said once on the whole panel: one tap, one copy of the words, none of it under the newest reply.
    expect(qa(c, 'view-next-move')).toHaveLength(1)
    expect(c.querySelectorAll(`[data-view="chat.${k}.answer.next.text.0.text"]`)).toHaveLength(1)
    const latest = q(c, 'view-chat-latest')!
    expect(q(latest, 'view-chat-next')).toBeNull()
    expect(q(latest, 'view-next-move')).toBeNull()
    // CONTRAST: an older reply keeps its own next line, under it.
    expect(c.querySelector('[data-view-turn="chat.0"] [data-testid="view-chat-next"]')).not.toBeNull()
  })

  it('with a proposal waiting, the newest reply keeps its own next line and a quiet tap; the one filled button is Approve, at the top', () => {
    const view = golden('proposal'), k = view.chat.length - 1
    const c = show(view)
    const latest = q(c, 'view-chat-latest')!
    expect(latest.querySelector(`[data-view="chat.${k}.answer.next.label"]`)?.textContent).toBe(view.chat[k]!.answer!.next.label)
    expect(q(q(c, 'view-chat-pinned')!, 'view-next-move')).toBeNull() // the move is not the step here
    expect(q(c, 'view-chat-step')).toBeNull()
  })

  it('Olumi\'s readings wait for a choice: the closed card\'s filled button opens the review instead of approving blind', () => {
    const view = golden('proposal'), p = view.proposal!
    const marks = [{ what: 'Weekly visitors', status: 'Olumi read your message as 40 a week', title: 'From your words', reading: { id: 'r1' } }]
    const c = show({ ...view, proposal: { ...p, marks } } as unknown as View)
    const top = q(c, 'view-chat-pinned')!
    expect(q(top, 'view-approve')).toBeNull()
    const review = q(top, 'view-review-changes')!
    expect(review).toHaveTextContent(REVIEW_CHANGES)
    fireEvent.click(review)
    expect(q(top, 'view-proposal-review')!.getAttribute('data-open')).toBe('true')
    expect(q(top, 'view-reading-0')).not.toBeNull() // the choice is now in front of the person
    expect(qa(c, 'view-approve')).toHaveLength(1) // and Approve with it, once
  })
})

describe('2. the opening of every reply shows; a long reply folds its tail', () => {
  it('a first answer: core\'s label, its opening paragraph and core\'s whole check show at rest; its middle sits behind one press', () => {
    const base = golden('proposal')
    const view = withAnswer(base, 0, { answer: [{ text: FIRST }], first_answer: { label: LABEL, heading: HEADING } } as Partial<Answer>)
    const t0 = show(view).querySelector<HTMLElement>('[data-view-turn="chat.0"]')!
    expect(t0.querySelector('[data-reply-label]')?.textContent).toBe(LABEL)
    expect(t0.querySelector('[data-reply-opening]')?.textContent).toBe(OPENING) // never folded away
    expect(t0.querySelector('[data-reply-heading]')?.textContent).toBe(HEADING) // the check always shows
    expect(t0).toHaveTextContent('The model holds the staff cost but not the extra covers')
    expect(t0).not.toHaveTextContent('What each side rests on:') // the middle waits
    const fold = q(t0, 'view-reply-fold')!
    expect(fold).toHaveTextContent(SHOW_WHOLE_FIRST)
    fireEvent.click(fold)
    expect(t0).toHaveTextContent('What each side rests on:')
    expect(t0).toHaveTextContent('A trial month would show the real count.')
    expect(q(t0, 'view-reply-fold')).toHaveTextContent(SHOW_LESS)
  })

  it('a later long reply (no first_answer): its opening and the first three list items at rest, the rest behind one press', () => {
    const base = golden('proposal'), k = base.chat.length - 1
    const c = show(withAnswer(base, k, { answer: [{ text: LATER }] }))
    const latest = q(c, 'view-chat-latest')!
    expect(latest.querySelector('[data-reply-opening]')?.textContent).toBe(LATER_OPEN)
    const shown = [...latest.querySelectorAll('[data-reply-list] > li')].map((li) => li.textContent)
    expect(shown).toEqual(ITEMS.slice(0, REST_ITEMS)) // whole items, in core's order
    expect(latest).not.toHaveTextContent(ITEMS[REST_ITEMS]!)
    fireEvent.click(q(latest, 'view-reply-fold')!)
    expect([...latest.querySelectorAll('[data-reply-list] > li')].map((li) => li.textContent)).toEqual(ITEMS)
    expect(latest).toHaveTextContent('Bring the tally back and Olumi will put it on the covers card.')
    // CONTRAST: a short reply has no fold and is drawn whole.
    cleanup()
    const short = q(show(withAnswer(base, k, { answer: [{ text: 'Count the walkers first.\n\nThen we size the room.' }] })), 'view-chat-latest')!
    expect(q(short, 'view-reply-fold')).toBeNull()
    expect(q(show(withAnswer(base, k, { answer: [{ text: LATER }] })), 'view-reply-fold')).toHaveTextContent(SHOW_WHOLE_REPLY)
  })

  it('a cite keeps its number by its place in core\'s parts while the blocks before it are folded', () => {
    const base = golden('proposal')
    const cut = FIRST.indexOf('- A trial month would show the real count.') + '- A trial month would show the real count'.length
    expect(cut).toBeGreaterThan(100)
    // part 1 (a cite) sits in the folded list; part 3 (a cite) in core's check, which always shows.
    const answer = [{ text: FIRST.slice(0, cut) }, { cite: 'Trial note' }, { text: `.\n\n${HEADING}\n\nThe check rests on one source` }, { cite: 'Staff rota' }, { text: '.' }]
    const t0 = show(withAnswer(base, 0, { answer, first_answer: { label: LABEL, heading: HEADING } } as Partial<Answer>)).querySelector<HTMLElement>('[data-view-turn="chat.0"]')!
    expect(t0.querySelector('[data-view-cite="chat.0.answer.answer.1.cite"]')).toBeNull() // folded with its list
    expect(t0.querySelector('[data-view-cite="chat.0.answer.answer.3.cite"]')?.textContent).toBe('2') // its own place, not 1
  })

  it('the newest reply\'s opening is the one 18 px line when it is 20 words or fewer; a longer opening, and an older reply, stay body size', () => {
    const base = golden('proposal'), k = base.chat.length - 1
    const big = q(show(withAnswer(base, k, { answer: [{ text: LATER }] })), 'view-chat-latest')!.querySelector<HTMLElement>('[data-reply-opening]')!
    expect(big.className).toContain(typography.viewPanelHeadline)
    cleanup()
    const long = `${OPENING} It also depends on the weather.` // 32 words
    const c = show(withAnswer(withAnswer(base, k, { answer: [{ text: long }] }), 0, { answer: [{ text: LATER_OPEN }] }))
    expect(q(c, 'view-chat-latest')!.querySelector<HTMLElement>('[data-reply-opening]')!.className).not.toContain(typography.viewPanelHeadline)
    expect(c.querySelector<HTMLElement>('[data-view-turn="chat.0"] [data-reply-opening]')!.className).not.toContain(typography.viewPanelHeadline)
  })
})

describe('3 and 4. nothing said twice; one input for one thing', () => {
  it('the figure the step asks for has ONE box, in the step; Olumi\'s question about the same figure is not drawn again, another one is', () => {
    const view = golden('bakery'), item = view.model!.run!.waits_on!.items.find((i) => i.edit !== null)!
    const trial = [{ id: item.id, title: 'What does the new oven cost?', edit: item.edit }, { id: 'flour_price', title: 'What does a sack of flour cost?', edit: null }]
    const c = show({ ...view, model: { ...view.model!, trial_questions: trial } } as unknown as View)
    expect(q(c, 'view-next-step')!.getAttribute('data-step')).toBe('figure')
    expect(c.querySelectorAll(`[data-question-id="${item.id}"]`)).toHaveLength(0)
    expect(c.querySelectorAll('[data-question-id="flour_price"]')).toHaveLength(1) // CONTRAST: another figure's question stays
  })
})

describe('5 and 6. no form unless asked; the composer keeps its tools', () => {
  it('at rest the panel holds no form field; the commitment form opens only on its own press', async () => {
    const c = show(session('after-find-first'))
    expect(c.querySelectorAll('textarea, input[type="text"]')).toHaveLength(0)
    const open = q(c, 'commit-form-open')
    expect(open).not.toBeNull()
    await act(async () => { fireEvent.click(open!) })
    expect(q(c, 'commit-form-action')).not.toBeNull() // CONTRAST: asked for, it opens
  })

  it('the composer keeps its four method icons and the ⋯ menu beside Send', () => {
    useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: session('after-find-first').id, view: session('after-find-first'), status: 'ready', error: null, stale: false, at: null })
    const c = render(<ViewComposer />).container
    expect(['assumption', 'opposite', 'disconfirming', 'outside'].map((k) => q(c, `view-composer-method-${k}`) !== null)).toEqual([true, true, true, true])
    expect(q(c, 'view-actions-button')).not.toBeNull()
    expect(q(c, 'view-composer-send')).not.toBeNull()
  })
})
