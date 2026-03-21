import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
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

describe('DecisionQualityChecks — direct add CTA', () => {
  it('shows "Add a risk" button for no_risks check when onDirectAdd provided', () => {
    const onDirectAdd = vi.fn()
    render(<DecisionQualityChecks checks={[makeCheck({ id: 'no_risks' })]} onDirectAdd={onDirectAdd} />)
    expect(screen.getByText('Add a risk')).toBeInTheDocument()
  })

  it('calls onDirectAdd with risk kind on submit', () => {
    const onDirectAdd = vi.fn()
    render(<DecisionQualityChecks checks={[makeCheck({ id: 'no_risks' })]} onDirectAdd={onDirectAdd} />)

    fireEvent.click(screen.getByText('Add a risk'))
    const input = screen.getByPlaceholderText(/churn/)
    fireEvent.change(input, { target: { value: 'Supply chain disruption' } })
    fireEvent.click(screen.getByText('Add'))

    expect(onDirectAdd).toHaveBeenCalledWith('risk', 'Supply chain disruption')
  })

  it('shows validation error on empty submit', () => {
    const onDirectAdd = vi.fn()
    render(<DecisionQualityChecks checks={[makeCheck({ id: 'no_risks' })]} onDirectAdd={onDirectAdd} />)

    fireEvent.click(screen.getByText('Add a risk'))
    fireEvent.click(screen.getByText('Add'))

    expect(screen.getByText('Enter a name')).toBeInTheDocument()
    expect(onDirectAdd).not.toHaveBeenCalled()
  })

  it('Cancel closes input and clears validation', () => {
    render(<DecisionQualityChecks checks={[makeCheck({ id: 'no_risks' })]} onDirectAdd={vi.fn()} />)

    fireEvent.click(screen.getByText('Add a risk'))
    fireEvent.click(screen.getByText('Add')) // trigger validation
    expect(screen.getByText('Enter a name')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Enter a name')).not.toBeInTheDocument()
    expect(screen.getByText('Add a risk')).toBeInTheDocument()
  })

  it('does not show direct add button when onDirectAdd is not provided', () => {
    render(<DecisionQualityChecks checks={[makeCheck({ id: 'no_risks' })]} />)
    expect(screen.queryByText('Add a risk')).not.toBeInTheDocument()
  })
})
