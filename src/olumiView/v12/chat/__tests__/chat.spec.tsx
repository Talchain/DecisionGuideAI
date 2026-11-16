/**
 * V12 Olumi panel (chat lane): the composer's one sentence, the reply's disclosure, the "About <card>" chip, the method chip on the person's message,
 * keeping each approach on its own, "Your kept ideas", "From my last reply", the Undo control's accessible name and the card menu's header.
 * Bound by test id and exact words to the View a fixture holds; every word asserted is read back from that View, never typed from the design.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { setTeamFetch } from '../../../../olumiCore/team/api'
import type { View } from '../../../client'
import { useViewStore } from '../../../store'
import { ViewChat, ViewComposer, useViewChat, COMPOSER_PLACEHOLDER } from '../../../ViewChat'
import { approachesOf, keptIdeasOf, isKept } from '../../ideas'
import { aboutCardsOf, aboutWords } from '../AboutChip'
import { methodOfSaid } from '../MethodChip'
import { KeptIdeas, provenanceOf } from '../KeptIdeas'
import { CardMenuHeader, kindWordsOf, proposedByOlumi } from '../CardMenuHeader'
import { NOTHING_TO_UNDO, undoNameOf } from '../../UndoControl'
import { UNDO_WORDS } from '../../edit/undo'

const focus = vi.hoisted(() => vi.fn())
vi.mock('../../../../canvas/utils/focusHelpers', async (orig) => ({ ...(await orig<object>()), focusNodeById: focus }))

const fixture = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/session', `${n}.view3.json`), 'utf8'))
const SID = 's_cb215d057b96', UUID = '00000000-0000-4000-8000-cb215d057b96'
let posts: { url: string; body: Record<string, unknown> }[] = []
function core(next: () => View) {
  setTeamFetch((async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') { posts.push({ url, body: JSON.parse(String(init.body)) }); return new Response('{}', { status: 201 }) }
    return new Response(JSON.stringify(next()), { status: 200 })
  }) as unknown as typeof fetch)
}
const show = (view: View) => useViewStore.setState({ uuid: UUID, sid: SID, view, error: null, status: 'ready', stale: false, at: null })
const press = (el: Element) => act(async () => { fireEvent.click(el) })
beforeEach(() => { posts = []; focus.mockClear() })
afterEach(() => {
  cleanup(); setTeamFetch(null)
  useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none', stale: false, at: null })
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, gone: null })
})
/** The newest reply's answer replaced by the given text (one part), the rest of the View untouched. */
const withAnswer = (v: View, text: string): View => ({ ...v, chat: v.chat.map((t, i, a) => (i === a.length - 1 && t.answer !== null ? { ...t, answer: { ...t.answer, answer: [{ text }] } } : t)) })
const replyOf = (v: View) => v.chat.at(-1)!

describe('composer and reply wording', () => {
  it('the box says one sentence once there is a model, and the first brief keeps its example', () => {
    show(fixture('after-find-first'))
    expect(render(<ViewComposer />).container.querySelector('#view-chat-text')).toHaveAttribute('placeholder', COMPOSER_PLACEHOLDER)
    expect(COMPOSER_PLACEHOLDER).toBe('Ask about your thinking…')
  })
  it('a reply with reasons discloses them under "Why, and what moves it"', () => {
    show(fixture('after-find-first'))
    const { container } = render(<ViewChat />)
    expect(container.querySelector('[data-testid="view-chat-latest"] summary')).toHaveTextContent('Why, and what moves it')
  })
})

describe('"About <card> on the canvas"', () => {
  it('names the card the reply points at by its View heading, and a press focuses it on the canvas', async () => {
    const v = fixture('after-find-first')
    show(v)
    const next = replyOf(v).answer!.next
    const card = v.model!.cards.find((c) => c.id === next.at)!
    const { container } = render(<ViewChat />)
    const chip = within(container.querySelector<HTMLElement>('[data-testid="view-chat-latest"]')!).getByTestId('view-about-chip')
    expect(chip).toHaveTextContent(aboutWords(card.heading))
    expect(chip.dataset['card']).toBe(card.id)
    await press(chip)
    expect(focus).toHaveBeenCalledWith(card.id)
  })
  it('a pointer to a record the canvas does not draw names nothing; no pointer draws no chip', () => {
    const v = fixture('after-find-first')
    const next = replyOf(v).answer!.next
    expect(aboutCardsOf(v, { ...next, at: 'no_such_card', about: ['no_such_card'] })).toEqual([])
    expect(aboutCardsOf(v, { ...next, at: null, about: ['per_specialist', 'capacity_goal'] }).map((c) => c.id)).toEqual(['per_specialist', 'capacity_goal'])
    show({ ...v, chat: v.chat.map((t) => (t.answer === null ? t : { ...t, answer: { ...t.answer, next: { ...t.answer.next, at: null, about: [] } } })) })
    expect(render(<ViewChat />).container.querySelector('[data-testid="view-about-chip"]')).toBeNull()
  })
})

