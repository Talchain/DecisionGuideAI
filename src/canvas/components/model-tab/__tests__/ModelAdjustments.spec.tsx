import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ModelAdjustments } from '../ModelAdjustments'

describe('ModelAdjustments — sub-section grouping (Task 8)', () => {
  it('shows "Olumi adjusted N factors" header for multiple adjustments', () => {
    render(
      <ModelAdjustments
        adjustments={[
          { code: 'risk_coefficient_corrected', reason: 'Direction mismatch' },
          { code: 'factor_reclassified', reason: 'Moved to external' },
        ]}
      />,
    )

    expect(screen.getByText(/Olumi adjusted 2 factors/)).toBeInTheDocument()
  })

  // Brief 4 hotfix Task 1: header count must equal the number of raw
  // adjustments, not the number of collapsed group entries.
  it('reports raw adjustment count when two entries share the same code (collapsed group)', () => {
    render(
      <ModelAdjustments
        adjustments={[
          { code: 'factor_reclassified', reason: 'Moved "Onboarding Duration" to external' },
          { code: 'factor_reclassified', reason: 'Moved "Current Team Skill Level" to external' },
        ]}
      />,
    )

    expect(screen.getByText(/Olumi adjusted 2 factors/)).toBeInTheDocument()
  })

  // Heterogeneous regression (Paul's correction): 2× same code + 1× different
  // code → header must show "3 factors" and detail (after expand) must show
  // all three raw adjustments, not just the 2 groups.
  it('reports raw count with mixed codes (2× same + 1× different)', () => {
    render(
      <ModelAdjustments
        adjustments={[
          { code: 'factor_reclassified', reason: 'Moved "A" to external' },
          { code: 'factor_reclassified', reason: 'Moved "B" to external' },
          { code: 'risk_coefficient_corrected', reason: 'Direction mismatch' },
        ]}
      />,
    )

    expect(screen.getByText(/Olumi adjusted 3 factors/)).toBeInTheDocument()
  })

  it('shows "1 factor" (singular) when a single adjustment is provided', () => {
    render(
      <ModelAdjustments
        adjustments={[{ code: 'factor_reclassified', reason: 'Moved "A" to external' }]}
      />,
    )
    expect(screen.getByText(/Olumi adjusted 1 factor/)).toBeInTheDocument()
  })

  // P1 #2: 0-case regression. Component must render nothing when every
  // input list is empty — no empty card, no stray wrapper.
  it('renders nothing when adjustments, repairActions, and postRunRepairs are all empty', () => {
    const { container } = render(<ModelAdjustments adjustments={[]} />)
    expect(container.firstChild).toBeNull()
  })

  // P1 #1: "factors" copy must only apply when we actually have factor-level
  // adjustments. When only pipeline-level repairActions are present, use
  // "adjustments" terminology so we don't mislabel.
  it('labels the header as "adjustment" when only pipeline repairActions are present', () => {
    render(
      <ModelAdjustments
        adjustments={[]}
        repairActions={['Reclassified factor A to external']}
      />,
    )
    expect(screen.getByText(/Olumi applied 1 adjustment/)).toBeInTheDocument()
    expect(screen.queryByText(/Olumi adjusted 1 factor/)).not.toBeInTheDocument()
  })

  it('renders Constraints applied sub-label when constraint codes are present', () => {
    render(
      <ModelAdjustments
        adjustments={[
          { code: 'risk_coefficient_corrected', reason: 'Direction mismatch' },
          { code: 'edge_strength_clamped', reason: 'Clamped to [0,1]' },
          { code: 'factor_reclassified', reason: 'Moved to external' },
        ]}
      />,
    )

    // Expand the section
    fireEvent.click(screen.getByText(/Olumi adjusted 3 factors/))

    expect(screen.getByText('Constraints applied (2)')).toBeInTheDocument()
  })

  it('renders Auto-fixes applied sub-label when non-constraint codes are present', () => {
    render(
      <ModelAdjustments
        adjustments={[
          { code: 'risk_coefficient_corrected', reason: 'Direction mismatch' },
          { code: 'factor_reclassified', reason: 'Moved to external' },
        ]}
      />,
    )

    fireEvent.click(screen.getByText(/Olumi adjusted 2 factors/))

    expect(screen.getByText('Auto-fixes applied (1)')).toBeInTheDocument()
  })

  it('shows only Constraints applied when all codes are constraint type', () => {
    render(
      <ModelAdjustments
        adjustments={[
          { code: 'risk_coefficient_corrected', reason: 'Direction mismatch' },
          { code: 'edge_strength_clamped', reason: 'Clamped' },
        ]}
      />,
    )

    fireEvent.click(screen.getByText(/Olumi adjusted 2 factors/))

    expect(screen.getByText('Constraints applied (2)')).toBeInTheDocument()
    expect(screen.queryByText(/Auto-fixes applied/)).not.toBeInTheDocument()
  })

  it('shows only Auto-fixes applied when no constraint codes are present', () => {
    render(
      <ModelAdjustments
        adjustments={[
          { code: 'factor_reclassified', reason: 'Moved to external' },
          { code: 'edge_added', reason: 'Added missing edge' },
        ]}
      />,
    )

    fireEvent.click(screen.getByText(/Olumi adjusted 2 factors/))

    expect(screen.queryByText(/Constraints applied/)).not.toBeInTheDocument()
    expect(screen.getByText('Auto-fixes applied (2)')).toBeInTheDocument()
  })

  it('collapses and re-expands correctly', () => {
    render(
      <ModelAdjustments
        adjustments={[
          { code: 'risk_coefficient_corrected', reason: 'Direction mismatch' },
          { code: 'factor_reclassified', reason: 'Moved to external' },
        ]}
      />,
    )

    const toggle = screen.getByText(/Olumi adjusted 2 factors/)

    // Expand
    fireEvent.click(toggle)
    expect(screen.getByText('Constraints applied (1)')).toBeInTheDocument()

    // Collapse
    fireEvent.click(toggle)
    expect(screen.queryByText('Constraints applied (1)')).not.toBeInTheDocument()
  })
})

