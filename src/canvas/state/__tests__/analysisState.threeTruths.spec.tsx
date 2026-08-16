/**
 * THE THREE-TRUTHS WINDOW — the acceptance test for "is it actually plugged in?".
 *
 * WHAT THE REVIEW MEASURED, and what this exists to keep closed: on ONE refused
 * turn, three surfaces disagreed simultaneously —
 *
 *   · the freshness strip said the analysis was CURRENT,
 *   · the hero said "Analysis complete",
 *   · the selector said the result was outdated.
 *
 * Every one of them was internally correct. Each read a different subset of the
 * payload, and nothing gated any other. Composing a verdict in the selector did
 * NOT fix that by itself: until each surface reads the composed verdict, the fix
 * is dark and the suite stays green while the product contradicts itself.
 *
 * SO THIS SPEC ASSERTS THE WIRING, NOT THE COMPOSITION. The composition is
 * covered by `analysisStateSelector.spec.ts`; these cases drive the store the
 * way a turn does and check the three CONSUMER surfaces agree. Revert any one
 * of the re-points and the corresponding case REDs — which is the property the
 * review asked for and the one a green unit suite cannot supply.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, renderHook, act } from '@testing-library/react'
import { create, type StoreApi, type UseBoundStore } from 'zustand'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

interface MockCanvasState {
  ceeAnalysisReady: { status?: string } | null
  results: { status: string; report: unknown; hash?: string | null; startedAt?: number } | null
  analysisFreshness: any
  analysisFreshnessDirty: boolean
  analysisStateV1: AnalysisStateV1 | null
  importPendingServerRegistration: boolean
  currentScenarioId: string | null
  v5AnalysisFact: any
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
import { useAnalysisDisplayState } from '../../hooks/useAnalysisDisplayState'
import { useAnalysisTrust } from '../../hooks/useAnalysisTrust'
import { useEditConfirmation } from '../../ui/inspector-v2/useEditConfirmation'
import { AnalysisFreshnessNotice } from '../../../components/results/AnalysisFreshnessNotice'

/**
 * A session that has a RESULT ON SCREEN and a locally-confident fresh verdict —
 * i.e. the state in which every legacy derivation says "all good". Any
 * disagreement below is therefore attributable to the wire verdict, not to a
 * fixture that was already unhealthy.
 */
function makeStore(analysisStateV1: AnalysisStateV1 | null) {
  return create<MockCanvasState>(() => ({
    ceeAnalysisReady: { status: 'ready' },
    results: { status: 'complete', report: { ok: true }, hash: 'h1', startedAt: 1_760_000_000_000 },
    analysisFreshness: {
      freshness: 'fresh',
      freshnessReason: 'graph_hash_match',
      graphHashAtRun: 'h',
      currentGraphHash: 'h',
    },
    analysisFreshnessDirty: false,
    analysisStateV1,
    importPendingServerRegistration: false,
    currentScenarioId: 's1',
    v5AnalysisFact: null,
  }))
}

function verdict(over: Partial<AnalysisStateV1> = {}): AnalysisStateV1 {
  return {
    run_state: { kind: 'complete_current', computed_at: '2026-08-16T10:00:00.000Z' },
    readiness: { status: 'ready', blockers: [] },
    leader_claim: { permitted: true },
    robustness: {},
    usable_for_prose: true,
    usable_for_chips: true,
    usable_for_followup: true,
    requires_rerun: false,
    blocked_unusable: false,
    contradictions: [],
    ...over,
  } as AnalysisStateV1
}

/** The three consumer surfaces, read exactly as the product reads them. */
function readSurfaces() {
  const selector = renderHook(() => useAnalysisState()).result.current
  const hero = renderHook(() => useAnalysisDisplayState()).result.current
  const trust = renderHook(() => useAnalysisTrust()).result.current
  return { selector, hero, trust }
}

