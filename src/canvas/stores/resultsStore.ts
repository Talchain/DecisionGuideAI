/**
 * Results Store - Manages analysis results state
 *
 * Extracted from src/canvas/store.ts for better modularity.
 * See docs/STORE_MODULARIZATION_PLAN.md for migration details.
 */
import { create } from 'zustand'
import type { ReportV1 } from '../../adapters/plot/types'
import type { CeeDecisionReviewPayload, CeeTraceMeta, CeeErrorViewModel } from '../decisionReview/types'
import type { CeeDebugHeaders } from '../utils/ceeDebugHeaders'

// Results panel state machine
export type ResultsStatus = 'idle' | 'preparing' | 'connecting' | 'streaming' | 'complete' | 'error' | 'cancelled'

export interface ResultsState {
  status: ResultsStatus
  progress: number              // 0..100 (cap 90 until COMPLETE)
  runId?: string
  isDuplicateRun?: boolean      // v1.2: true if this run hash already existed in history
  wasForced?: boolean           // v1.2: true if this was a forced rerun (suppresses duplicate toast)
  seed?: number
  hash?: string                 // response_hash
  report?: ReportV1 | null
  error?: { code: string; message: string; retryAfter?: number; request_id?: string } | null
  startedAt?: number
  finishedAt?: number
  drivers?: Array<{ kind: 'node' | 'edge'; id: string }>
}

export type SseDiagnostics = {
  resumes: number
  trims: 0 | 1
  recovered_events: number
  correlation_id: string
}

export type RunMetaState = {
  diagnostics?: SseDiagnostics
  correlationIdHeader?: string
  degraded?: boolean
  ceeReview?: CeeDecisionReviewPayload | null
  ceeTrace?: CeeTraceMeta | null
  ceeError?: CeeErrorViewModel | null
  ceeDebugHeaders?: CeeDebugHeaders // Phase 1 Section 4.1: Dev-only debug headers
}

export interface ResultsStoreState {
  results: ResultsState
  runMeta: RunMetaState
  hasCompletedFirstRun: boolean  // True after at least one successful or restored run in this session
}

export interface ResultsActions {
  // Results lifecycle actions
  resultsStart: (params: { seed: number; wasForced?: boolean }) => void
  resultsConnecting: (runId: string) => void
  resultsProgress: (percent: number) => void
  resultsComplete: (params: {
    report: ReportV1
    hash: string
    drivers?: Array<{ kind: 'node' | 'edge'; id: string }>
    ceeReview?: CeeDecisionReviewPayload | null
    ceeTrace?: CeeTraceMeta | null
    ceeError?: CeeErrorViewModel | null
  }) => void
  resultsError: (params: { code: string; message: string; retryAfter?: number; request_id?: string }) => void
  resultsCancelled: () => void
  resultsReset: () => void
  setRunMeta: (meta: Partial<RunMetaState>) => void
  setHasCompletedFirstRun: (value: boolean) => void
  setIsDuplicateRun: (value: boolean) => void
}

const initialResultsState: ResultsStoreState = {
  results: {
    status: 'idle',
    progress: 0,
  },
  runMeta: {},
  hasCompletedFirstRun: false,
}

export const useResultsStore = create<ResultsStoreState & ResultsActions>((set, get) => ({
  ...initialResultsState,

  resultsStart: ({ seed, wasForced }) => {
    set({
      results: {
        status: 'preparing',
        progress: 0,
        seed,
        wasForced,
        startedAt: Date.now(),
        error: undefined,
        report: undefined,
        hash: undefined,
        runId: undefined,
        finishedAt: undefined,
        drivers: undefined,
        isDuplicateRun: undefined
      }
    })
  },

  resultsConnecting: (runId) => {
    set(s => ({
      results: {
        ...s.results,
        status: 'connecting',
        runId,
        progress: Math.max(s.results.progress, 5)
      }
    }))
  },

  resultsProgress: (percent) => {
    set(s => ({
      results: {
        ...s.results,
        status: 'streaming',
        // Cap at 90% until complete event arrives
        progress: Math.min(percent, 90)
      }
    }))
  },

  resultsComplete: ({ report, hash, drivers, ceeReview, ceeTrace, ceeError }) => {
    const finishedAt = Date.now()

    set(s => ({
      results: {
        ...s.results,
        status: 'complete',
        progress: 100,
        report,
        hash,
        drivers,
        finishedAt,
        error: undefined
      },
      runMeta: {
        ...s.runMeta,
        ceeReview: ceeReview ?? null,
        ceeTrace: ceeTrace ?? null,
        ceeError: ceeError ?? null
      },
      hasCompletedFirstRun: true
    }))
  },

  resultsError: ({ code, message, retryAfter, request_id }) => {
    set(s => ({
      results: {
        ...s.results,
        status: 'error',
        error: { code, message, retryAfter, request_id },
        finishedAt: Date.now()
      }
    }))
  },

  resultsCancelled: () => {
    set(s => ({
      results: {
        ...s.results,
        status: 'cancelled',
        finishedAt: Date.now()
      }
    }))
  },

  resultsReset: () => {
    set({
      results: {
        status: 'idle',
        progress: 0
      }
    })
  },

  setRunMeta: (meta) => {
    set(s => ({
      runMeta: {
        ...s.runMeta,
        ...meta
      }
    }))
  },

  setHasCompletedFirstRun: (value) => {
    set({ hasCompletedFirstRun: value })
  },

  setIsDuplicateRun: (value) => {
    set(s => ({
      results: {
        ...s.results,
        isDuplicateRun: value
      }
    }))
  },
}))

// Selectors
export const selectResultsStatus = (state: ResultsStoreState) => state.results.status
export const selectResultsProgress = (state: ResultsStoreState) => state.results.progress
export const selectResultsReport = (state: ResultsStoreState) => state.results.report
export const selectResultsError = (state: ResultsStoreState) => state.results.error
export const selectResultsHash = (state: ResultsStoreState) => state.results.hash
export const selectHasCompletedFirstRun = (state: ResultsStoreState) => state.hasCompletedFirstRun
