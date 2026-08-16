/**
 * ResultsBody — the V7 assessment scaffold is ABSENT from the Analysis tab.
 *
 * The Analysis tab (`results`) once rendered the whole analysis TWICE:
 * `V7TopMatter` (the V6-RESPEC-2026-07-23 §1 "Option A — additive, never
 * replace" assessment scaffold) ABOVE a divider literally labelled "Current
 * view", then the live answer-first surfaces below. Paul's 12 Aug 2026 ruling
 * MOVED it — unchanged — to a temporary "Alt view" dock tab so the two
 * renderings stayed comparable ("move, NOT delete"). The adjudication is now
 * settled in favour of the consolidated analysis cockpit, and the whole V7
 * group, its tab and its host are DELETED.
 *
 * These pins survive the deletion because they are the absence half, and they
 * still bite against a re-introduction:
 *   (a) the V7 top matter (and its host group) is ABSENT from the Analysis
 *       tab's render;
 *   (b) the "Current view" divider is ABSENT (only meaningful while the two
 *       views coexisted on one tab).
 *
 * RED-first at pristine 611d91c0: (a) and (b) failed because the scaffold still
 * mounted on the Analysis tab.
 *
 * A regression that re-mounts a second analysis rendering on the Analysis tab
 * turns (a) RED. Bound to testids (identity), not to copy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

describe('ResultsBody — the V7 scaffold is absent from the Analysis tab', () => {
  beforeEach(() => {
    useCanvasStore.setState({ analysisFreshness: null, analysisFreshnessDirty: false })
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
  })

  it('(a) V7-on-results is GONE: no v7-top-matter, no v7-top-group', () => {
    // Was a two-posture loop over the analysis-hero flag; the fork is closed,
    // so the body runs once against the one surface that mounts.
    // POSITIVE CONTROL first: this render genuinely paints the post-run panel
    // (the live surfaces are on screen), so the absences below are absences
    // from a real render, not from an empty one.
    const { container, unmount } = renderBody()
    expect(
      screen.getByTestId('outputs-results-redesign'),
      'positive control: the panel rendered',
    ).toBeInTheDocument()
    expect(container.textContent ?? '', 'positive control: real content painted').toMatch(/Option A/)

    expect(
      screen.queryByTestId('v7-top-matter'),
      'a second analysis rendering re-mounted on the Analysis tab',
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('v7-top-group'),
      'the v7-top-group slot must not survive on the Analysis tab',
    ).not.toBeInTheDocument()
    unmount()
  })

  it('(b) the "Current view" divider is GONE from the Analysis tab', () => {
    const { container } = renderBody()
    expect(screen.getByTestId('outputs-results-redesign')).toBeInTheDocument()
    expect(screen.queryByTestId('assessment-current-view-divider')).not.toBeInTheDocument()
    // The literal label too — a re-introduced divider under a new testid would
    // still say "Current view" to a user.
    expect(container.textContent ?? '').not.toMatch(/Current view/)
  })

  // ⚠ CASE (c) IS DELETED, AND ITS DELETION IS THE POINT. It asserted that the
  // temporary 'altview' comparison tab WAS registered in the dock tab set. The
  // V7 adjudication is settled in favour of the consolidated analysis cockpit,
  // so that tab is RETIRED and the assertion is now false. It is not inverted
  // here: the retired tab's absence — including the sessionStorage rehydration
  // path, which case (c) never covered — is pinned by its owner,
  // `canvas/components/__tests__/OutputsDock.dom.spec.tsx`. Restating it here
  // from a second file is the hand-maintained mirror (trap 12).
  //
  // (a) and (b) above are UNCHANGED and still bite: they are absence pins about
  // ResultsBody, and they RED if the assessment scaffold is ever re-mounted on
  // the Analysis tab.
})
