/**
 * Lane C (Paul 3 Nov: a first-time person knows what they are looking at and what to do next within a minute). The one next step,
 * chosen from what the View already states. Keep the thread's context (UI recovery witness row 11, DL 10 Nov). Core's goldens.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useUIStore } from '../../stores/uiStore'
import { useMe } from '../../olumiCore/me'
import { NEXT_STEP_WORDS, nextStepOf, ViewChat } from '../ViewChat'

const golden = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${n}.view.json`), 'utf8'))
const show = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false })
  return render(<ViewChat />).container
}
const step = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-testid="view-next-step"]')

beforeEach(() => useUIStore.setState({ activeOutputTab: 'olumi' } as never))
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null }) })

describe('the next step', () => {
  it('a proposal held: check it, then approve or set aside, with core\'s change card and its two buttons inside the step', () => {
    const c = show(golden('proposal'))
    expect(step(c)?.getAttribute('data-step')).toBe('approve')
    expect(step(c)).toHaveTextContent(NEXT_STEP_WORDS.approve)
    expect(step(c)?.querySelector('[data-testid="view-chat-proposal"]')).not.toBeNull()
    expect(c.querySelectorAll('[data-testid="view-chat-proposal"]')).toHaveLength(1)
  })

  it('no proposal and the chances wait on a figure the person can type: that figure, in core\'s words, with its editor', () => {
    const view = golden('bakery'), item = view.model!.run!.waits_on!.items.find((i) => i.edit !== null)!
    const c = show(view)
    const w = view.model!.run!.waits_on!, k = w.items.indexOf(item)
    expect(step(c)?.getAttribute('data-step')).toBe('figure')
    // Core's words only: its label and the figure's name at their paths, core's hover; no sentence of the UI's own.
    const waits = step(c)!.querySelector('[data-testid="view-next-figure-waits"]')!
    expect(waits.querySelector('[data-view="run.waits_on.label"]')?.textContent).toBe(w.label)
    expect(waits.querySelector(`[data-view="run.waits_on.items.${k}.text"]`)?.textContent).toBe(item.text)
    expect(waits.getAttribute('title')).toBe(item.title)
    expect(waits.textContent).toBe(`${w.label} ${item.text}${item.unknown ?? ''}`)
    fireEvent.click(step(c)!.querySelector(`[data-testid="next-figure-edit-${item.id}"]`)!)
    expect(step(c)!.querySelector(`label[for="next-figure-${item.id}"]`)?.textContent).toBe(item.edit!.prompt)
  })

  it('catch (strategy witness 8, 8 Nov): a figure no one can size yet is said as core says it, never as one only the person can give', () => {
    const view = golden('studio'), w = view.model!.run!.waits_on!, item = w.items.find((i) => i.edit !== null)!, k = w.items.indexOf(item)
    expect([item.answer, typeof item.unknown]).toEqual([false, 'string'])
    const c = show(view)
    expect(step(c)?.getAttribute('data-step')).toBe('figure')
    const waits = step(c)!.querySelector('[data-testid="view-next-figure-waits"]')!
    expect(waits.querySelector(`[data-view="run.waits_on.items.${k}.unknown"]`)?.textContent).toBe(item.unknown)
    expect(waits.textContent).toBe(`${w.label} ${item.text}${item.unknown}`)
    expect(step(c)!.textContent).not.toMatch(/only you can give/)
    // Contrast: an asked figure (bakery) carries no unknown clause.
    cleanup()
    const b = golden('bakery'), bi = b.model!.run!.waits_on!.items.find((i) => i.edit !== null)!
    expect([bi.answer, bi.unknown]).toEqual([true, null])
    const bc = show(b)
    expect(step(bc)!.querySelectorAll('[data-view$=".unknown"]')).toHaveLength(0)
  })

  it('nothing to approve or type, and they are the only member: bring a colleague in, which opens Team', () => {
    const view = golden('pricing')
    expect(view.model!.run!.waits_on).toBeNull()
    const c = show(view)
    expect(step(c)?.getAttribute('data-step')).toBe('invite')
    expect(step(c)).toHaveTextContent(NEXT_STEP_WORDS.invite)
    fireEvent.click(c.querySelector('[data-testid="view-next-invite"]')!)
    expect(useUIStore.getState().activeOutputTab).toBe('team')
  })

  it('catch (acceptance step 4): the newest reply ends in core\'s own next step, so the UI adds none; a held proposal still asks to approve', () => {
    const view = golden('s_ce285b3617bb'), next = view.chat.at(-1)!.answer!.next
    expect([view.proposal, view.collab.alone, next.text.length > 0]).toEqual([null, true, true])
    const c = show(view)
    expect(step(c)).toBeNull()
    expect(c.querySelectorAll('[data-testid="view-chat-latest"] [data-testid="view-chat-next"]')).toHaveLength(1) // the reply's own step, once
    expect(nextStepOf({ ...view, proposal: golden('proposal').proposal })?.kind).toBe('approve')
    // Contrast: the same View with no reply yet still offers the invitation.
    expect(nextStepOf({ ...view, chat: [] })?.kind).toBe('invite')
  })

  it('a team already, with nothing to approve or type: no step (the conversation is the next step)', () => {
    const view = golden('pricing')
    const c = show({ ...view, collab: { ...view.collab, alone: false } })
    expect(step(c)).toBeNull()
  })

  it('the order: a held proposal comes before a figure, and a figure before an invitation; core\'s own states only', () => {
    const bakery = golden('bakery'), proposal = golden('proposal')
    expect(nextStepOf({ ...bakery, proposal: proposal.proposal })?.kind).toBe('approve')
    expect(nextStepOf(bakery)?.kind).toBe('figure')
    // A figure core does not let them type is never offered as their step.
    const run = bakery.model!.run!, waits = run.waits_on!
    const untypeable = { ...bakery, model: { ...bakery.model!, run: { ...run, waits_on: { ...waits, items: waits.items.map((i) => ({ ...i, edit: null })) } } } }
    expect(nextStepOf(untypeable)?.kind).toBe('invite')
    // While a proposal is held core gives no version to edit: no figure step either.
    expect(nextStepOf({ ...bakery, model: { ...bakery.model!, edit_base: null }, collab: { ...bakery.collab, alone: false } })).toBeNull()
  })
})

describe('Olumi\'s chronological conversation', () => {
  it('each turn shows the person\'s words before Olumi\'s reply, oldest to newest, each at its own path', () => {
    // Re-pinned (UI recovery witness row 11, DL 10 Nov): the chat is a thread again. Was: newest reply first, user words below, earlier turns folded.
    const view = golden('s_ce285b3617bb'), last = view.chat.length - 1
    expect(last).toBeGreaterThan(0)
    const c = show(view)
    const latest = c.querySelector(`[data-testid="view-chat-latest"][data-view-turn="chat.${last}"]`)!
    const answer = latest.querySelector(`[data-view="chat.${last}.answer.answer.0.text"]`)!, said = latest.querySelector(`[data-view="chat.${last}.said"]`)!
    expect(said.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const reply = latest.querySelector<HTMLElement>('[data-testid="view-chat-said-bubble"]')!
    expect(reply.className).not.toMatch(/line-clamp|truncate/)
    expect(said.textContent).toBe(view.chat[last]!.said)
    expect(c.querySelector('[data-testid="view-chat-in-reply"]')).toBeNull()
    expect(c.querySelector('[data-testid="view-chat-earlier"]')).toBeNull()
    const thread = c.querySelector('[data-testid="view-chat-turns"]')!
    expect(thread.tagName).toBe('OL')
    expect([...thread.children].map((turn) => turn.getAttribute('data-view-turn'))).toEqual(view.chat.map((_, i) => `chat.${i}`))
    expect(thread.querySelector('[data-view="chat.0.said"]')?.closest('.line-clamp-1')).toBeNull()
    expect(thread.querySelector('[data-view="chat.0.said"]')?.textContent).toBe(view.chat[0]!.said)
  })
})

describe('the reply\'s next move is under the reply, not tucked behind More ways (Paul 14 Nov); filled primary only when no Approve / Set aside is pinned beside it', () => {
  const moves = (el: Element | null) => (el === null ? [] : [...el.querySelectorAll('[data-testid="view-next-move"]')])
  it('catch: beside a pinned Approve / Set aside, the reply\'s move is one SECONDARY button under the reply, in core\'s label; More ways holds no move', () => {
    const view = golden('proposal'), next = view.chat[view.chat.length - 1]!.answer!.next
    expect(nextStepOf(view)).not.toBeNull()
    const c = show(view)
    const under = moves(c.querySelector('[data-testid="view-chat-latest"]'))
    expect(under.map((b) => b.textContent)).toEqual([next.label]) // core's label, verbatim
    expect(c.querySelector('[data-testid="view-chat-pinned"] [data-testid="view-approve"]')).not.toBeNull() // Approve is pinned
    expect(under[0]!.className).not.toContain('bg-primary') // so the move is not a second filled button
    expect(moves(c.querySelector('[data-testid="view-more-ways"]'))).toHaveLength(0)
    expect(moves(c)).toHaveLength(1)
    // Core's words for the move stay in the reply.
    expect(c.querySelector('[data-testid="view-chat-latest"] [data-testid="view-chat-next"]')).not.toBeNull()
  })
  it('contrast: on a figure step the move stays under the reply for someone else\'s page and for the owner\'s alike', () => {
    const p = golden('proposal'), b = golden('bakery')
    const view: View = { ...p, proposal: null, model: { ...p.model!, edit_base: p.model!.edit_base ?? 1, run: { ...(p.model!.run ?? b.model!.run!), waits_on: b.model!.run!.waits_on } } }
    expect(nextStepOf(view)?.kind).toBe('figure')
    try {
      useMe.setState({ me: { id: 'someone-else', name: 'Someone else' }, status: 'ready' } as never)
      const c = show(view)
      expect(moves(c.querySelector('[data-testid="view-chat-latest"]'))).toHaveLength(1)
      cleanup()
      useMe.setState({ me: { id: view.you_id!, name: view.you }, status: 'ready' } as never)
      const own = show(view)
      expect(moves(own.querySelector('[data-testid="view-chat-latest"]'))).toHaveLength(1)
      expect(moves(own.querySelector('[data-testid="view-chat-latest"]'))[0]!.className).toContain('bg-primary') // nothing pinned: filled primary
      expect(moves(own.querySelector('[data-testid="view-more-ways"]'))).toHaveLength(0)
    } finally { useMe.setState({ me: null } as never) }
  })
  it('must not change: with no Next step, the move stays under the reply and More ways holds no move', () => {
    const p = golden('proposal'), view: View = { ...p, proposal: null, collab: { ...p.collab, alone: false }, model: { ...p.model!, run: p.model!.run === null ? null : { ...p.model!.run, waits_on: null } } }
    expect(nextStepOf(view)).toBeNull()
    const c = show(view)
    expect(moves(c.querySelector('[data-testid="view-chat-latest"]'))).toHaveLength(1)
    expect(moves(c.querySelector('[data-testid="view-chat-latest"]'))[0]!.className).toContain('bg-primary')
    expect(moves(c.querySelector('[data-testid="view-more-ways"]'))).toHaveLength(0)
  })
})

describe('the figure step follows the newest reply\'s target (reviewer, 15 Nov: a question about one aim must not send the person to another aim\'s clock)', () => {
  // Bakery's one typeable figure plus a second, so the choice between two typeable figures is bound by record id, not by order.
  const two = (): View => {
    const b = golden('bakery'), run = b.model!.run!, w = run.waits_on!, first = w.items[0]!
    const second = { ...first, id: 'fitting', text: '‘fitting’' }
    return { ...b, model: { ...b.model!, run: { ...run, waits_on: { ...w, items: [first, second] } } } }
  }
  // The newest reply, grafted from core's own reply golden with the targets under test.
  const replying = (view: View, next: Partial<NonNullable<View['chat'][number]['answer']>['next']>): View => {
    const turn = golden('s_ce285b3617bb').chat.at(-1)!
    return { ...view, chat: [{ ...turn, answer: { ...turn.answer!, next: { ...turn.answer!.next, newest: true, ...next } } }] }
  }
  const moves = (el: Element | null) => (el === null ? [] : [...el.querySelectorAll('[data-testid="view-next-move"]')])
  const figureOf = (v: View) => { const s = nextStepOf(v); return s?.kind === 'figure' ? s.item.id : s?.kind ?? null }

  it('catch: a reply about the second figure targets it, not the first one core lists', () => {
    const v = two()
    expect(figureOf(v)).toBe('oven_price') // precondition: with no reply the first stands
    expect(figureOf(replying(v, { about: ['fitting'], at: 'fitting' }))).toBe('fitting')
  })
  it('control: a reply about another aim targets its own clock, found by the record its edit sizes, whatever the clock\'s id', () => {
    const v = two(), w = v.model!.run!.waits_on!, first = w.items[0]!
    const clock = { ...first, id: 'clock_b', edit: { prompt: 'p', ask: 'a', route: 'size' as const, record: 'aim_b_clock', note: null, fields: [] } }
    const withClock: View = { ...v, model: { ...v.model!, run: { ...v.model!.run!, waits_on: { ...w, items: [first, clock] } } } }
    expect(figureOf(replying(withClock, { about: ['aim_b_clock'], at: null }))).toBe('clock_b')
    expect(figureOf(replying(withClock, { about: ['oven_price'], at: null }))).toBe('oven_price')
  })
  it('control: a reply about the first figure targets the first, and the card says that figure', () => {
    const v = replying(two(), { about: ['oven_price'], at: 'oven_price' })
    expect(figureOf(v)).toBe('oven_price')
    expect(step(show(v))?.querySelector('[data-view="run.waits_on.items.0.text"]')).not.toBeNull()
  })
  it('catch: a reply that names only records that are no figure the chances wait on sends the person to no unrelated figure', () => {
    const v = replying(two(), { about: ['sell_360'], at: null })
    expect(figureOf(v)).not.toBe('oven_price')
    expect(figureOf(v)).not.toBe('fitting')
    expect(nextStepOf(v)?.kind).not.toBe('figure')
    expect(step(show(v))?.getAttribute('data-step')).not.toBe('figure')
    // The reply's own move stays under the reply (it is the step), so the person is not left with nothing.
    expect(moves(show(v).querySelector('[data-testid="view-chat-latest"]')), 'the reply keeps its own move').toHaveLength(1)
  })
  it('must not change: a reply that names no record leaves the first figure, and a held proposal still comes first', () => {
    const v = replying(two(), { about: [], at: null })
    expect(figureOf(v)).toBe('oven_price')
    expect(nextStepOf({ ...replying(two(), { about: ['fitting'], at: 'fitting' }), proposal: golden('proposal').proposal })?.kind).toBe('approve')
  })
})
