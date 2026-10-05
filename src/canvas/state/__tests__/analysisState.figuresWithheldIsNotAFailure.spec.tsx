/**
 * ⭐ GATE 2 CONSUMER (DL 0df0e1, 5 Oct; Acceptance #87 5987804248, scenario 9b9a4b81, UI ecdfb7ed): a completed Run
 * whose figures the producer WITHHELD — and said so with a typed code — was headlined and announced as
 * "Analysis finished without a result", in warning colour, offering a Rerun that would withhold them again.
 *
 * Science (5 Oct): the carrier is the report's `inference_warnings[]` entry whose `code` ∈ `GOAL_FIGURES_WITHHELD_CODES`
 * ("the code decides, never the words"); completed vs failed is the Run's status, never missing numbers. The UI mirrors
 * the set in one place (`goalIdentityWithheld.ts`), read by `selectRunWithholdsFigures`.
 *
 * Rows are discriminating pairs: each withheld case beside the identical input without the code.
 */
import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { create, type StoreApi, type UseBoundStore } from 'zustand'

interface MockCanvasState {
  ceeAnalysisReady: { status?: string } | null
  results: { status: string; report: unknown; settledWithoutNewReport?: boolean } | null
  analysisFreshness: unknown
  analysisFreshnessDirty: boolean
  analysisStateV1: null
  importPendingServerRegistration: boolean
  currentScenarioId: string | null
  v5AnalysisFact: unknown
}
let store: UseBoundStore<StoreApi<MockCanvasState>>
vi.mock('../../store', () => ({
  get useCanvasStore() {
    return store
  },
}))
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isV5CanonicalAnalysisEnabled: () => false,
}))

import { composeAnalysisState, useAnalysisState } from '../analysisStateSelector'
import { deriveAnalysisDisplayState } from '../../utils/deriveAnalysisDisplayState'
import { selectRunWithholdsFigures } from '../../ui/inspector-v2/useAnalysisResults'
import { GOAL_FIGURES_WITHHELD_CODES } from '../../../components/results/utils/goalIdentityWithheld'
import {
  runAnnouncementForTransition,
  RUN_FINISHED_FIGURES_WITHHELD_COPY,
  RUN_FINISHED_WITHOUT_RESULT_COPY,
} from '../../components/analysisRunStatus'

const WITHHELD_HEADLINE = 'Analysis finished: figures not shown yet'
const FAILURE_HEADLINE = 'Analysis finished without a result'
/** Nothing renderable, and the producer says why with a typed code (the exploratory withhold, CEE #2371). */
const WITHHELD = {
  option_comparison: [{ id: 'opt-a', win_probability: null }],
  inference_warnings: [{ code: 'GOAL_FIGURES_TARGET_NOT_TESTABLE', node_ids: ['goal'], message: 'Not shown. Your target can’t be tested yet.' }],
}
/** The same report with no typed reason: the engine's "I failed" shape. */
const EMPTY = { option_comparison: [{ id: 'opt-a', win_probability: null }] }

describe('selectRunWithholdsFigures reads the typed code set, never the words', () => {
  it.each(GOAL_FIGURES_WITHHELD_CODES.map((c) => [c]))('%s → withheld', (code) => {
    expect(selectRunWithholdsFigures({ results: { status: 'complete', report: { inference_warnings: [{ code, message: 'Not shown.' }] } } })).toBe(true)
  })
  it.each([
    ['no warnings', EMPTY],
    ['a disclosing code that withholds nothing (EDGE_STRENGTH_CLAMPED)', { inference_warnings: [{ code: 'EDGE_STRENGTH_CLAMPED', message: 'Not shown.' }] }],
    ['the words without the code', { inference_warnings: [{ message: 'Not shown. Your target can’t be tested yet.' }] }],
  ])('CONTROL: %s → not withheld', (_n, report) => {
    expect(selectRunWithholdsFigures({ results: { status: 'complete', report } })).toBe(false)
  })
})

// ⛔ Codex #2494 P1: the withhold belongs to the Run that DELIVERED the report. A retained report under any other status, or
// restored by a resultless settle (abort or timeout), is not this Run's withhold: today's headline and its Rerun stay.
describe('only a completed Run whose report arrived with it', () => {
  it.each(['error', 'cancelled', 'preparing', 'connecting', 'streaming', 'idle'])('RED: status %s, same withheld report → not withheld', (status) => {
    expect(selectRunWithholdsFigures({ results: { status, report: WITHHELD } })).toBe(false)
  })
  it('RED: a settle that restored the earlier report → not withheld', () => {
    expect(selectRunWithholdsFigures({ results: { status: 'complete', settledWithoutNewReport: true, report: WITHHELD } })).toBe(false)
  })
  it('CONTROL: completed, delivered with this Run → withheld', () => {
    expect(selectRunWithholdsFigures({ results: { status: 'complete', settledWithoutNewReport: false, report: WITHHELD } })).toBe(true)
  })
})