describe('ModelAdjustments — detail sanitisation (Task 4)', () => {
  it('strips "with synthesised prior [X, Y]" from technicalDetail', () => {
    render(
      <ModelAdjustments
        adjustments={[{
          code: 'unknown_repair',
          reason: 'Reclassified unreachable factor "Monthly Churn Rate" to external with synthesised prior [0, 0.14]',
        }]}
      />,
    )

    // Click "Details" to reveal technical detail
    fireEvent.click(screen.getByText('Details'))

    // Prior notation should be stripped
    expect(screen.queryByText(/\[0, 0\.14\]/)).not.toBeInTheDocument()
    expect(screen.queryByText(/synthesised prior/i)).not.toBeInTheDocument()
  })

  it('replaces "Reclassified unreachable factor" with "Moved" in technicalDetail', () => {
    render(
      <ModelAdjustments
        adjustments={[{
          code: 'unknown_repair',
          reason: 'Reclassified unreachable factor "Monthly Churn Rate" to external',
        }]}
      />,
    )

    fireEvent.click(screen.getByText('Details'))

    expect(screen.queryByText(/Reclassified unreachable factor/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Moved/)).toBeInTheDocument()
  })

  it('handles reason without prior clause (no change to rest of text)', () => {
    render(
      <ModelAdjustments
        adjustments={[{
          code: 'unknown_repair',
          reason: 'Factor removed from model',
        }]}
      />,
    )

    fireEvent.click(screen.getByText('Details'))

    expect(screen.getByText('Factor removed from model')).toBeInTheDocument()
  })

  it('sanitises strength.mean (dot variant) sign correction detail', () => {
    render(
      <ModelAdjustments
        adjustments={[{
          code: 'risk_coefficient_corrected',
          reason: 'effect_direction "negative" contradicts strength.mean sign (0.3)',
        }]}
      />,
    )

    // Known code → headline shown directly
    expect(screen.getByText(/Corrected 1 relationship direction/)).toBeInTheDocument()

    // Click "Details" to reveal technical detail
    fireEvent.click(screen.getByText('Details'))

    // Engine notation must NOT be visible
    expect(screen.queryByText(/strength\.mean/)).not.toBeInTheDocument()
    expect(screen.queryByText(/strength_mean/)).not.toBeInTheDocument()
    expect(screen.queryByText(/effect_direction/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\(0\.3\)/)).not.toBeInTheDocument()

    // Human sentence should be shown
    expect(screen.getByText("Relationship direction didn't match the stated effect. Corrected automatically")).toBeInTheDocument()
  })

  it('shows user-facing headline from REPAIR_COPY for known codes', () => {
    render(
      <ModelAdjustments
        adjustments={[{
          code: 'factor_reclassified',
          reason: 'Reclassified unreachable factor "Churn" to external with synthesised prior [0, 0.1]',
        }]}
      />,
    )

    // Known code → human headline shown directly (no "Details" needed)
    expect(screen.getByText(/Moved 1 factor outside your control/)).toBeInTheDocument()
  })
})
