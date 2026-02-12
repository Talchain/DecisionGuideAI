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

    expect(screen.getByText(/Drag a bar to preview/)).toBeInTheDocument()
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

  // ── Reactive bar width + reset tests ──

  /**
   * Helper: simulate a full drag cycle on a tornado bar.
   * Mocks getBoundingClientRect and setPointerCapture, then fires
   * pointerdown → pointermove → pointerup at the given clientX.
   *
   * Container mock: 200px wide starting at x=0. The row's lowOutcome→highOutcome
   * maps to position 0→1 within the container, so clientX=0 → lowOutcome,
   * clientX=200 → highOutcome.
   */
  function simulateDragCycle(bar: HTMLElement, clientX: number) {
    const container = bar.closest('[data-bar-container]') as HTMLElement
    container.getBoundingClientRect = () => ({
      left: 0, right: 200, width: 200,
      top: 0, bottom: 20, height: 20,
      x: 0, y: 0, toJSON: () => {},
    })
    bar.setPointerCapture = vi.fn()

    fireEvent.pointerDown(bar, { pointerId: 1, clientX })
    fireEvent.pointerMove(bar, { pointerId: 1, clientX })
    fireEvent.pointerUp(bar, { pointerId: 1 })
  }

  it('pointerDown activates reactive mode (bar gets ring highlight, opposite dimmed)', () => {
    render(
      <TornadoChart rows={[positiveRow]} expectedOutcome={100} />
    )

    const leftBar = screen.getByTestId('tornado-bar-left-revenue')
    const rightBar = screen.getByTestId('tornado-bar-right-revenue')
    const originalRightWidth = rightBar.style.width
    const container = leftBar.closest('[data-bar-container]') as HTMLElement
    container.getBoundingClientRect = () => ({
      left: 0, right: 200, width: 200,
      top: 0, bottom: 20, height: 20,
      x: 0, y: 0, toJSON: () => {},
    })
    leftBar.setPointerCapture = vi.fn()

    // Before drag: no ring, no dimming
    expect(leftBar.className).not.toContain('ring-1')
    expect(rightBar.className).not.toContain('opacity-30')

    fireEvent.pointerDown(leftBar, { pointerId: 1, clientX: 50 })

    // During drag (before pointerUp): active bar has ring, opposite dimmed at original width
    expect(leftBar.className).toContain('ring-1')
    expect(rightBar.className).toContain('opacity-30')
    expect(rightBar.style.width).toBe(originalRightWidth)
  })

  it('bar widths reflect stored outcome after full drag cycle', () => {
    render(
      <TornadoChart rows={[positiveRow]} expectedOutcome={100} />
    )

    const leftBar = screen.getByTestId('tornado-bar-left-revenue')
    const rightBar = screen.getByTestId('tornado-bar-right-revenue')
    const originalLeftWidth = leftBar.style.width
    const originalRightWidth = rightBar.style.width

    // Full drag cycle on LEFT bar to midpoint (clientX=100 → position 0.5 → interpolated = 100)
    // At interpolated = expectedOutcome, active (left) bar collapses to 0
    simulateDragCycle(leftBar, 100)

    // Active bar (left) collapsed at midpoint
    expect(parseFloat(leftBar.style.width)).toBe(0)
    expect(leftBar.style.width).not.toBe(originalLeftWidth)

    // Opposite bar (right) stays at original width, dimmed
    expect(rightBar.style.width).toBe(originalRightWidth)
    expect(rightBar.className).toContain('opacity-30')
  })

  it('bars have CSS transition except during active drag', () => {
    render(
      <TornadoChart rows={[positiveRow]} expectedOutcome={100} />
    )

    const leftBar = screen.getByTestId('tornado-bar-left-revenue')

    // All rows (including undragged) have smooth transition
    expect(leftBar.style.transition).toContain('150ms')

    // After full drag cycle: released row still has smooth transition
    simulateDragCycle(leftBar, 50)
    expect(leftBar.style.transition).toContain('150ms')
  })

  it('opposite bar stays at original width with opacity-30 after drag', () => {
    render(
      <TornadoChart rows={[positiveRow]} expectedOutcome={100} />
    )

    const leftBar = screen.getByTestId('tornado-bar-left-revenue')
    const rightBar = screen.getByTestId('tornado-bar-right-revenue')
    const originalRightWidth = rightBar.style.width

    // Drag the LEFT bar — right bar is the opposite
    simulateDragCycle(leftBar, 50)

    // Opposite bar (right) stays at original width, dimmed
    expect(rightBar.style.width).toBe(originalRightWidth)
    expect(rightBar.className).toContain('opacity-30')

    // Active bar (left) has ring highlight, not dimmed
    expect(leftBar.className).not.toContain('opacity-30')
  })

  it('dragging right bar dims left bar instead', () => {
    render(
      <TornadoChart rows={[positiveRow]} expectedOutcome={100} />
    )

    const leftBar = screen.getByTestId('tornado-bar-left-revenue')
    const rightBar = screen.getByTestId('tornado-bar-right-revenue')
    const originalLeftWidth = leftBar.style.width

    // Drag the RIGHT bar — left bar is the opposite
    simulateDragCycle(rightBar, 150)

    // Opposite bar (left) stays at original width, dimmed
    expect(leftBar.style.width).toBe(originalLeftWidth)
    expect(leftBar.className).toContain('opacity-30')

    // Active bar (right) not dimmed
    expect(rightBar.className).not.toContain('opacity-30')
  })

  it('reset preview link hidden when no drag has occurred', () => {
    render(
      <TornadoChart rows={[positiveRow]} expectedOutcome={100} />
    )

    expect(screen.queryByTestId('tornado-reset-preview')).not.toBeInTheDocument()
  })

  it('reset preview link visible after drag', () => {
    render(
      <TornadoChart rows={[positiveRow]} expectedOutcome={100} />
    )

    const leftBar = screen.getByTestId('tornado-bar-left-revenue')
    simulateDragCycle(leftBar, 50)

    expect(screen.getByTestId('tornado-reset-preview')).toBeInTheDocument()
    expect(screen.getByText('Reset preview')).toBeInTheDocument()
  })

  it('clicking reset preview restores original bar widths and hides the link', () => {
    render(
      <TornadoChart rows={[positiveRow]} expectedOutcome={100} />
    )

    const leftBar = screen.getByTestId('tornado-bar-left-revenue')
    const rightBar = screen.getByTestId('tornado-bar-right-revenue')
    const originalLeftWidth = leftBar.style.width
    const originalRightWidth = rightBar.style.width

    // Drag left bar to midpoint and release
    simulateDragCycle(leftBar, 100)

    // Confirm active bar (left) changed, opposite (right) dimmed
    expect(leftBar.style.width).not.toBe(originalLeftWidth)
    expect(rightBar.className).toContain('opacity-30')

    // Click reset
    fireEvent.click(screen.getByTestId('tornado-reset-preview'))

    // Widths restored to original
    expect(leftBar.style.width).toBe(originalLeftWidth)
    expect(rightBar.style.width).toBe(originalRightWidth)

    // Both bars at full opacity (no opacity-30)
    expect(leftBar.className).not.toContain('opacity-30')
    expect(rightBar.className).not.toContain('opacity-30')

    // Reset link hidden
    expect(screen.queryByTestId('tornado-reset-preview')).not.toBeInTheDocument()

    // Expected display shows original value
    expect(screen.getByTestId('tornado-expected-display')).toHaveTextContent('Expected: 100')
  })
})
