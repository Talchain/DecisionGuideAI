/**
 * Phase 2.3 — InsightsPanel null-probability guard.
 *
 * The fallback DEFAULT_SUMMARY must not read as "Analysis complete" when
 * the store's results.report contains no finite win_probability. This is
 * the BoundaryError contract for the primary takeaway surface.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InsightsPanel } from '../InsightsPanel'
import { useCanvasStore } from '../../store'

function setReport(report: Record<string, unknown> | null) {
  useCanvasStore.setState({
    results: {
      ...useCanvasStore.getState().results,
      status: 'complete',
      report,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  })
}

describe('InsightsPanel null-probability guard', () => {
  beforeEach(() => {
    setReport(null)
  })

  afterEach(() => {
    setReport(null)
  })

  it('falls back to "Analysis complete" default when probabilities are present', () => {
    setReport({
      option_comparison: [
        { option_id: 'a', win_probability: 0.7 },
      ],
    })
    render(<InsightsPanel insights={null} />)
    expect(screen.getByText(/Analysis complete/)).toBeInTheDocument()
  })

  it('renders the null-probability fallback when all options have null win_probability', () => {
    setReport({
      option_comparison: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { option_id: 'a', win_probability: null as any },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { option_id: 'b', win_probability: null as any },
      ],
    })
    render(<InsightsPanel insights={null} />)
    // The BoundaryError contract: text must not imply a successful analysis.
    expect(screen.queryByText(/Analysis complete\./)).toBeNull()
    expect(
      screen.getByText(/Analysis finished, but no probability was computed/),
    ).toBeInTheDocument()
  })

  it('prefers engine-supplied summary over the fallback, regardless of probability state', () => {
    setReport({
      option_comparison: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { option_id: 'a', win_probability: null as any },
      ],
    })
    render(<InsightsPanel insights={{ summary: 'Custom engine summary.' }} />)
    expect(screen.getByText(/Custom engine summary/)).toBeInTheDocument()
    expect(screen.queryByText(/Analysis finished, but no probability/)).toBeNull()
  })
})
