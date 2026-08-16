/**
 * SignedStrengthSlider — C1 uncertainty band tests
 */

import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SignedStrengthSlider } from '../SignedStrengthSlider'

describe('SignedStrengthSlider — C1 uncertainty band', () => {
  it('publishes the displayed value synchronously and commits the exact released value', () => {
    const onChange = vi.fn()
    const onEditStart = vi.fn()
    const onCommit = vi.fn()
    const view = render(
      <SignedStrengthSlider
        value={0.3}
        onEditStart={onEditStart}
        onChange={onChange}
        onCommit={onCommit}
      />,
    )
    const slider = screen.getByRole('slider') as HTMLInputElement

    fireEvent.focus(slider)
    fireEvent.change(slider, { target: { value: '0.72' } })

    // No control-level timer: the canonical optimistic owner sees the value in
    // the same event, before a Run click can occur.
    expect(onEditStart).toHaveBeenCalledWith(0.3)
    expect(onChange).toHaveBeenCalledWith(0.72)

    view.rerender(
      <SignedStrengthSlider
        value={0.72}
        onEditStart={onEditStart}
        onChange={onChange}
        onCommit={onCommit}
      />,
    )
    fireEvent.mouseUp(screen.getByRole('slider'))
    expect(onCommit).toHaveBeenCalledWith(0.72)
  })

  it('renders an authoritative prop replacement even while the control remains focused', () => {
    const view = render(<SignedStrengthSlider value={0.7} onChange={() => {}} />)
    const slider = screen.getByRole('slider') as HTMLInputElement
    fireEvent.focus(slider)

    view.rerender(<SignedStrengthSlider value={0.25} onChange={() => {}} />)

    expect((screen.getByRole('slider') as HTMLInputElement).value).toBe('0.25')
  })

  it('renders uncertainty band when std is provided', () => {
    render(
      <SignedStrengthSlider value={0.3} onChange={() => {}} std={0.15} />
    )

    expect(screen.getByTestId('uncertainty-band')).toBeInTheDocument()
  })

  it('does not render uncertainty band when std is absent', () => {
    render(
      <SignedStrengthSlider value={0.3} onChange={() => {}} />
    )

    expect(screen.queryByTestId('uncertainty-band')).not.toBeInTheDocument()
  })

  it('does not render uncertainty band when std is 0', () => {
    render(
      <SignedStrengthSlider value={0.3} onChange={() => {}} std={0} />
    )

    expect(screen.queryByTestId('uncertainty-band')).not.toBeInTheDocument()
  })

  it('clamps uncertainty band to slider range [-1, 1]', () => {
    // Value near edge: 0.9 with std 0.3 should clamp high end to 1.0
    render(
      <SignedStrengthSlider value={0.9} onChange={() => {}} std={0.3} />
    )

    const band = screen.getByTestId('uncertainty-band')
    const style = band.style

    // Band should be present and have valid dimensions
    expect(style.left).toBeDefined()
    expect(style.width).toBeDefined()

    // bandLow = max(-1, 0.9-0.3) = 0.6, bandHigh = min(1, 0.9+0.3) = 1.0
    // leftPct = ((0.6+1)/2)*100 = 80%, widthPct = ((1.0-0.6)/2)*100 = 20%
    const leftPct = parseFloat(style.left)
    const widthPct = parseFloat(style.width)
    // Left + width should not exceed 100% (maps to full [-1,1] range)
    expect(leftPct + widthPct).toBeLessThanOrEqual(100.01)
    // Left should be >= 0%
    expect(leftPct).toBeGreaterThanOrEqual(0)
  })

  it('renders uncertainty band for negative values', () => {
    render(
      <SignedStrengthSlider value={-0.5} onChange={() => {}} std={0.2} />
    )

    const band = screen.getByTestId('uncertainty-band')
    expect(band).toBeInTheDocument()
  })
})
