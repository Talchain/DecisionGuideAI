import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { CanvasContextMenuBase, type MenuItemsHook } from '../contextMenu/CanvasContextMenu'
import { contextMenuOpener, type ContextTarget } from '../contextMenu/types'
import { Menu, MenuItem, SubMenu } from '../../olumiView/look/Menu.tsx'

vi.mock('../ToastContext', () => ({ useShowToast: () => vi.fn(), useShowToastSafe: () => vi.fn() }))
vi.mock('../hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({ proposeFactorValue: vi.fn() }),
}))

const addFactor = vi.fn()
const heldAction = vi.fn()
const point = { x: 20, y: 40 }
const useItems: MenuItemsHook = ({ onClose }) => ({
  overlay: null,
  items: [
    {
      id: 'add', label: 'Add', tooltip: 'Add a card to the model', enabled: true, action: vi.fn(),
      hasSubmenu: true, submenuItems: [
        { id: 'add-factor', label: 'Factor', tooltip: '', enabled: true, action: () => { addFactor(); onClose() } },
      ],
    },
    { id: 'details', label: 'Open details', tooltip: '', enabled: true, action: vi.fn() },
    { id: 'delete', label: 'Delete', tooltip: '', enabled: true, destructive: true, action: vi.fn() },
    { id: 'arrange', label: 'Auto-arrange', tooltip: '', enabled: false, disabledReason: 'No cards to arrange', action: heldAction },
  ],
})

function Canvas({ anotherMenu = false, onCanvasClick = vi.fn() }) {
  const [target, setTarget] = useState<ContextTarget | null>(null)
  return (
    <>
      <button data-card-menu-opener="" type="button"
        onClick={(event) => event.currentTarget.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))}
        onContextMenu={(event) => {
          event.preventDefault()
          setTarget({ kind: 'pane', screenPos: point, opener: contextMenuOpener(event) })
        }}>
        More actions for Lead time
      </button>
      <div data-testid="canvas" onClick={onCanvasClick} />
      {target && <CanvasContextMenuBase target={target} onClose={() => setTarget(null)} screenToFlowPosition={(p) => p} useItems={useItems} />}
      {anotherMenu && <Menu anchor={point} label="Another menu" onClose={vi.fn()}><MenuItem id="other" label="Other action" /></Menu>}
    </>
  )
}

function openMenu() {
  const opener = screen.getByRole('button', { name: 'More actions for Lead time' })
  fireEvent.click(opener)
  const menu = screen.getByRole('menu', { name: 'Canvas context menu' })
  return { opener, menu, add: within(menu).getByRole('menuitem', { name: 'Add' }) }
}

