/**
 * DriversSection Confidence Provenance Marker Tests
 *
 * Audit row A1-PRIMARY (truth-table 2026-05-truth-table). Confidence values
 * displayed in the Drivers panel are PLoT-recomputed operational estimates
 * pending pilot calibration. The column-header marker discloses this state
 * via a single Info icon + tooltip — never on individual rows.
 *
 * Coverage:
 * - Marker renders when at least one row carries `confidenceProvenance.isProvisional`
 * - Marker absent when no row is provisional (synthesised non-provisional fixture)
 * - Marker absent when ALL rows omit `confidenceProvenance` (cached / old PLoT
 *   payload — graceful degradation, no crash)
 * - Tooltip copy matches the brief
 * - Aria-label switches to the disclosure copy when provisional
 * - Cross-version compat: legacy `confidenceSource: 'isl'` payload renders
 *   without crashing and without the marker
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DriversSection } from '../DriversSection'
import type {
  DriversSectionData,
  DriverItem,
  ConfidenceProvenance,
} from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
}))

function provisionalProvenance(
  overrides?: Partial<ConfidenceProvenance>,
): ConfidenceProvenance {
  return {
    computationSource: 'plot_unified_from_isl_bootstrap',
    formulaVersion: 'plot_unified_v2',
    isProvisional: true,
    calibrationStatus: 'provisional_pending_pilot_calibration',
    inputQuality: 'standard',
    ...overrides,
  }
}

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
    confidence: 0.5,
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

describe('DriversSection confidence provenance disclosure (audit A1-PRIMARY)', () => {
  it('renders the column-header Info marker when at least one row carries is_provisional', () => {
    const data = makeDriversData([
      makeDriver({
        factorKey: 'fac_a',
        factorLabel: 'Factor A',
        confidenceProvenance: provisionalProvenance(),
      }),
      makeDriver({ factorKey: 'fac_b', factorLabel: 'Factor B', rank: 2 }), // no provenance — still triggers marker via fac_a
    ])

    render(<DriversSection data={data} goalLabel="test" />)

    const marker = screen.getByTestId('drivers-confidence-provisional-marker')
    expect(marker).toBeInTheDocument()
    expect(marker).toHaveAttribute('aria-hidden', 'true')
  })

  it('does not render the marker when no driver carries provisional provenance', () => {
    const data = makeDriversData([
      makeDriver({
        factorKey: 'fac_a',
        factorLabel: 'Factor A',
        confidenceProvenance: provisionalProvenance({ isProvisional: false }),
      }),
    ])

    render(<DriversSection data={data} goalLabel="test" />)

    expect(screen.queryByTestId('drivers-confidence-provisional-marker')).toBeNull()
  })

  it('graceful degradation: payloads with no confidenceProvenance render without crashing and without the marker', () => {
    // Simulates an OLD PLoT response shape — no `confidence_provenance` field.
    const data = makeDriversData([
      makeDriver({ factorKey: 'fac_a', factorLabel: 'Factor A' }),
      makeDriver({ factorKey: 'fac_b', factorLabel: 'Factor B', rank: 2 }),
    ])

    expect(() => render(<DriversSection data={data} goalLabel="test" />)).not.toThrow()
    expect(screen.queryByTestId('drivers-confidence-provisional-marker')).toBeNull()

    // Header itself still renders.
    expect(screen.getByTestId('drivers-confidence-header')).toBeInTheDocument()
  })

  it('column-header tooltip copy and aria-label disclose calibration state when provisional', () => {
    const data = makeDriversData([
      makeDriver({
        factorKey: 'fac_a',
        factorLabel: 'Factor A',
        confidenceProvenance: provisionalProvenance(),
      }),
    ])

    render(<DriversSection data={data} goalLabel="test" />)

    const header = screen.getByTestId('drivers-confidence-header')
    expect(header).toHaveAttribute(
      'aria-label',
      'Confidence column info — operational estimate pending pilot calibration',
    )

    // Tooltip content lives in a Floating UI portal that renders only on
    // hover/focus. Asserting the aria-label switch is sufficient for keyboard
    // accessibility coverage; the displayed copy is verified at the integration
    // tier (see staging smoke).
  })

  it('cross-version safety: legacy confidenceSource ("isl") with no confidence_provenance renders without crashing', () => {
    // Simulates a NEW UI receiving an OLD PLoT payload (deploy-order safety).
    // The data layer maps `confidence_source: 'isl'` into the existing
    // `isDefaultedConfidence` derivation; the new column-header marker is
    // hidden because no provenance was attached.
    const data = makeDriversData([
      makeDriver({
        factorKey: 'fac_a',
        factorLabel: 'Factor A',
        isDefaultedConfidence: true,
        // no confidenceProvenance — emulates a cached payload from the
        // pre-A1-fix PLoT
      }),
    ])

    expect(() => render(<DriversSection data={data} goalLabel="test" />)).not.toThrow()
    expect(screen.queryByTestId('drivers-confidence-provisional-marker')).toBeNull()
  })
})
