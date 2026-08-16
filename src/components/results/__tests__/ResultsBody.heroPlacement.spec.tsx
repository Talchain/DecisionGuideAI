/**
 * ResultsBody — Analysis hero panel placement.
 *
 * The hero mounts UNCONDITIONALLY after the freshness notice slot and above
 * the Focus panel, which still precedes the Options section. The fork that
 * once selected between this hero and a legacy DecisionConfidencePanel is
 * closed; those alternatives are deleted.
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
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

vi.mock('@/flags', async () => {
  const actual = await vi.importActual<typeof import('@/flags')>('@/flags')
  return {
    ...actual,
    isFocusNowPanelEnabled: vi.fn(() => true),
    isAiPanelV2Enabled: vi.fn(() => true),
  }
})

import {
  isFocusNowPanelEnabled,
  isAiPanelV2Enabled,
} from '@/flags'
import { useCanvasStore } from '@/canvas/store'
import { useUIStore } from '@/stores/uiStore'
import { collectRerunControls } from '../../../../tests/helpers/rerunControls'

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

describe('ResultsBody — Analysis hero placement', () => {
  beforeEach(() => {
    vi.mocked(isFocusNowPanelEnabled).mockReturnValue(true)
    vi.mocked(isAiPanelV2Enabled).mockReturnValue(true)
    useCanvasStore.setState({ analysisFreshness: null, analysisFreshnessDirty: false })
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
  })

  it('the hero is the ONLY headline panel — the legacy decision-confidence panel is gone', () => {
    // The fork that used to select between this hero and the legacy panel is
    // closed; the hero mounts unconditionally and owns the slot.
    renderBody()
    const hero = screen.getByTestId('analysis-hero-panel')
    expect(screen.queryByTestId('decision-confidence-panel')).toBeNull()
    const focus = screen.getByTestId('focus-now-panel')
    const options = screen.getByTestId('section-header-options')
    expect(before(hero, focus), 'hero precedes the Focus panel').toBe(true)
    expect(before(focus, options), 'Focus panel still precedes options').toBe(true)
  })

  it('hero consumes the same data (headline names the recommended option)', () => {
    renderBody()
    expect(screen.getByTestId('hero-headline')).toHaveTextContent(/Option A has the highest chance of meeting every target this run scored: .+\./)
  })

  it('stale: hero authors NO rerun and NO stale surface — the strip owns recovery (C1)', () => {
    // Realistic stale state: the freshness slice IS stale, so the tab's
    // AnalysisFreshnessNotice (mounted by OutputsDock) carries the warning
    // AND the one Rerun — the hero must not repeat either (ratified v6
    // guide: the hero has no stale affordance at all; brief §2.2 never
    // repeats the same action across surfaces).
    useCanvasStore.setState({ analysisFreshness: { freshness: 'stale' }, analysisFreshnessDirty: false })
    renderBody({ isStale: true })
    // Re-anchored (C1 review): `hero-rerun` exists nowhere in source, so this
    // could never fail. Anchor to the hero's REAL root (getByTestId throws if
    // the hero stops rendering, so the pin cannot go vacuous again) and sweep
    // its subtree for a run control of any name/testid.
    expect(collectRerunControls(screen.getByTestId('analysis-hero-panel'))).toEqual(new Set())
    // Content stays readable and interactive (no dim/lock regression).
    expect(screen.getByTestId('hero-headline')).toHaveTextContent(/Option A has the highest chance of meeting every target this run scored: .+\./)
    // Wave F-B: the freshness strip mounts in OutputsDock ABOVE the dim
    // wrapper (review a) — ResultsBody itself authors NO stale surface,
    // and the hero authors no stale banner either.
    expect(screen.queryByTestId('analysis-freshness-notice')).not.toBeInTheDocument()
    const hero = screen.getByTestId('analysis-hero-panel')
    expect(hero.textContent).not.toMatch(/stale|not analysed|re-run before/i)
  })

  it('hero focus-next is neutral copy that scrolls the REAL mounted coaching panel', () => {
    // Focus-next reconciliation (review item 1): the coaching panel orders
    // its rows positionally (buildFocusRows), not by vm.topAction, so the
    // hero deliberately names NO action — neutral copy targeting the panel
    // container. This test runs against the real mounted tree, not a
    // synthetic target.
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

  it('coaching panel OFF: focus-next degrades to plain text (no dead link, no throw)', () => {
    vi.mocked(isFocusNowPanelEnabled).mockReturnValue(false)
    renderBody()
    expect(screen.queryByTestId('focus-now-panel')).toBeNull()
    const focusNext = screen.getByTestId('hero-focus-next')
    expect(focusNext.tagName).toBe('P')
    expect(focusNext).toHaveTextContent('Focus next: review the top actions below.')
  })

  it('no superseded headline surface survives beside the hero', () => {
    // The retirement covered the whole legacy slot — legacy panel, v17
    // variant and compare mode — so no second headline surface can mount
    // beside the merged panel.
    renderBody()
    expect(screen.getByTestId('analysis-hero-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-hero-v17')).toBeNull()
    expect(screen.queryByTestId('decision-confidence-panel')).toBeNull()
  })
})
describe("Paul's ruling (2026-07-12): risk appetite is an explicitly-labelled lens", () => {
  it('non-neutral appetite shows the lens label; neutral shows none', () => {
    useCanvasStore.setState({ analysisFreshness: { freshness: 'fresh' }, analysisFreshnessDirty: false })
    renderBody()
    expect(screen.queryByTestId('risk-lens-label')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Optimistic (p90)' }))
    expect(screen.getByTestId('risk-lens-label')).toHaveTextContent(/highlights the option with the strongest high end \(p90\)/i)
    // SUPERSEDED 2026-07-31: the un-anchored noun "the recommendation" is
    // retired; the lens sentence now names the quantity that is unchanged.
    expect(screen.getByTestId('risk-lens-label')).toHaveTextContent(/goal ranking above is unchanged/i)
    fireEvent.click(screen.getByRole('button', { name: 'Cautious (p10)' }))
    expect(screen.getByTestId('risk-lens-label')).toHaveTextContent(/highlights the option with the strongest low end \(p10\)/i)
    fireEvent.click(screen.getByRole('button', { name: 'Middle (p50)' }))
    expect(screen.queryByTestId('risk-lens-label')).not.toBeInTheDocument()
  })

  it('a non-neutral lens never rewrites the recommendation panel above the cards', () => {
    useCanvasStore.setState({ analysisFreshness: { freshness: 'fresh' }, analysisFreshnessDirty: false })
    renderBody()
    const heroBefore = screen.getByTestId('analysis-hero-panel').textContent
    fireEvent.click(screen.getByRole('button', { name: 'Cautious (p10)' }))
    // Strict: the lens label renders OUTSIDE this panel, so any drift here
    // is real contamination.
    expect(screen.getByTestId('analysis-hero-panel').textContent).toBe(heroBefore)
  })
})
describe('Wave 2 retirement: stress-test thinking-pattern templates', () => {
  it('the UI-authored Thinking patterns subsection retires; producer-backed subsections stay', () => {
    useCanvasStore.setState({ analysisFreshness: { freshness: 'fresh' }, analysisFreshnessDirty: false })
    renderBody()
    fireEvent.click(screen.getByTestId('accordion-stress-test'))
    expect(screen.getByTestId('stress-test-section')).toBeInTheDocument()
    expect(screen.queryByTestId('stress-test-thinking-subsection')).toBeNull()
  })
})
