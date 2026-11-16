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
import { leadLineOf, withheldWords } from '../previous/CoreCard'
import { isOpen, rowOf, setOpen } from './reviewRow'

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
    // Contract 3: the card, Approve and Set aside live INSIDE the one-row review (closed at rest, read without approving), inside the step.
    const review = step(c)!.querySelector('[data-testid="view-proposal-review"]')!
    expect(review.querySelector('[data-testid="view-chat-proposal"]')).not.toBeNull()
    expect(review.querySelectorAll('[data-testid="view-approve"]')).toHaveLength(1)
    expect(review.querySelectorAll('[data-testid="view-set-aside"]')).toHaveLength(1)
  })

  // CATCH (contract 3). Fails on the product before it: NextStepCard drew a bordered card headed by a <p>Next step</p> with the Proposal drawn open
  // (no <details>, no view-proposal-review / view-proposal-row), and Proposal drew its own proposal.heading line.
  it('catch: at rest a held proposal is ONE closed row in core\'s words (heading · on); the step has no "Next step" header; the heading is drawn once', () => {
    const view = golden('proposal'), p = view.proposal!
    expect([p.heading, p.on]).toEqual(['Olumi proposes 2 changes', 'on version 1']) // the golden's own words, bound here
    const c = show(view), s = step(c)!
    expect([s.tagName, s.getAttribute('aria-label'), s.getAttribute('data-step')]).toEqual(['SECTION', 'Next step', 'approve'])
    expect(s.closest('[data-testid="view-chat-pinned"]')).not.toBeNull() // still mounted in the pinned box
    const review = s.querySelector<HTMLElement>('[data-testid="view-proposal-review"]')!
    expect(rowOf(review).getAttribute('aria-expanded')).toBe('false')
    expect(isOpen(review)).toBe(false) // closed at rest
    const row = review.querySelector('[data-testid="view-proposal-row"]')!
    expect(row.tagName).toBe('BUTTON')
    expect(row.textContent).toBe(`${p.heading} · ${p.on}`) // core's words, exactly
    expect(row.querySelector('[data-view="proposal.heading"]')?.textContent).toBe(p.heading)
    expect(row.querySelector('[data-view="proposal.on"]')?.textContent).toBe(p.on)
    expect([...s.querySelectorAll('p')].map((e) => e.textContent)).not.toContain('Next step') // no header for this kind
    // The row IS the heading: the proposal's body does not draw it again, anywhere on the page.
    expect(c.querySelectorAll('[data-view="proposal.heading"]')).toHaveLength(1)
    expect(review.querySelector('[data-testid="view-chat-proposal"] [data-view="proposal.heading"]')).toBeNull()
    // The words for the step sit in the review's body, with the card; opening it shows them without approving anything.
    setOpen(review, true)
    expect(isOpen(review)).toBe(true)
    expect(review).toHaveTextContent(NEXT_STEP_WORDS.approve)
    expect(review.querySelector('[data-testid="view-chat-proposal"]')).not.toBeNull()
    // CONTRAST: the other kinds are still a titled card with "Next step" and no review row (V12: the goal's first question).
    cleanup()
    const f = step(show(golden('bakery')))!
    expect(f.getAttribute('data-step')).toBe('figure')
    expect([...f.querySelectorAll('p')].map((e) => e.textContent)).toContain('Next step')
    expect(f.querySelector('[data-testid="view-proposal-review"]')).toBeNull()
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

  it('nothing to approve, no question for a goal, and they are alone with a view of their own begun: bring a colleague in, which opens Team', () => {
    const view = golden('pricing')
    expect(view.model!.run!.waits_on).toBeNull()
    const begun: View = { ...view, chat: [], collab: { ...view.collab, alone: true, mine: [{ id: 1, figures: [], can_share: true, earlier: false } as never] } }
    expect(nextStepOf(view)?.kind).not.toBe('invite') // contrast: alone, but nothing of theirs begun
    const c = show(begun)
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
    // Contrast: with no reply yet and nothing of theirs begun, no invitation is made up (V12: only a team activity begun alone invites).
    expect(nextStepOf({ ...view, chat: [] })?.kind).not.toBe('invite')
  })

  it('a team already, with nothing to approve or type: no step (the conversation is the next step)', () => {
    const view = golden('pricing')
    const c = show({ ...view, collab: { ...view.collab, alone: false } })
    expect(step(c)).toBeNull()
  })

  it('the order: a held proposal first, then the reply\'s real move, then the goal\'s first question; a filler move gives way to the question', () => {
    const bakery = golden('bakery'), proposal = golden('proposal')
    expect(nextStepOf({ ...bakery, proposal: proposal.proposal })?.kind).toBe('approve')
    const sv = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/session', 'goal-understand.view3.json'), 'utf8')) as View
    const withMove = (move: string): View => ({ ...sv, chat: sv.chat.map((t) => (t.answer === null ? t : { ...t, answer: { ...t.answer, next: { ...t.answer.next, move } } })) })
    expect(nextStepOf(bakery)?.kind).toBe('figure') // a figure the chances wait on comes before the reply's move and before a question
    const run = bakery.model!.run!, waits = run.waits_on!
    const untypeable = { ...bakery, model: { ...bakery.model!, run: { ...run, waits_on: { ...waits, items: waits.items.map((i) => ({ ...i, edit: null })) } } } }
    expect(nextStepOf(untypeable)?.kind).not.toBe('figure') // a figure core does not let them type is never their step
    expect(nextStepOf({ ...bakery, model: { ...bakery.model!, edit_base: null } })?.kind).not.toBe('figure') // no version to edit: no figure step
    expect(nextStepOf(withMove('pre_mortem'))?.kind).toBe('move')
    expect(nextStepOf(withMove('other_method'))?.kind).toBe('method')
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
    // Contract 3: Approve / Set aside are pinned inside the one-row review. Open it (the PL-1083 placement binds the OPEN proposal), then both are there.
    const review = c.querySelector<HTMLElement>('[data-testid="view-chat-pinned"] [data-testid="view-proposal-review"]')!
    expect(isOpen(review)).toBe(false)
    setOpen(review, true)
    expect(review.querySelectorAll('[data-testid="view-approve"]')).toHaveLength(1) // Approve is pinned
    expect(review.querySelectorAll('[data-testid="view-set-aside"]')).toHaveLength(1)
    expect(c.querySelectorAll('[data-testid="view-chat-pinned"] [data-testid="view-approve"]')).toHaveLength(1)
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
    expect(nextStepOf(view)?.kind).toBe('move') // V12: the reply's own move is the step; it is drawn under the reply, with no second card
    const c = show(view)
    expect(step(c)).toBeNull()
    expect(moves(c.querySelector('[data-testid="view-chat-latest"]'))).toHaveLength(1)
    expect(moves(c.querySelector('[data-testid="view-chat-latest"]'))[0]!.className).toContain('bg-primary')
    expect(moves(c.querySelector('[data-testid="view-more-ways"]'))).toHaveLength(0)
  })
})

