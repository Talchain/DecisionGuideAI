/**
 * ResultsBody — V7 Lane L4: V7 top matter.
 *
 * Pins the additive top-group content that mounts in the `v7-top-group` slot,
 * ABOVE the "Current view" divider:
 *   (a) present  — freshness strip + hero (+headline +signal row) render, and
 *       ALL sit ABOVE the divider;
 *   (b) absent   — with no analysis, the top matter renders NOTHING (the group
 *       stays empty → hidden), and the pushed-down panel is untouched;
 *   (c) max-2    — with 3 guidance items only 2 chips render;
 *   (d) fresh    — the freshness strip reflects the store's fresh/stale verdict;
 *   (e) honest   — the hero headline is composed ONLY from the fixture winner
 *       label (no invented content).
 *
 * RED-first: against the L3 ResultsBody (no L4 mount) the `v7-top-matter`
 * / `v7-hero` testids do not exist, so (a),(c),(d),(e) fail until L4 lands.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResultsBody } from '../ResultsBody'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriversSectionData,
  DriverItem,
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
    isAnalysisHeroPanelEnabled: vi.fn(() => false),
  }
})

import { useCanvasStore } from '@/canvas/store'
import { useUIStore } from '@/stores/uiStore'
import { useGuidanceStore, type GuidanceItem } from '@/canvas/stores/guidanceStore'
import type { AnalysisFreshnessState } from '@/canvas/store/analysisFreshness'

const WINNER_LABEL = 'Bring In 6-Month Contractor'

function driver(): DriverItem {
  return {
    factorKey: 'n_lead',
    factorLabel: 'Tech lead hired',
    rawElasticity: 1,
    normalisedInfluence: 1,
    rank: 1,
    semanticLabel: 'biggest',
    canFocus: true,
    matchedNodeId: 'n_lead',
  } as DriverItem
}

function makeData(overrides?: { empty?: boolean }): ResultsSectionDataReturn {
  const winner = {
    id: 'opt_a',
    label: WINNER_LABEL,
    expected: 0.8,
    outcome: { mean: 0.8, p10: 0.6, p50: 0.78, p90: 0.95 },
    p10: 0.6,
    p50: 0.78,
    p90: 0.95,
    isRecommended: true,
    winProbability: 0.71,
  } as unknown as OptionResult
  const runnerUp = {
    id: 'opt_b',
    label: 'Hire Permanent Senior Tech Lead',
    isRecommended: false,
    winProbability: 0.31,
  } as unknown as OptionResult

  const recommendation = overrides?.empty
    ? ({ recommendedOption: undefined, allOptions: [], isSingleOption: false } as unknown as DecisionResultData)
    : ({
        recommendedOption: winner,
        allOptions: [winner, runnerUp],
        goalLabel: 'Maximise success',
        goalText: 'Ship the Q4 migration without blowing the budget',
        goalThreshold: 0.6,
        isSingleOption: false,
        analysisStatus: 'computed',
        recommendationStability: 0.92,
        robustnessLevel: 'high',
        isNormalised: false,
      } as unknown as DecisionResultData)

  const drivers: DriversSectionData = overrides?.empty
    ? { drivers: [], topDrivers: [], driversStatus: 'computed', totalCount: 0, hasMagnitudeData: false }
    : { drivers: [driver()], topDrivers: [driver()], driversStatus: 'computed', totalCount: 1, hasMagnitudeData: true }

  const confidence = {
    tier: { tier: 'strong', icon: 'Check', label: 'Tier', description: 'd' },
    qualityScore: 80,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: [],
    topEvidenceGaps: overrides?.empty
      ? []
      : [
          { factorId: 'n_pipeline', factorLabel: 'Hiring Pipeline Duration', confidence: 40, voi: 0.6, suggestion: 'Confirm the pipeline estimate', targetNodeId: 'n_pipeline' },
          { factorId: 'n_salary', factorLabel: 'Salary Budget Utilisation', confidence: 45, voi: 0.5, suggestion: 'Confirm the budget estimate', targetNodeId: 'n_salary' },
        ],
    nextActions: [],
    topNextActions: [],
    challengeFragileEdges: overrides?.empty
      ? []
      : [{ edge_id: 'e1', from_id: 'n_lead', from_label: 'Tech lead hired', to_label: 'Outsource', switch_probability: 0.22 }],
  } as unknown as ConfidenceSectionData

  const improvements: ImprovementsSectionData = { improvements: [], count: 0, hasHighPriority: false } as ImprovementsSectionData

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

function guidanceItem(id: string, priority: number): GuidanceItem {
  return {
    item_id: id,
    source: 'analysis',
    title: `Guidance ${id}`,
    actionLabel: `Do ${id}`,
    primary_action: { type: 'discuss', prompt: `Discuss ${id}` },
    priority,
  } as GuidanceItem
}

function renderBody(overrides?: { empty?: boolean }) {
  return render(
    <ResultsBody
      resultsSectionData={makeData(overrides)}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
      onFocusNode={() => {}}
    />,
  )
}

const before = (a: HTMLElement, b: HTMLElement) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

const FRESH: AnalysisFreshnessState = { freshness: 'fresh', computedAt: '2026-07-23T00:00:00Z' }
const STALE: AnalysisFreshnessState = { freshness: 'stale', computedAt: '2026-07-23T00:00:00Z' }

describe('ResultsBody — V7 L4 top matter', () => {
  beforeEach(() => {
    useCanvasStore.setState({ analysisFreshness: FRESH, analysisFreshnessDirty: false })
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
    useGuidanceStore.setState({ guidanceItems: [] })
  })

  it('(a) renders the hero + signal row + freshness strip, ALL above the divider', () => {
    renderBody()
    const divider = screen.getByTestId('assessment-current-view-divider')
    const topMatter = screen.getByTestId('v7-top-matter')
    const hero = screen.getByTestId('v7-hero')
    const signalRow = screen.getByTestId('v7-signal-row')
    const strip = screen.getByTestId('v7-freshness-strip')
    for (const el of [topMatter, hero, signalRow, strip]) {
      expect(el).toBeInTheDocument()
      expect(before(el, divider), 'top matter precedes the divider').toBe(true)
    }
    // Live hero below the divider is untouched (parity).
    const liveHero = screen.getByTestId('decision-confidence-panel')
    expect(before(divider, liveHero)).toBe(true)
  })

  it('(b) renders NOTHING pre-analysis (top group stays empty), pushed-down panel intact', () => {
    renderBody({ empty: true })
    expect(screen.queryByTestId('v7-top-matter')).not.toBeInTheDocument()
    expect(screen.queryByTestId('v7-hero')).not.toBeInTheDocument()
    const group = screen.getByTestId('v7-top-group')
    expect(group).toBeEmptyDOMElement()
    // The divider + live panel still render (nothing below the divider changed).
    expect(screen.getByTestId('assessment-current-view-divider')).toBeInTheDocument()
    expect(screen.getByTestId('decision-confidence-panel')).toBeInTheDocument()
  })

  it('(c) max-2 chips: 3 guidance items → exactly 2 chips', () => {
    useGuidanceStore.setState({
      guidanceItems: [guidanceItem('one', 90), guidanceItem('two', 80), guidanceItem('three', 70)],
    })
    renderBody()
    expect(screen.getAllByTestId('v7-suggested-chip')).toHaveLength(2)
  })

  it('(d) freshness strip reflects the store verdict (fresh vs stale)', () => {
    const { unmount } = renderBody()
    expect(screen.getByTestId('v7-freshness-strip')).toHaveAttribute('data-freshness-semantic', 'current')
    expect(screen.getByTestId('v7-freshness-strip')).toHaveTextContent('Analysis reflects the current model.')
    unmount()

    useCanvasStore.setState({ analysisFreshness: STALE, analysisFreshnessDirty: false })
    renderBody()
    expect(screen.getByTestId('v7-freshness-strip')).toHaveAttribute('data-freshness-semantic', 'changed')
  })

  it('(e) no invented content: hero headline is composed only from the fixture winner', () => {
    renderBody()
    // Robust fixture (stability 0.92, clear gap) → the re-anchored leader
    // headline. SUPERSEDED 2026-07-31: was the "performs best" form, a bare
    // superlative retired under §6.2c. The BRANCH is unchanged.
    expect(screen.getByTestId('v7-hero-headline')).toHaveTextContent(new RegExp(`${WINNER_LABEL} came out ahead in .+ of simulated scenarios`))
    // Signal chips echo the fixture's fragile edge + top driver, verbatim.
    // ROADMAP 2.296 / 2.291: this fixture carries NO flip thresholds, so the
    // chip is on the legacy arm — the retained percentage is an EDGE statistic
    // (switch_probability) and is now labelled with the register's own name
    // for the quantity ("N% switch") and attributed to the edge it belongs
    // to, named "{from} → {to}". The previous pin ("22% flip risk · Tech lead
    // hired") asserted the defect: an edge number dressed as the factor's
    // flip evidence.
    expect(screen.getByTestId('v7-signal-flip-risk')).toHaveTextContent('22% switch · Tech lead hired → Outsource')
    expect(screen.getByTestId('v7-signal-main-driver')).toHaveTextContent('Main driver · Tech lead hired')
    // Sharpen line quotes Paul's own brief wording.
    expect(screen.getByTestId('v7-sharpen-quote')).toHaveTextContent('Ship the Q4 migration without blowing the budget')
  })
})
