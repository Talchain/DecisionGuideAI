/**
 * ⛔ ONE ARROW PRESS, ONE MOVE (found by the skeptics of edit-structure/F1 and
 * F4, served build, 27 Sep 2026).
 *
 * With a card focused — and clicking a card focuses it — every arrow press was
 * handled twice: the canvas's own `nudgeSelected` (1 unit, 10 with Shift) AND
 * React Flow's built-in keyboard move for a focused, selected node (5 units,
 * ×4 with Shift). Measured: Shift+ArrowRight moved a card 30, ArrowRight 6.
 * Unfocused, Shift+ArrowRight moved 10. So the distance of a press depended on
 * where focus happened to be, and React Flow's half pushed one undo frame per
 * press past the canvas's own burst coalescing.
 *
 * ⭐ The canvas's nudge is the one handler: React Flow's node-level move is
 * withheld through its own opt-out (`.nokey`, armed for the one dispatch — the
 * mechanism `nodeKeyboardScope` already owns), and a press another handler has
 * already consumed is never moved a second time.
 *
 * Mounted for real: `<ReactFlow>` bound to the canvas store, with the canvas's
 * keyboard hook, keys fired at the focused node wrapper — the path a click then
 * an arrow takes.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { createElement } from 'react'
import { ReactFlow, ReactFlowProvider, type Node } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { useKeyboardShortcuts } from '../useKeyboardShortcuts'
import { NODE_KEYBOARD_SCOPE_CLASS } from '../nodes/nodeKeyboardScope'

const MOVED = 'fac_vendor_indicator'
const OTHER = 'fac_vendor_cost'

function Canvas() {
  useKeyboardShortcuts()
  const nodes = useCanvasStore((s) => s.nodes)
  const onNodesChange = useCanvasStore((s) => s.onNodesChange)
  return createElement(ReactFlow, { nodes, edges: [], onNodesChange })
}

function mount(): HTMLElement {
  const { container } = render(createElement(ReactFlowProvider, null, createElement(Canvas)))
  const el = container.querySelector<HTMLElement>(`.react-flow__node[data-id="${MOVED}"]`)
  expect(el, 'React Flow did not render the node wrapper — nothing below measures anything').not.toBeNull()
  return el!
}

const xOf = (id: string) => useCanvasStore.getState().nodes.find((n) => n.id === id)!.position.x

beforeAll(() => {
  // jsdom reports 0x0; give the flow a size so the node wrapper renders and binds.
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 600 })
})

beforeEach(() => {
  useCanvasStore.getState().resetCanvas()
  act(() => {
    useCanvasStore.setState({
      nodes: [
        { id: MOVED, position: { x: 764, y: 758 }, data: { label: 'Vendor Solution Adoption' }, selected: true },
        { id: OTHER, position: { x: 1060, y: 758 }, data: { label: 'Vendor Licensing Cost' } },
      ] as Node[],
      selection: { nodeIds: new Set([MOVED]), edgeIds: new Set(), anchorPosition: null },
    } as never)
  })
})

afterEach(cleanup)

describe('an arrow press on a focused card moves it once', () => {
  it('⛔ Shift+ArrowRight on the focused, selected card moves it exactly 10', () => {
    const node = mount()
    node.focus()
    const x0 = xOf(MOVED)
    act(() => { fireEvent.keyDown(node, { key: 'ArrowRight', shiftKey: true }) })
    expect(xOf(MOVED) - x0, 'the press was handled by more than one mover').toBe(10)
    expect(xOf(OTHER), 'an unselected card moved').toBe(1060)
  })

  it('⛔ ArrowRight on the focused card moves it exactly 1', () => {
    const node = mount()
    node.focus()
    const x0 = xOf(MOVED)
    act(() => { fireEvent.keyDown(node, { key: 'ArrowRight' }) })
    expect(xOf(MOVED) - x0).toBe(1)
  })

  it('⭐ CONTRAST — the same press with focus on the page (unfocused card) is the same distance', () => {
    mount()
    const x0 = xOf(MOVED)
    act(() => { fireEvent.keyDown(document.body, { key: 'ArrowRight', shiftKey: true }) })
    expect(xOf(MOVED) - x0).toBe(10)
  })

  it('⛔ a press another handler already consumed is not moved a second time', () => {
    mount()
    const consume = (e: Event) => e.preventDefault()
    document.body.addEventListener('keydown', consume)
    try {
      const x0 = xOf(MOVED)
      act(() => { fireEvent.keyDown(document.body, { key: 'ArrowRight', shiftKey: true }) })
      expect(xOf(MOVED) - x0).toBe(0)
    } finally {
      document.body.removeEventListener('keydown', consume)
    }
  })

  it('⭐ React Flow keeps the node keyboard it owns: Enter at the node still reaches it, and nothing stays armed', async () => {
    const node = mount()
    node.focus()
    act(() => { fireEvent.keyDown(node, { key: 'ArrowRight' }) })
    await new Promise((r) => setTimeout(r, 0))
    expect(document.querySelectorAll(`.${NODE_KEYBOARD_SCOPE_CLASS}`).length, 'the opt-out outlived the press — React Flow would refuse a marquee here').toBe(0)
    let seen = -1
    node.addEventListener('keydown', () => { seen = document.querySelectorAll(`.${NODE_KEYBOARD_SCOPE_CLASS}`).length }, true)
    act(() => { fireEvent.keyDown(node, { key: 'Enter' }) })
    expect(seen, 'Enter at the node was withheld from React Flow — keyboard selection would break').toBe(0)
  })
})
