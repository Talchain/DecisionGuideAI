/**
 * Wave1-L2 (seam D-M): exactly ONE run-status region — now on every run.
 *
 * ⚠ These tests were REWRITTEN, and one of them previously pinned the defect
 * as correct behaviour. The old suite asserted:
 *
 *     it('narrates nothing before the first slow-run threshold with no report')
 *       → expect(runStatusRegion({ isRunning: true, hasReport: false,
 *                                  slowRunMessage: null })).toBe('none')
 *
 * That is the first-run silence, written down as a guarantee. It was an
 * honest description of the code at the time — the suite was defending the
 * "no regression to the pre-existing slow-run behaviour" of the stacking fix
 * — but it meant the gap had a green test standing over it, which is why it
 * survived. Recording that here rather than quietly deleting the case: the
 * suite that pins a behaviour is where a future reader looks to find out
 * whether the behaviour was intended.
 *
 * The contract now: while a run is in flight the banner narrates, first run
 * or not; when it is not, nothing does. The dock's own 20s/40s slow-run copy
 * is deleted (a second stage table for the same thresholds, and the surviving
 * one made a comparative claim NARRATION_STAGES had already rejected), so
 * 'slow-run' is no longer a reachable region.
 */

import { describe, it, expect } from 'vitest'

import { runStatusRegion, type RunStatusRegion } from '../analysisRunStatus'

describe('runStatusRegion: exactly one region', () => {
  // The whole point: a single return value cannot name two regions at once.
  it('returns exactly one valid region for every reachable input', () => {
    const valid: RunStatusRegion[] = ['banner', 'none']

    for (const isRunning of [true, false]) {
      expect(valid).toContain(runStatusRegion({ isRunning }))
    }
  })
})

describe('a run in flight always narrates', () => {
  // THE regression pin. Under the old rule this input — a first run, nothing
  // on screen yet — returned 'none', and the user watched an undifferentiated
  // skeleton for 20 seconds.
  it('narrates from the first moment of a run, with or without a previous report', () => {
    expect(runStatusRegion({ isRunning: true })).toBe('banner')
  })

  // The old signature took `hasReport` and `slowRunMessage`, and the region
  // it returned depended on both. Nothing about WHICH run this is can change
  // the answer any more — that dependency was the bug, so its absence is
  // what this suite defends.
  it('depends on nothing except whether a run is in flight', () => {
    const running = runStatusRegion({ isRunning: true })
    const idle = runStatusRegion({ isRunning: false })

    expect(running).toBe('banner')
    expect(idle).toBe('none')
    expect(running).not.toBe(idle)
  })
})

describe('quiet states', () => {
  it('narrates nothing once the run is no longer in flight', () => {
    expect(runStatusRegion({ isRunning: false })).toBe('none')
  })
})
