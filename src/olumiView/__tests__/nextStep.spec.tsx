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
import { MORE_WAYS, NEXT_STEP_WORDS, nextStepOf, ViewChat } from '../ViewChat'

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

describe('one next move (DL ruling b, 7 Nov; Paul 6 Nov: progressive disclosure)', () => {
  const moves = (el: Element | null) => (el === null ? [] : [...el.querySelectorAll('[data-testid="view-next-move"]')])
  it('catch: while the Next step shows, the reply\'s move tap waits behind "More ways to think about this": one move control in all', () => {
    const view = golden('proposal'), next = view.chat[view.chat.length - 1]!.answer!.next
    expect(nextStepOf(view)).not.toBeNull()
    const c = show(view)
    expect(moves(c.querySelector('[data-testid="view-chat-latest"]'))).toHaveLength(0)
    const more = c.querySelector<HTMLDetailsElement>('[data-testid="view-more-ways"]')!
    expect(more.querySelector('summary')!.textContent).toBe(MORE_WAYS)
    expect(moves(more).map((b) => b.textContent)).toEqual([next.label]) // core's label, verbatim
    expect(moves(c)).toHaveLength(1)
    // Core's words for the move stay in the reply.
    expect(c.querySelector('[data-testid="view-chat-latest"] [data-testid="view-chat-next"]')).not.toBeNull()
  })
  it('catch (checker 7 Nov): a figure step on someone else\'s page offers them no editor, so the reply\'s tap stays under the reply', () => {
    const p = golden('proposal'), b = golden('bakery')
    const view: View = { ...p, proposal: null, model: { ...p.model!, edit_base: p.model!.edit_base ?? 1, run: { ...(p.model!.run ?? b.model!.run!), waits_on: b.model!.run!.waits_on } } }
    expect(nextStepOf(view)?.kind).toBe('figure')
    try {
      useMe.setState({ me: { id: 'someone-else', name: 'Someone else' }, status: 'ready' } as never)
      const c = show(view)
      expect(c.querySelector('[data-testid="view-next-step"] [data-testid^="next-figure-edit-"]')).toBeNull() // no editor for them
      expect(moves(c.querySelector('[data-testid="view-chat-latest"]'))).toHaveLength(1)
      cleanup()
      useMe.setState({ me: { id: view.you_id!, name: view.you }, status: 'ready' } as never)
      const own = show(view) // CONTRAST: on their own page the step offers its editor, and the tap waits behind More ways
      expect(moves(own.querySelector('[data-testid="view-chat-latest"]'))).toHaveLength(0)
      expect(moves(own.querySelector('[data-testid="view-more-ways"]'))).toHaveLength(1)
    } finally { useMe.setState({ me: null } as never) }
  })
  it('must not change: with no Next step, the move tap stays under the reply and More ways holds no move', () => {
    const p = golden('proposal'), view: View = { ...p, proposal: null, collab: { ...p.collab, alone: false }, model: { ...p.model!, run: p.model!.run === null ? null : { ...p.model!.run, waits_on: null } } }
    expect(nextStepOf(view)).toBeNull()
    const c = show(view)
    expect(moves(c.querySelector('[data-testid="view-chat-latest"]'))).toHaveLength(1)
    expect(moves(c.querySelector('[data-testid="view-more-ways"]'))).toHaveLength(0)
  })
})
