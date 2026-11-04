/**
 * The v10 design on the olumi-core lane (src/olumiView/v10.tsx; DL, 4 Nov), one catch row per feature:
 * - the method chips fill the composer and send nothing;
 * - each card's Olumi corner fills "About <card>: " and sends nothing, in place of the rail's door;
 * - a reply's next step rings exactly the cards core says it is about, and dims nothing;
 * - the lane carries v10's rulings attribute while its canvas is up (blue means Olumi only, nothing dims);
 * - the chat names the model version each reply read: core's own `chat[].version`, already drawn (contract.spec binds every drawn string).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { setTeamFetch } from '../../olumiCore/team/api'
import type { View } from '../client'
import { currentModel, useViewStore } from '../store'
import { useCanvasStore } from '../../canvas/store'
import { ViewChat, ViewComposer, ViewTurns, useViewChat, useAnswersAsks } from '../ViewChat'
import { useV10Lane, ViewCardV10 } from '../v10'

const DIR = path.resolve('src/olumiView')
const golden = (n: string): View => JSON.parse(readFileSync(path.join(DIR, 'golden', `${n}.view.json`), 'utf8'))
const view = golden('whatif')
let posts = 0
beforeEach(() => {
  posts = 0
  setTeamFetch((async (_url: string, init?: RequestInit) => { if (init?.method === 'POST') posts++; return new Response(JSON.stringify(view), { status: 200 }) }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: 's_000000000001', view, error: null, status: 'ready' })
})
afterEach(() => {
  setTeamFetch(null)
  useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' })
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null })
  useCanvasStore.setState({ nodes: [], edges: [] })
  document.body.innerHTML = ''
})

describe('v10 on the core lane', () => {
  it('the method chips sit above the composer and fill its prefix, keeping what was typed; nothing is sent; none for a brief', () => {
    const { container, unmount } = render(<ViewComposer />)
    const box = container.querySelector<HTMLTextAreaElement>('#view-chat-text')!
    fireEvent.change(box, { target: { value: 'the 30p rise' } })
    fireEvent.click(container.querySelector('[data-testid="v10-method-assumption"]')!)
    expect(box.value).toBe('Challenge it: the 30p rise')
    fireEvent.click(container.querySelector('[data-testid="v10-method-opposite"]')!)
    expect(box.value).toBe('Argue the opposite of: the 30p rise') // swaps the prefix, never stacks it
    expect(posts).toBe(0)
    unmount()
    useViewStore.setState({ sid: null, view: null }) // no scenario yet: the composer takes the brief
    expect(render(<ViewComposer />).container.querySelector('[data-testid="v10-method-chips"]')).toBeNull()
  })

  it('a card\'s Olumi corner, not the rail\'s door, puts "About <card>: " in the composer and sends nothing', () => {
    const card = currentModel({ view, error: null, stale: false })!.cards[0]!
    useCanvasStore.setState({ nodes: [{ id: card.id, type: 'viewCard', position: { x: 0, y: 0 }, data: { card, label: card.heading } }] as never })
    function Tab() { useAnswersAsks(); return <><ViewChat /><ViewComposer /></> }
    const props = { id: card.id, data: { card, label: card.heading }, selected: true, type: 'viewCard' } as unknown as NodeProps
    const { container } = render(<><Tab /><ReactFlowProvider><ViewCardV10 {...props} /></ReactFlowProvider></>)
    expect(container.querySelector(`[data-testid="node-olumi-door-${card.id}"]`)).toBeNull() // the mark is never shown twice
    const corner = container.querySelector<HTMLButtonElement>(`[data-testid="node-corner-olumi-${card.id}"]`)!
    expect(corner.getAttribute('aria-label')).toBe(`Ask Olumi about ${card.heading}`)
    expect(corner.closest('[data-slot="olumi-badge"]')).not.toBeNull() // in the shell's bottom-right place, not beside the card
    act(() => { fireEvent.click(corner) })
    const box = container.querySelector<HTMLTextAreaElement>("#view-chat-text")!
    expect(box.value).toBe(`About ${card.heading}:`) // requestAsk trims a prefill, as v10 does on #/canvas2
    // A draft is never lost to the corner (Codex review dgai-v10 00002 #1): its words go after what was typed.
    fireEvent.change(box, { target: { value: 'Keep demand at 12,500; price stays £3.20' } })
    act(() => { fireEvent.click(corner) })
    expect(box.value).toBe(`Keep demand at 12,500; price stays £3.20\nAbout ${card.heading}:`)
    expect(posts).toBe(0)
  })

  it('pointing at a reply\'s next step rings exactly the cards core says it is about; nothing else changes, and leaving clears it', () => {
    const turn = view.chat.find((t) => t.answer !== null)!
    const about = ['card_a', 'card_b'], chat = [{ ...turn, answer: { ...turn.answer!, next: { ...turn.answer!.next, about } } }]
    for (const id of ['card_a', 'card_b', 'card_c']) document.body.insertAdjacentHTML('beforeend', `<div class="react-flow__node" data-id="${id}"></div>`)
    const unlit = () => [...document.querySelectorAll('.react-flow__node')].map((e) => e.outerHTML)
    const before = unlit()
    const { container } = render(<ViewTurns chat={chat} />)
    const next = container.querySelector<HTMLElement>('[data-testid="view-chat-next"]')!
    fireEvent.mouseEnter(next)
    const lit = () => [...document.querySelectorAll('.react-flow__node.v10-lit')].map((e) => e.getAttribute('data-id'))
    expect(lit()).toEqual(['card_a', 'card_b'])
    // Nothing else changes, byte for byte: the lit cards gain only the ring's class, every other card is exactly as it was (00002 #3).
    expect(unlit()).toEqual(before.map((h, i) => (i < 2 ? h.replace('class="react-flow__node"', 'class="react-flow__node v10-lit"') : h)))
    fireEvent.mouseLeave(next)
    expect(lit()).toEqual([])
    expect(unlit()).toEqual(before)
    fireEvent.focus(next); expect(lit()).toEqual(['card_a', 'card_b']); fireEvent.blur(next); expect(lit()).toEqual([])
  })

  it('the ring stays while its line keeps keyboard focus, and goes when the turn that lit it leaves the page', () => {
    const turn = view.chat.find((t) => t.answer !== null)!, chat = [{ ...turn, answer: { ...turn.answer!, next: { ...turn.answer!.next, about: ['card_a'] } } }]
    document.body.insertAdjacentHTML('beforeend', '<div class="react-flow__node" data-id="card_a"></div>')
    const lit = () => document.querySelectorAll('.react-flow__node.v10-lit').length
    const { container, unmount } = render(<ViewTurns chat={chat} />)
    const next = container.querySelector<HTMLElement>('[data-testid="view-chat-next"]')!
    act(() => { next.focus() }); fireEvent.mouseEnter(next); fireEvent.mouseLeave(next)
    expect(lit()).toBe(1)
    unmount()
    expect(lit()).toBe(0)
  })

  it('the lane carries v10\'s rulings while its canvas is up, and v10\'s stylesheet paints the person\'s primary buttons ink, not blue', () => {
    const { unmount } = renderHook(() => useV10Lane())
    expect(document.documentElement.dataset['presentation']).toBe('v10')
    unmount()
    expect(document.documentElement.dataset['presentation']).toBeUndefined()
    const css = readFileSync(path.resolve('src/presentation/v10.css'), 'utf8')
    expect(css).toMatch(/\[data-presentation="v10"\] button:is\(\.bg-primary[^{]*\{\s*background-color: #262626 !important;/)
    expect(css).toMatch(/\[data-presentation="v10"\] \[data-selection-dimmed="true"\] \{\s*opacity: 1 !important;/)
  })

  it('"What would change": an option card core gives a driver carries v10\'s badge, its words core\'s own; a card with none draws no badge', async () => {
    const model = currentModel({ view: golden('bakery'), error: null, stale: false })!
    const withDriver = model.cards.find((c) => c.driver !== null)!, without = model.cards.find((c) => c.driver === null)!
    const draw = (card: typeof withDriver) => render(<ReactFlowProvider><ViewCardV10 {...({ id: card.id, data: { card, label: card.heading }, selected: false, type: 'viewCard' } as unknown as NodeProps)} /></ReactFlowProvider>).container
    const badge = draw(withDriver).querySelector<HTMLElement>(`[data-testid="view-driver-${withDriver.id}"]`)!
    expect([badge.getAttribute('aria-label'), badge.textContent]).toEqual(['Its main driver', '']) // an icon at rest, never a line on the card
    expect(badge.closest('[data-slot="driver-badge"]')).not.toBeNull() // in the shell's top-right place on an option card
    act(() => { fireEvent.focus(badge); fireEvent.mouseEnter(badge) })
    await waitFor(() => expect(document.querySelector(`[data-view="${withDriver.id}.driver.text"]`)?.textContent).toBe(withDriver.driver!.text)) // core's words, verbatim
    expect(document.querySelector(`[data-testid="view-driver-mark-${withDriver.id}"]`)).not.toBeNull() // with Olumi's mark (00002 #4)
    expect(draw(without).querySelector('[data-testid^="view-driver-"]')).toBeNull()
  })
})
