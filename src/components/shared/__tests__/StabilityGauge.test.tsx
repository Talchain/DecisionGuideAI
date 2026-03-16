/**
 * StabilityGauge — radial arc gauge for recommendation stability.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StabilityGauge } from '../StabilityGauge'

describe('StabilityGauge', () => {
  it('renders danger colour for value below 0.40', () => {
    render(<StabilityGauge value={0.39} />)
    const gauge = screen.getByTestId('stability-gauge')
    expect(gauge).toBeTruthy()
    // The filled arc (second <path>) should use var(--danger)
    const paths = gauge.querySelectorAll('path')
    expect(paths[1].getAttribute('stroke')).toBe('var(--danger)')
  })

  it('renders warning colour for value 0.40', () => {
    render(<StabilityGauge value={0.40} />)
    const gauge = screen.getByTestId('stability-gauge')
    const paths = gauge.querySelectorAll('path')
    expect(paths[1].getAttribute('stroke')).toBe('var(--warning)')
  })

  it('renders success colour for value 0.70', () => {
    render(<StabilityGauge value={0.70} />)
    const gauge = screen.getByTestId('stability-gauge')
    const paths = gauge.querySelectorAll('path')
    expect(paths[1].getAttribute('stroke')).toBe('var(--success)')
  })

  it('renders nothing when value is null', () => {
    const { container } = render(<StabilityGauge value={null} />)
    expect(container.innerHTML).toBe('')
    expect(screen.queryByTestId('stability-gauge')).toBeNull()
  })

  it('renders nothing when value is undefined', () => {
    const { container } = render(<StabilityGauge value={undefined} />)
    expect(container.innerHTML).toBe('')
    expect(screen.queryByTestId('stability-gauge')).toBeNull()
  })

  it('displays percentage as integer', () => {
    render(<StabilityGauge value={0.856} />)
    const gauge = screen.getByTestId('stability-gauge')
    expect(gauge.textContent).toBe('86%')
  })
})
