/**
 * The builder narrows direction with `isDirectionalFactor`, never with a null
 * check — and orders the rows by the same magnitude the glance uses.
 *
 * ⚠⚠ WHY THIS IS A SEPARATE SPEC FROM THE COMPONENT'S. `driverInfluenceChart`
 * pins that a row with `direction: null` draws no side. That says nothing about
 * WHICH producer values become null. `'mixed'` and `'unknown'` are PRESENT
 * values that still forbid a directional claim (ROADMAP 2.234 widened the
 * domain for exactly this), so a builder written as `d.direction ?? null` would
 * pass every component case and still ship the defect. This spec is the half
 * that can see it.
 */
import { describe, expect, it } from 'vitest'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { makeData, makeDriver } from './analysisNewFixtures'

const rowsFor = (direction: unknown) =>
  buildAnalysisNewViewModel({ recommendations: [], isPreRun: false, isRunning: false, isStale: false, data: makeData({
      drivers: { drivers: [
        makeDriver({
          factorKey: 'f1',
          factorLabel: 'Factor one',
          direction: direction as never,
        }),
      ] },
    }) }).drivers.influenceRows

describe('only the two directional members license a side', () => {
  it.each([
    ['positive', 'positive'],
    ['negative', 'negative'],
  ])('%s survives narrowing', (given, expected) => {
    expect(rowsFor(given)[0]?.direction).toBe(expected)
  })

  /**
   * ⚠ THE DISCRIMINATING HALF. `mixed` and `unknown` are the two values a
   * `!= null` check would wave through, and they are the two the domain was
   * widened to stop. `undefined` is the control: it must also be null, so a
   * passing `mixed` case cannot be explained by the field simply being absent.
   */
  it.each([['mixed'], ['unknown'], [undefined]])(
    '%s is refused a side',
    (given) => {
      expect(rowsFor(given)[0]?.direction).toBeNull()
    },
  )
})

describe('the rows are the full set, ordered by magnitude', () => {
  const built = () =>
    buildAnalysisNewViewModel({ recommendations: [], isPreRun: false, isRunning: false, isStale: false, data: makeData({
        drivers: { drivers: [
          makeDriver({ factorKey: 'small', factorLabel: 'Small', displayInfluence: 0.2 }),
          makeDriver({ factorKey: 'big', factorLabel: 'Big', displayInfluence: 0.9 }),
          makeDriver({ factorKey: 'mid', factorLabel: 'Mid', displayInfluence: 0.5 }),
        ] },
      }) }).drivers.influenceRows

  it('strongest first', () => {
    expect(built().map((r) => r.id)).toEqual(['big', 'mid', 'small'])
  })

  /**
   * ⚠ SCALED TO THE STRONGEST IN THE RUN, NOT TO A SUM. A sum-scaled bar reads
   * as a SHARE OF THE OUTCOME — a claim neither influence basis licenses, and
   * the exact misreading the glance's own comment records.
   */
  it('the leader is 1 and the rest are fractions of it', () => {
    const rows = built()
    expect(rows[0]?.fraction).toBe(1)
    expect(rows[1]?.fraction).toBeCloseTo(0.5 / 0.9, 5)
  })

  /**
   * ⚠ NOT THE GLANCE'S TOP THREE. The two surfaces answer different questions
   * and a cap here would silently make the chart agree with the glance by
   * construction rather than by measurement (trap 21).
   */
  it('does not cap at the glance driver count', () => {
    const many = buildAnalysisNewViewModel({
      recommendations: [],
      isPreRun: false,
      isRunning: false,
      isStale: false,
      data: makeData({
        drivers: {
          drivers: Array.from({ length: 5 }, (_, i) =>
            makeDriver({
              factorKey: `f${i}`,
              factorLabel: `Factor ${i}`,
              displayInfluence: 0.9 - i * 0.1,
            }),
          ),
        },
      }),
    }).drivers
    expect(many.influenceRows).toHaveLength(5)
    expect(many.influenceRows.length).toBeGreaterThan(4)
  })
})

describe('a zeroed row is not a driver', () => {
  it('rows the producer scored at zero never reach the chart', () => {
    const vm = buildAnalysisNewViewModel({ recommendations: [], isPreRun: false, isRunning: false, isStale: false, data: makeData({
        drivers: { drivers: [
          makeDriver({ factorKey: 'live', factorLabel: 'Live', displayInfluence: 0.7 }),
          makeDriver({
            factorKey: 'zeroed',
            factorLabel: 'Zeroed',
            displayInfluence: 0,
            zeroReason: 'intervention_factor' as never,
          }),
        ] },
      }) }).drivers
    expect(vm.influenceRows.map((r) => r.id)).toEqual(['live'])
    // …and the count still survives the filter, so the empty state can tell
    // "measured, and it was zero" from "we got nothing".
    expect(vm.suppressedZeroCount).toBe(1)
  })
})
