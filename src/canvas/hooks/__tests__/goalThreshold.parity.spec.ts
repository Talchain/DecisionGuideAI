/**
 * Lane 1 — V2/V5 goal-threshold parity REGRESSION PIN.
 *
 * Both legs are compositions of the same helpers today, so this grid is
 * tautological by construction — that is the point: it fails the day
 * someone forks one leg (adds rounding, changes the cap chain, forgets the
 * measure unit-cap on one side), which is exactly how the July-13 P0 class
 * arose (the V5 leg was added without the V2 leg's normalisation, then the
 * V2 leg initially missed the unit cap the V5 leg gained). This pin is NOT
 * the canonical spec — two matching legs can both be wrong; the wire test
 * (goalThreshold.chipToWire.spec.ts) is the truth.
 *
 * V2 leg (useV2Run.runV2Analysis): normaliseGoalThresholdForRequest(raw,
 *   resolveGoalThresholdCap(...) ?? resolveMeasureUnitCap(measure, raw))
 * V5 leg (commit sites + canonical default-attach):
 *   resolveChipGoalThreshold(raw, { ..., unitCap: resolveMeasureUnitCap(measure, raw) })
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

import {
  normaliseGoalThresholdForRequest,
  resolveGoalThresholdCap,
  resolveChipGoalThreshold,
  resolveMeasureUnitCap,
} from '../useV2Run'

afterEach(() => {
  vi.restoreAllMocks()
})

type Case = {
  name: string
  raw: number | null
  analysisReady: { goal_threshold_cap?: unknown } | null
  nodeData: Record<string, unknown>
  measure: { threshold: number; unit: string } | null
  expected: number | undefined
}

const CASES: Case[] = [
  { name: 'producer cap (200 / 1000)', raw: 200, analysisReady: { goal_threshold_cap: 1000 }, nodeData: {}, measure: null, expected: 0.2 },
  { name: 'node scale_max cap (60 / 100)', raw: 60, analysisReady: null, nodeData: { scale_max: 100 }, measure: null, expected: 0.6 },
  { name: 'node threshold_cap beats scale_max', raw: 30, analysisReady: null, nodeData: { threshold_cap: 60, scale_max: 100 }, measure: null, expected: 0.5 },
  { name: 'at-cap → exactly 1', raw: 25, analysisReady: { goal_threshold_cap: 25 }, nodeData: {}, measure: null, expected: 1 },
  { name: 'ULP at cap → exactly 1', raw: 0.1 + 0.2, analysisReady: { goal_threshold_cap: 0.3 }, nodeData: {}, measure: null, expected: 1 },
  { name: 'above cap → both omit', raw: 30, analysisReady: { goal_threshold_cap: 25 }, nodeData: {}, measure: null, expected: undefined },
  { name: 'already normalised, no cap → passthrough', raw: 0.6, analysisReady: null, nodeData: {}, measure: null, expected: 0.6 },
  { name: 'raw with no cap → both omit (fail closed)', raw: 60, analysisReady: null, nodeData: {}, measure: null, expected: undefined },
  { name: 'unit cap with provenance (60 + 60-% measure)', raw: 60, analysisReady: null, nodeData: {}, measure: { threshold: 60, unit: '%' }, expected: 0.6 },
  { name: 'unit cap DENIED without provenance (0.6 vs 60-% measure) → passthrough not ÷100', raw: 0.6, analysisReady: null, nodeData: {}, measure: { threshold: 60, unit: '%' }, expected: 0.6 },
  { name: 'producer cap WINS over unit cap', raw: 60, analysisReady: { goal_threshold_cap: 200 }, nodeData: {}, measure: { threshold: 60, unit: '%' }, expected: 0.3 },
  { name: 'null threshold → both omit', raw: null, analysisReady: { goal_threshold_cap: 100 }, nodeData: {}, measure: null, expected: undefined },
]

describe('V2 leg ≡ V5 leg for every (raw, cap-context, measure)', () => {
  it.each(CASES)('$name', ({ raw, analysisReady, nodeData, measure, expected }) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const nodes = [{ id: 'goal_1', data: nodeData }]
    const unitCap = resolveMeasureUnitCap(measure, raw)

    // V2 leg — the exact composition runV2Analysis performs.
    const v2 = normaliseGoalThresholdForRequest(
      raw,
      resolveGoalThresholdCap(analysisReady, nodes, 'goal_1') ?? unitCap,
    )
    // V5 leg — the exact composition the chip sites perform.
    const v5 = resolveChipGoalThreshold(raw, {
      analysisReady,
      nodes,
      goalNodeId: 'goal_1',
      unitCap,
    })

    expect(Object.is(v2, v5)).toBe(true)
    expect(v5).toBe(expected)
  })
})
