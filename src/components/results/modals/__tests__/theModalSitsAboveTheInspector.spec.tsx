/**
 * Slice D-3, Panel's half (#70 5855312737; Canvas yes 5855321285). The record,
 * define-success and how-computed modals rendered IN PLACE inside the dock
 * (`OutputsDock` `zIndex: 900`), so no z-index could lift the backdrop over the
 * canvas inspector (5000). The shell now portals to <body> on the one order.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { ModalShell, useModalToast } from '../ModalShell'
import { CANVAS_LAYER, CANVAS_LAYER_CLASS } from '../../../../canvas/layers'

afterEach(cleanup)

const InDock = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="dock" style={{ position: 'fixed', zIndex: CANVAS_LAYER.dock }}>{children}</div>
)

describe('a Panel modal is not trapped in the dock', () => {
  it('⭐ the overlay is a child of <body>, not of the dock, on the modal backdrop layer', () => {
    render(
      <InDock>
        <ModalShell isOpen onClose={() => {}} title="Record your view" subtitle="s" titleId="m-title" testId="m">
          <p>body</p>
        </ModalShell>
      </InDock>,
    )
    const overlay = screen.getByTestId('m-overlay')
    expect(screen.getByTestId('dock').contains(overlay)).toBe(false)
    expect(overlay.parentElement).toBe(document.body)
    expect(overlay.className).toContain(CANVAS_LAYER_CLASS.modalBackdrop)
    expect(CANVAS_LAYER.modalBackdrop).toBeGreaterThan(CANVAS_LAYER.inspector)
  })

  it('the toast is portalled too, on the modal toast layer', () => {
    const Harness = () => {
      const { showToast, toastElement } = useModalToast('t')
      return (
        <InDock>
          <button onClick={() => showToast('Saved')}>go</button>
          {toastElement}
        </InDock>
      )
    }
    render(<Harness />)
    act(() => screen.getByText('go').click())
    const toast = screen.getByTestId('t')
    expect(screen.getByTestId('dock').contains(toast)).toBe(false)
    expect(toast.className).toContain(CANVAS_LAYER_CLASS.modalToast)
  })
})
