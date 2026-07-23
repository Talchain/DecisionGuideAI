/**
 * CanvasLegendPopover — brief scope 4: a "How to read this" toolbar disclosure
 * that opens on click (keyboard: Enter/Space), is dismissible, and renders ONLY the approved
 * legend strings (A4) with no Claude-authored copy and no "node/edge/graph"
 * vocabulary.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CanvasLegendPopover } from '../CanvasLegendPopover'

const APPROVED = [
  'Decision', 'Option', 'Factor', 'Outcome', 'Risk', 'Goal', 'Outside your control',
  'Raises', 'Lowers', 'Solid connection: established', 'Dashed connection: less certain',
  'Weak effect', 'Moderate effect', 'Strong effect',
]

describe('CanvasLegendPopover', () => {
  it('is closed initially and opens on click', () => {
    render(<CanvasLegendPopover />)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'How to read this' }))
    expect(screen.getByRole('dialog', { name: 'How to read this' })).toBeDefined()
  })

  it('renders exactly the approved legend strings (and never "Choice")', () => {
    render(<CanvasLegendPopover />)
    fireEvent.click(screen.getByRole('button', { name: 'How to read this' }))
    for (const s of APPROVED) {
      expect(screen.getByText(s)).toBeDefined()
    }
    expect(screen.queryByText('Choice')).toBeNull()
  })

  it('uses no technical vocabulary (node / edge / graph) in rendered copy', () => {
    const { container } = render(<CanvasLegendPopover />)
    fireEvent.click(screen.getByRole('button', { name: 'How to read this' }))
    const text = (container.textContent ?? '').toLowerCase()
    expect(text).not.toMatch(/\bnode\b/)
    expect(text).not.toMatch(/\bedge\b/)
    expect(text).not.toMatch(/\bgraph\b/)
  })

  it('closes on Escape', () => {
    render(<CanvasLegendPopover />)
    fireEvent.click(screen.getByRole('button', { name: 'How to read this' }))
    expect(screen.getByRole('dialog')).toBeDefined()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // Regression: a real mouse click fires `focus` (on mousedown) before `click`.
  // The trigger must still end up OPEN after that sequence — focus must not
  // pre-toggle and let the following click immediately close it.
  it('opens on a real click even when focus fires first', () => {
    render(<CanvasLegendPopover />)
    const btn = screen.getByRole('button', { name: 'How to read this' })
    fireEvent.focus(btn)
    fireEvent.click(btn)
    expect(screen.getByRole('dialog', { name: 'How to read this' })).toBeDefined()
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })

  // A second click closes it again — local open-state toggles cleanly without a
  // shared store (the former edge-thickness suppression flag is gone).
  it('toggles closed on a second click', () => {
    render(<CanvasLegendPopover />)
    const btn = screen.getByRole('button', { name: 'How to read this' })
    fireEvent.click(btn)
    expect(screen.getByRole('dialog', { name: 'How to read this' })).toBeDefined()
    fireEvent.click(btn)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // The folded-in effect-strength scale renders its three samples (was the
  // standalone EdgeThicknessLegend; now one consolidated key). P2.9: thickness
  // means effect strength (weight magnitude) in both phases, so the labels read
  // "effect" not "influence".
  it('renders the effect-strength thickness scale', () => {
    render(<CanvasLegendPopover />)
    fireEvent.click(screen.getByRole('button', { name: 'How to read this' }))
    expect(screen.getByText('Weak effect')).toBeDefined()
    expect(screen.getByText('Moderate effect')).toBeDefined()
    expect(screen.getByText('Strong effect')).toBeDefined()
  })
})
