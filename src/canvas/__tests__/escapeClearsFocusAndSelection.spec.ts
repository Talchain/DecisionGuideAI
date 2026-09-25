/**
 * ESC CLEARS FOCUS AND SELECTION — contract v3.1 §01 (DESIGN-GAP-AUDIT row 36,
 * chrome cluster, 25 Sep 2026).
 *
 * The contract's reference board: "Escape" hides the inspector and tooltip and
 * calls `focusGraph(null)` — nothing selected, nothing dimmed. On the canvas the
 * dim is DERIVED from the selection (`usePathHighlight` clears the path dim and
 * the transient focus dim when the selection empties), so clearing the
 * selection IS restoring the reference view state.
 *
 * Before this change Escape did that only while a CARD held focus (React Flow's
 * own node handler, `elementSelectionKeys` includes 'Escape'). With focus
 * anywhere else — the page, a toolbar button, the pane after a click — Escape
 * left the selection and its dim in place.
 *
 * ⛔ AND ESCAPE STILL BELONGS TO WHATEVER IS OPEN. It must not clear while the
 * user is typing, or while a dialog or menu is open — there Escape means "close
 * this", and closing it must not also throw away the selection behind it. Each
 * of those is a CONTRAST case below, and one case proves the guard is not
 * over-broad: the Olumi panel is a PERSISTENT non-modal `role="dialog"`, and
 * its mere presence on the page must not disable the key.
 *
 * Drives the REAL hook against the REAL canvas store and the REAL
 * confirm-dialog store. Bound by identity: node `n-selected`, edge
 * `e-selected`, the store's `selection` sets.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'
import { useKeyboardShortcuts } from '../useKeyboardShortcuts'
import { useCanvasStore } from '../store'
import { useConfirmDialogStore } from '../stores/confirmDialogStore'
import type { EdgeData } from '../domain/edges'

const SELECTED_NODE = 'n-selected'
const OTHER_NODE = 'n-other'
const SELECTED_EDGE = 'e-selected'

function node(id: string, selected: boolean): Node {
  return { id, type: 'factor', position: { x: 0, y: 0 }, data: { label: id }, selected }
}

function seedSelection(): void {
  useCanvasStore.setState({
    nodes: [node(SELECTED_NODE, true), node(OTHER_NODE, false)],
    edges: [{ id: SELECTED_EDGE, source: SELECTED_NODE, target: OTHER_NODE, data: {} as EdgeData, selected: true } as Edge<EdgeData>],
    selection: {
      nodeIds: new Set([SELECTED_NODE]),
      edgeIds: new Set([SELECTED_EDGE]),
      anchorPosition: { x: 1, y: 1 },
    },
  } as never)
}

function isCleared(): boolean {
  const s = useCanvasStore.getState()
  return (
    s.selection.nodeIds.size === 0 &&
    s.selection.edgeIds.size === 0 &&
    s.nodes.find((n) => n.id === SELECTED_NODE)?.selected === false &&
    s.edges.find((e) => e.id === SELECTED_EDGE)?.selected === false
  )
}

function isIntact(): boolean {
  const s = useCanvasStore.getState()
  return (
    s.selection.nodeIds.has(SELECTED_NODE) &&
    s.selection.edgeIds.has(SELECTED_EDGE) &&
    s.nodes.find((n) => n.id === SELECTED_NODE)?.selected === true &&
    s.edges.find((e) => e.id === SELECTED_EDGE)?.selected === true
  )
}

function press(key: string, target: EventTarget = document.body): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

/** Mount a fixture element for one test; removed in afterEach. */
function mount<T extends HTMLElement>(el: T): T {
  document.body.appendChild(el)
  return el
}

function el(tag: string, attrs: Record<string, string> = {}): HTMLElement {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  return e
}

beforeEach(() => {
  seedSelection()
  useConfirmDialogStore.setState({ pending: null } as never)
  renderHook(() => useKeyboardShortcuts())
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  useConfirmDialogStore.setState({ pending: null } as never)
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
})

