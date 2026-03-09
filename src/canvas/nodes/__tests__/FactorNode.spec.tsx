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

// Default: graph badges OFF. Individual tests override as needed.
vi.mock('../../../flags', () => ({
  isGraphBadgesEnabled: vi.fn(() => false),
  isNodeIntelligenceEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isContextMenuEnabled: vi.fn(() => false),
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

  it('falls back to None for binary 0 without raw_value', () => {
    renderFactor({
      label: 'Hired',
      type: 'factor',
      observedState: { value: 0 },
    })
    expect(screen.getByText('None')).toBeDefined()
  })

  it('falls back to Full for binary 1 without raw_value', () => {
    renderFactor({
      label: 'Hired',
      type: 'factor',
      observedState: { value: 1 },
    })
    expect(screen.getByText('Full')).toBeDefined()
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

  // T6: Sensitivity/Evidence tiers (results mode)
  it('shows Sensitivity and Evidence tiers in results mode', () => {
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
    expect(screen.getByText('Sensitivity')).toBeDefined()
    expect(screen.getByText('High')).toBeDefined()
    expect(screen.getByText('Evidence')).toBeDefined()
    expect(screen.getByText('Fair')).toBeDefined()
  })

  it('hides Sensitivity/Evidence bars outside results mode', () => {
    renderFactor({ label: 'Salary', type: 'factor' })
    expect(screen.queryByText('Sensitivity')).toBeNull()
    expect(screen.queryByText('Evidence')).toBeNull()
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

  it('does not show Sensitivity/Evidence bars in results mode when both influence and confidence are null', () => {
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
    expect(screen.queryByText('Sensitivity')).toBeNull()
    expect(screen.queryByText('Evidence')).toBeNull()
  })

  it('does not show Sensitivity bar when influence is exactly 0', () => {
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
    expect(screen.queryByText('Sensitivity')).toBeNull()
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
