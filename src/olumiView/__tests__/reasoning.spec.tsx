/**
 * The Reasoning tab on the olumi-core lane (src/olumiView/ViewReasoning.tsx), drawn from golden Views: core's lines verbatim and in core's
 * order, each bound to its own View string; nothing while no model is current; a figure tried there drawn there, nothing saved.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { useViewLens } from '../lens'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View, ViewCard, ViewModel } from '../client'
import { useViewStore } from '../store'
import { drawKindOf, modelGroupsOf, optionCards } from '../layout'
import { REASONING_LABELS, ViewReasoning, ViewReasoningBlock } from '../ViewReasoning'
import { ViewChances } from '../ViewChances'
import { restsOfOption, SEE_CHANCES } from '../reasoning/Rack'
import { clearWhatIf, useWhatIf, type WhatIfVariant } from '../whatif'
import { attCards, ringCards } from '../ring'
import { setTeamFetch } from '../../olumiCore/team/api'
import { resetWrites } from '../../olumiCore/team/writes'
import { useMe } from '../../olumiCore/me'
import { useUIStore } from '../../stores/uiStore'
import { useCanvasStore } from '../../canvas/store'
import { registerFocusHelpers } from '../../canvas/utils/focusHelpers'

const read = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', n), 'utf8'))
const ready = (view: View, more: object = {}) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, ...more } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
}
afterEach(() => { cleanup(); clearWhatIf(); setTeamFetch(null); resetWrites(); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })

/** Every word drawn: inside an element bound to its View string, or one of the tab's own labels (code writes labels, core the rest). */
const LABELS = new Set(['Worth checking first', 'Try a figure', '✎', ' ', '\u00a0']) // spacing only: a plain space, and the no-break space that keeps a mark on its value's line (R5)
const unbound = (root: HTMLElement, also: string[]) => {
  const out: string[] = [], walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walk.nextNode(); n !== null; n = walk.nextNode()) {
    // A glance row's count is the number of cards drawn (structure, code's), asserted by the glance rows below; never a View value. So is a
    // disclosure's count (`data-count`), asserted against the rows it opens onto in 'the crafted rest state' below.
    if (n.parentElement!.closest('[data-view], [data-glance-count], [data-count]') === null && !LABELS.has(n.textContent!) && !also.includes(n.textContent!)) out.push(n.textContent!)
  }
  return out
}

/** A View string by its `data-view` path: the brief from the View itself, the Run's from `run`, a card's from its id (as contract.spec). */
function at(view: View, path: string): unknown {
  if (path === 'brief') return view.brief
  const m = view.model!, [id, ...rest] = path.split('.')
  // `key.N.glyph`: core's key entry N (the Olumi mark beside an outcome band), a path on the model like `run`.
  let x: unknown = id === 'run' ? m.run : id === 'key' ? m.key : id === 'collab' ? view.collab : id === 'lens_words' ? view.lens_words : id === 'chat' ? view.chat : m.cards.find((c) => c.id === id)
  for (const k of rest) x = x === null || x === undefined ? undefined : (x as Record<string, unknown>)[k]
  return x
}
// The tab's own words: its labels, and the rack's one link to Analysis (DL ruling 9 Nov).
const OWN = [...Object.values(REASONING_LABELS), SEE_CHANCES] as string[]
/** Opens every closed door and section row in the tab (the crafted rest state keeps depth closed), so every row can be read. */
const openAll = (root: HTMLElement) => { for (const b of root.querySelectorAll<HTMLElement>('[data-testid^="view-reasoning-"][data-testid$="-toggle"][aria-expanded="false"]')) fireEvent.click(b) }

// The glance as the previous PoC's strip (vision-audit-20261024 *-panel-reasoning.png; side-by-side 6 Nov): Options, Factors, Risks and
// Outcomes, each mark in the canvas's own shape and colour for its kind, and how many cards each row has, right-aligned.
describe('the Reasoning glance: the previous strip\'s rows, counts and canvas colours (side-by-side, 6 Nov)', () => {
  const kinds = (m: ViewModel) => {
    const through = new Set(m.links.filter((l) => l.kind === 'through').map((l) => l.to))
    const q = m.cards.filter((c) => c.family === 'quantity')
    return { options: m.cards.filter((c) => c.family === 'option'), factors: q.filter((c) => !through.has(c.id)), risks: m.cards.filter((c) => c.family === 'risk'), outcomes: q.filter((c) => through.has(c.id)) }
  }
  const FILL = { options: 'var(--option)', factors: 'var(--factor)', risks: 'var(--danger)', outcomes: 'var(--success)' } as const
  for (const golden of ['bakery.view.json', 's_ce285b3617bb.view.json', 'pricing.view.json']) {
    it(`catch: ${golden}: four rows, each with its cards by id and their count; an outcome is never counted as a factor`, () => {
      const view = read(golden), m = view.model!, want = kinds(m)
      ready(view)
      render(<ViewReasoning model={m} brief={view.brief} />)
      for (const [row, cards] of Object.entries(want)) {
        const el = screen.getByTestId(`view-reasoning-glance-${row}`)
        expect([...el.querySelectorAll<HTMLElement>('[data-glance-card]')].map((e) => e.dataset['glanceCard']), row).toEqual(cards.map((c) => c.id))
        expect(el.querySelector('[data-glance-count]')?.textContent, row).toBe(String(cards.length))
      }
      expect(want.outcomes.length).toBeGreaterThan(0)
    })
    it(`catch: ${golden}: each mark is drawn in its kind's canvas colour, with core's glyph bound for a reader`, () => {
      const view = read(golden), m = view.model!, want = kinds(m)
      ready(view)
      render(<ViewReasoning model={m} brief={view.brief} />)
      for (const [row, cards] of Object.entries(want) as [keyof typeof FILL, ViewCard[]][]) for (const c of cards) {
        const mark = screen.getByTestId(`view-reasoning-glance-${row}`).querySelector<HTMLElement>(`[data-glance-card="${c.id}"]`)!
        expect(mark.querySelector('svg [fill]')?.getAttribute('fill'), `${row} ${c.id}`).toBe(FILL[row])
        expect(mark.querySelector(`[data-view="${c.id}.glyph"]`)?.textContent).toBe(c.glyph)
      }
    })
  }
  it('an empty row still reads, with 0 (as the previous strip\'s "Outcomes 0")', () => {
    const view = read('pricing.view.json'), m = { ...view.model!, cards: view.model!.cards.filter((c) => c.family !== 'risk') }
    ready({ ...view, model: m })
    render(<ViewReasoning model={m} brief={view.brief} />)
    expect(screen.getByTestId('view-reasoning-glance-risks').querySelector('[data-glance-count]')?.textContent).toBe('0')
  })
})