describe('the headline: a withheld Run finished; it did not fail', () => {
  const base = { ceeAnalysisReadyStatus: 'ready', hasReport: true, analysisChanged: false, hasRenderableResult: false }
  it('RED: withheld → the honest headline, neutral, no Rerun', () => {
    const v = deriveAnalysisDisplayState({ ...base, figuresWithheld: true } as never)
    expect(v).toMatchObject({ state: 'ran_without_result', headline: WITHHELD_HEADLINE, iconName: 'Check', textColorClass: 'text-text-light', cta: null })
  })
  it('CONTROL: the same Run without the code → the failure headline and its Rerun, as before', () => {
    const v = deriveAnalysisDisplayState({ ...base } as never)
    expect(v).toMatchObject({ state: 'ran_without_result', headline: FAILURE_HEADLINE, cta: { kind: 'secondary', label: 'Rerun analysis' } })
  })
  it('CONTROL: a renderable result is complete whatever the code says', () => {
    expect(deriveAnalysisDisplayState({ ...base, hasRenderableResult: true, figuresWithheld: true } as never).state).toBe('complete')
  })
})

describe('the flag reaches the headline through the selector and the store', () => {
  const COMPLETED_RUN = {
    analysisState: null, freshness: 'fresh' as const, dirty: false, source: 'legacy' as const, resultsStatus: 'complete',
    resultsStartedAt: 1_760_000_000_000, importHold: false, hasReport: true, ceeAnalysisReadyStatus: 'ready', aiPanelV2On: true,
  }
  it('RED: composeAnalysisState passes figuresWithheld to the headline', () => {
    expect(composeAnalysisState({ ...COMPLETED_RUN, hasRenderableResult: false, figuresWithheld: true } as never).displayState.headline).toBe(WITHHELD_HEADLINE)
    expect(composeAnalysisState({ ...COMPLETED_RUN, hasRenderableResult: false } as never).displayState.headline).toBe(FAILURE_HEADLINE)
  })

  const seed = (report: unknown, settledWithoutNewReport?: boolean) => {
    store = create<MockCanvasState>(() => ({
      ceeAnalysisReady: { status: 'ready' }, results: { status: 'complete', report, ...(settledWithoutNewReport === undefined ? {} : { settledWithoutNewReport }) },
      analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' }, analysisFreshnessDirty: false,
      analysisStateV1: null, importPendingServerRegistration: false, currentScenarioId: 'scenario-1', v5AnalysisFact: null,
    }))
  }
  const headlineFor = (report: unknown, settledWithoutNewReport?: boolean) => {
    seed(report, settledWithoutNewReport)
    return renderHook(() => useAnalysisState()).result.current.displayState.headline
  }
  it('RED: the store-bound hook reads the report\'s typed code', () => {
    expect(headlineFor(WITHHELD)).toBe(WITHHELD_HEADLINE)
  })
  it('CONTROL: the same report without the code keeps the failure headline', () => {
    expect(headlineFor(EMPTY)).toBe(FAILURE_HEADLINE)
  })
  it('RED: a settle that restored the earlier withheld report keeps the failure headline and its Rerun', () => {
    seed(WITHHELD, true)
    const view = renderHook(() => useAnalysisState()).result.current.displayState
    expect(view.headline).toBe(FAILURE_HEADLINE)
    expect(view.cta).toEqual({ kind: 'secondary', label: 'Rerun analysis' })
  })
  // P2: ONE mounted hook follows the store both ways — the memo must depend on the flag, not only on the report's content.
  it('RED: one mounted hook follows the code arriving and leaving', () => {
    seed(EMPTY)
    const { result } = renderHook(() => useAnalysisState())
    expect(result.current.displayState.headline).toBe(FAILURE_HEADLINE)
    act(() => { store.setState({ results: { status: 'complete', report: WITHHELD } }) })
    expect(result.current.displayState.headline).toBe(WITHHELD_HEADLINE)
    act(() => { store.setState({ results: { status: 'complete', report: EMPTY } }) })
    expect(result.current.displayState.headline).toBe(FAILURE_HEADLINE)
  })
})

describe('the announcement says the same', () => {
  const settle = { transition: 'settle' as const, settledStatus: 'complete', preRunStatus: 'complete', analysisTabFronted: false, hasRenderableResult: false }
  it('RED: withheld → "Analysis finished: figures not shown yet."', () => {
    expect(runAnnouncementForTransition({ ...settle, figuresWithheld: true } as never)).toBe(RUN_FINISHED_FIGURES_WITHHELD_COPY)
  })
  it('CONTROL: without the code → the failure copy, as before', () => {
    expect(runAnnouncementForTransition({ ...settle } as never)).toBe(RUN_FINISHED_WITHOUT_RESULT_COPY)
  })
  it('the two surfaces share one vocabulary', () => {
    expect(RUN_FINISHED_FIGURES_WITHHELD_COPY).toBe(`${WITHHELD_HEADLINE}.`)
  })
})
