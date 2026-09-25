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
import { render, screen } from '@testing-library/react'
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

  it('CONTRAST — the genuinely working Auto-arrange button is untouched', () => {
    const { onAutoArrange } = renderControls()
    const button = screen.getByRole('button', { name: 'Auto-arrange' })
    expect(button).toBeInTheDocument()
    button.click()
    expect(onAutoArrange).toHaveBeenCalledTimes(1)
  })

  it('the Layout group has exactly two controls now: fit to view and auto-arrange', () => {
    renderControls()
    expect(screen.getByRole('button', { name: 'Fit to view' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Auto-arrange' })).toBeInTheDocument()
    // Every button this toolbar renders, positively enumerated, so a control
    // added back under a different name or test id still fails this count:
    // zoom readout, zoom out, zoom in, fit to view, auto-arrange, legend
    // trigger — six, none of them a density toggle.
    expect(screen.getAllByRole('button')).toHaveLength(6)
  })
})