describe('the Reasoning tab: the previous PoC\'s sections, in core\'s words (Paul, 6 Nov; C1 4 Nov)', () => {
  // R24: a figure the options set that feeds another figure and no aim is a driver, glanced with the factors, not the outcomes (layout.isDriver).
  // Pinned by id: core 6192ad6b's app-launch has one (option_delay sets release_offset, which feeds readiness_margin) and its european one (two options set the editable `churn_rate`, which feeds `customers`); no other golden here does.
  const DRIVERS: Record<string, string[]> = { 'app-launch.view.json': ['release_offset'], 'european.view.json': ['churn_rate'] }
  for (const golden of ['bakery.view.json', 'european.view.json', 'studio.view.json', 'app-launch.view.json', 'pricing.view.json', 's_ce285b3617bb.view.json']) {
    it(`${golden}: glance, challenges, premises, what would change your mind and outcomes, every string bound to its View path; none of the Analysis tab's option rows`, () => {
      const view = read(golden), m = view.model!
      ready(view)
      render(<ViewReasoning model={m} brief={view.brief} />)
      const root = screen.getByTestId('view-reasoning')
      openAll(root)
      // Not the Analysis tab again: no driver marker, no sensitivity line, no lead (they are the Analysis tab's). An option's rows are drawn
      // only in the rack, through the one component the Analysis tab draws them with (DL ruling 1, 7 Nov).
      expect([...root.querySelectorAll('[data-view-row]')].filter((e) => e.closest('[data-testid="view-reasoning-rack"]') === null)).toEqual([])
      expect(root.querySelector('[data-testid^="view-range-driver-"]')).toBeNull()
      expect(root.querySelector('[data-view="run.sensitivity.text"]')).toBeNull()
      expect(root.querySelector('[data-view="run.lead"]')).toBeNull()
      // Every drawn View string is the View's own string at its path.
      const bound = [...root.querySelectorAll<HTMLElement>('[data-view]')]
      expect(bound.length).toBeGreaterThan(3)
      for (const el of bound) expect(el.textContent, el.dataset['view']).toBe(at(view, el.dataset['view']!))
      // The glance: the brief, each goal, and one mark per option, factor and risk card, by id, the card's own glyph, its heading on hover.
      expect(root.querySelector('[data-view="brief"]')?.textContent).toBe(view.brief)
      for (const g of m.cards.filter((c) => c.family === 'goal')) expect(root.querySelector(`[data-testid="view-reasoning-glance"] [data-view="${g.id}.heading"]`), g.id).not.toBeNull()
      const marked = [...root.querySelectorAll<HTMLElement>('[data-glance-card]')]
      // V11 pixel pass (9 Nov): the glance picks as the Model tab's outline does (every card the canvas draws as that kind, assumptions and
      // conditions aside), so the two never count one kind differently; was figures only for Factors and Outcomes.
      const kindOf = (kind: string) => m.cards.filter((c) => c.family !== 'assumption' && c.family !== 'condition' && drawKindOf(c, m) === kind)
      expect(marked.map((e) => e.dataset['glanceCard'])).toEqual(['option', 'factor', 'risk', 'outcome'].flatMap(kindOf).map((c) => c.id))
      // R24 kept: a figure the options set that feeds another figure and no aim is a driver, glanced with the factors.
      for (const id of DRIVERS[golden] ?? []) expect(kindOf('factor').map((c) => c.id), id).toContain(id)
      for (const [glance, group] of [['factor', 'factors'], ['option', 'options']] as const) expect(kindOf(glance).map((c) => c.id), glance).toEqual(modelGroupsOf(m).find((g) => g.id === group)!.cards.map((c) => c.id))
      for (const e of marked) expect(e.getAttribute('title')).toBe(m.cards.find((c) => c.id === e.dataset['glanceCard'])!.heading)
      // Challenge Your Thinking: exactly the cards core marks challenged.
      expect([...root.querySelectorAll<HTMLElement>('[data-reasoning-challenge]')].map((e) => e.dataset['reasoningChallenge'])).toEqual(m.cards.filter((c) => c.challenged === true).map((c) => c.id))
      // Assumptions and evidence: each premise core put on any card, once, by its words.
      const texts = [...root.querySelectorAll('[data-reasoning-premise] [data-view$=".text"]')].map((e) => e.textContent)
      expect(texts).toEqual([...new Set(m.cards.flatMap((c) => (c.premises ?? []).map((x) => x.text)))])
      // What would change your mind: each worth line and each comparison, bound to its own fact (Worth/Compared, shared with Analysis).
      ;(m.run!.science ?? []).forEach((l, i) => { expect(root.querySelector(`[data-view="run.science.${i}.line"]`)?.textContent).toBe(l.line) })
      // Only the tab's own labels are unbound (and a worth line's ✎ lead, which is core's give text).
      expect(unbound(root, [...OWN, ...(m.run!.science ?? []).flatMap((l) => (l.figure?.give == null ? [] : [`${l.figure.give.text} `, '.']))])).toEqual([])
    })
  }

  it('the paul-hiring shape: a challenge, notes on cards and premises each drawn once, under the previous tab\'s headings in its order', () => {
    const view = read('bakery.view.json'), m = structuredClone(view.model!)
    const opt = m.cards.find((c) => c.family === 'option')!, fig = m.cards.find((c) => c.family === 'quantity')!
    // ED-12 (core): each note keeps its identity (the record it is) and its mark (Olumi's, when Olumi proposed it): one shared premise of
    // theirs on two cards, and a note Olumi proposed on the figure.
    opt.premises = [{ glyph: '⊢', text: 'A shared premise.', title: 'A shared premise. · prerequisite', id: 'shared_premise', olumi: null }]
    fig.premises = [{ glyph: '⊢', text: 'A shared premise.', title: 'again', id: 'shared_premise', olumi: null }, { glyph: '?', text: 'A note on the figure.', title: 'note', id: 'figure_note', olumi: { glyph: '◆', title: 'Proposed by Olumi: a note on the figure.' } }]
    const challenge = { ...opt, id: 'a_challenge', family: 'condition', heading: 'A challenge', reason: 'Demand may fall first.', challenged: true, rows: [], premises: [], driver: null }
    m.cards.push(challenge as never)
    ready({ ...view, model: m })
    render(<ViewReasoning model={m} brief={view.brief} />)
    const root = screen.getByTestId('view-reasoning')
    openAll(root)
    const order = [...root.querySelectorAll('section[aria-label]:not([data-testid="view-reasoning-rack"])')].map((e) => e.getAttribute('aria-label'))
    expect(order.slice(0, 2)).toEqual([REASONING_LABELS.challenge, REASONING_LABELS.premises])
    expect(root.querySelector('[data-reasoning-challenge="a_challenge"] [data-view="a_challenge.reason"]')?.textContent).toBe('Demand may fall first.')
    expect([...root.querySelectorAll('[data-reasoning-premise] [data-view$=".text"]')].map((e) => e.textContent)).toEqual(['A shared premise.', 'A note on the figure.'])
  })
})

describe('pending is never shown as current', () => {
  // R25 (DL 7 Nov after Paul's 6 Nov test, superseding "a held proposal draws nothing"): a held proposal's Run is drawn under core's
  // proposal heading and base, so it never reads as the approved Run; a stale View or a failed read still draws nothing.
  it('a held proposal draws under core\'s heading and base; a stale View or a failed read draws nothing; the approved model draws the Run', () => {
    const held = read('proposal.view.json')
    expect(held.proposal).not.toBeNull()
    ready(held)
    const { rerender } = render(<ViewReasoningBlock />)
    expect(screen.getByTestId('view-reasoning')).not.toBeNull()
    const head = screen.getByTestId('view-tabs-held-proposal')
    expect(head.querySelector('[data-view-proposal="heading"]')!.textContent).toBe(held.proposal!.heading)
    expect(head.querySelector('[data-view-proposal="on"]')!.textContent).toBe(held.proposal!.on)
    const bakery = read('bakery.view.json')
    for (const bad of [{ stale: true }, { error: 'Olumi could not be reached.' }]) {
      ready(bakery, bad)
      rerender(<ViewReasoningBlock />)
      expect(screen.queryByTestId('view-reasoning'), JSON.stringify(bad)).toBeNull()
    }
    ready(bakery)
    rerender(<ViewReasoningBlock />)
    expect(screen.getByTestId('view-reasoning').querySelector('[data-testid="view-reasoning-glance"]')).not.toBeNull()
  })
})

