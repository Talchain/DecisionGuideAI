/**
 * sx-panel (PANEL-SPEC, 16 Nov 2026): the right-hand panel carries the coaching cleanly. One row per behaviour, bound by identity (test ids,
 * `data-view` paths, core's exact words read back from the View) with a contrast, on core's recorded Views (golden/proposal: a proposal waiting
 * and a newest reply with a real move, the state every benchmark journey of 17 Nov ends in; fixtures/session/after-find-first: no proposal,
 * the newest reply's move is the step; golden/bakery: a figure the chances wait on). Long replies are added in the shape core sends them
 * (first draft: core's label line, the answer, core's check heading, the check; later replies: an opening paragraph, then lists of 6 to 21
 * items), with invented words.
 *
 * 1. One next step, at the top, its button in view at rest.   2. The opening of every reply shows; a long reply folds its tail; one 18 px line;
 *                                                              a "## " line is a lead-in (the reply contract keeps core's markers, 17 Nov).
 * 3. No second rendering of what is drawn elsewhere.          4. One input for one thing.
 * 5. No form open unless asked.                               6. The composer keeps its four method icons and its menu.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import type { View, ViewTurn } from '../../../client'
import { useViewStore } from '../../../store'
import { useUIStore } from '../../../../stores/uiStore'
import { REST_ITEMS, REVIEW_CHANGES, ViewChat, ViewComposer, useViewChat } from '../../../ViewChat'
import { VIEW_NOTE_SLOT } from '../../../note'
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

describe('1. the proposal waits behind one foot-row chip', () => {
  it('a waiting proposal: its chip opens the existing collapsed review below the conversation; the change list waits for another press', () => {
    const view = golden('proposal'), p = view.proposal!
    const c = show(view)
    const top = q(c, 'view-chat-pinned')!, scroll = q(c, 'view-chat-scroll')!
    expect(top).toHaveAttribute('hidden')
    fireEvent.click(q(c, 'view-chat-foot-proposal')!)
    expect(top).not.toHaveAttribute('hidden')
    // CHANGED BY DESIGN (17 Nov, the calm panel): the pending proposal is one line at the thread's FOOT, below the thread and never inside it (was: above it).
    expect(before(scroll, top)).toBe(true) // below the thread, never over it
    expect(scroll.contains(top)).toBe(false)
    expect(qa(c, 'view-next-step')).toHaveLength(1) // ONE step on the panel
    const review = q(top, 'view-proposal-review')!
    expect(review.getAttribute('data-open')).toBe('false') // closed at rest
    expect(q(top, 'view-proposal-row')!.textContent).toBe(`${p.heading} · ${p.on}`) // core's words, exactly
    const approve = q(top, 'view-approve')!
    // CHANGED BY DESIGN (18 Nov, Paul: smallest possible buttons): Approve is a tick icon button; core's word is its name and hover, not drawn text.
    expect(approve.getAttribute('aria-label')).toContain(p.actions?.approve ?? 'Approve')
    expect(approve.querySelector('svg')).not.toBeNull()
    expect(approve.closest('[hidden]')).toBeNull() // in view at rest, not inside a hidden body
    expect(qa(top, 'view-set-aside')).toHaveLength(1) // CONTRAST to the readings row below: no reading waits, so Set aside is offered at rest
    expect(q(top, 'view-changes')).toBeNull() // the list is read on a press, never approved blind from it
    // Review draws the list under the same card, with Approve still there once.
    fireEvent.click(q(top, 'view-proposal-review-toggle')!)
    expect(review.getAttribute('data-open')).toBe('true')
    expect(q(top, 'view-changes')).not.toBeNull()
    expect(qa(c, 'view-approve')).toHaveLength(1)
  })

  it('P2: the newest reply\'s move is drawn once, at the end of that reply, filled, in core\'s words; there is no card at the top', () => {
    const view = session('after-find-first'), k = view.chat.length - 1, next = view.chat[k]!.answer!.next
    expect([view.proposal, next.newest, typeof next.move]).toEqual([null, true, 'string']) // the fixture's own state, bound here
    const c = show(view)
    expect(q(c, 'view-chat-step')).toBeNull()
    expect(q(c, 'view-next-step')).toBeNull()
    const latest = q(c, 'view-chat-latest')!
    const tap = q(latest, 'view-next-move')!
    expect(tap.getAttribute('data-move')).toBe(next.move)
    expect(tap.querySelector(`[data-view="chat.${k}.answer.next.label"]`)?.textContent).toBe(next.label)
    expect(latest.querySelector(`[data-view="chat.${k}.answer.next.text.0.text"]`)?.textContent).toBe(words(next.text).length > 0 ? (next.text[0] as { text: string }).text : null)
    // Said once on the whole panel: one tap, one copy of the words, and the tap follows the words.
    expect(qa(c, 'view-next-move')).toHaveLength(1)
    expect(c.querySelectorAll(`[data-view="chat.${k}.answer.next.text.0.text"]`)).toHaveLength(1)
    expect(before(q(latest, 'view-chat-next')!, tap)).toBe(true)
    // An older reply keeps its own next line, under it, with no tap.
    expect(c.querySelector('[data-view-turn="chat.0"] [data-testid="view-chat-next"]')).not.toBeNull()
  })

  it('with a proposal waiting, the newest reply keeps its own next line and a quiet tap; the one filled button is Approve, at the top', () => {
    const view = golden('proposal'), k = view.chat.length - 1
    const c = show(view)
    const latest = q(c, 'view-chat-latest')!
    // S4 (19 Nov, said once): the quiet tap carries core's label; the bold label is not drawn beside it.
    // The label is drawn once, INSIDE the tap (bound to core's path), never as a second bold line beside it.
    expect([...latest.querySelectorAll(`[data-view="chat.${k}.answer.next.label"]`)].map((e) => e.closest('[data-testid="view-next-move"]') !== null)).toEqual([true])
    expect(q(latest, 'view-next-move')?.textContent).toBe(view.chat[k]!.answer!.next.label)
    expect(q(q(c, 'view-chat-pinned')!, 'view-next-move')).toBeNull() // the move is not the step here
    expect(q(c, 'view-chat-step')).toBeNull()
  })

  it('Olumi\'s readings wait for a choice: the closed card\'s filled button opens the review instead of approving blind', () => {
    const view = golden('proposal'), p = view.proposal!
    const marks = [{ what: 'Weekly visitors', status: 'Olumi read your message as 40 a week', title: 'From your words', reading: { id: 'r1' } }]
    const c = show({ ...view, proposal: { ...p, marks } } as unknown as View)
    const top = q(c, 'view-chat-pinned')!
    expect(q(top, 'view-approve')).toBeNull()
    // Line reviewer F4: core refuses a set-aside that leaves a carried reading unsettled (409), so it is not offered on the closed card either.
    expect(q(top, 'view-set-aside')).toBeNull()
    const review = q(top, 'view-review-changes')!
    expect(review).toHaveTextContent(REVIEW_CHANGES)
    fireEvent.click(review)
    expect(q(top, 'view-proposal-review')!.getAttribute('data-open')).toBe('true')
    expect(q(top, 'view-reading-0')).not.toBeNull() // the choice is now in front of the person
    expect(qa(c, 'view-approve')).toHaveLength(1) // and Approve with it, once
    expect(qa(c, 'view-set-aside')).toHaveLength(1) // and Set aside, where Keep the original can be sent with it
  })
})

describe('2. the opening of every reply shows; a long reply folds its tail', () => {
  it('CHANGED BY DESIGN (Codex UI P1, 17 Nov): a first answer with no lead is drawn whole: core\'s label, its opening, its middle and its whole check at rest, no fold', () => {
    const base = golden('proposal')
    const view = withAnswer(base, 0, { answer: [{ text: FIRST }], first_answer: { label: LABEL, heading: HEADING } } as Partial<Answer>)
    const t0 = show(view).querySelector<HTMLElement>('[data-view-turn="chat.0"]')!
    expect(t0.querySelector('[data-reply-label]')?.textContent).toBe(LABEL)
    expect(t0.querySelector('[data-reply-opening]')?.textContent).toBe(OPENING) // never folded away
    expect(t0.querySelector('[data-reply-heading]')?.textContent).toBe(HEADING) // the check always shows
    expect(t0).toHaveTextContent('The model holds the staff cost but not the extra covers')
    expect(t0).toHaveTextContent('What each side rests on:') // the middle at rest: no lead, nothing folded
    expect(t0).toHaveTextContent('A trial month would show the real count.')
    expect([q(t0, 'view-reply-fold'), q(t0, 'view-reply-full')]).toEqual([null, null])
  })

  it('CHANGED BY DESIGN (Codex UI P1, 17 Nov): a later long reply with no lead is drawn whole: every list item and every paragraph at rest, no fold', () => {
    const base = golden('proposal'), k = base.chat.length - 1
    const c = show(withAnswer(base, k, { answer: [{ text: LATER }] }))
    const latest = q(c, 'view-chat-latest')!
    expect(latest.querySelector('[data-reply-opening]')?.textContent).toBe(LATER_OPEN)
    const shown = [...latest.querySelectorAll('[data-reply-list] > li')].map((li) => li.textContent)
    expect(shown).toEqual(ITEMS) // every item, in core's order (was the first REST_ITEMS behind a fold)
    expect(ITEMS.length).toBeGreaterThan(REST_ITEMS)
    expect(latest).toHaveTextContent('Bring the tally back and Olumi will put it on the covers card.')
    expect(q(latest, 'view-reply-fold')).toBeNull()
    // CONTRAST: a short reply has no fold and is drawn whole.
    cleanup()
    const short = q(show(withAnswer(base, k, { answer: [{ text: 'Count the walkers first.\n\nThen we size the room.' }] })), 'view-chat-latest')!
    expect(q(short, 'view-reply-fold')).toBeNull()
    // CONTRAST (the lead path): the same long reply WITH core's lead keeps the one "Full answer" disclosure, closed at rest.
    cleanup()
    const led = q(show(withAnswer(base, k, { answer: [{ text: LATER }], lead: { opening: 'Count the walkers first.', points: ['Then size the room.'] } } as Partial<Answer>)), 'view-chat-latest')!
    expect([q(led, 'view-reply-full')?.querySelector('summary')?.textContent, (q(led, 'view-reply-full') as HTMLDetailsElement | null)?.open]).toEqual(['Full answer', false])
  })

  it('a cite keeps its number by its place in core\'s parts while the blocks before it are folded', () => {
    const base = golden('proposal')
    const cut = FIRST.indexOf('- A trial month would show the real count.') + '- A trial month would show the real count'.length
    expect(cut).toBeGreaterThan(100)
    // part 1 (a cite) sits in the folded list; part 3 (a cite) in core's check, which always shows.
    const answer = [{ text: FIRST.slice(0, cut) }, { cite: 'Trial note' }, { text: `.\n\n${HEADING}\n\nThe check rests on one source` }, { cite: 'Staff rota' }, { text: '.' }]
    const t0 = show(withAnswer(base, 0, { answer, first_answer: { label: LABEL, heading: HEADING } } as Partial<Answer>)).querySelector<HTMLElement>('[data-view-turn="chat.0"]')!
    expect(t0.querySelector('[data-view-cite="chat.0.answer.answer.1.cite"]')?.textContent).toBe('1') // drawn whole (no lead): its own place
    expect(t0.querySelector('[data-view-cite="chat.0.answer.answer.3.cite"]')?.textContent).toBe('2') // its own place, not 1
  })

  it('a line core opens with two to six hashes is a lead-in, hashes dropped, kept at rest with the opening; one hash or seven is words, as typed', () => {
    const base = golden('proposal'), k = base.chat.length - 1
    const text = ['## What to count first', LATER_OPEN, '', '# One hash stays as typed.', '', '####### Seven stay as typed.', '', ...ITEMS.map((x) => `- ${x}`)].join('\n')
    const latest = q(show(withAnswer(base, k, { answer: [{ text }] })), 'view-chat-latest')!
    const leadIn = latest.querySelector<HTMLElement>('[data-reply-lead-in]')!
    expect(leadIn.textContent).toBe('What to count first')
    expect(leadIn.querySelector(`[data-view="chat.${k}.answer.answer.0.text"]`)?.textContent).toBe('What to count first')
    expect(leadIn.className).toContain(typography.viewPanelHeading)
    expect(latest.querySelectorAll('[data-reply-lead-in]')).toHaveLength(1)
    expect(latest.querySelector('[data-reply-opening]')?.textContent).toBe(LATER_OPEN) // the opening still shows at rest, under its lead-in
    expect(q(latest, 'view-reply-fold')).toBeNull() // no lead: drawn whole
    // CONTRAST: one hash, or seven, is the person-facing words as core wrote them.
    const paras = [...latest.querySelectorAll('[data-reply-para]')].map((p) => p.textContent)
    expect(paras).toContain('# One hash stays as typed.')
    expect(paras).toContain('####### Seven stay as typed.')
  })

  it('P2/P4: the reply\'s next step numbers its cites after the answer\'s; the Why lines (in the reply\'s one facts disclosure) follow the next step\'s', () => {
    const v = session('after-find-first'), k = v.chat.length - 1, t = v.chat[k]!
    const view = withAnswer(v, k, {
      answer: [{ text: 'An answer.' }, { cite: 'Answer source' }],
      next: { ...t.answer!.next, text: [{ text: 'Count the walkers.' }, { cite: 'Next source' }] },
      why: [[{ text: 'A reason.' }, { cite: 'Why source' }]],
    } as Partial<Answer>)
    const c = show(view)
    expect(q(c, 'view-next-step')).toBeNull() // no card at the top: the step is the reply's own
    const latest = q(c, 'view-chat-latest')!
    expect(latest.querySelector(`[data-view-cite="chat.${k}.answer.answer.1.cite"]`)?.textContent).toBe('1')
    expect(q(latest, 'view-chat-next')!.querySelector(`[data-view-cite="chat.${k}.answer.next.text.1.cite"]`)?.textContent).toBe('2')
    expect(latest.querySelector(`[data-view-cite="chat.${k}.answer.why.0.1.cite"]`), 'the Why lines wait behind the facts disclosure').toBeNull()
    fireEvent.click(q(latest, 'view-reply-rests')!)
    expect(latest.querySelector(`[data-view-cite="chat.${k}.answer.why.0.1.cite"]`)?.textContent).toBe('3')
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
  it('P2: the figure core asks for is not a step of the panel\'s own: its question is drawn once, in Olumi\'s questions, with at most one box; another figure\'s question is drawn once too', () => {
    const view = golden('bakery'), item = view.model!.run!.waits_on!.items.find((i) => i.edit !== null)!
    const trial = [{ id: item.id, title: 'What does the new oven cost?', edit: item.edit }, { id: 'flour_price', title: 'What does a sack of flour cost?', edit: null }]
    const c = show({ ...view, model: { ...view.model!, trial_questions: trial } } as unknown as View)
    expect(q(c, 'view-next-step'), 'the UI chooses no figure step of its own (system spec P2)').toBeNull()
    expect(q(c, 'next-figure-edit-' + item.id)).toBeNull()
    expect(c.querySelectorAll(`[data-question-id="${item.id}"]`)).toHaveLength(1) // said once, in the question list
    expect(c.querySelectorAll(`[data-testid$="-edit-${item.id}"]`).length).toBeLessThanOrEqual(1) // ONE box for the figure
    expect(c.querySelectorAll('[data-question-id="flour_price"]')).toHaveLength(1) // CONTRAST: another figure's question
  })
})

describe('5 and 6. no form unless asked; the composer keeps its tools', () => {
  it('at rest the panel holds no form field; the commitment form opens only on its own press', async () => {
    const c = show(session('after-find-first'))
    expect(c.querySelectorAll('textarea, input[type="text"]')).toHaveLength(0)
    expect(q(c, 'commit-form-open'), 'no foot text button').toBeNull()
    const open = q(render(<ViewComposer />).container, 'view-next-record')
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


describe('the conversation ends at its newest turn', () => {
  it('the newest reply is the thread’s last child; asks/proposal/note are foot-row chips, closed at rest', async () => {
    const view = golden('proposal')
    const c = show({ ...view, turn: null, model: { ...view.model!, coaching_questions: ['What evidence is missing?'] } })
    const scroll = q(c, 'view-chat-scroll')!, turns = q(c, 'view-chat-turns')!, latest = q(c, 'view-chat-latest')!
    expect(scroll.firstElementChild!.lastElementChild).toBe(turns)
    expect(turns.lastElementChild).toBe(latest)
    expect(latest.querySelector('[data-testid="view-chat-answer"]')).not.toBeNull()
    expect(q(c, 'view-chat-foot-note')).toBeNull()
    // The existing portal supplies the note after the chat has mounted.
    const slot = c.querySelector<HTMLElement>(`[${VIEW_NOTE_SLOT}]`)!
    const note = document.createElement('section')
    note.textContent = 'A note from the existing canvas surface'
    act(() => { slot.append(note) })
    await waitFor(() => expect(q(c, 'view-chat-foot-note')).not.toBeNull())
    const row = q(c, 'view-chat-foot-row')!
    for (const id of ['proposal', 'asks', 'note']) {
      const chip = q(c, `view-chat-foot-${id}`)!
      expect(row.contains(chip)).toBe(true)
      expect(chip).toHaveAttribute('aria-expanded', 'false')
    }
    expect(q(c, 'view-chat-pinned')).toHaveAttribute('hidden')
    for (const id of ['view-next-step', 'view-model-question']) {
      expect(scroll.contains(q(c, id)!)).toBe(false)
      expect(q(c, id)).not.toBeVisible()
    }
    expect(scroll.contains(slot)).toBe(false)
    expect(scroll.firstElementChild!.lastElementChild).toBe(turns)
    // A later saved reply still goes last, even while supporting material is present.
    const last = view.chat[view.chat.length - 1]!
    act(() => useViewStore.setState({ view: { ...view, turn: null, chat: [...view.chat, { ...last, id: last.id + 1000, said: 'A later message' }] } }))
    expect(turns.lastElementChild).toBe(q(c, 'view-chat-latest'))
    expect(scroll.firstElementChild!.lastElementChild).toBe(turns)
  })
})
