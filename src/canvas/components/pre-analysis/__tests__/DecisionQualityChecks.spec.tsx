/**
 * DecisionQualityChecks — component tests.
 *
 * Tests max-visible-card logic and structural-check filtering.
 * Direct-add CTA tests removed: all IDs with DIRECT_ACTIONS
 * (no_risks, zero_external_factors, all_positive_edges) are now
 * in STRUCTURAL_CHECK_IDS and excluded from this component — the
 * direct-add feature for those IDs lives in the triage footer.
 */
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

  it('limits visible checks to 3 and shows "N more" toggle', () => {
    const checks = [
      makeCheck({ id: 'check_1' }),
      makeCheck({ id: 'check_2' }),
      makeCheck({ id: 'check_3' }),
      makeCheck({ id: 'check_4' }),
    ]

    render(<DecisionQualityChecks checks={checks} />)
    expandSection()

    expect(screen.getByText('Message for check_1')).toBeInTheDocument()
    expect(screen.queryByText('Message for check_4')).not.toBeInTheDocument()
    expect(screen.getByText('1 more')).toBeInTheDocument()
  })

  it('shows all when "N more" is clicked, then collapses on "Show less"', () => {
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
    expect(screen.getByText('Show less')).toBeInTheDocument()

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
      makeCheck({ id: 'no_risks' }),         // structural — excluded
      makeCheck({ id: 'all_positive_edges' }), // structural — excluded
      makeCheck({ id: 'anchoring' }),         // non-structural — included
    ]

    render(<DecisionQualityChecks checks={checks} />)

    // Component renders because at least one non-structural check passes
    expect(screen.getByTestId('model-quality-checks')).toBeInTheDocument()

    expandSection()

    // Structural checks filtered out
    expect(screen.queryByText('Add risks to capture what could go wrong')).not.toBeInTheDocument()
    expect(screen.queryByText('Add trade-offs to capture real-world costs')).not.toBeInTheDocument()
    // Non-structural check present (anchoring has title override)
    expect(screen.getByText('Consider whether other options are equally explored')).toBeInTheDocument()
  })

  it('renders nothing when all checks are structural', () => {
    const checks = [
      makeCheck({ id: 'no_risks' }),
      makeCheck({ id: 'same_levers' }),
      makeCheck({ id: 'zero_external_factors' }),
    ]

    const { container } = render(<DecisionQualityChecks checks={checks} />)
    expect(container.firstChild).toBeNull()
  })
})