describe('method chip on the person\'s message', () => {
  it('only a message that is, word for word, one of core\'s menu questions carries the mark', () => {
    const v = fixture('after-find-first')
    show(v)
    const { container } = render(<ViewChat />)
    const bubbles = [...container.querySelectorAll<HTMLElement>('[data-testid="view-chat-said-bubble"]')]
    expect(bubbles).toHaveLength(2)
    expect(within(bubbles[0]!).queryByTestId('view-method-chip')).toBeNull() // the brief the person typed
    const mark = within(bubbles[1]!).getByTestId('view-method-chip')
    expect(mark.dataset['method']).toBe('find_first')
    expect(bubbles[1]).toHaveTextContent(v.session!.methods.find((m) => m.id === 'find_first')!.text)
    expect(methodOfSaid(v, 'Something I typed myself')).toBeNull()
  })
})

describe('keeping an approach on its own', () => {
  const list = 'Three ways in.\n\n- Phone booked visitors first.\n- Offer sessions at a second venue.\n- Ask the library for a stall.'
  it('a reply whose own list separates its approaches keeps each on its own: its words, its reply, and "Kept" once kept', async () => {
    const v = withAnswer(fixture('after-find-first'), list)
    core(() => v)
    show(v)
    const { container } = render(<ViewChat />)
    const latest = container.querySelector<HTMLElement>('[data-testid="view-chat-latest"]')!
    expect(latest.querySelectorAll('[data-testid="view-keep-idea-button"]')).toHaveLength(3)
    expect(latest.querySelectorAll('li [data-testid="view-keep-idea-button"]')).toHaveLength(3)
    await press(latest.querySelectorAll('[data-testid="view-keep-idea-button"]')[1]!)
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.body).toMatchObject({ kind: 'idea', text: 'Offer sessions at a second venue.', from_turn: replyOf(v).id })
    await waitFor(() => expect(latest.querySelectorAll('[data-testid="view-keep-idea-kept"]')).toHaveLength(1))
    expect(latest.querySelectorAll('[data-testid="view-keep-idea-button"]')).toHaveLength(2)
  })
  it('never splits prose: a reply with no list (or one list line) keeps whole, once; a line with a cite inside is not offered', () => {
    expect(approachesOf([{ text: 'One idea. Another idea. A third idea.' }])).toEqual([])
    expect(approachesOf([{ text: 'Only one:\n- Just this.' }])).toEqual([])
    expect(approachesOf([{ text: '- First.\n- Second ' }, { cite: 'c1' }, { text: ' with a source.\n- Third.' }])).toEqual(['First.', 'Third.'])
    expect(approachesOf([{ text: `- ${'x'.repeat(401)}\n- Short one.` }])).toEqual(['Short one.'])
    const v = withAnswer(fixture('after-find-first'), 'One idea. Another idea. A third idea.')
    show(v)
    const c = render(<ViewChat />).container
    expect(c.querySelectorAll('[data-testid="view-keep-idea-button"]')).toHaveLength(1)
  })
  it('an idea the View already holds from this reply shows "Kept", not a button', () => {
    const v = withAnswer(fixture('after-find-first'), list)
    show({ ...v, strategy: { items: [{ id: 'i1', kind: 'idea', text: 'Phone booked visitors first.', by: 'Olumi', by_id: 'olumi', kept_by: { id: '1', name: 'Pat' }, source_turn: String(replyOf(v).id), concerns: [] }] } } as unknown as View)
    const latest = render(<ViewChat />).container.querySelector<HTMLElement>('[data-testid="view-chat-latest"]')!
    expect(latest.querySelectorAll('[data-testid="view-keep-idea-kept"]')).toHaveLength(1)
    expect(latest.querySelectorAll('[data-testid="view-keep-idea-button"]')).toHaveLength(2)
  })
})

describe('"Your kept ideas"', () => {
  const held = (v: View, items: object[]): View => ({ ...v, strategy: { items } } as unknown as View)
  const idea = (o: object) => ({ id: 'i1', kind: 'idea', text: 'Add one line to the sign-in sheet.', by: 'Olumi', by_id: 'olumi', kept_by: { id: '1', name: 'Pat' }, source_turn: '6', concerns: [], status: 'live', ...o })
  it('lists each kept idea with "Olumi\'s idea, from <core\'s question>" and "kept by you"; someone else\'s keeping is named', () => {
    const v = fixture('after-find-first')
    const w = held(v, [idea({}), idea({ id: 'i2', text: 'Ask the library.', kept_by: { id: '9', name: 'Casey' }, source_turn: '3' })])
    show(w)
    const { getAllByTestId } = render(<KeptIdeas />)
    const rows = getAllByTestId('view-kept-idea')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]!).getByTestId('view-kept-idea-text')).toHaveTextContent('Add one line to the sign-in sheet.')
    expect(within(rows[0]!).getByTestId('view-kept-idea-from')).toHaveTextContent('Olumi’s idea, from What should we find out first? · kept by you')
    // turn 3 is the brief the person typed, not one of core's questions: no "from"
    expect(within(rows[1]!).getByTestId('view-kept-idea-from')).toHaveTextContent('Olumi’s idea · kept by Casey')
    expect(provenanceOf(w, keptIdeasOf(w)[0]!)).toEqual(['Olumi’s idea, from What should we find out first?', 'kept by you'])
  })
  it('draws nothing with no ideas; a set-aside idea and a non-idea item are not listed', () => {
    const v = fixture('after-find-first')
    show(v)
    expect(render(<KeptIdeas />).container.querySelector('[data-testid="view-kept-ideas"]')).toBeNull()
    expect(keptIdeasOf(held(v, [idea({ status: 'set_aside' }), idea({ id: 'r', kind: 'risk' })]))).toEqual([])
    expect(isKept(held(v, [idea({})]), 6, 'Add one line to the sign-in sheet.')).toBe(true)
    expect(isKept(held(v, [idea({})]), 3, 'Add one line to the sign-in sheet.')).toBe(false)
  })
  it('is drawn in the Olumi panel', () => {
    const v = held(fixture('after-find-first'), [idea({})])
    show(v)
    expect(render(<ViewChat />).container.querySelector('[data-testid="view-kept-ideas"]')).toHaveTextContent('Your kept ideas')
  })
})

