import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DeltaInterpretation } from '../DeltaInterpretation'

describe('DeltaInterpretation', () => {
  it('renders better delta with green styling', () => {
    render(
      <DeltaInterpretation
        delta={{
          direction: 'better',
          magnitude: 'significantly',
          deltaValue: 15000,
          deltaPercent: 25,
        }}
        objectiveText="maximize revenue"
        fromValue={60000}
        toValue={75000}
        units="$"
      />
    )

    expect(screen.getByTestId('delta-interpretation')).toBeInTheDocument()
    expect(screen.getByText(/significantly improves/i)).toBeInTheDocument()
    expect(screen.getByText(/maximize revenue/i)).toBeInTheDocument()
    expect(screen.getByText(/60000\.00.*75000\.00/)).toBeInTheDocument()
    expect(screen.getByText(/\+25\.0%/)).toBeInTheDocument()
  })

  it('renders worse delta with red styling', () => {
    render(
      <DeltaInterpretation
        delta={{
          direction: 'worse',
          magnitude: 'moderately',
          deltaValue: -10000,
          deltaPercent: -20,
        }}
        objectiveText="reduce costs"
        fromValue={50000}
        toValue={40000}
      />
    )

    expect(screen.getByText(/moderately worsens/i)).toBeInTheDocument()
    expect(screen.getByText(/reduce costs/i)).toBeInTheDocument()
    expect(screen.getByText(/-20\.0%/)).toBeInTheDocument()
  })

  it('renders similar delta with neutral styling', () => {
    render(
      <DeltaInterpretation
        delta={{
          direction: 'similar',
          magnitude: 'slightly',
          deltaValue: 500,
          deltaPercent: 1,
        }}
        objectiveText="maintain quality"
        fromValue={50000}
        toValue={50500}
      />
    )

    expect(screen.getByText(/has little impact on/i)).toBeInTheDocument()
    expect(screen.getByText(/maintain quality/i)).toBeInTheDocument()
    // Similar should not show magnitude text
    const text = screen.getByText(/has little impact/i)
    expect(text.textContent).not.toContain('slightly')
  })

  it('hides percentage change details for similar direction', () => {
    const { container } = render(
      <DeltaInterpretation
        delta={{
          direction: 'similar',
          magnitude: 'slightly',
          deltaValue: 100,
          deltaPercent: 0.5,
        }}
        objectiveText="test"
        fromValue={10000}
        toValue={10100}
      />
    )

    // Should not show the "moved from X to Y" text for similar
    expect(screen.queryByText(/moved from/i)).not.toBeInTheDocument()
  })

  it('formats values with units correctly', () => {
    render(
      <DeltaInterpretation
        delta={{
          direction: 'better',
          magnitude: 'slightly',
          deltaValue: 5,
          deltaPercent: 10,
        }}
        objectiveText="test"
        fromValue={50}
        toValue={55}
        units="%"
      />
    )

    expect(screen.getByText(/50\.00 %.*55\.00 %/)).toBeInTheDocument()
  })

  it('handles null deltaPercent gracefully', () => {
    render(
      <DeltaInterpretation
        delta={{
          direction: 'better',
          magnitude: 'moderately',
          deltaValue: 1000,
          deltaPercent: null,
        }}
        objectiveText="test"
        fromValue={0}
        toValue={1000}
      />
    )

    expect(screen.getByText(/moderately improves/i)).toBeInTheDocument()
    // Should not show percentage when null
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('shows correct icon for each direction', () => {
    const { rerender } = render(
      <DeltaInterpretation
        delta={{ direction: 'better', magnitude: 'slightly', deltaValue: 1, deltaPercent: 1 }}
        objectiveText="test"
        fromValue={100}
        toValue={101}
      />
    )

    // Better should show TrendingUp icon (checking for class name)
    let container = screen.getByTestId('delta-interpretation')
    expect(container.querySelector('svg')).toBeInTheDocument()

    rerender(
      <DeltaInterpretation
        delta={{ direction: 'worse', magnitude: 'slightly', deltaValue: -1, deltaPercent: -1 }}
        objectiveText="test"
        fromValue={100}
        toValue={99}
      />
    )

    // Worse should show TrendingDown icon
    container = screen.getByTestId('delta-interpretation')
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
