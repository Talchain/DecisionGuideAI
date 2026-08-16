/**
 * ResultsBody — NO SURFACE ON THIS PANEL STATES A WIN-FREQUENCY GAP
 * (2026-08-10). The durable guard for the whole class, not for one component.
 *
 * The deployed panel stated the same banned quantity on TWO surfaces at once:
 * the V7 hero rendered a correct statement of the leader's OWN win probability
 * ("… came out ahead in 71% of simulated scenarios") and then "Leads by 40
 * points" directly beneath it; and the option card for every non-leader
 * rendered "Behind by 40 percentage points". Both are the percentage-point
 * DIFFERENCE between two Monte-Carlo win frequencies. The ratified rule: no
 * user-facing surface states that gap — own-probability statements only.
 *
 * ⚠ RE-SCOPED 12 Aug 2026 (the V7 move), then again by the V7 RETIREMENT. The
 * V7 hero first MOVED, unchanged, to a temporary "Alt view" dock tab — Paul:
 * "move, NOT delete" — taking its arms of this guard with it. That
 * adjudication is now settled and the hero, its tab and its spec are DELETED,
 * so THOSE ARMS ARE GONE RATHER THAN RELOCATED: no file now pins the retired
 * "by N points" forms against a V7 surface, because there is no V7 surface.
 * What remains here is the ANALYSIS-TAB half, and it is STRONGER than it was
 * before either move: the one surface entitled to the "by N points" SHAPE (the
 * V7 hero's goal arm, a GOAL-probability difference with its own rationale in
 * `goalLeadPoints`) no longer exists, so the whole panel — goal data or not —
 * may carry NONE of the three banned forms. No region split, no sanctioned
 * exception.
 *
 * ⭐ WHY THIS SPEC RENDERS `ResultsBody` AND NOT A BUILDER (CLAUDE.md trap 3b):
 * this estate has twice shipped a fix onto a component the deployed flags did
 * not mount, with a fully green suite pointed at the dark one. This spec pins
 * the MOUNT PATH — what the Analysis tab actually composes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ResultsBody } from '../ResultsBody'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriversSectionData,
  ImprovementsSectionData,
  OptionResult,
} from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

vi.mock('@/flags', async () => {
  const actual = await vi.importActual<typeof import('@/flags')>('@/flags')
  return {
    ...actual,
    isFocusNowPanelEnabled: vi.fn(() => true),
    isStrengthenPanelEnabled: vi.fn(() => false),
    isAiPanelV2Enabled: vi.fn(() => true),
  }
})

import { useCanvasStore } from '@/canvas/store'
import { useUIStore } from '@/stores/uiStore'
import { useGuidanceStore } from '@/canvas/stores/guidanceStore'
import type { AnalysisFreshnessState } from '@/canvas/store/analysisFreshness'

const WINNER_LABEL = 'Bring In 6-Month Contractor'
const RUNNER_UP_LABEL = 'Hire Permanent Senior Tech Lead'

function makeData(
  runnerUpLabel: string = RUNNER_UP_LABEL,
  soft = false,
  withGoalData = false,
): ResultsSectionDataReturn {
  const winner = {
    id: 'opt_a',
    label: WINNER_LABEL,
    isRecommended: true,
    winProbability: 0.71,
    ...(withGoalData ? { goalProbability: 0.9 } : {}),
  } as unknown as OptionResult
  const runnerUp = {
    id: 'opt_b',
    label: runnerUpLabel,
    isRecommended: false,
    winProbability: 0.31,
    ...(withGoalData ? { goalProbability: 0.4 } : {}),
  } as unknown as OptionResult

  const recommendation = {
    recommendedOption: winner,
    allOptions: [winner, runnerUp],
    goalLabel: 'Maximise success',
    ...(withGoalData ? { goalThreshold: 0.6 } : {}),
    isSingleOption: false,
    analysisStatus: 'computed',
    // `soft` reaches DecisionConfidencePanel's SOFTENED lede — the branch that
    // carried the retired " by N points" suffix. `shouldSoftenPhrasing` needs
    // tier ∈ {needs_work, fair} AND stability < 0.85, so both move together.
    recommendationStability: soft ? 0.5 : 0.92,
    // ⚠ AND A PERMITTED VERDICT IS REQUIRED TO GET THERE AT ALL. Without one,
    // `DecisionConfidencePanel` falls back to `NO_CLAIM_VERDICT`, whose
    // `separation: 'unknown'` returns "the analysis did not put an option
    // forward" long before any leader rule runs — so an absence assertion
    // would have passed against a headline that never mentions a leader.
    // The in-test precondition is what caught this; it is not decoration.
    // Supplied ONLY on the soft variant, so the default fixture (and the
    // cases built on it) keeps the legacy no-verdict path it was written for.
    ...(soft
      ? {
          verdict: {
            leaderId: 'opt_a',
            separation: 'clear',
            hasLeadingOption: true,
            gapPp: 40,
            source: 'producer_near_tie',
          },
        }
      : {}),
    robustnessLevel: 'high',
    isNormalised: false,
  } as unknown as DecisionResultData

  const drivers: DriversSectionData = {
    drivers: [],
    topDrivers: [],
    driversStatus: 'computed',
    totalCount: 0,
    hasMagnitudeData: false,
  }

  const confidence = {
    tier: { tier: soft ? 'fair' : 'strong', icon: 'Check', label: 'Tier', description: 'd' },
    qualityScore: 80,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: [],
    topEvidenceGaps: [],
    nextActions: [],
    topNextActions: [],
    challengeFragileEdges: [],
  } as unknown as ConfidenceSectionData

  const improvements: ImprovementsSectionData = {
    improvements: [],
    count: 0,
    hasHighPriority: false,
  } as ImprovementsSectionData

  return {
    recommendation,
    drivers,
    confidence,
    improvements,
    isLoading: false,
    isError: false,
    goalLabel: 'Maximise success',
    completeness: { status: 'full', missing: [], reasons: [] },
    autoNoiseProvenance: null,
  } as unknown as ResultsSectionDataReturn
}

function renderBody(runnerUpLabel?: string, soft = false, withGoalData = false) {
  return render(
    <ResultsBody
      resultsSectionData={makeData(runnerUpLabel, soft, withGoalData)}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
      onFocusNode={() => {}}
    />,
  )
}

const FRESH: AnalysisFreshnessState = { freshness: 'fresh', computedAt: '2026-08-10T00:00:00Z' }

/** The hero's retired form, in every pluralisation and casing it could return in. */
const GAP_CLAIM = /leads?\s+by\s+\d+\s+points?/i
/**
 * The option-card / canvas-node retired form. Deliberately the BARE PHRASE
 * rather than "Behind by N percentage points": the banned thing is the
 * quantity, not one sentence that carried it, so any new copy that reaches for
 * "percentage points" on this panel REDs here whatever its wording.
 */
