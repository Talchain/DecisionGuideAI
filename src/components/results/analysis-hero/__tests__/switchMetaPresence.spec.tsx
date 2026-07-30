/**
 * Hook → buildHeroModel integration pins for the switchMeta presence branch
 * (marginal-quantity honesty batch; adv-review #543 F1).
 *
 * Lives INSIDE analysis-hero/__tests__ because it imports buildHeroModel:
 * the module's inertness guard (inertness.spec.ts) walks the disk and fails
 * on any hero import from outside the module directory — module-internal
 * files are exempt. The map-level pin (no hero import) stays in
 * results/__tests__/switchProbabilityPresence.spec.tsx.
 *
 * Contract (vendored @talchain/schemas 0.30.0): switch_probability ABSENT
 * means NOT COMPUTED; marginal_switch_probability is a DIFFERENT Monte Carlo,
 * never a fallback. The defect was upstream (fragileEdgesMap coalesced the
 * marginal into fragileEdgeInfo.switchProbability, feeding switchProbByNodeId
 * → "NN% switch" + MagnitudeBar on the staging-ON hero); buildHeroModel's own
 * guards degrade honestly once the map is presence-branched.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResultsSectionData } from '../../useResultsSectionData'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { buildHeroModel } from '../buildHeroModel'
import type { HeroChartModel } from '../heroTypes'
import { useCanvasStore } from '../../../../canvas/store'

function seedReportForHero(fragileEdges: Array<Record<string, unknown>>): void {
  useCanvasStore.setState({
    results: {
      status: 'complete',
      progress: 100,
      report: {
        run: { critique: [] },
        robustness: {
          fragile_edges: fragileEdges,
          flip_thresholds: [
            { node_id: 'fac_a', label: 'Factor A', current_value: 40, flip_value: 30, unit: '%' },
          ],
        },
        option_comparison: [],
        option_probabilities: {
          opt_a: {
            goal_probability: 0.6,
            expected: 0.5,
            outcome: { mean: 0.5, p10: 0.2, p90: 0.8 },
          },
        },
        factor_sensitivity: [{ factor_id: 'fac_a', label: 'Factor A', sensitivity_score: 0.5 }],
      },
    } as never,
    runMeta: {} as never,
    nodes: [
      { id: 'opt_a', data: { kind: 'option', label: 'Plan A' }, position: { x: 0, y: 0 } },
    ] as never,
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: null,
  } as never)
}

const heroChart = (data: ResultsSectionDataReturn): HeroChartModel => {
  const model = buildHeroModel(data)
  expect(model.kind).toBe('chart')
  return model as HeroChartModel
}

describe('hero switchMeta feed — presence-branch end-to-end (hook → buildHeroModel)', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      results: null,
      rawV2Response: null,
      nodes: [],
      edges: [],
      hasCompletedFirstRun: false,
      draftCoaching: null,
    } as never)
  })

  it('PIN (hero): a marginal-only edge renders NO switchMeta and NO magnitude bar — the sentence still reads', () => {
    seedReportForHero([
      { edge_id: 'a::b', from_id: 'fac_a', to_id: 'out_b', marginal_switch_probability: 0.6, alternative_winner_label: 'Plan B' },
    ])
    const { result } = renderHook(() => useResultsSectionData())
    const m = heroChart(result.current)
    expect(m.evidence.flipRisks).toHaveLength(1)
    expect(m.evidence.flipRisks[0].text).toContain('Factor A')
    expect(m.evidence.flipRisks[0].switchMeta).toBeNull()
    expect(m.evidence.flipRisks[0].magnitude).toBeNull()
  })

  it('CONTROL (hero): a measured switch_probability still renders its switchMeta and magnitude', () => {
    seedReportForHero([
      {
        edge_id: 'a::b',
        from_id: 'fac_a',
        to_id: 'out_b',
        switch_probability: 0.48,
        marginal_switch_probability: 0.99,
        alternative_winner_label: 'Plan B',
      },
    ])
    const { result } = renderHook(() => useResultsSectionData())
    const m = heroChart(result.current)
    expect(m.evidence.flipRisks[0].switchMeta).toBe('48% switch')
    expect(m.evidence.flipRisks[0].magnitude).toBe(0.48)
  })

  it('CONTROL (hero): a measured 0 survives as "0% switch" (0 is a measurement, not absence)', () => {
    seedReportForHero([
      {
        edge_id: 'a::b',
        from_id: 'fac_a',
        to_id: 'out_b',
        switch_probability: 0,
        marginal_switch_probability: 0.8,
        alternative_winner_label: 'Plan B',
      },
    ])
    const { result } = renderHook(() => useResultsSectionData())
    const m = heroChart(result.current)
    expect(m.evidence.flipRisks[0].switchMeta).toBe('0% switch')
    expect(m.evidence.flipRisks[0].magnitude).toBe(0)
  })
})
