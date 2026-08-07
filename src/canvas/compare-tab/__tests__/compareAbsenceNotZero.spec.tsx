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
    winnerId: 'opt-1',
    winnerLabel: 'Option A',
    winnerProbability: 60,
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
    ])

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
    const data = buildTrajectoryData([snapshot({ runNumber: 7, runnerUpProbability: 0 })])
    expect(data.find(d => d.run === 7)!.runnerUp).toBe(0)
  })

  it('goalProbability null → series datum is null, NOT 0', () => {
    const data = buildTrajectoryData([
      snapshot({ runId: 'r1', runNumber: 1, goalProbability: 80 }),
      snapshot({ runId: 'r2', runNumber: 2, goalProbability: null }),
    ])
    expect(data.find(d => d.run === 2)!.goal).toBeNull()
    expect(data.find(d => d.run === 1)!.goal).toBe(80)
  })

  it('an HONEST zero goal probability still plots as zero', () => {
    const data = buildTrajectoryData([snapshot({ runNumber: 3, goalProbability: 0 })])
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

describe('Hero — an unscored runner-up is not printed as a measured 0%', () => {
  it('noWinner copy with runnerUpProbability null does not claim "0%"', () => {
    // Reaching the noWinner branch requires the state machine's own predicate
    // (|winner - (runnerUp ?? 0)| < 10), so winnerProbability is low here.
    // deriveCompareState is OUT OF SCOPE and untouched — this pins the COPY.
    render(
      <Hero
        snapshots={[
          snapshot({ runId: 'r1', runNumber: 1 }),
          snapshot({
            runId: 'r2',
            runNumber: 2,
            winnerProbability: 5,
            runnerUpProbability: null,
            runnerUpLabel: 'Option B',
          }),
        ]}
        state="noWinner"
        showExpert={false}
        onRunAnalysis={() => {}}
      />,
    )

    expect(screen.queryByText(/Option B 0%/)).not.toBeInTheDocument()
    expect(screen.getByText(/not scored in this run/)).toBeInTheDocument()
  })

  it('a present runner-up probability is still printed', () => {
    render(
      <Hero
        snapshots={[
          snapshot({ runId: 'r1', runNumber: 1 }),
          snapshot({ runId: 'r2', runNumber: 2, winnerProbability: 35, runnerUpProbability: 30 }),
        ]}
        state="noWinner"
        showExpert={false}
        onRunAnalysis={() => {}}
      />,
    )

    expect(screen.getByText(/Option B 30%/)).toBeInTheDocument()
  })
})
