import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreChip } from '../ScoreChip'

describe('ScoreChip', () => {
  describe('confidence type', () => {
    it('renders high confidence with green styling', () => {
      render(<ScoreChip value={85} type="confidence" />)

      expect(screen.getByTestId('score-chip')).toBeInTheDocument()
      expect(screen.getByText(/High/i)).toBeInTheDocument()
      expect(screen.getByText(/85%/)).toBeInTheDocument()

      const chip = screen.getByTestId('score-chip')
      expect(chip.className).toContain('bg-success-50')
      expect(chip.className).toContain('border-success-300')
    })

    it('renders moderate confidence with yellow styling', () => {
      render(<ScoreChip value={55} type="confidence" />)

      expect(screen.getByText(/Moderate/i)).toBeInTheDocument()
      expect(screen.getByText(/55%/)).toBeInTheDocument()

      const chip = screen.getByTestId('score-chip')
      expect(chip.className).toContain('bg-warning-50')
    })

    it('renders low confidence with red styling', () => {
      render(<ScoreChip value={25} type="confidence" />)

      expect(screen.getByText(/Low/i)).toBeInTheDocument()
      expect(screen.getByText(/25%/)).toBeInTheDocument()

      const chip = screen.getByTestId('score-chip')
      expect(chip.className).toContain('bg-danger-50')
    })

    it('renders very high confidence label for 90%+', () => {
      render(<ScoreChip value={95} type="confidence" />)
      expect(screen.getByText(/Very high/i)).toBeInTheDocument()
    })

    it('renders very low confidence label for <30%', () => {
      render(<ScoreChip value={15} type="confidence" />)
      expect(screen.getByText(/Very low/i)).toBeInTheDocument()
    })
  })

  describe('influence type', () => {
    it('renders high influence with green styling', () => {
      render(<ScoreChip value={0.8} type="influence" />)

      expect(screen.getByText(/Very high/i)).toBeInTheDocument()
      expect(screen.getByText(/0\.8/)).toBeInTheDocument()

      const chip = screen.getByTestId('score-chip')
      expect(chip.className).toContain('bg-success-50')
    })

    it('renders moderate influence with yellow styling', () => {
      render(<ScoreChip value={0.5} type="influence" />)

      expect(screen.getByText(/Moderate/i)).toBeInTheDocument()
      expect(screen.getByText(/0\.5/)).toBeInTheDocument()
    })

    it('renders low influence with red styling', () => {
      render(<ScoreChip value={0.3} type="influence" />)

      expect(screen.getByText(/Low/i)).toBeInTheDocument()
      expect(screen.getByText(/0\.3/)).toBeInTheDocument()
    })
  })

  describe('custom labels', () => {
    it('uses custom label when provided', () => {
      render(<ScoreChip value={75} type="confidence" label="Custom Label" />)
      expect(screen.getByText(/Custom Label/i)).toBeInTheDocument()
    })
  })

  describe('value display', () => {
    it('shows value by default', () => {
      render(<ScoreChip value={80} type="confidence" />)
      expect(screen.getByText(/80%/)).toBeInTheDocument()
    })

    it('hides value when showValue is false', () => {
      render(<ScoreChip value={80} type="confidence" showValue={false} />)

      expect(screen.queryByText(/80%/)).not.toBeInTheDocument()
      expect(screen.getByText(/High/i)).toBeInTheDocument()
    })
  })

  it('displays traffic light indicator dot', () => {
    const { container } = render(<ScoreChip value={75} type="confidence" />)

    // Check for the indicator dot
    const dots = container.querySelectorAll('.w-2.h-2')
    expect(dots.length).toBeGreaterThan(0)
  })

  it('rounds confidence percentages correctly', () => {
    render(<ScoreChip value={74.7} type="confidence" />)
    expect(screen.getByText(/75%/)).toBeInTheDocument()
  })

  it('formats influence to 1 decimal place', () => {
    render(<ScoreChip value={0.456} type="influence" />)
    expect(screen.getByText(/0\.5/)).toBeInTheDocument()
  })
})
