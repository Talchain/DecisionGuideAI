import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { RangeDisplay } from '../RangeDisplay'

describe('RangeDisplay', () => {
  it('renders structured range rows when values are available', () => {
    render(
      <RangeDisplay
        p10={10}
        p50={20}
        p90={30}
        units="percent"
        baseline={0}
        goalDirection="maximize"
      />
    )

    const container = screen.getByTestId('range-display')
    expect(container).toBeInTheDocument()

    // New structured layout shows labels and values
    expect(container.textContent).toMatch(/Conservative \(p10\)/)
    expect(container.textContent).toMatch(/Most likely \(p50\)/)
    expect(container.textContent).toMatch(/Optimistic \(p90\)/)

    // Values > 1 are displayed as-is (assumed already in percentage form)
    // p10=10 → 10.0%, p50=20 → 20.0%, p90=30 → 30.0%
    expect(container.textContent).toMatch(/10\.0%/)
    expect(container.textContent).toMatch(/20\.0%/)
    expect(container.textContent).toMatch(/30\.0%/)

    // Baseline comparison
    expect(container.textContent).toMatch(/better than baseline/)
  })

  it('renders correctly with probability values (0-1 range)', () => {
    render(
      <RangeDisplay
        p10={0.1}
        p50={0.2}
        p90={0.3}
        units="percent"
        baseline={0.15}
        goalDirection="maximize"
      />
    )

    const container = screen.getByTestId('range-display')
    expect(container).toBeInTheDocument()

    // Values in 0-1 range should be converted to percentages
    expect(container.textContent).toMatch(/10\.0%/)
    expect(container.textContent).toMatch(/20\.0%/)
    expect(container.textContent).toMatch(/30\.0%/)
  })

  it('shows a fallback message when all percentile values are null', () => {
    render(
      <RangeDisplay
        p10={null}
        p50={null}
        p90={null}
        units="percent"
        baseline={null}
        goalDirection="maximize"
      />
    )

    const container = screen.getByTestId('range-display')
    expect(container).toBeInTheDocument()
    expect(container).toHaveTextContent('Range is not available for this run.')
  })

  it('highlights the most likely (p50) row', () => {
    render(
      <RangeDisplay
        p10={0.1}
        p50={0.5}
        p90={0.9}
        units="percent"
        goalDirection="maximize"
      />
    )

    const container = screen.getByTestId('range-display')
    // The p50 row should have highlighting (bg-sky-50 class)
    expect(container.innerHTML).toMatch(/bg-sky-50/)
  })

  it('shows range width interpretation', () => {
    render(
      <RangeDisplay
        p10={0.1}
        p50={0.5}
        p90={0.9}
        units="percent"
        goalDirection="maximize"
      />
    )

    const container = screen.getByTestId('range-display')
    // Should show range width message for moderate variance
    expect(container.textContent).toMatch(/outcomes/i)
  })
})
