/**
 * V7 hero — NO WIN-FREQUENCY GAP, in its new home (the Alt view tab).
 *
 * The V7-hero arms of the 2026-08-10 win-frequency-gap guard, moved here from
 * `ResultsBody.winFrequencyGapAbsence.spec.tsx` when the V7 group moved to the
 * temporary "Alt view" dock tab (12 Aug 2026, Paul: "move, NOT delete"). The
 * BEHAVIOUR pinned is byte-for-byte what the hero did on the Analysis tab:
 *   · the hero states the leader's OWN probability, and NO gap;
 *   · the honest subline names the runner-up with ITS OWN probability;
 *   · the SANCTIONED exception survives the move: the hero's GOAL arm may say
 *     "Leads by N points" over GOAL probabilities (its own pairing rationale
 *     in `goalLeadPoints`) — and ONLY the hero subline may carry that shape;
 *   · the surface mounts on BOTH postures of `analysisHeroPanel` — the Alt
 *     view tab consults no flag, and this guard proves a future change cannot
 *     quietly re-gate it (trap 3b: the estate shipped the same feature dark
 *     twice by hosting it on the arm the deployed flags switch off).
 *
 * The Analysis-tab half of the class guard (whole-panel absence, positive
 * controls, the DecisionConfidencePanel defence-in-depth arm) stays in
 * `ResultsBody.winFrequencyGapAbsence.spec.tsx`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { V7ComparisonTabBody } from '../V7ComparisonTabBody'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriversSectionData,
  ImprovementsSectionData,
  OptionResult,
} from '../../types'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

vi.mock('@/flags', async () => {
  const actual = await vi.importActual<typeof import('@/flags')>('@/flags')
  return {
    ...actual,
    isAnalysisHeroPanelEnabled: vi.fn(() => true),
  }
})

import { isAnalysisHeroPanelEnabled } from '@/flags'
import { useCanvasStore } from '@/canvas/store'
import { useGuidanceStore } from '@/canvas/stores/guidanceStore'
import type { AnalysisFreshnessState } from '@/canvas/store/analysisFreshness'

const WINNER_LABEL = 'Bring In 6-Month Contractor'
const RUNNER_UP_LABEL = 'Hire Permanent Senior Tech Lead'

function makeData(withGoalData = false): ResultsSectionDataReturn {
  const winner = {
    id: 'opt_a',
    label: WINNER_LABEL,
    isRecommended: true,
    winProbability: 0.71,
    ...(withGoalData ? { goalProbability: 0.9 } : {}),
  } as unknown as OptionResult
  const runnerUp = {
    id: 'opt_b',
    label: RUNNER_UP_LABEL,
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
    recommendationStability: 0.92,
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
    tier: { tier: 'strong', icon: 'Check', label: 'Tier', description: 'd' },
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

function renderTab(withGoalData = false) {
  return render(
    <V7ComparisonTabBody
      resultsSectionData={makeData(withGoalData)}
      onSendMessage={() => {}}
      onFocusNode={() => {}}
    />,
  )
}

const FRESH: AnalysisFreshnessState = { freshness: 'fresh', computedAt: '2026-08-12T00:00:00Z' }

/** The retired form, in every pluralisation and casing it could return in. */
const GAP_CLAIM = /leads?\s+by\s+\d+\s+points?/i
const PP_CLAIM = /percentage\s+points?/i
const POINTS_CLAIM = /\bby\s+-?\d+(\.\d+)?\s+points?\b/i

/**
 * The hero subline is the ONE surface entitled to the "by N points" shape
 * (its GOAL arm — goal probabilities, not win frequencies), so it is judged
 * on its own and the REST of the tab may carry none of the three forms.
 */
function splitTabText(container: HTMLElement): { heroSubline: string; rest: string } {
  const heroSubline = screen.queryByTestId('v7-hero-subline')?.textContent ?? ''
  const all = container.textContent ?? ''
  return {
    heroSubline,
    rest: heroSubline ? all.replace(heroSubline, '') : all,
  }
}

describe('V7 hero in the Alt view tab — own-probability statements only, never a win-frequency gap', () => {
  beforeEach(() => {
    useCanvasStore.setState({ analysisFreshness: FRESH, analysisFreshnessDirty: false })
    useGuidanceStore.setState({ guidanceItems: [] })
    vi.mocked(isAnalysisHeroPanelEnabled).mockReturnValue(true)
  })

  it('the hero mounts, states the leader’s OWN probability, and states NO gap', () => {
    renderTab()

    // MOUNT PATH — assert the hero is on screen before asserting anything
    // about its copy. A green copy assertion against an unmounted component is
    // the defect this guard exists to prevent.
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
   * ⭐ THE SANCTIONED FORM MUST SURVIVE THE MOVE, and this proves it does.
   *
   * With goal data present the hero takes its GOAL arm, whose subline is
   * "Leads by N points" over GOAL PROBABILITIES (0.9 − 0.4 = 50). That form
   * is correct and has its own pairing rationale; a guard that REDs on it
   * would be a false alarm, and a false alarm on correct behaviour is how a
   * guard gets switched off. So: the sanctioned sentence is asserted PRESENT,
   * and the banned class is asserted absent everywhere else in the same
   * render.
   */
  it('the SANCTIONED goal-arm subline survives, and nothing else in the tab states a gap', () => {
    const { container } = renderTab(true)

    // Precondition — we are actually on the goal arm, not silently comparative.
    const subline = screen.getByTestId('v7-hero-subline')
    expect(subline).toHaveTextContent('Leads by 50 points')

    // ⭐ THE OVERLAP, MADE EXPLICIT: the sanctioned sentence DOES match the
    // banned-shape pattern — which is precisely why the pattern is scoped by
    // region rather than weakened.
    expect(subline.textContent ?? '').toMatch(GAP_CLAIM)

    const { rest } = splitTabText(container)
    expect(rest).not.toMatch(GAP_CLAIM)
    expect(rest).not.toMatch(POINTS_CLAIM)
    expect(rest).not.toMatch(PP_CLAIM)
    // And the unambiguous phrase is absent from the WHOLE tab, hero included.
    expect(container.textContent ?? '').not.toMatch(PP_CLAIM)
  })

  it('BOTH postures of analysisHeroPanel mount the hero — the Alt view tab consults no flag', () => {
    for (const posture of [true, false]) {
      vi.mocked(isAnalysisHeroPanelEnabled).mockReturnValue(posture)
      renderTab()
      expect(
        screen.getByTestId('v7-hero'),
        `analysisHeroPanel=${posture}: if the Alt view tab has been re-gated, this comparison surface can ship dark`,
      ).toBeInTheDocument()
      const subline = screen.getByTestId('v7-hero-subline')
      expect(subline.textContent ?? '').not.toMatch(GAP_CLAIM)
      expect(subline).toHaveTextContent(`Next: ${RUNNER_UP_LABEL}, 31%`)
      cleanup()
    }
  })
})
