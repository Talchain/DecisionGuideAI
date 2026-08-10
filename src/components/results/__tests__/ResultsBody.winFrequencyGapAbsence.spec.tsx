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
 * The hero's subline now names the runner-up and states ITS OWN probability.
 * The option card's line is DELETED outright, because the card already carries
 * the option's own probability in its header readout (`win-pct-{id}`) — pinned
 * below, by identity, so "deleted the line" cannot quietly become "the card
 * lost its number".
 *
 * ⭐ WHY THIS SPEC RENDERS `ResultsBody` AND NOT `buildV7Headline`.
 * CLAUDE.md trap 3b: this estate has twice shipped a fix onto a component the
 * deployed flags do not mount, with a fully green suite pointed at the dark
 * one. `buildV7Headline.spec.ts` pins the builder; this spec pins the MOUNT
 * PATH — that the V7 hero is on screen at all, and that the retired string is
 * absent from the DOM a user loads.
 *
 * The mount-path derivation at 944799c1: `V7TopMatter` (and therefore
 * `V7Hero`) is mounted UNCONDITIONALLY inside `ResultsBody`'s `v7-top-group`
 * slot — "additive, passthrough, no flag" — while `analysisHeroPanel` gates a
 * different pair of arms lower in the same component. So the hero renders on
 * BOTH postures of that flag, and this spec asserts exactly that: if a future
 * change hosts the hero on one arm, the posture that stops mounting it fails
 * here rather than shipping the fix dark. The deployed posture is
 * `VITE_FEATURE_ANALYSIS_HERO_PANEL = "1"` (netlify.toml), which is the arm
 * asserted first.
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
    isAnalysisHeroV17Enabled: vi.fn(() => false),
    isAnalysisHeroCompareEnabled: vi.fn(() => false),
    isFocusNowPanelEnabled: vi.fn(() => true),
    isStrengthenPanelEnabled: vi.fn(() => false),
    isAiPanelV2Enabled: vi.fn(() => true),
    isAnalysisHeroPanelEnabled: vi.fn(() => true),
  }
})

import { isAnalysisHeroPanelEnabled } from '@/flags'
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
    // Supplied ONLY on the soft variant, so the default fixture (and the six
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

/**
 * ⚠ SCOPING, ADDED 2026-08-10 (review F3). `GAP_CLAIM` and `POINTS_CLAIM` match
 * on the SHAPE "by N points", and one surface is entitled to that shape: the
 * hero's GOAL arm, whose "Leads by N points" differences GOAL PROBABILITIES —
 * a different quantity, with its own pairing rationale in `goalLeadPoints`, and
 * deliberately out of this change's scope.
 *
 * Asserting those two patterns across the whole panel therefore only passed
 * because the default fixture carries no goal data: the moment anyone added
 * some, a SANCTIONED sentence would have turned this guard RED. A guard that
 * fails on correct behaviour gets disabled, and then the class it protects is
 * unguarded — so the patterns are scoped instead.
 *
 * The split is: the hero subline is judged ON ITS OWN (it may carry the
 * sanctioned goal form and nothing else), and the REST of the panel may carry
 * none of the three forms. `PP_CLAIM` stays panel-wide and unscoped — no
 * sanctioned surface says "percentage points".
 */
function splitPanelText(container: HTMLElement): { heroSubline: string; rest: string } {
  const heroSubline = screen.queryByTestId('v7-hero-subline')?.textContent ?? ''
  const all = container.textContent ?? ''
  return {
    heroSubline,
    rest: heroSubline ? all.replace(heroSubline, '') : all,
  }
}

