import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DeltaIndicator } from '../DeltaIndicator'

describe('DeltaIndicator', () => {
  it('renders positive delta with up arrow', () => {
    render(<DeltaIndicator currentValue={0.72} previousValue={0.64} format="percent" />)
    const el = screen.getByTestId('delta-indicator')
    expect(el).toBeInTheDocument()
    expect(el.textContent).toContain('+8pp')
    expect(el.className).toContain('text-success')
  })

  it('renders negative delta with down arrow', () => {
    render(<DeltaIndicator currentValue={0.31} previousValue={0.64} format="percent" />)
    const el = screen.getByTestId('delta-indicator')
    expect(el).toBeInTheDocument()
    expect(el.textContent).toContain('33pp')
    expect(el.className).toContain('text-danger')
  })

  it('suppresses delta below significance threshold', () => {
    render(<DeltaIndicator currentValue={0.64} previousValue={0.641} format="percent" />)
    expect(screen.queryByTestId('delta-indicator')).not.toBeInTheDocument()
  })

  it('renders nothing when previousValue is null', () => {
    render(<DeltaIndicator currentValue={0.64} previousValue={null} format="percent" />)
    expect(screen.queryByTestId('delta-indicator')).not.toBeInTheDocument()
  })

  it('renders nothing when previousValue is undefined', () => {
    render(<DeltaIndicator currentValue={0.64} previousValue={undefined} format="percent" />)
    expect(screen.queryByTestId('delta-indicator')).not.toBeInTheDocument()
  })

  it('renders currency format', () => {
    render(<DeltaIndicator currentValue={1500} previousValue={1000} format="currency" unit="$" />)
    const el = screen.getByTestId('delta-indicator')
    expect(el.textContent).toContain('+$500')
  })

  it('uses custom significance threshold', () => {
    render(
      <DeltaIndicator currentValue={0.65} previousValue={0.64} format="percent" significanceThreshold={0.005} />
    )
    expect(screen.getByTestId('delta-indicator')).toBeInTheDocument()
  })
})
