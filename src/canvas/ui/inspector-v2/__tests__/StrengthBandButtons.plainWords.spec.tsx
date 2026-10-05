import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { StrengthBandButtons } from '../shared/StrengthBandButtons'
import { CANVAS_STRENGTH_BANDS } from '../../../domain/vocabulary'

describe('existing strength preset disclosure', () => {
  it('uses the canonical band words without scientific figures for plain Inspector controls', () => {
    const onChange = vi.fn()
    render(<StrengthBandButtons value={-0.3} onChange={onChange} technicalDetails={false} />)
    const strong = screen.getByTestId('strength-band-strong')
    expect(strong.getAttribute('aria-label')).toContain('Strong')
    expect(strong.getAttribute('aria-label')).toContain('decreases')
    expect(strong.getAttribute('aria-label')).not.toMatch(/\d/)
    fireEvent.focus(strong)
    expect(screen.getByTestId('strength-preset-consequence').textContent).not.toMatch(/\d/)
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(strong)
    expect(onChange).toHaveBeenCalledWith(-CANVAS_STRENGTH_BANDS.find(b => b.label === 'Strong')!.midpoint)
  })
  it('retains exact disclosure for advanced detail and unchanged legacy callers', () => {
    render(<StrengthBandButtons value={-0.3} onChange={vi.fn()} />)
    const strong = screen.getByTestId('strength-band-strong')
    expect(strong.getAttribute('aria-label')).toContain('-0.55')
    fireEvent.focus(strong)
    expect(screen.getByTestId('strength-preset-consequence').textContent).toContain('-0.55')
  })
})
