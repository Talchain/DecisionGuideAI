/**
 * ModelCardLite — component tests.
 * Phase 2A: Model Card Lite.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ModelCardLite } from '../ModelCardLite'
import type { ModelCardData } from '../../adapters/modelCardAdapter'

// Mock posthog
vi.mock('../../../lib/posthog', () => ({
  trackEvent: vi.fn(),
}))

const baseData: ModelCardData = {
  graphHash: null,
  seed: null,
  qualityMode: null,
  nodeCounts: { factor: 3, option: 2, goal: 1, decision: 0, risk: 0, outcome: 0 },
  edgeCount: 5,
  confidenceLabel: null,
  repairsApplied: [],
  hasResults: false,
}

describe('ModelCardLite', () => {
  it('renders pre-analysis state with pending placeholders', () => {
    render(<ModelCardLite data={baseData} />)

    expect(screen.getByText('Model card')).toBeInTheDocument()
    expect(screen.getByText('Unavailable')).toBeInTheDocument() // No graph hash
    expect(screen.getAllByText('Pending analysis').length).toBeGreaterThanOrEqual(2) // seed, quality, confidence
    expect(screen.getByText('3 factors, 2 options, 1 goal')).toBeInTheDocument()
    expect(screen.getByText('5 relationships')).toBeInTheDocument()
    expect(screen.getByText('Linear (PoC)')).toBeInTheDocument()
  })

  it('renders post-analysis state with populated fields', () => {
    render(
      <ModelCardLite
        data={{
          ...baseData,
          graphHash: 'abcdef1234567890',
          seed: 42,
          qualityMode: 'deep',
          confidenceLabel: 'Robust',
          hasResults: true,
          repairsApplied: [
            { label: 'Strength of relationship', action: 'Floored', before: '0', after: '0.01' },
          ],
        }}
      />,
    )

    // Graph hash truncated to 8 chars
    expect(screen.getByText('abcdef12')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('Detailed')).toBeInTheDocument()
    expect(screen.getByText('Robust')).toBeInTheDocument()
    expect(screen.getByText('1 adjustment applied')).toBeInTheDocument()
  })

  it('truncates graph hash to 8 characters', () => {
    render(
      <ModelCardLite
        data={{ ...baseData, graphHash: 'abcdef1234567890extra' }}
      />,
    )
    expect(screen.getByText('abcdef12')).toBeInTheDocument()
  })

  it('shows "Unavailable" when graphHash is null (never computed from nodes/edges)', () => {
    render(<ModelCardLite data={{ ...baseData, graphHash: null }} />)
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
  })

  it('renders adjustments collapsed by default, expandable', () => {
    render(
      <ModelCardLite
        data={{
          ...baseData,
          repairsApplied: [
            { label: 'Strength', action: 'Floored' },
            { label: 'Baseline', action: 'Defaulted' },
          ],
        }}
      />,
    )

    const expandBtn = screen.getByText('2 adjustments applied')
    expect(expandBtn).toBeInTheDocument()
    expect(expandBtn).toHaveAttribute('aria-expanded', 'false')

    // Details container hidden initially via aria-hidden
    const detailsContainer = document.getElementById('model-card-adjustments')
    expect(detailsContainer).toHaveAttribute('aria-hidden', 'true')

    // Expand
    fireEvent.click(expandBtn)
    expect(expandBtn).toHaveAttribute('aria-expanded', 'true')
    expect(detailsContainer).toHaveAttribute('aria-hidden', 'false')
    expect(screen.getByText('Floored')).toBeInTheDocument()
    expect(screen.getByText('Defaulted')).toBeInTheDocument()
  })

  it('shows confidence pill with colour indication AND text label', () => {
    render(
      <ModelCardLite data={{ ...baseData, confidenceLabel: 'Fragile', hasResults: true }} />,
    )
    const pill = screen.getByText('Fragile')
    expect(pill).toBeInTheDocument()
    // Has text content (not colour-only)
    expect(pill.textContent).toBe('Fragile')
  })

  it('renders copy button with correct aria-label', () => {
    render(
      <ModelCardLite data={{ ...baseData, graphHash: 'abc12345' }} />,
    )
    expect(screen.getByLabelText('Copy graph hash')).toBeInTheDocument()
  })
})
