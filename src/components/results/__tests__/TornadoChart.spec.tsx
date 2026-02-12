import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TornadoChart, type TornadoRow } from '../TornadoChart'

// Mock focusNodeById
vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
}))

// Mock window.matchMedia for reduced motion check
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

const positiveRow: TornadoRow = {
  factorKey: 'revenue',
  label: 'Revenue Growth',
  lowOutcome: 80,
  highOutcome: 120,
  canFocus: true,
  matchedNodeId: 'node-revenue',
  direction: 'positive',
}

const negativeRow: TornadoRow = {
  factorKey: 'cost',
  label: 'Operating Cost',
  lowOutcome: 85,
  highOutcome: 115,
  canFocus: true,
  matchedNodeId: 'node-cost',
  direction: 'negative',
}

const undefinedDirectionRow: TornadoRow = {
  factorKey: 'unknown',
  label: 'Unknown Factor',
  lowOutcome: 90,
  highOutcome: 110,
  canFocus: false,
}

describe('TornadoChart', () => {
  it('renders correct number of rows', () => {
    render(
      <TornadoChart
        rows={[positiveRow, negativeRow]}
        expectedOutcome={100}
      />
    )

    expect(screen.getByText('Revenue Growth')).toBeInTheDocument()
    expect(screen.getByText('Operating Cost')).toBeInTheDocument()
  })

  it('returns null when rows are empty', () => {
    const { container } = render(
      <TornadoChart rows={[]} expectedOutcome={100} />
    )

    expect(container.innerHTML).toBe('')
  })

  it('renders expected outcome in axis labels', () => {
    render(
      <TornadoChart
        rows={[positiveRow]}
        expectedOutcome={100}
      />
    )

    expect(screen.getByTestId('tornado-expected-display')).toHaveTextContent('Expected: 100')
  })

  // ── Colour mapping tests ──

  it('positive-direction factor: left bar uses danger-light, right bar uses success-light', () => {
    render(
      <TornadoChart
        rows={[positiveRow]}
        expectedOutcome={100}
      />
    )

    const leftBar = screen.getByTestId('tornado-bar-left-revenue')
    const rightBar = screen.getByTestId('tornado-bar-right-revenue')

    // Positive direction: left = orange (danger-light), right = green (success-light)
    expect(leftBar).toHaveStyle({ backgroundColor: 'var(--danger-light)' })
    expect(rightBar).toHaveStyle({ backgroundColor: 'var(--success-light)' })
  })

  it('negative-direction factor: left bar uses success-light, right bar uses danger-light', () => {
    render(
      <TornadoChart
        rows={[negativeRow]}
        expectedOutcome={100}
      />
    )

    const leftBar = screen.getByTestId('tornado-bar-left-cost')
    const rightBar = screen.getByTestId('tornado-bar-right-cost')

    // Negative direction: left = green (success-light), right = orange (danger-light)
    expect(leftBar).toHaveStyle({ backgroundColor: 'var(--success-light)' })
    expect(rightBar).toHaveStyle({ backgroundColor: 'var(--danger-light)' })
  })

  it('undefined direction defaults to positive-direction colours', () => {
    render(
      <TornadoChart
        rows={[undefinedDirectionRow]}
        expectedOutcome={100}
      />
    )

    const leftBar = screen.getByTestId('tornado-bar-left-unknown')
    const rightBar = screen.getByTestId('tornado-bar-right-unknown')

    expect(leftBar).toHaveStyle({ backgroundColor: 'var(--danger-light)' })
    expect(rightBar).toHaveStyle({ backgroundColor: 'var(--success-light)' })
  })

  it('mixed-direction factors render correct colours per row', () => {
    render(
      <TornadoChart
        rows={[positiveRow, negativeRow, undefinedDirectionRow]}
        expectedOutcome={100}
      />
    )

    // Positive direction row
    expect(screen.getByTestId('tornado-bar-left-revenue')).toHaveStyle({ backgroundColor: 'var(--danger-light)' })
    expect(screen.getByTestId('tornado-bar-right-revenue')).toHaveStyle({ backgroundColor: 'var(--success-light)' })

    // Negative direction row
    expect(screen.getByTestId('tornado-bar-left-cost')).toHaveStyle({ backgroundColor: 'var(--success-light)' })
    expect(screen.getByTestId('tornado-bar-right-cost')).toHaveStyle({ backgroundColor: 'var(--danger-light)' })

    // Undefined direction row
    expect(screen.getByTestId('tornado-bar-left-unknown')).toHaveStyle({ backgroundColor: 'var(--danger-light)' })
    expect(screen.getByTestId('tornado-bar-right-unknown')).toHaveStyle({ backgroundColor: 'var(--success-light)' })
  })

  it('switching from 2-factor to 4-factor scenario preserves per-row colours', () => {
    const twoRows = [positiveRow, negativeRow]
    const fourRows: TornadoRow[] = [
      positiveRow,
      negativeRow,
      { ...positiveRow, factorKey: 'revenue2', label: 'Revenue 2', direction: 'positive' },
      { ...negativeRow, factorKey: 'cost2', label: 'Cost 2', direction: 'negative' },
    ]

    const { rerender } = render(
      <TornadoChart rows={twoRows} expectedOutcome={100} />
    )

    // Verify 2-factor colours
    expect(screen.getByTestId('tornado-bar-left-revenue')).toHaveStyle({ backgroundColor: 'var(--danger-light)' })
    expect(screen.getByTestId('tornado-bar-left-cost')).toHaveStyle({ backgroundColor: 'var(--success-light)' })

    // Rerender with 4 factors
    rerender(<TornadoChart rows={fourRows} expectedOutcome={100} />)

    // Original rows still correct
    expect(screen.getByTestId('tornado-bar-left-revenue')).toHaveStyle({ backgroundColor: 'var(--danger-light)' })
    expect(screen.getByTestId('tornado-bar-left-cost')).toHaveStyle({ backgroundColor: 'var(--success-light)' })
    // New rows correct
    expect(screen.getByTestId('tornado-bar-left-revenue2')).toHaveStyle({ backgroundColor: 'var(--danger-light)' })
    expect(screen.getByTestId('tornado-bar-left-cost2')).toHaveStyle({ backgroundColor: 'var(--success-light)' })
  })

  // ── Drag handle tests ──

  it('drag handles are present on bars', () => {
    render(
      <TornadoChart
        rows={[positiveRow]}
        expectedOutcome={100}
      />
    )

    const leftBar = screen.getByTestId('tornado-bar-left-revenue')
    const rightBar = screen.getByTestId('tornado-bar-right-revenue')

    // Drag handles are child elements with aria-hidden
    const leftHandle = leftBar.querySelector('[aria-hidden="true"]')
    const rightHandle = rightBar.querySelector('[aria-hidden="true"]')

    expect(leftHandle).toBeTruthy()
    expect(rightHandle).toBeTruthy()
  })

  it('bars have grab cursor', () => {
    render(
      <TornadoChart
        rows={[positiveRow]}
        expectedOutcome={100}
      />
    )

    const leftBar = screen.getByTestId('tornado-bar-left-revenue')
    expect(leftBar).toHaveStyle({ cursor: 'grab' })
  })

  // ── Disabled features (flip indicator + apply-and-rerun) ──
  // Flip indicator and apply-and-rerun are disabled until factor-space bounds
  // (factorLow/factorHigh) are available from PLoT factor_sensitivity data.
  // See TornadoChart.tsx header comments for details.

  it('flip indicator is not rendered (disabled)', () => {
    render(
      <TornadoChart
        rows={[positiveRow]}
        expectedOutcome={100}
      />
    )

    expect(screen.queryByTestId('tornado-flip-indicator')).not.toBeInTheDocument()
  })

  it('apply-and-rerun button is not rendered (disabled)', () => {
    render(
      <TornadoChart
        rows={[positiveRow]}
        expectedOutcome={100}
      />
    )

    expect(screen.queryByTestId('tornado-apply-rerun')).not.toBeInTheDocument()
  })

  // ── Disclaimer tests ──

  it('renders preview disclaimer', () => {
    render(
      <TornadoChart
        rows={[positiveRow]}
        expectedOutcome={100}
      />
    )

    expect(screen.getByText(/Preview only/)).toBeInTheDocument()
    expect(screen.getByText(/Approximate sensitivity/)).toBeInTheDocument()
  })

  it('renders drag instruction text', () => {
    render(
      <TornadoChart
        rows={[positiveRow]}
        expectedOutcome={100}
      />
    )

    expect(screen.getByText(/Drag the bars/)).toBeInTheDocument()
  })

  // ── Axis label tests ──

  it('renders axis labels', () => {
    render(
      <TornadoChart
        rows={[positiveRow]}
        expectedOutcome={100}
      />
    )

    expect(screen.getByText('← Weaker than estimated')).toBeInTheDocument()
    expect(screen.getByText('Stronger than estimated →')).toBeInTheDocument()
  })

  // ── Touch action tests ──

  it('bar containers have data-bar-container attribute for drag support', () => {
    render(
      <TornadoChart
        rows={[positiveRow]}
        expectedOutcome={100}
      />
    )

    const barContainer = screen.getByTestId('tornado-bar-left-revenue').closest('[data-bar-container]')
    expect(barContainer).toBeTruthy()
    // touch-action: none is set via style prop on the data-bar-container element
    expect(barContainer).toHaveAttribute('data-bar-container')
  })
})