describe('Escape clears focus and selection (contract v3.1 §01)', () => {
  it('PRECONDITION: the seeded node and edge are selected, in the flags AND the sets', () => {
    expect(isIntact()).toBe(true)
  })

  it('⭐ Escape with focus on the page clears the node AND the edge selection', () => {
    press('Escape')
    expect(isCleared()).toBe(true)
    expect(useCanvasStore.getState().selection.anchorPosition).toBeNull()
  })

  it('⭐ Escape from a toolbar button (not a card) clears it too', () => {
    const button = mount(el('button', { type: 'button', 'aria-label': 'Zoom in' }))
    button.focus()
    press('Escape', button)
    expect(isCleared()).toBe(true)
  })

  it('CONTRAST: a key other than Escape clears nothing', () => {
    press('Enter')
    expect(isIntact()).toBe(true)
  })

  it('⭐ a PERSISTENT non-modal dialog (the Olumi panel) merely on the page does not disable the key', () => {
    mount(el('div', { role: 'dialog', 'aria-label': 'Olumi conversation' }))
    press('Escape')
    expect(isCleared()).toBe(true)
  })

  it('CONTRAST: an expanded DISCLOSURE elsewhere (no popup) does not disable the key', () => {
    mount(el('button', { type: 'button', 'aria-expanded': 'true' }))
    press('Escape')
    expect(isCleared()).toBe(true)
  })

  it('the open inspector (non-modal, focus on the canvas) does not hold the key — the contract’s own Escape hides it AND clears focus', () => {
    mount(el('div', { role: 'dialog', 'aria-modal': 'false', 'aria-label': 'Node inspector' }))
    press('Escape')
    expect(isCleared()).toBe(true)
  })
})

describe('Escape belongs to what is open — the canvas does not also clear', () => {
  it.each([
    ['an input', () => mount(el('input', { type: 'text' }))],
    ['a textarea', () => mount(el('textarea'))],
  ])('typing in %s', (_label, make) => {
    const field = make()
    field.focus()
    press('Escape', field)
    expect(isIntact()).toBe(true)
  })

  it('typing in a contenteditable (jsdom has no `isContentEditable`; set as a browser reports it)', () => {
    const editable = mount(el('div', { contenteditable: 'true' }))
    Object.defineProperty(editable, 'isContentEditable', { value: true })
    press('Escape', editable)
    expect(isIntact()).toBe(true)
  })

  it('an open menu anywhere on the page', () => {
    mount(el('div', { role: 'menu' }))
    press('Escape')
    expect(isIntact()).toBe(true)
  })

  it('an open modal dialog anywhere on the page', () => {
    mount(el('div', { role: 'dialog', 'aria-modal': 'true' }))
    press('Escape')
    expect(isIntact()).toBe(true)
  })

  it('an open alert dialog anywhere on the page', () => {
    mount(el('div', { role: 'alertdialog' }))
    press('Escape')
    expect(isIntact()).toBe(true)
  })

  it('a popover whose trigger is expanded (e.g. the visual key) — and the SAME trigger collapsed does clear', () => {
    const trigger = mount(el('button', { type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'true' }))
    press('Escape', trigger)
    expect(isIntact()).toBe(true)

    trigger.setAttribute('aria-expanded', 'false')
    press('Escape', trigger)
    expect(isCleared()).toBe(true)
  })

  it('an expanded popup trigger ELSEWHERE — focus has moved off it (the document-wide arm)', () => {
    mount(el('button', { type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'true' }))
    press('Escape')
    expect(isIntact()).toBe(true)
  })

  it('focus on an expanded control that declares no popup (a card’s guidance icon) — and collapsed, it clears', () => {
    const icon = mount(el('button', { type: 'button', 'aria-expanded': 'true' }))
    icon.focus()
    press('Escape', icon)
    expect(isIntact()).toBe(true)

    icon.setAttribute('aria-expanded', 'false')
    press('Escape', icon)
    expect(isCleared()).toBe(true)
  })

  it('focus inside a non-modal dialog (Escape is that surface’s key)', () => {
    const panel = mount(el('div', { role: 'dialog', 'aria-label': 'Olumi conversation' }))
    const inside = el('button', { type: 'button' })
    panel.appendChild(inside)
    inside.focus()
    press('Escape', inside)
    expect(isIntact()).toBe(true)
  })

  it('the confirm dialog is asking a question', () => {
    useConfirmDialogStore.setState({ pending: { title: 'Remove?', onConfirm: () => {} } } as never)
    press('Escape')
    expect(isIntact()).toBe(true)
  })
})

describe('Escape with nothing selected is a no-op', () => {
  it('writes nothing to the store (the node array keeps its identity)', () => {
    useCanvasStore.setState({
      nodes: [node(SELECTED_NODE, false)],
      edges: [],
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    } as never)
    const before = useCanvasStore.getState().nodes
    press('Escape')
    expect(useCanvasStore.getState().nodes).toBe(before)
  })
})
