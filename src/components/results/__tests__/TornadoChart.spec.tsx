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

  // ── Colour mapping tests (goal-direction semantics) ──
  // Colours are driven by goalDirection prop (maximize/minimize), NOT by row.direction.
  // maximize: right (higher outcome) = green, left (lower outcome) = orange
  // minimize: left (lower outcome) = green, right (higher outcome) = orange
  // unknown (no goalDirection): neutral info-light for both sides

  it('maximize goal: left bar uses danger-light, right bar uses success-light', () => {
    render(
      <TornadoChart
        rows={[positiveRow]}
        expectedOutcome={100}
        goalDirection="maximize"
      />
    )

    const leftBar = screen.getByTestId('tornado-bar-left-revenue')
    const rightBar = screen.getByTestId('tornado-bar-right-revenue')

    expect(leftBar).toHaveStyle({ backgroundColor: 'var(--danger-light)' })
    expect(rightBar).toHaveStyle({ backgroundColor: 'var(--success-light)' })
  })

  it('minimize goal: left bar uses success-light, right bar uses danger-light', () => {
    render(
      <TornadoChart
        rows={[negativeRow]}
        expectedOutcome={100}
        goalDirection="minimize"
      />
    )

    const leftBar = screen.getByTestId('tornado-bar-left-cost')
    const rightBar = screen.getByTestId('tornado-bar-right-cost')

    expect(leftBar).toHaveStyle({ backgroundColor: 'var(--success-light)' })
    expect(rightBar).toHaveStyle({ backgroundColor: 'var(--danger-light)' })
  })

  it('unknown goal direction: both bars use neutral info-light', () => {
    render(
      <TornadoChart
        rows={[undefinedDirectionRow]}
        expectedOutcome={100}
      />
    )

    const leftBar = screen.getByTestId('tornado-bar-left-unknown')
    const rightBar = screen.getByTestId('tornado-bar-right-unknown')

    expect(leftBar).toHaveStyle({ backgroundColor: 'var(--info-light)' })
    expect(rightBar).toHaveStyle({ backgroundColor: 'var(--info-light)' })
  })

  it('all rows share same colour scheme based on goal direction, regardless of row.direction', () => {
    render(
      <TornadoChart
        rows={[positiveRow, negativeRow, undefinedDirectionRow]}
        expectedOutcome={100}
        goalDirection="maximize"
      />
    )

    // All rows: left = danger-light, right = success-light (maximize goal)
    for (const key of ['revenue', 'cost', 'unknown']) {
      expect(screen.getByTestId(`tornado-bar-left-${key}`)).toHaveStyle({ backgroundColor: 'var(--danger-light)' })
      expect(screen.getByTestId(`tornado-bar-right-${key}`)).toHaveStyle({ backgroundColor: 'var(--success-light)' })
    }
  })

  it('switching goalDirection rerenders with correct colours', () => {
    const { rerender } = render(
      <TornadoChart rows={[positiveRow]} expectedOutcome={100} goalDirection="maximize" />
    )

    // maximize: left = danger, right = success
    expect(screen.getByTestId('tornado-bar-left-revenue')).toHaveStyle({ backgroundColor: 'var(--danger-light)' })
    expect(screen.getByTestId('tornado-bar-right-revenue')).toHaveStyle({ backgroundColor: 'var(--success-light)' })

    // Switch to minimize
    rerender(<TornadoChart rows={[positiveRow]} expectedOutcome={100} goalDirection="minimize" />)

    // minimize: left = success, right = danger
    expect(screen.getByTestId('tornado-bar-left-revenue')).toHaveStyle({ backgroundColor: 'var(--success-light)' })
    expect(screen.getByTestId('tornado-bar-right-revenue')).toHaveStyle({ backgroundColor: 'var(--danger-light)' })
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

  it('renders preview disclaimer text', () => {
    render(
      <TornadoChart
        rows={[positiveRow]}
        expectedOutcome={100}
      />
    )

    expect(screen.getByText(/Preview only/)).toBeInTheDocument()
  })

  // ── Axis label tests ──

  it('renders axis labels', () => {
    render(
      <TornadoChart
        rows={[positiveRow]}
        expectedOutcome={100}
      />
    )

    expect(screen.getByText('← Weaker')).toBeInTheDocument()
    expect(screen.getByText('Stronger →')).toBeInTheDocument()
  })

  // ── P0.2: Value display mode tests ──

  it('% mode: bar labels show relative % change when no unit provided', () => {
    render(
      <TornadoChart
        rows={[positiveRow]}
        expectedOutcome={100}
      />
    )

    // lowOutcome=80 → (80-100)/100 = -20%, highOutcome=120 → (120-100)/100 = +20%
    expect(screen.getByText('−20%')).toBeInTheDocument()
    expect(screen.getByText('+20%')).toBeInTheDocument()
  })

  it('units mode: bar labels show formatted values when currency unit provided', () => {
    render(
      <TornadoChart
        rows={[positiveRow]}
        expectedOutcome={100}
        outcomeUnit="currency"
        outcomeUnitSymbol="$"
      />
    )

    expect(screen.getByText('$80')).toBeInTheDocument()
    expect(screen.getByText('$120')).toBeInTheDocument()
    expect(screen.getByTestId('tornado-expected-display')).toHaveTextContent('Expected: $100')
  })

  it('units mode: bar labels show formatted values when percent unit provided', () => {
    render(
      <TornadoChart
        rows={[{ ...positiveRow, lowOutcome: 0.30, highOutcome: 0.70 }]}
        expectedOutcome={0.50}
        outcomeUnit="percent"
      />
    )

    // percent mode: small values get *100, formatted as "30%", "70%"
    expect(screen.getByTestId('tornado-expected-display')).toHaveTextContent('Expected:')
  })

  it('% mode: negative direction factors show correct relative changes', () => {
    render(
      <TornadoChart
        rows={[negativeRow]}
        expectedOutcome={100}
      />
    )

    // lowOutcome=85 → (85-100)/100 = -15%, highOutcome=115 → (115-100)/100 = +15%
    expect(screen.getByText('−15%')).toBeInTheDocument()
    expect(screen.getByText('+15%')).toBeInTheDocument()
  })

  it('centre axis always includes "Expected:" with value', () => {
    render(
      <TornadoChart
        rows={[positiveRow]}
        expectedOutcome={235}
      />
    )

    expect(screen.getByTestId('tornado-expected-display')).toHaveTextContent('Expected: 235')
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
