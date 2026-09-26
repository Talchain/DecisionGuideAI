/**
 * ⛔⛔ A HEADROOM CAP IS NOT A UNIT — no currency figure is manufactured from it.
 *
 * Paul's manual test `1a298d6d` (25 Sep 2026): a £20k-MRR pricing decision.
 * The engine's option outcomes are unitless (p50 0.126 / 0.146 / 0.136); CEE's
 * cap is `goal_threshold_raw * 1.25 = 25,000`, provenance
 * `target_derived_headroom` — "a constant of the rule, not a measurement"
 * (CEE `src/utils/goal-threshold-cap.ts`). The tab printed "Mid-point $3,401":
 * 0.13605 × 25,000, in dollars, on a £ decision.
 *
 * The option rows below are Paul's run's `option_comparison`, VERBATIM from
 * the debug export (`payloads.cee_response.blocks[0].enrichment`), not authored.
 * Bound by identity: option ids, and the exact producer p50s.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { AnalysisResultBlock } from '@talchain/schemas/boundary'

import { useResultsSectionData } from '../useResultsSectionData'
import { useCanvasStore } from '../../../canvas/store'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { useNodeMutations } from '../../../canvas/ui/inspector-v2/useInspectorMutations'

const PAUL_OPTION_COMPARISON = [
  {
    "option_id": "keep_49_price",
    "option_label": "Keep £49 Price",
    "win_probability": null,
    "outcome": {
      "p10": 0,
      "p50": 0.12609027656727329,
      "p90": 0.22579069435433868,
      "std": 0.08305644315605763,
      "mean": 0.12196094407146216,
      "n_samples": 10000,
      "validity_ratio": 1,
      "n_valid_samples": 10000,
      "percentiles_source": "samples"
    }
  },
  {
    "option_id": "raise_to_59_at_release",
    "option_label": "Raise to £59 at Release",
    "win_probability": null,
    "outcome": {
      "p10": 0,
      "p50": 0.14605325091406948,
      "p90": 0.24922487189724907,
      "std": 0.09157584422267137,
      "mean": 0.1375246580590447,
      "n_samples": 10000,
      "validity_ratio": 1,
      "n_valid_samples": 10000,
      "percentiles_source": "samples"
    }
  },
  {
    "option_id": "raise_to_54_at_release",
    "option_label": "Raise to £54 at Release",
    "win_probability": null,
    "outcome": {
      "p10": 0,
      "p50": 0.1360511662591674,
      "p90": 0.23712843812544998,
      "std": 0.08720652859716312,
      "mean": 0.12974280106525346,
      "n_samples": 10000,
      "validity_ratio": 1,
      "n_valid_samples": 10000,
      "percentiles_source": "samples"
    }
  }
]

const BLOCK = {
  type: 'analysis_result',
  summary: 'Comparison',
  leading_option_id: null,
  enrichment: { option_comparison: PAUL_OPTION_COMPARISON },
} as unknown as AnalysisResultBlock

const opt = (id: string, label: string) => ({ id, type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label } })

function seed(goalData: Record<string, unknown>, ready: Record<string, unknown> | null): void {
  useCanvasStore.setState({
    results: { status: 'complete', progress: 100, report: mapV5AnalysisToReport(BLOCK) },
    runMeta: {},
    nodes: [
      { id: 'mrr', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'MRR', ...goalData } },
      ...PAUL_OPTION_COMPARISON.map((o) => opt(o.option_id, o.option_label)),
    ],
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: null,
    ceeAnalysisReady: ready,
  } as never)
}

const GOAL = { goal_threshold: 0.8, goal_threshold_raw: 20000, goal_threshold_unit: 'GBP MRR', goal_threshold_cap: 25000 }
const READY = { status: 'ready', options: [], goal_node_id: 'mrr', ...GOAL }

function read() {
  const { result } = renderHook(() => useResultsSectionData())
  const rec = result.current.recommendation
  const p50 = (id: string) => rec?.allOptions?.find((o) => o.id === id)?.outcome?.p50 ?? null
  return { isNormalised: rec?.isNormalised, p50 }
}

describe('a headroom cap is not a unit', () => {
  beforeEach(() => useCanvasStore.setState({ ceeAnalysisReady: null } as never))

  it("⭐ Paul's run, tagged target_derived_headroom: the outcomes stay relative — no 3,401 anywhere", () => {
    seed(GOAL, { ...READY, goal_threshold_cap_provenance: 'target_derived_headroom' })
    const r = read()
    expect(r.isNormalised).toBe(true)
    expect(r.p50('raise_to_54_at_release')).toBeCloseTo(0.1360511662591674, 12)
    expect(r.p50('raise_to_54_at_release')).not.toBeCloseTo(3401.28, 0)
  })

  it('⭐ the same run with the tag DROPPED (the UI schema pin and the canvas node carry none): still relative, by the rule\'s own definition cap = raw × 1.25', () => {
    seed(GOAL, READY)
    const r = read()
    expect(r.isNormalised).toBe(true)
    expect(r.p50('keep_49_price')).toBeCloseTo(0.12609027656727329, 12)
  })

  it('CONTRAST: an attested cap (inherited) still converts — the fix withholds only the manufactured figure', () => {
    seed(GOAL, { ...READY, goal_threshold_cap_provenance: 'inherited' })
    const r = read()
    expect(r.isNormalised).toBe(false)
    expect(r.p50('raise_to_54_at_release')).toBeCloseTo(0.1360511662591674 * 25000, 6)
  })

  it('CONTRAST: an untagged cap that is NOT the headroom rule (a user-set scale) still converts', () => {
    const userScale = { ...GOAL, goal_threshold_cap: 40000 }
    seed(userScale, { ...READY, goal_threshold_cap: 40000 })
    const r = read()
    expect(r.isNormalised).toBe(false)
    expect(r.p50('keep_49_price')).toBeCloseTo(0.12609027656727329 * 40000, 6)
  })

  // ── #2056 review B1: CEE's RULE ORDER, not only its last rule ──────────────
  // CEE `resolveGoalThresholdCapWithProvenance` checks '%' first: a percentage
  // target within 0–100 is ALWAYS `metric_scale`, cap 100. 80 × 1.25 is also
  // 100, so the bare arithmetic fallback took an 80% target for headroom.
  const PCT80 = { goal_threshold: 0.8, goal_threshold_raw: 80, goal_threshold_unit: '%', goal_threshold_cap: 100 }

  it('⭐ an UNTAGGED 80% target keeps its units — its cap is the metric\'s own 0–100 scale, which CEE checks before headroom', () => {
    seed(PCT80, { status: 'ready', options: [], goal_node_id: 'mrr', ...PCT80 })
    const r = read()
    expect(r.isNormalised).toBe(false)
    expect(r.p50('keep_49_price')).toBeCloseTo(0.12609027656727329 * 100, 6)
  })

  it('⭐ the same 80% target with NO ready payload (a reload) reads the node and still keeps its units', () => {
    seed(PCT80, null)
    expect(read().isNormalised).toBe(false)
  })

  it('CONTRAST: a % target ABOVE 100 never reaches CEE\'s metric-scale rule, so an untagged raw × 1.25 cap is still headroom (the pricing starter\'s 110% → 137.5)', () => {
    const PCT110 = { goal_threshold: 0.8, goal_threshold_raw: 110, goal_threshold_unit: '%', goal_threshold_cap: 137.5 }
    seed(PCT110, { status: 'ready', options: [], goal_node_id: 'mrr', ...PCT110 })
    expect(read().isNormalised).toBe(true)
  })

  // ── A tag speaks only for the cap it came with ─────────────────────────────
  it('⭐ a LEFTOVER ready tag (goal switch clears the ready cap, not its tag) does not label the new goal\'s own cap', () => {
    const userScale = { ...GOAL, goal_threshold_cap: 40000 }
    seed(userScale, {
      status: 'ready', options: [], goal_node_id: 'mrr',
      goal_threshold: undefined, goal_threshold_raw: undefined, goal_threshold_unit: undefined, goal_threshold_cap: undefined,
      goal_threshold_cap_provenance: 'target_derived_headroom',
    })
    const r = read()
    expect(r.isNormalised).toBe(false)
    expect(r.p50('keep_49_price')).toBeCloseTo(0.12609027656727329 * 40000, 6)
  })

  // ── #2056 review N1: a user cap edit clears the tag it replaces ────────────
  it('⭐ setGoalCap (the inspector\'s Scale cap) clears the headroom tag, so the user\'s own scale converts after the edit and after a reload', () => {
    seed({ ...GOAL, goal_threshold_cap_provenance: 'target_derived_headroom' }, null)
    expect(read().isNormalised).toBe(true) // precondition: the tag is live before the edit

    const { result } = renderHook(() => useNodeMutations('mrr'))
    act(() => result.current.setGoalCap(40000))

    const goal = useCanvasStore.getState().nodes.find((n) => n.id === 'mrr')!
    expect(goal.data.goal_threshold_cap).toBe(40000)
    expect(goal.data.goal_threshold_cap_provenance).toBeUndefined()
    expect(Object.keys(JSON.parse(JSON.stringify(goal.data)))).not.toContain('goal_threshold_cap_provenance')
    const r = read()
    expect(r.isNormalised).toBe(false)
    expect(r.p50('keep_49_price')).toBeCloseTo(0.12609027656727329 * 40000, 6)
  })
})
