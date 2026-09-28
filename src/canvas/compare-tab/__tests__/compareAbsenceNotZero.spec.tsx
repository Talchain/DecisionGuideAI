/**
 * Compare tab — an unmeasured probability is never plotted as zero (ROADMAP 2.834).
 *
 * WHAT THIS PINS, and why it is not covered by anything already here.
 *
 * `runnerUpProbability` and `goalProbability` are both declared `number | null`
 * (`types.ts:144,195`) — absence is a first-class, EXPECTED state, produced on
 * two honest paths: a run with a single option has no runner-up at all, and
 * `selectGoalProbability` legitimately returns null for a withheld basis.
 * Three display sites silently converted that null to 0:
 *
 *   TrajectorySection.tsx:75  runnerUp: s.runnerUpProbability ?? 0   (plotted)
 *   DotProgression.tsx:36     s.runnerUpProbability ?? 0             (printed)
 *   DotProgression.tsx:109    s.goalProbability ?? 0                 (printed)
 *
 * A fabricated zero on a CHART is worse than a fabricated number in prose: a
 * reader doubts a number but reads a plotted series as observation. On the
 * trajectory chart a null runner-up drew a flat line along the axis — a
 * measurement the engine never made, in the most credible form the UI has.
 *
 * ⚠ WHY `parseAnalysisEnrichment` DOES NOT ALREADY COVER THIS.
 * That guard (analysisEnrichmentShape.ts) works at ENVELOPE grain: it rejects
 * an envelope whose `option_comparison` or `factor_sensitivity` is missing or
 * empty, and its own header says every OTHER producer field "stays
 * absence-preserving rather than drop-worthy". Once both arrays are non-empty
 * the envelope is ADMITTED and the guard makes no claim about the fields
 * INSIDE the entries. These defects live entirely on admitted envelopes. So
 * every fixture below is deliberately one the guard PASSES — otherwise the
 * test would re-prove the guard instead of the branch it misses.
 *
 * Sibling: TrajectorySection.absence.spec.tsx pins the EXPERT TABLE. Its own
 * fixture carries `runnerUpProbability: null` / `goalProbability: null`, so the
 * chart and dot row were rendering fabricated zeros inside every one of those
 * green tests — presence of a guard is not coverage of the branch.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DotProgression } from '../DotProgression'
import { buildTrajectoryData } from '../TrajectorySection'
import { Hero } from '../Hero'
import { deriveCompareState } from '../deriveCompareState'
import type { AnalysisSnapshot } from '../types'

/** The option this fixture's producer names as leader. */
const LEADER_ID = 'opt-1'

function snapshot(overrides: Partial<AnalysisSnapshot> = {}): AnalysisSnapshot {
  return {
    runId: 'run-1',
    runNumber: 1,
    timestamp: '2026-02-20T10:00:00Z',
    source: 'session',
    graphHash: 'hash-1',
    nodeCount: 2,
    edgeCount: 1,
    // ROADMAP 2.835 — this fixture predated `leaderVerdict`/`options` and
    // relied on the `as AnalysisSnapshot` cast below to omit them, so every
    // test here ran against a snapshot shape the factory never produces. The
    // retired `winnerLabel`/`winnerProbability` are replaced by the two fields
    // the tab actually reads, populated consistently: a producer-entitled
    // verdict naming `opt-1`, which `options` scores at 60 — the same numbers
    // the old argmax fields carried, so every assertion below is unchanged.
    winnerId: 'opt-1',
    options: [
      { id: 'opt-1', label: 'Option A', winProbability: 60 },
      { id: 'opt-2', label: 'Option B', winProbability: 30 },
    ],
    leaderVerdict: {
      leaderId: 'opt-1',
      separation: 'clear',
      hasLeadingOption: true,
      gapPp: 30,
      source: 'producer_near_tie',
    },
    runnerUpId: 'opt-2',
    runnerUpLabel: 'Option B',
    runnerUpProbability: 30,
    recommendationStability: 0.8,
    stabilityLabel: 'stable',
    fragileEdgeCount: 2,
    evidenceCoverage: '3/5',
    topFactors: [],
    influenceConcentration: 40,
    topCalibrationFactor: 'Factor X',
    topCalibrationFactorId: 'f-1',
    topElasticity: 12,
    rankFlipRate: 0,
    goalProbability: 50,
    jointGoalProbability: null,
    edgeEValues: [],
    seedUsed: 42,
    responseHash: 'resp-1',
    editSummary: '',
    ...overrides,
  } as AnalysisSnapshot
}

