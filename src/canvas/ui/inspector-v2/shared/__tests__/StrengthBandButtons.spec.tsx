/**
 * StrengthBandButtons unit tests (B.4)
 * Verifies: rendering, click behaviour, active state detection, sign preservation.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { StrengthBandButtons } from '../StrengthBandButtons'

describe('StrengthBandButtons', () => {
  it('renders all four band buttons', () => {
    const { container } = render(<StrengthBandButtons value={0.5} onChange={() => {}} />)
    const buttons = container.querySelectorAll('button')
    expect(buttons).toHaveLength(4)
    expect(buttons[0].textContent).toBe('Slight')
    expect(buttons[1].textContent).toBe('Moderate')
    expect(buttons[2].textContent).toBe('Strong')
    expect(buttons[3].textContent).toBe('Very strong')
  })

  it('marks "Strong" as active when value is within the strong band (0.50)', () => {
    const { container } = render(<StrengthBandButtons value={0.50} onChange={() => {}} />)
    const strongBtn = container.querySelector('[data-testid="strength-band-strong"]')
    expect(strongBtn?.getAttribute('aria-pressed')).toBe('true')
  })

  it('marks "Moderate" as active when value is within the moderate band (0.33)', () => {
    const { container } = render(<StrengthBandButtons value={0.33} onChange={() => {}} />)
    const moderateBtn = container.querySelector('[data-testid="strength-band-moderate"]')
    expect(moderateBtn?.getAttribute('aria-pressed')).toBe('true')
  })

  it('marks "Moderate" as active when value is at the lower bound of moderate (0.20)', () => {
    const { container } = render(<StrengthBandButtons value={0.20} onChange={() => {}} />)
    const moderateBtn = container.querySelector('[data-testid="strength-band-moderate"]')
    expect(moderateBtn?.getAttribute('aria-pressed')).toBe('true')
  })

  it('calls onChange with correct midpoint when clicking Strong (0.55)', () => {
    const onChange = vi.fn()
    const { container } = render(<StrengthBandButtons value={0.10} onChange={onChange} />)
    const strongBtn = container.querySelector('[data-testid="strength-band-strong"]')
    fireEvent.click(strongBtn!)
    expect(onChange).toHaveBeenCalledWith(0.55)
  })

  it('calls onChange with negative midpoint when current value is negative', () => {
    const onChange = vi.fn()
    const { container } = render(<StrengthBandButtons value={-0.10} onChange={onChange} />)
    const strongBtn = container.querySelector('[data-testid="strength-band-strong"]')
    fireEvent.click(strongBtn!)
    expect(onChange).toHaveBeenCalledWith(-0.55)
  })

  it('preserves negative sign for all band clicks', () => {
    const onChange = vi.fn()
    const { container } = render(<StrengthBandButtons value={-0.30} onChange={onChange} />)
    const slightBtn = container.querySelector('[data-testid="strength-band-slight"]')
    fireEvent.click(slightBtn!)
    expect(onChange).toHaveBeenCalledWith(-0.10)
  })

  it('detects active band from negative values (magnitude match)', () => {
    const { container } = render(<StrengthBandButtons value={-0.80} onChange={() => {}} />)
    const veryStrongBtn = container.querySelector('[data-testid="strength-band-very-strong"]')
    expect(veryStrongBtn?.getAttribute('aria-pressed')).toBe('true')
  })

  it('marks "Slight" as active when value is 0', () => {
    const { container } = render(<StrengthBandButtons value={0} onChange={() => {}} />)
    const slightBtn = container.querySelector('[data-testid="strength-band-slight"]')
    expect(slightBtn?.getAttribute('aria-pressed')).toBe('true')
  })

  it('marks "Strong" as active at the lower boundary of strong (0.40)', () => {
    const { container } = render(<StrengthBandButtons value={0.40} onChange={() => {}} />)
    const strongBtn = container.querySelector('[data-testid="strength-band-strong"]')
    expect(strongBtn?.getAttribute('aria-pressed')).toBe('true')
  })

  it('marks "Very strong" as active at the lower boundary of very strong (0.70)', () => {
    const { container } = render(<StrengthBandButtons value={0.70} onChange={() => {}} />)
    const veryStrongBtn = container.querySelector('[data-testid="strength-band-very-strong"]')
    expect(veryStrongBtn?.getAttribute('aria-pressed')).toBe('true')
  })

  it('has role="group" with accessible label', () => {
    const { container } = render(<StrengthBandButtons value={0} onChange={() => {}} />)
    const group = container.querySelector('[role="group"]')
    expect(group).not.toBeNull()
    expect(group?.getAttribute('aria-label')).toBe('Strength presets')
  })

  // Layout guard: the button container must not use flex-wrap so all four buttons
  // stay on one row at default panel width (~350px). CSS layout is not computed in
  // jsdom, but this class-presence check catches if flex-wrap is re-added.
  it('button container does not use flex-wrap (single-row layout guard)', () => {
    const { container } = render(<StrengthBandButtons value={0.5} onChange={() => {}} />)
    const group = container.querySelector('[role="group"]')
    expect(group?.className).not.toContain('flex-wrap')
  })
})
