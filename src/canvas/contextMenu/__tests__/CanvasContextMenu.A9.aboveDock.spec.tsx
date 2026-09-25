/**
 * A9 — the context menu and its submenus used to render `position: fixed` at
 * z-100/101, siblings in the DOM to `OutputsDock`'s `position: fixed;
 * z-index: 900` aside (`OutputsDock.tsx:2954`). Stacking order between two
 * `fixed` elements is decided by z-index alone, independent of DOM order, so
 * for any card near the dock the dock painted OVER the menu: "Explain",
 * "Challenge" and "Trace" could not be clicked.
 *
 * Fixed two ways, both asserted here:
 *   1. z-index raised above 900, numerically — not merely "a bigger-looking
 *      class name" (Tailwind's `z-[100]` vs `z-[951]` sort alphabetically the
 *      WRONG way, `1` < `9`, so a string comparison would pass on a regression).
 *   2. portalled to `document.body`, matching the established pattern
 *      (`NodePopover.tsx`: "Renders via createPortal to escape ReactFlow's
 *      stacking context") rather than left nested whatever ReactFlow-adjacent
 *      ancestor a future refactor puts it under.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CanvasContextMenu } from '../CanvasContextMenu'
import type { PaneTarget, NodeTarget } from '../types'

vi.mock('../../ToastContext', () => ({
  useShowToast: () => vi.fn(),
}))

vi.mock('../../store', () => {
  const mockState = {
    clipboard: null,
    nodes: [{ id: 'n1', type: 'factor', data: { label: 'Marketing budget', kind: 'factor' }, position: { x: 0, y: 0 } }],
    edges: [],
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    results: { status: 'idle', report: null },
    canUndo: () => false,
    canRedo: () => false,
    undo: vi.fn(),
    redo: vi.fn(),
    viewMode: 'standard' as const,
    setViewMode: vi.fn(),
    applyLayout: vi.fn(),
  }
  const mockStore = vi.fn((selector: any) => selector(mockState)) as any
  mockStore.getState = () => mockState
  mockStore.setState = (_partial: any) => {}
  return {
    useCanvasStore: mockStore,
    selectResultsStatus: (state: any) => state.results.status,
    selectReport: (state: any) => state.results.report,
  }
})

vi.mock('../../stores/guidanceStore', () => ({
  useGuidanceStore: {
    getState: () => ({ _sendMessage: null }),
  },
}))

const onClose = vi.fn()
const screenToFlowPosition = vi.fn((pos: any) => pos)

/** Pulls the numeric value out of a Tailwind arbitrary z-index class, e.g. `z-[951]` → 951. */
function zIndexOf(el: Element): number {
  const match = Array.from(el.classList).map(c => c.match(/^z-\[(\d+)\]$/)).find(Boolean)
  if (!match) throw new Error(`no z-[N] class on ${el.className}`)
  return Number(match[1])
}

/** The dock's own literal, so a drift in the real value REDs this file rather than going unnoticed. */
const DOCK_Z_INDEX = 900

beforeEach(() => {
  vi.clearAllMocks()
})

describe('the context menu paints above the dock', () => {
  const paneTarget: PaneTarget = { kind: 'pane', screenPos: { x: 100, y: 200 } }

  it('portals the menu to document.body, not nested under the render container', () => {
    const { container } = render(
      <CanvasContextMenu target={paneTarget} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />,
    )
    const menu = screen.getByRole('menu', { name: 'Canvas context menu' })
    expect(container.contains(menu), 'the menu is still nested inside the render container, not portalled').toBe(false)
    expect(document.body.contains(menu)).toBe(true)
  })

  it('the menu z-index is numerically above the dock, not merely a longer digit string', () => {
    render(
      <CanvasContextMenu target={paneTarget} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />,
    )
    const menu = screen.getByRole('menu', { name: 'Canvas context menu' })
    expect(zIndexOf(menu)).toBeGreaterThan(DOCK_Z_INDEX)
  })

  it('the backdrop that dismisses the menu is also above the dock', () => {
    const { container } = render(
      <CanvasContextMenu target={paneTarget} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />,
    )
    const backdrop = document.querySelector('[role="presentation"].fixed.inset-0')
    expect(backdrop, 'PRECONDITION: the backdrop must be found').not.toBeNull()
    expect(container.contains(backdrop)).toBe(false)
    expect(zIndexOf(backdrop!)).toBeGreaterThan(DOCK_Z_INDEX)
  })
})

const NODE_N1 = { id: 'n1', type: 'factor', data: { label: 'Marketing budget', kind: 'factor' }, position: { x: 0, y: 0 } }

describe('a submenu paints above the dock too', () => {
  const nodeTarget: NodeTarget = {
    kind: 'node',
    nodeId: 'n1',
    nodeType: 'factor',
    node: NODE_N1 as any,
    screenPos: { x: 100, y: 200 },
  }

  it('the "Ask AI" submenu is portalled and above the dock', () => {
    const { container } = render(
      <CanvasContextMenu target={nodeTarget} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />,
    )
    const askAi = screen.getByText('Ask AI').closest('button')!
    fireEvent.click(askAi)

    const menus = screen.getAllByRole('menu')
    const submenu = menus.find(m => m !== screen.getByRole('menu', { name: 'Canvas context menu' }))
    expect(submenu, 'PRECONDITION: the submenu must have opened').not.toBeUndefined()
    expect(container.contains(submenu!)).toBe(false)
    expect(document.body.contains(submenu!)).toBe(true)
    expect(zIndexOf(submenu!)).toBeGreaterThan(DOCK_Z_INDEX)
  })

  it('the submenu stacks above the PARENT menu too, so it is never hidden behind it', () => {
    render(
      <CanvasContextMenu target={nodeTarget} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />,
    )
    const askAi = screen.getByText('Ask AI').closest('button')!
    fireEvent.click(askAi)

    const parentMenu = screen.getByRole('menu', { name: 'Canvas context menu' })
    const submenu = screen.getAllByRole('menu').find(m => m !== parentMenu)!
    expect(zIndexOf(submenu)).toBeGreaterThan(zIndexOf(parentMenu))
  })
})
