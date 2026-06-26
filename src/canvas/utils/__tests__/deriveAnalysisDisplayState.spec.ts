import { describe, it, expect } from 'vitest'
import {
  deriveAnalysisDisplayState,
  type DeriveAnalysisDisplayStateInput,
} from '../deriveAnalysisDisplayState'

function makeInput(
  overrides: Partial<DeriveAnalysisDisplayStateInput> = {},
): DeriveAnalysisDisplayStateInput {
  return {
    ceeAnalysisReadyStatus: undefined,
    hasReport: false,
    analysisChanged: false,
    ...overrides,
  }
}

describe('deriveAnalysisDisplayState', () => {
  describe('ready_to_analyse', () => {
    it('CEE ready with no report → ready_to_analyse', () => {
      const view = deriveAnalysisDisplayState(
        makeInput({ ceeAnalysisReadyStatus: 'ready' }),
      )
      expect(view.state).toBe('ready_to_analyse')
      expect(view.headline).toBe('Ready to analyse')
      expect(view.iconName).toBe('Play')
      expect(view.textColorClass).toBe('text-info')
      expect(view.cta).toEqual({ kind: 'primary', label: 'Run analysis' })
    })
  })

  describe('complete', () => {
    it('CEE ready + hasReport && !analysisChanged → complete', () => {
      const view = deriveAnalysisDisplayState(
        makeInput({
          ceeAnalysisReadyStatus: 'ready',
          hasReport: true,
          analysisChanged: false,
        }),
      )
      expect(view.state).toBe('complete')
      expect(view.headline).toBe('Analysis complete')
      expect(view.iconName).toBe('Check')
      expect(view.textColorClass).toBe('text-success')
      expect(view.cta).toBeNull()
    })
  })

  describe('results_stale', () => {
    it('CEE ready + hasReport && analysisChanged → results_stale', () => {
      const view = deriveAnalysisDisplayState(
        makeInput({
          ceeAnalysisReadyStatus: 'ready',
          hasReport: true,
          analysisChanged: true,
        }),
      )
      expect(view.state).toBe('results_stale')
      expect(view.headline).toBe('Results may be outdated')
      expect(view.iconName).toBe('RefreshCw')
      expect(view.textColorClass).toBe('text-warning')
      expect(view.cta).toEqual({ kind: 'secondary', label: 'Rerun analysis' })
    })
  })

  describe('not_ready (explicit non-ready CEE statuses beat prior results)', () => {
    it.each([
      ['needs_encoding'],
      ['needs_user_mapping'],
      ['needs_user_input'],
    ])('explicit CEE status %s with no report → not_ready', (status) => {
      const view = deriveAnalysisDisplayState(
        makeInput({ ceeAnalysisReadyStatus: status }),
      )
      expect(view.state).toBe('not_ready')
      expect(view.headline).toBe('Set up your model')
      expect(view.iconName).toBe('AlertCircle')
      expect(view.textColorClass).toBe('text-text-light')
      expect(view.cta).toBeNull()
    })

    // Critical precedence assertion (per brief Task 2 hierarchy item 1):
    // an explicit non-ready CEE status must beat any prior report. Real-world
    // shape: user runs analysis successfully, then deletes the goal node.
    // CEE flips to needs_user_mapping. The old report is meaningless — show
    // setup guidance, not a stale "Analysis complete" badge.
    it('explicit non-ready CEE beats stored report (regardless of stale flag)', () => {
      for (const status of ['needs_user_mapping', 'needs_user_input', 'needs_encoding']) {
        for (const stale of [false, true]) {
          const view = deriveAnalysisDisplayState(
            makeInput({
              ceeAnalysisReadyStatus: status,
              hasReport: true,
              analysisChanged: stale,
            }),
          )
          expect(view.state).toBe('not_ready')
          expect(view.headline).toBe('Set up your model')
        }
      }
    })

    it('absent readiness (undefined / "missing") with no report → not_ready', () => {
      for (const status of [undefined, 'missing', 'unknown_future_value']) {
        const view = deriveAnalysisDisplayState(
          makeInput({ ceeAnalysisReadyStatus: status }),
        )
        expect(view.state).toBe('not_ready')
      }
    })
  })

  // Absent readiness (undefined / 'missing') is NOT explicit non-ready —
  // it's "we don't know yet". A populated, current report stands on its
  // own during the brief window before CEE responds (e.g. just after
  // scenario load with persisted results). This prevents flicker from
  // 'complete' → 'not_ready' → 'complete' as readiness streams in.
  describe('absent readiness preserves prior matching results', () => {
    it('undefined readiness + hasReport + !stale → complete', () => {
      const view = deriveAnalysisDisplayState(
        makeInput({
          ceeAnalysisReadyStatus: undefined,
          hasReport: true,
          analysisChanged: false,
        }),
      )
      expect(view.state).toBe('complete')
      expect(view.headline).toBe('Analysis complete')
    })

    it('missing readiness + hasReport + !stale → complete', () => {
      const view = deriveAnalysisDisplayState(
        makeInput({
          ceeAnalysisReadyStatus: 'missing',
          hasReport: true,
          analysisChanged: false,
        }),
      )
      expect(view.state).toBe('complete')
    })

    it('undefined readiness + hasReport + stale → results_stale', () => {
      const view = deriveAnalysisDisplayState(
        makeInput({
          ceeAnalysisReadyStatus: undefined,
          hasReport: true,
          analysisChanged: true,
        }),
      )
      expect(view.state).toBe('results_stale')
    })

    it('unknown future status + hasReport + !stale → complete', () => {
      // Forward-compatible: a CEE status we don't recognise is not treated
      // as explicitly not-ready unless it's in the curated set.
      const view = deriveAnalysisDisplayState(
        makeInput({
          ceeAnalysisReadyStatus: 'some_future_value',
          hasReport: true,
          analysisChanged: false,
        }),
      )
      expect(view.state).toBe('complete')
    })
  })

  describe('bug-shape regression — bundle bef4470b pattern', () => {
    // hasReport=false + CEE ready (no run yet) MUST yield ready_to_analyse.
    // In the original bug, the canvas store's `results.status` enum was
    // stale 'complete' from a prior session while `report` had been cleared.
    // The helper consumes only `hasReport` (not the run-status enum), so
    // with hasReport=false there is no path to 'complete'.
    it('hasReport=false + CEE ready → ready_to_analyse, NOT complete', () => {
      const view = deriveAnalysisDisplayState(
        makeInput({
          ceeAnalysisReadyStatus: 'ready',
          hasReport: false,
          analysisChanged: false,
        }),
      )
      expect(view.state).toBe('ready_to_analyse')
      expect(view.headline).toBe('Ready to analyse')
      expect(view.headline).not.toBe('Analysis complete')
    })

    it('hasReport=false + CEE undefined → not_ready, NOT complete', () => {
      const view = deriveAnalysisDisplayState(
        makeInput({
          ceeAnalysisReadyStatus: undefined,
          hasReport: false,
          analysisChanged: false,
        }),
      )
      expect(view.state).toBe('not_ready')
      expect(view.headline).not.toBe('Analysis complete')
    })
  })

  describe('state transitions', () => {
    it('ready_to_analyse → complete when a run lands', () => {
      const before = deriveAnalysisDisplayState(
        makeInput({ ceeAnalysisReadyStatus: 'ready' }),
      )
      const after = deriveAnalysisDisplayState(
        makeInput({
          ceeAnalysisReadyStatus: 'ready',
          hasReport: true,
          analysisChanged: false,
        }),
      )
      expect(before.state).toBe('ready_to_analyse')
      expect(after.state).toBe('complete')
    })

    it('complete → results_stale when graph is edited', () => {
      const before = deriveAnalysisDisplayState(
        makeInput({
          ceeAnalysisReadyStatus: 'ready',
          hasReport: true,
          analysisChanged: false,
        }),
      )
      const after = deriveAnalysisDisplayState(
        makeInput({
          ceeAnalysisReadyStatus: 'ready',
          hasReport: true,
          analysisChanged: true,
        }),
      )
      expect(before.state).toBe('complete')
      expect(after.state).toBe('results_stale')
    })

    it('complete → not_ready when CEE flips to non-ready (e.g. goal deleted)', () => {
      const before = deriveAnalysisDisplayState(
        makeInput({
          ceeAnalysisReadyStatus: 'ready',
          hasReport: true,
          analysisChanged: false,
        }),
      )
      const after = deriveAnalysisDisplayState(
        makeInput({
          ceeAnalysisReadyStatus: 'needs_user_mapping',
          hasReport: true,
          analysisChanged: true,
        }),
      )
      expect(before.state).toBe('complete')
      expect(after.state).toBe('not_ready')
    })
  })
})
