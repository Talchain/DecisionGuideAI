/**
 * useResultsSectionData — auto-noise provenance integration (audit B3, P0).
 *
 * Drives the data hook through the canvas store the same way production
 * does: a real PLoT V3 response lands on `rawV2Response`, the hook reads
 * it and surfaces `autoNoiseProvenance` to consumers. This proves the
 * store→hook→component data path the unit-level DCP test cannot.
 *
 * Audit-feedback P1-5.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResultsSectionData } from '../useResultsSectionData'
import { useCanvasStore } from '../../../canvas/store'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'

const PLOT_V3_BASE = {
  status: 'complete',
  progress: 100,
  report: {
    run: { critique: [] },
    robustness: { fragile_edges: [] },
    option_comparison: [],
  },
} as const

/**
 * Typed setStore — `rawV2Response` is `Partial<V2RunResponse>` rather
 * than `Record<string, unknown>` so the tests exercise the typed contract
 * instead of an untyped record. The cast on the full setState call
 * remains because the canvas store has many required fields the hook
 * does not consume; that pattern matches the rest of the suite (see
 * `useResultsSectionData.spec.ts`).
 */
function setStore(rawV2Response: Partial<V2RunResponse> | null): void {
  useCanvasStore.setState({
    results: { ...PLOT_V3_BASE } as any,
    runMeta: {} as any,
    nodes: [],
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: rawV2Response as V2RunResponse | null,
  } as any)
}

const validProvenance: NonNullable<V2RunResponse['auto_noise_provenance']> = {
  applied: true,
  effect: 'widens_outcome_and_risk_uncertainty',
  formula_version: 'plot_auto_v1',
  multiplier: 1.0,
  noise_distribution: 'normal_zero_mean_outcome_std',
  filter_scope: 'outcome_and_risk_nodes',
  is_provisional: true,
  calibration_status: 'provisional_pending_pilot_calibration',
}

describe('useResultsSectionData — autoNoiseProvenance integration (audit B3)', () => {
  beforeEach(() => {
    setStore(null)
  })

  it('surfaces normalised camelCase provenance from rawV2Response.auto_noise_provenance', () => {
    setStore({
      analysis_status: 'computed',
      auto_noise_applied: true,
      auto_noise_provenance: validProvenance,
    })

    const { result } = renderHook(() => useResultsSectionData())

    expect(result.current.autoNoiseProvenance).toEqual({
      applied: true,
      effect: 'widens_outcome_and_risk_uncertainty',
      formulaVersion: 'plot_auto_v1',
      multiplier: 1.0,
      noiseDistribution: 'normal_zero_mean_outcome_std',
      filterScope: 'outcome_and_risk_nodes',
      isProvisional: true,
      calibrationStatus: 'provisional_pending_pilot_calibration',
    })
  })

  it('returns null when rawV2Response itself is null (no run yet)', () => {
    setStore(null)
    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.autoNoiseProvenance).toBeNull()
  })

  it('returns null when the response predates B3 (no auto_noise_provenance field)', () => {
    setStore({
      analysis_status: 'computed',
      // Old PLoT build, B3 disclosure not wired through.
    })
    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.autoNoiseProvenance).toBeNull()
  })

  it('returns null when the response carries a malformed provenance payload', () => {
    // The cast is deliberate: the typed contract forbids partial
    // provenance, but the runtime contract must defend against
    // server-side drift / cached payloads. Asserting the normaliser
    // rejects the malformed shape requires constructing one.
    setStore({
      analysis_status: 'computed',
      auto_noise_provenance: {
        applied: true,
        // Missing every other required field.
      } as NonNullable<V2RunResponse['auto_noise_provenance']>,
    })
    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.autoNoiseProvenance).toBeNull()
  })

  it('preserves applied:false provenance with full metadata (calibration disclosure on no-fire)', () => {
    setStore({
      analysis_status: 'computed',
      auto_noise_applied: false,
      auto_noise_provenance: { ...validProvenance, applied: false },
    })
    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.autoNoiseProvenance?.applied).toBe(false)
    // Full formula metadata intact even on applied:false.
    expect(result.current.autoNoiseProvenance?.formulaVersion).toBe('plot_auto_v1')
    expect(result.current.autoNoiseProvenance?.calibrationStatus).toBe('provisional_pending_pilot_calibration')
  })
})
