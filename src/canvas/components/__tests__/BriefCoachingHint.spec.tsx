import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BriefCoachingHint } from '../BriefCoachingHint'

describe('BriefCoachingHint', () => {
  it('renders coaching text when focused and invalid', () => {
    render(<BriefCoachingHint isFocused={true} isValid={false} softWarning={null} />)
    expect(screen.getByTestId('brief-coaching-hint')).toBeInTheDocument()
    expect(screen.getByText(/Describe the decision you are facing/)).toBeInTheDocument()
  })

  it('does not render when valid and no soft warning', () => {
    const { container } = render(<BriefCoachingHint isFocused={true} isValid={true} softWarning={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('does not render when not focused even if invalid', () => {
    const { container } = render(<BriefCoachingHint isFocused={false} isValid={false} softWarning={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders soft warning when valid and warning provided', () => {
    const warning = 'Your brief contains a lot of numbers or symbols.'
    render(<BriefCoachingHint isFocused={false} isValid={true} softWarning={warning} />)
    expect(screen.getByTestId('brief-coaching-hint')).toBeInTheDocument()
    expect(screen.getByText(warning)).toBeInTheDocument()
  })

  it('has aria-live="polite" for accessibility', () => {
    render(<BriefCoachingHint isFocused={true} isValid={false} softWarning={null} />)
    expect(screen.getByTestId('brief-coaching-hint')).toHaveAttribute('aria-live', 'polite')
  })

  it('has role="status"', () => {
    render(<BriefCoachingHint isFocused={true} isValid={false} softWarning={null} />)
    expect(screen.getByTestId('brief-coaching-hint')).toHaveAttribute('role', 'status')
  })
})
