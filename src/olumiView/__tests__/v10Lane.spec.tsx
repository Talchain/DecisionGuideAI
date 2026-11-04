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
import { optionBands, useV10Lane, valueBars, ViewCardV10 } from '../v10'
import { ViewChances } from '../ViewChances'
import { ViewReasoning } from '../ViewReasoning'
import { optionCards } from '../layout'

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
    expect(container.querySelector(`[data-testid="view-option-band-aim-${card.id}"]`)?.getAttribute('title')).toBe(aim.text)
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
    expect(vs.map((v) => container.querySelector(`[data-testid="view-values-${card.id}-${v.option}"]`)?.getAttribute('title'))).toEqual(vs.map((v) => v.text))
    // Nothing without values, or when every option's range is one point (no spread to draw).
    expect(valueBars({ ...card, values: null })).toEqual([])
    expect(valueBars({ ...card, values: vs.map((v) => ({ ...v, p10: 5, p50: 5, p90: 5 })) })).toEqual([])
  })
})

describe('what the driver chances are, said once (core d1fe5e2 run.sensitivity; DL 4 Nov)', () => {
  for (const n of ['bakery', 'european']) {
    for (const [panel, Draw] of [['Analysis', ViewChances], ['Reasoning', ViewReasoning]] as const) {
      it(`${n}, ${panel}: run.sensitivity in core's words with its hover, exactly once, at the head of the option rows`, () => {
        const m = golden(n).model!
        const { container } = render(<ReactFlowProvider><Draw model={m} /></ReactFlowProvider>)
        const once = container.querySelectorAll('[data-view="run.sensitivity.text"]')
        expect(once.length).toBe(1)
        expect(once[0]!.textContent).toBe(m.run!.sensitivity.text)
        expect(once[0]!.getAttribute('title')).toBe(m.run!.sensitivity.title)
        const first = container.querySelector(`[data-view-card="${optionCards(m)[0]!.id}"]`)!
        expect(once[0]!.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(once[0]!.closest('[data-view-card]')).toBeNull()
      })
    }
  }

  it('no option carries driver chances: no sensitivity line', () => {
    const m = structuredClone(golden('bakery').model!)
    for (const c of m.cards) if (c.driver) { c.driver.low = null; c.driver.high = null }
    expect(render(<ViewChances model={m} />).container.querySelector('[data-view="run.sensitivity.text"]')).toBeNull()
  })
})
