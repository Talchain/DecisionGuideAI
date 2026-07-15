/**
 * Wave1-L2 (seam D-M): exactly ONE run-status live region.
 *
 * The dock can express run status two ways: the pre-existing slowRunMessage
 * (>=20s "Taking longer than expected...", >=40s "Still working...") and the
 * AnalysisRunningBanner narration. Both render role=status aria-live=polite.
 * Before the fix they STACKED from ~20s, making opposing progress claims in
 * exactly the window this lane targets — a screen-reader user heard both.
 *
 * The reconciliation is expressed as a single pure decision returning ONE
 * region, so rendering two is structurally impossible rather than merely
 * untested. OutputsDock drives both render sites from this function alone.
 */

import { describe, it, expect } from 'vitest'

import { runStatusRegion, type RunStatusRegion } from '../analysisRunStatus'

/** The slow-run copy the dock sets at its 20s / 40s thresholds. */
const SLOW_RUN_20S = 'Taking longer than expected...'
const SLOW_RUN_40S = 'Still working...'

describe('runStatusRegion: exactly one live region', () => {
  // The whole point: a single return value cannot name two regions at once.
  it('returns exactly one region for every reachable input combination', () => {
    const valid: RunStatusRegion[] = ['banner', 'slow-run', 'none']

    for (const isRunning of [true, false]) {
      for (const hasReport of [true, false]) {
        for (const slowRunMessage of [null, SLOW_RUN_20S, SLOW_RUN_40S]) {
          const region = runStatusRegion({ isRunning, hasReport, slowRunMessage })
          expect(valid).toContain(region)
        }
      }
    }
  })

  // P1 (three reviewers converged): at 25s with a report on screen the dock
  // rendered slowRunMessage DIRECTLY ABOVE the banner narration.
  it('at 25s with a report on screen, only the banner narrates (slow-run yields)', () => {
    expect(
      runStatusRegion({ isRunning: true, hasReport: true, slowRunMessage: SLOW_RUN_20S }),
    ).toBe('banner')
  })

  it('at 45s with a report on screen, only the banner narrates', () => {
    expect(
      runStatusRegion({ isRunning: true, hasReport: true, slowRunMessage: SLOW_RUN_40S }),
    ).toBe('banner')
  })
})

describe('no regression to the pre-existing slow-run behaviour', () => {
  // The banner only mounts when a previous report is still on screen; the
  // skeleton covers the no-report case, where slowRunMessage is still the
  // only run-status narration and must keep working exactly as before.
  it('keeps the standalone slow-run region at 25s when there is NO report', () => {
    expect(
      runStatusRegion({ isRunning: true, hasReport: false, slowRunMessage: SLOW_RUN_20S }),
    ).toBe('slow-run')
  })

  it('keeps the standalone slow-run region at 45s when there is NO report', () => {
    expect(
      runStatusRegion({ isRunning: true, hasReport: false, slowRunMessage: SLOW_RUN_40S }),
    ).toBe('slow-run')
  })
})

describe('quiet states', () => {
  it('narrates nothing before the first slow-run threshold with no report', () => {
    expect(
      runStatusRegion({ isRunning: true, hasReport: false, slowRunMessage: null }),
    ).toBe('none')
  })

  it('narrates nothing once the run completes (slow-run message cleared)', () => {
    expect(
      runStatusRegion({ isRunning: false, hasReport: true, slowRunMessage: null }),
    ).toBe('none')
  })

  // Completion/error clears slowRunMessage, but a stale value must never
  // resurrect narration for a run that is no longer in flight.
  it('narrates the slow-run line only while a run is in flight', () => {
    expect(
      runStatusRegion({ isRunning: false, hasReport: false, slowRunMessage: SLOW_RUN_20S }),
    ).toBe('none')
  })

  it('shows the banner as soon as a run starts over an existing report', () => {
    expect(
      runStatusRegion({ isRunning: true, hasReport: true, slowRunMessage: null }),
    ).toBe('banner')
  })
})
