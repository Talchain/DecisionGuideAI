/**
 * ResultsBody — Analysis hero panel placement + flag regression.
 *
 * Flag OFF: the Analysis tab renders EXACTLY as today — no hero element, the
 * existing hero (DecisionConfidencePanel), Focus panel and Options section
 * unchanged and in order.
 *
 * Flag ON: the new hero mounts AFTER the freshness notice slot and ABOVE the
 * existing hero block (stack decision), with every existing panel still
 * present and ordered. Stale prop routes the hero's Focus-next to Re-run.
 *
 * NOTE: this spec deliberately does not import anything from the
 * analysis-hero module — its inertness guard allow-lists ResultsBody as the
 * only external importer — so the fixture data is built locally.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
}))

vi.mock('@/flags', async () => {
  const actual = await vi.importActual<typeof import('@/flags')>('@/flags')
  return {
    ...actual,
    isAnalysisHeroV17Enabled: vi.fn(() => false),
    isAnalysisHeroCompareEnabled: vi.fn(() => false),
    isFocusNowPanelEnabled: vi.fn(() => true),
    isAiPanelV2Enabled: vi.fn(() => true),
    isAnalysisHeroPanelEnabled: vi.fn(() => false),
  }
})

import {
  isAnalysisHeroV17Enabled,
  isAnalysisHeroCompareEnabled,
  isFocusNowPanelEnabled,
  isAiPanelV2Enabled,
  isAnalysisHeroPanelEnabled,
} from '@/flags'
import { useCanvasStore } from '@/canvas/store'
import { useUIStore } from '@/stores/uiStore'

function makeData(): ResultsSectionDataReturn {
  const winner = {
    id: 'opt_a',
    label: 'Option A',
    expected: 0.8,
    outcome: { mean: 0.8, p10: 0.6, p50: 0.78, p90: 0.95 },
    p10: 0.6,
    p50: 0.78,
    p90: 0.95,
    isRecommended: true,
    winProbability: 0.7,
    goalProbability: 0.7,
  } as unknown as OptionResult
  const runnerUp = {
    id: 'opt_b',
    label: 'Option B',
    expected: 0.4,
    outcome: { mean: 0.4, p10: 0.2, p50: 0.38, p90: 0.6 },
    p10: 0.2,
    p50: 0.38,
    p90: 0.6,
    isRecommended: false,
    winProbability: 0.3,
    goalProbability: 0.3,
  } as unknown as OptionResult
  const recommendation = {
    recommendedOption: winner,
    allOptions: [winner, runnerUp],
    goalLabel: 'Maximise success',
    // UI-SEM-071/072 (PR #234, "null-target goal-fit suppression"): the hero
    // headline crown, goal lens, and the footer's focus-next slot are all
    // gated on a USER-set success target (goalThreshold != null), never on
    // producer goalProbability presence alone. Without it here, the hero
    // fell back to the no-target state — no goal-fit headline, and the
    // footer rendered the "set your target" goal-hint editor instead of
    // hero-focus-next, which is what this spec's placement/regression
    // assertions are actually about.
    goalThreshold: 0.6,
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: 0.92,
    robustnessLevel: 'high',
    isNormalised: false,
    coachingReadiness: 'ready',
    coachingReadinessDimensions: { evidence: 0.8, robustness: 0.75, clarity: 0.85 },
  } as DecisionResultData
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

function renderBody(props: { isStale?: boolean } = {}) {
  return render(
    <ResultsBody
      resultsSectionData={makeData()}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
      isStale={props.isStale}
    />,
  )
}

const before = (a: HTMLElement, b: HTMLElement) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('ResultsBody — Analysis hero placement + flag regression', () => {
  beforeEach(() => {
    vi.mocked(isAnalysisHeroV17Enabled).mockReturnValue(false)
    vi.mocked(isAnalysisHeroCompareEnabled).mockReturnValue(false)
    vi.mocked(isFocusNowPanelEnabled).mockReturnValue(true)
    vi.mocked(isAiPanelV2Enabled).mockReturnValue(true)
    vi.mocked(isAnalysisHeroPanelEnabled).mockReturnValue(false)
    useCanvasStore.setState({ analysisFreshness: null, analysisFreshnessDirty: false })
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
  })

  it('flag OFF: no hero element; existing panels unchanged and ordered', () => {
    renderBody()
    expect(screen.queryByTestId('analysis-hero-panel')).toBeNull()
    const existingHero = screen.getByTestId('decision-confidence-panel')
    const focus = screen.getByTestId('focus-now-panel')
    const options = screen.getByTestId('section-header-options')
    expect(before(existingHero, focus)).toBe(true)
    expect(before(focus, options)).toBe(true)
  })

  it('flag ON: hero mounts ABOVE the existing hero block; existing panels untouched', () => {
    vi.mocked(isAnalysisHeroPanelEnabled).mockReturnValue(true)
    renderBody()
    const hero = screen.getByTestId('analysis-hero-panel')
    const existingHero = screen.getByTestId('decision-confidence-panel')
    const focus = screen.getByTestId('focus-now-panel')
    const options = screen.getByTestId('section-header-options')
    expect(before(hero, existingHero), 'new hero must precede the existing hero').toBe(true)
    expect(before(existingHero, focus), 'existing hero still precedes the Focus panel').toBe(true)
    expect(before(focus, options), 'Focus panel still precedes options').toBe(true)
  })

  it('flag ON: hero consumes the same data (headline names the recommended option)', () => {
    vi.mocked(isAnalysisHeroPanelEnabled).mockReturnValue(true)
    renderBody()
    expect(screen.getByTestId('hero-headline')).toHaveTextContent('Option A best fits your goal.')
  })

  it('flag ON + stale: hero soft-disables and offers Re-run (no extra stale banner)', () => {
    vi.mocked(isAnalysisHeroPanelEnabled).mockReturnValue(true)
    // Realistic stale state: the freshness slice IS stale, so the tab's
    // AnalysisFreshnessNotice actually renders — the hero must not add a
    // second stale surface of its own.
    useCanvasStore.setState({ analysisFreshness: { freshness: 'stale' }, analysisFreshnessDirty: false })
    renderBody({ isStale: true })
    expect(screen.getByTestId('hero-rerun')).toBeInTheDocument()
    // Exactly ONE stale surface on the tab: the existing notice…
    const notices = screen.getAllByTestId('analysis-freshness-notice')
    expect(notices).toHaveLength(1)
    // …and it is NOT inside the hero (the hero authors no stale banner).
    const hero = screen.getByTestId('analysis-hero-panel')
    expect(hero.contains(notices[0])).toBe(false)
    expect(hero.textContent).not.toMatch(/stale|not analysed|re-run before/i)
  })

  it('flag ON: hero focus-next is neutral copy that scrolls the REAL mounted coaching panel', () => {
    // Focus-next reconciliation (review item 1): the coaching panel orders
    // its rows positionally (buildFocusRows), not by vm.topAction, so the
    // hero deliberately names NO action — neutral copy targeting the panel
    // container. This test runs against the real mounted tree, not a
    // synthetic target.
    vi.mocked(isAnalysisHeroPanelEnabled).mockReturnValue(true)
    renderBody()
    const panel = screen.getByTestId('focus-now-panel')
    const scrollSpy = vi.fn()
    panel.scrollIntoView = scrollSpy

    const focusNext = screen.getByTestId('hero-focus-next')
    expect(focusNext.tagName).toBe('BUTTON')
    // Neutral copy — names the panel, never a specific coaching row.
    expect(focusNext).toHaveTextContent('Focus next: review the top actions below.')
    const heroText = screen.getByTestId('analysis-hero-panel').textContent ?? ''
    expect(heroText).not.toContain('Define what success looks like')
    expect(heroText).not.toContain('Add a risk')

    fireEvent.click(focusNext)
    expect(scrollSpy).toHaveBeenCalledTimes(1)
  })

  it('flag ON, coaching panel OFF: focus-next degrades to plain text (no dead link, no throw)', () => {
    vi.mocked(isAnalysisHeroPanelEnabled).mockReturnValue(true)
    vi.mocked(isFocusNowPanelEnabled).mockReturnValue(false)
    renderBody()
    expect(screen.queryByTestId('focus-now-panel')).toBeNull()
    const focusNext = screen.getByTestId('hero-focus-next')
    expect(focusNext.tagName).toBe('P')
    expect(focusNext).toHaveTextContent('Focus next: review the top actions below.')
  })

  it('flag ON with V17 hero enabled: new hero still precedes the V17 hero slot', () => {
    vi.mocked(isAnalysisHeroPanelEnabled).mockReturnValue(true)
    vi.mocked(isAnalysisHeroV17Enabled).mockReturnValue(true)
    renderBody()
    const hero = screen.getByTestId('analysis-hero-panel')
    const v17 = screen.getByTestId('analysis-hero-v17')
    expect(before(hero, v17), 'new hero must precede AnalysisHeroV17').toBe(true)
  })
})
