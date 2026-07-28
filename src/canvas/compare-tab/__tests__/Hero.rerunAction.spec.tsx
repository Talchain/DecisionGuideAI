/**
 * ROADMAP 2.102 — the Compare hero's post-edit "Rerun analysis" must be a
 * real control.
 *
 * THE DEFECT THIS PINS (bytes-confirmed at `03e13443`). The 'stale' hero is
 * the post-edit state: it reads "Model edited since last analysis · Rerun to
 * see impact" and offers "Rerun analysis". That action rendered as
 *
 *     <span className="… text-info hover:underline cursor-pointer">
 *
 * — an inert span with NO onClick, styled exactly like a live link. The
 * sibling branch does wrap the label in a `GraphLink`, but only when
 * `actionNodeId` is non-null, and the 'stale' branch pins `actionNodeId: null`,
 * so the hero's rerun could only ever land in the inert branch. Clicking it
 * dispatched nothing.
 *
 * Scope honesty: unlike the inspector control this one was NOT reachable in a
 * live staging walk — the Compare tab needs 2+ analysis snapshots and stayed
 * in its empty state. It is proven dead at the bytes and fixed under test; the
 * live proof in this PR covers the inspector control only.
 *
 * WHAT THIS FILE PINS:
 *   1. The stale action is a BUTTON and clicking it calls the run passed down
 *      from CompareTabBody (→ OutputsDock `handleRunAnalysis`) — RED before.
 *   2. NEGATIVE CONTROL — a non-stale hero does NOT dispatch a run. Without
 *      it, assertion 1 is satisfiable by making every hero action a rerun,
 *      which would fire an analysis when the user asked to review a result.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { Hero } from '../Hero'
import type { AnalysisSnapshot } from '../types'

function snapshot(runNumber: number): AnalysisSnapshot {
  return {
    runNumber,
    winnerLabel: 'Adopt Segment',
    winnerProbability: 62,
    runnerUpLabel: 'Adopt RudderStack',
    runnerUpProbability: 24,
    winnerId: 'opt_segment',
    topCalibrationFactor: 'Compliance Readiness',
    topCalibrationFactorId: 'fac_compliance',
    topElasticity: 41,
    stabilityLabel: 'stable',
  } as unknown as AnalysisSnapshot
}

const snapshots = [snapshot(1), snapshot(2)]

describe('Compare hero stale action dispatches a run (ROADMAP 2.102)', () => {
  afterEach(() => cleanup())

  it('renders the stale "Rerun analysis" action as a real control that runs', () => {
    const onRunAnalysis = vi.fn()
    render(
      <Hero state="stale" snapshots={snapshots} showExpert={false} onRunAnalysis={onRunAnalysis} />,
    )

    // The copy the user actually sees in the post-edit state.
    expect(screen.getByText(/Model edited since last analysis/i)).toBeInTheDocument()

    // THE assertion that was RED: an inert <span> has no role="button" and
    // clicking it dispatched nothing.
    const btn = screen.getByTestId('compare-hero-rerun')
    expect(btn.tagName).toBe('BUTTON')
    expect(btn).toHaveTextContent('Rerun analysis')

    fireEvent.click(btn)
    expect(onRunAnalysis).toHaveBeenCalledTimes(1)
  })

  it('NEGATIVE CONTROL: a converged hero exposes no rerun control and runs nothing', () => {
    const onRunAnalysis = vi.fn()
    render(
      <Hero
        state="converged"
        snapshots={snapshots}
        showExpert={false}
        onRunAnalysis={onRunAnalysis}
      />,
    )

    expect(screen.queryByTestId('compare-hero-rerun')).not.toBeInTheDocument()
    expect(onRunAnalysis).not.toHaveBeenCalled()
  })
})
