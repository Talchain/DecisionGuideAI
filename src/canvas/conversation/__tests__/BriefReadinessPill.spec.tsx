/**
 * Tests for BriefReadinessPill.
 *
 * Verifies:
 * - Correct label for each readiness level
 * - Toggle fires onToggle
 * - aria-expanded reflects state
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BriefReadinessPill } from '../zones/BriefReadinessPill'

describe('BriefReadinessPill', () => {
  it('shows "Low readiness" for low', () => {
    render(<BriefReadinessPill readiness="low" expanded={false} onToggle={vi.fn()} />)
    expect(screen.getByText('Low readiness')).toBeInTheDocument()
  })

  it('shows "Medium readiness" for medium', () => {
    render(<BriefReadinessPill readiness="medium" expanded={false} onToggle={vi.fn()} />)
    expect(screen.getByText('Medium readiness')).toBeInTheDocument()
  })

  it('shows "High readiness" for high', () => {
    render(<BriefReadinessPill readiness="high" expanded={false} onToggle={vi.fn()} />)
    expect(screen.getByText('High readiness')).toBeInTheDocument()
  })

  it('fires onToggle when clicked', () => {
    const onToggle = vi.fn()
    render(<BriefReadinessPill readiness="low" expanded={false} onToggle={onToggle} />)
    fireEvent.click(screen.getByTestId('brief-readiness-pill'))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('has aria-expanded=true when expanded', () => {
    render(<BriefReadinessPill readiness="low" expanded={true} onToggle={vi.fn()} />)
    expect(screen.getByTestId('brief-readiness-pill')).toHaveAttribute('aria-expanded', 'true')
  })

  it('has aria-expanded=false when collapsed', () => {
    render(<BriefReadinessPill readiness="low" expanded={false} onToggle={vi.fn()} />)
    expect(screen.getByTestId('brief-readiness-pill')).toHaveAttribute('aria-expanded', 'false')
  })
})
