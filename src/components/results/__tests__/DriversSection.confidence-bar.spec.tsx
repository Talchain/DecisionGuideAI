/**
 * DriversSection — Confidence column HIDDEN (single-source rule).
 *
 * The driver section communicates INFLUENCE only. There is no display-safe
 * driver-confidence source today (ROBUSTNESS-VERDICT-CONTRACT), so the
 * Confidence column — bar, % readout, dash placeholder, and High/Moderate/Low
 * glyph — must NOT render for ANY confidence value (no raw/defaulted confidence,
 * no dashes). This previously asserted the confidence bar rendered at 0/0.5/1.0;
 * it now guards that the column stays hidden and the influence-only pill renders.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DriversSection } from '../DriversSection'
import type { DriversSectionData, DriverItem } from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
}))

function makeDriver(overrides: Partial<DriverItem> & { factorKey: string }): DriverItem {
  return {
    factorLabel: overrides.factorKey,
    rawElasticity: 0.5,
    normalisedInfluence: 0.5,
    influenceScore: 0.5,
    rank: 1,
    semanticLabel: 'biggest',
    canFocus: false,
    direction: 'positive',
    ...overrides,
  }
}

function makeDriversData(drivers: DriverItem[]): DriversSectionData {
  return {
    drivers,
    topDrivers: drivers.slice(0, 3),
    driversStatus: 'computed',
    totalCount: drivers.length,
    hasMagnitudeData: true,
  }
}

describe('DriversSection — Confidence column hidden (single-source rule)', () => {
  it.each([0.0, 0.5, 0.6, 1.0])(
    'does not render a confidence bar/readout for confidence %s',
    (confidence) => {
      const data = makeDriversData([
        makeDriver({ factorKey: 'fac', factorLabel: 'Driver A', confidence }),
      ])
      render(<DriversSection data={data} goalLabel="test" />)
      // The confidence progressbar (aria-label "... confidence: N%") must not exist.
      expect(
        screen.queryByRole('progressbar', { name: /confidence:/i }),
      ).not.toBeInTheDocument()
      // No confidence glyph either.
      expect(screen.queryByTestId('confidence-glyph-fac')).not.toBeInTheDocument()
    },
  )

  it('renders NO dash placeholder when confidence is missing (no dashes, single-source rule)', () => {
    const data = makeDriversData([
      makeDriver({ factorKey: 'fac_none', factorLabel: 'No estimate' }), // confidence undefined
    ])
    render(<DriversSection data={data} goalLabel="test" />)
    expect(screen.queryByRole('progressbar', { name: /confidence:/i })).not.toBeInTheDocument()
    // Sensitivity is present (influenceScore 0.5), so no dash placeholder should appear at all.
    expect(screen.queryByText('-')).not.toBeInTheDocument()
  })

  it('renders NO "High/Moderate/Low confidence" glyph or default-estimate icon', () => {
    const data = makeDriversData([
      makeDriver({ factorKey: 'fac_full', factorLabel: 'Full', confidence: 1.0, isDefaultedConfidence: true }),
    ])
    render(<DriversSection data={data} goalLabel="test" />)
    expect(screen.queryByTestId('confidence-glyph-fac_full')).not.toBeInTheDocument()
    expect(screen.queryByTestId('default-estimate-icon')).not.toBeInTheDocument()
    expect(screen.queryByTitle(/confidence/i)).not.toBeInTheDocument()
  })

  it('renders the INFLUENCE-only pill instead of any stability/evidence claim', () => {
    const data = makeDriversData([
      makeDriver({ factorKey: 'fac', factorLabel: 'Driver A', confidence: 0.9, semanticLabel: 'biggest' }),
    ])
    render(<DriversSection data={data} goalLabel="test" />)
    expect(screen.getByTestId('driver-influence-pill-fac')).toHaveTextContent('Top driver')
    expect(screen.queryByText('Important and stable')).not.toBeInTheDocument()
    expect(screen.queryByText('High impact, low evidence')).not.toBeInTheDocument()
  })

  it('does not render any 4-dot indicator (no bg-text-body w-2 h-2 spans)', () => {
    const data = makeDriversData([
      makeDriver({ factorKey: 'fac_full', factorLabel: 'Full', confidence: 1.0 }),
    ])
    const { container } = render(<DriversSection data={data} goalLabel="test" />)
    const dotCandidates = container.querySelectorAll('span.w-2.h-2.rounded-full.bg-text-body')
    expect(dotCandidates.length).toBe(0)
  })
})
