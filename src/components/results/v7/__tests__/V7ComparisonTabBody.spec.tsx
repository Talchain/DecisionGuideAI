/**
 * V7ComparisonTabBody — the V7 group's NEW (and only) production home
 * (Paul, 12 Aug 2026: move the duplicated analysis surfaces to a temporary
 * comparison tab — move, NOT delete).
 *
 * The entire V7 assessment group (`V7TopMatter`: freshness strip, sharpen
 * line, what-I-was-given, hero, lens group, evidence disclosure, guidance,
 * bias) MOVED here unchanged from the Analysis tab, so Paul can compare the
 * two renderings of the SAME analysis without the duplication polluting the
 * working tab.
 *
 * Pins (the NEW-HOME half of the move; the Analysis-tab half lives in
 * `__tests__/ResultsBody.v7Retired.spec.tsx`):
 *   (a) PRESENCE — with analysis data, the tab body mounts `V7TopMatter`
 *       (a regression that removes V7 from this tab turns this RED — the
 *       brief's named presence test);
 *   (b) the in-tab header names it a TEMPORARY comparison of an alternate
 *       rendering of the same analysis;
 *   (c) EMPTY STATE — pre-analysis, no V7 content and an honest one-line
 *       invitation instead (same `v7HasAnalysis` predicate V7TopMatter itself
 *       gates on — one predicate, no twin);
 *   (d) SINGLE DATA AUTHORITY — `V7TopMatter` receives the SAME
 *       `resultsSectionData` object (identity, not a copy) handed to the tab
 *       body, and a `decisionState` equal to what the ONE shared
 *       `buildResultsVM` derives from those same inputs — the exact value the
 *       Analysis tab's live hero consumes. No forked derivation.
 *
 * RED-first at pristine 611d91c0: the module under test does not exist, so
 * this file fails at collect — the loudest possible RED.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { V7TopMatterProps } from '../V7TopMatter'
import { V7ComparisonTabBody } from '../V7ComparisonTabBody'
import { buildResultsVM } from '../../buildResultsVM'
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

/**
 * Observe the prop boundary WITHOUT replacing the component: the mock spreads
 * `importOriginal` and DELEGATES to the real `V7TopMatter`, so every rendering
 * assertion still exercises the real tree (the drift-proof pattern from
 * `ResultsBody.v7SharpenQuoteProvenance.spec.tsx` — trap 12: a hand-listed
 * stub silently drops whatever the module gains next).
 */
const { topMatterProps } = vi.hoisted(() => ({ topMatterProps: [] as V7TopMatterProps[] }))

vi.mock('../V7TopMatter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../V7TopMatter')>()
  const { createElement } = await import('react')
  return {
    ...actual,
    V7TopMatter: (props: V7TopMatterProps) => {
      topMatterProps.push(props)
      return createElement(actual.V7TopMatter, props)
    },
  }
})

import { useCanvasStore } from '@/canvas/store'
import { useGuidanceStore } from '@/canvas/stores/guidanceStore'
import type { AnalysisFreshnessState } from '@/canvas/store/analysisFreshness'

const WINNER_LABEL = 'Bring In 6-Month Contractor'

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

const FRESH: AnalysisFreshnessState = { freshness: 'fresh', computedAt: '2026-08-12T00:00:00Z' }

describe('V7ComparisonTabBody — the moved V7 group in its temporary comparison tab', () => {
  beforeEach(() => {
    topMatterProps.length = 0
    useCanvasStore.setState({ analysisFreshness: FRESH, analysisFreshnessDirty: false })
    useGuidanceStore.setState({ guidanceItems: [] })
  })

  it('(a) PRESENCE: with analysis data, the tab body mounts the V7 top matter — removing it from this tab REDs here', () => {
    render(
      <V7ComparisonTabBody
        resultsSectionData={makeData()}
        onSendMessage={() => {}}
        onFocusNode={() => {}}
      />,
    )
    expect(screen.getByTestId('v7-comparison-tab-body')).toBeInTheDocument()
    expect(screen.getByTestId('v7-top-matter')).toBeInTheDocument()
    // The group's own composition is unchanged in its new home — spot-pin the
    // hero by identity and its headline by the fixture winner (no invented
    // content; deep behaviour pins live in the V7 component suites).
    expect(screen.getByTestId('v7-hero')).toBeInTheDocument()
    expect(screen.getByTestId('v7-hero-headline')).toHaveTextContent(
      new RegExp(`${WINNER_LABEL} came out ahead in 71% of simulated scenarios`),
    )
    expect(screen.getByTestId('v7-freshness-strip')).toBeInTheDocument()
  })

  it('(b) the in-tab header names it a temporary comparison of an alternate rendering, same analysis', () => {
    render(<V7ComparisonTabBody resultsSectionData={makeData()} />)
    const header = screen.getByTestId('v7-comparison-tab-header')
    expect(header.textContent ?? '').toMatch(/[Tt]emporary comparison/)
    expect(header.textContent ?? '').toMatch(/alternat(e|ive) rendering/)
    expect(header.textContent ?? '').toMatch(/same analysis/)
  })

  it('(c) EMPTY STATE: pre-analysis, no V7 content — an honest invitation renders instead, never both', () => {
    render(<V7ComparisonTabBody resultsSectionData={makeData({ empty: true })} />)
    expect(screen.queryByTestId('v7-top-matter')).not.toBeInTheDocument()
    expect(screen.queryByTestId('v7-hero')).not.toBeInTheDocument()
    expect(screen.getByTestId('v7-comparison-tab-empty')).toBeInTheDocument()
    // The header still orients the user on what this tab is.
    expect(screen.getByTestId('v7-comparison-tab-header')).toBeInTheDocument()
  })

  it('(d) SINGLE DATA AUTHORITY: V7TopMatter gets the SAME data object, and the SAME decisionState the shared builder derives', () => {
    const data = makeData()
    render(
      <V7ComparisonTabBody
        resultsSectionData={data}
        fragileEdgeCount={2}
        robustEdgeCount={3}
      />,
    )
    expect(topMatterProps.length).toBeGreaterThan(0)
    const received = topMatterProps[topMatterProps.length - 1]
    // Identity, not equality: a cloned/re-derived payload would be a forked
    // authority even if deep-equal today (trap 19 — bind by identity).
    expect(received.resultsSectionData).toBe(data)
    // decisionState comes from the ONE shared buildResultsVM over the SAME
    // inputs ResultsBody hands it on the Analysis tab (fragile=2, total=5).
    const expected = buildResultsVM(data, { fragileEdgeCount: 2, totalEdgeCount: 5 }).decisionState
    expect(received.decisionState).toBe(expected)
  })
})
