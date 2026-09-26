/**
 * ⭐ TIED DRIVERS KEEP THE PRODUCER'S ORDER — no "#1, #4, #3".
 *
 * Paul's manual test `1a298d6d` (debug export, factor sensitivity rows):
 * Pro subscribers influence_rank 1 (influence 1), Monthly new Pro subscribers
 * rank 3 (0.5), Monthly churn rank 4 (0.5), Pro plan price rank 2 withheld
 * (`intervention_override`). The two 0.5s arrived churn-first; a stable sort
 * on magnitude kept that order and the tab printed "#1, #4, #3".
 * Bound by identity: factor keys, and the printed rank row.
 */
import { describe, expect, it } from 'vitest'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { makeData, makeDriver } from './analysisNewFixtures'

const vmOf = (drivers: ReturnType<typeof makeDriver>[]) =>
  buildAnalysisNewViewModel({
    data: makeData({ drivers: { driversStatus: 'computed', drivers } as never }),
    recommendations: [], isPreRun: false, isRunning: false, isStale: false,
  })

// Arrival order as witnessed: the rank-4 factor BEFORE the rank-3 factor.
const PAUL = [
  makeDriver({ factorKey: 'pro_subscribers', factorLabel: 'Pro subscribers', displayInfluence: 1, influenceRank: 1, rank: 1 }),
  makeDriver({ factorKey: 'monthly_churn', factorLabel: 'Monthly churn', displayInfluence: 0.5, influenceRank: 4, rank: 3 }),
  makeDriver({ factorKey: 'monthly_new_pro_subscribers', factorLabel: 'Monthly new Pro subscribers', displayInfluence: 0.5, influenceRank: 3, rank: 2 }),
]

describe("tied drivers keep the producer's order", () => {
  it('⭐ equal magnitudes are ordered by the producer rank, so the printed ranks ascend', () => {
    const vm = vmOf(PAUL)
    expect(vm.drivers.influenceRows.map((r) => r.id)).toEqual(['pro_subscribers', 'monthly_new_pro_subscribers', 'monthly_churn'])
    const printed = vm.drivers.influenceRows.map(
      (r) => vm.drivers.findings.find((f) => f.id.endsWith(r.id))?.inspect.find((i) => i.label === 'Rank')?.value,
    )
    expect(printed).toEqual(['1', '3', '4'])
  })

  it('CONTRAST: a real magnitude difference still wins over rank (the bar order is the magnitude order)', () => {
    const vm = vmOf([
      makeDriver({ factorKey: 'a', factorLabel: 'A', displayInfluence: 0.3, influenceRank: 1, rank: 1 }),
      makeDriver({ factorKey: 'b', factorLabel: 'B', displayInfluence: 0.9, influenceRank: 2, rank: 2 }),
    ])
    expect(vm.drivers.influenceRows.map((r) => r.id)).toEqual(['b', 'a'])
  })
})
