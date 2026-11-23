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
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { setTeamFetch } from '../../olumiCore/team/api'
import type { View } from '../client'
import { currentModel, useViewStore } from '../store'
import { useCanvasStore } from '../../canvas/store'
import { ViewChat, ViewComposer, ViewTurns, useViewChat, useAnswersAsks } from '../ViewChat'
import { optionBands, useV10Lane, valueBars, ViewCardV10 } from '../v10'
import { driverRange, ViewChances } from '../ViewChances'
import { ViewReasoning } from '../ViewReasoning'
import { optionCards } from '../layout'
import { laneTipOf, tipOf } from './tipHelpers'

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
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, armed: null })
  useCanvasStore.setState({ nodes: [], edges: [], selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null } })
  document.body.innerHTML = ''
})

describe('v10 on the core lane', () => {
  it('the four methods are also icon buttons inside the composer box (named, titled); over typed words they fill the prefix and send nothing; none for a brief', async () => {
    const { container, unmount } = render(<><ViewChat /><ViewComposer /></>)
    const box = container.querySelector<HTMLTextAreaElement>('#view-chat-text')!
    const row = container.querySelector('[data-testid="view-composer"] [data-testid="view-composer-methods"]')!
    expect(row).not.toBeNull()
    const buttons = [...row.querySelectorAll<HTMLElement>('button')]
    const hovers: string[] = []
    for (const b of buttons) hovers.push(await tipOf(b)) // the one Tip, never a native title
    expect(buttons.map((b, i) => [b.getAttribute('aria-label'), b.hasAttribute('title'), hovers[i]])).toEqual(
      ['Challenge it', 'The opposite', 'What would disprove it', 'Outside view'].map((l) => [l, false, l]))
    fireEvent.change(box, { target: { value: 'the 30p rise' } })
    fireEvent.click(row.querySelector('[data-testid="view-composer-method-disconfirming"]')!)
    expect(box.value).toBe('What would disprove: the 30p rise')
    fireEvent.click(row.querySelector('[data-testid="view-composer-method-assumption"]')!)
    expect(box.value).toBe('Challenge it: the 30p rise')
    expect(posts).toBe(0)
    unmount()
    useViewStore.setState({ sid: null, view: null })
    expect(render(<><ViewChat /><ViewComposer /></>).container.querySelector('[data-testid="view-composer-methods"]')).toBeNull()
  })
  it('UI-A (menu brief, 18 Nov): with an empty box a composer challenge icon runs core\'s typed challenge on the ONE selected card (bound by id) and types nothing; with no card selected it waits, says so in words, and runs on the next card picked; Esc cancels. CONTRAST: words already typed still get the prefix and nothing is sent', async () => {
    const sent: Array<{ url: string; body: { kind?: string; record?: string } }> = []
    setTeamFetch((async (url: string, init?: RequestInit) => { if (init?.method === 'POST') sent.push({ url, body: JSON.parse(String(init.body)) }); return new Response(JSON.stringify(view), { status: 200 }) }) as unknown as typeof fetch)
    const [a, b] = view.model!.cards.map((c) => c.id) as [string, string]
    const select = (ids: string[]) => act(() => { useCanvasStore.setState({ selection: { nodeIds: new Set(ids), edgeIds: new Set(), anchorPosition: null } }) })
    const { container } = render(<><ViewChat /><ViewComposer /></>)
    const icon = (k: string) => container.querySelector<HTMLButtonElement>(`[data-testid="view-composer-method-${k}"]`)!
    const state = (k: string) => ({ text: useViewChat.getState().text, armed: useViewChat.getState().armed ?? null, pressed: icon(k).getAttribute('aria-pressed'), hint: container.querySelector('[data-testid="view-composer-armed"]')?.textContent ?? null,
      sent: sent.map((x) => [x.url.replace(/^.*\/scenarios\/[^/]+/, ''), x.body.kind, x.body.record]) })
    const settled = () => waitFor(() => expect(useViewChat.getState().busy).toBe(false))
    // One card selected: core's typed challenge, on that card, nothing typed.
    select([a])
    await act(async () => { fireEvent.click(icon('opposite')) })
    await waitFor(() => expect(sent.length).toBe(1))
    await settled()
    expect(state('opposite')).toEqual({ text: '', armed: null, pressed: 'false', hint: null, sent: [['/challenge', 'opposite', a]] })
    // No card selected: it waits and says so; Esc cancels; nothing is sent.
    select([])
    await act(async () => { fireEvent.click(icon('disconfirming')) })
    expect(state('disconfirming')).toMatchObject({ text: '', armed: 'disconfirming', pressed: 'true', hint: 'What would disprove it: pick a card on the canvas. Esc cancels.' })
    await act(async () => { fireEvent.keyDown(window, { key: 'Escape' }) })
    expect(state('disconfirming')).toMatchObject({ armed: null, pressed: 'false', hint: null })
    expect(sent.length).toBe(1)
    // Waiting again, then a card is picked: the challenge runs on THAT card.
    await act(async () => { fireEvent.click(icon('disconfirming')) })
    select([b])
    await waitFor(() => expect(sent.length).toBe(2))
    await settled()
    expect(state('disconfirming')).toMatchObject({ text: '', armed: null, hint: null, sent: [['/challenge', 'opposite', a], ['/challenge', 'disconfirming', b]] })
    // Codex 008 (18 Nov): waiting, then words go in the box (typed or put there by an Ask): the challenge stands down, the words stay, and a
    // card picked afterwards sends nothing.
    select([])
    await act(async () => { fireEvent.click(icon('outside')) })
    expect(state('outside')).toMatchObject({ armed: 'outside', pressed: 'true' })
    await act(async () => { fireEvent.change(container.querySelector('#view-chat-text')!, { target: { value: 'What about the weekend staff?' } }) })
    expect(state('outside')).toMatchObject({ text: 'What about the weekend staff?', armed: null, pressed: 'false', hint: null })
    select([a])
    await act(async () => { await Promise.resolve() })
    expect(sent.length).toBe(2)
    await act(async () => { fireEvent.change(container.querySelector('#view-chat-text')!, { target: { value: '' } }) })
    // CONTRAST: words the person typed are their own subject: the prefix goes before them, nothing is sent, nothing waits.
    await act(async () => { fireEvent.change(container.querySelector('#view-chat-text')!, { target: { value: 'the 30p rise' } }) })
    await act(async () => { fireEvent.click(icon('outside')) })
    expect(state('outside')).toMatchObject({ text: 'Outside view on: the 30p rise', armed: null })
    expect(sent.length).toBe(2)
  })
  it('a message carries the ONE selected card as `about` (core candidate 8), by id, with the person\'s words unchanged. CONTRAST: nothing selected sends no about', async () => {
    const sent: Array<Record<string, unknown>> = []
    setTeamFetch((async (url: string, init?: RequestInit) => { if (init?.method === 'POST' && /\/messages$/.test(url)) sent.push(JSON.parse(String(init.body))); return new Response(JSON.stringify(view), { status: 200 }) }) as unknown as typeof fetch)
    const card = view.model!.cards[0]!.id
    const { container } = render(<><ViewChat /><ViewComposer /></>)
    const box = container.querySelector<HTMLTextAreaElement>('#view-chat-text')!
    const sendWords = async (t: string) => { await act(async () => { fireEvent.change(box, { target: { value: t } }) }); await act(async () => { fireEvent.click(container.querySelector('[data-testid="view-composer-send"]')!) }); await waitFor(() => expect(useViewChat.getState().busy).toBe(false)) }
    act(() => { useCanvasStore.setState({ selection: { nodeIds: new Set([card]), edgeIds: new Set(), anchorPosition: null } }) })
    await sendWords('Is this figure too high?')
    act(() => { useCanvasStore.setState({ selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null } }) })
    await sendWords('And overall?')
    expect(sent.map((b) => [b['text'], b['about'] ?? null])).toEqual([['Is this figure too high?', card], ['And overall?', null]])
  })
  it('V12: the named method chips and the "More ways" disclosure are gone: the four icons fill the prefix and the one ⋯ menu (where core sends a session) is the way in to the rest; none of them for a brief', () => {
    const { container, unmount } = render(<><ViewChat /><ViewComposer /></>)
    expect(container.querySelector('[data-testid="v10-method-chips"]')).toBeNull()
    expect(container.querySelector('[data-testid="view-more-ways"]')).toBeNull()
    // (this View carries no session block, so core offers no menu here: the ⋯ is drawn from core's session, sessionMenu.spec)
    expect(container.querySelectorAll('[data-testid="view-composer-methods"] button')).toHaveLength(4)
    expect(posts).toBe(0)
    unmount()
    // A scenario with no version yet takes its brief: no methods for it (the View is read, so More ways could draw).
    useViewStore.setState({ view: { ...view, version: null, proposal: null } as View })
    const drafting = render(<><ViewChat /><ViewComposer /></>)
    expect(drafting.container.querySelector('[data-testid="v10-method-chips"]')).toBeNull()
    drafting.unmount()
    useViewStore.setState({ sid: null, view: null }) // no scenario yet: the composer takes the brief
    expect(render(<><ViewChat /><ViewComposer /></>).container.querySelector('[data-testid="v10-method-chips"]')).toBeNull()
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
    expect(box.value).toBe(`About ${card.heading}: `) // the corner's words verbatim, ready to type on (0c6854d0: drafts reach the composer whole)
    // A draft is never lost to the corner (Codex review dgai-v10 00002 #1): its words go after what was typed.
    fireEvent.change(box, { target: { value: 'Keep demand at 12,500; price stays £3.20' } })
    act(() => { fireEvent.click(corner) })
    expect(box.value).toBe(`Keep demand at 12,500; price stays £3.20\nAbout ${card.heading}: `)
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
    expect(css).toMatch(/\[data-presentation="v10"\] button:is\(\.bg-primary[^{]*\{\s*background-color: var\(--success\) !important;/) // CHANGED BY DESIGN (Paul, 17 Nov): green, never ink
    expect(css).toMatch(/\[data-presentation="v10"\] \[data-selection-dimmed="true"\] \{\s*opacity: 1 !important;/)
  })

  it('"What would change": an option card core gives a driver carries v10\'s badge, its words core\'s own; a card with none draws no badge', async () => {
    const model = currentModel({ view: golden('bakery'), error: null, stale: false })!
    const withDriver = model.cards.find((c) => c.driver !== null)!, without = model.cards.find((c) => c.driver === null)!
    const draw = (card: typeof withDriver) => render(<ReactFlowProvider><ViewCardV10 {...({ id: card.id, data: { card, label: card.heading }, selected: false, type: 'viewCard' } as unknown as NodeProps)} /></ReactFlowProvider>).container
    const badge = draw(withDriver).querySelector<HTMLElement>(`[data-testid="view-driver-${withDriver.id}"]`)!
    expect([badge.getAttribute('aria-label'), badge.textContent]).toEqual(['Its main driver', '']) // an icon at rest, never a line on the card
    expect(badge.closest('[data-slot="driver-badge"]')).not.toBeNull() // in the shell's top-right place on an option card
    fireEvent.pointerEnter(badge)
    const tip = await screen.findByTestId('lane-tip')
    expect(badge.getAttribute('aria-describedby')).toBe(tip.id)
    expect(tip.textContent).toBe(withDriver.driver!.text) // core's words, verbatim
    expect(within(tip).getByTestId(`view-driver-mark-${withDriver.id}`)).not.toBeNull() // with Olumi's mark (00002 #4)
    fireEvent.pointerLeave(badge)
    expect(draw(without).querySelector('[data-testid^="view-driver-"]')).toBeNull()
  })

  it('the outcome band: each option\'s band from core\'s chance-row outcome on ONE axis, core\'s line beneath verbatim; none in two units', () => {
    const model = currentModel({ view: golden('capacity-v3'), error: null, stale: false })!
    const options = model.cards.filter((c) => c.family === 'option')
    const bands = optionBands(model.cards)
    const outcome = (id: string) => { const r = options.find((c) => c.id === id)!.rows.find((x) => x.kind === 'chance')!; return r.kind === 'chance' ? r.outcome! : null! }
    // One axis: its ends are the lowest low and the highest high of every option, so each bar sits where its range is.
    const lo = Math.min(...options.map((c) => outcome(c.id).low)), hi = Math.max(...options.map((c) => outcome(c.id).high))
    for (const c of options) {
      const b = bands.get(c.id)!, o = outcome(c.id)
      expect(b.leftPct).toBeCloseTo(((o.low - lo) / (hi - lo)) * 100, 6)
      expect([b.text, b.title]).toEqual([o.text, o.title])
    }
    // Drawn on the card, in the shell's outcome-band place, its line core's own at its path.
    useCanvasStore.setState({ nodes: options.map((card) => ({ id: card.id, type: 'viewCard', position: { x: 0, y: 0 }, data: { card, label: card.heading } })) as never })
    const c = options[1]!
    const { container } = render(<ReactFlowProvider><ViewCardV10 {...({ id: c.id, data: { card: c, label: c.heading }, selected: false, type: 'viewCard' } as unknown as NodeProps)} /></ReactFlowProvider>)
    const band = container.querySelector(`[data-testid="view-option-band-${c.id}"]`)!
    expect(band.closest('[data-slot="outcome-band"]')).not.toBeNull()
    expect(band.querySelector(`[data-view="${bands.get(c.id)!.at}"]`)?.textContent).toBe(outcome(c.id).text)
    // Never two units on one axis, and nothing where core gives no outcome (an older View).
    const mixed = model.cards.map((k) => (k.id === c.id ? { ...k, rows: k.rows.map((r) => (r.kind === 'chance' && r.outcome ? { ...r, outcome: { ...r.outcome, unit: 'hour' } } : r)) } : k))
    expect(optionBands(mixed as typeof model.cards).size).toBe(0)
    const older = model.cards.map((k) => ({ ...k, rows: k.rows.map((r) => (r.kind === 'chance' ? { ...r, outcome: null } : r)) }))
    expect(optionBands(older as typeof model.cards).size).toBe(0)
  })

  // The band owns the chance rows' `outcome` leaves (the card walker exempts them, viewCard.spec SKIP): on every golden, each option's
  // outcome line is drawn at its path, core's words exactly, whenever the options share one unit, and none is drawn when they do not.
  for (const n of ['pricing', 'studio', 'bakery', 'european', 'app-launch', 's_ce285b3617bb', 'proposal', 'capacity-v3']) {
    it(`${n}: every option's outcome line is drawn by its band, verbatim at its path`, () => {
      const model = currentModel({ view: golden(n), error: null, stale: false })
      if (model === null) return
      const options = model.cards.filter((c) => c.family === 'option')
      useCanvasStore.setState({ nodes: options.map((card) => ({ id: card.id, type: 'viewCard', position: { x: 0, y: 0 }, data: { card, label: card.heading } })) as never })
      const withOutcome = options.flatMap((c) => c.rows.flatMap((r, i) => (r.kind === 'chance' && r.outcome ? [{ c, i, o: r.outcome }] : [])).slice(0, 1))
      const oneUnit = new Set(withOutcome.map((x) => x.o.unit)).size <= 1
      for (const { c, i, o } of withOutcome) {
        const { container, unmount } = render(<ReactFlowProvider><ViewCardV10 {...({ id: c.id, data: { card: c, label: c.heading }, selected: false, type: 'viewCard' } as unknown as NodeProps)} /></ReactFlowProvider>)
        const line = container.querySelector(`[data-view="${c.id}.rows.${i}.outcome.text"]`)
        if (oneUnit && Math.max(...withOutcome.map((x) => x.o.high)) > Math.min(...withOutcome.map((x) => x.o.low))) expect(line?.textContent, c.id).toBe(o.text)
        else expect(line, c.id).toBeNull()
        unmount()
      }
    })
  }

  it('a proposal\'s ghost is dashed in v10 (the shell marks it, data-proposed-card; v10.css draws the look)', () => {
    const css = readFileSync(path.resolve('src/presentation/v10.css'), 'utf8')
    expect(css).toMatch(/\[data-presentation="v10"\] \[data-view-card\]\[data-proposed-card\] \{\s*border-style: dashed;\s*\}/)
  })

  it('board 4: the aim on the band\'s axis, core\'s aim words on its line; the part of each range that meets it solid, the part that misses it lighter', () => {
    const view = golden('capacity-v3'), model = view.model!, aim = model.aim!
    expect([aim.side, aim.unit]).toEqual(['at_least', 'ticket/week'])
    const bands = optionBands(model.cards, aim), plain = optionBands(model.cards)
    const outcome = (id: string) => { const r = model.cards.find((c) => c.id === id)!.rows.find((x) => x.kind === 'chance')!; return r.kind === 'chance' ? r.outcome! : null! }
    const ids = [...bands.keys()], lo = Math.min(...ids.map((id) => outcome(id).low), aim.value), hi = Math.max(...ids.map((id) => outcome(id).high), aim.value)
    const at = ((aim.value - lo) / (hi - lo)) * 100
    for (const id of ids) {
      const b = bands.get(id)!, o = outcome(id)
      expect(b.aim!.pct).toBeCloseTo(at, 6)
      expect(b.aim!.text).toBe(aim.text)
      // "At least": the part above the aim meets it, the part below misses it.
      if (o.high > aim.value && o.low < aim.value) {
        expect(b.aim!.meet!.left).toBeCloseTo(at, 6)
        expect(b.aim!.miss!.left).toBeCloseTo(b.leftPct, 6)
      } else if (o.high <= aim.value) expect(b.aim!.meet).toBeNull()
    }
    // Drawn on the card: the aim line with core's words on hover, and the two parts.
    useViewStore.setState({ view })
    const straddles = ids.find((id) => outcome(id).low < aim.value && outcome(id).high > aim.value)!
    const card = model.cards.find((c) => c.id === straddles)!
    useCanvasStore.setState({ nodes: model.cards.filter((c) => c.family === 'option').map((c) => ({ id: c.id, type: 'viewCard', position: { x: 0, y: 0 }, data: { card: c, label: c.heading } })) as never })
    const { container } = render(<ReactFlowProvider><ViewCardV10 {...({ id: card.id, data: { card, label: card.heading }, selected: false, type: 'viewCard' } as unknown as NodeProps)} /></ReactFlowProvider>)
    expect(laneTipOf(container.querySelector<HTMLElement>(`[data-testid="view-option-band-aim-${card.id}"]`)!)).toBe(aim.text)
    expect(container.querySelector(`[data-testid="view-option-band-meet-${card.id}"]`)).not.toBeNull()
    expect(container.querySelector(`[data-testid="view-option-band-miss-${card.id}"]`)).not.toBeNull()
    // Never an aim in another unit: the bands are then exactly the plain ones, with no aim line.
    const other = optionBands(model.cards, { ...aim, unit: 'hour' })
    expect([...other.values()]).toEqual([...plain.values()])
    expect([...other.values()].every((b) => b.aim === null)).toBe(true)
  })

  it('the values band: a worked-out figure\'s range under each option on the card\'s own axis, core\'s line on each bar; none without a spread', () => {
    const model = golden('bakery').model!, card = model.cards.find((c) => (c.values?.length ?? 0) > 1)!, vs = card.values!
    const lo = Math.min(...vs.map((v) => v.p10)), hi = Math.max(...vs.map((v) => v.p90))
    const bars = valueBars(card)
    expect(bars.map((b) => b.option)).toEqual(vs.map((v) => v.option)) // one per option, in core's order
    for (const [i, b] of bars.entries()) {
      expect(b.leftPct).toBeCloseTo(((vs[i]!.p10 - lo) / (hi - lo)) * 100, 6)
      expect(b.medianPct).toBeCloseTo(((vs[i]!.p50! - lo) / (hi - lo)) * 100, 6)
      expect([b.text, b.olumi]).toEqual([vs[i]!.text, vs[i]!.olumi])
    }
    // Drawn in the shell's values-band place, each bar with core's words as its hover.
    const { container } = render(<ReactFlowProvider><ViewCardV10 {...({ id: card.id, data: { card, label: card.heading }, selected: false, type: 'viewCard' } as unknown as NodeProps)} /></ReactFlowProvider>)
    const band = container.querySelector(`[data-testid="view-values-${card.id}"]`)!
    expect(band.closest('[data-slot="values-band"]')).not.toBeNull()
    expect(vs.map((v) => laneTipOf(container.querySelector<HTMLElement>(`[data-testid="view-values-${card.id}-${v.option}"]`)!))).toEqual(vs.map((v) => v.text))
    // Nothing without values, or when every option's range is one point (no spread to draw).
    expect(valueBars({ ...card, values: null })).toEqual([])
    expect(valueBars({ ...card, values: vs.map((v) => ({ ...v, p10: 5, p50: 5, p90: 5 })) })).toEqual([])
  })
})

describe('what the driver chances are: said once, and only beside the figures it is about (core d1fe5e2 run.sensitivity; Paul 6 Nov)', () => {
  /** bakery with every marked option's figure pointed at a card the canvas draws (core's figure ids are often folded). */
  const named = () => {
    const m = structuredClone(golden('bakery').model!)
    const fig = m.cards.find((c) => c.id === 'extra_hours_sold')!
    for (const c of m.cards) if (c.driver) c.driver.figure = fig.id
    return { m, fig }
  }
  // core a0e144f6: the figure the Run names as what moves an option's chance most is its own card, so on the goldens every marked option names it
  // (before, these figures were folded into a badge, the line was left out and only the markers were drawn). Bound by id and exact heading.
  const figuresOf: Record<string, Record<string, [string, string]>> = {
    // Headings are core's (name-case, core bec1d6ce: a heading starts with a capital by position).
    bakery: { second_oven: ['extra_sold_per_oven', 'Extra sold per oven'], longer_hours: ['extra_hours_sold', 'Extra hours sold'] },
    european: { broader_entry: ['existing_market_acquisitions', 'New customers from existing markets'], single_country_test: ['existing_market_acquisitions', 'New customers from existing markets'],
      no_new_european_entry: ['existing_market_acquisitions', 'New customers from existing markets'] },
  }
  // A record id a badge folds and no card draws, to keep the old fold case as the negative.
  const foldedOf: Record<string, string> = { bakery: 'ovens_added', european: 'percent_conversion' }
  for (const n of ['bakery', 'european']) {
    it(`${n}, Analysis: a marked option's figure is its own card, so the line is said once and each marker names it; a figure folded into a badge still leaves the line out`, () => {
      const m = golden(n).model!
      const marked = optionCards(m).filter((c) => c.driver !== null && driverRange(c.driver) !== null)
      expect(marked.map((c) => [c.id, c.driver!.figure])).toEqual(Object.entries(figuresOf[n]!).map(([id, [fig]]) => [id, fig]))
      const { container } = render(<ReactFlowProvider><ViewChances model={m} /></ReactFlowProvider>)
      expect(container.querySelectorAll('[data-view="run.sensitivity.text"]').length).toBe(1)
      expect(container.querySelectorAll('[data-testid^="view-range-driver-"]').length).toBeGreaterThan(0)
      for (const [id, [fig, heading]] of Object.entries(figuresOf[n]!)) {
        expect(m.cards.some((x) => x.id === fig), `${fig} is a card`).toBe(true)
        const label = container.querySelector(`[data-driver-figure="${id}"]`)
        expect([label?.getAttribute('data-view'), label?.textContent], id).toEqual([`${fig}.heading`, heading])
      }
      cleanup()
      // CONTRAST: point one marked option at a record only a badge folds: no card, so the line is left out, never said alone; the markers stay.
      const folded = structuredClone(m)
      expect(folded.cards.some((x) => x.id === foldedOf[n])).toBe(false)
      folded.cards.find((c) => c.id === marked[0]!.id)!.driver!.figure = foldedOf[n]!
      const f = render(<ReactFlowProvider><ViewChances model={folded} /></ReactFlowProvider>).container
      expect(f.querySelector('[data-view="run.sensitivity.text"]')).toBeNull()
      expect(f.querySelectorAll('[data-testid^="view-range-driver-"]').length).toBeGreaterThan(0)
    })
  }

  it('every marked option names its figure (its card\'s heading beside the marker): the line is drawn once, at the head of the option rows, in core\'s words', async () => {
    const { m, fig } = named()
    const { container } = render(<ReactFlowProvider><ViewChances model={m} /></ReactFlowProvider>)
    const once = container.querySelectorAll('[data-view="run.sensitivity.text"]')
    expect(once.length).toBe(1)
    expect(once[0]!.textContent).toBe(m.run!.sensitivity.text)
    expect(await tipOf(once[0] as HTMLElement)).toBe(m.run!.sensitivity.title)
    const first = container.querySelector(`[data-view-card="${optionCards(m)[0]!.id}"]`)!
    expect(once[0]!.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    for (const c of optionCards(m)) {
      if (c.driver === null || driverRange(c.driver) === null) continue
      const label = container.querySelector(`[data-driver-figure="${c.id}"]`)
      expect(label?.getAttribute('data-view'), c.id).toBe(`${fig.id}.heading`)
      expect(label?.textContent, c.id).toBe(fig.heading)
      expect(label?.closest('[data-view-label]'), c.id).toBeNull() // beside the marker, never inside its label element
    }
  })

  it('must not change: no option carries driver chances: no sensitivity line; the Reasoning tab draws no marker and no line', () => {
    const m = structuredClone(golden('bakery').model!)
    for (const c of m.cards) if (c.driver) { c.driver.low = null; c.driver.high = null }
    expect(render(<ViewChances model={m} />).container.querySelector('[data-view="run.sensitivity.text"]')).toBeNull()
    cleanup()
    const r = render(<ReactFlowProvider><ViewReasoning model={named().m} /></ReactFlowProvider>).container
    expect(r.querySelector('[data-view="run.sensitivity.text"]')).toBeNull()
    expect(r.querySelector('[data-testid^="view-range-driver-"]')).toBeNull()
  })
})

describe('v10 driver marker (core d1fe5e2 driver.low/high; DL 4 Nov)', () => {
  for (const n of ['bakery', 'european']) {
    it(`${n}, Analysis: each option's low→high marker sits at its own two chances, core's line its label, never drawn as text`, () => {
      const m = golden(n).model!
      const { container } = render(<ReactFlowProvider><ViewChances model={m} /></ReactFlowProvider>)
      let drawn = 0
      for (const c of optionCards(m)) {
        const mark = container.querySelector<HTMLElement>(`[data-testid="view-range-driver-${c.id}"]`)
        if (c.driver === null || c.driver.low === null || c.driver.high === null) { expect(mark, c.id).toBeNull(); continue }
        drawn++
        expect(mark!.closest('[data-view-card]')?.getAttribute('data-view-card'), c.id).toBe(c.id)
        expect(mark!.getAttribute('aria-label'), c.id).toBe(c.driver.text)
        expect(mark!.querySelector<HTMLElement>('[data-range-low]')!.style.getPropertyValue('--an-left'), c.id).toBe(`${c.driver.low * 100}%`)
        expect(mark!.querySelector<HTMLElement>('[data-range-high]')!.style.getPropertyValue('--an-left'), c.id).toBe(`${c.driver.high * 100}%`)
        // geometry is custom properties set through a ref, never a React style attribute (the span: from the lower to the higher chance, at least 2%)
        const span = mark!.querySelector<HTMLElement>('[data-range-span]')!
        expect([span.style.getPropertyValue('--an-left'), span.style.getPropertyValue('--an-width')], c.id).toEqual([`${Math.min(c.driver.low, c.driver.high) * 100}%`, `${Math.max(2, Math.abs(c.driver.high - c.driver.low) * 100)}%`])
        for (const el of mark!.querySelectorAll<HTMLElement>('[data-range-span], [data-range-low], [data-range-high]')) expect(el.style.left, c.id).toBe('')
      }
      expect(drawn).toBeGreaterThan(1) // the probe reads real markers
      // core's per-option sentence is no longer drawn as text, once or six times
      for (const c of optionCards(m)) if (c.driver !== null && c.driver.low !== null) expect(container.textContent!.includes(c.driver.text), c.id).toBe(false)
    })
  }

  it('a View with no driver numbers draws the words as before and no sensitivity line', () => {
    const m = structuredClone(golden('bakery').model!)
    for (const c of m.cards) if (c.driver) { c.driver.low = null; c.driver.high = null }
    const { container } = render(<ViewChances model={m} />)
    expect(container.querySelector('[data-testid^="view-range-driver-"]')).toBeNull()
    expect(container.querySelector('[data-view="run.sensitivity.text"]')).toBeNull()
    for (const c of optionCards(m)) if (c.driver !== null) expect(container.querySelector(`[data-view="${c.id}.driver.text"]`)?.textContent).toBe(c.driver.text)
  })
})

describe('Olumi\'s blue on a value bar only while core\'s key names it, by id (core wip/k5 6e40b89 BLUE_RANGE_KEY; DL 4 Nov, R3)', () => {
  // Stand-in for core's new last key item (not vendored): olumi-core src/view/model.ts BLUE_RANGE_KEY at wip/k5 6e40b89.
  const KEY_ITEM = { id: 'blue_range', glyph: '▬', text: 'blue range: rests on a figure Olumi proposed' }
  const draw = (key: { id?: string; glyph: string; text: string }[]) => {
    const v = golden('bakery'), m = v.model!
    m.key = key as typeof m.key // an R1/R2 key item has no id; the vendored olumi.view/3 (core 550ad5f) requires one, so that legacy shape is cast in on purpose
    useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: 's_000000000001', view: v, error: null, status: 'ready' })
    const card = m.cards.find((c) => c.id === 'sales')!
    const { container } = render(<ReactFlowProvider><ViewCardV10 {...({ id: card.id, data: { card, label: card.heading }, selected: false, type: 'viewCard' } as unknown as NodeProps)} /></ReactFlowProvider>)
    return { card, colour: (o: string) => container.querySelector<HTMLElement>(`[data-testid="view-values-${card.id}-${o}"] [data-values-range]`)!.style.background }
  }

  it('key carries the item: the bar resting on Olumi\'s figure (values[].olumi) is blue, every other bar the option colour', () => {
    const base = golden('bakery').model!.key.filter((k) => k.id !== 'blue_range') // core 550ad5f's golden now carries the item; each row adds its own
    const { card, colour } = draw([...base, KEY_ITEM])
    expect(card.values!.map((v) => v.olumi)).toEqual([true, false, false]) // the probe holds both kinds of bar
    for (const v of card.values!) expect(colour(v.option), v.option).toBe(v.olumi ? 'var(--info)' : 'var(--option)')
  })

  it('core rewords the item or changes its glyph: matched by id, still blue', () => {
    const base = golden('bakery').model!.key.filter((k) => k.id !== 'blue_range') // core 550ad5f's golden now carries the item; each row adds its own
    const { card, colour } = draw([...base, { id: 'blue_range', glyph: '■', text: 'Olumi\'s range' }])
    for (const v of card.values!) expect(colour(v.option), v.option).toBe(v.olumi ? 'var(--info)' : 'var(--option)')
  })

  it('key without the item, or its glyph and words with no id (an R1/R2 key): every bar is the option colour, so the blue is never unexplained', () => {
    const base = golden('bakery').model!.key.filter((k) => k.id !== 'blue_range') // core 550ad5f's golden now carries the item; each row adds its own
    for (const key of [base, [...base, { glyph: KEY_ITEM.glyph, text: KEY_ITEM.text }], [...base, { id: 'olumi', glyph: KEY_ITEM.glyph, text: KEY_ITEM.text }]]) {
      const { card, colour } = draw(key)
      for (const v of card.values!) expect(colour(v.option), `${v.option} ${JSON.stringify(key.at(-1))}`).toBe('var(--option)')
    }
  })
})
