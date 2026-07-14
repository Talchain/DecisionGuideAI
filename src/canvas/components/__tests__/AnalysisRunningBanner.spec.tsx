/**
 * Wave1-L2 (seam D-M) — staged honest narration during the analysis wait.
 *
 * The banner must:
 *  - progress through time-based narration stages (fake timers), with copy
 *    that never fabricates pipeline progress (no percentages, no counts);
 *  - hold the final stage without wrapping or going blank on long runs;
 *  - degrade gracefully on early completion / error: OutputsDock unmounts
 *    the banner when isRunning flips false (success or error path), so the
 *    banner must leave no timers running and cause no post-unmount updates;
 *  - respect prefers-reduced-motion: no fade animation on the narration
 *    text, spinner carries motion-reduce:animate-none;
 *  - announce via an aria-live polite status region.
 */

import { render, screen, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  AnalysisRunningBanner,
  ANALYSIS_NARRATION_STAGES,
  narrationForElapsed,
} from '../AnalysisRunningBanner'

/** Point window.matchMedia at a given prefers-reduced-motion answer. */
function mockMatchMedia(reducedMotionMatches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? reducedMotionMatches : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    }),
  })
}

afterEach(() => {
  mockMatchMedia(false)
})

describe('narrationForElapsed (pure stage resolution)', () => {
  it('resolves each stage at its threshold and holds the final stage', () => {
    const [s1, s2, s3, s4] = ANALYSIS_NARRATION_STAGES
    expect(narrationForElapsed(0)).toBe(s1.message)
    expect(narrationForElapsed(s2.afterSeconds - 1)).toBe(s1.message)
    expect(narrationForElapsed(s2.afterSeconds)).toBe(s2.message)
    expect(narrationForElapsed(s3.afterSeconds)).toBe(s3.message)
    expect(narrationForElapsed(s4.afterSeconds)).toBe(s4.message)
    // Long runs hold the last honest message — never wrap, never blank.
    expect(narrationForElapsed(300)).toBe(s4.message)
  })

  it('handles negative elapsed time gracefully', () => {
    expect(narrationForElapsed(-5)).toBe(ANALYSIS_NARRATION_STAGES[0].message)
  })
})

describe('honesty constraints on narration copy', () => {
  it('never claims percentages, counts, or pipeline specifics we cannot know', () => {
    for (const stage of ANALYSIS_NARRATION_STAGES) {
      expect(stage.message).not.toMatch(/%|\d/)
      expect(stage.message).not.toMatch(/!/)
    }
  })
})

describe('AnalysisRunningBanner staged narration', () => {
  it('progresses through the stages over time and holds the final stage', () => {
    vi.useFakeTimers()
    render(<AnalysisRunningBanner />)
    const [s1, s2, s3, s4] = ANALYSIS_NARRATION_STAGES

    expect(screen.getByTestId('analysis-narration').textContent).toBe(s1.message)

    act(() => vi.advanceTimersByTime(s2.afterSeconds * 1000))
    expect(screen.getByTestId('analysis-narration').textContent).toBe(s2.message)

    act(() => vi.advanceTimersByTime((s3.afterSeconds - s2.afterSeconds) * 1000))
    expect(screen.getByTestId('analysis-narration').textContent).toBe(s3.message)

    act(() => vi.advanceTimersByTime((s4.afterSeconds - s3.afterSeconds) * 1000))
    expect(screen.getByTestId('analysis-narration').textContent).toBe(s4.message)

    // Well past the expected 20-30s window: narration must not wrap or blank.
    act(() => vi.advanceTimersByTime(120_000))
    expect(screen.getByTestId('analysis-narration').textContent).toBe(s4.message)
  })

  it('announces via an aria-live polite status region', () => {
    render(<AnalysisRunningBanner />)
    const banner = screen.getByTestId('analysis-running-banner')
    expect(banner).toHaveAttribute('role', 'status')
    expect(banner).toHaveAttribute('aria-live', 'polite')
    expect(banner).toContainElement(screen.getByTestId('analysis-narration'))
  })

  it('early completion: unmount mid-stage leaves no timers and no post-unmount updates', () => {
    vi.useFakeTimers()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = render(<AnalysisRunningBanner />)

    act(() => vi.advanceTimersByTime(7_000))
    unmount() // OutputsDock drops the banner the moment results land

    expect(vi.getTimerCount()).toBe(0)
    act(() => vi.advanceTimersByTime(60_000))
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('error handoff: unmount from the final stage is equally clean', () => {
    vi.useFakeTimers()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = render(<AnalysisRunningBanner />)

    // Run into the final stage, then simulate the error path unmounting us
    // (OutputsDock's isRunning flips false; existing error handling owns UX).
    act(() => vi.advanceTimersByTime(60_000))
    unmount()

    expect(vi.getTimerCount()).toBe(0)
    act(() => vi.advanceTimersByTime(60_000))
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('applies a fade class to narration text when motion is allowed', () => {
    mockMatchMedia(false)
    render(<AnalysisRunningBanner />)
    expect(screen.getByTestId('analysis-narration').className).toContain('animate-fadeIn')
  })

  it('reduced motion: no fade animation on narration text, spinner is motion-reduce safe', () => {
    mockMatchMedia(true)
    render(<AnalysisRunningBanner />)
    expect(screen.getByTestId('analysis-narration').className).not.toContain('animate-fadeIn')
    const banner = screen.getByTestId('analysis-running-banner')
    const spinner = banner.querySelector('svg')
    expect(spinner?.getAttribute('class') ?? '').toContain('motion-reduce:animate-none')
  })
})
