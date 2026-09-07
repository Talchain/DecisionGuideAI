/**
 * ⭐⭐ THE STORE READ THAT DRIVES THE RENDERED CTA — pinned at the HOOK.
 *
 * A seat found that a mutant on `analysisStateSelector.ts`'s
 * `useCanvasStore(selectHasAnyRealProbability)` **survived 1,430 tests**. My
 * earlier pins covered a store read — the run announcer's — just not this one,
 * and this is the one a user meets.
 *
 * WHY IT MATTERS, derived rather than assumed. `StickyFooter` is the SOLE
 * product consumer of `useAnalysisDisplayState`, and it reads only
 * `view.cta?.label` and `view.cta?.kind`. So the CTA is the whole of this
 * hook's user-visible output:
 *
 *   complete            → cta: null    → label falls back, renders "Analyse now" (primary)
 *   ran_without_result  → cta: {...}   → renders "Rerun analysis" (secondary)
 *
 * A hard-coded `true` at that store read collapses the second into the first,
 * and the user is offered a primary "Analyse now" over a run that produced
 * nothing — which is the defect this PR exists to end, arriving through the one
 * field the surface actually reads.
 *
 * ⚠ WHY AT THE HOOK AND NOT AT `composeAnalysisState`. The pure function was
 * already pinned, and that pin passed with the store read hard-coded — it is
 * one layer below the wiring it claimed to cover. These tests render the hook
 * against a mocked store so the subscription itself is load-bearing.
 *
 * SCOPE (CLAUDE.md trap 3): these assert the hook's returned CTA object. They
 * prove the value reaching `StickyFooter`, not its rendered pixels.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { create, type StoreApi, type UseBoundStore } from 'zustand'

interface MockCanvasState {
  ceeAnalysisReady: { status?: string } | null
  results: { status: string; report: unknown } | null
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

import { useAnalysisState } from '../analysisStateSelector'

/** A report the product CAN render — a real win probability. */
const RENDERABLE = { option_comparison: [{ id: 'opt-a', win_probability: 0.62 }] }
/** Populated, and carrying nothing renderable — the engine's "I failed" shape. */
const EMPTY = { option_comparison: [{ id: 'opt-a', win_probability: null }] }

function makeStore(report: unknown) {
  return create<MockCanvasState>(() => ({
    ceeAnalysisReady: { status: 'ready' },
    results: { status: 'complete', report },
    // A locally-confident fresh verdict, held constant across the pair so the
    // ONLY variable between the two cases is the report's contents.
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
    analysisFreshnessDirty: false,
    analysisStateV1: null,
    importPendingServerRegistration: false,
    currentScenarioId: 'scenario-1',
    v5AnalysisFact: null,
  }))
}

const ctaFor = (report: unknown) => {
  store = makeStore(report)
  const { result } = renderHook(() => useAnalysisState())
  return { state: result.current.displayState.state, cta: result.current.displayState.cta }
}

describe('useAnalysisState — the store read reaches the CTA StickyFooter renders', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('⭐ a report with nothing renderable yields the secondary Rerun CTA', () => {
    // A mutant hard-coding the store read to `true` collapses this into the
    // case below and REDs here — which is the whole point of this file.
    const out = ctaFor(EMPTY)
    expect(out.state).toBe('ran_without_result')
    expect(out.cta).toEqual({ kind: 'secondary', label: 'Rerun analysis' })
  })

  it('⭐ THE TWIN: the identical run WITH a renderable result offers no CTA', () => {
    const out = ctaFor(RENDERABLE)
    expect(out.state).toBe('complete')
    expect(out.cta).toBeNull()
  })

  it('the pair actually DIFFER — the subscription is load-bearing', () => {
    // Asserted directly, so a change that makes both cases agree REDs here even
    // if someone relaxes the two expectations above.
    const empty = ctaFor(EMPTY)
    const full = ctaFor(RENDERABLE)
    expect(empty.state).not.toBe(full.state)
    expect(empty.cta).not.toEqual(full.cta)
  })

  it('PRECONDITION: the two fixtures differ ONLY in renderability', () => {
    // Both are `status: 'complete'` with a POPULATED report and the same
    // freshness. If a future edit made them differ in some other way, the pair
    // above would still pass while testing something else.
    const a = makeStore(EMPTY).getState()
    const b = makeStore(RENDERABLE).getState()
    expect(a.results?.status).toBe(b.results?.status)
    expect(a.results?.report).not.toBeNull()
    expect(b.results?.report).not.toBeNull()
    expect(a.analysisFreshness).toEqual(b.analysisFreshness)
  })
})
