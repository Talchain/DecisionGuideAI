/**
 * Coaching on its card (track 4 step 2, DL 7 Nov: "when a coaching move names a record, highlight that card, so Olumi and the canvas act
 * as one partner"): the newest reply's next step keeps the cards it names lit at rest (ring.ts), with no new words and no second Olumi
 * badge. Fixture: core's s_ce285b3617bb golden, whose newest reply names three of its cards and whose earlier reply names records that are
 * not cards. Every expectation is read from the View and bound by card id, never a count alone.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useCanvasStore } from '../../canvas/store'
import { ViewConversation } from '../ViewChat'
import { endRing, restRing } from '../ring'
import { nextCardsOf } from '../layout'

const golden: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/s_ce285b3617bb.view.json'), 'utf8'))
const LAST = golden.chat.length - 1
const NAMED: readonly string[] = golden.chat[LAST]!.answer!.next.about
const OTHER = 'not_named_card'

const nodeEl = (id: string) => document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)!
const lit = () => Array.from(document.querySelectorAll('.react-flow__node.v10-lit'), (e) => e.getAttribute('data-id') ?? '').sort()
const sorted = (a: readonly string[]) => [...a].sort()
/** The golden's chat with its newest (and, optionally, earliest) reply naming other records; nothing else changes. */
function chatWith(newest: readonly string[] | null, earliest: readonly string[] | null = null): View['chat'] {
  const c = structuredClone(golden.chat)
  if (newest !== null) c[LAST]!.answer!.next.about = [...newest]
  if (earliest !== null) c[0]!.answer!.next.about = [...earliest]
  return c
}

beforeEach(() => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: 's_000000000001', view: golden, error: null, status: 'ready' })
  for (const id of [...NAMED, OTHER]) document.body.insertAdjacentHTML('beforeend', `<div class="react-flow__node" data-id="${id}"></div>`)
})
afterEach(() => {
  cleanup()
  restRing([]); endRing()
  useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' })
  useCanvasStore.setState({ olumiAttention: null } as never)
  document.body.innerHTML = ''
})

describe('coaching on its card: the newest reply\'s next step keeps the cards it names lit', () => {
  it('catch: at rest, with no pointer or focus, exactly the cards core\'s newest next step names are lit; the line is core\'s', () => {
    expect(NAMED.length).toBeGreaterThan(1)
    const { container } = render(<ViewConversation chat={golden.chat} />)
    expect(lit()).toEqual(sorted(NAMED))
    expect(nodeEl(OTHER).classList.contains('v10-lit')).toBe(false)
    expect(container.querySelector(`[data-view="chat.${LAST}.answer.next.label"]`)!.textContent).toBe(golden.chat[LAST]!.answer!.next.label)
  })

  it('pointing at an earlier reply\'s next step lights exactly its cards; leaving restores the newest reply\'s, by hover and by keyboard', () => {
    const { container } = render(<ViewConversation chat={chatWith(null, [OTHER])} />)
    // Re-pinned (UI recovery witness row 11, DL 10 Nov): the chat is a thread again. Was: the earlier reply lived inside view-chat-earlier.
    const earlier = container.querySelector<HTMLElement>('[data-view-turn="chat.0"] [data-testid="view-chat-next"]')!
    fireEvent.mouseEnter(earlier)
    expect(lit()).toEqual([OTHER])
    fireEvent.mouseLeave(earlier)
    expect(lit()).toEqual(sorted(NAMED))
    fireEvent.focus(earlier)
    expect(lit()).toEqual([OTHER])
    fireEvent.blur(earlier)
    expect(lit()).toEqual(sorted(NAMED))
  })

  it('a re-render that rewrites a card\'s class (as React Flow does on select or drag) does not lose the ring', async () => {
    render(<ViewConversation chat={golden.chat} />)
    nodeEl(NAMED[0]!).className = 'react-flow__node'
    await waitFor(() => expect(lit()).toEqual(sorted(NAMED)))
  })

  it('one focus per screen: a card the person selects, or the card Olumi\'s note is open on, steps out of the ring; the others stay', async () => {
    render(<ViewConversation chat={golden.chat} />)
    nodeEl(NAMED[1]!).classList.add('selected')
    await waitFor(() => expect(lit()).toEqual(sorted(NAMED.filter((id) => id !== NAMED[1]))))
    nodeEl(NAMED[1]!).classList.remove('selected')
    await waitFor(() => expect(lit()).toEqual(sorted(NAMED)))
    // a V11 view chip open on a card (v11-build marks its node `v11-open`): the open view is the one focus, so the whole resting ring
    // steps out while it is open (UI ruling 7 Nov), and comes back when it closes
    nodeEl(NAMED[0]!).classList.add('v11-open')
    await waitFor(() => expect(lit()).toEqual([]))
    nodeEl(NAMED[0]!).classList.remove('v11-open')
    await waitFor(() => expect(lit()).toEqual(sorted(NAMED)))
    act(() => { useCanvasStore.setState({ olumiAttention: { nodeIds: [NAMED[2]!] } } as never) })
    await waitFor(() => expect(lit()).toEqual(sorted(NAMED.filter((id) => id !== NAMED[2]))))
  })

  it('a new reply replaces the ring; one that names nothing clears it and its line takes no focus; leaving the page clears it', () => {
    const { container, rerender, unmount } = render(<ViewConversation chat={golden.chat} />)
    rerender(<ViewConversation chat={chatWith([OTHER])} />)
    expect(lit()).toEqual([OTHER])
    rerender(<ViewConversation chat={chatWith([])} />)
    expect(lit()).toEqual([])
    expect(container.querySelector('[data-testid="view-chat-latest"] [data-testid="view-chat-next"]')!.hasAttribute('tabindex')).toBe(false)
    rerender(<ViewConversation chat={golden.chat} />)
    expect(lit()).toEqual(sorted(NAMED))
    unmount()
    expect(lit()).toEqual([])
  })

  it('fails closed: a record that is no card lights nothing and never throws; a card named twice is lit once (the one adapter)', () => {
    render(<ViewConversation chat={chatWith(['no_such_card', NAMED[0]!, NAMED[0]!])} />)
    expect(lit()).toEqual([NAMED[0]])
    expect(nextCardsOf({ about: ['a', 'a', 'b'] })).toEqual(['a', 'b'])
    // the golden's earlier reply names records that are not cards: they light nothing at rest
    expect(golden.chat[0]!.answer!.next.about.every((id) => !NAMED.includes(id))).toBe(true)
  })

  it('no new words: the conversation reads the same with the ring on as with it off, and recommends nothing', () => {
    const on = render(<ViewConversation chat={golden.chat} />).container.textContent
    cleanup()
    const off = render(<ViewConversation chat={chatWith([])} />).container.textContent
    expect(on).toBe(off)
    expect(on).not.toMatch(/\b(best|winner|recommend)/i)
  })
})
