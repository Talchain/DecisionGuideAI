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

    // Task 3.9: Updated labels use "Worst case" and "Best case" terminology
    expect(container.textContent).toMatch(/Worst case/)
    expect(container.textContent).toMatch(/Most likely outcome/)
    expect(container.textContent).toMatch(/Best case/)

    // Primary p50 value uses full precision (20.0%), range labels use compact format (10%, 30%)
    expect(container.textContent).toMatch(/20\.0%/)
    expect(container.textContent).toMatch(/10%/)
    expect(container.textContent).toMatch(/30%/)

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
    // Primary p50 value uses full precision, compact labels use rounded values
    expect(container.textContent).toMatch(/20\.0%/)
    // Compact values: 10% and 30%
    expect(container.textContent).toMatch(/10%/)
    expect(container.textContent).toMatch(/30%/)
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

  it('highlights the most likely (p50) value prominently', () => {
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
    // The p50 value should be displayed with large, bold styling (text-4xl font-bold)
    expect(container.innerHTML).toMatch(/text-4xl/)
    expect(container.innerHTML).toMatch(/font-bold/)
    // Range uses sky-400 bar for highlighting
    expect(container.innerHTML).toMatch(/bg-sky-400/)
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