describe('"From my last reply"', () => {
  it('holds the newest reply\'s next question, in core\'s words, above the box', () => {
    const v = fixture('after-find-first')
    show(v)
    const next = replyOf(v).answer!.next
    const card = render(<ViewComposer />).container.querySelector<HTMLElement>('[data-testid="view-last-reply-card"]')!
    expect(card).toHaveTextContent('From my last reply')
    expect(card.querySelector('[data-testid="view-last-reply-text"]')).toHaveTextContent(`${next.label} ${next.text.map((p) => ('text' in p ? p.text : '')).join('')}`)
    expect(card.className).toMatch(/border-info/)
  })
  it('is not drawn when the next has no words, or when there is no newest next', () => {
    const v = fixture('after-find-first')
    show({ ...v, chat: v.chat.map((t) => (t.answer === null ? t : { ...t, answer: { ...t.answer, next: { ...t.answer.next, label: 'Anything', text: [], move: '' } } })) })
    expect(render(<ViewComposer />).container.querySelector('[data-testid="view-last-reply-card"]')).toBeNull()
    cleanup()
    show({ ...v, chat: v.chat.map((t) => (t.answer === null ? t : { ...t, answer: { ...t.answer, next: { ...t.answer.next, newest: false } } })) })
    expect(render(<ViewComposer />).container.querySelector('[data-testid="view-last-reply-card"]')).toBeNull()
  })
})

describe('Undo\'s accessible name carries its reason', () => {
  it('core\'s label for a saved edit, the plain move, and why a disabled one is', () => {
    expect(undoNameOf({ kind: 'saved', undoes: 2, label: 'keeping the idea about the sign-in sheet', note: null })).toBe('Undo: keeping the idea about the sign-in sheet')
    expect(undoNameOf({ kind: 'saved', undoes: 2, label: UNDO_WORDS.undo, note: null })).toBe('Undo')
    expect(undoNameOf({ kind: 'layout', label: UNDO_WORDS.move, note: null })).toBe('Undo move')
    expect(undoNameOf({ kind: 'none', label: UNDO_WORDS.undo, note: UNDO_WORDS.nothingToUndo })).toBe(NOTHING_TO_UNDO)
    expect(undoNameOf({ kind: 'none', label: UNDO_WORDS.undo, note: UNDO_WORDS.savedNotYet })).toBe('Undo: nothing of yours to undo yet')
    expect(undoNameOf({ kind: 'none', label: UNDO_WORDS.undo, note: 'Someone else changed it since.' })).toBe('Undo: Someone else changed it since.')
    expect(undoNameOf({ kind: 'none', label: UNDO_WORDS.redo, note: UNDO_WORDS.nothingToRedo }, 'redo')).toBe('Redo')
  })
})

describe('the card menu header', () => {
  it('names the card\'s kind and marks a card Olumi proposed', () => {
    const v = fixture('after-find-first')
    const olumiCard = { ...v.model!.cards[0]!, id: 'o1', family: 'quantity', author: { by: 'olumi', text: 'Olumi', title: '' } }
    const mine = { ...v.model!.cards[0]!, id: 'm1', family: 'option', author: { by: 'person', text: 'You', title: '' } }
    show({ ...v, model: { ...v.model!, cards: [...v.model!.cards, olumiCard, mine] as never } })
    const a = render(<CardMenuHeader nodeId="o1" />)
    expect(a.getByTestId('lane-menu-kind')).toHaveTextContent('Factor')
    expect(a.getByTestId('lane-menu-proposed')).toHaveTextContent('Proposed')
    a.unmount()
    const b = render(<CardMenuHeader nodeId="m1" />)
    expect(b.getByTestId('lane-menu-kind')).toHaveTextContent('Option')
    expect(b.queryByTestId('lane-menu-proposed')).toBeNull()
    b.unmount()
    expect(render(<CardMenuHeader nodeId="nothing" />).container).toBeEmptyDOMElement()
    expect([kindWordsOf({ family: 'relation' }), proposedByOlumi({ author: null, olumi: null })]).toEqual([null, false])
  })
})