const PP_CLAIM = /percentage\s+points?/i
/**
 * `certaintyCopy`'s retired suffix, as rendered by `DecisionConfidencePanel`'s
 * softened lede ("{winner} currently leads by 40 points"). A THIRD spelling of
 * the same banned quantity — which is exactly why this guard matches the
 * QUANTITY SHAPE rather than any one sentence.
 */
const POINTS_CLAIM = /\bby\s+-?\d+(\.\d+)?\s+points?\b/i

describe('ResultsBody — no surface on the results panel states a win-frequency gap', () => {
  beforeEach(() => {
    useCanvasStore.setState({ analysisFreshness: FRESH, analysisFreshnessDirty: false })
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
    useGuidanceStore.setState({ guidanceItems: [] })
  })

  /**
   * ⭐ THE DURABLE GUARD FOR THE WHOLE CLASS.
   *
   * All three retired forms, asserted absent across the ENTIRE rendered panel
   * rather than element by element — so a gap claim reintroduced on any
   * surface `ResultsBody` composes REDs here, including a surface that does
   * not exist yet. There is NO sanctioned exception on this tab — the goal-arm
   * "Leads by N points" left with the V7 move and no longer exists at all — so
   * the scoped `splitPanelText` region logic this file used to need is retired:
   * the assertion is whole-panel on every fixture, goal data included.
   *
   * ⚠ SCOPE, STATED EXACTLY, because an absence claim is only as wide as what
   * it searched (trap 20):
   *   · WHAT IS SEARCHED — the DOM `ResultsBody` renders under this fixture.
   *     The canvas `OptionNode` is NOT composed by `ResultsBody`; its own
   *     retirement is pinned in `render-matrix.spec.tsx` and
   *     `residualComparative.optionNode.spec.tsx`. The V7 hero is DELETED, so
   *     it is neither composed here nor guarded anywhere — there is nothing
   *     left for its arm of this guard to be pointed at.
   *   · `certaintyCopy`'s `" by N point(s)"` suffix is NOT searched here: its
   *     only host, `DecisionConfidencePanel`, is deleted. That copy is covered
   *     directly by `utils/__tests__/certaintyCopy.spec.ts`.
   */
  it('NONE of the retired forms appears anywhere in the rendered panel — with or without goal data', () => {
    // Was a posture × goal-data double loop; the analysis-hero fork is closed,
    // so only the goal-data dimension survives and every assertion still runs.
    for (const withGoalData of [false, true]) {
      const { container, unmount } = renderBody(undefined, false, withGoalData)
      const text = container.textContent ?? ''
      const label = `goalData=${withGoalData}`
      // Positive control FIRST: an absence assertion over an empty or
      // half-rendered panel passes by testing nothing (trap 13). Both
      // option labels are painted by the live options section.
      expect(text, `${label}: positive control — winner painted`).toMatch(new RegExp(WINNER_LABEL))
      expect(text, `${label}: positive control — runner-up painted`).toMatch(new RegExp(RUNNER_UP_LABEL))

      expect(text, `${label}: no "leads by N points"`).not.toMatch(GAP_CLAIM)
      expect(text, `${label}: no "by N points" shape`).not.toMatch(POINTS_CLAIM)
      expect(text, `${label}: no "percentage points"`).not.toMatch(PP_CLAIM)
      unmount()
      cleanup()
    }
  })

  /**
   * ⚠ RETIRED WITH ITS SUBJECT (PX-C analysis-cockpit consolidation): a
   * `DEFENCE IN DEPTH (flag-OFF arm)` case used to assert the softened
   * `DecisionConfidencePanel` lede stated no gap. That panel and the arm that
   * mounted it are deleted, so the case could only ever have passed
   * vacuously. The sentence it guarded is `buildCertaintyCopy`'s, and it is
   * covered directly by `utils/__tests__/certaintyCopy.spec.ts`.
   */

  /**
   * POSITIVE CONTROL FOR THE PROBE ITSELF (trap 13: a probe that proves an
   * ABSENCE must first be shown capable of seeing a PRESENCE).
   *
   * The phrase is injected through a REAL render input — an option label,
   * which `formatOptionLabelForCard` passes through verbatim for a
   * non-baseline option — so this exercises the same component tree, the same
   * `container.textContent` read and the same regex as the assertion above.
   * If `PP_CLAIM` were mistyped, or the probe were reading a detached or
   * empty node, this case would fail and the guard beside it would be
   * exposed as vacuous.
   */
  it('POSITIVE CONTROL: the panel-wide probe DOES see the banned phrase when it is present', () => {
    const { container } = renderBody('Behind by 40 percentage points')
    expect(container.textContent ?? '').toMatch(PP_CLAIM)
  })

  /**
   * The option card's own-probability readout, bound BY IDENTITY (the card's
   * testid), not by a value another element could satisfy — the panel prints
   * "31%" in several places. Pinned because the fix DELETED the non-leader's
   * line rather than rewording it: the justification for deleting is that the
   * card already carries this number, so if the number ever leaves, the
   * deletion stops being justified and this REDs.
   */
  it('the non-leader card still carries its OWN probability, which is what licensed deleting the gap line', () => {
    renderBody()
    expect(screen.getByTestId('win-pct-opt_b')).toHaveTextContent('31%')
    expect(screen.getByTestId('win-pct-opt_a')).toHaveTextContent('71%')
  })
})
