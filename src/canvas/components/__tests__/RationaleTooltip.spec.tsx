/**
 * RationaleTooltip — test suite
 *
 * Tests:
 * - Renders tooltip on hover when rationale exists
 * - Renders children only (no-op) when no rationale for node
 * - Hides tooltip on mouse leave
 * - Dismisses on Escape key (WCAG 1.4.13)
 *
 * Note: RationaleTooltip wraps the shared Tooltip component, which is
 * intentionally persistent (no auto-dismiss timer) per WCAG 1.4.13's
 * "persistent" requirement for content on hover. Dismissal is via mouse
 * leave or Escape only.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

  it('dismisses on Escape key (WCAG 1.4.13)', () => {
    useCanvasStore.setState({
      nodeRationales: { factor_escape: 'Escape dismiss test' },
    })

    render(
      <RationaleTooltip nodeId="factor_escape">
        <span>Escape</span>
      </RationaleTooltip>
    )

    fireEvent.mouseEnter(screen.getByText('Escape'))
    expect(screen.getByRole('tooltip')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('uses bodySmall typography and wraps text within 280px max width', () => {
    const longRationale = 'This is a multi-sentence rationale that needs to wrap across several lines. It explains why this factor matters for the decision in detail.'
    useCanvasStore.setState({
      nodeRationales: { factor_long: longRationale },
    })

    render(
      <RationaleTooltip nodeId="factor_long">
        <span>Long</span>
      </RationaleTooltip>
    )

    fireEvent.mouseEnter(screen.getByText('Long'))
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toBeInTheDocument()
    // bodySmall token resolves to text-sm at runtime
    expect(tooltip.className).toContain('text-sm')
    // wrapping enabled (no whitespace-nowrap class)
    expect(tooltip.className).not.toContain('whitespace-nowrap')
    // max-width applied via inline style
    expect(tooltip.style.maxWidth).toBe('280px')
    expect(tooltip.style.whiteSpace).toBe('normal')
  })
})
