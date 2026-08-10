/**
 * ResultsBody → V7 hero subline — THE GAP NUMBER IS RETIRED (2026-08-10).
 *
 * The deployed hero rendered a correct statement of the leader's OWN win
 * probability ("… came out ahead in 71% of simulated scenarios") and then, on
 * the line immediately beneath it, "Leads by 40 points" — the percentage-point
 * DIFFERENCE between two Monte-Carlo win frequencies. The ratified rule: no
 * user-facing surface states that gap; the leader's own probability is the
 * statistic. The subline now names the runner-up and states ITS OWN
 * probability instead, so the reader gets both numbers and the product asserts
 * no difference it has not earned.
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

function makeData(): ResultsSectionDataReturn {
  const winner = {
    id: 'opt_a',
    label: WINNER_LABEL,
    isRecommended: true,
    winProbability: 0.71,
  } as unknown as OptionResult
  const runnerUp = {
    id: 'opt_b',
    label: RUNNER_UP_LABEL,
    isRecommended: false,
    winProbability: 0.31,
  } as unknown as OptionResult

  const recommendation = {
    recommendedOption: winner,
    allOptions: [winner, runnerUp],
    goalLabel: 'Maximise success',
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

function renderBody() {
  return render(
    <ResultsBody
      resultsSectionData={makeData()}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
      onFocusNode={() => {}}
    />,
  )
}

const FRESH: AnalysisFreshnessState = { freshness: 'fresh', computedAt: '2026-08-10T00:00:00Z' }

/** The retired form, in every pluralisation and casing it could return in. */
const GAP_CLAIM = /leads?\s+by\s+\d+\s+points?/i

describe('ResultsBody → V7 hero — the pp-gap subline is retired on the live mount path', () => {
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
   * ⚠ SCOPE, STATED EXACTLY. This asserts the HERO's retired form
   * ("Leads by N points") appears NOWHERE in the panel — not that the panel
   * is free of pp-gap claims. It is not: `OptionCards` renders "Behind by N
   * percentage points" for the same win-frequency difference, and the canvas
   * `OptionNode` renders "Close call: within N percentage points". Both are
   * separate surfaces, out of this lane's scope, and reported rather than
   * silently folded in. Widening `GAP_CLAIM` to cover them would make this
   * spec assert a claim about surfaces this change does not touch.
   */
  it('the hero’s retired gap form appears NOWHERE in the rendered panel (it was rendered once, by the hero)', () => {
    const { container } = renderBody()
    expect(container.textContent ?? '').not.toMatch(GAP_CLAIM)
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
