/**
 * Audit SI-5 (27 Sep 2026) — Enter/Space on a focused card opens what a click
 * opens.
 *
 * Measured on pricing, local and served: Tab to "Bottom-Up Adoption Friction"
 * (accessible name "Factor: … Open details. …"), Enter → the card is selected
 * and NO inspector opens; Enter again, Space — the same. A click on the same
 * card opens it, and Enter on a focused LINK opens the relationship inspector
 * (`StyledEdge.tsx` ROW 35). The inspector opens from `onNodeClick` alone
 * (`ReactFlowGraph.tsx` `handleNodeClick`), and React Flow's own key handler
 * never calls it — selection only.
 *
 * So the assertion is on the seam the app hangs the inspector on: does the
 * key reach `onNodeClick`? Mounted through a real `<ReactFlow>` and the real
 * `withNodeKeyboardScope` (the one `registry.ts` wraps every renderer with,
 * pinned both ways by `registry.keyboardScope.spec.tsx`).
 *
 * What jsdom cannot show — that the panel then appears on screen — is
 * witnessed in a browser (pricing: Enter and Space on the Question both open
 * "Question · Pricing Model Transition Strategy").
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { createElement } from 'react'
import { ReactFlow, ReactFlowProvider, type Node } from '@xyflow/react'
import { withNodeKeyboardScope } from '../nodeKeyboardScope'

const CONTROL_LABEL = 'in-card control under test'

function ProbeCard() {
  return createElement(
    'div',
    { style: { width: 160, height: 60 } },
    createElement('button', { type: 'button', 'aria-label': CONTROL_LABEL }, 'press me'),
  )
}
ProbeCard.displayName = 'ProbeCard'

const TYPES = { probe: withNodeKeyboardScope(ProbeCard) }

function mount(nodes: Node[]) {
  const onNodeClick = vi.fn()
  const { container } = render(
    createElement(ReactFlowProvider, null, createElement(ReactFlow, { nodes, edges: [], nodeTypes: TYPES, onNodeClick })),
  )
  const card = (id: string) => {
    const el = container.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)
    expect(el, `PRECONDITION: React Flow rendered no wrapper for ${id}`).not.toBeNull()
    return el!
  }
  return { onNodeClick, card, container }
}

const CARD: Node = { id: 'fac_adoption_friction', type: 'probe', position: { x: 0, y: 0 }, data: {} }

describe('SI-5 — a focused card answers Enter and Space the way it answers a click', () => {
  beforeAll(() => {
    // React Flow measures; give the flow a size so the wrappers render and bind.
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 600 })
  })

  it('CONTRAST — a click on the card reaches onNodeClick in this harness (the inspector\'s seam)', () => {
    const { onNodeClick, card } = mount([CARD])
    fireEvent.click(card(CARD.id))
    expect(onNodeClick).toHaveBeenCalledTimes(1)
    expect(onNodeClick.mock.calls[0][1].id).toBe(CARD.id)
  })

  it.each([['Enter'], [' ']])('⭐ %j on the focused card reaches onNodeClick, once, for THAT card', (key) => {
    const { onNodeClick, card } = mount([CARD, { ...CARD, id: 'other', position: { x: 300, y: 0 } }])
    const el = card(CARD.id)
    el.focus()
    expect(document.activeElement, 'PRECONDITION: focus is on the card').toBe(el)
    const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    el.dispatchEvent(ev)
    expect(onNodeClick).toHaveBeenCalledTimes(1)
    expect(onNodeClick.mock.calls[0][1].id).toBe(CARD.id)
    expect(ev.defaultPrevented, 'Space must not scroll the page; Enter must not submit anything').toBe(true)
  })

  it('a key that is not Enter or Space does nothing', () => {
    const { onNodeClick, card } = mount([CARD])
    fireEvent.keyDown(card(CARD.id), { key: 'a' })
    fireEvent.keyDown(card(CARD.id), { key: 'ArrowRight' })
    expect(onNodeClick).not.toHaveBeenCalled()
  })

  it.each([['metaKey'], ['ctrlKey'], ['altKey'], ['shiftKey']])('a modified Enter (%s) is left to the canvas shortcuts', (mod) => {
    const { onNodeClick, card } = mount([CARD])
    fireEvent.keyDown(card(CARD.id), { key: 'Enter', [mod]: true })
    expect(onNodeClick).not.toHaveBeenCalled()
  })

  it('Enter on a control INSIDE the card is the control\'s, never the card\'s', () => {
    const { onNodeClick, container } = mount([CARD])
    const control = container.querySelector<HTMLElement>(`[aria-label="${CONTROL_LABEL}"]`)!
    control.focus()
    expect(document.activeElement).toBe(control)
    fireEvent.keyDown(control, { key: 'Enter' })
    expect(onNodeClick).not.toHaveBeenCalled()
  })

  it('a card that is not selectable (a frontier door) is not opened by Enter', () => {
    const { onNodeClick, card } = mount([{ ...CARD, id: '__ghost-factor__', selectable: false }])
    fireEvent.keyDown(card('__ghost-factor__'), { key: 'Enter' })
    expect(onNodeClick).not.toHaveBeenCalled()
  })
})
