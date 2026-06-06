/**
 * CanvasLegendPopover — brief scope 4: a "How to read this" toolbar disclosure
 * that opens on click/focus, is dismissible, and renders ONLY the approved
 * legend strings (A4) with no Claude-authored copy and no "node/edge/graph"
 * vocabulary.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CanvasLegendPopover } from '../CanvasLegendPopover'

const APPROVED = [
  'Decision', 'Option', 'Factor', 'Outcome', 'Risk', 'Goal', 'Outside your control',
  'Raises', 'Lowers', 'Solid connection: established', 'Dashed connection: less certain',
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
})