// Contract 3 (placement): the readings rule moves nothing while the review is closed; opening it places the rows as PL-1083 (1) says.
// The layout is stubbed (jsdom has none) with the 12:15Z measurement readingsPlace.spec binds: box 350 px at its cap, actions 116 px, two rows
// 143 and 121 px at 300 and 451 down the box's scroll, so the open box grows to 406 px and scrolls to 292.
describe('the readings rule places nothing while the one-row review is closed', () => {
  type Mark = NonNullable<View['proposal']>['marks'][number]
  const BOX_TOP = 248, CAP = 350, SCROLL_H = 1043, ROWS: Record<string, [number, number]> = { 'view-reading-0': [300, 143], 'view-reading-1': [451, 121] }
  const marks = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures/live-452caf7a-cut13-held-marks.json'), 'utf8')) as Mark[]
  const boxOf = () => document.querySelector<HTMLElement>('[data-testid="view-chat-pinned"]')!
  const boxH = (b: HTMLElement) => (b.style.maxHeight === '' ? CAP : parseFloat(b.style.maxHeight))
  const rect = (top: number, height: number) => ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
  const real = { rect: HTMLElement.prototype.getBoundingClientRect, ch: Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight'), sh: Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight'), ro: globalThis.ResizeObserver }
  let observers: Array<{ fire: () => void; seen: Element[] }> = []
  beforeEach(() => {
    observers = []
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const id = this.getAttribute('data-testid') ?? ''
      if (id === 'view-chat-pinned') return rect(BOX_TOP, boxH(this))
      if (id === 'view-proposal-actions') return rect(0, 116)
      if (ROWS[id] !== undefined) return rect(BOX_TOP + ROWS[id]![0] - boxOf().scrollTop, ROWS[id]![1])
      return rect(0, 0)
    }
    Object.defineProperty(Element.prototype, 'clientHeight', { configurable: true, get(this: HTMLElement) { return this.getAttribute('data-testid') === 'view-chat-pinned' ? boxH(this) - 2 : 0 } })
    Object.defineProperty(Element.prototype, 'scrollHeight', { configurable: true, get(this: HTMLElement) { return this.getAttribute('data-testid') === 'view-chat-pinned' ? SCROLL_H : 0 } })
    globalThis.ResizeObserver = class { private o: { fire: () => void; seen: Element[] }; constructor(cb: ResizeObserverCallback) { this.o = { fire: () => cb([], this as unknown as ResizeObserver), seen: [] }; observers.push(this.o) } observe(e: Element) { this.o.seen.push(e) } unobserve() {} disconnect() { this.o.seen = [] } } as unknown as typeof ResizeObserver
  })
  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = real.rect
    if (real.ch) Object.defineProperty(Element.prototype, 'clientHeight', real.ch)
    if (real.sh) Object.defineProperty(Element.prototype, 'scrollHeight', real.sh)
    globalThis.ResizeObserver = real.ro
  })
  const held = () => { const g = golden('proposal'); return show({ ...g, proposal: { ...g.proposal!, marks } }) }

  // CATCH. Fails on the product before contract 3: Proposal's land() had no closed-review return, so on arrival (and on any resize) it grew the box
  // to 406 px and scrolled it to 292 whether or not the rows were on screen.
  it('catch: closed at rest, the box is neither grown nor scrolled, and a resize while closed still moves nothing; opening it places the rows (406 px, scrollTop 292)', () => {
    const c = held(), b = boxOf()
    const review = c.querySelector<HTMLElement>('[data-testid="view-proposal-review"]')!
    expect(isOpen(review)).toBe(false)
    expect(c.querySelectorAll('[data-reading-row]')).toHaveLength(2) // the rows exist; they are just not on screen
    expect([b.style.maxHeight, b.scrollTop]).toEqual(['', 0])
    b.style.maxHeight = '999px' // a stale height from before it was closed: the closed rule clears it
    const placer = observers.find((o) => o.seen.includes(b))!
    placer.fire()
    expect([b.style.maxHeight, b.scrollTop]).toEqual(['', 0])
    setOpen(review, true)
    placer.fire() // the box's ResizeObserver places the rows when the person opens it
    expect([b.style.maxHeight, b.scrollTop]).toEqual(['406px', 292])
    // And closing again gives the room back.
    setOpen(review, false)
    placer.fire()
    expect(b.style.maxHeight).toBe('')
  })

  // CONTRAST: the stylesheet's open-only rule is in the CSS (jsdom draws none), so bind its text: every :has rule needs the review's body shown.
  it('contrast: the readings :has rules in olumiLook.css require the review\'s body shown (the thread and More ways keep their room while closed)', () => {
    const css = readFileSync(path.resolve('src/olumiView/look/olumiLook.css'), 'utf8')
    const rules = css.split('\n').filter((l) => /:has\(.*\[data-reading-row\]\)/.test(l))
    expect(rules).toHaveLength(3)
    for (const r of rules) expect(r).toContain('[data-review-body]:not([hidden]) [data-reading-row]')
  })
})