// The redesign's spine (reasoning-redesign-SPEC.md §3 Z2 and §7, PR1): the glance keeps its rows, and each mark now points into the
// model. Bound by card id: the canvas node of that id, the focus helper's argument, the canvas store's selection.
describe('the glance as an instrument: each mark rings, selects and follows its card on the canvas', () => {
  const view = read('s_ce285b3617bb.view.json'), m = view.model!
  const none = () => ({ selection: { nodeIds: new Set<string>(), edgeIds: new Set<string>(), anchorPosition: null } }) as never
  const select = (id: string) => act(() => { useCanvasStore.setState({ selection: { nodeIds: new Set([id]), edgeIds: new Set<string>(), anchorPosition: null } } as never) })
  let focused: string[] = [], unregister: () => void = () => {}
  beforeEach(() => {
    focused = []
    unregister = registerFocusHelpers((id) => { focused.push(id) }, () => {})
    for (const c of m.cards) document.body.insertAdjacentHTML('beforeend', `<div class="react-flow__node" data-id="${c.id}"></div>`)
    useCanvasStore.setState(none())
    ready(view)
  })
  // Unmount first: a node a test drew with React is React's to remove; then the hand-made nodes go.
  afterEach(() => { cleanup(); unregister(); ringCards([]); attCards([]); document.querySelectorAll('.react-flow__node').forEach((e) => e.remove()); useCanvasStore.setState(none()) })
  const lit = () => [...document.querySelectorAll<HTMLElement>('.react-flow__node.v10-lit')].map((e) => e.dataset['id']!).sort()
  const mark = (id: string) => document.querySelector<HTMLButtonElement>(`[data-glance-mark="${id}"]`)!
  const strip = () => [...document.querySelectorAll<HTMLButtonElement>('[data-glance-mark]')]
  const card = (id: string) => m.cards.find((c) => c.id === id)!
  const flags = (c: ViewCard) => c.focus || c.challenged || c.olumi !== null || c.change != null

  it('every mark is a button named by its card\'s heading; pressing one asks the canvas to focus that card, by its id', () => {
    render(<ViewReasoning model={m} brief={view.brief} />)
    const ids = [...document.querySelectorAll<HTMLElement>('[data-glance-card]')].map((e) => e.dataset['glanceCard']!)
    expect(ids.length).toBeGreaterThan(3)
    for (const id of ids) {
      expect(mark(id).tagName).toBe('BUTTON')
      expect(mark(id).getAttribute('aria-label')).toBe(card(id).heading)
      // Named on screen too (DL 9 Nov: unlabelled marks could not be told apart): its heading, by its own card, whole.
      expect(mark(id).querySelector(`[data-view="${id}.heading"]`)?.textContent).toBe(card(id).heading)
    }
    fireEvent.click(mark(ids[2]!))
    expect(focused).toEqual([ids[2]])
  })

  it('the canvas\'s selection is followed back, whoever made it: that card\'s mark alone is pressed; pressing it again lets the card go', () => {
    render(<ViewReasoning model={m} brief={view.brief} />)
    const id = [...document.querySelectorAll<HTMLElement>('[data-glance-card]')][1]!.dataset['glanceCard']!
    expect(mark(id).getAttribute('aria-pressed')).toBe('false')
    select(id)
    expect(strip().filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset['glanceMark'])).toEqual([id])
    fireEvent.click(mark(id))
    expect([...useCanvasStore.getState().selection.nodeIds]).toEqual([])
    expect(focused).toEqual([])
  })

  it('hovering or focusing a mark rings its card beside the chat\'s ring, never over it; leaving clears only its own', () => {
    const chat = 'opening_cash'
    ringCards([chat])
    render(<ViewReasoning model={m} brief={view.brief} />)
    const other = [...document.querySelectorAll<HTMLElement>('[data-glance-card]')].map((e) => e.dataset['glanceCard']!).find((x) => x !== chat)!
    fireEvent.mouseEnter(mark(other))
    expect(lit()).toEqual([chat, other].sort())
    fireEvent.mouseLeave(mark(other))
    expect(lit()).toEqual([chat])
    fireEvent.focus(mark(other))
    expect(lit()).toEqual([chat, other].sort())
    fireEvent.blur(mark(other))
    expect(lit()).toEqual([chat])
  })

  it('pressing a row\'s label rings every card of that kind, by id; pressing it again clears them; the tab leaving clears its ring', () => {
    const { unmount } = render(<ViewReasoning model={m} brief={view.brief} />)
    const row = screen.getByTestId('view-reasoning-glance-options'), family = row.querySelector<HTMLButtonElement>('[data-glance-family="option"]')!
    const ids = [...row.querySelectorAll<HTMLElement>('[data-glance-card]')].map((e) => e.dataset['glanceCard']!)
    expect(ids).toEqual(optionCards(m).map((c) => c.id))
    fireEvent.click(family)
    expect(family.getAttribute('aria-pressed')).toBe('true')
    expect(lit()).toEqual([...ids].sort())
    fireEvent.click(family)
    expect(lit()).toEqual([])
    fireEvent.click(family)
    unmount()
    expect(lit()).toEqual([])
  })

  it('one tab stop; the arrows move in the strip\'s order; N and Shift+N step to the cards core flags; Esc lets the selection go', () => {
    render(<ViewReasoning model={m} brief={view.brief} />)
    const marks = strip(), order = marks.map((b) => b.dataset['glanceMark']!)
    expect(marks.filter((b) => b.tabIndex === 0)).toHaveLength(1)
    act(() => { marks[0]!.focus() })
    fireEvent.keyDown(marks[0]!, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(marks[1])
    expect(marks.filter((b) => b.tabIndex === 0)).toEqual([marks[1]])
    // From the first mark, N skips every mark core does not flag (at least the next one here) to the first that it does, and Shift+N
    // goes the other way round, to the last.
    const flagged = order.filter((id) => flags(card(id)))
    const next = order.findIndex((id, i) => i > 0 && flags(card(id)))
    expect(next).toBeGreaterThan(1)
    act(() => { marks[0]!.focus() })
    fireEvent.keyDown(marks[0]!, { key: 'n' })
    expect(document.activeElement).toBe(marks[next])
    act(() => { marks[0]!.focus() })
    fireEvent.keyDown(marks[0]!, { key: 'N', shiftKey: true })
    expect((document.activeElement as HTMLElement).dataset['glanceMark']).toBe(flagged[flagged.length - 1])
    select(order[3]!)
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect([...useCanvasStore.getState().selection.nodeIds]).toEqual([])
  })

  it('core\'s own pointer keeps Olumi\'s blue ring on its mark; once the person selects that card, its ring is the selection\'s ink', () => {
    render(<ViewReasoning model={m} brief={view.brief} />)
    const ids = strip().map((b) => b.dataset['glanceMark']!), pointed = ids.filter((id) => card(id).focus), plain = ids.filter((id) => !card(id).focus)
    expect(pointed.length).toBeGreaterThan(0)
    // Class tokens, not substrings: every control also carries `focus-visible:ring-info`, its keyboard focus ring.
    for (const id of pointed) expect(mark(id).classList.contains('ring-info'), id).toBe(true)
    for (const id of plain) expect(mark(id).classList.contains('ring-info'), id).toBe(false)
    select(pointed[0]!)
    expect(mark(pointed[0]!).classList.contains('ring-text-header')).toBe(true)
    expect(mark(pointed[0]!).classList.contains('ring-info')).toBe(false)
  })

  it('a named group holds every mark; Home, End and the arrows wrap in the strip\'s order; Esc, from a mark or a row label, lets go', () => {
    ringCards(['opening_cash'])
    render(<ViewReasoning model={m} brief={view.brief} />)
    const group = screen.getByRole('group', { name: REASONING_LABELS.glance }), marks = strip(), last = marks.length - 1
    expect(marks.every((b) => group.contains(b))).toBe(true)
    act(() => { marks[0]!.focus() })
    fireEvent.keyDown(marks[0]!, { key: 'End' })
    expect(document.activeElement).toBe(marks[last])
    fireEvent.keyDown(marks[last]!, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(marks[0])
    fireEvent.keyDown(marks[0]!, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(marks[last])
    fireEvent.keyDown(marks[last]!, { key: 'Home' })
    expect(document.activeElement).toBe(marks[0])
    // Esc from a row label (keyboard focus on it, so no mark holds a ring of its own) lets go of that kind's ring and the selection; the
    // chat's ring is not the tab's to clear.
    const label = screen.getByTestId('view-reasoning-glance-options').querySelector<HTMLButtonElement>('[data-glance-family="option"]')!
    act(() => { label.focus() })
    fireEvent.click(label)
    select(marks[1]!.dataset['glanceMark']!)
    fireEvent.keyDown(label, { key: 'Escape' })
    expect(label.getAttribute('aria-pressed')).toBe('false')
    expect([...useCanvasStore.getState().selection.nodeIds]).toEqual([])
    expect(lit()).toEqual(['opening_cash'])
  })

  it('a key with Alt, Ctrl or Cmd is left to the browser: nothing moves and nothing is prevented', () => {
    render(<ViewReasoning model={m} brief={view.brief} />)
    const marks = strip()
    act(() => { marks[1]!.focus() })
    for (const k of [{ key: 'ArrowLeft', altKey: true }, { key: 'ArrowRight', altKey: true }, { key: 'n', ctrlKey: true }, { key: 'n', metaKey: true }, { key: 'End', ctrlKey: true }]) {
      expect(fireEvent.keyDown(marks[1]!, k), JSON.stringify(k)).toBe(true)
      expect(document.activeElement, JSON.stringify(k)).toBe(marks[1])
    }
  })

  it('the pointer and the keyboard each hold their own ring: moving the pointer off never drops the focused mark\'s card', () => {
    render(<ViewReasoning model={m} brief={view.brief} />)
    const [a, b] = strip().map((x) => x.dataset['glanceMark']!)
    act(() => { mark(a!).focus() })
    expect(lit()).toEqual([a])
    fireEvent.mouseEnter(mark(b!))
    expect(lit()).toEqual([a, b].sort())
    fireEvent.mouseLeave(mark(b!))
    expect(lit()).toEqual([a])
    fireEvent.mouseEnter(mark(a!)); fireEvent.mouseLeave(mark(a!))
    expect(lit()).toEqual([a])
    act(() => { mark(a!).blur() })
    expect(lit()).toEqual([])
  })

  it('pressing another card\'s mark while one is selected asks the canvas for that card, and lets go of nothing', () => {
    render(<ViewReasoning model={m} brief={view.brief} />)
    const [a, b] = strip().slice(2).map((x) => x.dataset['glanceMark']!)
    select(a!)
    fireEvent.click(mark(b!))
    expect(focused).toEqual([b])
    expect([...useCanvasStore.getState().selection.nodeIds]).toEqual([a])
  })

  it('the ring stays on a card the canvas redraws: React Flow rebuilds a node\'s class when its mark selects it, and the ring is put back', async () => {
    // The canvas's own node for one card, as React Flow draws it: its class rebuilt from the selection on every change of its own.
    function Node({ id }: { id: string }) {
      const on = useCanvasStore((s) => s.selection.nodeIds.has(id))
      return <div className={`react-flow__node${on ? ' selected' : ''}`} data-id={id} />
    }
    const target = [...m.cards].find((c) => c.family === 'option')!.id
    document.querySelector(`.react-flow__node[data-id="${target}"]`)!.remove()
    render(<><Node id={target} /><ViewReasoning model={m} brief={view.brief} /></>)
    act(() => { mark(target).focus() })
    expect(lit()).toEqual([target])
    select(target)
    expect(document.querySelector(`.react-flow__node[data-id="${target}"]`)!.classList.contains('selected')).toBe(true)
    await act(async () => { await Promise.resolve() })
    expect(lit()).toEqual([target])
  })

  it('pressing a selected card\'s mark lets go of that card only; the rest of a multi-selection stays', () => {
    render(<ViewReasoning model={m} brief={view.brief} />)
    const [a, b] = strip().map((e) => e.dataset['glanceMark']!)
    act(() => { useCanvasStore.setState({ selection: { nodeIds: new Set([a!, b!]), edgeIds: new Set<string>(), anchorPosition: null } } as never) })
    fireEvent.click(mark(a!))
    expect([...useCanvasStore.getState().selection.nodeIds]).toEqual([b])
    fireEvent.click(mark(b!))
    expect(useCanvasStore.getState().selection.nodeIds.size).toBe(0)
  })

  it('negative: a card the View no longer draws is not ringed from the mark that was under the pointer', () => {
    const { rerender } = render(<ViewReasoning model={m} brief={view.brief} />)
    const gone = strip().map((e) => e.dataset['glanceCard']).find((x): x is string => x !== undefined)!
    fireEvent.mouseEnter(mark(gone))
    expect(lit()).toEqual([gone])
    rerender(<ViewReasoning model={{ ...m, cards: m.cards.filter((c) => c.id !== gone) }} brief={view.brief} />)
    expect(lit()).not.toContain(gone)
  })

  it('Esc from a mark also lets go of that mark\'s own ring', () => {
    render(<ViewReasoning model={m} brief={view.brief} />)
    const id = strip().map((e) => e.dataset['glanceCard']).find((x): x is string => x !== undefined)!
    act(() => { mark(id).focus() })
    expect(lit()).toEqual([id])
    fireEvent.keyDown(mark(id), { key: 'Escape' })
    expect(lit()).toEqual([])
  })
})

// The redesign's head row (reasoning-redesign-SPEC.md §3 Z1, PR0): one home for the tab's state, above the tab, each state said once in
// words already said on this lane, with its way back; nothing at rest. Bound by the strip's own state and the store it acts on.
describe('the tab says its state once, above it', () => {
  const realLook = useViewStore.getState().look
  afterEach(() => { useViewStore.setState({ at: null, look: realLook } as never) })
  const whatIf = read('whatif.view.json')
  const variant = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/whatif.answer.json'), 'utf8')).variants[0] as WhatIfVariant
  const show = (base: number, sid = whatIf.id) => useWhatIf.setState({ shown: { sid, base, quantity: variant.edits[0]!.quantity, typed: '5', variant } })

  it('a held proposal: core\'s heading and version, in the strip above the tab, and said nowhere else', () => {
    const held = read('proposal.view.json')
    ready(held)
    const { container } = render(<ViewReasoningBlock />)
    const strip = screen.getByTestId('view-reasoning-state')
    expect(strip.dataset['state']).toBe('proposal')
    expect(strip.querySelector('[data-view-proposal="heading"]')!.textContent).toBe(held.proposal!.heading)
    expect(strip.querySelector('[data-view-proposal="on"]')!.textContent).toBe(held.proposal!.on)
    expect(container.querySelectorAll('[data-view-proposal="heading"]')).toHaveLength(1)
    expect(strip.compareDocumentPosition(screen.getByTestId('view-reasoning')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('negative: a past version draws no strip and no sentence of the tab\'s own (core sends none for that state; DL 7 Nov)', () => {
    const bakery = read('bakery.view.json')
    ready(bakery, { at: 3 })
    const { container } = render(<ViewReasoningBlock />)
    expect(screen.getByTestId('view-reasoning')).toBeInTheDocument()
    expect(screen.queryByTestId('view-reasoning-state')).toBeNull()
    expect(container.textContent).not.toMatch(/Version 3|as it was|Back to the latest/)
  })

  it('a what-if on this version: said once, in the strip, and Clear there drops it; one asked on another version or scenario is not said', () => {
    ready(whatIf)
    show(whatIf.model!.edit_base!)
    const { container, rerender } = render(<ViewReasoningBlock />)
    expect(screen.getByTestId('view-reasoning-state').dataset['state']).toBe('whatif')
    expect(screen.getByTestId('view-reasoning-whatif').textContent).toBe('What-if, not saved')
    expect(container.textContent!.split('What-if, not saved')).toHaveLength(2)
    expect(screen.queryByTestId('view-whatif-clear')).toBeNull()
    expect(screen.getByTestId('view-whatif').querySelector('[data-view="whatif.edits.0.words"]')!.textContent).toBe(variant.edits[0]!.words)
    fireEvent.click(screen.getByTestId('view-reasoning-whatif-clear'))
    expect(useWhatIf.getState().shown).toBeNull()
    expect(screen.queryByTestId('view-reasoning-state')).toBeNull()
    show(whatIf.model!.edit_base! + 1)
    rerender(<ViewReasoningBlock />)
    expect(screen.queryByTestId('view-reasoning-state')).toBeNull()
    expect(screen.queryByTestId('view-whatif')).toBeNull()
    // The same version number on another scenario (a what-if still held after the person opened another one): not this tab's.
    show(whatIf.model!.edit_base!, 's_00000000ffff')
    rerender(<ViewReasoningBlock />)
    expect(screen.queryByTestId('view-reasoning-state')).toBeNull()
    expect(screen.queryByTestId('view-whatif')).toBeNull()
  })

  it('a proposal held back while a what-if is shown: the strip says the proposal, and the what-if box keeps its own label and Clear', () => {
    // Core holds a proposal back from a viewer who has not given their own view (view.ts `heldProposal`): it serves `proposal`, but the
    // canvas draws the approved version, whose `edit_base` stays set, so a what-if tried on it stays shown. Never unlabelled under the
    // proposal's strip, where it would read as the proposal's figures.
    const held = read('proposal.view.json'), base = 41, v = { ...held, model: { ...held.model!, edit_base: base } }
    expect(held.proposal).not.toBeNull()
    ready(v)
    show(base, v.id)
    const { container } = render(<ViewReasoningBlock />)
    expect(screen.getByTestId('view-reasoning-state').dataset['state']).toBe('proposal')
    expect(screen.queryByTestId('view-reasoning-whatif')).toBeNull()
    expect(screen.getByTestId('view-whatif-clear')).not.toBeNull()
    expect(screen.getByTestId('view-whatif').querySelector('[data-view="whatif.edits.0.words"]')!.textContent).toBe(variant.edits[0]!.words)
    expect(container.textContent!.split('What-if, not saved')).toHaveLength(2)
    fireEvent.click(screen.getByTestId('view-whatif-clear'))
    expect(useWhatIf.getState().shown).toBeNull()
  })

  it('at rest, the latest approved model with nothing tried: no strip, and the tab starts at its own top', () => {
    ready(read('bakery.view.json'))
    const { container } = render(<ViewReasoningBlock />)
    expect(screen.queryByTestId('view-reasoning-state')).toBeNull()
    expect(container.firstElementChild!.childElementCount).toBe(0)
  })
})

describe('try a figure: core\'s what-if, from the Reasoning tab', () => {
  const view = read('whatif.view.json'), answer = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/whatif.answer.json'), 'utf8'))
  const variant = answer.variants[0], id: string = variant.edits[0].quantity
  let posts: Array<{ path: string; body: unknown }> = []
  beforeEach(() => {
    posts = []
    setTeamFetch((async (u: unknown, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') return new Response(JSON.stringify(String(u) === '/api/me' ? { me: { id: view.you_id, name: view.you } } : view), { status: 200 })
      posts.push({ path: String(u), body: JSON.parse(String(init!.body)) })
      return new Response(JSON.stringify(answer), { status: 200 })
    }) as unknown as typeof fetch)
    ready(view)
    useUIStore.setState({ activeOutputTab: 'analysisNew' } as never)
  })

  it('one POST to core\'s what-if with the figure as typed, nothing saved; the answer drawn at the top of this tab, which stays fronted', async () => {
    render(<ViewReasoning model={view.model!} />)
    fireEvent.click(screen.getByTestId('view-reasoning-try-toggle'))
    fireEvent.click(screen.getByTestId(`reasoning-edit-${id}`))
    fireEvent.change(screen.getByTestId(`reasoning-typed-${id}`), { target: { value: '5' } })
    fireEvent.click(screen.getByTestId(`reasoning-try-${id}`))
    const block = await screen.findByTestId('view-whatif')
    expect(posts).toEqual([{ path: `/api/scenarios/${view.id}/whatif`, body: { base: view.model!.edit_base, variants: [{ edits: [{ quantity: id, typed: '5' }] }] } }])
    expect(screen.getByTestId('view-reasoning').firstElementChild).toBe(block)
    expect(block.querySelector('[data-view="whatif.edits.0.words"]')?.textContent).toBe(variant.edits[0].words)
    expect(useUIStore.getState().activeOutputTab).toBe('analysisNew')
  })

  it('under "Try a figure", Enter tries on a copy and never saves: no edit route, no new version', async () => {
    render(<ViewReasoning model={view.model!} />)
    fireEvent.click(screen.getByTestId('view-reasoning-try-toggle'))
    fireEvent.click(screen.getByTestId(`reasoning-edit-${id}`))
    fireEvent.change(screen.getByTestId(`reasoning-typed-${id}`), { target: { value: '5' } })
    fireEvent.submit(screen.getByTestId(`reasoning-form-${id}`))
    await screen.findByTestId('view-whatif')
    expect(posts.map((p) => p.path)).toEqual([`/api/scenarios/${view.id}/whatif`])
  })
})

describe('each option\'s outcome band', () => {
  // bakery's golden (core c838f56): under each option the aim 'Sell at least 360 loaves a week' reads its measured quantity, 'sales'
  // (the chance row's `outcome`, the same figures as the card's `values`). One axis for the aim runs from the least low (carry_on, 300)
  // to the greatest high (second_oven, 387.094…), a span of 87.094…, so second_oven sits at (336.615 − 300) / 87.094 = 42.04% to
  // 100%, its median at 80.33%; longer_hours at 45.32% to 91.55% (a width of 46.22% unrounded), median 68.89%; carry_on, a point at
  // 300, at 0%.
  const view = read('bakery.view.json'), m = view.model!
  const sales = m.cards.find((c) => c.id === 'sales')!
  const PLACES: Record<string, [string, string, string]> = { second_oven: ['42.04%', '57.96%', '80.33%'], longer_hours: ['45.32%', '46.22%', '68.89%'], carry_on: ['0%', '0%', '0%'] }
  const places = (band: Element) => {
    const bar = band.querySelector('[data-band-bar]') as HTMLElement, mid = band.querySelector('[data-band-mid]') as HTMLElement
    return [bar.style.left, bar.style.width, mid.style.left].map((x) => (parseFloat(x).toFixed(2) + '%').replace('.00%', '%'))
  }
  /** The View a core before c838f56 (e16a497) serves: chance rows without `outcome`. */
  const withoutOutcome = (model: ViewModel) => ({ ...model, cards: model.cards.map((c) => ({ ...c, rows: c.rows.map((r) => { const rest: Record<string, unknown> = { ...r }; delete rest['outcome']; return rest }) })) }) as unknown as ViewModel

  it('under each chance row, the aim\'s outcome in core\'s own line, its range reading on hover, every option placed on the aim\'s one axis; no card band beside it', () => {
    ready(view)
    render(<ViewReasoning model={m} />)
    const root = screen.getByTestId('view-reasoning')
    for (const card of optionCards(m)) {
      const i = card.rows.findIndex((r) => r.kind === 'chance' && r.aim_id === 'sell_360'), row = card.rows[i] as Extract<typeof card.rows[number], { kind: 'chance' }>
      const bands = root.querySelectorAll(`[data-view-card="${card.id}"] [data-outcome="sell_360"]`)
      expect(bands.length, card.id).toBe(1)
      expect(bands[0].getAttribute('title')).toBe(row.outcome!.title)
      expect(bands[0].querySelector(`[data-view="${card.id}.rows.${i}.outcome.text"]`)?.textContent).toBe(row.outcome!.text)
      expect(places(bands[0]), card.id).toEqual(PLACES[card.id])
    }
    expect(root.querySelectorAll('[data-band]').length).toBe(0)
  })

  it('each aim has its own axis: s_ce285b3617bb\'s two aims in £ each run from their own least low to their own greatest high', () => {
    // secure_funding: £63,607 (continue_outreach) to £5,287,901, so add_angel_bridge (£82,442 to £2,975,060) sits at 0.36%, 55.37% wide.
    // cash_survival: £124,944 to £5,339,882, both continue_outreach's, so it fills the axis (0%, 100%); one axis for both aims would put
    // it at 1.16%, 98.84% wide.
    const s = read('s_ce285b3617bb.view.json')
    ready(s)
    render(<ViewReasoning model={s.model!} />)
    const root = screen.getByTestId('view-reasoning')
    expect(places(root.querySelector('[data-view-card="continue_outreach"] [data-outcome="cash_survival"]')!).slice(0, 2)).toEqual(['0%', '100%'])
    expect(places(root.querySelector('[data-view-card="add_angel_bridge"] [data-outcome="secure_funding"]')!).slice(0, 2)).toEqual(['0.36%', '55.37%'])
  })

  it('from a core before the row outcome (e16a497): under each option the band\'s card and core\'s own line for it, its range on hover, ◆ only where core marks it Olumi\'s, on one axis', () => {
    const before = withoutOutcome(m)
    ready(view)
    render(<ViewReasoning model={before} />)
    const root = screen.getByTestId('view-reasoning')
    expect(root.querySelectorAll('[data-outcome]').length).toBe(0)
    sales.values!.forEach((v, i) => {
      const bands = root.querySelectorAll(`[data-view-card="${v.option}"] [data-band]`)
      expect(bands.length, v.option).toBe(1)
      const band = bands[0] as HTMLElement
      expect(band.getAttribute('data-band')).toBe('sales')
      expect(band.getAttribute('title')).toBe(sales.figure!.title)
      expect(band.querySelector('[data-view="sales.heading"]')?.textContent).toBe(sales.heading)
      expect(band.querySelector(`[data-view="sales.values.${i}.text"]`)?.textContent).toBe(v.text)
      expect(band.querySelector('[data-view="key.0.glyph"]')?.textContent ?? null, v.option).toBe(v.olumi ? m.key[0].glyph : null)
      expect(places(band), v.option).toEqual(PLACES[v.option])
    })
    expect(m.key[0]).toEqual({ id: 'olumi', glyph: '◆', text: 'Olumi' })
  })

  it('⛔ Olumi\'s key item is core\'s by its id (`olumi`), never by its words: with core\'s words for it changed, ◆ still marks Olumi\'s bands', () => {
    const before = withoutOutcome(m)
    const reworded = { ...before, key: before.key.map((k) => (k.id === 'olumi' ? { ...k, text: 'Olumi’s estimate' } : k)) }
    ready(view)
    render(<ViewReasoning model={reworded} />)
    const root = screen.getByTestId('view-reasoning')
    const olumis = sales.values!.flatMap((v) => (v.olumi ? [v.option] : []))
    expect(olumis.length).toBeGreaterThan(0)
    for (const o of olumis) expect(root.querySelector(`[data-view-card="${o}"] [data-band] [data-view="key.0.glyph"]`)?.textContent ?? null, o).toBe('◆')
  })

  it('must not change: no outcome (null) draws no band; before e16a497 (no field) and with null values nothing; the Analysis tab draws none', () => {
    ready(view)
    const nulls = { ...m, cards: m.cards.map((c) => ({ ...c, rows: c.rows.map((r) => (r.kind === 'chance' ? { ...r, outcome: null } : r)) })) }
    const { rerender } = render(<ViewReasoning model={nulls} />)
    expect(screen.getByTestId('view-reasoning').querySelectorAll('[data-outcome], [data-band]').length).toBe(0)
    const before = withoutOutcome(m)
    rerender(<ViewReasoning model={{ ...before, cards: before.cards.map((c) => ({ ...c, values: null })) }} />)
    expect(screen.getByTestId('view-reasoning').querySelectorAll('[data-outcome], [data-band]').length).toBe(0)
    rerender(<ViewReasoning model={{ ...before, cards: before.cards.map(({ values: _gone, ...c }) => c) } as unknown as ViewModel} />)
    expect(screen.getByTestId('view-reasoning').querySelectorAll('[data-outcome], [data-band]').length).toBe(0)
    rerender(<ViewChances model={m} />)
    expect(screen.getByTestId('view-chances').querySelectorAll('[data-outcome], [data-band]').length).toBe(0)
  })
})

// Olumi's additions stay visibly Olumi's (DL product rules, 7 Nov): on the real boards every challenged and reasoning card is Olumi's
// (`cards[].olumi`), and the canvas marks it; the tab marks it too, with core's glyph and core's words on hover, and never a person's card.
describe('Olumi\'s mark on the challenged and reasoning cards, as core gives it', () => {
  const real = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', `${n}.view3.json`), 'utf8'))
  const rows = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[data-reasoning-challenge], [data-reasoning-card]')]
  const idOf = (e: HTMLElement) => e.dataset['reasoningChallenge'] ?? e.dataset['reasoningCard']!
  for (const name of ['hiring', 'capacity', 'european-22cards', 'hosting']) {
    it(`catch: ${name}: each drawn challenged or reasoning card carries core's Olumi mark in its own row, its words on hover`, () => {
      const view = real(name), m = view.model!
      ready(view)
      const root = render(<ViewReasoning model={m} brief={view.brief} />).container
      openAll(root)
      const drawn = rows(root)
      expect(drawn.length).toBeGreaterThan(0)
      for (const e of drawn) {
        const c = m.cards.find((x) => x.id === idOf(e))!, mark = e.querySelector(`[data-view="${c.id}.olumi.glyph"]`)
        expect(c.olumi, c.id).not.toBeNull()
        expect([mark?.textContent, mark?.getAttribute('title'), mark?.getAttribute('aria-label')], c.id).toEqual([c.olumi!.glyph, c.olumi!.title, c.olumi!.title])
      }
      expect(unbound(root, [...OWN, ...(m.run!.science ?? []).flatMap((l) => (l.figure?.give == null ? [] : [`${l.figure.give.text} `, '.']))])).toEqual([])
    })
  }

  it('negative: a card core does not mark as Olumi\'s (a person\'s own) draws no mark, while its neighbours keep theirs', () => {
    const view = real('hiring'), m = structuredClone(view.model!)
    ready({ ...view, model: m })
    const opened = render(<ViewReasoning model={m} brief={view.brief} />).container
    openAll(opened)
    const first = rows(opened)
    expect(first.length).toBeGreaterThan(1)
    const theirs = idOf(first[0]!), others = first.slice(1).map(idOf)
    cleanup()
    m.cards.find((c) => c.id === theirs)!.olumi = null
    const root = render(<ViewReasoning model={m} brief={view.brief} />).container
    openAll(root)
    expect(root.querySelector(`[data-view="${theirs}.olumi.glyph"]`)).toBeNull()
    for (const id of others) expect(root.querySelector(`[data-view="${id}.olumi.glyph"]`), id).not.toBeNull()
  })
})

// The crafted ChallengeCard's look (analysisNew/sections/ChallengeCard.tsx), ported onto each challenged card: the heading as the zone's
// question on its own line (14px, weight 400) led by core's glyph, then core's reason indented under it, whole: never clamped or cut.
describe('the challenge rows in the crafted ChallengeCard\'s look', () => {
  const real = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', `${n}.view3.json`), 'utf8'))
  it('catch: capacity\'s challenge: core\'s glyph, then its heading as the question line; its reason under it, indented and whole', () => {
    const view = real('capacity'), m = view.model!, c = m.cards.find((x) => x.challenged === true)!
    expect(c.reason).not.toBeNull()
    ready(view)
    const row = render(<ViewReasoning model={m} brief={view.brief} />).container.querySelector<HTMLElement>(`[data-reasoning-challenge="${c.id}"]`)!
    const q = row.querySelector<HTMLElement>('[data-testid="view-reasoning-challenge-question"]')!
    expect(q.className).toContain('text-sm font-normal')
    expect(q.firstElementChild!.getAttribute('data-view')).toBe(`${c.id}.glyph`)
    expect(q.querySelector(`[data-view="${c.id}.heading"]`)!.textContent).toBe(c.heading)
    const r = row.querySelector<HTMLElement>('[data-testid="view-reasoning-challenge-reason"]')!
    expect(q.nextElementSibling).toBe(r)
    expect([r.getAttribute('data-view'), r.textContent]).toEqual([`${c.id}.reason`, c.reason])
    expect(r.className).toContain('pl-3')
    for (const e of [q, r, ...row.querySelectorAll<HTMLElement>('*')]) expect(e.className).not.toMatch(/line-clamp|truncate/)
  })
})

// The crafted Reasoning V2 rest state (ReasoningPanelV3, served 24 Oct): one focus open (the challenge), depth behind one door and closed
// section rows, each with how many rows it opens onto. A closed region is unmounted, so nothing behind a door is walked or read.
describe('the crafted rest state: the challenge open, depth closed behind counted doors', () => {
  const real = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', `${n}.view3.json`), 'utf8'))
  const toggle = (id: string) => screen.getByTestId(`view-reasoning-${id}-toggle`)
  const count = (id: string) => screen.getByTestId(`view-reasoning-${id}`).querySelector('[data-count]')?.textContent

  it('catch: capacity: the question is drawn at rest; the premises and reasoning cards sit behind the closed door, its count the rows it opens onto', () => {
    const view = real('capacity'), m = view.model!
    ready(view)
    const root = render(<ViewReasoning model={m} brief={view.brief} />).container
    const c = m.cards.find((x) => x.challenged === true)!
    expect(root.querySelector(`[data-reasoning-challenge="${c.id}"] [data-view="${c.id}.heading"]`)?.textContent).toBe(c.heading)
    expect(toggle('premises').getAttribute('aria-expanded')).toBe('false')
    expect(root.querySelectorAll('[data-reasoning-premise], [data-reasoning-card]').length).toBe(0)
    fireEvent.click(toggle('premises'))
    expect(toggle('premises').getAttribute('aria-expanded')).toBe('true')
    expect(toggle('premises').getAttribute('aria-controls')).toBe(screen.getByTestId('view-reasoning-premises-region').id)
    const drawn = [...root.querySelectorAll<HTMLElement>('[data-reasoning-premise], [data-reasoning-card]')].map((e) => e.dataset['reasoningPremise'] ?? e.dataset['reasoningCard'])
    // Each premise once by its words, and none in the words of a challenge already drawn above the door (SC-02: said once).
    const seen = new Set<string>(m.cards.flatMap((k) => (k.challenged === true && k.reason !== null ? [k.reason] : []))), want: string[] = []
    for (const k of m.cards) (k.premises ?? []).forEach((p, j) => { if (!seen.has(p.text)) { seen.add(p.text); want.push(`${k.id}.${j}`) } })
    for (const k of m.cards) if (['assumption', 'condition', 'claim', 'evidence', 'left_out'].includes(k.family) && k.challenged !== true && k.reason !== null && !seen.has(k.reason)) want.push(k.id)
    expect(drawn).toEqual(want)
    expect(count('premises')).toBe(String(want.length))
    fireEvent.click(toggle('premises'))
    expect(root.querySelectorAll('[data-reasoning-premise], [data-reasoning-card]').length).toBe(0)
  })

  it('catch: european: "What would change your mind" is a closed row; its count is its worth and compared lines, each drawn at its own path once opened', () => {
    const view = read('european.view.json'), m = view.model!, run = m.run!
    ready(view)
    const root = render(<ViewReasoning model={m} brief={view.brief} />).container
    const worth = (run.science ?? []).flatMap((l, i) => (l.kind === 'worth' ? [`run.science.${i}.line`] : [])), compared = run.compared.map((_, i) => `run.compared.${i}.line`)
    expect(worth.length * compared.length).toBeGreaterThan(0)
    expect(toggle('change').getAttribute('aria-expanded')).toBe('false')
    for (const at of [...worth, ...compared]) expect(root.querySelector(`[data-view="${at}"]`), at).toBeNull()
    expect(count('change')).toBe(String(worth.length + compared.length))
    fireEvent.click(toggle('change'))
    for (const at of [...worth, ...compared]) expect(root.querySelector(`[data-view="${at}"]`), at).not.toBeNull()
  })

  it('negative: a board with no worth or compared lines draws no such row, and none with no premises or reasoning cards draws no door', () => {
    const view = read('capacity-v3.view.json'), m = view.model!
    ready(view)
    render(<ViewReasoning model={m} brief={view.brief} />)
    expect(screen.queryByTestId('view-reasoning-change')).toBeNull()
    expect(screen.queryByTestId('view-reasoning-premises')).toBeNull()
    expect(screen.queryByTestId('view-reasoning-challenge')).toBeNull()
  })

  it('a long brief is held to ONE line with the crafted More (UI restore 11 Nov: the previous strip), whole in the page and on hover; a short brief is drawn whole with no act', () => {
    const long = read('s_ce285b3617bb.view.json')
    ready(long)
    const { unmount } = render(<ViewReasoning model={long.model!} brief={long.brief} />)
    const held = screen.getByTestId('view-reasoning-brief')
    expect([held.dataset['disclosure'], held.querySelector('[data-view="brief"]')?.textContent]).toEqual(['closed', long.brief])
    expect(held.querySelector('.line-clamp-1')).not.toBeNull()
    fireEvent.click(screen.getByTestId('view-reasoning-brief-more'))
    expect([held.dataset['disclosure'], screen.getByTestId('view-reasoning-brief-more').textContent]).toEqual(['open', REASONING_LABELS.less])
    expect(held.querySelector('.line-clamp-1')).toBeNull()
    unmount()
    const short = read('pricing.view.json')
    ready(short)
    render(<ViewReasoning model={short.model!} brief={short.brief} />)
    expect(screen.queryByTestId('view-reasoning-brief')).toBeNull()
    expect(screen.getByTestId('view-reasoning-glance').querySelector('[data-view="brief"]')?.textContent).toBe(short.brief)
  })
})

// The option rack (the redesign's Z3; DL ruling 1, 7 Nov): each option's chance through the one readout the served Analysis tab's option
// row draws it with (port/HeroOptionRow HeroReadout, as PortAnalysisTab mounts AnalysisHeroPanel), in core's order, beside the marks of
// what it rests on; each option a control into the canvas.
describe('the option rack: each option\'s chance, through the served Analysis row\'s one readout, beside what it rests on', () => {
  const real = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', `${n}.view3.json`), 'utf8'))
  const none = () => ({ selection: { nodeIds: new Set<string>(), edgeIds: new Set<string>(), anchorPosition: null } }) as never
  let focused: string[] = [], unregister: () => void = () => {}
  const mount = (view: View) => {
    for (const c of view.model!.cards) document.body.insertAdjacentHTML('beforeend', `<div class="react-flow__node" data-id="${c.id}"></div>`)
    ready(view)
    return render(<ViewReasoning model={view.model!} brief={view.brief} />).container
  }
  beforeEach(() => { focused = []; unregister = registerFocusHelpers((id) => { focused.push(id) }, () => {}); useCanvasStore.setState(none()) })
  afterEach(() => { cleanup(); unregister(); ringCards([]); attCards([]); document.querySelectorAll('.react-flow__node').forEach((e) => e.remove()); useCanvasStore.setState(none()) })
  const rack = () => screen.getByTestId('view-reasoning-rack')
  const lit = () => [...document.querySelectorAll<HTMLElement>('.react-flow__node.v10-lit')].map((e) => e.dataset['id']!).sort()

  // DL ruling 9 Nov: the chances belong to Analysis. These rows replace "catch: <golden>: the options in core's order under core's lens
  // label; each row's readout is the served Analysis row's" and "catch: bakery: each row is core's aim at its path over its readout",
  // which pinned the duplicate chance cards removed here.
  for (const golden of ['bakery.view.json', 'european.view.json', 'proposal.view.json']) {
    it(`catch: ${golden}: Reasoning draws no chance; one link opens Analysis; the options that rest on something, in core's order`, () => {
      const view = read(golden), m = view.model!
      const force = vi.spyOn(useUIStore.getState(), 'forceActivateOutputTab')
      mount(view)
      expect(rack().querySelector('[data-testid="port-row-readout"], [data-view-row], [data-view$=".likely.glyph"]')).toBeNull()
      const resting = optionCards(m).filter((c) => restsOfOption(m, c).length > 0).map((c) => c.id)
      expect([...rack().querySelectorAll<HTMLElement>('[data-rack-option]')].map((e) => e.dataset['rackOption'])).toEqual(resting)
      fireEvent.click(screen.getByTestId('view-reasoning-see-chances'))
      expect(screen.getByTestId('view-reasoning-see-chances').textContent).toBe('See chances in Analysis')
      expect(force).toHaveBeenCalledWith('results')
      force.mockRestore()
    })
  }

  it('pressing an option asks the canvas to focus its card; it shows as pressed while selected, and pressing again lets it go; hover rings it', () => {
    // European, not bakery: an option is drawn only where it rests on something core names (DL ruling 9 Nov), and bakery's rest on nothing.
    const view = read('european.view.json'), o = optionCards(view.model!).find((c) => restsOfOption(view.model!, c).length > 0)!
    mount(view)
    const press = rack().querySelector<HTMLButtonElement>(`[data-rack-press="${o.id}"]`)!
    expect([press.tagName, press.querySelector(`[data-view="${o.id}.heading"]`)?.textContent]).toEqual(['BUTTON', o.heading])
    fireEvent.click(press)
    expect(focused).toEqual([o.id])
    act(() => { useCanvasStore.setState({ selection: { nodeIds: new Set([o.id]), edgeIds: new Set<string>(), anchorPosition: null } } as never) })
    expect(press.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(press)
    expect(useCanvasStore.getState().selection.nodeIds.size).toBe(0)
    fireEvent.mouseEnter(press)
    expect(lit()).toEqual([o.id])
    fireEvent.mouseLeave(press)
    expect(lit()).toEqual([])
  })

  it('catch: european: what each option rests on, one mark per card core names, in core\'s order, core\'s Olumi glyph by its key id; an id no card draws is not drawn', () => {
    const view = read('european.view.json'), m = view.model!, k = m.key.findIndex((x) => x.id === 'olumi')
    mount(view)
    let skipped = 0
    for (const o of optionCards(m)) {
      const want = o.rests_on.filter((r) => m.cards.some((c) => c.id === r.id))
      skipped += o.rests_on.length - want.length
      const marks = [...rack().querySelectorAll<HTMLElement>(`[data-rack-rests="${o.id}"] [data-rack-rest]`)]
      expect(marks.map((e) => e.dataset['rackRest']), o.id).toEqual(want.map((r) => r.id))
      for (const e of marks) {
        const c = m.cards.find((x) => x.id === e.dataset['rackRest'])!
        expect([e.dataset['whose'], e.getAttribute('title'), e.getAttribute('aria-label'), e.querySelector(`[data-view="key.${k}.glyph"]`)?.textContent], c.id).toEqual(['olumi', c.heading, `${c.heading}, ${m.key[k]!.text}`, m.key[k]!.glyph])
      }
    }
    expect(skipped).toBeGreaterThan(0)
  })

  it('hovering what an option rests on rings that card, together with the glance\'s own ring', () => {
    const view = real('hiring'), m = view.model!, o = optionCards(m)[0]!, rest = o.rests_on[0]!.id
    mount(view)
    const glance = document.querySelector<HTMLElement>('[data-glance-card]')!
    fireEvent.mouseEnter(glance)
    fireEvent.mouseEnter(rack().querySelector(`[data-rack-rests="${o.id}"] [data-rack-rest="${rest}"]`)!)
    expect(lit()).toEqual([...new Set([glance.dataset['glanceCard']!, rest])].sort())
    fireEvent.mouseLeave(glance)
    expect(lit()).toEqual([rest])
  })

  it('negative: a person\'s own (theirs) has no Olumi glyph, partly Olumi\'s has core\'s; past 8, the rest is a count', () => {
    const view = structuredClone(read('european.view.json')), m = view.model!, o = optionCards(m)[0]!
    const figures = m.cards.filter((c) => c.family !== 'option').slice(0, 10)
    expect(figures.length).toBe(10)
    o.rests_on = figures.map((c, i) => ({ id: c.id, whose: i === 0 ? 'theirs' : i === 1 ? 'mixed' : 'olumi' }))
    mount(view)
    const marks = [...rack().querySelectorAll<HTMLElement>(`[data-rack-rests="${o.id}"] [data-rack-rest]`)]
    expect(marks.map((e) => e.dataset['rackRest'])).toEqual(figures.slice(0, 8).map((c) => c.id))
    const p = m.key.findIndex((x) => x.id === 'partly_olumi')
    expect([marks[0]!.querySelector('[data-view]'), marks[0]!.getAttribute('aria-label')]).toEqual([null, figures[0]!.heading])
    expect(marks[1]!.querySelector(`[data-view="key.${p}.glyph"]`)?.textContent).toBe(m.key[p]!.glyph)
    expect(rack().querySelector(`[data-rack-rests="${o.id}"] [data-rack-rests-more]`)?.textContent).toBe(`+${figures.length - 8}`)
  })

  it('negative: bakery\'s options rest on nothing core names: no marks, and no empty list', () => {
    mount(read('bakery.view.json'))
    expect(rack().querySelector('[data-rack-rests]')).toBeNull()
  })
})

// The people strip (the redesign's Z4; DL ruling 2, 7 Nov): read-only, the views core shares with this viewer only, each played in the
// Team tab's own components with no call; nothing for a viewer core holds back.
describe('the people strip: the views core shares, read-only, each played in core\'s words', () => {
  const r5 = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/r5', `${n}.view3.json`), 'utf8'))
  const strip = () => screen.queryByTestId('view-reasoning-people')
  const chip = (id: number) => document.querySelector<HTMLButtonElement>(`[data-people-chip="${id}"]`)!
  afterEach(() => { cleanup(); ringCards([]); attCards([]); document.querySelectorAll('.react-flow__node').forEach((e) => e.remove()) })

  it('catch: r5 effects, on the tab as the dock mounts it: one chip per shared view in core\'s order, its name, a mark per kind of effect in core\'s words', () => {
    const view = r5('effects'), c = view.collab, h = c.effect_headings!
    ready(view)
    render(<ViewReasoningBlock />)
    expect(strip()?.getAttribute('aria-label')).toBe(c.heading)
    expect(strip()!.querySelector('[data-view="collab.heading"]')?.textContent).toBe(c.heading)
    const shared = c.shared.filter((v) => !v.skip)
    expect([...strip()!.querySelectorAll<HTMLElement>('[data-people-chip]')].map((e) => [Number(e.dataset['peopleChip']), e.querySelector('[data-people-by]')?.textContent])).toEqual(shared.map((v) => [v.id, v.by]))
    for (const v of shared) {
      const want = (['changes', 'moves', 'same'] as const).filter((st) => (v.effects ?? []).some((e) => 'status' in e && e.status === st))
      expect([...chip(v.id).querySelectorAll<HTMLElement>('[data-people-status]')].map((e) => [e.dataset['peopleStatus'], e.getAttribute('aria-label')]), v.by).toEqual(want.map((st) => [st, h[st]]))
    }
    // No colour for a person or a stance (keyboard focus keeps the lane's focus ring, a state of the control, not of the person).
    expect(strip()!.outerHTML).not.toMatch(/(?<![\w:-])(?:bg|text|border|ring)-(?:info|primary|blue)/)
    expect(strip()!.outerHTML).toMatch(/focus-visible:ring/)
  })

  it('pressing a chip plays that view: its figures and each effect in core\'s words, nothing sent; one at a time; pressing again closes it', () => {
    const view = r5('effects'), c = view.collab, h = c.effect_headings!, [paul, sam] = c.shared
    const calls: unknown[] = []
    setTeamFetch((async (...a: unknown[]) => { calls.push(a); throw new Error('no call expected') }) as never)
    ready(view)
    render(<ViewReasoningBlock />)
    expect(screen.queryByTestId('view-reasoning-people-open')).toBeNull()
    fireEvent.click(chip(paul!.id))
    const open = screen.getByTestId('view-reasoning-people-open')
    expect(chip(paul!.id).getAttribute('aria-pressed')).toBe('true')
    expect([...open.querySelectorAll('[data-testid$="-figures"] li')].map((e) => e.textContent)).toEqual(paul!.figures.map((f) => `${f.label}: ${f.text}`))
    expect([...open.querySelectorAll<HTMLElement>('[data-effect]')].map((e) => e.dataset['effect'])).toEqual(paul!.effects!.map((e) => e.quantity))
    const changes = paul!.effects!.find((e) => 'status' in e && e.status === 'changes') as { quantity: string; gap_text: string }
    const row = open.querySelector(`[data-effect="${changes.quantity}"]`)!
    expect(row.querySelector('[data-effect-status]')?.textContent).toBe(h.changes)
    expect(row.querySelector('[data-effect-gap]')?.textContent).toBe(changes.gap_text)
    fireEvent.click(chip(sam!.id))
    expect(screen.getByTestId('view-reasoning-people-open').dataset['peopleOpen']).toBe(String(sam!.id))
    expect([...screen.getByTestId('view-reasoning-people-open').querySelectorAll('[data-effect-status]')].map((e) => e.textContent)).toEqual(sam!.effects!.map(() => h.refused))
    fireEvent.click(chip(sam!.id))
    expect(screen.queryByTestId('view-reasoning-people-open')).toBeNull()
    expect(calls).toEqual([])
  })

  it('where the Team tab\'s "Where you differ" picture would place a figure, the strip still says all of it (no picture is beside it here)', () => {
    const view = structuredClone(r5('effects')), c = view.collab, h = c.effect_headings!, [paul, sam] = c.shared
    const run = paul!.effects!.find((e) => 'status' in e) as Extract<NonNullable<typeof paul>['effects'][number], { status: string }>
    run.leader = 'add_one'
    sam!.effects = [{ ...run, status: 'moves', leader: 'hold' }] as never
    ready(view)
    render(<ViewReasoningBlock />)
    fireEvent.click(chip(paul!.id))
    const row = screen.getByTestId('view-reasoning-people-open').querySelector(`[data-effect="${run.quantity}"]`)!
    expect(row.querySelector('[data-effect-status]')?.textContent).toBe(h[run.status as 'changes'])
    expect(row.querySelector('[data-effect-leader] [data-effect-option]')?.textContent).toBe(view.model!.cards.find((k) => k.id === 'add_one')!.heading)
  })

  it('hovering a chip rings the cards that view\'s figures sit on', () => {
    const view = r5('effects'), paul = view.collab.shared[0]!
    for (const k of view.model!.cards) document.body.insertAdjacentHTML('beforeend', `<div class="react-flow__node" data-id="${k.id}"></div>`)
    ready(view)
    render(<ViewReasoningBlock />)
    fireEvent.mouseEnter(chip(paul.id))
    const want = paul.effects!.map((e) => e.quantity).filter((q) => view.model!.cards.some((k) => k.id === q)).sort()
    expect(want.length).toBeGreaterThan(0)
    expect([...document.querySelectorAll<HTMLElement>('.react-flow__node.v10-lit')].map((e) => e.dataset['id']).sort()).toEqual(want)
    fireEvent.mouseLeave(chip(paul.id))
    expect(document.querySelectorAll('.react-flow__node.v10-lit').length).toBe(0)
  })

  it('negative: a viewer core holds back (gated) sees no strip; nor does a View in which nobody has shared', () => {
    ready(r5('effects-gated'))
    const { unmount } = render(<ViewReasoningBlock />)
    expect(screen.getByTestId('view-reasoning')).toBeInTheDocument()
    expect(strip()).toBeNull()
    unmount()
    ready(r5('proposal'))
    render(<ViewReasoningBlock />)
    expect(strip()).toBeNull()
  })

  it('negative: a gated viewer sees no strip even were core to send shared views (core\'s rule, held here too)', () => {
    const view = structuredClone(r5('effects')); view.gated = true
    ready(view)
    render(<ViewReasoningBlock />)
    expect(strip()).toBeNull()
  })
})

// UI restore 11 Nov (DL: the previous tab's top was a compact strip): marks are small shapes with their name on hover and focus, and the
// strip says what core holds or asks, and maps two of the previous method chips to the lenses core has.
describe('the compact strip and its review row', () => {
  it('a mark draws its shape only (its name is the hover and the reader\'s label); "N to review" counts the cards core points at, challenges or proposes to change', () => {
    const v = read('proposal.view.json')
    ready(v)
    const { container, unmount } = render(<ViewReasoning model={v.model!} brief={v.brief} />)
    const marks = [...container.querySelectorAll<HTMLElement>('[data-glance-card]')]
    expect(marks.length).toBeGreaterThan(3)
    for (const m of marks) { expect(m.className).toMatch(/\bw-5\b/); expect(m.querySelector('[data-view$=".heading"]')!.className).toMatch(/sr-only/); expect(m.getAttribute('title')).toBe(m.getAttribute('aria-label')) }
    const flagged = v.model!.cards.filter((c) => c.focus || c.challenged || c.change != null).length
    expect(flagged, 'precondition: the proposal golden has cards to review').toBeGreaterThan(0)
    expect(screen.getByTestId('view-reasoning-to-review').textContent).toBe(`${flagged} ${REASONING_LABELS.review}`)
    unmount()
    const plain = read('capacity-v3.view.json')
    ready(plain)
    render(<ViewReasoning model={plain.model!} brief={plain.brief} />)
    const none = plain.model!.cards.filter((c) => c.focus || c.challenged || c.change != null).length
    expect(screen.queryByTestId('view-reasoning-to-review') === null).toBe(none === 0)
  })
  it('the two method chips are core\'s own lens words and set their lens; pressing again returns to the model', () => {
    const v = read('european.view.json')
    ready(v)
    render(<ViewReasoning model={v.model!} brief={v.brief} />)
    const pre = screen.getByTestId('view-reasoning-method-premortem')
    expect(pre.textContent).toBe(v.lens_words.label.premortem)
    fireEvent.click(pre)
    expect(useViewLens.getState().lens).toBe('premortem')
    fireEvent.click(pre)
    expect(useViewLens.getState().lens).toBe('full')
  })
})

describe('Move towards commitment: only what core carries, in its words (DL 11 Nov)', () => {
  it('Still open is core\'s waits_on and Next is the newest reply\'s next step; nothing is drawn when core holds neither', () => {
    const v = read('bakery.view.json')
    expect(v.model!.run!.waits_on, 'precondition: this golden carries waits_on').not.toBeNull()
    ready(v)
    const { unmount } = render(<ViewReasoning model={v.model!} brief={v.brief} />)
    const waits = screen.getByTestId('view-reasoning-waits')
    expect([...waits.querySelectorAll('p')].map((p) => p.textContent)).toEqual([v.model!.run!.waits_on!.head, v.model!.run!.waits_on!.text, ...v.model!.run!.waits_on!.items.map((i) => i.text)])
    unmount()
    const bare = { ...v, chat: [], model: { ...v.model!, run: { ...v.model!.run!, waits_on: null } } } as View
    ready(bare)
    render(<ViewReasoning model={bare.model!} brief={bare.brief} />)
    expect(screen.queryByTestId('view-reasoning-commitment')).toBeNull()
  })
})
