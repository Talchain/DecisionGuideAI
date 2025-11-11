/**
 * P0-1: Panel Safe Area Tests
 *
 * Ensures right-hand panels never overlap the bottom toolbar
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PanelShell } from '../PanelShell'

describe('PanelShell - Safe Area (P0-1)', () => {
  it('constrains height to avoid toolbar overlap', () => {
    render(
      <PanelShell
        title="Test Panel"
        onClose={() => {}}
      >
        <div>Panel content</div>
      </PanelShell>
    )

    const panel = screen.getByTestId('panel-shell')
    const style = window.getComputedStyle(panel)

    // Should have calc-based height
    expect(panel.style.height).toMatch(/calc\(100vh - \d+px\)/)
    expect(panel.style.maxHeight).toMatch(/calc\(100vh - \d+px\)/)
  })

  it('applies sticky footer with z-index', () => {
    render(
      <PanelShell
        title="Test Panel"
        footer={<button>Action</button>}
      >
        <div>Panel content</div>
      </PanelShell>
    )

    const footer = screen.getByRole('button', { name: 'Action' }).closest('div')
    expect(footer).toHaveClass('sticky', 'bottom-0', 'z-10')
  })

  it('enables inner scrolling with overflow-y-auto', () => {
    render(
      <PanelShell title="Test Panel">
        <div>Scrollable content</div>
      </PanelShell>
    )

    // Body should have overflow-y-auto and flex-1
    const body = screen.getByText('Scrollable content').parentElement
    expect(body).toHaveClass('overflow-y-auto', 'flex-1', 'min-h-0')
  })

  it('maintains accessibility attributes', () => {
    render(
      <PanelShell title="Results Panel" onClose={() => {}}>
        <div>Content</div>
      </PanelShell>
    )

    const panel = screen.getByRole('complementary', { name: 'Results Panel' })
    expect(panel).toBeInTheDocument()
  })
})