// Contract 3 (a withheld chance says core's reason). The pill's own rendering is bound in coreFarChance.spec; here the words it shows, by field.
describe('a withheld option\'s words are core\'s reason, never the bare "No chance yet"', () => {
  type Card = NonNullable<View['model']>['cards'][number]
  const withheld = (n: string) => golden(n).model!.cards.filter((k) => k.family === 'option' && k.headline != null && k.headline.state === 'none')
  // CATCH. Fails before: withheldWords did not exist, and leadLineOf returned card.headline.text ("No chance yet") for every option card.
  it('catch: core sends only title + bare text (no why) so the words are core\'s title; once core sends a why, that is the words', () => {
    const cards = withheld('app-launch')
    expect(cards.map((k) => k.id)).toEqual(['option_scheduled', 'option_delay', 'option_isolate'])
    for (const k of cards) {
      const h = k.headline!
      expect([h.text, h.why]).toEqual(['No chance yet', null]) // precondition: the fixture's bare words, and no why
      expect(withheldWords(h)).toBe(h.title)
      expect(leadLineOf(k as Card)).toBe(h.title)
      expect(leadLineOf(k as Card)).not.toBe('No chance yet')
    }
    // Core's why, from another golden's own words, wins over the title.
    const why = withheld('pricing-unmoved-unresolved')[0]!.headline!.title, k = cards[0]!
    const withWhy = { ...k, headline: { ...k.headline!, why } } as Card
    expect(withheldWords(withWhy.headline!)).toBe(why)
    expect(leadLineOf(withWhy)).toBe(why)
    // CONTRAST: a card with a figure (not withheld) is never given withheld words.
    const chance = golden('pricing').model!.cards.find((x) => x.family === 'option' && x.headline != null && x.headline.state === 'chance')!
    expect(chance).toBeDefined()
    expect(withheldWords(chance.headline!)).toBeNull()
    expect(leadLineOf(chance as Card)).toBe(chance.headline!.text)
  })
})
