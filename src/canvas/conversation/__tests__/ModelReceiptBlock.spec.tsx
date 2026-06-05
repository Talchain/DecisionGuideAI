/**
 * ModelReceiptBlock — component tests.
 *
 * F1 PR B: the card now leads with action ("Check this before analysis") and the
 * CEE coaching as main content; model statistics are demoted into a collapsed
 * "Model details" disclosure. These tests assert that action-oriented hierarchy
 * (they previously asserted the old stats-led "Model generated" layout — updated
 * deliberately because that layout was the weak UX this PR replaces).
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ModelReceiptBlock } from '../ModelReceiptBlock'
import type { ModelReceiptData } from '../../adapters/modelCardAdapter'
import { findBannedTerm } from '../../../components/results/analysisHeroV17/glossaryCheck'

const fullData: ModelReceiptData = {
  factorCount: 5,
  edgeCount: 8,
  optionCount: 2,
  goalLabel: 'Revenue growth',
  coachingSummary: 'One assumption worth checking: assess team expertise first.',
  topInsight: 'Missing time horizon may affect accuracy.',
  topEvidenceGap: 'Marketing spend: no observed data',
  readiness: 'ready',
  adjustments: [
    { label: 'Strength of relationship', action: 'Floored', before: '0', after: '0.01' },
    { label: 'Baseline of node', action: 'Defaulted' },
  ],
}

describe('ModelReceiptBlock', () => {
  it('leads with the action headline and the CEE coaching as main content', () => {
    render(<ModelReceiptBlock data={fullData} />)

    expect(screen.getByText('Check this before analysis')).toBeInTheDocument()
    // CEE coaching rendered verbatim as the primary content.
    expect(screen.getByText(fullData.coachingSummary!)).toBeInTheDocument()
    // Static neutral next-step nudge.
    expect(screen.getByText('Review or strengthen this before running analysis.')).toBeInTheDocument()
    // The old stats-led header is gone.
    expect(screen.queryByText('Model generated')).not.toBeInTheDocument()
  })

  it('keeps model counts out of the primary view until "Model details" is expanded', () => {
    render(<ModelReceiptBlock data={fullData} />)

    // Counts are NOT in the primary visual path.
    expect(screen.queryByText(/5 factors/)).not.toBeInTheDocument()
    expect(screen.queryByText(/8 relationships/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Model details'))

    expect(screen.getByText(/5 factors/)).toBeInTheDocument()
    expect(screen.getByText(/8 relationships/)).toBeInTheDocument()
    expect(screen.getByText(/2 options/)).toBeInTheDocument()
    expect(screen.getByText(/Revenue growth/)).toBeInTheDocument()
    // Neutral readiness label (no colour-as-verdict pill).
    expect(screen.getByText(/Ready to run/)).toBeInTheDocument()
  })

  it('renders the headline and nudge even when there is no coaching (defensive)', () => {
    render(<ModelReceiptBlock data={{ ...fullData, coachingSummary: null }} />)

    expect(screen.getByText('Check this before analysis')).toBeInTheDocument()
    expect(screen.getByText('Review or strengthen this before running analysis.')).toBeInTheDocument()
    expect(screen.queryByText(fullData.coachingSummary!)).not.toBeInTheDocument()
  })

  it('renders adjustments collapsed by default and expands on click', () => {
    render(<ModelReceiptBlock data={fullData} />)

    expect(screen.getByText(/Olumi made 2 adjustments to keep the model valid/)).toBeInTheDocument()
    expect(screen.queryByText('Floored')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText(/Olumi made 2 adjustments/))

    expect(screen.getByText('Floored')).toBeInTheDocument()
    expect(screen.getByText('Defaulted')).toBeInTheDocument()
  })

  it('shows neutral readiness labels inside "Model details"', () => {
    const { rerender } = render(
      <ModelReceiptBlock data={{ ...fullData, readiness: 'blocked' }} />,
    )
    fireEvent.click(screen.getByText('Model details'))
    expect(screen.getByText(/Needs attention/)).toBeInTheDocument()

    // rerender keeps the disclosure expanded; only the label changes.
    rerender(<ModelReceiptBlock data={{ ...fullData, readiness: 'incomplete' }} />)
    expect(screen.getByText(/Needs review/)).toBeInTheDocument()
  })

  it('contains no banned glossary terms in DGAI static copy', () => {
    const { container } = render(<ModelReceiptBlock data={fullData} />)
    // Scan the DGAI-authored copy (headline, nudge, Model details). The CEE
    // coaching is owned by CEE and intentionally exempt — strip it first.
    fireEvent.click(screen.getByText('Model details'))
    const dgaiCopy = (container.textContent ?? '').replace(fullData.coachingSummary ?? '', '')
    expect(findBannedTerm(dgaiCopy)).toBeNull()
  })

  it('does not render IDs, hashes, _meta, or coaching_state', () => {
    const { container } = render(<ModelReceiptBlock data={fullData} />)
    // Expand every disclosure so all rendered text is scanned.
    fireEvent.click(screen.getByText('Model details'))
    fireEvent.click(screen.getByText(/Olumi made 2 adjustments/))
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i) // uuid
    expect(text).not.toMatch(/\b[a-f0-9]{12,}\b/i)                    // long hex hash
    expect(text).not.toMatch(/node_|_id\b|_meta|coaching_state|coaching_lifecycle/i)
  })

  it('has an accessible test-id', () => {
    render(<ModelReceiptBlock data={fullData} />)
    expect(screen.getByTestId('model-receipt-block')).toBeInTheDocument()
  })
})
