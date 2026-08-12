/**
 * V7 top matter, in its new home — the Alt view comparison tab.
 *
 * HISTORY: this file was `ResultsBody.v7TopMatter.spec.tsx` and pinned the V7
 * L4 top matter inside ResultsBody's `v7-top-group` slot, above the "Current
 * view" divider. On 12 Aug 2026 the whole V7 group MOVED, unchanged, to the
 * temporary "Alt view" dock tab (`V7ComparisonTabBody`) — Paul: "move, NOT
 * delete". The harness is re-bound to the new (and only) production parent;
 * every BEHAVIOUR pin below is byte-for-byte the behaviour the group had on
 * the Analysis tab:
 *   (a) present  — freshness strip + hero (+headline +signal row) render
 *       inside the tab body;
 *   (b) absent   — with no analysis, the top matter renders NOTHING (the
 *       tab's empty state shows instead, never both);
 *   (c) max-2    — with 3 guidance items only 2 chips render;
 *   (d) fresh    — the freshness strip reflects the store's fresh/stale
 *       verdict;
 *   (e) honest   — the hero headline is composed ONLY from the fixture winner
 *       label (no invented content).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { V7ComparisonTabBody } from '../V7ComparisonTabBody'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriversSectionData,
  DriverItem,
  ImprovementsSectionData,
  OptionResult,
} from '../../types'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

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

function renderTab(overrides?: { empty?: boolean }) {
  return render(
    <V7ComparisonTabBody
      resultsSectionData={makeData(overrides)}
      onSendMessage={() => {}}
      onFocusNode={() => {}}
    />,
  )
}

const FRESH: AnalysisFreshnessState = { freshness: 'fresh', computedAt: '2026-07-23T00:00:00Z' }
const STALE: AnalysisFreshnessState = { freshness: 'stale', computedAt: '2026-07-23T00:00:00Z' }

describe('V7 top matter — behaviour unchanged in the Alt view tab', () => {
  beforeEach(() => {
    useCanvasStore.setState({ analysisFreshness: FRESH, analysisFreshnessDirty: false })
    useUIStore.setState({ activeOutputTab: 'altview', activeOutputTabVersion: 0 })
    useGuidanceStore.setState({ guidanceItems: [] })
  })

  it('(a) renders the hero + signal row + freshness strip inside the tab body', () => {
    renderTab()
    const tabBody = screen.getByTestId('v7-comparison-tab-body')
    for (const id of ['v7-top-matter', 'v7-hero', 'v7-signal-row', 'v7-freshness-strip']) {
      expect(within(tabBody).getByTestId(id), `${id} mounts inside the tab body`).toBeInTheDocument()
    }
  })

  it('(b) renders NOTHING pre-analysis — the empty state shows instead, never both', () => {
    renderTab({ empty: true })
    expect(screen.queryByTestId('v7-top-matter')).not.toBeInTheDocument()
    expect(screen.queryByTestId('v7-hero')).not.toBeInTheDocument()
    expect(screen.getByTestId('v7-comparison-tab-empty')).toBeInTheDocument()
  })

  it('(c) max-2 chips: 3 guidance items → exactly 2 chips', () => {
    useGuidanceStore.setState({
      guidanceItems: [guidanceItem('one', 90), guidanceItem('two', 80), guidanceItem('three', 70)],
    })
    renderTab()
    expect(screen.getAllByTestId('v7-suggested-chip')).toHaveLength(2)
  })

  it('(d) freshness strip reflects the store verdict (fresh vs stale)', () => {
    const { unmount } = renderTab()
    expect(screen.getByTestId('v7-freshness-strip')).toHaveAttribute('data-freshness-semantic', 'current')
    expect(screen.getByTestId('v7-freshness-strip')).toHaveTextContent('Analysis reflects the current model.')
    unmount()

    useCanvasStore.setState({ analysisFreshness: STALE, analysisFreshnessDirty: false })
    renderTab()
    expect(screen.getByTestId('v7-freshness-strip')).toHaveAttribute('data-freshness-semantic', 'changed')
  })

  it('(e) no invented content: hero headline is composed only from the fixture winner', () => {
    renderTab()
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