describe('ResultsBody — no surface on the results panel states a win-frequency gap', () => {
  beforeEach(() => {
    useCanvasStore.setState({ analysisFreshness: FRESH, analysisFreshnessDirty: false })
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
    useGuidanceStore.setState({ guidanceItems: [] })
    vi.mocked(isAnalysisHeroPanelEnabled).mockReturnValue(true)
  })

  it('DEPLOYED POSTURE (analysisHeroPanel ON): the hero mounts, states the leader’s OWN probability, and states NO gap', () => {
    renderBody()

    // MOUNT PATH — assert the hero is on screen before asserting anything
    // about its copy. A green copy assertion against an unmounted component is
    // the defect this spec exists to prevent.
    expect(screen.getByTestId('v7-hero')).toBeInTheDocument()

    const headline = screen.getByTestId('v7-hero-headline')
    expect(headline).toHaveTextContent(
      new RegExp(`${WINNER_LABEL} came out ahead in 71% of simulated scenarios`),
    )

    const subline = screen.getByTestId('v7-hero-subline')
    expect(subline.textContent ?? '').not.toMatch(GAP_CLAIM)
    // The honest replacement: the runner-up's OWN probability, named.
    expect(subline).toHaveTextContent(`Next: ${RUNNER_UP_LABEL}, 31%`)
  })

  /**
   * ⭐ THE DURABLE GUARD FOR THE WHOLE CLASS.
   *
   * Both retired forms, asserted absent across the ENTIRE rendered panel
   * rather than element by element — so a gap claim reintroduced on any
   * surface `ResultsBody` composes REDs here, including a surface that does
   * not exist yet.
   *
   * ⚠ SCOPE, STATED EXACTLY, because an absence claim is only as wide as what
   * it searched (trap 20):
   *   · WHAT IS SEARCHED — the DOM `ResultsBody` renders under this fixture.
   *     The canvas `OptionNode` is NOT composed by `ResultsBody`; its own
   *     retirement is pinned in `render-matrix.spec.tsx` and
   *     `residualComparative.optionNode.spec.tsx`.
   *   · `certaintyCopy`'s `" by N point(s)"` suffix IS now covered, but on a
   *     SEPARATE case below, because `DecisionConfidencePanel` mounts only on
   *     the `analysisHeroPanel`-OFF arm — which is NOT the deployed posture.
   *     This case runs on the deployed (ON) posture, where that panel is
   *     absent, so its silence about the suffix here means "not rendered",
   *     never "rendered and clean".
   */
  it('NEITHER retired form appears anywhere in the rendered panel', () => {
    const { container } = renderBody()
    const text = container.textContent ?? ''
    // Positive control FIRST: an absence assertion over an empty or
    // half-rendered panel passes by testing nothing (trap 13).
    expect(text).toMatch(/came out ahead in 71% of simulated scenarios/i)
    expect(text).toMatch(new RegExp(RUNNER_UP_LABEL))

    // `percentage points` is unambiguous — no sanctioned surface says it.
    expect(text).not.toMatch(PP_CLAIM)

    // The "by N points" SHAPE is judged per-region (see `splitPanelText`).
    const { heroSubline, rest } = splitPanelText(container)
    // This fixture carries no goal data, so the hero is on the COMPARATIVE arm
    // and is entitled to no gap form at all.
    expect(heroSubline).not.toMatch(GAP_CLAIM)
    expect(heroSubline).not.toMatch(PP_CLAIM)
    expect(rest).not.toMatch(GAP_CLAIM)
    expect(rest).not.toMatch(POINTS_CLAIM)
    expect(rest).not.toMatch(PP_CLAIM)
  })

  /**
   * ⭐ F3 — THE SANCTIONED FORM MUST SURVIVE, and this proves it does.
   *
   * With goal data present the hero takes its GOAL arm, whose subline is
   * "Leads by N points" over GOAL PROBABILITIES (0.9 − 0.4 = 50). That form is
   * out of this change's scope and is correct; a guard that REDs on it would
   * be a false alarm, and a false alarm on correct behaviour is how a guard
   * gets switched off. So: the sanctioned sentence is asserted PRESENT, and
   * the banned class is asserted absent everywhere else in the same render.
   */
  it('F3: the SANCTIONED goal-arm subline survives, and nothing else in the panel states a gap', () => {
    const { container } = renderBody(undefined, false, true)

    // Precondition — we are actually on the goal arm, not silently comparative.
    const subline = screen.getByTestId('v7-hero-subline')
    expect(subline).toHaveTextContent('Leads by 50 points')

    // ⭐ THE OVERLAP, MADE EXPLICIT: the sanctioned sentence DOES match the
    // banned-shape pattern. That is precisely why the pattern is scoped by
    // region rather than weakened — and it is executable proof that the
    // previous panel-wide assertion would have RED on this correct render.
    expect(subline.textContent ?? '').toMatch(GAP_CLAIM)

    const { rest } = splitPanelText(container)
    expect(rest).not.toMatch(GAP_CLAIM)
    expect(rest).not.toMatch(POINTS_CLAIM)
    expect(rest).not.toMatch(PP_CLAIM)
    // And the unambiguous phrase is absent from the WHOLE panel, hero included.
    expect(container.textContent ?? '').not.toMatch(PP_CLAIM)
  })

  /**
   * ⭐⭐ THE SOFTENED `DecisionConfidencePanel` LEDE — AND AN EXPLICIT NOTE ON
   * WHICH ARM MOUNTS IT, BECAUSE THE DEPLOYED POSTURE DOES NOT.
   *
   * Derived at the bytes: `decisionConfidenceElement` is referenced at exactly
   * one site (`ResultsBody.tsx:508`), INSIDE `{!isAnalysisHeroPanelEnabled()
   * && …}` — and `netlify.toml` bakes `VITE_FEATURE_ANALYSIS_HERO_PANEL="1"`.
   * So `DecisionConfidencePanel` mounts on the flag-OFF arm ONLY, and the
   * retired " by N points" suffix was NOT on the surface staging serves.
   * `buildCertaintyCopy` has exactly one consumer, so that is the whole story
   * for this copy.
   *
   * This case is therefore DEFENCE IN DEPTH, and it is labelled as such rather
   * than dressed up as a live-surface guard: the arm is real code, one flag
   * move from being what every user reads, and `certaintyCopy` is the single
   * source for the sentence. The flag is forced OFF here deliberately — a
   * test left on the deployed posture would render no panel at all and its
   * absence assertions would pass by testing nothing.
   *
   * TWO preconditions are pinned in-test, and both earned their place by
   * failing first: the panel must be MOUNTED, and the run must be ON the
   * softened branch. The fixture originally carried no `verdict`, so
   * `NO_CLAIM_VERDICT` returned "the analysis did not put an option forward"
   * long before any leader rule ran — an absence assertion against a headline
   * that never mentions a leader.
   */
  it('DEFENCE IN DEPTH (flag-OFF arm): the softened DecisionConfidencePanel lede states no gap, and keeps its hedge', () => {
    vi.mocked(isAnalysisHeroPanelEnabled).mockReturnValue(false)
    const { container } = renderBody(undefined, true)
    const text = container.textContent ?? ''

    // Precondition 1 — the panel is actually mounted on this arm.
    expect(screen.getByTestId('decision-confidence-panel')).toBeInTheDocument()
    // Precondition 2 — we are on the SOFTENED branch, not a withheld one.
    expect(text).toMatch(new RegExp(`${WINNER_LABEL} currently leads`))

    const { heroSubline, rest } = splitPanelText(container)
    expect(heroSubline).not.toMatch(GAP_CLAIM)
    expect(rest).not.toMatch(POINTS_CLAIM)
    expect(rest).not.toMatch(PP_CLAIM)
    expect(rest).not.toMatch(GAP_CLAIM)
  })

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

  it('FLAG-MOVE GUARD (analysisHeroPanel OFF): the hero still mounts and still states no gap', () => {
    vi.mocked(isAnalysisHeroPanelEnabled).mockReturnValue(false)
    renderBody()

    expect(
      screen.getByTestId('v7-hero'),
      'the V7 hero is mounted unconditionally; if it has been moved onto a flag arm, this fix can ship dark',
    ).toBeInTheDocument()
    const subline = screen.getByTestId('v7-hero-subline')
    expect(subline.textContent ?? '').not.toMatch(GAP_CLAIM)
    expect(subline).toHaveTextContent(`Next: ${RUNNER_UP_LABEL}, 31%`)
  })

  it('BOTH postures mount the hero — the flag decides nothing about this surface', () => {
    for (const posture of [true, false]) {
      vi.mocked(isAnalysisHeroPanelEnabled).mockReturnValue(posture)
      renderBody()
      expect(screen.getByTestId('v7-hero'), `analysisHeroPanel=${posture}`).toBeInTheDocument()
      cleanup()
    }
  })
})