describe('three-truths window — a refused turn', () => {
  beforeEach(() => {
    store = makeStore(
      verdict({ run_state: { kind: 'refused', reason_code: 'analysis_declined_this_turn' } }),
    )
  })

  it('PRECONDITION: the legacy signals in this fixture really do say "current"', () => {
    // Pins the fixture's own discriminating power (trap 13b). If the legacy
    // state ever stopped deriving current, every assertion below would pass
    // while proving nothing about the wire.
    const legacyOnly = renderHook(() => {
      store.setState({ analysisStateV1: null })
      return useAnalysisState()
    }).result.current
    expect(legacyOnly.authority).toBe('derived')
    expect(legacyOnly.semantic).toBe('current')
    expect(legacyOnly.displayedFreshness).toBe('fresh')
  })

  it('the FRESHNESS STRIP renders cannot-confirm, asserted at its own DOM', () => {
    // ⚠ Asserted at the RENDERED attribute, not at the selector. Reading
    // `selector.displayedFreshness` here would re-test the composition and say
    // nothing about whether the strip consumes it — which was exactly the
    // review's finding: a composed verdict nothing reads is dark.
    const { container } = render(<AnalysisFreshnessNotice />)
    const strip = container.querySelector('[data-testid="analysis-freshness-notice"]')
    expect(strip).not.toBeNull()
    expect(strip?.getAttribute('data-freshness')).toBe('unknown')
    // Without the re-point this reads 'fresh' — the legacy slice still says so.
    expect(strip?.getAttribute('data-freshness')).not.toBe('fresh')
  })

  it('the Results-tab glyph shows cannot-confirm, never a fabricated stale', () => {
    const { selector } = readSurfaces()
    expect(selector.resultsTab.cannotConfirm).toBe(true)
    expect(selector.resultsTab.reallyStale).toBe(false)
  })

  it('the EDIT-CONFIRMATION chip stops claiming confirmable freshness', () => {
    const { result } = renderHook(() => useEditConfirmation())
    act(() => result.current.confirm('belief'))
    // A refused turn is not a confirmably-fresh one: the chip must report the
    // edit as leaving the analysis unconfirmed.
    expect(result.current.isStaleAfterEdit).toBe(true)
  })

  it('the HERO no longer says "Analysis complete" (useAnalysisDisplayState re-point)', () => {
    const { hero } = readSurfaces()
    expect(hero.state).toBe('results_stale')
    expect(hero.cta).toStrictEqual({ kind: 'secondary', label: 'Rerun analysis' })
  })

  it('ALL THREE AGREE — no surface claims currency', () => {
    const { selector, hero, trust } = readSurfaces()
    expect(selector.semantic).toBe('cannot_confirm')
    expect(trust.semantic).toBe('cannot_confirm')
    expect(hero.state).not.toBe('complete')
    expect(selector.displayedFreshness).not.toBe('fresh')
  })
})

describe('three-truths window — the opposite direction', () => {
  it('a complete_current verdict lets every surface affirm currency again', () => {
    // Without this pair the suite would also pass if the re-points had simply
    // hardcoded pessimism — the affirmative must still be reachable.
    store = makeStore(verdict())
    const { selector, hero, trust } = readSurfaces()
    expect(selector.semantic).toBe('current')
    expect(trust.semantic).toBe('current')
    expect(hero.state).toBe('complete')
    expect(selector.displayedFreshness).toBe('fresh')
    expect(selector.leaderClaimPermitted).toBe(true)
  })

  it('a blocked verdict routes the hero to not_ready, not to a completion claim', () => {
    store = makeStore(
      verdict({ run_state: { kind: 'blocked', reason_code: 'no_goal_node', blockers: [] } }),
    )
    const { hero, selector } = readSurfaces()
    expect(hero.state).toBe('not_ready')
    expect(selector.displayedFreshness).toBe('none')
  })
})

describe('no wire verdict — every surface behaves exactly as before', () => {
  it('is the legacy answer on all three surfaces', () => {
    store = makeStore(null)
    const { selector, hero, trust } = readSurfaces()
    expect(selector.authority).toBe('derived')
    expect(selector.semantic).toBe('current')
    expect(trust.semantic).toBe('current')
    expect(hero.state).toBe('complete')
    expect(selector.displayedFreshness).toBe('fresh')
  })
})
