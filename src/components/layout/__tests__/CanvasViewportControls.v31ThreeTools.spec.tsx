/**
 * ⭐ CONTRACT v3.1 `.zoom-tools`: −, + AND FIT ON THE CANVAS; EVERYTHING ELSE ONE
 * CLICK AWAY (DESIGN-GAP #14, 26 Sep 2026).
 *
 * MEASURED at base `6256a41f`: the lower toolbar drew six controls — a "50"
 * read-out, zoom out, zoom in, Fit, Auto-arrange and "?" — in 32px circles.
 * v3.1 draws three. This pins, by identity:
 *   1. at rest: zoom out, zoom in, fit — and ONE overflow, nothing else;
 *   2. every moved control is still reachable and still does what it did:
 *      reset to 100% (with the level on its face), Auto-arrange, the
 *      Standard/Detailed toggle (moved here from the canvas tools' eye,
 *      DESIGN-GAP #13), and the canvas key;
 *   3. the menu behaves as a menu: Escape closes it and returns focus.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

import { CanvasViewportControls } from '../CanvasViewportControls'
import { useCanvasStore } from '../../../canvas/store'

function renderControls() {
  const handlers = {
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomReset: vi.fn(),
    onFitView: vi.fn(),
    onAutoArrange: vi.fn(),
  }
  render(
    <ReactFlowProvider>
      <CanvasViewportControls {...handlers} />
    </ReactFlowProvider>,
  )
  return handlers
}

const openMenu = () => {
  fireEvent.click(screen.getByTestId('viewport-more'))
  return screen.getByRole('menu', { name: 'More view options' })
}

beforeEach(() => {
  useCanvasStore.setState({ viewMode: 'standard' } as never)
})

describe('v3.1 zoom tools — at rest', () => {
  it('⭐ shows −, +, fit and one overflow — no read-out, no auto-arrange, no "?"', () => {
    renderControls()
    const nav = screen.getByRole('navigation', { name: 'Viewport controls' })
    expect(within(nav).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Zoom out',
      'Zoom in',
      'Fit to view',
      'More view options',
    ])
    expect(screen.queryByRole('button', { name: /^Zoom level/ })).toBeNull()
    expect(screen.queryByTestId('btn-canvas-legend')).toBeNull()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('the three canvas tools still act', () => {
    const h = renderControls()
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fit to view' }))
    expect(h.onZoomOut).toHaveBeenCalledTimes(1)
    expect(h.onZoomIn).toHaveBeenCalledTimes(1)
    expect(h.onFitView).toHaveBeenCalledTimes(1)
  })
})

describe('v3.1 zoom tools — the overflow keeps every moved control reachable', () => {
  it('Zoom to 100% resets, and carries the current level on its face', () => {
    const h = renderControls()
    const menu = openMenu()
    const item = within(menu).getByTestId('viewport-zoom-reset')
    // ReactFlowProvider's initial transform is zoom 1.
    expect(item).toHaveTextContent('Zoom to 100%')
    expect(item).toHaveTextContent('100%')
    expect(item).toHaveAttribute('aria-label', 'Zoom to 100% (now 100%)')
    fireEvent.click(item)
    expect(h.onZoomReset).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu'), 'choosing an item closes the menu').toBeNull()
  })

  it('Auto-arrange still arranges', () => {
    const h = renderControls()
    fireEvent.click(within(openMenu()).getByRole('menuitem', { name: 'Auto-arrange' }))
    expect(h.onAutoArrange).toHaveBeenCalledTimes(1)
  })

  it('Detailed view toggles the SAME store switch the canvas tools’ eye did', () => {
    renderControls()
    const item = within(openMenu()).getByRole('menuitemcheckbox', { name: /Detailed view/ })
    expect(item).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(item)
    expect(useCanvasStore.getState().viewMode).toBe('expert')
    const again = within(openMenu()).getByRole('menuitemcheckbox', { name: /Detailed view/ })
    expect(again).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(again)
    expect(useCanvasStore.getState().viewMode).toBe('standard')
  })

  it('How to read this opens the canvas key', () => {
    renderControls()
    expect(screen.queryByRole('dialog', { name: 'How to read this' })).toBeNull()
    fireEvent.click(within(openMenu()).getByTestId('viewport-legend'))
    expect(screen.getByRole('dialog', { name: 'How to read this' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'How to read this' })).toBeNull()
  })

  it('Escape closes the menu and returns focus to its button', () => {
    renderControls()
    openMenu()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(screen.getByTestId('viewport-more'))
  })
})
