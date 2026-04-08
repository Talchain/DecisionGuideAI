/**
 * KNOWN-BROKEN TESTS — pre-existing failures awaiting fix.
 *
 * As of 2026-04-08, 6 tests in this file fail because they expect a
 * "Sharpen your thinking" section header that no longer exists in the
 * DecisionQualityChecks component. The test file has not been updated
 * since the section was removed/renamed.
 *
 * Status: not tracked in an issue. Failures are present on baseline,
 * confirmed independent of the v2 pre-analysis panel regroup work.
 *
 * Action needed: either update the test fixtures to match the current
 * DecisionQualityChecks component contract, or remove the file if the
 * component is no longer used.
 */
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

/** Expand the "Sharpen your thinking" section (defaults to collapsed) */
function expandSection() {
  fireEvent.click(screen.getByText('Sharpen your thinking'))
}

describe('DecisionQualityChecks — max visible cards', () => {
  it('shows all checks when count ≤ 3', () => {
    const checks = [
      makeCheck({ id: 'check_1' }),
      makeCheck({ id: 'check_2' }),
      makeCheck({ id: 'check_3' }),
    ]

    render(<DecisionQualityChecks checks={checks} />)
    expandSection()

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
    expandSection()

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
    expandSection()

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
    expandSection()

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

  it('filters out structural checks (surfaced as triage footer flags)', () => {
    const checks = [
      makeCheck({ id: 'no_risks' }),
      makeCheck({ id: 'same_levers' }),
      makeCheck({ id: 'all_positive_edges' }),
    ]

    render(<DecisionQualityChecks checks={checks} />)

    // Header shows count = 1 (only same_levers passes filter)
    expect(screen.getByTestId('model-quality-checks')).toBeInTheDocument()

    // Expand the section
    expandSection()

    // Structural checks filtered out (their action titles should NOT appear)
    expect(screen.queryByText('Add risks to capture what could go wrong')).not.toBeInTheDocument()
    expect(screen.queryByText('Add trade-offs to capture real-world costs')).not.toBeInTheDocument()
    // Non-structural check remains (same_levers has action title override)
    expect(screen.getByText('Consider whether your options represent genuinely different strategies')).toBeInTheDocument()
  })
})

describe('DecisionQualityChecks — direct add CTA', () => {
  // zero_external_factors has a direct-add action and is NOT filtered by STRUCTURAL_CHECK_IDS
  it('shows "Add a factor" button for zero_external_factors check when onDirectAdd provided', () => {
    const onDirectAdd = vi.fn()
    render(<DecisionQualityChecks checks={[makeCheck({ id: 'zero_external_factors' })]} onDirectAdd={onDirectAdd} />)
    expandSection()
    expect(screen.getByText('Add a factor')).toBeInTheDocument()
  })

  it('calls onDirectAdd with factor kind on submit', () => {
    const onDirectAdd = vi.fn()
    render(<DecisionQualityChecks checks={[makeCheck({ id: 'zero_external_factors' })]} onDirectAdd={onDirectAdd} />)
    expandSection()

    fireEvent.click(screen.getByText('Add a factor'))
    const input = screen.getByPlaceholderText(/acquisition/)
    fireEvent.change(input, { target: { value: 'Market conditions' } })
    fireEvent.click(screen.getByText('Add'))

    expect(onDirectAdd).toHaveBeenCalledWith('factor', 'Market conditions')
  })

  it('shows validation error on empty submit', () => {
    const onDirectAdd = vi.fn()
    render(<DecisionQualityChecks checks={[makeCheck({ id: 'zero_external_factors' })]} onDirectAdd={onDirectAdd} />)
    expandSection()

    fireEvent.click(screen.getByText('Add a factor'))
    fireEvent.click(screen.getByText('Add'))

    expect(screen.getByText('Enter a name')).toBeInTheDocument()
    expect(onDirectAdd).not.toHaveBeenCalled()
  })

  it('Cancel closes input and clears validation', () => {
    render(<DecisionQualityChecks checks={[makeCheck({ id: 'zero_external_factors' })]} onDirectAdd={vi.fn()} />)
    expandSection()

    fireEvent.click(screen.getByText('Add a factor'))
    fireEvent.click(screen.getByText('Add')) // trigger validation
    expect(screen.getByText('Enter a name')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Enter a name')).not.toBeInTheDocument()
    expect(screen.getByText('Add a factor')).toBeInTheDocument()
  })

  it('does not show direct add button when onDirectAdd is not provided', () => {
    render(<DecisionQualityChecks checks={[makeCheck({ id: 'zero_external_factors' })]} />)
    expandSection()
    expect(screen.queryByText('Add a factor')).not.toBeInTheDocument()
  })
})
