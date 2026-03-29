/**
 * FactorNode render tests
 * T2: cleanFactorLabel applied to displayed label
 * T3: category label in header row
 * T4: human-readable value display
 * T5: "estimated" pill for inferred values
 * T6: Sensitivity/Evidence tier labels (results mode)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) =>
    selector({
      hoveredOptionId: null,
      nodes: [],
      edges: [],
      ceeAnalysisReady: null,
      results: { status: 'idle', report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      goalThreshold: null,
      goalConstraints: [],
      viewMode: 'expert',
    })
  ),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: false,
  })),
}))

vi.mock('../../../hooks/useCEEInsights', () => ({
  useCEEInsights: vi.fn(() => ({ data: null })),
}))

vi.mock('../../../hooks/useISLValidation', () => ({
  useISLValidation: vi.fn(() => ({ data: null })),
}))

// Default: graph badges OFF, lens OFF. Individual tests override as needed.
vi.mock('../../../flags', () => ({
  isGraphBadgesEnabled: vi.fn(() => false),
  isNodeIntelligenceEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isContextMenuEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import { isGraphBadgesEnabled } from '../../../flags'

const baseProps = {
  id: 'factor-1',
  type: 'factor',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

const renderFactor = (data: Record<string, unknown>) =>
  render(
    <ReactFlowProvider>
      <FactorNode {...baseProps} data={data} />
    </ReactFlowProvider>
  )

describe('FactorNode', () => {
  beforeEach(() => vi.clearAllMocks())

  // T1: No all-caps text
  it('renders label without all-caps', () => {
    renderFactor({ label: 'Hiring rate', type: 'factor' })
    const label = screen.getByText('Hiring rate')
    // CSS uppercase is not checked here — this is a render test
    expect(label).toBeDefined()
    // The type label from registry should be sentence-case (not all-caps)
    expect(screen.getByText('Factor')).toBeDefined()
  })

  // T2: Strip normalisation metadata
  it('strips "(0–1 scale)" from label', () => {
    renderFactor({ label: 'Hiring rate (0–1 scale)', type: 'factor' })
    expect(screen.getByText('Hiring rate')).toBeDefined()
    expect(screen.queryByText(/0–1 scale/)).toBeNull()
  })

  it('strips "(0/1)" from label', () => {
    renderFactor({ label: 'Hired (0/1)', type: 'factor' })
    expect(screen.getByText('Hired')).toBeDefined()
  })

  // F2: Category icon (tooltip via title attribute)
  it('renders controllable icon with correct tooltip', () => {
    const { container } = renderFactor({ label: 'Budget', type: 'factor', category: 'controllable' })
    const icon = container.querySelector('[title="You control this factor"]')
    expect(icon).not.toBeNull()
  })

  it('renders observable icon with correct tooltip', () => {
    const { container } = renderFactor({ label: 'Revenue', type: 'factor', category: 'observable' })
    const icon = container.querySelector('[title="You can measure this"]')
    expect(icon).not.toBeNull()
  })

  it('renders external icon with correct tooltip', () => {
    const { container } = renderFactor({ label: 'Market rate', type: 'factor', category: 'external' })
    const icon = container.querySelector('[title="Outside your control"]')
    expect(icon).not.toBeNull()
  })

  it('omits category icon when category is absent', () => {
    const { container } = renderFactor({ label: 'Unknown', type: 'factor' })
    expect(container.querySelector('[title="You control this factor"]')).toBeNull()
    expect(container.querySelector('[title="You can measure this"]')).toBeNull()
    expect(container.querySelector('[title="Outside your control"]')).toBeNull()
  })

  // T4: Human-readable value
  it('shows raw_value with unit', () => {
    renderFactor({
      label: 'Revenue',
      type: 'factor',
      observedState: { raw_value: '120', unit: 'k', value: 0.6 },
    })
    expect(screen.getByText('120 k')).toBeDefined()
  })

  // J2: Currency raw_value prefix — £49 not 49 £
  it('renders currency raw_value as prefix (£49), not suffix', () => {
    renderFactor({
      label: 'Revenue',
      type: 'factor',
      observedState: { raw_value: '49', unit: '£', value: 0.49 },
    })
    expect(screen.getByText('£49')).toBeDefined()
    expect(screen.queryByText('49 £')).toBeNull()
  })

  it('renders dollar currency raw_value as prefix ($500)', () => {
    renderFactor({
      label: 'Cost',
      type: 'factor',
      observedState: { raw_value: '500', unit: '$' },
    })
    expect(screen.getByText('$500')).toBeDefined()
  })

  // J2 + Item 5: Numeric currency raw_value gets thousands separators
  it('applies thousands separator to numeric currency raw_value (£1,200)', () => {
    renderFactor({
      label: 'Revenue',
      type: 'factor',
      observedState: { raw_value: '1200', unit: '£' },
    })
    expect(screen.getByText('£1,200')).toBeDefined()
    expect(screen.queryByText('£1200')).toBeNull()
  })

  it('renders non-numeric currency raw_value as plain prefix (£approx 50)', () => {
    renderFactor({
      label: 'Cost',
      type: 'factor',
      observedState: { raw_value: 'approx 50', unit: '£' },
    })
    expect(screen.getByText('£approx 50')).toBeDefined()
  })

  it('shows raw_value alone when no unit', () => {
    renderFactor({
      label: 'Score',
      type: 'factor',
      observedState: { raw_value: '85', value: 0.85 },
    })
    expect(screen.getByText('85')).toBeDefined()
  })

  it('falls back to Not active for binary 0 without raw_value (qualitative factor — no unit, no cap)', () => {
    renderFactor({
      label: 'Hired',
      type: 'factor',
      observedState: { value: 0 },
    })
    expect(screen.getByText('Not active')).toBeDefined()
  })

  // Task 4: factor_type descriptor must never appear as a display unit
  it('does not show "binary" as unit when unit field contains "binary"', () => {
    renderFactor({
      label: 'Hire decision',
      type: 'factor',
      observedState: { value: 0, unit: 'binary' },
    })
    // Should show qualitative tier (no unit), not "0 binary"
    expect(screen.queryByText(/binary/)).toBeNull()
    expect(screen.getByText('Not active')).toBeDefined()
  })

  it('does not show "normalized" as unit when unit field contains "normalized"', () => {
    renderFactor({
      label: 'Fit score',
      type: 'factor',
      observedState: { value: 0.3, unit: 'normalized' },
    })
    // Should show qualitative tier (no unit), not "0.3 normalized"
    expect(screen.queryByText(/normalized/)).toBeNull()
    expect(screen.getByText('Low')).toBeDefined()
  })

  // P1.5: value===0 with a unit must NOT show 'Not active' — it means 0% or 0 units
  it('shows "0%" for value===0 when unit is "%"', () => {
    renderFactor({
      label: 'Churn rate',
      type: 'factor',
      observedState: { value: 0, unit: '%' },
    })
    expect(screen.getByText('0%')).toBeDefined()
    expect(screen.queryByText('Not active')).toBeNull()
  })

  // P1.5: qualitative factor_type + no unit — still shows 'Not active'
  it('shows "Not active" for value===0 with qualitative factor_type and no unit', () => {
    renderFactor({
      label: 'Product fit',
      type: 'factor',
      observedState: { value: 0, factor_type: 'quality' },
    })
    expect(screen.getByText('Not active')).toBeDefined()
  })

  it('falls back to Very high for binary 1 without raw_value', () => {
    renderFactor({
      label: 'Hired',
      type: 'factor',
      observedState: { value: 1 },
    })
    expect(screen.getByText('Very high')).toBeDefined()
  })

  // T4: External factor with no observedState shows "Outside your control."
  it('shows "Outside your control." for external factor with no observedState', () => {
    renderFactor({ label: 'Market', type: 'factor', category: 'external' })
    expect(screen.getByText('Outside your control.')).toBeDefined()
  })

  it('shows "Missing value" for factor with observedState but no value', () => {
    renderFactor({
      label: 'Metric',
      type: 'factor',
      observedState: { unit: 'k' },
    })
    expect(screen.getByText('Missing value. Weakens analysis.')).toBeDefined()
  })

  // T5: "estimated" provenance display for inferred extraction type
  // Provenance is now icon-only with title attribute, not visible text
  it('shows "Estimated by Olumi" icon for inferred extraction type', () => {
    renderFactor({
      label: 'Salary',
      type: 'factor',
      observedState: { value: 0.5, extractionType: 'inferred' },
    })
    expect(screen.getByTitle('Estimated by Olumi')).toBeDefined()
  })

  it('does not show "Estimated by Olumi" icon for explicit extraction type', () => {
    renderFactor({
      label: 'Salary',
      type: 'factor',
      observedState: { value: 0.5, extractionType: 'explicit' },
    })
    expect(screen.queryByText(/Olumi estimated/)).toBeNull()
    expect(screen.queryByTitle('Estimated by Olumi')).toBeNull()
  })

  // Provenance combinations — brief acceptance criteria
  // Combination 1: extractionType='inferred' + source='brief_extraction'
  //   → source icon "From your brief" shows; "estimated" icon suppressed
  it('shows provenance icon (not estimated) when extractionType=inferred and source=brief_extraction', () => {
    renderFactor({
      label: 'Salary',
      type: 'factor',
      observedState: { value: 0.5, extractionType: 'inferred', source: 'brief_extraction' },
    })
    // Provenance is shown as icon with title attribute
    expect(screen.getByTitle('From your brief')).toBeDefined()
    expect(screen.queryByTitle('Estimated by Olumi')).toBeNull()
  })

  // Combination 2: extractionType='inferred' + no source → "Estimated by Olumi" icon shows
  it('shows "Estimated by Olumi" icon when extractionType=inferred and no source', () => {
    renderFactor({
      label: 'Salary',
      type: 'factor',
      observedState: { value: 0.5, extractionType: 'inferred' },
    })
    expect(screen.getByTitle('Estimated by Olumi')).toBeDefined()
    expect(screen.queryByTitle('From your brief')).toBeNull()
  })

  // Combination 3: source='cee_inference' → "Estimated by Olumi" icon shows; "estimated" pill suppressed
  it('shows "Estimated by Olumi" icon (not estimated text) when source=cee_inference', () => {
    renderFactor({
      label: 'Salary',
      type: 'factor',
      observedState: { value: 0.5, extractionType: 'inferred', source: 'cee_inference' },
    })
    expect(screen.getByTitle('Estimated by Olumi')).toBeDefined()
  })

  // T6: Influence/Confidence tiers (results mode)
  it('shows Influence and Confidence tiers in results mode', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
      selector({
        hoveredOptionId: null,
        nodes: [],
        edges: [],
        ceeAnalysisReady: null,
        results: { status: 'complete', report: null },
        highlightedNodes: new Set(),
        dimmedNodeIds: new Set(),
        goalThreshold: null,
        goalConstraints: [],
        viewMode: 'expert',
      })
    )
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: 0.8,
      confidence: 0.45,
      inSensitivityAnalysis: true,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
    })
    renderFactor({ label: 'Salary', type: 'factor', observedState: { value: 0.5 } })
    expect(screen.getByText('Influence')).toBeDefined()
    expect(screen.getByText('80%')).toBeDefined()
    expect(screen.getByText('Confidence')).toBeDefined()
    expect(screen.getByText('45%')).toBeDefined()
  })

  it('hides Influence/Confidence bars outside results mode', () => {
    renderFactor({ label: 'Salary', type: 'factor' })
    expect(screen.queryByText('Influence')).toBeNull()
    expect(screen.queryByText('Confidence')).toBeNull()
  })

  it('has displayName set', () => {
    expect(FactorNode.displayName).toBe('FactorNode')
  })

  // Null-safe paths — most likely regression sources in production
  it('renders "Untitled" when data.label is absent', () => {
    renderFactor({})
    expect(screen.getByText('Untitled')).toBeDefined()
  })

  it('renders "Untitled" when data.label is empty string', () => {
    renderFactor({ label: '' })
    expect(screen.getByText('Untitled')).toBeDefined()
  })

  it('does not crash when observedState is null', () => {
    expect(() => renderFactor({ label: 'X', type: 'factor', observedState: null })).not.toThrow()
  })

  it('does not crash when observedState is undefined', () => {
    expect(() => renderFactor({ label: 'X', type: 'factor' })).not.toThrow()
  })

  it('shows "Missing value" when observedState has only unit (no value)', () => {
    renderFactor({ label: 'X', type: 'factor', observedState: { unit: 'k' } })
    expect(screen.getByText('Missing value. Weakens analysis.')).toBeDefined()
  })

  it('does not show Influence/Confidence bars in results mode when both influence and confidence are null', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
    })
    renderFactor({ label: 'X', type: 'factor' })
    expect(screen.queryByText('Influence')).toBeNull()
    expect(screen.queryByText('Confidence')).toBeNull()
  })

  it('does not show Influence bar when influence is exactly 0', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: 0,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
    })
    renderFactor({ label: 'X', type: 'factor' })
    expect(screen.queryByText('Influence')).toBeNull()
  })

  it('omits category label when category is an unrecognised string', () => {
    renderFactor({ label: 'X', type: 'factor', category: 'unknown_category' })
    expect(screen.queryByText('Controllable')).toBeNull()
    expect(screen.queryByText('Measurable')).toBeNull()
  })

  // P3: Rank badge in header row — DOM order and category icon co-existence
  it('rank badge renders inline in header row: shape → badge → label, with category icon right-aligned (P3)', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: 1,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: false,
    })
    const { container } = renderFactor({
      label: 'Revenue',
      type: 'factor',
      category: 'controllable',
    })
    // Badge renders with expected text
    const badge = screen.getByText('#1')
    expect(badge).toBeDefined()
    // Badge uses absolute positioning (top-right corner of node)
    expect(badge.className).toContain('absolute')
    expect(badge.className).toContain('-top-2')
    expect(badge.className).toContain('-right-2')
    // Category icon still present
    const icon = container.querySelector('[title="You control this factor"]')
    expect(icon).not.toBeNull()
  })

  // P2: Qualitative value display — no raw_value, no unit → tier label
  it('shows tier label (Medium) for factor with no raw_value and no unit (P2)', () => {
    renderFactor({
      label: 'Product-market fit',
      type: 'factor',
      observedState: { value: 0.5 },
    })
    expect(screen.getByText('Medium')).toBeDefined()
    // Must not show raw float
    expect(screen.queryByText('0.5')).toBeNull()
  })

  it('shows raw value unchanged when unit is present (P2 — no regression)', () => {
    renderFactor({
      label: 'Engineering capacity',
      type: 'factor',
      observedState: { raw_value: '10', unit: 'engineers', value: 0.5 },
    })
    expect(screen.getByText('10 engineers')).toBeDefined()
    expect(screen.queryByText('Medium')).toBeNull()
  })

  // P4: Evidence bar uses bg-info (not bg-factor)
  it('evidence bar uses bg-info class (P4)', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
      selector({
        hoveredOptionId: null,
        nodes: [],
        edges: [],
        ceeAnalysisReady: null,
        results: { status: 'complete', report: null },
        highlightedNodes: new Set(),
        dimmedNodeIds: new Set(),
        goalThreshold: null,
        goalConstraints: [],
        viewMode: 'expert',
      })
    )
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: 0.8,
      confidence: 0.6,
      inSensitivityAnalysis: true,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
    })
    const { container } = renderFactor({ label: 'Revenue', type: 'factor', observedState: { value: 0.5 } })
    const bars = container.querySelectorAll('.bg-info')
    // Both sensitivity and evidence bars should be bg-info
    expect(bars.length).toBeGreaterThanOrEqual(2)
    expect(container.querySelector('.bg-factor')).toBeNull()
  })

  // P5: Inferred factor shows "Estimated by Olumi" icon with confirm action
  it('inferred factor shows "Estimated by Olumi" icon and confirm action icon (P5)', () => {
    renderFactor({
      label: 'Salary',
      type: 'factor',
      observedState: { value: 0.5, extractionType: 'inferred' },
    })
    expect(screen.getByTitle('Estimated by Olumi')).toBeDefined()
    // "Confirm or edit" link replaced by ActionIcons confirm button
    expect(screen.getByTitle('Confirm value')).toBeDefined()
  })

  // V1: Incomplete factor (no value) must use factor stone border, not goal yellow
  it('uses border-factor (not border-goal) for external factor with no observed value', () => {
    const { container } = renderFactor({
      label: 'Market rate',
      type: 'factor',
      category: 'external',
      // No observedState.value — triggers isIncomplete in BaseNode
    })
    const nodeEl = container.querySelector('[role="group"]')
    expect(nodeEl?.className).not.toContain('border-goal')
    // Phase 2: incomplete nodes now use border-warning (amber) instead of entity colour
    expect(nodeEl?.className).toContain('border-warning')
  })

  it('uses border-warning for any factor with no observed value (controllable)', () => {
    const { container } = renderFactor({
      label: 'Hiring rate',
      type: 'factor',
      category: 'controllable',
      // No observedState.value
    })
    const nodeEl = container.querySelector('[role="group"]')
    expect(nodeEl?.className).not.toContain('border-goal')
    expect(nodeEl?.className).toContain('border-warning')
  })

  // P0 (feedback): binary factor_type + value=0 must show "Not active", not "Very low"
  it('shows "Not active" for value===0 with factor_type "binary" and no unit', () => {
    renderFactor({
      label: 'Hire decision',
      type: 'factor',
      observedState: { value: 0, factor_type: 'binary' },
    })
    expect(screen.getByText('Not active')).toBeDefined()
    expect(screen.queryByText('Very low')).toBeNull()
  })

  it('shows "Very high" for value===1 with factor_type "binary" and no unit', () => {
    renderFactor({
      label: 'Hire decision',
      type: 'factor',
      observedState: { value: 1, factor_type: 'binary' },
    })
    expect(screen.getByText('Very high')).toBeDefined()
  })

  // P1.3 (feedback): compact DataBar progressbar elements must be present in results mode
  it('renders progressbar elements for Influence and Confidence bars in results mode', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
      selector({
        hoveredOptionId: null,
        nodes: [],
        edges: [],
        ceeAnalysisReady: null,
        results: { status: 'complete', report: null },
        highlightedNodes: new Set(),
        dimmedNodeIds: new Set(),
        goalThreshold: null,
        goalConstraints: [],
        viewMode: 'expert',
      })
    )
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: 0.8,
      confidence: 0.6,
      inSensitivityAnalysis: true,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
    })
    const { container } = renderFactor({ label: 'Revenue', type: 'factor', observedState: { value: 0.5 } })
    const progressbars = container.querySelectorAll('[role="progressbar"]')
    // Two bars: Influence + Confidence
    expect(progressbars.length).toBeGreaterThanOrEqual(2)
    // Each bar has a valid aria-valuenow between 0 and 100
    progressbars.forEach(bar => {
      const valuenow = Number(bar.getAttribute('aria-valuenow'))
      expect(valuenow).toBeGreaterThanOrEqual(0)
      expect(valuenow).toBeLessThanOrEqual(100)
    })
  })

  it('renders no progressbar elements outside results mode', () => {
    const { container } = renderFactor({ label: 'Revenue', type: 'factor' })
    expect(container.querySelectorAll('[role="progressbar"]').length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// QA Brief: A-series — factor node display scenarios
// ---------------------------------------------------------------------------
describe('FactorNode — QA Brief A-series', () => {
  beforeEach(() => vi.clearAllMocks())

  // A1: raw_value=49, unit="£"  → "£49"
  it('A1: raw_value=49 with unit="£" renders "£49"', () => {
    renderFactor({ label: 'Price', type: 'factor', observedState: { raw_value: 49, unit: '£', value: 0.49 } })
    expect(screen.getByText('£49')).toBeDefined()
  })

  // A2: raw_value=20, unit="engineers" → "20 engineers"
  it('A2: raw_value=20 with unit="engineers" renders "20 engineers"', () => {
    renderFactor({ label: 'Team size', type: 'factor', observedState: { raw_value: 20, unit: 'engineers' } })
    expect(screen.getByText('20 engineers')).toBeDefined()
  })

  // A3: raw_value=4.5, unit="months" → "4.5 months"
  it('A3: raw_value=4.5 with unit="months" renders "4.5 months"', () => {
    renderFactor({ label: 'Duration', type: 'factor', observedState: { raw_value: '4.5', unit: 'months' } })
    expect(screen.getByText('4.5 months')).toBeDefined()
  })

  // A4: value=0.5, no raw_value, cap=100, unit="£" → "£50" (denormalised)
  it('A4: value=0.5 with cap=100 and unit="£" renders "£50"', () => {
    renderFactor({ label: 'Price', type: 'factor', observedState: { value: 0.5, cap: 100, unit: '£' } })
    expect(screen.getByText('£50')).toBeDefined()
  })

  // A5: value=1.0, no raw_value, no cap, no unit → "Very high"
  it('A5: value=1.0 with no raw_value, cap, or unit renders "Very high"', () => {
    renderFactor({ label: 'Quality', type: 'factor', observedState: { value: 1.0 } })
    expect(screen.getByText('Very high')).toBeDefined()
  })

  // A6: value=0, factor_type="binary", no unit → "Not active"
  it('A6: binary factor value=0 without unit renders "Not active"', () => {
    renderFactor({ label: 'Hired', type: 'factor', observedState: { value: 0, factor_type: 'binary' } })
    expect(screen.getByText('Not active')).toBeDefined()
  })

  // A7: value=0, unit="%", raw_value=0 → "0%" (not "Not active")
  it('A7: value=0 with unit="%" renders "0%" not "Not active"', () => {
    renderFactor({ label: 'Churn', type: 'factor', observedState: { value: 0, unit: '%', raw_value: 0 } })
    expect(screen.getByText('0%')).toBeDefined()
    expect(screen.queryByText('Not active')).toBeNull()
  })

  // A8: factor_type="normalized", no unit → no "normalized" suffix
  it('A8: factor_type="normalized" with no unit shows value without type suffix', () => {
    renderFactor({ label: 'Score', type: 'factor', observedState: { value: 0.3, factor_type: 'normalized' } })
    // "normalized" must not appear in rendered output
    expect(screen.queryByText(/normalized/i)).toBeNull()
    // Should show qualitative tier (no unit, normalised treated as no-unit qualitative)
    expect(screen.getByText('Low')).toBeDefined()
  })

  // A9: factor_type="binary", no unit → no "binary" suffix in value display
  it('A9: factor_type="binary" with no unit shows value without type suffix', () => {
    renderFactor({ label: 'Decision', type: 'factor', observedState: { value: 0.5, factor_type: 'binary' } })
    expect(screen.queryByText(/binary/i)).toBeNull()
  })

  // A10: unit="CHF", raw_value=500 → "CHF500" (multi-char currency prefix, no space)
  it('A10: unit="CHF" with raw_value=500 renders "CHF500"', () => {
    renderFactor({ label: 'Cost', type: 'factor', observedState: { raw_value: '500', unit: 'CHF' } })
    expect(screen.getByText('CHF500')).toBeDefined()
  })

  // A14: source='cee_inference' → provenance icon "Estimated by Olumi"
  it('A14: source="cee_inference" renders provenance icon "Estimated by Olumi"', () => {
    renderFactor({
      label: 'Market rate',
      type: 'factor',
      observedState: { value: 0.5, source: 'cee_inference' },
    })
    // Provenance rendered as icon with title attribute
    expect(screen.getByTitle('Estimated by Olumi')).toBeDefined()
  })

  // A15: source='brief_extraction' → provenance icon "From your brief"
  it('A15: source="brief_extraction" renders provenance icon', () => {
    renderFactor({
      label: 'Revenue',
      type: 'factor',
      observedState: { value: 0.6, source: 'brief_extraction' },
    })
    // Provenance rendered as icon with title attribute
    expect(screen.getByTitle('From your brief')).toBeDefined()
  })

  // A16: source='user' → no provenance icon
  it('A16: source="user" renders no provenance icon', () => {
    renderFactor({
      label: 'Budget',
      type: 'factor',
      observedState: { value: 0.7, source: 'user' },
    })
    expect(screen.queryByTitle('Generated from your brief')).toBeNull()
    expect(screen.queryByTitle('Estimated by Olumi')).toBeNull()
    expect(screen.queryByText('Set by you')).toBeNull()
  })

  // A17: "Not active" value + provenance icon rendered separately (not merged as phrase)
  it('A17: "Not active" value and provenance icon are separate elements', () => {
    renderFactor({
      label: 'Item',
      type: 'factor',
      observedState: { value: 0, source: 'cee_inference' },
    })
    // Value text exists
    expect(screen.getByText('Not active')).toBeDefined()
    // Provenance rendered as icon with title attribute (not visible text)
    expect(screen.getByTitle('Estimated by Olumi')).toBeDefined()
    // Should not appear as a joined phrase in any text content
    expect(screen.queryByText(/Not active.*estimated/i)).toBeNull()
  })

  // A17b: "Not active" + estimated icon — inferred source (extractionType='inferred')
  // Shows "Estimated by Olumi" icon inline (source='inferred' is suppressed for provenance,
  // but extractionType='inferred' triggers the OlumiSparkle icon).
  it('A17b: value=0 + extractionType=inferred shows "Not active" and "Estimated by Olumi" icon, plus confirm action', () => {
    renderFactor({
      label: 'Item',
      type: 'factor',
      observedState: { value: 0, source: 'inferred', extractionType: 'inferred' },
    })
    // "Not active" (value display) must appear
    expect(screen.getByText('Not active')).toBeDefined()
    // Provenance rendered as icon with title attribute
    expect(screen.getByTitle('Estimated by Olumi')).toBeDefined()
    // "Confirm or edit" link replaced by ActionIcons confirm button
    expect(screen.getByTitle('Confirm value')).toBeDefined()
  })

  // A18: Tier label thresholds — verify exact boundaries (0-0.2, 0.2-0.4, 0.4-0.6, 0.6-0.8, 0.8-1.0)
  it('A18: value=0.2 → "Very low" (upper boundary of very low band)', () => {
    renderFactor({ label: 'Q', type: 'factor', observedState: { value: 0.2 } })
    expect(screen.getByText('Very low')).toBeDefined()
  })
  it('A18: value=0.21 → "Low"', () => {
    renderFactor({ label: 'Q', type: 'factor', observedState: { value: 0.21 } })
    expect(screen.getByText('Low')).toBeDefined()
  })
  it('A18: value=0.4 → "Low" (upper boundary of low band)', () => {
    renderFactor({ label: 'Q', type: 'factor', observedState: { value: 0.4 } })
    expect(screen.getByText('Low')).toBeDefined()
  })
  it('A18: value=0.41 → "Medium"', () => {
    renderFactor({ label: 'Q', type: 'factor', observedState: { value: 0.41 } })
    expect(screen.getByText('Medium')).toBeDefined()
  })
  it('A18: value=0.8 → "High" (upper boundary of high band)', () => {
    renderFactor({ label: 'Q', type: 'factor', observedState: { value: 0.8 } })
    expect(screen.getByText('High')).toBeDefined()
  })
  it('A18: value=0.81 → "Very high"', () => {
    renderFactor({ label: 'Q', type: 'factor', observedState: { value: 0.81 } })
    expect(screen.getByText('Very high')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Evidence gap badge (Phase 3A)
// ---------------------------------------------------------------------------

describe('FactorNode — evidence gap badge', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows badge when observedState is undefined and flag is ON', () => {
    vi.mocked(isGraphBadgesEnabled).mockReturnValue(true)
    const { container } = renderFactor({ label: 'Revenue', type: 'factor' })
    expect(container.querySelector('[data-testid="evidence-gap-badge"]')).not.toBeNull()
  })

  it('shows badge when observedState has only unit (no value) and flag is ON', () => {
    vi.mocked(isGraphBadgesEnabled).mockReturnValue(true)
    const { container } = renderFactor({
      label: 'Revenue',
      type: 'factor',
      observedState: { unit: 'k' },
    })
    expect(container.querySelector('[data-testid="evidence-gap-badge"]')).not.toBeNull()
  })

  it('does NOT show badge when observedState.value === 0 (valid binary data)', () => {
    vi.mocked(isGraphBadgesEnabled).mockReturnValue(true)
    const { container } = renderFactor({
      label: 'Hired',
      type: 'factor',
      observedState: { value: 0 },
    })
    expect(container.querySelector('[data-testid="evidence-gap-badge"]')).toBeNull()
  })

  it('does NOT show badge when observedState.value is set', () => {
    vi.mocked(isGraphBadgesEnabled).mockReturnValue(true)
    const { container } = renderFactor({
      label: 'Revenue',
      type: 'factor',
      observedState: { value: 0.8 },
    })
    expect(container.querySelector('[data-testid="evidence-gap-badge"]')).toBeNull()
  })

  it('does NOT show badge when flag is OFF (even with no observed data)', () => {
    // Default: isGraphBadgesEnabled returns false
    const { container } = renderFactor({ label: 'Revenue', type: 'factor' })
    expect(container.querySelector('[data-testid="evidence-gap-badge"]')).toBeNull()
  })

  it('does NOT show badge for external factor with prior range set', () => {
    vi.mocked(isGraphBadgesEnabled).mockReturnValue(true)
    const { container } = renderFactor({
      label: 'Market rate',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.2, range_max: 0.8 },
      // No observedState
    })
    expect(container.querySelector('[data-testid="evidence-gap-badge"]')).toBeNull()
  })

  it('shows badge for external factor WITHOUT prior when flag ON', () => {
    vi.mocked(isGraphBadgesEnabled).mockReturnValue(true)
    const { container } = renderFactor({
      label: 'Market rate',
      type: 'factor',
      category: 'external',
      // No prior, no observedState
    })
    expect(container.querySelector('[data-testid="evidence-gap-badge"]')).not.toBeNull()
  })
})
