/**
 * THE RERUN AFFORDANCE STATES THE STALENESS VERDICT (Core System A, exit A3,
 * link 4).
 *
 * THE DEFECT THIS PINS
 * --------------------
 * The run affordance never consulted freshness at all. `canRunAnalysisUtil`
 * takes ten inputs at `OutputsDock.tsx` and none of them is freshness, and the
 * footer's action label was the hardcoded literal `'Rerun'`. So a user could
 * edit their model, make the analysis stale, and the one control that would fix
 * it said nothing — while CEE's own answer sat composed at
 * `analysisStateSelector.ts:697` (`requiresRerun`) and was READ BY NOTHING
 * (measured at `9cd7778a`: 4 occurrences repo-wide, all inside the selector and
 * its specs; contrast controls `displayedFreshness` = 50, `canRunAnalysis` = 53
 * files, so the sweep was not blind).
 *
 * ⚠ THE SCOPE OF THE CLAIM, STATED NARROWLY. The Analysis tab is NOT silent
 * about staleness overall — `AnalysisFreshnessNotice` states it in prose, and
 * `TRUTH_BANNER_BY_RUN_STATE` routes `complete_stale` / `unknown_degraded` to
 * it. What was silent is the AFFORDANCE: the control the user actually presses,
 * sitting in a footer whose own status slot is derived PURELY from
 * `robustnessVerdict` (`derivePostFooterStatus` takes no freshness input at
 * all), so a stale analysis could render a green ✓ "Stable ranking" beside an
 * unqualified "Rerun". This file pins the affordance, and claims nothing about
 * the strip.
 *
 * BOTH DIRECTIONS, AND WHY THAT IS THE WHOLE POINT
 * ------------------------------------------------
 * A one-sided guard that marked everything would convert today's silence into a
 * permanent false alarm, which is worse — users learn to ignore a warning that
 * is always on. So `genuinely current renders as current` (an unqualified
 * "Rerun") is pinned as hard as the stale arms, and a mutant that widens the
 * qualifier to every state must RED here.
 *
 * `'model changed'` IS A POSITIVE CLAIM AND IS MINTED ONLY FROM `'changed'`
 * ------------------------------------------------------------------------
 * `classifyFreshnessForDisplay`'s own rule — "'changed' must never be claimed
 * for a CEE-sourced 'unknown'" — applies to this surface too. A local edit
 * downgrades a retained `fresh` to `unknown` (never to `stale`), so the EDIT
 * case honestly reads "can't confirm current"; only a CEE-stated `stale` earns
 * "model changed". Both arms are pinned, and the pair is what stops the fix
 * fabricating a change the producer never stated.
 *
 * Scaffolding mirrors `OutputsDock.rerunSingleOwner.spec.tsx` (real ResultsBody,
 * stable useConversation stub, aiPanelV2 OFF).
 */

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'
import { OutputsDock } from '../OutputsDock'
import { useCanvasStore } from '../../store'

const { mockIsV5CanonicalAnalysisEnabled } = vi.hoisted(() => ({
  mockIsV5CanonicalAnalysisEnabled: vi.fn(() => false),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: vi.fn(() => vi.fn()) }
})

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isTelemetryEnabled: () => false,
    isCompareEnabled: () => true,
    isOrchestratorV2Enabled: () => true,
    isLegacyDirectRunEnabled: () => false,
    isJourneyTabEnabled: () => false,
    isAiPanelV2Enabled: () => false,
    isV5CanonicalAnalysisEnabled: mockIsV5CanonicalAnalysisEnabled,
  }
})

vi.mock('../../conversation/useConversation', () => ({
  useConversation: () => ({
    messages: [],
    isThinking: false,
    longRunningHint: null,
    sendMessage: vi.fn(),
    sendSystemEvent: vi.fn(),
    sendChip: vi.fn(),
    retryLast: vi.fn(),
    patchBlockStates: new Map(),
    setPatchBlockState: vi.fn(),
    patchRejections: new Map(),
    setPatchRejection: vi.fn(),
  }),
}))

vi.mock('../pre-analysis', () => ({ PreAnalysisPanel: () => null }))

vi.mock('../../hooks/useGraphReadiness', () => ({
  useGraphReadiness: () => ({ readiness: { state: 'ready' } }),
}))

vi.mock('../../hooks/useStageAwarePlaceholder', () => ({
  useStageAwarePlaceholder: () => 'Describe your decision…',
}))

function ensureMatchMedia() {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      }),
    })
  }
}

const fakeReport: Record<string, unknown> = {
  results: { conservative: 10, likely: 20, optimistic: 30, units: 'percent', unitSymbol: '%' },
  run: { bands: { p10: 10, p50: 20, p90: 30 } },
  robustness: { recommendation_stability: 0.87 },
}

