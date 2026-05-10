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
import { isValidConfidenceProvenance } from '../useResultsSectionData'
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

  // Guard-level forward-compat assertions. Locks down the raw → DriverItem
  // mapping path: when PLoT extends the metadata vocabulary, the guard must
  // still accept the payload so `confidenceProvenance` lands on the DriverItem
  // and the column-header marker stays visible.
  describe('isValidConfidenceProvenance guard (raw payload)', () => {
    it('accepts the current plot_unified_v2 payload shape', () => {
      expect(isValidConfidenceProvenance({
        computation_source: 'plot_unified_from_isl_bootstrap',
        formula_version: 'plot_unified_v2',
        is_provisional: true,
        calibration_status: 'provisional_pending_pilot_calibration',
        input_quality: 'standard',
      })).toBe(true)
    })

    it('accepts a future plot_unified_v3 payload with extended status / input_quality strings', () => {
      // Hypothetical post-Jinghui-calibration payload — the guard MUST accept
      // it so `is_provisional` survives. Without this, the audit A1-PRIMARY
      // fix silently regresses on the next PLoT bump.
      expect(isValidConfidenceProvenance({
        computation_source: 'plot_unified_from_graph',
        formula_version: 'plot_unified_v3',
        is_provisional: true,
        calibration_status: 'partially_calibrated_pilot_2026q4',
        input_quality: 'bootstrap_resampled',
      })).toBe(true)
    })

    it('rejects malformed payloads (defence in depth)', () => {
      expect(isValidConfidenceProvenance(null)).toBe(false)
      expect(isValidConfidenceProvenance(undefined)).toBe(false)
      expect(isValidConfidenceProvenance('not-an-object')).toBe(false)
      // Wrong computation_source value
      expect(isValidConfidenceProvenance({
        computation_source: 'isl', // legacy value — must be rejected
        formula_version: 'plot_unified_v2',
        is_provisional: true,
        calibration_status: 'provisional_pending_pilot_calibration',
        input_quality: 'standard',
      })).toBe(false)
      // Non-matching formula_version family
      expect(isValidConfidenceProvenance({
        computation_source: 'plot_unified_from_graph',
        formula_version: 'unrelated_formula_v1',
        is_provisional: true,
        calibration_status: 'provisional_pending_pilot_calibration',
        input_quality: 'standard',
      })).toBe(false)
      // is_provisional non-boolean
      expect(isValidConfidenceProvenance({
        computation_source: 'plot_unified_from_graph',
        formula_version: 'plot_unified_v2',
        is_provisional: 'true', // string — must be rejected
        calibration_status: 'provisional_pending_pilot_calibration',
        input_quality: 'standard',
      })).toBe(false)
    })
  })

  it('forward-compat: marker still renders when PLoT bumps formulaVersion / calibrationStatus / inputQuality', () => {
    // Locks down behaviour for when PLoT bumps to plot_unified_v3 (Jinghui
    // calibration) or extends calibration / input-quality vocabularies. The
    // is_provisional disclosure must continue to drive the marker even when
    // the surrounding metadata vocabulary has evolved beyond what this UI
    // version knows about. Without this guarantee, deploying the UI ahead of
    // PLoT silently regresses the audit A1-PRIMARY fix.
    const data = makeDriversData([
      makeDriver({
        factorKey: 'fac_a',
        factorLabel: 'Factor A',
        confidenceProvenance: {
          computationSource: 'plot_unified_from_isl_bootstrap',
          formulaVersion: 'plot_unified_v3', // hypothetical future bump
          isProvisional: true,
          calibrationStatus: 'partially_calibrated_pilot_2026q4', // hypothetical future state
          inputQuality: 'bootstrap_resampled', // hypothetical future state
        },
      }),
    ])

    render(<DriversSection data={data} goalLabel="test" />)

    expect(screen.getByTestId('drivers-confidence-provisional-marker')).toBeInTheDocument()
  })
})
