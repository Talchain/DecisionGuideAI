/**
 * ResultsBody — the coverage disclosure renders ON THE SURFACE, and says the
 * complete case out loud.
 *
 * WHY THIS FILE EXISTS. The disclosure was reviewed with ZERO surface-level
 * assertions — 0 against same-card siblings at 5, 5, 6 and 7, with the contrast
 * controls firing. That was tolerable while it sat beside tested siblings and is
 * not tolerable across a surface move, which would ship it unpinned by
 * construction. Its honest-at-zero property was pinned only at the MODULE, so
 * the one behaviour the feature exists for was untested exactly where it renders.
 *
 * These bind to the MOUNT PATH, not to a predicate: the assertions run against
 * `ResultsBody`'s own rendered output, so if the strip stops being mounted here
 * they fail loudly rather than passing against a component nobody loads.
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

const SWITCHING = 'fac_switching'
const LICENCE = 'fac_licence'
const ADOPTION = 'fac_adoption'

const FACTOR_NODES = [
  { id: SWITCHING, type: 'factor', data: { label: 'One-Off Switching Cost' } },
  { id: LICENCE, type: 'factor', data: { label: 'CRM Annual Licence Cost' } },
  { id: ADOPTION, type: 'factor', data: { label: 'CRM Adoption and Usability' } },
]

function seed(options: Array<Record<string, unknown>>) {
  useCanvasStore.setState({
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    nodes: FACTOR_NODES,
    ceeAnalysisReady: { options },
  } as never)
}

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

const renderBody = () =>
  render(
    <ResultsBody
      resultsSectionData={makeData()}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
    />,
  )

describe('ResultsBody — coverage disclosure, mounted', () => {
  beforeEach(() => {
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
  })

  it('renders on THIS surface and names what is unset, without claiming completeness', () => {
    seed([
      { id: 'opt_a', label: 'Option A', interventions: { [SWITCHING]: 0.4 } },
      { id: 'opt_b', label: 'Option B', interventions: { [SWITCHING]: 0, [LICENCE]: 0.5 } },
    ])
    renderBody()

    const strip = screen.getByTestId('results-coverage-disclosure')
    expect(strip).toBeInTheDocument()
    expect(strip.getAttribute('data-coverage-kind')).toBe('uneven')
    expect(strip.textContent).toContain('CRM Adoption and Usability')
    // The fabrication this feature was reviewed for, pinned at the surface.
    expect(strip.textContent).not.toContain('Every option has all its effects set')
    expect(strip.textContent).not.toMatch(/complete model/i)
  })

  it('SAYS the complete case out loud rather than rendering nothing', () => {
    // Honest at zero, pinned where it renders. Without this, "no disclosure" and
    // "nothing to disclose" are indistinguishable to a user AND to this suite.
    const all = { [SWITCHING]: 0.4, [LICENCE]: 0.5, [ADOPTION]: 0.6 }
    seed([
      { id: 'opt_a', label: 'Option A', interventions: { ...all } },
      { id: 'opt_b', label: 'Option B', interventions: { ...all } },
    ])
    renderBody()

    const strip = screen.getByTestId('results-coverage-disclosure')
    expect(strip.getAttribute('data-coverage-kind')).toBe('complete')
    expect(strip.textContent).toContain('Every option has all its effects set')
    expect(screen.queryByTestId('results-coverage-unset')).toBeNull()
  })

  it('does not claim completeness when the same factor is unset on every option', () => {
    // Matching counts are not completeness. This is the state that shipped as
    // "complete" and is the reason the predicate has three values, not two.
    const both = { [SWITCHING]: 0.4, [LICENCE]: 0.5 }
    seed([
      { id: 'opt_a', label: 'Option A', interventions: { ...both } },
      { id: 'opt_b', label: 'Option B', interventions: { ...both } },
    ])
    renderBody()

    const strip = screen.getByTestId('results-coverage-disclosure')
    expect(strip.getAttribute('data-coverage-kind')).toBe('even-incomplete')
    expect(strip.textContent).not.toContain('Every option has all its effects set')
    expect(strip.textContent).toContain('CRM Adoption and Usability')
  })

  it('says NOTHING rather than something partial when an option cannot be named', () => {
    // A comparison that silently omits a participant can turn uneven into even,
    // and incomplete into complete. Honest by silence — and never the raw id.
    seed([
      { id: 'opt_a', label: 'opt_a', interventions: { [SWITCHING]: 0.4 } },
      { id: 'opt_b', label: 'Option B', interventions: { [SWITCHING]: 0, [LICENCE]: 0.5 } },
    ])
    renderBody()

    expect(screen.queryByTestId('results-coverage-disclosure')).toBeNull()
    expect(document.body.textContent).not.toContain('opt_a has')
  })
})
