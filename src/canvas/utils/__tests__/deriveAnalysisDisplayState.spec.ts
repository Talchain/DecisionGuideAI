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
    graphEditedSinceLastRun: false,
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
    it('CEE ready + hasReport && !graphEditedSinceLastRun → complete', () => {
      const view = deriveAnalysisDisplayState(
        makeInput({
          ceeAnalysisReadyStatus: 'ready',
          hasReport: true,
          graphEditedSinceLastRun: false,
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
    it('CEE ready + hasReport && graphEditedSinceLastRun → results_stale', () => {
      const view = deriveAnalysisDisplayState(
        makeInput({
          ceeAnalysisReadyStatus: 'ready',
          hasReport: true,
          graphEditedSinceLastRun: true,
        }),
      )
      expect(view.state).toBe('results_stale')
      expect(view.headline).toBe('Results may be outdated')
      expect(view.iconName).toBe('RefreshCw')
      expect(view.textColorClass).toBe('text-warning')
      expect(view.cta).toEqual({ kind: 'secondary', label: 'Rerun analysis' })
    })
  })

  describe('not_ready (precedence: CEE non-ready beats every other state)', () => {
    it.each([
      ['needs_encoding'],
      ['needs_user_mapping'],
      ['needs_user_input'],
      ['missing'],
      ['unknown_future_value'],
    ])('CEE status %s with no report → not_ready', (status) => {
      const view = deriveAnalysisDisplayState(
        makeInput({ ceeAnalysisReadyStatus: status }),
      )
      expect(view.state).toBe('not_ready')
      expect(view.headline).toBe('Set up your model')
      expect(view.iconName).toBe('AlertCircle')
      expect(view.textColorClass).toBe('text-text-light')
      expect(view.cta).toBeNull()
    })

    it('undefined CEE status → not_ready', () => {
      const view = deriveAnalysisDisplayState(
        makeInput({ ceeAnalysisReadyStatus: undefined }),
      )
      expect(view.state).toBe('not_ready')
    })

    // Critical precedence assertion (per brief Task 2 hierarchy item 1):
    // a non-ready CEE status must beat any prior report. Real-world shape:
    // user runs analysis successfully, then deletes the goal node. CEE flips
    // to needs_user_mapping. The old report is meaningless — show setup
    // guidance, not a stale "Analysis complete" badge.
    it('non-ready CEE beats stored report (regardless of stale flag)', () => {
      for (const status of ['needs_user_mapping', 'needs_user_input', 'needs_encoding']) {
        for (const stale of [false, true]) {
          const view = deriveAnalysisDisplayState(
            makeInput({
              ceeAnalysisReadyStatus: status,
              hasReport: true,
              graphEditedSinceLastRun: stale,
            }),
          )
          expect(view.state).toBe('not_ready')
          expect(view.headline).toBe('Set up your model')
        }
      }
    })
  })

  describe('bug-shape regression — bundle bef4470b pattern', () => {
    // hasReport=false + CEE ready (no run yet) MUST yield ready_to_analyse
    // even when results.status enum is stale 'complete' from a prior session.
    // The helper now ignores resultsStatus entirely, so the only signal that
    // could falsely produce 'complete' is hasReport — which is false here.
    it('hasReport=false + CEE ready → ready_to_analyse, NOT complete', () => {
      const view = deriveAnalysisDisplayState(
        makeInput({
          ceeAnalysisReadyStatus: 'ready',
          hasReport: false,
          graphEditedSinceLastRun: false,
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
          graphEditedSinceLastRun: false,
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
          graphEditedSinceLastRun: false,
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
          graphEditedSinceLastRun: false,
        }),
      )
      const after = deriveAnalysisDisplayState(
        makeInput({
          ceeAnalysisReadyStatus: 'ready',
          hasReport: true,
          graphEditedSinceLastRun: true,
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
          graphEditedSinceLastRun: false,
        }),
      )
      const after = deriveAnalysisDisplayState(
        makeInput({
          ceeAnalysisReadyStatus: 'needs_user_mapping',
          hasReport: true,
          graphEditedSinceLastRun: true,
        }),
      )
      expect(before.state).toBe('complete')
      expect(after.state).toBe('not_ready')
    })
  })
})
