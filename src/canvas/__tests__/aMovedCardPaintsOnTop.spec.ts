/**
 * ⛔ A CARD THE USER HAS JUST MOVED PAINTS ON TOP (canvas audit edit-structure/F4,
 * reproduced on the served build, 27 Sep 2026).
 *
 * Drag 'Top Account Revenue Concentration' (a factor) onto the Alternatives row
 * of `pricing-model` and let go. While it is selected React Flow lifts it
 * (z 1000). Deselect it and it drops to z 0 — and with no z of its own the paint
 * order is the store's card order, which is alphabetical by id (`dec_`, `fac_`,
 * `goal_`, `opt_`, …). A factor dropped onto an option ALWAYS lands underneath
 * it: 60 of 121 sample points on the dropped card hit the option, the title read
 * "Top… Co…", and a reload kept it that way.
 *
 * ⭐ The spec: after a committed move — a drag released, or a keyboard nudge —
 * the moved card stands above every card it was not moved with, and that
 * survives in the node itself (so the autosave keeps it). The store's card
 * ORDER never changes: ELK lays out with `considerModelOrder`, so reordering the
 * array would make Auto-arrange depend on which card was touched last.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import type { Node, NodeChange } from '@xyflow/react'
import { useCanvasStore } from '../store'

/** Served `pricing-model` order (alphabetical by id, as the store holds it). */
const IDS = ['dec_pricing', 'fac_enterprise_revenue_risk', 'fac_top_account_concentration', 'goal_nrr', 'opt_status_quo', 'opt_usage_new_logos']
const DROPPED = 'fac_top_account_concentration'
const UNDER = 'opt_status_quo'

const zOf = (id: string) => {
  const z = useCanvasStore.getState().nodes.find((n) => n.id === id)!.zIndex
  return typeof z === 'number' ? z : 0
}
const others = (ids: readonly string[]) => IDS.filter((id) => !ids.includes(id))
const order = () => useCanvasStore.getState().nodes.map((n) => n.id)

function seed() {
  act(() => {
    useCanvasStore.setState({
      nodes: IDS.map((id, i) => ({ id, type: id.split('_')[0] === 'fac' ? 'factor' : id.split('_')[0] === 'opt' ? 'option' : id.startsWith('dec') ? 'decision' : 'goal', position: { x: 100 + i * 200, y: 300 }, data: { label: id } })) as Node[],
      selection: { nodeIds: new Set<string>(), edgeIds: new Set<string>(), anchorPosition: null },
    } as never)
  })
}

/** What React Flow emits for a mouse drag: moves while dragging, then the release. */
function dragAndRelease(id: string, to: { x: number; y: number }) {
  const step = (dragging: boolean): NodeChange[] => [{ id, type: 'position', position: to, dragging } as NodeChange]
  act(() => { useCanvasStore.getState().onNodesChange(step(true)) })
  act(() => { useCanvasStore.getState().onNodesChange(step(false)) })
}

beforeEach(() => {
  useCanvasStore.getState().resetCanvas()
  seed()
})

describe('a moved card paints on top (edit-structure/F4)', () => {
  it('precondition: at rest nothing carries a z — paint order is the store order', () => {
    for (const id of IDS) expect(zOf(id)).toBe(0)
    expect(order().indexOf(UNDER), 'the fixture no longer puts the option after the factor').toBeGreaterThan(order().indexOf(DROPPED))
  })

  it('⛔ a released drag lifts the dropped card above every other card', () => {
    dragAndRelease(DROPPED, { x: 674, y: 270 })
    for (const id of others([DROPPED])) {
      expect(zOf(DROPPED), `the dropped card still paints under ${id}`).toBeGreaterThan(zOf(id))
    }
  })

  it('⛔ a keyboard nudge lifts the nudged card too', () => {
    act(() => { useCanvasStore.getState().selectNodes(['fac_enterprise_revenue_risk']) })
    act(() => { useCanvasStore.getState().nudgeSelected(10, 0) })
    for (const id of others(['fac_enterprise_revenue_risk'])) {
      expect(zOf('fac_enterprise_revenue_risk'), `the nudged card still paints under ${id}`).toBeGreaterThan(zOf(id))
    }
  })

  it('⭐ the LAST moved card wins, and the earlier one stays above the untouched cards', () => {
    dragAndRelease(DROPPED, { x: 674, y: 270 })
    dragAndRelease('fac_enterprise_revenue_risk', { x: 700, y: 280 })
    expect(zOf('fac_enterprise_revenue_risk')).toBeGreaterThan(zOf(DROPPED))
    expect(zOf(DROPPED)).toBeGreaterThan(zOf(UNDER))
  })

  it('⭐ the card order is untouched — Auto-arrange must not depend on what was moved last', () => {
    const before = order()
    dragAndRelease(DROPPED, { x: 674, y: 270 })
    act(() => { useCanvasStore.getState().selectNodes([UNDER]) })
    act(() => { useCanvasStore.getState().nudgeSelected(0, 10) })
    expect(order()).toEqual(before)
  })

  it('⭐ a held arrow key does not climb: a burst on one card raises it once', () => {
    act(() => { useCanvasStore.getState().selectNodes([DROPPED]) })
    act(() => { useCanvasStore.getState().nudgeSelected(10, 0) })
    const z = zOf(DROPPED)
    for (let i = 0; i < 20; i++) act(() => { useCanvasStore.getState().nudgeSelected(10, 0) })
    expect(zOf(DROPPED)).toBe(z)
  })

  it('⭐ however many moves, a resting card never reaches React Flow’s selected lift (1000)', () => {
    for (let i = 0; i < 1200; i++) dragAndRelease(i % 2 ? DROPPED : UNDER, { x: i, y: 270 })
    const top = Math.max(...IDS.map(zOf))
    expect(top).toBeLessThan(1000)
    // …and the ordering it encodes is still the order of the moves.
    expect(zOf(DROPPED)).toBeGreaterThan(zOf(UNDER))
    expect(zOf(UNDER)).toBeGreaterThan(zOf('goal_nrr'))
  })

  it('⛔ CONTRAST — selecting, measuring or dragging-in-progress raises nothing', () => {
    act(() => {
      useCanvasStore.getState().onNodesChange([
        { id: DROPPED, type: 'select', selected: true },
        { id: UNDER, type: 'dimensions', dimensions: { width: 248, height: 120 } },
      ] as NodeChange[])
    })
    act(() => { useCanvasStore.getState().onNodesChange([{ id: DROPPED, type: 'position', position: { x: 1, y: 1 }, dragging: true } as NodeChange]) })
    for (const id of IDS) expect(zOf(id), id).toBe(0)
  })
})