function seedPostRun(overrides: Record<string, unknown> = {}) {
  useCanvasStore.setState({
    currentScenarioFraming: null,
    currentScenarioLastResultHash: null,
    hasCompletedFirstRun: true,
    nodes: [
      { id: 'goal-1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } },
      { id: 'opt-a', type: 'option', data: { label: 'Option A', kind: 'option' }, position: { x: 50, y: 0 } },
      { id: 'factor-1', type: 'factor', data: { label: 'Factor', kind: 'factor' }, position: { x: 100, y: 0 } },
    ],
    edges: [{ id: 'e1', source: 'factor-1', target: 'goal-1', data: { weight: 0.7, direction: 'positive' } }],
    graphHealth: { status: 'healthy', score: 100, issues: [] },
    results: { status: 'complete', report: fakeReport },
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    analysisStateV1: null,
    v5AnalysisFact: null,
    showDraftChat: false,
    ...overrides,
  } as never)
}

/**
 * A wire verdict. `kind` and `requires_rerun` are the two members under test;
 * every other field is the neutral filler this repo's other specs already use.
 */
function wireState(
  kind: AnalysisStateV1['run_state']['kind'],
  requiresRerun: boolean,
): AnalysisStateV1 {
  return {
    run_state: { kind },
    readiness: { status: 'ready', blockers: [] },
    leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
    robustness: {},
    usable_for_prose: true,
    usable_for_chips: true,
    usable_for_followup: true,
    requires_rerun: requiresRerun,
    blocked_unusable: false,
    contradictions: [],
  } as AnalysisStateV1
}

/**
 * THE AFFORDANCE, BOUND BY IDENTITY.
 *
 * Role + accessible name, never `getAllByRole(...)[n]`. `AnalysisFooter` leaves
 * `actionAriaLabel` unset, so `aria-label={actionAriaLabel ?? actionLabel}`
 * makes the accessible name EQUAL the visible label — which is itself the
 * property worth having, and why this helper does not read `textContent`.
 *
 * The name regex is deliberately loose (`/^Rerun/`) so this helper finds the
 * button in EVERY arm — including the arms where it is unqualified. A helper
 * that could only find the qualified button would make the
 * `genuinely-current` assertion vacuous by construction.
 */
function rerunAffordance(): HTMLElement {
  return screen.getByRole('button', { name: /^Rerun/ })
}

describe('OutputsDock — the Rerun affordance states the staleness verdict', () => {
  beforeEach(() => {
    ensureMatchMedia()
    try {
      sessionStorage.clear()
    } catch {
      /* jsdom quirk — never block the suite */
    }
    mockIsV5CanonicalAnalysisEnabled.mockReturnValue(false)
  })

  // ── DIRECTION 1: STALE RENDERS AS STALE ────────────────────────────────────

  it('CEE-stated stale (derived branch): the affordance names the change', () => {
    seedPostRun({ analysisFreshness: { freshness: 'stale', computedAt: 1 } })
    render(<OutputsDock />)

    // Precondition pinned IN-TEST: the payload really is in the stale state, so
    // a pass cannot come from the fixture silently failing to reproduce it.
    expect(screen.getByTestId('analysis-freshness-notice')).toHaveAttribute('data-freshness', 'stale')

    expect(rerunAffordance()).toHaveAccessibleName('Rerun — model changed')
  })

  it('EDITED SINCE RUN (the brief\'s case): a retained fresh + local dirty overlay NAMES THE CHANGE', () => {
    // ⚠ THIS EXPECTATION WAS WRONG WHEN FIRST WRITTEN, AND THE CORRECTION IS
    // THE POINT. It asserted cannot-confirm, reasoning that a local edit must
    // not mint the positive claim. Measured: the composition returns
    // `'changed'`, and the CODE IS RIGHT — the expectation had been written
    // from this author's reading rather than from the producer's declared
    // semantics (trap 13c: a perfect score against a wrong oracle).
    //
    // Derived at `store/analysisFreshness.ts`, `classifyFreshnessForDisplay`:
    // `displayed === 'unknown'` + `dirty` + (`freshness === 'fresh'` OR
    // `freshnessReason === VERDICT_ABSENT_FROM_PAYLOAD`) → `'changed'`, because
    // the dirty overlay IS "the UI's own first-hand knowledge that an
    // analysis-affecting edit happened". The user edited; the model changed; we
    // know it first-hand and do not need CEE to say so.
    //
    // ⭐ NOTE THE TWO MEMBERS DISAGREEING CORRECTLY, which is what validates
    // reading BOTH rather than one. `displayedFreshness` stays `'unknown'` —
    // it must never fabricate a CEE `'stale'` verdict — while `semantic` says
    // `'changed'`. Different questions, different answers, both true. Had this
    // surface taken its wording from `displayedFreshness` alone it would say
    // "can't confirm current" for an edit, which is WEAKER THAN THE TRUTH.
    seedPostRun({
      analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: 1 },
      analysisFreshnessDirty: true,
    })
    render(<OutputsDock />)

    // Precondition pinned in-test: the strip is on the cannot-confirm VALUE…
    expect(screen.getByTestId('analysis-freshness-notice')).toHaveAttribute('data-freshness', 'unknown')
    // …while the affordance makes the stronger, first-hand TRUE claim.
    expect(rerunAffordance()).toHaveAccessibleName('Rerun — model changed')
  })

  it('CEE-STATED unknown (no local edit): cannot-confirm — never dressed up as "you edited"', () => {
    // The genuine cannot-confirm arm on the derived branch. `analysisFreshness.ts`
    // is explicit that a CEE-stated `'unknown'`, the orphan synthesis and the
    // run-completion write "must never be dressed up as a factual 'you edited'
    // claim". Without this arm the suite would contain no derived-branch
    // cannot-confirm case at all, and a mutant collapsing the two labels into
    // one would survive.
    seedPostRun({
      analysisFreshness: { freshness: 'unknown', computedAt: 1 },
      analysisFreshnessDirty: false,
    })
    render(<OutputsDock />)

    expect(screen.getByTestId('analysis-freshness-notice')).toHaveAttribute('data-freshness', 'unknown')
    const action = rerunAffordance()
    expect(action).toHaveAccessibleName("Rerun — can't confirm current")
    expect(action).not.toHaveAccessibleName('Rerun — model changed')
  })

  it('wire branch: run_state complete_stale + requires_rerun names the change', () => {
    seedPostRun({ analysisStateV1: wireState('complete_stale', true) })
    render(<OutputsDock />)

    expect(rerunAffordance()).toHaveAccessibleName('Rerun — model changed')
  })

  it('wire branch: unknown_degraded is cannot-confirm — an unrecognised state never earns the positive claim', () => {
    seedPostRun({ analysisStateV1: wireState('unknown_degraded', true) })
    render(<OutputsDock />)

    expect(rerunAffordance()).toHaveAccessibleName("Rerun — can't confirm current")
  })

  // ── DIRECTION 2: GENUINELY CURRENT RENDERS AS CURRENT ──────────────────────
  //
  // The other half of the guard. Without these, widening the qualifier to every
  // state would pass, and the fix would be a permanent false alarm.

  it('genuinely current (derived branch): the affordance is UNQUALIFIED', () => {
    seedPostRun({
      analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: 1 },
      analysisFreshnessDirty: false,
    })
    render(<OutputsDock />)

    expect(screen.getByTestId('analysis-freshness-notice')).toHaveAttribute('data-freshness', 'fresh')
    expect(rerunAffordance()).toHaveAccessibleName('Rerun')
  })

  it('genuinely current (wire branch): complete_current + requires_rerun false is UNQUALIFIED', () => {
    seedPostRun({ analysisStateV1: wireState('complete_current', false) })
    render(<OutputsDock />)

    expect(rerunAffordance()).toHaveAccessibleName('Rerun')
  })

  // ── THE ABSENCE CELL, DECIDED AND DISCLOSED ────────────────────────────────

  it('no verdict at all: the affordance is UNQUALIFIED — silence, never a currency claim', () => {
    // `analysisStateV1` is CLEAR-ON-ABSENCE, so this cell is routine mid-journey
    // (CEE omits `analysis_state` on most `sendFinalised200` exits). The base
    // label asserts NOTHING about currency, so the demotion costs a warning it
    // could not justify — it never manufactures a false all-clear.
    seedPostRun({ analysisFreshness: null, analysisStateV1: null })
    render(<OutputsDock />)

    expect(rerunAffordance()).toHaveAccessibleName('Rerun')
  })

  // ── THE AFFORDANCE IS NEVER BLOCKED BY STALENESS ───────────────────────────

  it('staleness MARKS the affordance and never GATES it — enabledness is identical across the freshness axis', () => {
    // ⚠ THIS ASSERTION WAS ALSO WRONG WHEN FIRST WRITTEN, in an instructive
    // way. It asserted `toBeEnabled()` outright and FAILED — but not because
    // staleness gated anything: this fixture's readiness verdict disables the
    // button for an entirely unrelated reason ("Olumi needs something more from
    // this model before the next analysis"). Asserting an absolute enabled
    // state made the test a hostage to the READINESS axis, which this lane does
    // not touch and must not claim anything about.
    //
    // The claim that is actually this lane's to make is a DIFFERENCE, not a
    // level: moving along the freshness axis must not move enabledness. That is
    // testable whatever readiness says, and it is the invariant that would
    // break if someone later re-attached a lock to the staleness verdict.
    const disabledUnder = (freshness: 'stale' | 'fresh') => {
      seedPostRun({ analysisFreshness: { freshness, computedAt: 1 } })
      const { unmount } = render(<OutputsDock />)
      const action = rerunAffordance()
      const state = {
        name: action.getAttribute('aria-label'),
        disabled: (action as HTMLButtonElement).disabled,
        ariaDisabled: action.getAttribute('aria-disabled'),
      }
      unmount()
      return state
    }

    const stale = disabledUnder('stale')
    const fresh = disabledUnder('fresh')

    // The pin is not vacuous: the two arms really are different states — if the
    // label were identical the comparison below would hold for the wrong reason.
    expect(stale.name).toBe('Rerun — model changed')
    expect(fresh.name).toBe('Rerun')

    // …and the enabledness is UNMOVED by that difference. Disabling the one
    // control that fixes staleness would be a worse lie than the silence this
    // lane removed.
    expect(stale.disabled).toBe(fresh.disabled)
    expect(stale.ariaDisabled).toBe(fresh.ariaDisabled)
  })
})