// ---------------------------------------------------------------------------
// The trajectory CHART series (pure data, so the assertion does not depend on
// recharts rendering under jsdom — which cannot prove visibility anyway).
// ---------------------------------------------------------------------------

describe('buildTrajectoryData — absence is a gap in the series, never a zero', () => {
  it('runnerUpProbability null → series datum is null, NOT 0', () => {
    const data = buildTrajectoryData([
      snapshot({ runId: 'r1', runNumber: 1, runnerUpProbability: 30 }),
      snapshot({ runId: 'r2', runNumber: 2, runnerUpProbability: null }),
    ], LEADER_ID)

    // Bind by IDENTITY: the run whose runner-up was not scored, found by
    // runNumber, never by a value predicate another datum could satisfy.
    const unscored = data.find(d => d.run === 2)
    expect(unscored).toBeDefined()
    expect(unscored!.runnerUp).toBeNull()
    expect(unscored!.runnerUp).not.toBe(0)

    // ...and the run that WAS scored is untouched.
    expect(data.find(d => d.run === 1)!.runnerUp).toBe(30)
  })

  it('an HONEST zero still plots as zero', () => {
    // The engine measured the runner-up at 0%. That is a real fact and must
    // survive — the fix must not turn every low value into a gap.
    const data = buildTrajectoryData([snapshot({ runNumber: 7, runnerUpProbability: 0 })], LEADER_ID)
    expect(data.find(d => d.run === 7)!.runnerUp).toBe(0)
  })

  it('goalProbability null → series datum is null, NOT 0', () => {
    const data = buildTrajectoryData([
      snapshot({ runId: 'r1', runNumber: 1, goalProbability: 80 }),
      snapshot({ runId: 'r2', runNumber: 2, goalProbability: null }),
    ], LEADER_ID)
    expect(data.find(d => d.run === 2)!.goal).toBeNull()
    expect(data.find(d => d.run === 1)!.goal).toBe(80)
  })

  it('an HONEST zero goal probability still plots as zero', () => {
    const data = buildTrajectoryData([snapshot({ runNumber: 3, goalProbability: 0 })], LEADER_ID)
    expect(data.find(d => d.run === 3)!.goal).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// The dot progression row (printed text, plain DOM)
// ---------------------------------------------------------------------------

describe('DotProgression — an unscored run prints a gap, never "0%"', () => {
  it('runnerUpProbability null on an earlier run → no fabricated "0%"', () => {
    // `if (latest.runnerUpId)` gates the row on the LATEST run only, so an
    // earlier run with no runner-up reached `?? 0` and printed "0%".
    render(
      <DotProgression
        snapshots={[
          snapshot({ runId: 'r1', runNumber: 1, runnerUpProbability: null }),
          snapshot({ runId: 'r2', runNumber: 2, runnerUpProbability: 45 }),
        ]}
      />,
    )

    expect(screen.queryByText('0%')).not.toBeInTheDocument()
    expect(screen.getByText('45%')).toBeInTheDocument()
    expect(screen.getAllByTestId('compare-dot-unscored').length).toBe(1)
  })

  it('goalProbability null on one run → no fabricated "0%" in the Target row', () => {
    // `hasGoal` is computed honestly (`some(s => s.goalProbability != null)`)
    // and then the row fabricated `?? 0` for the runs that had none — the guard
    // decided WHETHER to draw the row, never what to draw in it.
    render(
      <DotProgression
        snapshots={[
          snapshot({ runId: 'r1', runNumber: 1, goalProbability: 70 }),
          snapshot({ runId: 'r2', runNumber: 2, goalProbability: null }),
        ]}
      />,
    )

    expect(screen.getByText('70%')).toBeInTheDocument()
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })

  it('an HONEST zero still prints "0%" and is NOT marked unscored', () => {
    render(
      <DotProgression
        snapshots={[snapshot({ runId: 'r1', runNumber: 1, goalProbability: 0, runnerUpProbability: 0 })]}
      />,
    )

    expect(screen.getAllByText('0%').length).toBeGreaterThan(0)
    expect(screen.queryByTestId('compare-dot-unscored')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// The hero sentence
// ---------------------------------------------------------------------------

describe('Hero — an unscored option is not printed as a measured 0%', () => {
  /**
   * ⚠ REWRITTEN BY ROADMAP 2.835, AND THE REASON MATTERS MORE THAN THE EDIT.
   *
   * These two cases used to drive `state="noWinner"` directly and assert that a
   * null `runnerUpProbability` printed "not scored in this run" rather than
   * "Option B 0%". 2.834's guarantee. It still holds — but it is now enforced
   * STRUCTURALLY rather than by a guard, so the old cases could no longer
   * reach the branch they were written for:
   *
   *   · The `noWinner` arm is selected only by the PRODUCER's tie verdict, and
   *     `deriveDecisionVerdict` returns `'tied'` only when TWO options carry a
   *     comparable win probability. A run with an unscored option cannot get
   *     there — it yields the `unknown` verdict and lands in `'unclaimed'`.
   *   · The arm's copy now reads the two top entries of `snapshot.options`,
   *     from which an unscored option is ABSENT (`extractOptions` drops it). So
   *     there is no null left to coerce and no `?? 0` left to guard.
   *
   * Deleting the cases would have dropped the evidence, so they are re-pointed
   * at the property that replaced them: the same run, through the real state
   * machine, must still print no fabricated percentage — and it now declines to
   * name a leader at all rather than denying one.
   */
  it('a run whose options were not all scored prints no fabricated "0%"', () => {
    const unscored = snapshot({
      runId: 'r2',
      runNumber: 2,
      // Only one option carries a measurement, so "leading" has no meaning and
      // the producer sent no applicable signal.
      options: [{ id: 'opt-1', label: 'Option A', winProbability: 5 }],
      leaderVerdict: {
        leaderId: null, separation: 'unknown', hasLeadingOption: false,
        gapPp: null, source: 'none',
      },
      runnerUpProbability: null,
      runnerUpLabel: 'Option B',
    })
    const snapshots = [snapshot({ runId: 'r1', runNumber: 1 }), unscored]

    // Through the REAL state machine, not a hand-picked state: which arm fires
    // is part of what 2.835 changed, so pinning the arm is pinning the fix.
    expect(deriveCompareState(snapshots, false)).toBe('unclaimed')

    const { container } = render(
      <Hero
        snapshots={snapshots}
        state={deriveCompareState(snapshots, false)}
        showExpert={false}
        onRunAnalysis={() => {}}
      />,
    )

    expect(container.textContent).not.toContain('0%')
    // ...and it does not DENY a leader either — silence, never a denial.
    expect(container.textContent).not.toContain('No clear leading option')
    expect(container.textContent).toContain('Not assessed')
  })

  it('the tie arm still prints both PRESENT probabilities', () => {
    const tied = snapshot({
      runId: 'r2',
      runNumber: 2,
      options: [
        { id: 'opt-1', label: 'Option A', winProbability: 35 },
        { id: 'opt-2', label: 'Option B', winProbability: 30 },
      ],
      leaderVerdict: {
        leaderId: 'opt-1', separation: 'tied', hasLeadingOption: false,
        gapPp: 5, source: 'producer_near_tie',
      },
      runnerUpProbability: 30,
    })
    const snapshots = [snapshot({ runId: 'r1', runNumber: 1 }), tied]

    expect(deriveCompareState(snapshots, false)).toBe('noWinner')

    const { container } = render(
      <Hero
        snapshots={snapshots}
        state="noWinner"
        showExpert={false}
        onRunAnalysis={() => {}}
      />,
    )

    expect(container.textContent).toContain('Option A 35%')
    expect(container.textContent).toContain('Option B 30%')
  })
})
