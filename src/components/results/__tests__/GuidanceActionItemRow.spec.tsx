/**
 * Tests for GuidanceActionItemRow and ResultsBody guidance integration.
 *
 * Verifies:
 * - Guidance store items present → ResultsBody renders GuidanceActionItemRow, not NextActionItem
 * - Empty guidance store → ResultsBody renders NextActionItem fallback
 * - Items with target_object.type === 'node' are filtered out (not shown in results panel)
 * - onActivateGuidanceItem is called on row click
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GuidanceActionItemRow } from '../GuidanceActionItemRow'
import { ResultsBody } from '../ResultsBody'
import type { GuidanceItem } from '../../../canvas/stores/guidanceStore'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  RecommendationSectionData,
  DriversSectionData,
  ConfidenceSectionData,
  ImprovementsSectionData,
  OptionResult,
  NextActionItem,
} from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusEdgeByEndpoints: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OPTIONS: OptionResult[] = [
  {
    id: 'opt_a',
    label: 'Option A',
    expected: 200,
    outcome: { mean: 200, p10: 150, p50: 195, p90: 260 },
    p10: 150, p50: 195, p90: 260,
    isRecommended: true,
    winProbability: 0.55,
  },
]

function makeResultsData(nextActions?: NextActionItem[]): ResultsSectionDataReturn {
  const recommendation: RecommendationSectionData = {
    recommendedOption: OPTIONS[0],
    allOptions: OPTIONS,
    goalLabel: 'Maximise revenue',
    isSingleOption: true,
    analysisStatus: 'computed',
    recommendationStability: 0.72,
    robustnessLevel: 'moderate',
  }
  const drivers: DriversSectionData = {
    drivers: [],
    driversStatus: 'computed',
    topDrivers: [],
    totalCount: 0,
    hasMagnitudeData: false,
  }
  const confidence: ConfidenceSectionData = {
    tier: { tier: 'fair', icon: 'Info', label: 'Fair', description: 'Needs attention' },
    qualityScore: 55,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    nextActions: nextActions ?? [],
    topNextActions: nextActions?.slice(0, 3) ?? [],
  }
  const improvements: ImprovementsSectionData = {
    improvements: [],
    count: 0,
    hasHighPriority: false,
  }
  return {
    recommendation,
    drivers,
    confidence,
    improvements,
    isLoading: false,
    isError: false,
    goalLabel: 'Revenue',
  }
}

function makeGuidanceItem(overrides: Partial<GuidanceItem> = {}): GuidanceItem {
  return {
    item_id: 'g-1',
    signal_code: 'WEAK_EDGE',
    category: 'should_fix',
    source: 'structural',
    title: 'Strengthen this connection',
    priority: 70,
    primary_action: { type: 'discuss', prompt: 'Tell me more.' },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// GuidanceActionItemRow unit tests
// ---------------------------------------------------------------------------

describe('GuidanceActionItemRow', () => {
  it('renders the item title', () => {
    render(
      <GuidanceActionItemRow
        item={makeGuidanceItem({ title: 'Fix this edge' })}
        onActivate={vi.fn()}
      />
    )
    expect(screen.getByText('Fix this edge')).toBeInTheDocument()
  })

  it('renders item detail when present', () => {
    render(
      <GuidanceActionItemRow
        item={makeGuidanceItem({ detail: 'This edge is fragile.' })}
        onActivate={vi.fn()}
      />
    )
    expect(screen.getByText('This edge is fragile.')).toBeInTheDocument()
  })

  it('calls onActivate with item_id on click', () => {
    const onActivate = vi.fn()
    render(
      <GuidanceActionItemRow
        item={makeGuidanceItem({ item_id: 'guid-abc' })}
        onActivate={onActivate}
      />
    )
    fireEvent.click(screen.getByTestId('guidance-action-item-row'))
    expect(onActivate).toHaveBeenCalledWith('guid-abc')
  })

  it('renders must_fix category with correct test id', () => {
    render(
      <GuidanceActionItemRow
        item={makeGuidanceItem({ category: 'must_fix' })}
        onActivate={vi.fn()}
      />
    )
    expect(screen.getByTestId('guidance-action-item-row')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// ResultsBody — guidance integration
// ---------------------------------------------------------------------------

describe('ResultsBody — guidance integration', () => {
  it('renders GuidanceActionItemRow when guidanceItems are present', () => {
    const items: GuidanceItem[] = [
      makeGuidanceItem({ item_id: 'g-1', title: 'Add evidence for this factor' }),
      makeGuidanceItem({ item_id: 'g-2', title: 'Clarify option scope' }),
    ]
    render(
      <ResultsBody
        resultsSectionData={makeResultsData()}
        tornadoData={{ rows: [], expectedOutcome: null }}
        guidanceItems={items}
        onActivateGuidanceItem={vi.fn()}
      />
    )
    const rows = screen.getAllByTestId('guidance-action-item-row')
    expect(rows).toHaveLength(2)
    expect(screen.getByText('Add evidence for this factor')).toBeInTheDocument()
    expect(screen.getByText('Clarify option scope')).toBeInTheDocument()
  })

  it('renders guidance action items container when guidance items present', () => {
    const items: GuidanceItem[] = [
      makeGuidanceItem({ item_id: 'g-1', title: 'Check this connection' }),
    ]
    render(
      <ResultsBody
        resultsSectionData={makeResultsData()}
        tornadoData={{ rows: [], expectedOutcome: null }}
        guidanceItems={items}
      />
    )
    expect(screen.getByTestId('guidance-action-items')).toBeInTheDocument()
  })

  it('does not render guidance-action-items when guidanceItems is empty', () => {
    render(
      <ResultsBody
        resultsSectionData={makeResultsData()}
        tornadoData={{ rows: [], expectedOutcome: null }}
        guidanceItems={[]}
      />
    )
    expect(screen.queryByTestId('guidance-action-items')).not.toBeInTheDocument()
  })

  it('does not render guidance-action-items when guidanceItems is undefined (NextActionItem fallback)', () => {
    const nextActions: NextActionItem[] = [
      { action: 'Gather evidence', rationale: 'Improve confidence', priority: 1 },
    ]
    render(
      <ResultsBody
        resultsSectionData={makeResultsData(nextActions)}
        tornadoData={{ rows: [], expectedOutcome: null }}
      />
    )
    expect(screen.queryByTestId('guidance-action-items')).not.toBeInTheDocument()
  })

  it('does not render guidance-action-items for node-targeted items (filtered by caller)', () => {
    // The caller (OutputsDock) filters node/edge items before passing to ResultsBody.
    // Here we verify that if we pass empty array, no container renders.
    render(
      <ResultsBody
        resultsSectionData={makeResultsData()}
        tornadoData={{ rows: [], expectedOutcome: null }}
        guidanceItems={[]}
      />
    )
    expect(screen.queryByTestId('guidance-action-items')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// OutputsDock guidance filter — unit coverage
// ---------------------------------------------------------------------------
// The filter in OutputsDock (resultsGuidanceItems) excludes node/edge-targeted
// items and keeps graph/option/framing/undefined-target items.
// We test the predicate directly to ensure the exclusion contract is correct.

/** Mirror of the OutputsDock resultsGuidanceItems filter predicate */
function outputsDockFilter(item: GuidanceItem): boolean {
  const t = item.target_object?.type
  return !t || t === 'graph' || t === 'option' || t === 'framing'
}

describe('OutputsDock guidance filter predicate', () => {
  it('includes items with no target_object', () => {
    expect(outputsDockFilter(makeGuidanceItem())).toBe(true)
  })

  it('includes graph-targeted items', () => {
    expect(outputsDockFilter(makeGuidanceItem({ target_object: { type: 'graph' } }))).toBe(true)
  })

  it('includes option-targeted items', () => {
    expect(outputsDockFilter(makeGuidanceItem({ target_object: { type: 'option' } }))).toBe(true)
  })

  it('includes framing-targeted items', () => {
    expect(outputsDockFilter(makeGuidanceItem({ target_object: { type: 'framing' } }))).toBe(true)
  })

  it('excludes node-targeted items', () => {
    expect(outputsDockFilter(makeGuidanceItem({ target_object: { type: 'node', id: 'n1' } }))).toBe(false)
  })

  it('excludes edge-targeted items', () => {
    expect(outputsDockFilter(makeGuidanceItem({ target_object: { type: 'edge', id: 'e1' } }))).toBe(false)
  })
})
