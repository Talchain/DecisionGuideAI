/**
 * RationaleTooltip — test suite
 *
 * Tests:
 * - Renders tooltip on hover when rationale exists
 * - Renders children only (no-op) when no rationale for node
 * - Auto-dismisses after 5 seconds
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { RationaleTooltip } from '../RationaleTooltip'
import { useCanvasStore } from '../../store'

describe('RationaleTooltip', () => {
  beforeEach(() => {
    useCanvasStore.setState({ nodeRationales: {} })
  })

  it('renders tooltip on hover when rationale exists', () => {
    useCanvasStore.setState({
      nodeRationales: { factor_price: 'Price is the primary lever for revenue growth' },
    })

    render(
      <RationaleTooltip nodeId="factor_price">
        <span>Price Factor</span>
      </RationaleTooltip>
    )

    const trigger = screen.getByText('Price Factor')
    fireEvent.mouseEnter(trigger)

    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    expect(screen.getByText('Price is the primary lever for revenue growth')).toBeInTheDocument()
  })

  it('renders children only when no rationale for node', () => {
    render(
      <RationaleTooltip nodeId="factor_missing">
        <span>No Rationale Factor</span>
      </RationaleTooltip>
    )

    expect(screen.getByText('No Rationale Factor')).toBeInTheDocument()

    // Should not have a wrapper div with relative positioning
    const trigger = screen.getByText('No Rationale Factor')
    fireEvent.mouseEnter(trigger)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('hides tooltip on mouse leave', () => {
    useCanvasStore.setState({
      nodeRationales: { factor_test: 'Test rationale' },
    })

    render(
      <RationaleTooltip nodeId="factor_test">
        <span>Test</span>
      </RationaleTooltip>
    )

    const trigger = screen.getByText('Test')
    fireEvent.mouseEnter(trigger)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()

    fireEvent.mouseLeave(trigger)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('auto-dismisses after 5 seconds', () => {
    vi.useFakeTimers()

    useCanvasStore.setState({
      nodeRationales: { factor_auto: 'Auto-dismiss test' },
    })

    render(
      <RationaleTooltip nodeId="factor_auto">
        <span>Auto</span>
      </RationaleTooltip>
    )

    fireEvent.mouseEnter(screen.getByText('Auto'))
    expect(screen.getByRole('tooltip')).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    vi.useRealTimers()
  })
})
