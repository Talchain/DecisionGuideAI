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
import {
  isValidConfidenceProvenance,
  isDefaultedConfidenceFromRaw,
  normalizeFactorSensitivity,
} from '../useResultsSectionData'
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
  it('does NOT render the confidence provisional marker (Confidence column hidden, influence-only)', () => {
    const data = makeDriversData([
      makeDriver({
        factorKey: 'fac_a',
        factorLabel: 'Factor A',
        confidenceProvenance: provisionalProvenance(),
      }),
      makeDriver({ factorKey: 'fac_b', factorLabel: 'Factor B', rank: 2 }),
    ])

    render(<DriversSection data={data} goalLabel="test" />)

    // The whole Confidence column (header + marker + tooltip) is hidden under
    // the single-source rule; the provisional disclosure returns with the column
    // when a display-safe driver-confidence source exists.
    expect(screen.queryByTestId('drivers-confidence-provisional-marker')).toBeNull()
    expect(screen.queryByTestId('drivers-confidence-header')).toBeNull()
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

    // The Confidence header is hidden (influence-only driver section).
    expect(screen.queryByTestId('drivers-confidence-header')).toBeNull()
  })

  // The confidence column-header INTERACTION tests (aria-label disclosure,
  // hover/focus tooltip copy, legacy copy, ≥44px touch target) were removed:
  // the Confidence header is hidden under the influence-only rule, so there is
  // no header element to interact with. They return with the column when
  // DISPLAY_SAFE_DRIVER_CONFIDENCE is true. The data-layer provenance tests
  // below are unaffected (the data still carries provenance; the UI hides it).

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

  // ----------------------------------------------------------------------
  // Data-layer tests (raw payload normalisation + cross-version compat).
  // Exercise the actual production path:
  //   raw payload → normalizeFactorSensitivity → UiFactorSensitivity → DriverItem
  // rather than only the post-normalised DriverItem props the component tests
  // above use. These pin the behaviour the brief's correction #5 cares about
  // (deploy-order safety) where it actually lives.
  // ----------------------------------------------------------------------

  describe('normalizeFactorSensitivity (raw payload normalisation)', () => {
    const emptyLabelMap = new Map<string, string>()

    it('NEW PLoT payload: carries confidence_provenance through with all fields', () => {
      const raw = {
        node_id: 'fac_a',
        sensitivity_score: 0.6,
        direction: 'positive',
        confidence: 0.75,
        confidence_source: 'plot_unified_from_isl_bootstrap',
        confidence_provenance: {
          computation_source: 'plot_unified_from_isl_bootstrap',
          formula_version: 'plot_unified_v2',
          is_provisional: true,
          calibration_status: 'provisional_pending_pilot_calibration',
          input_quality: 'standard',
        },
        confidence_components: { structural_certainty: 0.5, sampling_stability: 1.0 },
      }

      const ui = normalizeFactorSensitivity(raw, emptyLabelMap)

      expect(ui.confidenceSource).toBe('plot_unified_from_isl_bootstrap')
      expect(ui.confidenceProvenance).toEqual({
        computationSource: 'plot_unified_from_isl_bootstrap',
        formulaVersion: 'plot_unified_v2',
        isProvisional: true,
        calibrationStatus: 'provisional_pending_pilot_calibration',
        inputQuality: 'standard',
      })
    })

    it('OLD PLoT payload (deploy-order safety): no confidence_provenance, legacy confidence_source = "isl"', () => {
      // Simulates a NEW UI receiving a CACHED response from an old PLoT.
      // Brief correction #5: the UI must render gracefully without the marker.
      const raw = {
        node_id: 'fac_a',
        sensitivity_score: 0.6,
        direction: 'positive',
        confidence: 0.75,
        confidence_source: 'isl', // legacy value — must pass through as-is
        // no confidence_provenance field
      }

      const ui = normalizeFactorSensitivity(raw, emptyLabelMap)

      expect(ui.confidenceSource).toBe('isl')
      // Provenance must be undefined — graceful degradation; no marker.
      expect(ui.confidenceProvenance).toBeUndefined()
    })

    it('rejects malformed confidence_provenance and degrades to undefined (no UI crash)', () => {
      const raw = {
        node_id: 'fac_a',
        sensitivity_score: 0.6,
        direction: 'positive',
        confidence: 0.5,
        confidence_source: 'plot_unified_from_graph',
        // Malformed provenance — formula_version is wrong family
        confidence_provenance: {
          computation_source: 'plot_unified_from_graph',
          formula_version: 'unrelated_v99',
          is_provisional: true,
          calibration_status: 'provisional_pending_pilot_calibration',
          input_quality: 'standard',
        },
      }

      const ui = normalizeFactorSensitivity(raw, emptyLabelMap)

      // Source flows through untouched, but the malformed provenance is dropped.
      expect(ui.confidenceSource).toBe('plot_unified_from_graph')
      expect(ui.confidenceProvenance).toBeUndefined()
    })
  })

  describe('isDefaultedConfidenceFromRaw (cross-version compat)', () => {
    // Brief correction #6: the boolean tracks ISL-side bootstrap degeneracy
    // (sampling_stability === 0). It must accept BOTH legacy and new honest
    // source values so the existing "default estimate pill" feature survives
    // both deploy directions. Audit A1-PRIMARY.

    it('returns true for legacy "isl" source with samplingStability === 0', () => {
      expect(isDefaultedConfidenceFromRaw({ confidenceSource: 'isl', samplingStability: 0 })).toBe(true)
    })

    it('returns true for legacy "isl_default" source with samplingStability === 0', () => {
      expect(isDefaultedConfidenceFromRaw({ confidenceSource: 'isl_default', samplingStability: 0 })).toBe(true)
    })

    it('returns true for new honest "plot_unified_from_isl_bootstrap" with samplingStability === 0', () => {
      // The deploy-order critical path: NEW UI receiving NEW PLoT payload.
      // Without accepting the new value, the existing default-estimate pill
      // would disappear after the PLoT side of the audit fix lands.
      expect(isDefaultedConfidenceFromRaw({
        confidenceSource: 'plot_unified_from_isl_bootstrap',
        samplingStability: 0,
      })).toBe(true)
    })

    it('returns false when samplingStability is null (graph-sourced, intentional)', () => {
      expect(isDefaultedConfidenceFromRaw({
        confidenceSource: 'plot_unified_from_isl_bootstrap',
        samplingStability: null,
      })).toBe(false)
    })

    it('returns false when samplingStability is non-zero (real bootstrap data)', () => {
      expect(isDefaultedConfidenceFromRaw({
        confidenceSource: 'plot_unified_from_isl_bootstrap',
        samplingStability: 0.5,
      })).toBe(false)
    })

    it('returns false for graph-only source even when samplingStability would otherwise match', () => {
      // Graph-side values were never "ISL placeholders" — they should not
      // trigger the default-estimate pill regardless of samplingStability.
      expect(isDefaultedConfidenceFromRaw({
        confidenceSource: 'plot_unified_from_graph',
        samplingStability: 0,
      })).toBe(false)
      expect(isDefaultedConfidenceFromRaw({
        confidenceSource: 'graph', // legacy graph value
        samplingStability: 0,
      })).toBe(false)
    })

    it('returns false when source is missing (defensive)', () => {
      expect(isDefaultedConfidenceFromRaw({ samplingStability: 0 })).toBe(false)
    })
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

  it('forward-compat: even with future provenance, the marker stays hidden (Confidence column hidden)', () => {
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

    expect(screen.queryByTestId('drivers-confidence-provisional-marker')).toBeNull()
  })
})
