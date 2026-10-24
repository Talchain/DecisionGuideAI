/**
 * ONE ANALYSIS STATUS FROM CEE'S HELD CANONICAL VIEW (canvas audit P0, 24 Oct; DL ruling).
 *
 * Measured on staging 147aaccb: Paul's funding board held a current Run (view `stale: false`) while the UI's boot proof
 * declined it, and every status surface said "not analysed" beside a "Re-run analysis" button. These rows drive the
 * REAL `useAnalysisState` over the real stores: view `stale` false / true / null × local edit no / yes, plus the
 * contrasts that keep today's behaviour (no view, a view held for another scenario, a view with no bound Run).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import { useAnalysisState } from '../analysisStateSelector'
import { selectHasRunOnRecord } from '../hasRunOnRecord'
import { canonicalRunStatus } from '../canonicalRunStatus'
import { useCanvasStore } from '../../store'
import { useCanonicalAnalysisViewStore } from '../../stores/canonicalAnalysisViewStore'
import type { CanonicalAnalysisView } from '../../runView/canonicalAnalysisView'

const SCENARIO = 'scn-one-status'

function view(stale: boolean | null, run: { run_id: string; graph_hash_at_run: string } | null = { run_id: 'run-1', graph_hash_at_run: 'gh-1' }) {
  return { run: run ? { ...run, computed_at: '2026-10-24T09:00:00Z' } : null, staleness: { stale } } as unknown as CanonicalAnalysisView
}

function seed(dirty: boolean): void {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    analysisFreshness: null,
    analysisFreshnessDirty: dirty,
    analysisStateV1: null,
    hasCompletedFirstRun: false,
    importPendingServerRegistration: false,
    results: { status: 'idle' } as never,
  })
}

const semantic = () => renderHook(() => useAnalysisState()).result.current.semantic

beforeEach(() => {
  useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
})

describe('the held view is the one authority on its Run', () => {
  it.each([
    [false, false, 'current'],
    [true, false, 'changed'],
    [null, false, 'cannot_confirm'],
    [false, true, 'changed'],
    [true, true, 'changed'],
    [null, true, 'cannot_confirm'],
  ] as const)('view stale=%s, local edit=%s → %s', (stale, dirty, expected) => {
    seed(dirty)
    useCanonicalAnalysisViewStore.setState({ scenarioId: SCENARIO, view: view(stale) })
    expect(semantic()).toBe(expected)
  })

  it('stale: null is never current, and never "not analysed"', () => {
    seed(false)
    useCanonicalAnalysisViewStore.setState({ scenarioId: SCENARIO, view: view(null) })
    const s = semantic()
    expect(s).not.toBe('current')
    expect(s).not.toBe('never_run')
  })

  it('a wire never_run beside a bound Run is set aside', () => {
    seed(false)
    useCanvasStore.setState({ analysisStateV1: { run_state: { kind: 'never_run' } } as unknown as AnalysisStateV1 })
    useCanonicalAnalysisViewStore.setState({ scenarioId: SCENARIO, view: view(false) })
    expect(semantic()).toBe('current')
  })
})

describe('contrast: no bound view keeps today\'s behaviour', () => {
  it('no view → none, as before', () => {
    seed(false)
    expect(semantic()).toBe('none')
  })

  it('a view held for another scenario does not bind', () => {
    seed(false)
    useCanonicalAnalysisViewStore.setState({ scenarioId: 'another', view: view(false) })
    expect(semantic()).toBe('none')
  })

  it('a view with no Run id or graph hash does not bind', () => {
    seed(false)
    useCanonicalAnalysisViewStore.setState({ scenarioId: SCENARIO, view: view(false, null) })
    expect(semantic()).toBe('none')
    expect(canonicalRunStatus(view(false, { run_id: 'run-1', graph_hash_at_run: '' }))).toBeNull()
  })

  it('the UI\'s own established verdict is never overwritten by the view', () => {
    seed(false)
    useCanvasStore.setState({ hasCompletedFirstRun: true, analysisFreshness: { freshness: 'stale', freshnessReason: 'own' } as never })
    useCanonicalAnalysisViewStore.setState({ scenarioId: SCENARIO, view: view(false) })
    expect(semantic()).toBe('changed')
  })
})

describe('run control: a bound Run is a Run on record', () => {
  it.each([
    ['current', true],
    ['stale', true],
    ['unknown', true],
    [null, false],
  ] as const)('view status %s → run on record %s', (status, expected) => {
    expect(selectHasRunOnRecord({ hasCompletedFirstRun: false, analysisStateV1: null }, status)).toBe(expected)
  })
})
