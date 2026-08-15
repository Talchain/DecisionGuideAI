import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { StickyFooter } from '../StickyFooter'

const baseProps = {
  isReady: true,
  hasBlockers: false,
  blockerCount: 0,
  isAnalysing: false,
  onAnalyse: () => {},
}

// Pre-analysis-power-v1 Task 5 — the "N/M addressed" counter and its
// source-distribution tooltip have been removed from the sticky footer.
// The top priority-progress counter (T1ContributionRow) is now the single
// source of truth for confirmation progress. This file's prior addressed
// tests have been replaced by the regression guards below.

describe('StickyFooter — addressed counter is gone (pre-analysis-power-v1 Task 5)', () => {
  it('does not render any "N/M addressed" or "All addressed" copy', () => {
    render(<StickyFooter {...baseProps} />)
    expect(screen.queryByText(/\d+\/\d+ addressed/)).not.toBeInTheDocument()
    expect(screen.queryByText(/All addressed/i)).not.toBeInTheDocument()
  })

  it('keeps the Ready status pill and the Analyse now CTA', () => {
    render(<StickyFooter {...baseProps} isReady />)
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /analyse now/i })).toBeInTheDocument()
  })

  it('shows "Results will be provisional" beneath the CTA when not ready (no hard blockers)', () => {
    render(<StickyFooter {...baseProps} isReady={false} />)
    expect(screen.getByText(/Results will be provisional/i)).toBeInTheDocument()
  })

  it('omits the provisional meta when the panel is ready', () => {
    render(<StickyFooter {...baseProps} isReady />)
    expect(screen.queryByText(/Results will be provisional/i)).not.toBeInTheDocument()
  })

  it('does not render the legacy "Quality:" or "Data confidence:" labels', () => {
    render(<StickyFooter {...baseProps} />)
    expect(screen.queryByText(/Quality:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Data confidence:/)).not.toBeInTheDocument()
  })
})

describe('StickyFooter — CTA titles (Brief 5.8A D6 — unchanged)', () => {
  it('uses a provisional-results title on the Analyse anyway CTA when calibration is incomplete', () => {
    render(
      <StickyFooter
        {...baseProps}
        isReady={false}
        hasBlockers={false}
        blockedReason="Select a goal node before running analysis"
      />,
    )
    const button = screen.getByRole('button', { name: /analyse anyway/i })
    expect(button).toHaveAttribute('title', 'Run anyway with provisional results — calibration is incomplete')
    expect(button).not.toBeDisabled()
  })

  it('falls back to the supplied blockedReason title when hard blockers disable the CTA', () => {
    render(
      <StickyFooter
        {...baseProps}
        isReady={false}
        hasBlockers
        blockerCount={2}
        blockedReason="Select a goal node before running analysis"
      />,
    )
    const button = screen.getByRole('button', { name: /address issues/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'Select a goal node before running analysis')
  })
})

describe('StickyFooter — canonical Run gate', () => {
  it('renders an endpoint-only refusal and makes the CTA natively disabled and non-focusable', () => {
    const onAnalyse = vi.fn()
    const blockedReason =
      'Demand → Sustainable profit changed elsewhere. Review the latest shared value before running analysis.'
    render(
      <StickyFooter
        {...baseProps}
        canRun={false}
        blockedReason={blockedReason}
        onAnalyse={onAnalyse}
      />,
    )

    expect(screen.getByTestId('pre-analysis-run-blocked-reason')).toHaveTextContent(blockedReason)
    expect(screen.getByText('Analysis paused')).toBeVisible()
    expect(screen.queryByText(/Results will be provisional/i)).not.toBeInTheDocument()
    const button = screen.getByRole('button', { name: `Analysis unavailable: ${blockedReason}` })
    expect(button).toBeDisabled()
    button.focus()
    expect(button).not.toHaveFocus()
    fireEvent.click(button)
    expect(onAnalyse).not.toHaveBeenCalled()
  })
})
