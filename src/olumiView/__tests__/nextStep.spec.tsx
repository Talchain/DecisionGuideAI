/**
 * Lane C (Paul 3 Nov: a first-time person knows what they are looking at and what to do next within a minute). The one next step,
 * chosen from what the View already states. Keep the thread's context (UI recovery witness row 11, DL 10 Nov). Core's goldens.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useUIStore } from '../../stores/uiStore'
import { useMe } from '../../olumiCore/me'
import { moveKey, NEXT_STEP_WORDS, nextStepOf, useViewChat, ViewChat, ViewComposer } from '../ViewChat'
import { leadLineOf, withheldWords } from '../previous/CoreCard'
import { isOpen, rowOf, setOpen } from './reviewRow'
import { useVersionsPanelStore } from '../../canvas/versions/versionsPanelStore'
import { catchUpCounts, CATCH_UP_WORDS } from '../v12/journey/CatchUp'

const golden = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${n}.view.json`), 'utf8'))
const show = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false })
  return render(<ViewChat />).container
}
const step = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-testid="view-next-step"]')

beforeEach(() => useUIStore.setState({ activeOutputTab: 'olumi' } as never))
afterEach(() => { cleanup(); vi.unstubAllEnvs(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null }) })

describe('the next step', () => {
  it('Catch up sits at the very top of the panel with the record\'s counts and opens the history panel; with nothing to catch up on, none', () => {
    const view = golden('proposal'), counts = catchUpCounts(view, null)
    expect(counts.open).toBeGreaterThan(0) // the golden holds a waiting proposal: something to catch up on
    const c = show(view), row = c.querySelector<HTMLElement>('[data-testid="journey-catch-up"]')!
    expect(c.querySelector('[data-testid="view-chat"]')!.firstElementChild).toBe(row) // first, above the finding, the step and the thread
    expect(row).toHaveTextContent(`${CATCH_UP_WORDS.label} · ${CATCH_UP_WORDS.open(counts.open)}`)
    useVersionsPanelStore.setState({ isOpen: false })
    fireEvent.click(row)
    expect(useVersionsPanelStore.getState().isOpen).toBe(true)
    cleanup()
    // contrast: the same View with nothing open and no movement draws no row
    const calm = { ...view, proposal: null, evidence: [], model: view.model === null ? null : { ...view.model, run: view.model.run === null ? null : { ...view.model.run, since: null, waits_on: null } }, collab: view.collab === null ? null : { ...view.collab, commitments: [], dissent: [], can_reveal: false } } as View
    expect(catchUpCounts(calm, null)).toEqual({ moved: 0, open: 0 })
    expect(show(calm).querySelector('[data-testid="journey-catch-up"]')).toBeNull()
  })
  it('Catch up is not drawn on a first model (no saved version): nothing to catch up on; CONTRAST: the same View with a version draws it', () => {
    const view = golden('proposal'), row = (v: View) => { cleanup(); return show(v).querySelector('[data-testid="journey-catch-up"]') }
    expect(catchUpCounts(view, null).open).toBeGreaterThan(0)
    expect(row({ ...view, version: { n: 1, id: 'v1' } } as unknown as View)).not.toBeNull()
    expect(row({ ...view, version: null } as unknown as View)).toBeNull()
  })
  it('Catch up draws no row, and no counts, while the View is being re-read (stale) or its read failed (error); the fresh View draws it', () => {
    const view = golden('proposal')
    expect(catchUpCounts(view, null).open).toBeGreaterThan(0) // contrast: this View has something to count
    const rowIn = (flags: { stale: boolean; error: string | null }) => {
      cleanup()
      show(view)
      cleanup()
      useViewStore.setState(flags)
      return render(<ViewChat />).container.querySelector('[data-testid="journey-catch-up"]')
    }
    expect(rowIn({ stale: false, error: null })).not.toBeNull()
    expect(rowIn({ stale: true, error: null })).toBeNull()
    expect(rowIn({ stale: false, error: 'read failed' })).toBeNull()
    expect(rowIn({ stale: true, error: 'read failed' })).toBeNull()
  })
  it('a proposal held: check it, then approve or set aside, with core\'s change card and its two buttons inside the step', () => {
    const c = show(golden('proposal'))
    expect(step(c)?.getAttribute('data-step')).toBe('approve')
    // CHANGED BY DESIGN (sx-panel, PANEL-SPEC 1: the card's button in view at rest): the step's sentence opens with the review; at rest the card
    // is core's row and the actions. Was: the sentence was in the (hidden) body at rest.
    expect(step(c)).not.toHaveTextContent(NEXT_STEP_WORDS.approve)
    setOpen(step(c)!.querySelector('[data-testid="view-proposal-review"]')!, true)
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
    // CHANGED BY DESIGN (17 Nov, the calm panel): the row is the first item of the proposal's actions line at the foot, so it sits inside the proposal part;
    // the page-wide count above still binds it to ONE heading, and the body (above the line) draws none.
    // 18 Nov (fcab51e6): the actions line now sits in the card's pinned foot with the omission list and core's refusal, so the one heading is bound by
    // identity to the actions line, wherever that line sits, and never to the body above it.
    const heading = review.querySelector('[data-testid="view-chat-proposal"] [data-view="proposal.heading"]')!
    expect(heading.closest('[data-testid="view-proposal-actions"]')).not.toBeNull()
    // The words for the step sit in the review's body, with the card; opening it shows them without approving anything.
    setOpen(review, true)
    expect(isOpen(review)).toBe(true)
    expect(review).toHaveTextContent(NEXT_STEP_WORDS.approve)
    expect(review.querySelector('[data-testid="view-chat-proposal"]')).not.toBeNull()
    // CONTRAST: the other kinds are named "Next step" and have no review row (V12: the goal's first question).
    cleanup()
    const f = step(show(golden('bakery')))!
    expect(f.getAttribute('data-step')).toBe('figure')
    expect(f.querySelector('[data-testid="view-next-step-toggle"]')!.textContent).toContain('Next step')
    expect(f.querySelector('[data-testid="view-proposal-review"]')).toBeNull()
  })

  it('Paul, 18 Nov: at rest the step is ONE closed row (its body hidden, so it no longer covers the conversation); a press opens it in place and a second press closes it', () => {
    const f = step(show(golden('bakery')))!
    const toggle = f.querySelector<HTMLButtonElement>('[data-testid="view-next-step-toggle"]')!, body = f.querySelector<HTMLElement>('[data-testid="view-next-step-body"]')!
    expect([toggle.tagName, toggle.getAttribute('aria-expanded'), toggle.getAttribute('aria-controls'), body.id, body.hidden, f.getAttribute('data-open')]).toEqual(['BUTTON', 'false', 'view-next-step-body', 'view-next-step-body', true, 'false'])
    fireEvent.click(toggle)
    expect([toggle.getAttribute('aria-expanded'), body.hidden, f.getAttribute('data-open')]).toEqual(['true', false, 'true'])
    // The step's own content is inside the body it opens: nothing of it is drawn outside.
    expect(body.querySelector('[data-testid="view-next-figure-waits"]')).not.toBeNull()
    fireEvent.click(toggle)
    expect([toggle.getAttribute('aria-expanded'), body.hidden]).toEqual(['false', true])
  })

  it('no proposal and the chances wait on a figure the person can type: that figure, in core\'s words, with its editor', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '0') // surfaces step 5: this row binds the older look's editor (on the lane a figure is changed in the details' Value row: oneFigureEditor.spec.tsx)
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

  it('DL ruling (17 Nov; was strategy witness 8): a figure no one can size yet is never the step; an askable figure behind it is', () => {
    const view = golden('studio'), w = view.model!.run!.waits_on!, item = w.items.find((i) => i.edit !== null)!
    expect([item.answer, typeof item.unknown], 'precondition: the only editable figure is one no one can size').toEqual([false, 'string'])
    expect(w.items.some((i) => i.edit !== null && i.unknown == null), 'precondition: no figure someone can give').toBe(false)
    const c = show(view)
    expect(nextStepOf(view)?.kind).not.toBe('figure')
    expect(c.querySelector('[data-testid="view-next-figure-waits"]'), 'no step asks for it').toBeNull()
    // An askable figure behind it is the step instead (core's order otherwise kept).
    const asked = golden('bakery').model!.run!.waits_on!.items.find((i) => i.edit !== null && i.unknown == null)!
    const both = { ...view, model: { ...view.model!, run: { ...view.model!.run!, waits_on: { ...w, items: [item, asked] } } } } as View
    const s2 = nextStepOf(both)
    expect(s2?.kind).toBe('figure')
    expect(s2?.kind === 'figure' && s2.item.id).toBe(asked.id)
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
    // CHANGED BY DESIGN (sx-panel, PANEL-SPEC 1 and 3): the reply's own step is drawn ONCE, as the one Next step card at the top (its words and its
    // tap, in core's label), not under the reply and not as a "From my last reply" card above the box (that card is gone). Was: no step card,
    // the words in the composer's card. The UI still adds no step of its own: the card is core's move, in core's words.
    expect(step(c)?.getAttribute('data-step')).toBe('move')
    expect(step(c)?.querySelector('[data-testid="view-next-move"]')?.textContent).toBe(next.label)
    expect(c.querySelectorAll('[data-testid="view-chat-latest"] [data-testid="view-chat-next"]')).toHaveLength(0)
    expect(render(<ViewComposer />).container.querySelectorAll('[data-testid="view-last-reply-text"]')).toHaveLength(0)
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
    // Proposed order (Codex 006; DL ruling pending): the reply's real move comes before a figure the chances wait on, which comes before a question.
    // Bakery's golden has no chat: it is given one answered turn (the session fixture's), whose next step points nowhere in bakery.
    const answered = sv.chat.filter((t) => t.answer !== null).at(-1)!
    const talked = { ...bakery, chat: [{ ...answered, answer: { ...answered.answer!, next: { ...answered.answer!.next, about: [], at: null } } }] } as View
    const moved = (v: View, move: string): View => ({ ...v, chat: v.chat.map((t, i) => (i !== v.chat.length - 1 || t.answer === null ? t : { ...t, answer: { ...t.answer, next: { ...t.answer.next, move, newest: true } } })) })
    expect(talked.chat.at(-1)?.answer, 'precondition: an answered turn').toBeTruthy()
    expect(nextStepOf(moved(talked, 'pre_mortem'))?.kind, 'a real move leads, before the figure').toBe('move')
    expect(nextStepOf(moved(talked, 'other_method'))?.kind, 'CONTRAST: a filler move gives way to the figure').toBe('figure')
    expect(nextStepOf(bakery)?.kind, 'no reply at all: the figure').toBe('figure')
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
    expect(under[0]!.className.split(/\s+/)).not.toContain('bg-success') // so the move is not a second filled button
    expect(moves(c.querySelector('[data-testid="view-more-ways"]'))).toHaveLength(0)
    expect(moves(c)).toHaveLength(1)
    // CHANGED BY DESIGN (sx-panel, PANEL-SPEC 3): core's words for the move are drawn once, under the reply with its button; the "From my last
    // reply" copy above the box is gone. Was: the reply dropped its line and the composer's card held it.
    // S4 (19 Nov, said once): the press carries core's label, so the bold label is not drawn beside it.
    expect(c.querySelector('[data-testid="view-chat-latest"] [data-testid="view-chat-next"] [data-view$=".answer.next.label"]')).toBeNull()
    expect(render(<ViewComposer />).container.querySelector('[data-testid="view-last-reply-text"]')).toBeNull()
  })
  it('contrast (DL order, 16 Nov): with a figure waiting, the reply\'s move leads and stays under the reply, for someone else\'s page and the owner\'s alike', () => {
    const p = golden('proposal'), b = golden('bakery')
    // A figure the chances wait on, and a reply with a real move: under the DL's order the move leads; the figure stays on its card.
    const view: View = { ...p, proposal: null, model: { ...p.model!, edit_base: p.model!.edit_base ?? 1, run: { ...(p.model!.run ?? b.model!.run!), waits_on: b.model!.run!.waits_on } } }
    expect(view.model!.run!.waits_on!.items.some((i) => i.edit !== null), 'precondition: a figure the chances wait on').toBe(true)
    expect(nextStepOf(view)?.kind).toBe('move')
    try {
      useMe.setState({ me: { id: 'someone-else', name: 'Someone else' }, status: 'ready' } as never)
      // CHANGED BY DESIGN (sx-panel, PANEL-SPEC 1): the move that leads is the ONE Next step card at the top, filled; not under the reply.
      // Was: under the reply. Still for someone else's page and the owner's alike.
      const c = show(view)
      expect(moves(step(c))).toHaveLength(1)
      expect(moves(c.querySelector('[data-testid="view-chat-latest"]'))).toHaveLength(0)
      cleanup()
      useMe.setState({ me: { id: view.you_id!, name: view.you }, status: 'ready' } as never)
      const own = show(view)
      expect(moves(step(own))).toHaveLength(1)
      expect(moves(step(own))[0]!.className.split(/\s+/)).toContain('bg-success') // nothing pinned: the filled green action
      expect(moves(own.querySelector('[data-testid="view-more-ways"]'))).toHaveLength(0)
    } finally { useMe.setState({ me: null } as never) }
  })
  // CHANGED BY DESIGN (sx-panel, PANEL-SPEC 1): was "with no Next step card, the move stays under the reply". The reply's own move IS the step,
  // so it is drawn as the one Next step card at the top, filled, and once: not again under the reply.
  it('the reply\'s own move is the one Next step card, at the top and filled; not again under the reply; More ways holds no move', () => {
    const p = golden('proposal'), view: View = { ...p, proposal: null, collab: { ...p.collab, alone: false }, model: { ...p.model!, run: p.model!.run === null ? null : { ...p.model!.run, waits_on: null } } }
    expect(nextStepOf(view)?.kind).toBe('move')
    const c = show(view)
    expect(step(c)?.getAttribute('data-step')).toBe('move')
    expect(moves(c.querySelector('[data-testid="view-chat-latest"]'))).toHaveLength(0)
    expect(moves(step(c))).toHaveLength(1)
    expect(moves(step(c))[0]!.className.split(/\s+/)).toContain('bg-success')
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
      if (id === 'view-proposal-foot' || id === 'view-proposal-actions') return rect(0, 116) // the rows rest above the pinned foot that holds the actions
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
    // CHANGED BY DESIGN (sx-panel, PANEL-SPEC 1): closed, the card draws core's row and its actions only, and where readings wait for a choice
    // its filled button opens the review (never Approve blind). Was: the rows were mounted in a hidden body. The choices live in Proposal's
    // state, which stays mounted either way.
    expect(c.querySelectorAll('[data-reading-row]')).toHaveLength(0)
    expect(c.querySelectorAll('[data-testid="view-review-changes"]')).toHaveLength(1)
    expect([b.style.maxHeight, b.scrollTop]).toEqual(['', 0])
    b.style.maxHeight = '999px' // a stale height from before it was closed: the closed rule clears it
    const placer = observers.find((o) => o.seen.includes(b))!
    placer.fire()
    expect([b.style.maxHeight, b.scrollTop]).toEqual(['', 0])
    setOpen(review, true)
    expect(c.querySelectorAll('[data-reading-row]')).toHaveLength(2) // open: the rows are drawn
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

describe('S4 (19 Nov): nothing is said twice; one clear next action', () => {
  const sessionView = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/session', `${n}.view3.json`), 'utf8'))
  const labelled = (c: HTMLElement, label: string) => [...c.querySelectorAll('[data-testid="view-chat-latest"] *')].filter((e) => e.children.length === 0 && e.textContent === label && !e.closest('.sr-only') && !e.classList.contains('sr-only'))
  afterEach(() => useViewChat.setState({ gone: undefined } as never))

  it('SY2 core\'s next.label is drawn once beside a press that carries it (the bold label is not drawn over the button); CONTRAST: where the press is not drawn (a stale move), the label is', () => {
    const view = golden('proposal'), k = view.chat.length - 1, next = view.chat[k]!.answer!.next
    expect([next.newest, next.label === '']).toEqual([true, false])
    const c = show(view)
    expect(c.querySelectorAll('[data-testid="view-next-move"]')).toHaveLength(1)
    expect(labelled(c, next.label).map((e) => e.outerHTML.slice(0, 160)), 'one visible copy of the label: the press').toHaveLength(1)
    expect(c.querySelector(`[data-view="chat.${k}.answer.next.label"]`), 'no bold label beside the press').toBeNull()
    cleanup()
    useViewChat.setState({ gone: moveKey(view.id, view.chat[k]!.id, next.move) } as never)
    const d = show(view)
    expect(d.querySelector('[data-testid="view-next-move"]')).toBeNull()
    expect(d.querySelector(`[data-view="chat.${k}.answer.next.label"]`)?.textContent, 'the label stays where there is no press').toBe(next.label)
  })

  it('SY3 where core offers a next move with no proposal, the filled press is in view at rest under the closed Next step row (not inside its folded body), once; the fold keeps only its words', () => {
    const view = sessionView('after-find-first'), k = view.chat.length - 1, next = view.chat[k]!.answer!.next
    expect([view.proposal, next.newest]).toEqual([null, true])
    const c = show(view), s = step(c)!, body = s.querySelector<HTMLElement>('[data-testid="view-next-step-body"]')!
    const tap = s.querySelector<HTMLElement>('[data-testid="view-next-move"]')!
    expect([body.hidden, body.contains(tap), c.querySelectorAll('[data-testid="view-next-move"]').length]).toEqual([true, false, 1])
    expect(tap.closest('[hidden]'), 'nothing hides the press at rest').toBeNull()
    expect(tap.className.split(/\s+/), 'filled').toContain('bg-success')
    expect(tap.textContent).toBe(next.label)
    // CONTRAST: a step that is not a move draws no press under the row.
    cleanup()
    expect(step(show(golden('bakery')))!.querySelector('[data-testid="view-next-move"]')).toBeNull()
  })
  // S4 ruling (19 Nov): exactly one filled action at rest wherever core offers a next step, of every kind. Filled = the lane's solid green (controls.actColours: bg-success)
  // on a visible, enabled button inside the panel; the Next step's own press sits under the closed row, never in the folded body.
  const filled = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[data-testid="view-chat"] button')].filter((b) => b.className.split(/\s+/).includes('bg-success') && !b.closest('[hidden]'))
  const pressUnderRow = (c: HTMLElement, id: string) => {
    const s = step(c)!, body = s.querySelector<HTMLElement>('[data-testid="view-next-step-body"]')!, press = s.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
    expect([body.hidden, press === null, body.contains(press), press.closest('[hidden]')]).toEqual([true, false, false, null])
    expect(press.className.split(/\s+/), 'filled').toContain('bg-success')
    return press
  }
  it('NS1 a METHOD step: its filled press is under the closed row, once, in core\'s words; its prerequisite stays in the fold; the one filled action in the panel', () => {
    const sv = sessionView('goal-understand')
    const view: View = { ...sv, chat: sv.chat.map((t) => (t.answer === null ? t : { ...t, answer: { ...t.answer, next: { ...t.answer.next, move: 'other_method' } } })) }
    const st = nextStepOf(view)!
    expect(st.kind).toBe('method')
    const c = show(view), press = pressUnderRow(c, 'view-next-method')
    expect(press.textContent).toBe(st.kind === 'method' ? st.method.text : '')
    expect(filled(c)).toHaveLength(1)
    expect(c.querySelectorAll('[data-testid="view-next-method"]')).toHaveLength(1)
    expect(step(c)!.querySelector('[data-testid="view-next-step-label"]'), 'the row does not say the press\'s words again').toBeNull()
  })
  it('NS2 an INVITE step: its filled press is under the closed row, the sentence stays in the fold, and it opens Team', () => {
    const view = golden('pricing'), begun: View = { ...view, chat: [], collab: { ...view.collab, alone: true, mine: [{ id: 1, figures: [], can_share: true, earlier: false } as never] } }
    const c = show(begun), press = pressUnderRow(c, 'view-next-invite')
    expect(step(c)!.querySelector<HTMLElement>('[data-testid="view-next-step-body"]')).toHaveTextContent(NEXT_STEP_WORDS.invite)
    expect(filled(c)).toHaveLength(1)
    fireEvent.click(press)
    expect(useUIStore.getState().activeOutputTab).toBe('team')
  })
  it('NS3 a FIGURE step: the opener is a filled press under the closed row (both the older look and the lane), the waits words stay in the fold; opening it leaves one filled control', () => {
    for (const core of ['0', '1']) {
      vi.stubEnv('VITE_OLUMI_CORE', core)
      const view = golden('bakery'), item = view.model!.run!.waits_on!.items.find((i) => i.edit !== null && i.unknown == null)!
      const c = show(view), press = pressUnderRow(c, `next-figure-edit-${item.id}`)
      expect(press.textContent).toBe('Add the figure')
      expect(step(c)!.querySelector<HTMLElement>('[data-testid="view-next-step-body"]')!.querySelector('[data-testid="view-next-figure-waits"]')).not.toBeNull()
      expect(filled(c)).toHaveLength(1)
      cleanup()
    }
  })
  it('NS4 never two filled at once: a held proposal is the step (Approve filled), the reply\'s move is secondary and no step press is drawn; the approved after-find-first state has exactly one', () => {
    const c = show(golden('proposal'))
    expect(step(c)!.getAttribute('data-step')).toBe('approve')
    expect(step(c)!.querySelector('[data-testid="view-next-move"], [data-testid="view-next-method"], [data-testid="view-next-invite"]')).toBeNull()
    expect(filled(c).map((b) => b.getAttribute('data-testid'))).toEqual(['view-approve'])
    cleanup()
    const d = show(sessionView('after-find-first'))
    expect(filled(d).map((b) => b.getAttribute('data-testid'))).toEqual(['view-next-move'])
  })
})
