import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfidenceBadge } from '../ConfidenceBadge'

describe('ConfidenceBadge tooltips', () => {
  it('shows fallback tooltip when confidence level is missing', () => {
    render(<ConfidenceBadge />)

    const label = screen.getByText('Confidence N/A')
    const container = label.closest('div') as HTMLDivElement
    expect(container).toBeInTheDocument()

    fireEvent.mouseEnter(container)

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveTextContent('Confidence data not available')
  })

  it('shows reason and score in tooltip when provided', () => {
    render(
      <ConfidenceBadge
        level="high"
        reason="Lots of evidence"
        score={0.9}
      />
    )

    const badge = screen.getByRole('status')
    fireEvent.mouseEnter(badge)

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveTextContent('Lots of evidence (Score: 90%)')
  })
})
