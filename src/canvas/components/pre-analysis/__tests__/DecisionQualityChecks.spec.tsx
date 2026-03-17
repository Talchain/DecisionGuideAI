import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DecisionQualityChecks } from '../DecisionQualityChecks'
import type { QualityCheck } from '../hooks/usePreAnalysisData'

function makeCheck(overrides: Partial<QualityCheck> & Pick<QualityCheck, 'id'>): QualityCheck {
  return {
    message: `Message for ${overrides.id}`,
    cta: 'Fix it',
    ctaAction: `action_${overrides.id}`,
    pill: 'framing',
    ...overrides,
  }
}

describe('DecisionQualityChecks — max visible cards', () => {
  it('shows all checks when count ≤ 3', () => {
    const checks = [
      makeCheck({ id: 'check_1' }),
      makeCheck({ id: 'check_2' }),
      makeCheck({ id: 'check_3' }),
    ]

    render(<DecisionQualityChecks checks={checks} />)

    expect(screen.getByText('Message for check_1')).toBeInTheDocument()
    expect(screen.getByText('Message for check_2')).toBeInTheDocument()
    expect(screen.getByText('Message for check_3')).toBeInTheDocument()
    expect(screen.queryByText(/more/i)).not.toBeInTheDocument()
  })

  it('shows only first 3 and "N more" toggle when count > 3', () => {
    const checks = [
      makeCheck({ id: 'check_1' }),
      makeCheck({ id: 'check_2' }),
      makeCheck({ id: 'check_3' }),
      makeCheck({ id: 'check_4' }),
      makeCheck({ id: 'check_5' }),
    ]

    render(<DecisionQualityChecks checks={checks} />)

    // First 3 visible
    expect(screen.getByText('Message for check_1')).toBeInTheDocument()
    expect(screen.getByText('Message for check_2')).toBeInTheDocument()
    expect(screen.getByText('Message for check_3')).toBeInTheDocument()

    // 4th and 5th hidden
    expect(screen.queryByText('Message for check_4')).not.toBeInTheDocument()
    expect(screen.queryByText('Message for check_5')).not.toBeInTheDocument()

    // "2 more" toggle visible
    expect(screen.getByText('2 more')).toBeInTheDocument()
  })

  it('expands to show all items when "N more" is clicked', () => {
    const checks = [
      makeCheck({ id: 'check_1' }),
      makeCheck({ id: 'check_2' }),
      makeCheck({ id: 'check_3' }),
      makeCheck({ id: 'check_4' }),
    ]

    render(<DecisionQualityChecks checks={checks} />)

    // Click "1 more"
    fireEvent.click(screen.getByText('1 more'))

    // All 4 now visible
    expect(screen.getByText('Message for check_4')).toBeInTheDocument()

    // "Show less" toggle appears
    expect(screen.getByText('Show less')).toBeInTheDocument()
  })

  it('collapses back to 3 when "Show less" is clicked', () => {
    const checks = [
      makeCheck({ id: 'check_1' }),
      makeCheck({ id: 'check_2' }),
      makeCheck({ id: 'check_3' }),
      makeCheck({ id: 'check_4' }),
    ]

    render(<DecisionQualityChecks checks={checks} />)

    fireEvent.click(screen.getByText('1 more'))
    expect(screen.getByText('Message for check_4')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Show less'))
    expect(screen.queryByText('Message for check_4')).not.toBeInTheDocument()
    expect(screen.getByText('1 more')).toBeInTheDocument()
  })

  it('renders nothing when checks array is empty', () => {
    const { container } = render(<DecisionQualityChecks checks={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
