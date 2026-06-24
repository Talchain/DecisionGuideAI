/**
 * Results-tab freshness indicator — never fabricates 'stale'.
 *
 * Regression for the adversarial finding: the Results-tab icon previously lit the
 * warning AlertTriangle + aria-label "Analysis is stale" for displayedFreshness
 * === 'unknown' (the cannot-confirm overlay state), fabricating 'stale' at the
 * a11y layer. The decision now distinguishes a genuine CEE 'stale' (warning) from
 * cannot-confirm ('unknown' → neutral), mirroring AnalysisFreshnessNotice.
 */
import { describe, it, expect } from 'vitest'
import { deriveResultsTabFreshness } from '../resultsTabFreshness'

describe('deriveResultsTabFreshness', () => {
  it('genuine CEE stale → warning icon (reallyStale)', () => {
    expect(deriveResultsTabFreshness(true, 'stale')).toEqual({
      reallyStale: true,
      cannotConfirm: false,
      showIcon: true,
    })
  })

  it('cannot-confirm (unknown) → NEUTRAL icon, never the stale treatment', () => {
    const r = deriveResultsTabFreshness(true, 'unknown')
    expect(r).toEqual({ reallyStale: false, cannotConfirm: true, showIcon: true })
    // The whole point: 'unknown' must NOT map to the stale flag.
    expect(r.reallyStale).toBe(false)
  })

  it('fresh → no icon', () => {
    expect(deriveResultsTabFreshness(true, 'fresh')).toEqual({
      reallyStale: false,
      cannotConfirm: false,
      showIcon: false,
    })
  })

  it('none → no icon', () => {
    expect(deriveResultsTabFreshness(true, 'none')).toEqual({
      reallyStale: false,
      cannotConfirm: false,
      showIcon: false,
    })
  })

  it('null verdict (no analysis yet) → no icon', () => {
    expect(deriveResultsTabFreshness(true, null)).toEqual({
      reallyStale: false,
      cannotConfirm: false,
      showIcon: false,
    })
  })

  it('aiPanelV2 disabled → no icon regardless of verdict (FF-gated)', () => {
    for (const v of ['stale', 'unknown', 'fresh', 'none', null] as const) {
      expect(deriveResultsTabFreshness(false, v)).toEqual({
        reallyStale: false,
        cannotConfirm: false,
        showIcon: false,
      })
    }
  })
})
