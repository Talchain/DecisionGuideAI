import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasContextMenu } from '../contextMenu/CanvasContextMenu'
import { getSubmenuPosition, Submenu } from '../contextMenu/Submenu'
import type { MenuEntry } from '../contextMenu/types'

vi.mock('../ToastContext', () => ({ useShowToast: () => vi.fn(), useShowToastSafe: () => vi.fn() }))
vi.mock('../hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({ proposeFactorValue: vi.fn() }),
}))
vi.mock('../contextMenu/actions', () => ({ setValueCustom: vi.fn() }))
vi.mock('../contextMenu/useMenuItems', () => {
  const items = [{
    id: 'add-node', label: 'Add node', tooltip: '', enabled: true,
    action: vi.fn(), hasSubmenu: true,
    submenuItems: [{ id: 'add-factor', label: 'Factor', tooltip: '', enabled: true, action: vi.fn() }],
  }]
  return { useMenuItems: () => items }
})
vi.mock('../contextMenu/MenuTooltip', () => ({
  MenuTooltip: () => null,
  useTooltipDelay: () => ({ activeTooltip: null, showTooltip: vi.fn(), hideTooltip: vi.fn() }),
}))

const SUBMENU_WIDTH = 180
const SUBMENU_HEIGHT = 144
const items: MenuEntry[] = [
  { id: 'add-factor', label: 'Factor', tooltip: '', enabled: true, action: vi.fn() },
]

function box(left: number, top: number, width: number, height: number): DOMRect {
  return new DOMRect(left, top, width, height)
}

function submenuPosition(menu: HTMLElement): { x: number; y: number } {
  return { x: Number.parseFloat(menu.style.left), y: Number.parseFloat(menu.style.top) }
}

function openStandalone(anchorRect: DOMRect): HTMLElement {
  render(<Submenu items={items} anchorRect={anchorRect} onClose={vi.fn()} />)
  return screen.getByRole('menu')
}

function renderAddMenu(): { parent: HTMLElement; addNode: HTMLElement } {
  render(
    <CanvasContextMenu
      target={{ kind: 'pane', screenPos: { x: 8, y: 80 } }}
      onClose={vi.fn()}
      screenToFlowPosition={position => position}
    />,
  )
  return {
    parent: screen.getByRole('menu', { name: 'Canvas context menu' }),
    addNode: screen.getByRole('menuitem', { name: 'Add node' }),
  }
}

function openedSubmenu(parent: HTMLElement): HTMLElement {
  return screen.getAllByRole('menu').find(menu => menu !== parent)!
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('innerWidth', 1000)
  vi.stubGlobal('innerHeight', 720)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.getAttribute('aria-label') === 'Canvas context menu') return box(8, 80, 220, 240)
    if (this.getAttribute('role') === 'menu') return box(0, 0, SUBMENU_WIDTH, SUBMENU_HEIGHT)
    // Deliberately narrower than the parent panel: an item's leading content
    // cannot define the flyout's horizontal boundary.
    if (this.getAttribute('role') === 'menuitem') return box(24, 88, 24, 36)
    return box(0, 0, 0, 0)
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('EDIT-UX slice 3a: the add submenu sits beside its parent', () => {
  it('opens to the right of a parent at the left viewport edge', () => {
    const parent = box(0, 80, 220, 36)
    const position = submenuPosition(openStandalone(parent))
    expect(position.x).toBeGreaterThanOrEqual(parent.right)
    expect(position.x + SUBMENU_WIDTH).toBeLessThanOrEqual(window.innerWidth)
    expect(position.y).toBe(parent.top)
  })

  it('flips wholly to the left of a parent near the right viewport edge', () => {
    const parent = box(780, 80, 220, 36)
    const position = submenuPosition(openStandalone(parent))
    expect(position.x + SUBMENU_WIDTH).toBeLessThanOrEqual(parent.left)
    expect(position.x).toBeGreaterThanOrEqual(0)
    expect(position.y).toBe(parent.top)
  })

  it('clamps an anchor above the viewport back inside its top edge', () => {
    const position = submenuPosition(openStandalone(box(0, -40, 220, 36)))
    expect(position.y).toBeGreaterThanOrEqual(8)
    expect(position.y + SUBMENU_HEIGHT).toBeLessThanOrEqual(window.innerHeight)
  })

  it('clamps a low anchor inside the bottom viewport edge', () => {
    const position = submenuPosition(openStandalone(box(0, 690, 220, 36)))
    expect(position.y).toBeGreaterThanOrEqual(8)
    expect(position.y + SUBMENU_HEIGHT).toBeLessThanOrEqual(window.innerHeight - 8)
  })

  it('constrains the flyout to available side space when neither side fits its normal width', () => {
    const parent = box(110, 80, 220, 36)
    const position = getSubmenuPosition(parent, { width: SUBMENU_WIDTH, height: SUBMENU_HEIGHT }, {
      width: 450, height: 720,
    })
    const width = Math.min(SUBMENU_WIDTH, position.maxWidth)
    expect(position.left).toBeGreaterThanOrEqual(parent.right)
    expect(position.left + width).toBeLessThanOrEqual(450 - 8)
    expect(position.maxWidth).toBeGreaterThan(0)
    expect(position.maxWidth).toBeLessThan(SUBMENU_WIDTH)
  })

  it('keeps a tall flyout inside the viewport by limiting its height', () => {
    const position = getSubmenuPosition(box(0, 80, 220, 36), { width: SUBMENU_WIDTH, height: 300 }, {
      width: 1000, height: 120,
    })
    expect(position.top).toBe(8)
    expect(position.top + position.maxHeight).toBe(120 - 8)
  })

  it('clicking Add node anchors beside the parent menu rather than at the viewport origin', () => {
    const { parent, addNode } = renderAddMenu()
    fireEvent.click(addNode)
    const position = submenuPosition(openedSubmenu(parent))
    expect(position.x).toBeGreaterThanOrEqual(parent.getBoundingClientRect().right)
    expect(position.y).toBe(addNode.getBoundingClientRect().top)
  })

  it('opening Add node by keyboard measures the same parent and item as clicking', () => {
    const { parent, addNode } = renderAddMenu()
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    fireEvent.keyDown(document, { key: 'ArrowRight' })
    const position = submenuPosition(openedSubmenu(parent))
    expect(position.x).toBeGreaterThanOrEqual(parent.getBoundingClientRect().right)
    expect(position.y).toBe(addNode.getBoundingClientRect().top)
  })

  it('mutant pair: narrow legacy row bounds overlap the parent; the live hover flyout does not', () => {
    const { parent, addNode } = renderAddMenu()
    const parentBox = parent.getBoundingClientRect()
    const oldAnchor = addNode.getBoundingClientRect()
    // The previous algorithm opened at anchorRect.right + 2. Keep that
    // explicit mutant so these bounds demonstrate the reported overlap.
    const legacyX = oldAnchor.right + 2
    expect(legacyX).toBeLessThan(parentBox.right)
    expect(legacyX + SUBMENU_WIDTH).toBeGreaterThan(parentBox.left)

    fireEvent.mouseEnter(addNode)
    act(() => vi.advanceTimersByTime(150))
    const position = submenuPosition(openedSubmenu(parent))
    expect(position.x).toBeGreaterThanOrEqual(parentBox.right)
    expect(position.x).not.toBe(legacyX)
    expect(position.y).toBe(oldAnchor.top)
  })
})
