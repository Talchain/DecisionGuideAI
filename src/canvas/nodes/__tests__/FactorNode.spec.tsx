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

  it('falls back to Not used for binary 0 without raw_value (qualitative factor — no unit, no cap)', () => {
    renderFactor({
      label: 'Hired',
      type: 'factor',
      observedState: { value: 0 },
    })
    expect(screen.getByText('Not used')).toBeDefined()
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
    expect(screen.getByText('Not used')).toBeDefined()
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

  // P1.5: value===0 with a unit must NOT show 'Not used' — it means 0% or 0 units
  it('shows "0%" for value===0 when unit is "%"', () => {
    renderFactor({
      label: 'Churn rate',
      type: 'factor',
      observedState: { value: 0, unit: '%' },
    })
    expect(screen.getByText('0%')).toBeDefined()
    expect(screen.queryByText('Not used')).toBeNull()
  })

  // P1.5: qualitative factor_type + no unit — still shows 'Not used'
  it('shows "Not used" for value===0 with qualitative factor_type and no unit', () => {
    renderFactor({
      label: 'Product fit',
      type: 'factor',
      observedState: { value: 0, factor_type: 'quality' },
    })
    expect(screen.getByText('Not used')).toBeDefined()
  })

  it('falls back to Very high for binary 1 without raw_value', () => {
    renderFactor({
      label: 'Hired',
      type: 'factor',
      observedState: { value: 1 },
    })
    expect(screen.getByText('Very high')).toBeDefined()
  })

  // T4: External factor with no observedState shows "No baseline"
  it('shows "No baseline" for external factor with no observedState', () => {
    renderFactor({ label: 'Market', type: 'factor', category: 'external' })
    expect(screen.getByText('No baseline')).toBeDefined()
  })

  it('shows "No baseline" for factor with observedState but no value', () => {
    renderFactor({
      label: 'Metric',
      type: 'factor',
      observedState: { unit: 'k' },
    })
    expect(screen.getByText('No baseline')).toBeDefined()
  })

  // T5: "estimated" pill
  it('shows "estimated" pill for inferred extraction type', () => {
    renderFactor({
      label: 'Salary',
      type: 'factor',
      observedState: { value: 0.5, extractionType: 'inferred' },
    })
    expect(screen.getByText('estimated')).toBeDefined()
  })

  it('does not show "estimated" pill for explicit extraction type', () => {
    renderFactor({
      label: 'Salary',
      type: 'factor',
      observedState: { value: 0.5, extractionType: 'explicit' },
    })
    expect(screen.queryByText('estimated')).toBeNull()
  })

  // Provenance combinations — brief acceptance criteria
  // Combination 1: extractionType='inferred' + source='brief_extraction'
  //   → source pill "Generated from your brief" shows; "estimated" pill suppressed
  it('shows source pill (not estimated) when extractionType=inferred and source=brief_extraction', () => {
    renderFactor({
      label: 'Salary',
      type: 'factor',
      observedState: { value: 0.5, extractionType: 'inferred', source: 'brief_extraction' },
    })
    expect(screen.getByText('Generated from your brief')).toBeDefined()
    expect(screen.queryByText('estimated')).toBeNull()
  })

  // Combination 2: extractionType='inferred' + no source → "estimated" pill shows
  it('shows estimated pill when extractionType=inferred and no source', () => {
    renderFactor({
      label: 'Salary',
      type: 'factor',
      observedState: { value: 0.5, extractionType: 'inferred' },
    })
    expect(screen.getByText('estimated')).toBeDefined()
    expect(screen.queryByText('Generated from your brief')).toBeNull()
  })

  // Combination 3: source='cee_inference' → "Estimated by Olumi" source pill shows; "estimated" pill suppressed
  it('shows "Estimated by Olumi" source pill (not estimated) when source=cee_inference', () => {
    renderFactor({
      label: 'Salary',
      type: 'factor',
      observedState: { value: 0.5, extractionType: 'inferred', source: 'cee_inference' },
    })
    expect(screen.getByText('Estimated by Olumi')).toBeDefined()
    expect(screen.queryByText('estimated')).toBeNull()
  })

  // T6: Influence/Confidence tiers (results mode)
  it('shows Influence and Confidence tiers in results mode', () => {
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
    renderFactor({ label: 'Salary', type: 'factor' })
    expect(screen.getByText('Influence')).toBeDefined()
    expect(screen.getByText('High')).toBeDefined()
    expect(screen.getByText('Confidence')).toBeDefined()
    expect(screen.getByText('Fair')).toBeDefined()
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

  it('shows "No baseline" when observedState has only unit (no value)', () => {
    renderFactor({ label: 'X', type: 'factor', observedState: { unit: 'k' } })
    expect(screen.getByText('No baseline')).toBeDefined()
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
    // Badge must NOT use position:absolute (was old style — absolute top-1 right-1)
    expect(badge.className).not.toContain('absolute')
    // Category icon still present alongside the badge (right-aligned via ml-auto parent)
    const icon = container.querySelector('[title="You control this factor"]')
    expect(icon).not.toBeNull()
    // Verify DOM order in the header row: SVG (shape) → badge span → type label span
    // The header row is the flex div that contains NodeShapeIndicator
    const svg = container.querySelector('svg[aria-hidden="true"]')
    expect(svg).not.toBeNull()
    const headerRow = svg?.parentElement
    expect(headerRow).not.toBeNull()
    const children = Array.from(headerRow!.children)
    const svgIdx = children.indexOf(svg as Element)
    const badgeIdx = children.indexOf(badge)
    const labelSpan = children.find(el => el.textContent === 'Factor')
    const labelIdx = labelSpan ? children.indexOf(labelSpan) : -1
    // Shape comes before badge, badge comes before type label
    expect(svgIdx).toBeLessThan(badgeIdx)
    expect(badgeIdx).toBeLessThan(labelIdx)
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
    const { container } = renderFactor({ label: 'Revenue', type: 'factor' })
    const bars = container.querySelectorAll('.bg-info')
    // Both sensitivity and evidence bars should be bg-info
    expect(bars.length).toBeGreaterThanOrEqual(2)
    expect(container.querySelector('.bg-factor')).toBeNull()
  })

  // P5: Estimated badge is outlined pill (bg-panel + border-warning/30 + text-text-body, not filled orange)
  it('estimated badge uses outlined pill style (P5)', () => {
    renderFactor({
      label: 'Salary',
      type: 'factor',
      observedState: { value: 0.5, extractionType: 'inferred' },
    })
    const badge = screen.getByText('estimated')
    expect(badge.className).toContain('text-text-body')
    expect(badge.className).not.toContain('text-warning')
    expect(badge.className).toContain('bg-panel')
    expect(badge.className).not.toContain('bg-warning-light')
    expect(badge.className).not.toContain('bg-panel-hover')
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
    expect(nodeEl?.className).toContain('border-factor')
  })

  it('uses border-factor for any factor with no observed value (controllable)', () => {
    const { container } = renderFactor({
      label: 'Hiring rate',
      type: 'factor',
      category: 'controllable',
      // No observedState.value
    })
    const nodeEl = container.querySelector('[role="group"]')
    expect(nodeEl?.className).not.toContain('border-goal')
  })

  // P0 (feedback): binary factor_type + value=0 must show "Not used", not "Very low"
  it('shows "Not used" for value===0 with factor_type "binary" and no unit', () => {
    renderFactor({
      label: 'Hire decision',
      type: 'factor',
      observedState: { value: 0, factor_type: 'binary' },
    })
    expect(screen.getByText('Not used')).toBeDefined()
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
    const { container } = renderFactor({ label: 'Revenue', type: 'factor' })
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

  // A6: value=0, factor_type="binary", no unit → "Not used"
  it('A6: binary factor value=0 without unit renders "Not used"', () => {
    renderFactor({ label: 'Hired', type: 'factor', observedState: { value: 0, factor_type: 'binary' } })
    expect(screen.getByText('Not used')).toBeDefined()
  })

  // A7: value=0, unit="%", raw_value=0 → "0%" (not "Not used")
  it('A7: value=0 with unit="%" renders "0%" not "Not used"', () => {
    renderFactor({ label: 'Churn', type: 'factor', observedState: { value: 0, unit: '%', raw_value: 0 } })
    expect(screen.getByText('0%')).toBeDefined()
    expect(screen.queryByText('Not used')).toBeNull()
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

  // A14: source='cee_inference' → provenance pill shows "Estimated by Olumi" (AI inference, not brief extraction)
  it('A14: source="cee_inference" renders provenance pill "Estimated by Olumi"', () => {
    renderFactor({
      label: 'Market rate',
      type: 'factor',
      observedState: { value: 0.5, source: 'cee_inference' },
    })
    expect(screen.getByText('Estimated by Olumi')).toBeDefined()
  })

  // A15: source='brief_extraction' → provenance pill (also "Generated from your brief")
  it('A15: source="brief_extraction" renders provenance pill', () => {
    renderFactor({
      label: 'Revenue',
      type: 'factor',
      observedState: { value: 0.6, source: 'brief_extraction' },
    })
    // getProvenanceLabel('brief_extraction') = 'Generated from your brief'
    expect(screen.getByText('Generated from your brief')).toBeDefined()
  })

  // A16: source='user' → no provenance pill
  it('A16: source="user" renders no provenance pill', () => {
    renderFactor({
      label: 'Budget',
      type: 'factor',
      observedState: { value: 0.7, source: 'user' },
    })
    expect(screen.queryByText('Generated from your brief')).toBeNull()
    expect(screen.queryByText('Estimated by Olumi')).toBeNull()
    expect(screen.queryByText('Set by you')).toBeNull()
  })

  // A17: "Not used" value + provenance pill rendered on separate lines (not merged as phrase)
  it('A17: "Not used" and provenance pill are separate elements (not "Not used Estimated" phrase)', () => {
    const { container } = renderFactor({
      label: 'Item',
      type: 'factor',
      observedState: { value: 0, source: 'cee_inference' },
    })
    void container
    // Both elements should exist
    expect(screen.getByText('Not used')).toBeDefined()
    expect(screen.getByText('Estimated by Olumi')).toBeDefined()
    // Should not appear as a joined phrase
    expect(screen.queryByText(/Not used.*estimated/i)).toBeNull()
    expect(screen.queryByText(/Not usedEstimated/)).toBeNull()
    // Value text and provenance pill must be in separate container elements
    const valueEl = screen.getByText('Not used')
    const pillEl = screen.getByText('Estimated by Olumi')
    // They must not share the same parent element
    expect(valueEl.parentElement).not.toBe(pillEl.parentElement)
    // The pill div must be a different div from the value div
    expect(pillEl.closest('div')).not.toBe(valueEl.closest('div'))
  })

  // A17b: "Not used" + "estimated" pill — inferred source (extractionType='inferred')
  // Shows "estimated" pill, NOT a provenance pill (source='inferred' is suppressed to avoid double-pill).
  // Both "Not used" text and "estimated" pill must be in separate container elements.
  it('A17b: value=0 + extractionType=inferred shows "Not used" and "estimated" pill in separate containers, no provenance pill', () => {
    renderFactor({
      label: 'Item',
      type: 'factor',
      observedState: { value: 0, source: 'inferred', extractionType: 'inferred' },
    })
    // "Not used" (value display) must appear
    expect(screen.getByText('Not used')).toBeDefined()
    // "estimated" pill must appear (extractionType='inferred')
    expect(screen.getByText('estimated')).toBeDefined()
    // "Generated from your brief" / "Estimated by Olumi" provenance pill must NOT appear
    // (source='inferred' is suppressed to avoid double-pill with the "estimated" badge)
    expect(screen.queryByText('Estimated by Olumi')).toBeNull()
    expect(screen.queryByText('Generated from your brief')).toBeNull()
    // Value text and estimated pill must be in separate container elements
    const valueEl = screen.getByText('Not used')
    const pillEl = screen.getByText('estimated')
    expect(valueEl.parentElement).not.toBe(pillEl.parentElement)
    expect(pillEl.closest('div')).not.toBe(valueEl.closest('div'))
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