const key = (key: string) => fireEvent.keyDown(document.activeElement!, { key })

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('the shared canvas menu', () => {
  it('moves focus into the menu, wraps navigation and restores focus to the card opener on Escape', () => {
    render(<Canvas />)
    const { add, menu, opener } = openMenu()
    const rows = within(menu).getAllByRole('menuitem')
    expect(add).toHaveFocus()
    expect(add).toHaveAttribute('tabindex', '0')
    key('ArrowUp')
    expect(rows[rows.length - 1]).toHaveFocus()
    expect(add).toHaveAttribute('tabindex', '-1')
    key('ArrowDown')
    expect(add).toHaveFocus()
    key('End')
    expect(rows[rows.length - 1]).toHaveFocus()
    key('Home')
    key('o')
    expect(rows[1]).toHaveFocus()
    key('Escape')
    expect(menu).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('opens Add with Right and returns to its row with Left or the first Escape', () => {
    render(<Canvas />)
    const { add, menu, opener } = openMenu()
    key('ArrowRight')
    const submenu = screen.getByRole('menu', { name: 'Add' })
    expect(within(submenu).getByRole('menuitem', { name: 'Factor' })).toHaveFocus()
    key('ArrowLeft')
    expect(submenu).not.toBeInTheDocument()
    expect(add).toHaveFocus()
    key('ArrowRight')
    key('Escape')
    expect(screen.queryByRole('menu', { name: 'Add' })).toBeNull()
    expect(menu).toBeInTheDocument()
    expect(add).toHaveFocus()
    key('Escape')
    expect(opener).toHaveFocus()
  })

  it('opens Add by hovering and activates a child with Space', () => {
    vi.useFakeTimers()
    render(<Canvas />)
    const { add } = openMenu()
    fireEvent.mouseEnter(add)
    act(() => { vi.advanceTimersByTime(150) })
    expect(screen.getByRole('menu', { name: 'Add' })).toBeInTheDocument()
    key('ArrowRight')
    key(' ')
    expect(addFactor).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes a keyboard-opened submenu on entering a different top-level row', () => {
    render(<Canvas />)
    const { add, menu } = openMenu()
    key('ArrowRight')
    expect(screen.getByRole('menu', { name: 'Add' })).toBeInTheDocument()
    const details = within(menu).getByRole('menuitem', { name: 'Open details' })
    fireEvent.mouseEnter(details)
    expect(screen.queryByRole('menu', { name: 'Add' })).toBeNull()
    expect(add).toHaveAttribute('aria-expanded', 'false')
    expect(details).toHaveFocus()
  })

  it('cancels the older parent row tip on hover-open and suppresses it on re-entry', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '0')
    vi.useFakeTimers()
    render(<Canvas />)
    const { add } = openMenu()
    fireEvent.mouseEnter(add)
    act(() => { vi.advanceTimersByTime(150) })
    expect(screen.getByRole('menu', { name: 'Add' })).toBeInTheDocument()
    fireEvent.mouseLeave(add)
    fireEvent.mouseEnter(add)
    act(() => { vi.advanceTimersByTime(300) })
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(add).not.toHaveAttribute('aria-describedby')
  })

  it('closes the entire chain on Tab and leaves the native Tab action available', () => {
    render(<Canvas />)
    openMenu()
    key('ArrowRight')
    expect(key('Tab')).toBe(true)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes the first menu when a second opens', () => {
    const { rerender } = render(<Canvas />)
    openMenu()
    key('ArrowRight')
    rerender(<Canvas anotherMenu />)
    expect(screen.getAllByRole('menu')).toEqual([screen.getByRole('menu', { name: 'Another menu' })])
    expect(screen.getByRole('menuitem', { name: 'Other action' })).toHaveFocus()
  })

  it('leaves an Escape already handled by another surface alone', () => {
    render(<Canvas />)
    const { add, menu } = openMenu()
    add.addEventListener('keydown', (event) => event.preventDefault(), { once: true })
    key('Escape')
    expect(menu).toBeInTheDocument()
    key('Escape')
    expect(menu).not.toBeInTheDocument()
  })

  it('dismisses on outside pointer-down and lets the same click reach the canvas', () => {
    const onCanvasClick = vi.fn()
    render(<Canvas onCanvasClick={onCanvasClick} />)
    openMenu()
    const canvas = screen.getByTestId('canvas')
    fireEvent.pointerDown(canvas)
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(canvas)
    expect(onCanvasClick).toHaveBeenCalledOnce()
  })

  it('keeps the older shell and full row classes, including keyboard focus styling', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '0')
    render(<Canvas />)
    const { menu } = openMenu()
    expect(menu).toHaveClass('olumi-menu-older')
    expect(menu.className.match(/rounded-md .*?shadow-2/)?.[0]).toMatchInlineSnapshot(
      '"rounded-md border border-panel-border bg-panel py-2 shadow-2"',
    )
    const row = within(menu).getByRole('menuitem', { name: 'Delete' })
    expect(row.className).toMatchInlineSnapshot(
      '"group flex h-9 px-4 text-xs font-sans leading-relaxed w-full items-center justify-between gap-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset transition-colors cursor-pointer text-text-body hover:bg-panel-hover"',
    )
    key('d')
    expect(row).toHaveFocus()
    expect(row.className).toMatchInlineSnapshot(
      '"group flex h-9 px-4 text-xs font-sans leading-relaxed w-full items-center justify-between gap-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset transition-colors cursor-pointer bg-panel-hover text-danger"',
    )
  })

  it('shows the reason for a held lane row and guards pointer and keyboard activation', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    vi.useFakeTimers()
    render(<Canvas />)
    const { menu } = openMenu()
    key('End')
    const held = within(menu).getByRole('menuitem', { name: 'Auto-arrange' })
    expect(held).toHaveFocus()
    expect(held).toHaveAttribute('aria-disabled', 'true')
    act(() => { vi.advanceTimersByTime(150) })
    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveTextContent('No cards to arrange')
    expect(held).toHaveAttribute('aria-describedby', tip.id)
    fireEvent.click(held)
    key('Enter')
    key(' ')
    expect(heldAction).not.toHaveBeenCalled()
    expect(menu).toBeInTheDocument()
  })
})

