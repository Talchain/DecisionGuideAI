/**
 * ⛔ AIQ pre-share hold, HOT turn (#75 5903550244; P0 5903544574): right after a newer partial Run, before any reload,
 * the held Run A must not read as current. A `complete_current` verdict that asks for a rerun, or carries the C2
 * contradiction, outranks its own label — the state is "changed", as after a local edit.
 */
import { describe, it, expect } from 'vitest'
import { composeAnalysisState } from '../analysisStateSelector'

// A contract-shaped verdict (the same builder the boot specs use); a partial one would fail for the wrong reason.
const wire = (extra: Record<string, unknown> = {}) => ({
  run_state: { kind: 'complete_current', computed_at: '2026-09-30T03:00:00.000Z' },
  readiness: { status: 'ready', blockers: [] },
  leader_claim: { permitted: true },
  robustness: {},
  usable_for_prose: true,
  usable_for_chips: true,
  usable_for_followup: true,
  requires_rerun: false,
  blocked_unusable: false,
  contradictions: [],
  ...extra,
})
const semantic = (analysisState: unknown) => composeAnalysisState({
  analysisState, freshness: null, dirty: false, source: undefined, resultsStatus: 'complete', resultsStartedAt: undefined,
  importHold: false, hasReport: true, hasCompletedFirstRun: true, hasRenderableResult: true, ceeAnalysisReadyStatus: undefined, aiPanelV2On: true,
} as never).semantic

describe('a newer Run that supersedes the held one outranks an older complete_current', () => {
  it('CONTROL: complete_current alone is current', () => {
    expect(semantic(wire())).toBe('current')
  })
  it('RED: requires_rerun → changed', () => {
    expect(semantic(wire({ requires_rerun: true }))).toBe('changed')
  })
  it('RED: the C2 contradiction → changed, even with requires_rerun false', () => {
    expect(semantic(wire({ requires_rerun: false, contradictions: ['fact_status_success_but_degraded_newer'] }))).toBe('changed')
  })
  it('CONTROL: an unrelated contradiction does not', () => {
    expect(semantic(wire({ contradictions: ['something_else'] }))).toBe('current')
  })
})
