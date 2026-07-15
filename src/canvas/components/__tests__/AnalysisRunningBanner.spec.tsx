/**
 * Wave1-L2 (seam D-M): staged honest narration during the analysis wait.
 *
 * The banner must progress through time-based, honest, non-specific
 * narration stages while a run is in flight:
 *   - no fabricated progress percentages or scenario counts
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

const STAGE_1 = 'Setting up your analysis…'
const STAGE_2 = 'Running robustness simulations…'
const STAGE_3 = 'Weighing what moves your decision…'
const STAGE_4 = 'Almost there — shaping the results…'

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
  vi.useFakeTimers()
})

describe('narrationForElapsed (pure stage resolution)', () => {
  it('returns the first stage at 0s and just before the second threshold', () => {
    expect(narrationForElapsed(0)).toBe(STAGE_1)
    expect(narrationForElapsed(NARRATION_STAGES[1].afterSeconds - 1)).toBe(STAGE_1)
  })

  it('advances through every stage at its threshold', () => {
    expect(narrationForElapsed(NARRATION_STAGES[1].afterSeconds)).toBe(STAGE_2)
    expect(narrationForElapsed(NARRATION_STAGES[2].afterSeconds)).toBe(STAGE_3)
    expect(narrationForElapsed(NARRATION_STAGES[3].afterSeconds)).toBe(STAGE_4)
  })

  it('holds the final stage for long runs (no loop, no stuck blank)', () => {
    expect(narrationForElapsed(120)).toBe(STAGE_4)
    expect(narrationForElapsed(3600)).toBe(STAGE_4)
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
})

describe('AnalysisRunningBanner stage progression (fake timers)', () => {
  it('starts on the setting-up stage', () => {
    render(<AnalysisRunningBanner />)
    expect(screen.getByTestId('analysis-running-banner')).toHaveTextContent(STAGE_1)
  })

  it('progresses through all four stages as time elapses', () => {
    render(<AnalysisRunningBanner />)
    expect(screen.getByTestId('analysis-narration')).toHaveTextContent(STAGE_1)

    // Cross each threshold, then allow the crossfade swap to complete.
    advancePastStage(NARRATION_STAGES[1].afterSeconds * 1000)
    expect(screen.getByTestId('analysis-narration')).toHaveTextContent(STAGE_2)

    advancePastStage((NARRATION_STAGES[2].afterSeconds - NARRATION_STAGES[1].afterSeconds) * 1000)
    expect(screen.getByTestId('analysis-narration')).toHaveTextContent(STAGE_3)

    advancePastStage((NARRATION_STAGES[3].afterSeconds - NARRATION_STAGES[2].afterSeconds) * 1000)
    expect(screen.getByTestId('analysis-narration')).toHaveTextContent(STAGE_4)
  })

  it('holds the final stage on a long run without going blank', () => {
    render(<AnalysisRunningBanner />)
    advancePastStage(120_000)
    expect(screen.getByTestId('analysis-narration')).toHaveTextContent(STAGE_4)
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
