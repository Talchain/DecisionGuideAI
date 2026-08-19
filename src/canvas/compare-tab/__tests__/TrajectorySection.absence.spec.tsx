/**
 * Compare tab renders absence honestly (T2b) — the cross-surface half.
 *
 * PR #326 made the mapper's fragile_edges / robust_edges absence-preserving so
 * AdvancedSection honestly HIDES the "Stable edges" row when the producer sent
 * nothing. The snapshot factory then re-fabricated a 0, which surfaced here.
 * The result: same run, same fact, two surfaces — AdvancedSection said
 * "unknown", the compare tab said "0 fragile". That cross-surface incoherence
 * is exactly what #322 was merged to prevent.
 *
 * These pins hold the compare tab to the same standard as AdvancedSection:
 * absence renders as "Not assessed"; an honest producer-sent 0 still shows 0.
 *
 * Sibling: src/components/results/__tests__/receipts-fail-closed.spec.tsx
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TrajectorySection } from '../TrajectorySection'
import type { AnalysisSnapshot } from '../types'

function snapshot(overrides: Partial<AnalysisSnapshot> = {}): AnalysisSnapshot {
  return {
    runId: 'run-1',
    runNumber: 1,
    timestamp: '2026-02-20T10:00:00Z',
    source: 'session',
    graphHash: 'hash-1',
    nodeCount: 2,
    edgeCount: 1,
    // ROADMAP 2.835 — the retired argmax fields replaced by the pair the tab
    // reads. Single scored option, so `runnerUpId` stays null as before.
    winnerId: 'opt-1',
    options: [{ id: 'opt-1', label: 'Option A', winProbability: 60 }],
    leaderVerdict: {
      leaderId: 'opt-1', separation: 'clear', hasLeadingOption: true,
      gapPp: null, source: 'producer_near_tie',
    },
    runnerUpId: null,
    runnerUpLabel: null,
    runnerUpProbability: null,
    recommendationStability: 0.8,
    stabilityLabel: 'stable',
    fragileEdgeCount: 2,
    evidenceCoverage: '3/5',
    topFactors: [],
    influenceConcentration: 40,
    topCalibrationFactor: '',
    topCalibrationFactorId: '',
    topElasticity: 0,
    rankFlipRate: 0,
    goalProbability: null,
    jointGoalProbability: null,
    edgeEValues: [],
    seedUsed: 42,
    responseHash: 'resp-1',
    editSummary: '',
    ...overrides,
  } as AnalysisSnapshot
}

describe('TrajectorySection expert table — absence is not zero (T2b)', () => {
  it('fragileEdgeCount null → "Not assessed", never "0 fragile"', () => {
    render(<TrajectorySection snapshots={[snapshot({ fragileEdgeCount: null })]} showExpert />)

    // The honest statement is present...
    expect(screen.getAllByText('Not assessed').length).toBeGreaterThan(0)
    // ...and the fabricated zero is absent from the Fragile column.
    const cells = screen.getAllByRole('cell').map(c => c.textContent)
    expect(cells).toContain('Not assessed')
    expect(cells).not.toContain('0')
  })

  it('fragileEdgeCount 0 is an HONEST zero → still shows 0', () => {
    // The producer measured and found none. That is a real fact and must show.
    render(<TrajectorySection snapshots={[snapshot({ fragileEdgeCount: 0 })]} showExpert />)

    const cells = screen.getAllByRole('cell').map(c => c.textContent)
    expect(cells).toContain('0')
  })

  /**
   * ⛔ TWO T2b CASES RETIRED HERE (ROADMAP 2.1273), and the retirement is
   * deliberately recorded rather than silently deleted:
   *
   *   · `recommendationStability null → "Not assessed", not "0%"`
   *   · `an honest 0 stability still shows 0%`
   *
   * Both were correct and both are now UNTESTABLE, because the `Stability %`
   * COLUMN THEY GUARDED NO LONGER EXISTS. PLoT withholds
   * `robustness.recommendation_stability` (it is the leader's `win_probability`
   * relabelled — zero independent information), so there is no honest rendering
   * of the number to fall back to and the T2b question "absence or zero?" no
   * longer arises for this field. See the block comment in `../TrajectorySection.tsx`.
   *
   * ⚠ This is a REDUCTION IN COVERAGE ONLY IN THE SENSE THAT THE SUBJECT LEFT.
   * The replacement is strictly stronger and lives in
   * `canvas/components/model-tab/__tests__/withheldStabilitySurfaces.honesty.spec.tsx`,
   * which INJECTS a legacy stability value and proves no percentage renders —
   * i.e. it covers the case these two could not: a value that IS present.
   * The `Not assessed` mechanism itself remains under test by the surviving
   * `fragileEdgeCount` / `seedUsed` / `evidenceCoverage` cases in this file, so
   * the shared absence token has not lost its guard.
   */

  it('seedUsed null → "Not assessed", never "Seed 0"', () => {
    render(<TrajectorySection snapshots={[snapshot({ seedUsed: null })]} showExpert />)

    const cells = screen.getAllByRole('cell').map(c => c.textContent)
    expect(cells).toContain('Not assessed')
    expect(cells).not.toContain('0')
  })

  it('a real engine seed of 0 still shows 0', () => {
    render(<TrajectorySection snapshots={[snapshot({ seedUsed: 0 })]} showExpert />)

    const cells = screen.getAllByRole('cell').map(c => c.textContent)
    expect(cells).toContain('0')
  })

  it('all robustness present → no "Not assessed" anywhere', () => {
    render(<TrajectorySection snapshots={[snapshot()]} showExpert />)

    expect(screen.queryByText('Not assessed')).not.toBeInTheDocument()
  })
})
