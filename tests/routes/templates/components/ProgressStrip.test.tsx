import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressStrip } from '../../../../src/routes/templates/components/ProgressStrip'

describe('ProgressStrip', () => {
  it('renders when visible', () => {
    render(<ProgressStrip isVisible={true} />)
    
    expect(screen.getByText('Running…')).toBeInTheDocument()
  })

  it('shows custom message', () => {
    render(<ProgressStrip isVisible={true} message="Reconnected — resuming…" />)
    
    expect(screen.getByText('Reconnected — resuming…')).toBeInTheDocument()
  })

  it('returns null when not visible', () => {
    const { container } = render(<ProgressStrip isVisible={false} />)
    
    expect(container.firstChild).toBeNull()
  })

  it('has aria-live region for announcements', () => {
    render(<ProgressStrip isVisible={true} />)
    
    const liveRegion = screen.getByText('Running…')
    expect(liveRegion).toHaveAttribute('aria-live', 'polite')
  })
})
