import { describe, expect, it } from 'vitest'
import { goalFiguresUnderReading, readGoalFigureWithholds, withheldClaimsFor } from '../goalIdentityWithheld'
import { selectGoalProbability, selectGoalProbabilityForReport } from '../selectGoalProbability'
import { mapV2ResponseToReportV1 } from '../../../../adapters/plot/v2/responseMapper'
import { buildAnalysisSnapshot } from '../../../../canvas/stores/analysisSnapshotFactory'
import type { V2RunResponse } from '../../../../adapters/plot/v2/types'

const readingWarning = (reading_label: unknown) => ({ code: 'GOAL_CHANCE_LICENSED', reading_label })
const typed = { code: 'GOAL_FIGURES_READING_UNCONFIRMED', option_ids: ['a'], withheld_claims: ['joint_probability'] }
const entry = { goal_probability: 0.45, probability_of_joint_goal: 0.72 }
const report = (inference_warnings: unknown[]) => ({ inference_warnings, option_probabilities: { a: entry, b: entry } })

const raw = (inference_warnings: unknown[]) => ({
  analysis_status: 'computed', option_comparison_status: 'computed', robustness_status: 'unavailable', drivers_status: 'unavailable',
  response_hash: 'p02', inference_warnings,
  option_comparison: [{ option_id: 'a', option_label: 'A', win_probability: 0.6, probability_of_goal: 0.45, probability_of_joint_goal: 0.72,
    confidence_interval: [0.3, 0.7], outcome: { mean: 0.5, p10: 0.3, p50: 0.5, p90: 0.7 } }],
  edge_sensitivity: [], factor_sensitivity: [], critiques: [], robustness: {}, meta: {},
} as unknown as V2RunResponse)

describe('P02 r2 A: one report-level reading fact and full scope', () => {
  it.each([undefined, null, false, 0, '', [], {}].map(value => [value]))('reading_label presence is sufficient regardless of value: %j', (value) => {
    expect(goalFiguresUnderReading(report([readingWarning(value)]))).toBe(true)
  })
  it('any typed reading warning is a report-level fact even with a scoped joint-only claim', () => {
    expect(goalFiguresUnderReading(report([typed]))).toBe(true)
  })
  it('a scoped joint-only producer warning cannot narrow either claim under a label', () => {
    const withholds = readGoalFigureWithholds(report([readingWarning(null), typed]))
    for (const id of ['a', 'b']) expect(withheldClaimsFor(withholds, id)).toEqual(new Set(['goal_probability', 'joint_probability']))
  })
  it.each([null, undefined, [], {}, { inference_warnings: null }, report([{ code: 'GOAL_CHANCE_LICENSED' }]),
    report([{ code: 'OTHER', reading_label: null }])].map(holder => [holder]))('CONTROL: no reading fact in %j', (holder) => {
    expect(goalFiguresUnderReading(holder)).toBe(false)
  })
})

describe('P02 r2 B: report-level accessor protects unstamped goal AND joint figures', () => {
  it.each([[readingWarning({})], [readingWarning(undefined)], [typed], [readingWarning(null), typed]].map(warnings => [warnings]))('withholds both quantities on every option: %j', (warnings) => {
    for (const id of ['a', 'b']) {
      const selected = selectGoalProbabilityForReport(report(warnings), id)
      expect(selected.goalProbability).toBeNull()
      expect(selected.jointGoalProbability).toBeNull()
      expect(selected.withheldBy).toBe('reading_unconfirmed')
      expect(selected.basis).toBe('none')
      expect(selected.mayUsePossessiveGoalFraming).toBe(false)
      expect(selected.goalFitBaseCaveat).toBeNull()
      expect(selected.jointGoalIsModelledBasis).toBe(false)
    }
  })
  it('CONTROL: no-label selections stay byte-identical to the per-entry selector', () => {
    for (const option of [entry, {}, { probability_of_joint_goal: 0.72 }, { goal_probability: 0, goalIdentityWithheld: true as const }]) {
      expect(JSON.stringify(selectGoalProbabilityForReport({ option_probabilities: { a: option } }, 'a'))).toBe(JSON.stringify(selectGoalProbability(option)))
    }
    expect(selectGoalProbabilityForReport(null, 'missing')).toEqual(selectGoalProbability(undefined))
  })
  it('legacy hydration preserves root warnings so unstamped mapped entries cannot bypass the fact', () => {
    const mapped = mapV2ResponseToReportV1(raw([readingWarning(null)]), { seed: null })
    expect(selectGoalProbabilityForReport(mapped, 'a').goalProbability).toBeNull()
    expect(selectGoalProbabilityForReport(mapped, 'a').jointGoalProbability).toBeNull()
  })
  it('CONTROL (Codex r2 P1): with no reading signal, legacy hydration adds no root warnings and no flag — readers see exactly what they did', () => {
    const legacy = { ...raw([]), robustness: { inference_warnings: [{ code: 'GOAL_CHANCE_LICENSED', option_ids: ['a'], pct_by_option: { a: 45 } }] } } as unknown as V2RunResponse
    const noRoot = { ...legacy } as Record<string, unknown>
    delete noRoot.inference_warnings
    for (const input of [legacy, noRoot as unknown as V2RunResponse]) {
      const mapped = mapV2ResponseToReportV1(input, { seed: null }) as unknown as Record<string, unknown>
      expect(mapped.goal_reading_unconfirmed).toBeUndefined()
      expect('inference_warnings' in mapped).toBe(false)
      expect(selectGoalProbabilityForReport(mapped, 'a').goalProbability).not.toBeNull()
    }
  })
  it('a reading signal only in the NESTED legacy array still sets the flag (fail closed)', () => {
    const nested = { ...raw([]), robustness: { inference_warnings: [readingWarning(null)] } } as unknown as V2RunResponse
    const mapped = mapV2ResponseToReportV1(nested, { seed: null }) as unknown as Record<string, unknown>
    expect(mapped.goal_reading_unconfirmed).toBe(true)
    expect(selectGoalProbabilityForReport(mapped, 'a').goalProbability).toBeNull()
  })
  it.each([[readingWarning(null)], [typed]].map(warnings => [warnings]))('snapshot factory withholds both quantities under reading: %j', (warnings) => {
    const snapshot = buildAnalysisSnapshot({ rawV2Response: raw(warnings), nodes: [], edges: [], runNumber: 1, events: [], previousSnapshotTimestamp: null })
    expect(snapshot.goalProbability).toBeNull()
    expect(snapshot.jointGoalProbability).toBeNull()
  })
  it('mapped report reading warnings survive an empty raw warning list in the snapshot', () => {
    const snapshot = buildAnalysisSnapshot({ rawV2Response: raw([]), report: report([readingWarning(null)]) as never, nodes: [], edges: [], runNumber: 1, events: [], previousSnapshotTimestamp: null })
    expect(snapshot.goalProbability).toBeNull()
    expect(snapshot.jointGoalProbability).toBeNull()
  })
  it('CONTROL: a plain snapshot keeps the exact goal and joint percentages', () => {
    const snapshot = buildAnalysisSnapshot({ rawV2Response: raw([]), nodes: [], edges: [], runNumber: 1, events: [], previousSnapshotTimestamp: null })
    expect([snapshot.goalProbability, snapshot.jointGoalProbability]).toEqual([45, 72])
  })
})
