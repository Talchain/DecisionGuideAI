/**
 * A19 — the density toggle was a no-op wearing a working control's clothes.
 *
 * Compact set `layerSpacing` to 30; `layout.ts`'s own floor,
 * `Math.max(LAYOUT_LAYER_GAP, layerSpacing ?? …)` with `LAYOUT_LAYER_GAP = 48`,
 * raised it straight back to 48 — the same value comfortable already uses. So
 * pressing "Compact spacing" changed no rendered spacing at all, while still
 * calling `onAutoArrange()` and firing its "Auto-arranged layout." success
 * toast: the product told the user something happened when nothing did.
 *
 * The prototype has no density control, so it is removed rather than
 * un-floored in `layout.ts` (out of this item's scope, and other callers may
 * depend on that floor).
 */
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

import { CanvasViewportControls } from '../CanvasViewportControls'

function renderControls() {
  const onAutoArrange = vi.fn()
  const utils = render(
    <ReactFlowProvider>
      <CanvasViewportControls
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onZoomReset={vi.fn()}
        onFitView={vi.fn()}
        onAutoArrange={onAutoArrange}
      />
    </ReactFlowProvider>,
  )
  return { ...utils, onAutoArrange }
}

describe('CanvasViewportControls — no density toggle', () => {
  it('renders no control with the density toggle test id', () => {
    renderControls()
    expect(screen.queryByTestId('layout-density-toggle')).toBeNull()
  })

  it('renders no control claiming to switch "Compact" or "Comfortable" spacing', () => {
    renderControls()
    expect(screen.queryByRole('button', { name: /compact spacing|comfortable spacing/i })).toBeNull()
    expect(screen.queryByLabelText(/layout density/i)).toBeNull()
  })

  it('CONTRAST — the genuinely working Auto-arrange control is untouched (now in the overflow menu)', () => {
    const { onAutoArrange } = renderControls()
    fireEvent.click(screen.getByRole('button', { name: 'More view options' }))
    const item = screen.getByRole('menuitem', { name: 'Auto-arrange' })
    expect(item).toBeInTheDocument()
    item.click()
    expect(onAutoArrange).toHaveBeenCalledTimes(1)
  })

  it('every control is enumerated — none of them a density toggle', () => {
    renderControls()
    // At rest, v3.1's three tools plus the one overflow (DESIGN-GAP #14):
    // zoom out, zoom in, fit to view, more view options.
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Zoom out',
      'Zoom in',
      'Fit to view',
      'More view options',
    ])
    // And the menu's items, positively enumerated, so a control added back
    // under a different name or test id still fails this list.
    fireEvent.click(screen.getByRole('button', { name: 'More view options' }))
    expect(
      Array.from(document.querySelectorAll('[role^="menuitem"]')).map((i) => i.getAttribute('data-testid')),
    ).toEqual(['viewport-zoom-reset', 'viewport-auto-arrange', 'viewport-detailed-view', 'viewport-legend'])
  })
})
