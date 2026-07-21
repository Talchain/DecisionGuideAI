/**
 * useResultsSectionData — Seam-A (live conversational) enrichment lift
 * (ROADMAP 1.6b, claim-integrity, shared-seam UI lane).
 *
 * Builds the store exactly as the live path does: `mapV5AnalysisToReport`
 * produces `report`, and `rawV2Response` is explicitly `null` (see
 * applyV5State.ts:617-627 — "V5 carries no V2 envelope; pass null so the
 * canvas store's V2-shaped enrichment / rawV2Response slots are explicitly
 * cleared"). Before this lane, `display_verdict`, `display_verdict_reason`,
 * `confidence_tier`, and the per-option `goal_fit_basis` caveat never
 * reached this render path even though CEE's keep-list carries them —
 * the mapper simply never read them. UI-BOUNDARY-DATA-INVENTORY.md §4.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { AnalysisResultBlock } from '@talchain/schemas/boundary'

import { useResultsSectionData } from '../useResultsSectionData'
import { useCanvasStore } from '../../../canvas/store'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'

// UI-SEM-088 seam 1. On the live V5 path a joint-goal figure arrives with no
// per-option constraint_analysis marker, so selectGoalProbability reads
// PLOT_JOINT_HEADLINE_SUSPECT. `suspect` drives that flag; the mock also exports
// the seam-2 constant (whole-module replacement) fixed to its current default.
const mockTrust = vi.hoisted(() => ({ suspect: true }))
vi.mock('../../../adapters/plot/constraintTrust', () => ({
  get PLOT_JOINT_HEADLINE_SUSPECT() {
    return mockTrust.suspect
  },
  PLOT_PER_OPTION_CONSTRAINTS_SUSPECT: true,
}))

const OPTION_NODES = [
  { id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Option A' } },
  { id: 'opt_b', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Option B' } },
]

function setStoreFromLiveSeamABlock(block: AnalysisResultBlock): void {
  const report = mapV5AnalysisToReport(block, { seed: 42 })
  useCanvasStore.setState({
    results: { status: 'complete', progress: 100, report } as any,
    runMeta: {} as any,
    nodes: OPTION_NODES as any,
    edges: [],
    hasCompletedFirstRun: true,
    // Matches applyV5State.ts:617-627 exactly — the live path always nulls
    // rawV2Response, so any render-path assertion here is proof the Seam-A
    // mapped report ALONE carries the field, not a raw-response fallback.
    rawV2Response: null,
  } as any)
}

describe('useResultsSectionData — Seam-A live fixture carrying the 4 lifted fields', () => {
  beforeEach(() => {
    mockTrust.suspect = true
    useCanvasStore.setState({
      results: null,
      rawV2Response: null,
      nodes: [],
      edges: [],
      hasCompletedFirstRun: false,
    } as any)
  })

  it('display_verdict + display_verdict_reason render verbatim from a live Seam-A turn', () => {
    setStoreFromLiveSeamABlock({
      type: 'analysis_result',
      summary: 'Option A leads',
      leading_option_id: 'opt_a',
      win_probabilities: { opt_a: 0.6, opt_b: 0.4 },
      enrichment: {
        robustness: {
          fragile_edges: [],
          robust_edges: ['e1'],
          display_verdict: 'robust',
          display_verdict_reason: 'No edge flips the winner within the tested range.',
        },
      },
    } as unknown as AnalysisResultBlock)

    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.recommendation?.robustnessVerdict).toBe('robust')
    expect(result.current.recommendation?.robustnessVerdictReason).toBe(
      'No edge flips the winner within the tested range.',
    )
  })

  it('confidence_tier renders as the producer-classified tier, not the legacy cascade', () => {
    setStoreFromLiveSeamABlock({
      type: 'analysis_result',
      summary: 'Option A leads',
      leading_option_id: 'opt_a',
      win_probabilities: { opt_a: 1 },
      enrichment: { confidence_tier: 'fair' },
    } as unknown as AnalysisResultBlock)

    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.confidence.tier.tier).toBe('fair')
  })

  const JOINT_CAVEAT_BLOCK = {
    type: 'analysis_result',
    summary: 'Option A leads',
    leading_option_id: 'opt_a',
    win_probabilities: { opt_a: 0.6, opt_b: 0.4 },
    enrichment: {
      option_comparison: [
        {
          option_id: 'opt_a',
          win_probability: 0.6,
          probability_of_joint_goal: 0.42,
          goal_fit_basis: {
            scored_from: 'modelled_outcome_distribution',
            node_ids: ['node_budget'],
          },
        },
        {
          // No goal_fit_basis at all — must not acquire a fabricated caveat.
          option_id: 'opt_b',
          win_probability: 0.4,
          probability_of_goal: 0.55,
        },
      ],
    },
  } as unknown as AnalysisResultBlock

  it('gate ON: suppresses the joint-only goal figure (and its caveat) while the constraint numbers are suspect', () => {
    mockTrust.suspect = true
    setStoreFromLiveSeamABlock(JOINT_CAVEAT_BLOCK)

    const { result } = renderHook(() => useResultsSectionData())
    const byId = new Map(
      (result.current.recommendation?.allOptions ?? []).map((o) => [o.id, o]),
    )
    // opt_a carries only the suspect joint figure → suppressed → null, and with
    // no number shown the modelled-basis caveat cannot render.
    expect(byId.get('opt_a')?.goalProbability).toBeNull()
    expect(byId.get('opt_a')?.goalFitIsModelledBasis).toBe(false)
    // opt_b's unconstrained goal_probability is untouched by the gate.
    expect(byId.get('opt_b')?.goalProbability).toBe(0.55)
    expect(byId.get('opt_b')?.goalFitIsModelledBasis).toBe(false)
  })

  it('POSITIVE CONTROL (gate OFF): goal_fit_basis caveat flag is true ONLY for the option whose displayed number is the modelled joint-goal figure', () => {
    mockTrust.suspect = false
    setStoreFromLiveSeamABlock(JOINT_CAVEAT_BLOCK)

    const { result } = renderHook(() => useResultsSectionData())
    const byId = new Map(
      (result.current.recommendation?.allOptions ?? []).map((o) => [o.id, o]),
    )
    expect(byId.get('opt_a')?.goalProbability).toBe(0.42)
    expect(byId.get('opt_a')?.goalFitIsModelledBasis).toBe(true)
    expect(byId.get('opt_b')?.goalProbability).toBe(0.55)
    expect(byId.get('opt_b')?.goalFitIsModelledBasis).toBe(false)
  })

  it('a live Seam-A turn WITHOUT the four fields renders honest absence — no invention, no crash', () => {
    setStoreFromLiveSeamABlock({
      type: 'analysis_result',
      summary: 'Option A leads',
      leading_option_id: 'opt_a',
      win_probabilities: { opt_a: 0.5, opt_b: 0.5 },
      enrichment: {
        robustness: { fragile_edges: [], robust_edges: [] },
        option_comparison: [
          { option_id: 'opt_a', win_probability: 0.5, probability_of_goal: 0.3 },
          { option_id: 'opt_b', win_probability: 0.5 },
        ],
      },
    } as unknown as AnalysisResultBlock)

    const { result } = renderHook(() => useResultsSectionData())
    // display_verdict absent → honest "Robustness unknown" state, not upgraded.
    expect(result.current.recommendation?.robustnessVerdict).toBeUndefined()
    // confidence_tier absent → falls to the legacy cascade (not 'strong'/'fair'/'needs_work'
    // fabricated from nothing); the hook must not throw.
    expect(['strong', 'fair', 'needs_work', 'unknown']).toContain(result.current.confidence.tier.tier)
    const byId = new Map(
      (result.current.recommendation?.allOptions ?? []).map((o) => [o.id, o]),
    )
    expect(byId.get('opt_a')?.goalFitIsModelledBasis).toBe(false)
  })
})
