/**
 * Wave1-L2 (seam D-M): staged honest narration during the analysis wait.
 *
 * The banner must progress through time-based, honest, non-specific
 * narration stages while a run is in flight:
 *   - no fabricated progress percentages or scenario counts
 *   - no claim of completion proximity: the client cannot know how close
 *     the run is, and a run can end in the 130s timeout error
 *   - every stage must be true by construction of elapsed time alone, at
 *     ANY elapsed time it can still be displayed at
 *   - clean cut on early completion / error (unmount clears all timers)
 *   - prefers-reduced-motion: no spinner animation, instant text swap
 *   - aria-live polite so stage changes are announced
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, act } from '@testing-library/react'

// Mock the reduced-motion hook with a mutable flag (same pattern as
// FirstUseComposer.spec.tsx) so each test can pick its motion mode.
const reducedMotionState: { value: boolean } = { value: false }
vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => reducedMotionState.value,
}))

import {
  AnalysisRunningBanner,
  NARRATION_STAGES,
  narrationForElapsed,
} from '../AnalysisRunningBanner'

const STAGE_1 = 'Analysing your decision…'
const STAGE_2 = 'Still analysing your decision…'
const STAGE_3 = 'Still analysing — complex decisions can take a while…'

/** An arbitrary fixed wall clock so `Date.now()` arithmetic is deterministic. */
const NOW = new Date('2026-07-15T12:00:00Z').getTime()

/**
 * The run can end in a timeout error at 130s. Any line the banner can still
 * be showing at that moment must not have promised the run was nearly done.
 */
const RUN_TIMEOUT_SECONDS = 130

/**
 * Vocabulary that asserts completion proximity or certainty. The client
 * consumes ZERO run state — it knows only how long it has waited — so none
 * of this can ever be honest, at any threshold.
 */
const PROXIMITY_VOCABULARY = [
  'almost',
  'nearly',
  'any moment',
  'any second',
  'any minute',
  'shortly',
  'soon',
  'finishing',
  'finalis',
  'finaliz',
  'wrapping up',
  'wrap up',
  'just about',
  'about to',
  'final touches',
  'moments away',
  'close to',
  'ready in',
  'will be ready',
]

function assertNoProximityClaim(message: string) {
  for (const term of PROXIMITY_VOCABULARY) {
    expect(
      message.toLowerCase(),
      `"${message}" claims completion proximity ("${term}") the client cannot know`,
    ).not.toContain(term)
  }
}

/**
 * P1 (round 2, HONESTY): vocabulary that compares this run against a baseline
 * — "usual", "expected", "normal". The client knows only how long it has
 * waited; it holds no distribution of past run durations, so it cannot derive
 * "usual" at all. Worse, the first escalation fires at 20s while 20-30s is the
 * PR's own stated TYPICAL wait, so "taking longer than usual" was FALSE on a
 * perfectly ordinary run. A comparative claim needs a real baseline or it must
 * not be made.
 */
const BASELINE_COMPARISON_VOCABULARY = [
  'than usual',
  'unusual',
  'than expected',
  'than normal',
  'longer than',
  'slower than',
  'taking longer',
  'taking a while longer',
  'behind schedule',
  'overdue',
]

function assertNoBaselineComparison(message: string) {
  for (const term of BASELINE_COMPARISON_VOCABULARY) {
    expect(
      message.toLowerCase(),
      `"${message}" compares this run to a baseline ("${term}") the client cannot derive from elapsed time`,
    ).not.toContain(term)
  }
}

/** Advance fake timers inside act so React state updates flush. */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

/**
 * Advance past a stage threshold, then advance again so the crossfade
 * timeout (scheduled when effects flush at the end of the first act)
 * gets a chance to fire — mirrors real time continuing to flow.
 */
function advancePastStage(ms: number) {
  advance(ms)
  advance(500)
}