const FLYOUT_WIDTH = 232

function openPlacedSubmenu(parentX: number, rowY: number, viewportHeight = 720, flyoutHeight = 144) {
  const viewportWidth = 1000
  vi.stubGlobal('innerWidth', viewportWidth)
  vi.stubGlobal('innerHeight', viewportHeight)
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(viewportWidth)
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(viewportHeight)
  vi.spyOn(document.body, 'clientWidth', 'get').mockReturnValue(viewportWidth)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.getAttribute('aria-label') === 'Placement parent') return new DOMRect(parentX, rowY - 40, 220, 240)
    if (this.dataset.menuRow === 'add') return new DOMRect(parentX + 16, rowY, 24, 36)
    return new DOMRect()
  })
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.getAttribute('aria-label') === 'Add' ? FLYOUT_WIDTH : 0
  })
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    if (this.getAttribute('aria-label') !== 'Add') return 0
    return Math.min(flyoutHeight, Number.parseFloat(this.style.maxHeight) || flyoutHeight)
  })

  render(
    <Menu anchor={point} label="Placement parent" onClose={vi.fn()}>
      <SubMenu id="add" label="Add"><MenuItem id="factor" label="Factor" /></SubMenu>
    </Menu>,
  )
  key('ArrowRight')
  const parent = screen.getByRole('menu', { name: 'Placement parent' })
  const row = within(parent).getByRole('menuitem', { name: 'Add' })
  const flyout = screen.getByRole('menu', { name: 'Add' })
  return { parent, row, flyout }
}

describe('shared menu flyout placement', () => {
  it('opens to the right of the parent panel and aligns to the row top', async () => {
    const { parent, row, flyout } = openPlacedSubmenu(16, 100)
    await waitFor(() => {
      expect(flyout.style.left).toBe(`${parent.getBoundingClientRect().right + 4}px`)
      expect(flyout.style.top).toBe(`${row.getBoundingClientRect().top}px`)
    })
  })

  it('flips to the left near the viewport edge and keeps the row alignment', async () => {
    const { parent, row, flyout } = openPlacedSubmenu(780, 100)
    await waitFor(() => {
      expect(flyout.style.left).toBe(`${parent.getBoundingClientRect().left - FLYOUT_WIDTH - 4}px`)
      expect(flyout.style.top).toBe(`${row.getBoundingClientRect().top}px`)
    })
  })

  it.each([[-40, 8], [690, 720 - 144 - 8]])('shifts a row at y=%s to keep the 8px viewport gutter', async (rowY, top) => {
    const { flyout } = openPlacedSubmenu(16, rowY)
    await waitFor(() => { expect(flyout.style.top).toBe(`${top}px`) })
  })

  it('sets maxHeight and keeps a tall flyout within a short viewport', async () => {
    const viewportHeight = 120
    const { flyout } = openPlacedSubmenu(16, 80, viewportHeight, 300)
    await waitFor(() => {
      expect(flyout.style.maxHeight).toBe('72px')
      const top = Number.parseFloat(flyout.style.top)
      expect(top).toBeGreaterThanOrEqual(8)
      expect(top + flyout.offsetHeight).toBeLessThanOrEqual(viewportHeight - 8)
    })
  })
})
