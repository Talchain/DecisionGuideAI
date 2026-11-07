/**
 * Plan v3 card finish lines (slice 1, DL/PL rulings 7 Nov): a card's full text opens on selection AND keyboard focus, not hover only; a card
 * the proposal changes is told apart at rest from a proposed addition and a kept card, with core's words for what changes when opened; the
 * title keeps room for the card's ⌄; and on a board with more than one aim, the lead chance names its aim on the face (Paul: "can't tell
 * which aim a chance is for"), while a one-aim board keeps it for readers and on hover (fitA2). Every word is core's, drawn verbatim.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, render } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import type { View, ViewModel } from '../client'
import { ViewCard, ViewCardNode } from '../../canvas/nodes/ViewCardNode'
import { focusedCardOf, useViewFocusCard, VIEW_CARD } from '../canvas'

afterEach(() => { cleanup(); useViewFocusCard.setState({ id: null }) })
const golden = (n: string) => (JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${n}.view.json`), 'utf8')) as View).model!
const real = (n: string) => (JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', `${n}.view3.json`), 'utf8')) as View).model!
const cardOf = (m: ViewModel, id: string) => m.cards.find((c) => c.id === id)!

describe('a chance says which aim it is for', () => {
  it('catch: with two aims, the lead chance names its aim on the face, in core\'s words, its ◎ once', () => {
    const card = cardOf(real('hiring'), 'hire_tech_lead'), at = `${card.id}.rows.0`
    const c = render(<ViewCard card={card} />).container
    const aim = c.querySelector<HTMLElement>(`[data-view="${at}.aim"]`)!
    expect(aim.className).not.toContain('sr-only')
    expect(aim.textContent).toBe((card.rows[0] as { aim: string }).aim)
    expect([...c.querySelector(`[data-view-row="${at}"]`)!.textContent!].filter((ch) => ch === '◎').length).toBe(1)
  })
  it('must not change (fitA2): with one aim, the lead chance keeps its aim for readers and on hover', () => {
    const card = cardOf(real('capacity'), 'keep_staffing')
    expect(card.rows.filter((r) => r.kind === 'chance').length).toBe(1)
    const c = render(<ViewCard card={card} />).container
    expect(c.querySelector<HTMLElement>(`[data-view="${card.id}.rows.0.aim"]`)!.className).toContain('sr-only')
  })
})

describe('proposed, changed and kept cards are told apart at rest', () => {
  const m = golden('proposal'), changed = cardOf(m, 'per_specialist'), kept = m.cards.find((c) => c.change === null && c.family !== 'option')!
  it('catch: a card the proposal changes carries the proposal\'s border at rest; core\'s words for the change open with the card', () => {
    expect(changed.change?.kind).toBe('changed')
    const rest = render(<ViewCard card={changed} />).container.querySelector<HTMLElement>('[data-view-card]')!
    expect(rest.hasAttribute('data-changed-card')).toBe(true)
    expect(rest.className).toContain('border-info')
    expect(rest.querySelector('[data-view-more]')!.hasAttribute('hidden')).toBe(true)
    cleanup()
    const open = render(<ViewCard card={changed} selected />).container
    const words = open.querySelector<HTMLElement>(`[data-view-more] [data-view="${changed.id}.change.title"]`)!
    expect(words.textContent).toBe(changed.change!.title)
    expect(changed.change!.title).toContain('\n') // core writes a line per changed field…
    expect(words.className).toContain('whitespace-pre-line') // …and they stay lines (checker, slice 1)
    expect(open.querySelector('[data-view-more]')!.hasAttribute('hidden')).toBe(false)
  })
  it('CONTRAST: a kept card has the plain border and no change words; a proposed addition is the translucent ghost, not "changed"', () => {
    const k = render(<ViewCard card={kept} />).container.querySelector<HTMLElement>('[data-view-card]')!
    expect(k.hasAttribute('data-changed-card')).toBe(false)
    expect(k.className).toContain('border-border')
    cleanup()
    const added = { ...kept, change: { kind: 'added', glyph: '+', title: 'Proposed addition' } } as typeof kept
    const a = render(<ViewCard card={added} />).container.querySelector<HTMLElement>('[data-view-card]')!
    expect(a.hasAttribute('data-proposed-card')).toBe(true)
    expect(a.hasAttribute('data-changed-card')).toBe(false)
  })
})

describe('full text opens on selection and keyboard focus, never cut', () => {
  it('catch: an opened card\'s premises are whole (no ellipsis), each core\'s words', () => {
    const card = cardOf(real('capacity'), 'add_specialist')
    expect(card.premises.length).toBeGreaterThan(0)
    const c = render(<ViewCard card={card} selected />).container
    card.premises.forEach((p, j) => {
      const row = c.querySelector<HTMLElement>(`[data-premise-row="${card.id}.${j}"]`)!
      expect(row.className).not.toMatch(/truncate|line-clamp|text-ellipsis/)
      expect(row.querySelector(`[data-view="${card.id}.premises.${j}.text"]`)!.textContent).toBe(p.text)
    })
  })
  // As React Flow draws a card: its focusable node wrapper round the card.
  const node = (card: ViewModel['cards'][number]) => {
    const tree = () => (
      <ReactFlowProvider><div className="react-flow__node" data-id={card.id} tabIndex={0}>
        <ViewCardNode {...({ id: card.id, data: { card, label: card.heading }, selected: false, type: VIEW_CARD } as unknown as NodeProps)} />
      </div></ReactFlowProvider>
    )
    const { container: c, rerender } = render(tree())
    return { wrap: c.querySelector<HTMLElement>('.react-flow__node')!, more: () => c.querySelector<HTMLElement>('[data-view-more]')!, redraw: () => rerender(tree()) }
  }
  it('catch: keyboard focus on a card (not selected) opens its other words; focus on another card does not', () => {
    const card = cardOf(real('capacity'), 'add_specialist')
    const n = node(card)
    act(() => { n.wrap.focus(); useViewFocusCard.setState({ id: card.id }) })
    expect(n.more().hasAttribute('hidden')).toBe(false)
    act(() => { useViewFocusCard.setState({ id: 'some-other-card' }) })
    expect(n.more().hasAttribute('hidden')).toBe(true)
  })
  it('catch (DL 7 Nov run 0717): a card whose focus has gone (its control unmounted, so no blur came) closes on its next draw, though the name is stale', () => {
    const card = cardOf(real('capacity'), 'add_specialist')
    const n = node(card)
    const away = document.body.appendChild(document.createElement('button'))
    act(() => { n.wrap.focus(); useViewFocusCard.setState({ id: card.id }) })
    expect(n.more().hasAttribute('hidden')).toBe(false)
    act(() => { away.focus() })
    expect(useViewFocusCard.getState().id).toBe(card.id) // no listener here: the name is stale, as when the focused control unmounts
    n.redraw() // the card draws again (a new version, a selection)
    expect(n.more().hasAttribute('hidden')).toBe(true)
    away.remove()
  })
  it('the canvas reads which card has focus from React Flow\'s node, also when focus is on a control inside it', () => {
    const host = document.createElement('div')
    host.innerHTML = '<div class="react-flow__node" data-id="c1" tabindex="0"><button>✎</button></div><div class="react-flow__edge" data-id="e"></div>'
    expect(focusedCardOf(host.querySelector('.react-flow__node'))).toBe('c1')
    expect(focusedCardOf(host.querySelector('button'))).toBe('c1')
    expect(focusedCardOf(host.querySelector('.react-flow__edge'))).toBeNull()
  })
})

describe('the title keeps room for the card\'s controls', () => {
  it('catch: a card with more to open keeps its title clear of its ⌄; a card with nothing more does not reserve it', () => {
    const withMore = cardOf(golden('european'), 'entry_delay')
    const c = render(<ViewCard card={withMore} />).container
    expect(c.querySelector('[data-more-cue]')).not.toBeNull()
    expect(c.querySelector(`[data-view-title="${withMore.id}"]`)!.className).toContain('pr-4')
    cleanup()
    const plain = cardOf(golden('bakery'), 'base_sales')
    const p = render(<ViewCard card={plain} />).container
    expect(p.querySelector('[data-more-cue]')).toBeNull()
    expect(p.querySelector(`[data-view-title="${plain.id}"]`)!.className).not.toContain('pr-4')
  })
})
