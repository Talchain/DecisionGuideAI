/**
 * UI-SEM-081 — unit-derived goal-threshold cap (Lane 1b, V-P0-1).
 *
 * Live staging evidence (2026-07-13, scenario f0acea23): a Define-success
 * save of "reach at least 60 %" shipped a chip with NO goal_threshold at all —
 * analysis_ready carries no goal_threshold_cap, the CEE-drafted goal node has
 * no scale_max, so the fail-closed omission (Codex B3) swallowed the target
 * even though the user explicitly said the number is a PERCENTAGE. A "%" unit
 * is a definitional cap of 100 — user-stated, not fabricated. It is consulted
 * LAST (producer/node caps win) and only unlocks the provably-normalisable
 * case; every other unit stays fail-closed.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { capForUnit, resolveChipGoalThreshold } from '../useV2Run'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('capForUnit (UI-SEM-081)', () => {
  it('returns 100 for the percent unit (with trimming)', () => {
    expect(capForUnit('%')).toBe(100)
    expect(capForUnit(' % ')).toBe(100)
  })

  it('returns undefined for every non-percent unit — no cap is invented', () => {
    expect(capForUnit('projects')).toBeUndefined()
    expect(capForUnit('weeks')).toBeUndefined()
    expect(capForUnit('£')).toBeUndefined()
    expect(capForUnit('')).toBeUndefined()
    expect(capForUnit(null)).toBeUndefined()
    expect(capForUnit(undefined)).toBeUndefined()
  })
})

describe('resolveChipGoalThreshold with a unit-derived cap', () => {
  const goalNode = (data: Record<string, unknown>) => [{ id: 'goal_1', data }]

  it('unlocks the percent case: 60 with unitCap 100 and no other cap → 0.6', () => {
    expect(
      resolveChipGoalThreshold(60, {
        analysisReady: null,
        nodes: goalNode({}),
        goalNodeId: 'goal_1',
        unitCap: capForUnit('%'),
      }),
    ).toBeCloseTo(0.6)
  })

  it('producer/node caps WIN over the unit cap (chain cap 200 beats unitCap 100)', () => {
    expect(
      resolveChipGoalThreshold(60, {
        analysisReady: { goal_threshold_cap: 200 },
        nodes: goalNode({}),
        goalNodeId: 'goal_1',
        unitCap: 100,
      }),
    ).toBeCloseTo(0.3)
  })

  it('an invalid unit cap is ignored — still fail-closed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (const bad of [0, -5, Number.NaN]) {
      expect(
        resolveChipGoalThreshold(60, {
          analysisReady: null,
          nodes: goalNode({}),
          goalNodeId: 'goal_1',
          unitCap: bad,
        }),
      ).toBeUndefined()
    }
    expect(warn).toHaveBeenCalled()
  })

  it('no unit cap given → behaviour unchanged (fail-closed omission)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      resolveChipGoalThreshold(60, {
        analysisReady: null,
        nodes: goalNode({}),
        goalNodeId: 'goal_1',
      }),
    ).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
