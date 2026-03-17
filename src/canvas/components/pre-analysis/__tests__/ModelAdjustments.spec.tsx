import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ModelAdjustments } from '../ModelAdjustments'

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
