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
    resultsStatus: 'idle',
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

    it('CEE ready with results.status="streaming" but no report → ready_to_analyse', () => {
      const view = deriveAnalysisDisplayState(
        makeInput({ ceeAnalysisReadyStatus: 'ready', resultsStatus: 'streaming' }),
      )
      expect(view.state).toBe('ready_to_analyse')
    })
  })

  describe('complete', () => {
    it('hasReport && !graphEditedSinceLastRun → complete (regardless of CEE status)', () => {
      const view = deriveAnalysisDisplayState(
        makeInput({
          ceeAnalysisReadyStatus: 'ready',
          resultsStatus: 'complete',
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

    it('hasReport beats stale CEE status (e.g. needs_user_input)', () => {
      const view = deriveAnalysisDisplayState(
        makeInput({
          ceeAnalysisReadyStatus: 'needs_user_input',
          resultsStatus: 'complete',
          hasReport: true,
          graphEditedSinceLastRun: false,
        }),
      )
      expect(view.state).toBe('complete')
    })
  })

  describe('results_stale', () => {
    it('hasReport && graphEditedSinceLastRun → results_stale', () => {
      const view = deriveAnalysisDisplayState(
        makeInput({
          ceeAnalysisReadyStatus: 'ready',
          resultsStatus: 'complete',
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

  describe('not_ready (collapses every non-ready CEE value)', () => {
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

    it('undefined CEE status with no report → not_ready', () => {
      const view = deriveAnalysisDisplayState(
        makeInput({ ceeAnalysisReadyStatus: undefined }),
      )
      expect(view.state).toBe('not_ready')
    })
  })

  describe('bug-shape regression — the exact pattern from bundle bef4470b', () => {
    // Stale resultsStatus === 'complete' lingering in the store while report
    // has been cleared (e.g. by a new draft) MUST NOT produce 'complete'. The
    // helper keys rule (1) on hasReport, not on resultsStatus.
    it('hasReport=false + resultsStatus=complete + CEE ready → ready_to_analyse, NOT complete', () => {
      const view = deriveAnalysisDisplayState(
        makeInput({
          ceeAnalysisReadyStatus: 'ready',
          resultsStatus: 'complete',
          hasReport: false,
          graphEditedSinceLastRun: false,
        }),
      )
      expect(view.state).toBe('ready_to_analyse')
      expect(view.headline).toBe('Ready to analyse')
      expect(view.headline).not.toBe('Analysis complete')
    })

    it('hasReport=false + resultsStatus=complete + CEE undefined → not_ready, NOT complete', () => {
      const view = deriveAnalysisDisplayState(
        makeInput({
          ceeAnalysisReadyStatus: undefined,
          resultsStatus: 'complete',
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
          resultsStatus: 'complete',
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
  })
})