beforeEach(() => {
  reducedMotionState.value = false
  // Fake timers mock Date too, so `Date.now()` advances with the timer clock:
  // elapsed time is computed from the real run start, not from mount.
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

describe('narrationForElapsed (pure stage resolution)', () => {
  it('returns the first stage at 0s and just before the second threshold', () => {
    expect(narrationForElapsed(0)).toBe(STAGE_1)
    expect(narrationForElapsed(NARRATION_STAGES[1].afterSeconds - 1)).toBe(STAGE_1)
  })

  it('advances through every stage at its threshold', () => {
    expect(narrationForElapsed(NARRATION_STAGES[1].afterSeconds)).toBe(STAGE_2)
    expect(narrationForElapsed(NARRATION_STAGES[2].afterSeconds)).toBe(STAGE_3)
  })

  it('holds the final stage for long runs (no loop, no stuck blank)', () => {
    expect(narrationForElapsed(120)).toBe(STAGE_3)
    expect(narrationForElapsed(3600)).toBe(STAGE_3)
  })

  it('handles negative elapsed time gracefully', () => {
    expect(narrationForElapsed(-1)).toBe(STAGE_1)
  })
})

describe('honesty constraints on the copy', () => {
  it('stages are in ascending order starting at 0s', () => {
    expect(NARRATION_STAGES[0].afterSeconds).toBe(0)
    for (let i = 1; i < NARRATION_STAGES.length; i++) {
      expect(NARRATION_STAGES[i].afterSeconds).toBeGreaterThan(
        NARRATION_STAGES[i - 1].afterSeconds,
      )
    }
  })

  it('never fabricates progress: no digits, percentages or counts in any stage message', () => {
    for (const stage of NARRATION_STAGES) {
      expect(stage.message).not.toMatch(/[0-9%]/)
    }
  })

  it('stays on-brand: no exclamation marks', () => {
    for (const stage of NARRATION_STAGES) {
      expect(stage.message).not.toContain('!')
    }
  })

  // P1 (three reviewers converged): "Almost there — shaping the results…"
  // fired at a fixed 22s wall clock, consumed zero run state and held
  // indefinitely — including through runs that die at the 130s timeout.
  it('never claims completion proximity or certainty in any stage message', () => {
    for (const stage of NARRATION_STAGES) {
      assertNoProximityClaim(stage.message)
    }
  })

  it('is honest at the 130s timeout: the line still shown when the run dies has promised nothing', () => {
    const messageAtTimeout = narrationForElapsed(RUN_TIMEOUT_SECONDS)
    assertNoProximityClaim(messageAtTimeout)
    expect(messageAtTimeout).not.toMatch(/[0-9%]/)
  })

  // Elapsed time is the ONLY input. A stage must therefore stay true for
  // every second from its own threshold out to the timeout, since it can be
  // displayed at any of them.
  it('every stage stays honest at every elapsed second it can be displayed at', () => {
    for (let elapsed = 0; elapsed <= RUN_TIMEOUT_SECONDS; elapsed++) {
      assertNoProximityClaim(narrationForElapsed(elapsed))
    }
  })

  // P1 (round 2, HONESTY): "This is taking longer than usual" fired at 20s,
  // but 20-30s IS the typical wait — the line was false on a typical run.
  it('never claims this run is slower than usual: the client has no baseline to compare against', () => {
    for (const stage of NARRATION_STAGES) {
      assertNoBaselineComparison(stage.message)
    }
  })

  it('makes no baseline comparison at any elapsed second it can be displayed at', () => {
    for (let elapsed = 0; elapsed <= RUN_TIMEOUT_SECONDS; elapsed++) {
      assertNoBaselineComparison(narrationForElapsed(elapsed))
    }
  })

  // The binding invariant, stated positively: the ONLY facts elapsed time
  // licenses are that a run is in flight and that it is still in flight. The
  // typical wait is 20-30s, so no stage that can render inside that window may
  // characterise the wait as abnormal.
  it('is true across the whole typical 20-30s wait, where no stage may call the run abnormal', () => {
    for (let elapsed = 20; elapsed <= 30; elapsed++) {
      const message = narrationForElapsed(elapsed)
      assertNoBaselineComparison(message)
      assertNoProximityClaim(message)
    }
  })
})

describe('AnalysisRunningBanner stage progression (fake timers)', () => {
  it('starts on the analysing stage', () => {
    render(<AnalysisRunningBanner />)
    expect(screen.getByTestId('analysis-running-banner')).toHaveTextContent(STAGE_1)
  })

  it('progresses through all stages as time elapses', () => {
    render(<AnalysisRunningBanner />)
    expect(screen.getByTestId('analysis-narration')).toHaveTextContent(STAGE_1)

    // Cross each threshold, then allow the crossfade swap to complete.
    advancePastStage(NARRATION_STAGES[1].afterSeconds * 1000)
    expect(screen.getByTestId('analysis-narration')).toHaveTextContent(STAGE_2)

    advancePastStage((NARRATION_STAGES[2].afterSeconds - NARRATION_STAGES[1].afterSeconds) * 1000)
    expect(screen.getByTestId('analysis-narration')).toHaveTextContent(STAGE_3)
  })

  it('holds the final stage on a long run without going blank', () => {
    render(<AnalysisRunningBanner />)
    advancePastStage(120_000)
    expect(screen.getByTestId('analysis-narration')).toHaveTextContent(STAGE_3)
  })

  it('is still showing an honest long-wait line at the 130s timeout', () => {
    render(<AnalysisRunningBanner />)
    advancePastStage(RUN_TIMEOUT_SECONDS * 1000)
    expect(screen.getByTestId('analysis-narration')).toHaveTextContent(STAGE_3)
  })
})

/**
 * P1 (round 2, REGRESSION GATE). The banner used to start its clock at MOUNT
 * and count up from zero, so elapsed time meant "how long this component has
 * existed", not "how long the run has been going".
 *
 * That is not a cosmetic drift. The banner SUBSUMES the dock's slow-run
 * region: whenever the banner mounts, the accurate pre-existing slow-run line
 * is suppressed in its favour (see analysisRunStatus.ts). So a banner that
 * mounts at 25s into a run suppressed a correct "this is slow" line and
 * replaced it with a fresh-start line claiming the run had just begun —
 * strictly WORSE than no banner at all.
 *
 * The fix: elapsed time derives from the run's real start (the store's
 * results.startedAt, which the dock already knows and which survives
 * remounts), passed in as `startedAt`.
 */
describe('elapsed time derives from the RUN start, not the banner mount', () => {
  it('mounting 25s into a run shows the 20s stage immediately, not the fresh-start line', () => {
    render(<AnalysisRunningBanner startedAt={NOW - 25_000} />)
    const narration = screen.getByTestId('analysis-narration')
    expect(narration).toHaveTextContent(STAGE_2)
    expect(narration).not.toHaveTextContent(STAGE_1)
  })

  it('mounting 45s into a run shows the 40s stage immediately', () => {
    render(<AnalysisRunningBanner startedAt={NOW - 45_000} />)
    expect(screen.getByTestId('analysis-narration')).toHaveTextContent(STAGE_3)
  })

  it('mounting 130s into a run (at the timeout) shows the long-wait line, not a fresh start', () => {
    render(<AnalysisRunningBanner startedAt={NOW - RUN_TIMEOUT_SECONDS * 1000} />)
    expect(screen.getByTestId('analysis-narration')).toHaveTextContent(STAGE_3)
  })

  // A remount (tab switch, dock re-render, results panel toggled) must not
  // rewind the narration: the run did not restart, so the clock must not.
  it('remounting mid-run keeps TRUE elapsed time instead of rewinding to zero', () => {
    const startedAt = NOW - 22_000
    const first = render(<AnalysisRunningBanner startedAt={startedAt} />)
    expect(screen.getByTestId('analysis-narration')).toHaveTextContent(STAGE_2)
    first.unmount()

    // The user returns 20s later. The run is now 42s old, not 0s old.
    vi.setSystemTime(NOW + 20_000)
    render(<AnalysisRunningBanner startedAt={startedAt} />)
    expect(screen.getByTestId('analysis-narration')).toHaveTextContent(STAGE_3)
  })

  it('advances from the true elapsed time as the run continues past a mid-run mount', () => {
    render(<AnalysisRunningBanner startedAt={NOW - 38_000} />)
    expect(screen.getByTestId('analysis-narration')).toHaveTextContent(STAGE_2)

    // Only 2s more of real time are needed to reach the 40s stage.
    advancePastStage(2_000)
    expect(screen.getByTestId('analysis-narration')).toHaveTextContent(STAGE_3)
  })

  it('treats a start timestamp in the future as zero elapsed (clock skew is not negative time)', () => {
    render(<AnalysisRunningBanner startedAt={NOW + 5_000} />)
    expect(screen.getByTestId('analysis-narration')).toHaveTextContent(STAGE_1)
  })

  // Defensive: both store paths that set status to a running state also set
  // startedAt, but the banner must not crash or narrate nonsense without it.
  it('falls back to mount time when the run start is unknown', () => {
    render(<AnalysisRunningBanner />)
    expect(screen.getByTestId('analysis-narration')).toHaveTextContent(STAGE_1)
    advancePastStage(20_000)
    expect(screen.getByTestId('analysis-narration')).toHaveTextContent(STAGE_2)
  })
})

/**
 * P1 (round 2, NO-REGRESSION GATE). The banner only earns the right to
 * suppress the dock's slow-run region if it actually says something equivalent
 * at the same elapsed time. This ties the SUBSUME gate to real equivalence:
 * at every elapsed time the dock would have escalated, the banner must have
 * escalated too — never still be on the fresh-start line.
 */
describe('subsume equivalence: the accurate slow-run line is never silently lost', () => {
  it('has escalated off the fresh-start line by the dock 20s slow-run threshold', () => {
    expect(narrationForElapsed(20)).not.toBe(STAGE_1)
  })

  it('has escalated again by the dock 40s slow-run threshold', () => {
    expect(narrationForElapsed(40)).not.toBe(STAGE_1)
    expect(narrationForElapsed(40)).not.toBe(narrationForElapsed(20))
  })

  // The regression in the round-1 fix, stated as the exact user-visible
  // outcome: a banner mounting at 25s suppressed "Taking longer than
  // expected..." and showed "Analysing your decision…" in its place.
  it('a banner mounting mid-run never replaces an escalated line with a fresh-start line', () => {
    for (const elapsedSeconds of [20, 25, 30, 39, 40, 60, 130]) {
      const { unmount } = render(
        <AnalysisRunningBanner startedAt={NOW - elapsedSeconds * 1000} />,
      )
      expect(
        screen.getByTestId('analysis-narration'),
        `banner mounting ${elapsedSeconds}s into a run fell back to the fresh-start line while suppressing the dock slow-run region`,
      ).not.toHaveTextContent(STAGE_1)
      unmount()
    }
  })
})

describe('early completion and error handoff', () => {
  it('unmounting mid-run (early completion) clears every timer', () => {
    const { unmount } = render(<AnalysisRunningBanner />)
    advance(3_000)
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('unmounting mid-crossfade (error handoff at a stage boundary) clears every timer and does not throw', () => {
    const { unmount } = render(<AnalysisRunningBanner />)
    // Land exactly on a stage boundary so a crossfade timeout is pending.
    advance(NARRATION_STAGES[1].afterSeconds * 1000)
    expect(() => unmount()).not.toThrow()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('unmounting at the 130s timeout (error handoff on a long run) clears every timer', () => {
    const { unmount } = render(<AnalysisRunningBanner />)
    advancePastStage(RUN_TIMEOUT_SECONDS * 1000)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('reduced motion', () => {
  it('does not spin the icon when prefers-reduced-motion is set', () => {
    reducedMotionState.value = true
    const { container } = render(<AnalysisRunningBanner />)
    expect(container.querySelector('.animate-spin')).toBeNull()
  })

  it('spins the icon when motion is allowed', () => {
    const { container } = render(<AnalysisRunningBanner />)
    expect(container.querySelector('.animate-spin')).not.toBeNull()
  })

  it('swaps text instantly at a stage boundary (no crossfade delay)', () => {
    reducedMotionState.value = true
    render(<AnalysisRunningBanner />)
    advance(NARRATION_STAGES[1].afterSeconds * 1000)
    // No extra time for a fade: the new stage must already be displayed.
    expect(screen.getByTestId('analysis-narration')).toHaveTextContent(STAGE_2)
  })
})

describe('accessibility', () => {
  it('announces politely via role=status + aria-live=polite', () => {
    render(<AnalysisRunningBanner />)
    const banner = screen.getByTestId('analysis-running-banner')
    expect(banner).toHaveAttribute('role', 'status')
    expect(banner).toHaveAttribute('aria-live', 'polite')
  })
})
