/**
 * F9 (UI brief 2026-07-16 item 3): run-state coverage outside the Analysis
 * tab consumes ONE trust surface. `useAnalysisTrust` already answers
 * `isRunning`; the reused running banner also needs the run's true start
 * time (the store's `results.startedAt`) so its narration clock reports the
 * age of the RUN, not the age of the component (the #327 round-2 regression
 * class). That field joins the trust composition here, its designated home,
 * rather than minting a parallel run-state hook.
 */
import { describe, it, expect } from 'vitest'

import { computeAnalysisTrust } from '../useAnalysisTrust'

describe('F9: analysis trust composition carries the run clock', () => {
  it('exposes runStartedAt from the results startedAt input', () => {
    const trust = computeAnalysisTrust({
      freshness: null,
      dirty: false,
      source: 'none',
      resultsStatus: 'streaming',
      resultsStartedAt: 1_700_000_000_000,
    })

    expect(trust.isRunning).toBe(true)
    expect(trust.runStartedAt).toBe(1_700_000_000_000)
  })

  it('leaves runStartedAt undefined when no run has ever started', () => {
    const trust = computeAnalysisTrust({
      freshness: null,
      dirty: false,
      source: 'none',
      resultsStatus: 'idle',
    })

    expect(trust.isRunning).toBe(false)
    expect(trust.runStartedAt).toBeUndefined()
  })
})
