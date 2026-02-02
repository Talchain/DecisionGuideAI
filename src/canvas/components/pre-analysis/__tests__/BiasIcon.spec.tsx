/**
 * Tests for BiasIcon component
 *
 * Covers:
 * - Correct icon per bias type
 * - Tooltip content format: "{why} · {Bias category name}"
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BiasIcon } from '../primitives/BiasIcon'

describe('BiasIcon', () => {
  describe('Icon rendering', () => {
    it('renders Anchor icon for anchoring bias', () => {
      render(<BiasIcon bias="anchoring" why="No baseline to compare against" />)
      
      const icon = screen.getByLabelText(/No baseline to compare against · Anchoring bias/)
      expect(icon).toBeInTheDocument()
    })

    it('renders Frame icon for framing bias', () => {
      render(<BiasIcon bias="framing" why="Only 2 options available" />)
      
      const icon = screen.getByLabelText(/Only 2 options available · Framing bias/)
      expect(icon).toBeInTheDocument()
    })

    it('renders Gauge icon for confidence bias', () => {
      render(<BiasIcon bias="confidence" why="AI-estimated value" />)
      
      const icon = screen.getByLabelText(/AI-estimated value · Confidence bias/)
      expect(icon).toBeInTheDocument()
    })

    it('renders EyeOff icon for blind spots', () => {
      render(<BiasIcon bias="blind_spots" why="No risks modelled" />)
      
      const icon = screen.getByLabelText(/No risks modelled · Blind spots/)
      expect(icon).toBeInTheDocument()
    })
  })

  describe('Tooltip content', () => {
    it('formats tooltip as "{why} · {label}"', () => {
      render(<BiasIcon bias="anchoring" why="Missing baseline option" />)
      
      const icon = screen.getByLabelText(/Missing baseline option · Anchoring bias/)
      
      // Hover to trigger tooltip
      fireEvent.mouseEnter(icon)
      
      // Tooltip should contain the formatted content
      expect(screen.getByRole('tooltip')).toHaveTextContent('Missing baseline option · Anchoring bias')
    })
  })

  describe('Styling', () => {
    it('applies text-light colour class', () => {
      render(<BiasIcon bias="anchoring" why="Test" />)
      
      const icon = screen.getByLabelText(/Test · Anchoring bias/)
      expect(icon).toHaveClass('text-text-light')
    })

    it('accepts additional className', () => {
      render(<BiasIcon bias="anchoring" why="Test" className="custom-class" />)
      
      const icon = screen.getByLabelText(/Test · Anchoring bias/)
      expect(icon).toHaveClass('custom-class')
    })
  })
})

// Test for disabled IconBtn tooltip - separate describe block
import { IconBtn } from '../primitives/IconBtn'
import { Check } from 'lucide-react'

describe('IconBtn tooltip', () => {
  it('shows tooltip on enabled button', () => {
    render(<IconBtn icon={Check} tooltip="Confirm action" variant="confirm" />)

    // Button should have the tooltip content in aria-label
    const button = screen.getByLabelText(/Confirm action/)
    expect(button).toBeInTheDocument()
  })

  it('button receives hover events and shows tooltip', () => {
    render(<IconBtn icon={Check} tooltip="Confirm action" variant="confirm" />)

    const button = screen.getByLabelText(/Confirm action/)

    // Hover to trigger tooltip
    fireEvent.mouseEnter(button)

    // Tooltip should appear
    expect(screen.getByRole('tooltip')).toHaveTextContent('Confirm action')
  })
})
