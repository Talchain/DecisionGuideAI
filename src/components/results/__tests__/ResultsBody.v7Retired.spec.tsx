/**
 * ResultsBody — the V7 assessment scaffold is RETIRED FROM THE ANALYSIS TAB
 * (Paul, 12 Aug 2026: move the duplicated analysis surfaces to a temporary
 * comparison tab — move, NOT delete).
 *
 * The Analysis tab (`results`) rendered the whole analysis TWICE: `V7TopMatter`
 * (the V6-RESPEC-2026-07-23 §1 "Option A — additive, never replace" assessment
 * scaffold) ABOVE a divider literally labelled "Current view", then the live
 * answer-first surfaces below. The scaffold never retired. It has now MOVED —
 * unchanged — to the temporary "Alt view" dock tab (`V7ComparisonTabBody`),
 * so the two renderings stay comparable without the duplication polluting the
 * working tab.
 *
 * These pins are the ANALYSIS-TAB half of the move (the new home's half lives
 * in `v7/__tests__/V7ComparisonTabBody.spec.tsx`):
 *   (a) the V7 top matter (and its host group) is ABSENT from the Analysis
 *       tab's render;
 *   (b) the "Current view" divider is ABSENT (only meaningful while the two
 *       views coexisted on one tab);
 *   (c) the temporary comparison tab is REGISTERED in the dock tab set,
 *       unconditionally (no flag — no-dark-launch doctrine).
 *
 * RED-first at pristine 611d91c0: (a) and (b) fail because the scaffold still
 * mounts on the Analysis tab; (c) fails because no 'altview' tab exists.
 *
 * A regression that re-mounts V7 on the Analysis tab turns (a) RED — this is
 * the named test the brief requires. Bound to testids (identity), not to copy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResultsBody } from '../ResultsBody'
import { getOutputTabsForParity } from '../../../canvas/components/OutputsDock'
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

/**
 * Post-run fixture — analysis data PRESENT, so at pristine the V7 group's own
 * analysis-presence gate is satisfied and the group genuinely renders. An
 * absence asserted against a fixture the group would not render on anyway
 * would pass vacuously (trap 13: prove the probe can see a presence — the
 * pristine RED run is that proof, and the positive control below keeps it).
 */
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
    />,
  )
}

describe('ResultsBody — V7 scaffold retired from the Analysis tab (moved to the Alt view tab)', () => {
  beforeEach(() => {
    useCanvasStore.setState({ analysisFreshness: null, analysisFreshnessDirty: false })
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
    vi.mocked(isAnalysisHeroPanelEnabled).mockReturnValue(true)
  })

  it('(a) V7-on-results is GONE: no v7-top-matter, no v7-top-group, on either hero-flag posture', () => {
    // POSITIVE CONTROL first: this render genuinely paints the post-run panel
    // (the live surfaces are on screen), so the absences below are absences
    // from a real render, not from an empty one.
    for (const posture of [true, false]) {
      vi.mocked(isAnalysisHeroPanelEnabled).mockReturnValue(posture)
      const { container, unmount } = renderBody()
      expect(
        screen.getByTestId('outputs-results-redesign'),
        `positive control (analysisHeroPanel=${posture}): the panel rendered`,
      ).toBeInTheDocument()
      expect(container.textContent ?? '', 'positive control: real content painted').toMatch(/Option A/)

      expect(
        screen.queryByTestId('v7-top-matter'),
        `analysisHeroPanel=${posture}: V7 top matter re-mounted on the Analysis tab — it lives on the Alt view tab now`,
      ).not.toBeInTheDocument()
      expect(
        screen.queryByTestId('v7-top-group'),
        `analysisHeroPanel=${posture}: the v7-top-group slot must not survive on the Analysis tab`,
      ).not.toBeInTheDocument()
      unmount()
    }
  })

  it('(b) the "Current view" divider is GONE from the Analysis tab', () => {
    const { container } = renderBody()
    expect(screen.getByTestId('outputs-results-redesign')).toBeInTheDocument()
    expect(screen.queryByTestId('assessment-current-view-divider')).not.toBeInTheDocument()
    // The literal label too — a re-introduced divider under a new testid would
    // still say "Current view" to a user.
    expect(container.textContent ?? '').not.toMatch(/Current view/)
  })

  it('(c) the temporary comparison tab is registered, unflagged, beside Analysis', () => {
    const tabs = getOutputTabsForParity()
    const ids = tabs.map(t => t.id)
    expect(ids).toContain('altview')
    const alt = tabs.find(t => t.id === 'altview')
    expect(alt?.label).toBe('Alt view')
    // Adjacency: directly after 'results' so the two renderings under
    // comparison sit side by side in the strip.
    expect(ids[ids.indexOf('results') + 1]).toBe('altview')
  })
})
