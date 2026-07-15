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
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })),
}))

vi.mock('../../../hooks/useCEEInsights', () => ({
  useCEEInsights: vi.fn(() => ({ data: null })),
}))

vi.mock('../../../hooks/useISLValidation', () => ({
  useISLValidation: vi.fn(() => ({ data: null })),
}))

vi.mock('../../hooks/useScienceIcons', () => ({
  useScienceIcons: vi.fn(() => []),
}))

// Make NodePopover transparent in tests so we can directly assert what its
// content would render (otherwise the popover is hidden until 300ms hover).
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="factor-node-popover">{children}</div>
  ),
}))

// Default: graph badges OFF, lens OFF. Individual tests override as needed.
vi.mock('../../../flags', () => ({
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import { useScienceIcons } from '../../hooks/useScienceIcons'
import { isGraphBadgesEnabled } from '../../../flags'
import { Sparkles } from 'lucide-react'

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
  beforeEach(() => { vi.clearAllMocks() })

  // T1: No all-caps text
  it('renders label', () => {
    renderFactor({ label: 'Hiring rate', type: 'factor' })
    const label = screen.getByText('Hiring rate')
    expect(label).toBeDefined()
    // Type label removed — shape icon + tooltip only (spec Section 3.2)
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

  // F2: Category icons removed — science icons replace them (spec Section 3.2)
  it('does not render old category icon tooltips (controllable)', () => {
    const { container } = renderFactor({ label: 'Budget', type: 'factor', category: 'controllable' })
    expect(container.querySelector('[title="You control this factor"]')).toBeNull()
  })

  it('does not render old category icon tooltips (observable)', () => {
    const { container } = renderFactor({ label: 'Revenue', type: 'factor', category: 'observable' })
    expect(container.querySelector('[title="You can measure this"]')).toBeNull()
  })

  it('shows dashed-border tooltip for external factors', () => {
    const { container } = renderFactor({ label: 'Market rate', type: 'factor', category: 'external' })
    // "Outside your control" is now a border tooltip (not body text) per spec
    expect(container.querySelector('[title="Outside your control"]')).not.toBeNull()
  })

  it('omits old category icon tooltips when category is absent', () => {
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

  it('renders non-numeric currency raw_value as suffix (approx 50 £)', () => {
    renderFactor({
      label: 'Cost',
      type: 'factor',
      observedState: { raw_value: 'approx 50', unit: '£' },
    })
    // Non-numeric raw_value uses suffix format in formatFactorDisplayValue
    expect(screen.getByText('approx 50 £')).toBeDefined()
  })

  it('shows raw_value alone when no unit', () => {
    renderFactor({
      label: 'Score',
      type: 'factor',
      observedState: { raw_value: '85', value: 0.85 },
    })
    expect(screen.getByText('85')).toBeDefined()
  })

  it('renders contextual text for explicitly-binary 0 without raw_value', () => {
    renderFactor({
      label: 'Hired',
      type: 'factor',
      // Polish 4 review: contextual text now requires factor_type='binary'.
      observedState: { value: 0, factor_type: 'binary' },
    })
    expect(screen.getByText('No hired in place')).toBeDefined()
  })

  // Task 4: factor_type descriptor must never appear as a display unit
  it('does not show "binary" as unit when unit field contains "binary"', () => {
    renderFactor({
      label: 'Hire decision',
      type: 'factor',
      // Polish 4 review: when unit is 'binary' (a factor_type leak),
      // isSuppressedUnit drops it. We also need factor_type='binary' for the
      // contextual heuristic to fire.
      observedState: { value: 0, unit: 'binary', factor_type: 'binary' },
    })
    expect(screen.queryByText(/binary/)).toBeNull()
    expect(screen.getByText('No hire decision in place')).toBeDefined()
  })

  it('does not show "normalized" as unit when unit field contains "normalized"', () => {
    renderFactor({
      label: 'Fit score',
      type: 'factor',
      observedState: { value: 0.3, unit: 'normalized' },
    })
    // "normalized" suppressed by isSuppressedUnit; non-binary value without raw_value → no display
    expect(screen.queryByText(/normalized/)).toBeNull()
    expect(screen.queryByText('Low')).toBeNull()
    expect(screen.queryByText('0.3')).toBeNull()
  })

  // P1.5: value===0 with unit but no raw_value → contextual text (formatFactorDisplayValue)
  it('shows contextual text for value===0 when unit is "%" but no raw_value', () => {
    renderFactor({
      label: 'Churn rate',
      type: 'factor',
      observedState: { value: 0, unit: '%' },
    })
    // No raw_value → value-only path → "No churn in place" (suffix "Rate" stripped)
    expect(screen.getByText('No churn in place')).toBeDefined()
  })

  // Polish 4 review: continuous quality factors at value=0 should NOT render
  // "No X in place" — that misrepresents a continuum as a binary. The
  // contextual heuristic now only fires when factor_type === 'binary'.
  it('suppresses contextual text for value===0 with qualitative factor_type and no unit', () => {
    renderFactor({
      label: 'Product fit',
      type: 'factor',
      observedState: { value: 0, factor_type: 'quality' },
    })
    expect(screen.queryByText('No product fit in place')).toBeNull()
  })

  it('renders contextual text for explicitly-binary 1 without raw_value', () => {
    renderFactor({
      label: 'Hired',
      type: 'factor',
      observedState: { value: 1, factor_type: 'binary' },
    })
    expect(screen.getByText('Hired active')).toBeDefined()
  })

  // T4: External factor with no observedState — dashed border only, no body text
  it('renders external factor with no observedState without body text', () => {
    renderFactor({ label: 'Market', type: 'factor', category: 'external' })
    // "Outside your control." text removed — dashed border is the visual signal
    expect(screen.queryByText('Outside your control.')).toBeNull()
  })

  it('shows "Help me estimate this" chip for factor with observedState but no value', () => {
    renderFactor({
      label: 'Metric',
      type: 'factor',
      observedState: { unit: 'k' },
    })
    // "Missing value. Weakens analysis." text removed — chip only
    expect(screen.queryByText('Missing value. Weakens analysis.')).toBeNull()
    expect(screen.getByText('Help me estimate this')).toBeDefined()
  })

  // T5: Provenance now handled by science icons (useScienceIcons hook)
  // Science icons use aria-label, not title attribute
  it('shows science icon for inferred extraction type (via aria-label)', () => {
    vi.mocked(useScienceIcons).mockReturnValue([{
      id: 'olumi-estimate', icon: Sparkles,
      tooltip: 'Olumi estimated this value. May not match reality.',
      action: 'Confirm or adjust the value for Salary', colour: 'text-text-light', priority: 3,
    }])
    renderFactor({
      label: 'Salary',
      type: 'factor',
      observedState: { value: 0.5, extractionType: 'inferred' },
    })
    // Science icon: "Olumi estimated this value. May not match reality."
    expect(screen.getByLabelText(/Olumi estimated/)).toBeDefined()
  })

  it('does not show Olumi estimate icon for explicit extraction type', () => {
    renderFactor({
      label: 'Salary',
      type: 'factor',
      observedState: { value: 0.5, extractionType: 'explicit' },
    })
    expect(screen.queryByLabelText(/Olumi estimated/)).toBeNull()
  })

  // Provenance combinations — science icons replaced old provenance icons
  // Combination 1: extractionType='inferred' + source='brief_extraction' → science icon still shows (based on extractionType)
  it('shows science icon when extractionType=inferred and source=brief_extraction', () => {
    vi.mocked(useScienceIcons).mockReturnValue([{
      id: 'olumi-estimate', icon: Sparkles,
      tooltip: 'Olumi estimated this value. May not match reality.',
      action: 'Confirm or adjust the value for Salary', colour: 'text-text-light', priority: 3,
    }])
    renderFactor({
      label: 'Salary',
      type: 'factor',
      observedState: { value: 0.5, extractionType: 'inferred', source: 'brief_extraction' },
    })
    expect(screen.getByLabelText(/Olumi estimated/)).toBeDefined()
  })

  // Combination 2: extractionType='inferred' + no source → science icon shows
  it('shows science icon when extractionType=inferred and no source', () => {
    vi.mocked(useScienceIcons).mockReturnValue([{
      id: 'olumi-estimate', icon: Sparkles,
      tooltip: 'Olumi estimated this value. May not match reality.',
      action: 'Confirm or adjust the value for Salary', colour: 'text-text-light', priority: 3,
    }])
    renderFactor({
      label: 'Salary',
      type: 'factor',
      observedState: { value: 0.5, extractionType: 'inferred' },
    })
    expect(screen.getByLabelText(/Olumi estimated/)).toBeDefined()
  })

  // Combination 3: source='cee_inference' + extractionType='inferred' → science icon shows
  it('shows science icon when source=cee_inference and extractionType=inferred', () => {
    vi.mocked(useScienceIcons).mockReturnValue([{
      id: 'olumi-estimate', icon: Sparkles,
      tooltip: 'Olumi estimated this value. May not match reality.',
      action: 'Confirm or adjust the value for Salary', colour: 'text-text-light', priority: 3,
    }])
    renderFactor({
      label: 'Salary',
      type: 'factor',
      observedState: { value: 0.5, extractionType: 'inferred', source: 'cee_inference' },
    })
    expect(screen.getByLabelText(/Olumi estimated/)).toBeDefined()
  })

  // T6: Influence/Confidence bars in results mode — only in Layer 2 (Detailed view)
  it('shows Influence and Confidence bars in Detailed results mode', () => {
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
        viewMode: 'expert', // Detailed mode → Layer 2 inline
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
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    renderFactor({ label: 'Salary', type: 'factor', observedState: { value: 0.5 } })
    // In Detailed mode, Layer 2 is inline so bars appear
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

  it('shows "Help me estimate this" chip when observedState has only unit (no value)', () => {
    renderFactor({ label: 'X', type: 'factor', observedState: { unit: 'k' } })
    expect(screen.queryByText('Missing value. Weakens analysis.')).toBeNull()
    expect(screen.getByText('Help me estimate this')).toBeDefined()
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
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
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
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    renderFactor({ label: 'X', type: 'factor' })
    expect(screen.queryByText('Influence')).toBeNull()
  })

  it('omits category label when category is an unrecognised string', () => {
    renderFactor({ label: 'X', type: 'factor', category: 'unknown_category' })
    expect(screen.queryByText('Controllable')).toBeNull()
    expect(screen.queryByText('Measurable')).toBeNull()
  })

  // P3: Rank badge in header row
  it('rank badge renders with absolute positioning (P3)', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: 1,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: false,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    renderFactor({
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
    // Category icons removed — science icons replace them
  })

  // P2: Non-binary value with no raw_value, no unit → no display (formatFactorDisplayValue returns null)
  it('shows no value text for factor with non-binary value, no raw_value and no unit (P2)', () => {
    renderFactor({
      label: 'Product-market fit',
      type: 'factor',
      observedState: { value: 0.5 },
    })
    // Non-binary values without raw_value return null — no body text displayed
    expect(screen.queryByText('Medium')).toBeNull()
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

  // P4: Evidence bar uses bg-info (not bg-factor) — Detailed results mode
  it('evidence bar uses bg-info class in Detailed results mode (P4)', () => {
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
        viewMode: 'expert', // Detailed mode → Layer 2 inline
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
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    const { container } = renderFactor({ label: 'Revenue', type: 'factor', observedState: { value: 0.5 } })
    const bars = container.querySelectorAll('.bg-info')
    // Both sensitivity and evidence bars should be bg-info
    expect(bars.length).toBeGreaterThanOrEqual(2)
    expect(container.querySelector('.bg-factor')).toBeNull()
  })

  // P5: Inferred factor shows science icon + confirm action (needs non-null valueDisplay)
  it('inferred factor shows science icon and confirm action icon (P5)', () => {
    vi.mocked(useScienceIcons).mockReturnValue([{
      id: 'olumi-estimate', icon: Sparkles,
      tooltip: 'Olumi estimated this value. May not match reality.',
      action: 'Confirm or adjust the value for Salary', colour: 'text-text-light', priority: 3,
    }])
    renderFactor({
      label: 'Salary',
      type: 'factor',
      // value=0 + factor_type='binary' produces non-null valueDisplay
      // ("No salary in place"), enabling the confirm button.
      observedState: { value: 0, extractionType: 'inferred', factor_type: 'binary' },
    })
    // Science icon uses aria-label
    expect(screen.getByLabelText(/Olumi estimated/)).toBeDefined()
    // ActionIcons confirm button uses title (requires valueDisplay !== null)
    expect(screen.getByTitle('Confirm value')).toBeDefined()
  })

  // Graph v1.1 wireframe v4: external factors NEVER get amber treatment.
  // Dashed border = "outside your control"; amber = "needs your judgement".
  // The two states must not be confused, even when value is missing.
  it('uses border-factor (not amber, not goal) for external factor with no observed value', () => {
    const { container } = renderFactor({
      label: 'Market rate',
      type: 'factor',
      category: 'external',
      // No observedState.value — but external factors are exempt from amber.
    })
    const nodeEl = container.querySelector('[role="group"]')
    expect(nodeEl?.className).not.toContain('border-goal')
    expect(nodeEl?.className).not.toContain('border-warning')
    expect(nodeEl?.className).toContain('border-factor')
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

  // P0 (feedback): binary factor_type + value=0 → contextual text
  it('shows contextual text for value===0 with factor_type "binary" and no unit', () => {
    renderFactor({
      label: 'Hire decision',
      type: 'factor',
      observedState: { value: 0, factor_type: 'binary' },
    })
    // factor_type "binary" is suppressed by isSuppressedUnit, value-only path
    expect(screen.getByText('No hire decision in place')).toBeDefined()
    expect(screen.queryByText('Very low')).toBeNull()
  })

  it('shows contextual text for value===1 with factor_type "binary" and no unit', () => {
    renderFactor({
      label: 'Hire decision',
      type: 'factor',
      observedState: { value: 1, factor_type: 'binary' },
    })
    expect(screen.getByText('Hire decision active')).toBeDefined()
  })

  // P1.3 (feedback): compact DataBar progressbar elements in Detailed results mode
  it('renders progressbar elements for Influence and Confidence bars in Detailed results mode', () => {
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
        viewMode: 'expert', // Detailed → Layer 2 inline
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
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
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

  // Lane C4 (influence-scale disclosure): the "I: NN%" pill shares the panel's
  // display number; when the shared model resolved it on the fallback
  // (set-relative) basis, FactorNode must pass that provenance through so the
  // pill discloses "top driver always shows 100%" instead of reading as an
  // absolute causal share.
  it('passes influence provenance to MetricPills so the pill discloses the relative scale (C4)', () => {
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
        viewMode: 'standard',
      })
    )
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: 1,
      influence: 1,
      influenceProvenance: 'normalised_elasticity',
      confidence: null,
      inSensitivityAnalysis: true,
      achievementProbability: null,
      achievementProbabilityIsModelledBasis: false,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    renderFactor({ label: 'Technical Leadership Capability', type: 'factor', observedState: { value: 0.5 } })
    const pill = screen.getByText('I: 100%')
    expect(pill.getAttribute('title')).toBe(
      'Influence: how much this factor affects the outcome, relative to the strongest. The top driver always shows 100%.'
    )
    expect(pill.getAttribute('aria-label')).toBe(
      'Influence 100%, relative to the strongest factor. The top driver always shows 100%'
    )
  })

  // -------------------------------------------------------------------------
  // Review fix 4: the DETAILED view renders the same display-model number one
  // level up from the pill ('Influence' + DataBar + 'NN%') and had NO basis
  // disclosure at all — the identical misread class the pill fix addressed.
  // The bar's accessible name carries the basis (its role="progressbar"
  // announces the value via aria-valuenow); `title` carries it for pointer
  // users. Both bases pinned, plus the fail-closed no-provenance case.
  // -------------------------------------------------------------------------
  describe('detailed-view Influence row discloses the basis (review fix 4)', () => {
    function renderDetailedWithProvenance(
      influenceProvenance: 'normalised_elasticity' | 'influence_score' | null,
      influence: number,
    ) {
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
          viewMode: 'expert', // Detailed → Layer 2 inline
        })
      )
      vi.mocked(useNodeDisplayMetadata).mockReturnValue({
        sensitivityRank: 1,
        influence,
        influenceProvenance,
        confidence: null,
        inSensitivityAnalysis: true,
        achievementProbability: null,
        achievementProbabilityIsModelledBasis: false,
        stabilityPercentage: null,
        winRate: null,
        isResultsMode: true,
        predictedOutcome: null,
        valueOfInformation: null,
        voiRank: null,
      } as any)
      return renderFactor({ label: 'Revenue', type: 'factor', observedState: { value: 0.5 } })
    }

    it('fallback basis: the row discloses that the top driver always shows 100%', () => {
      renderDetailedWithProvenance('normalised_elasticity', 1)
      const bar = screen.getByRole('progressbar', {
        name: 'Influence, relative to the strongest factor. The top driver always shows 100%',
      })
      expect(bar.getAttribute('aria-valuenow')).toBe('100')
      // Pointer users get the same disclosure on the row.
      const row = screen.getByText('Influence').closest('div')
      expect(row?.getAttribute('title')).toBe(
        'Influence: how much this factor affects the outcome, relative to the strongest. The top driver always shows 100%.'
      )
    })

    it('producer basis: the row discloses the absolute causal influence score', () => {
      renderDetailedWithProvenance('influence_score', 0.6)
      const bar = screen.getByRole('progressbar', {
        name: 'Influence, an absolute causal influence score from the analysis',
      })
      expect(bar.getAttribute('aria-valuenow')).toBe('60')
      const row = screen.getByText('Influence').closest('div')
      expect(row?.getAttribute('title')).toBe(
        'Influence: how much this factor affects the outcome, as an absolute causal influence score from the analysis.'
      )
    })

    it('no provenance stamp: fails closed to generic wording, claiming no basis', () => {
      renderDetailedWithProvenance(null, 0.6)
      const bar = screen.getByRole('progressbar', { name: 'Influence' })
      expect(bar.getAttribute('aria-valuenow')).toBe('60')
      const row = screen.getByText('Influence').closest('div')
      expect(row?.getAttribute('title')).toBe(
        'Influence: how much this factor affects the outcome'
      )
      expect(row?.getAttribute('title')).not.toContain('100%')
    })
  })
})

// ---------------------------------------------------------------------------
// QA Brief: A-series — factor node display scenarios
// ---------------------------------------------------------------------------
describe('FactorNode — QA Brief A-series', () => {
  beforeEach(() => { vi.clearAllMocks() })

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

  // A4: value=0.5, no raw_value, cap=100, unit="£" → no display (formatFactorDisplayValue returns null for value-only)
  it('A4: value=0.5 with cap=100 and unit="£" but no raw_value renders no value text', () => {
    renderFactor({ label: 'Price', type: 'factor', observedState: { value: 0.5, cap: 100, unit: '£' } })
    // No raw_value → value-only path, non-binary → null
    expect(screen.queryByText('£50')).toBeNull()
  })

  // A5: value=1.0 + factor_type='binary' renders contextual "{Label} active".
  // Polish 4 review: contextual text now requires explicit factor_type.
  it('A5: value=1.0 with factor_type=binary and no raw_value renders contextual text', () => {
    renderFactor({ label: 'Quality', type: 'factor', observedState: { value: 1.0, factor_type: 'binary' } })
    expect(screen.getByText('Quality active')).toBeDefined()
  })

  // A6: value=0, factor_type="binary", no unit → contextual text
  it('A6: binary factor value=0 without unit renders contextual text', () => {
    renderFactor({ label: 'Hired', type: 'factor', observedState: { value: 0, factor_type: 'binary' } })
    expect(screen.getByText('No hired in place')).toBeDefined()
  })

  // A7: value=0, unit="%", raw_value=0 → "0%" (not "Not active")
  it('A7: value=0 with unit="%" renders "0%" not "Not active"', () => {
    renderFactor({ label: 'Churn', type: 'factor', observedState: { value: 0, unit: '%', raw_value: 0 } })
    expect(screen.getByText('0%')).toBeDefined()
    expect(screen.queryByText('Not active')).toBeNull()
  })

  // A8: factor_type="normalized", no unit → no display (non-binary value without raw_value)
  it('A8: factor_type="normalized" with no unit shows no value text', () => {
    renderFactor({ label: 'Score', type: 'factor', observedState: { value: 0.3, factor_type: 'normalized' } })
    // "normalized" must not appear in rendered output
    expect(screen.queryByText(/normalized/i)).toBeNull()
    // Non-binary value without raw_value → null (no display)
    expect(screen.queryByText('Low')).toBeNull()
  })

  // A9: factor_type="binary", no unit → no "binary" suffix in value display
  it('A9: factor_type="binary" with no unit shows value without type suffix', () => {
    renderFactor({ label: 'Decision', type: 'factor', observedState: { value: 0.5, factor_type: 'binary' } })
    expect(screen.queryByText(/binary/i)).toBeNull()
  })

  // A10 (Polish 4 review follow-up): unit="CHF" now renders as ISO-style
  // prefix "CHF 500" — classifyUnit in labelUtils puts CHF in the iso kind,
  // which formats as space-separated prefix across every canvas surface.
  // Previously this file rendered "500 CHF" via its own hardcoded symbol
  // list; that inconsistency with labelUtils was flagged as tech debt and
  // is now fixed.
  it('A10: unit="CHF" with raw_value=500 renders "CHF 500" (ISO-style prefix)', () => {
    renderFactor({ label: 'Cost', type: 'factor', observedState: { raw_value: '500', unit: 'CHF' } })
    expect(screen.getByText('CHF 500')).toBeDefined()
  })

  // A14: source='cee_inference' — provenance icons removed, science icons handle this
  // The science icon triggers on extractionType='inferred', not source alone
  it('A14: source="cee_inference" without extractionType=inferred does not render science icon', () => {
    renderFactor({
      label: 'Market rate',
      type: 'factor',
      observedState: { value: 0.5, source: 'cee_inference' },
    })
    // No extractionType='inferred' → no Olumi estimate science icon
    expect(screen.queryByLabelText(/Olumi estimated/)).toBeNull()
  })

  // A15: source='brief_extraction' — old provenance icon removed, science icons based on extractionType
  it('A15: source="brief_extraction" without extractionType=inferred does not render science icon', () => {
    renderFactor({
      label: 'Revenue',
      type: 'factor',
      observedState: { value: 0.6, source: 'brief_extraction' },
    })
    // No extractionType='inferred' → no Olumi estimate science icon
    expect(screen.queryByLabelText(/Olumi estimated/)).toBeNull()
    expect(screen.queryByTitle('From your brief')).toBeNull()
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

  // A17: Contextual value text + science icon are separate elements
  it('A17: contextual value text and science icon are separate elements', () => {
    vi.mocked(useScienceIcons).mockReturnValue([{
      id: 'olumi-estimate', icon: Sparkles,
      tooltip: 'Olumi estimated this value. May not match reality.',
      action: 'Confirm or adjust the value for Item', colour: 'text-text-light', priority: 3,
    }])
    renderFactor({
      label: 'Item',
      type: 'factor',
      observedState: { value: 0, source: 'cee_inference', extractionType: 'inferred', factor_type: 'binary' },
    })
    // Value text exists (contextual) — requires factor_type='binary' post Polish 4 review
    expect(screen.getByText('No item in place')).toBeDefined()
    // Science icon via aria-label
    expect(screen.getByLabelText(/Olumi estimated/)).toBeDefined()
  })

  // A17b: value=0 + extractionType=inferred → contextual text + science icon + confirm action
  it('A17b: value=0 + extractionType=inferred shows contextual text, science icon, and confirm action', () => {
    vi.mocked(useScienceIcons).mockReturnValue([{
      id: 'olumi-estimate', icon: Sparkles,
      tooltip: 'Olumi estimated this value. May not match reality.',
      action: 'Confirm or adjust the value for Item', colour: 'text-text-light', priority: 3,
    }])
    renderFactor({
      label: 'Item',
      type: 'factor',
      observedState: { value: 0, source: 'inferred', extractionType: 'inferred', factor_type: 'binary' },
    })
    // Contextual value display — requires factor_type='binary' post Polish 4 review
    expect(screen.getByText('No item in place')).toBeDefined()
    // Science icon via aria-label
    expect(screen.getByLabelText(/Olumi estimated/)).toBeDefined()
    // ActionIcons confirm button
    expect(screen.getByTitle('Confirm value')).toBeDefined()
  })

  // A18: Tier labels removed — non-binary values without raw_value show no display text
  it('A18: value=0.2 → no tier label (non-binary without raw_value returns null)', () => {
    renderFactor({ label: 'Q', type: 'factor', observedState: { value: 0.2 } })
    expect(screen.queryByText('Very low')).toBeNull()
  })
  it('A18: value=0.21 → no tier label', () => {
    renderFactor({ label: 'Q', type: 'factor', observedState: { value: 0.21 } })
    expect(screen.queryByText('Low')).toBeNull()
  })
  it('A18: value=0.4 → no tier label', () => {
    renderFactor({ label: 'Q', type: 'factor', observedState: { value: 0.4 } })
    expect(screen.queryByText('Low')).toBeNull()
  })
  it('A18: value=0.41 → no tier label', () => {
    renderFactor({ label: 'Q', type: 'factor', observedState: { value: 0.41 } })
    expect(screen.queryByText('Medium')).toBeNull()
  })
  it('A18: value=0.8 → no tier label', () => {
    renderFactor({ label: 'Q', type: 'factor', observedState: { value: 0.8 } })
    expect(screen.queryByText('High')).toBeNull()
  })
  it('A18: value=0.81 → no tier label', () => {
    renderFactor({ label: 'Q', type: 'factor', observedState: { value: 0.81 } })
    expect(screen.queryByText('Very high')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Evidence gap badge (Phase 3A)
// ---------------------------------------------------------------------------

describe('FactorNode — evidence gap badge', () => {
  beforeEach(() => { vi.clearAllMocks() })

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

// ---------------------------------------------------------------------------
// Intervention hover — regression guard for the CEEInterventionV3 unwrap bug.
// Before the fix (b053c82b), FactorNode cast hoveredOption.data.interventions
// as Record<string,number>, causing objects to render as "[object Object]" /
// "£NaN" / "Very high" via Math.round({...}), string concat, and falsy
// comparison coercion. These tests lock both intervention shapes (primitive
// number and {value} object) in so the narrowing branch cannot silently revert.
// ---------------------------------------------------------------------------

describe('FactorNode — intervention hover', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const mountWithHoveredOption = (interventionEntry: unknown, factorData: Record<string, unknown>) => {
    vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
      selector({
        hoveredOptionId: 'option-1',
        nodes: [
          { id: 'option-1', type: 'option', data: { interventions: { 'factor-1': interventionEntry } } },
        ],
        edges: [],
        ceeAnalysisReady: null,
        results: { status: 'idle', report: null },
        highlightedNodes: new Set(),
        dimmedNodeIds: new Set(),
        goalThreshold: null,
        goalConstraints: [],
        viewMode: 'expert',
      })
    )
    return renderFactor(factorData)
  }

  it('renders the hover chip with a primitive number intervention (qualitative tier → percentage)', () => {
    mountWithHoveredOption(0.7, {
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, factor_type: 'quality' },
    })
    // Tier labels ("High", "Very high", …) are suppressed. Audit §8 P0-4:
    // the annotation now routes through the single formatter, so it shows
    // the same "70%" the option card's popover shows for this intervention
    // (previously the annotation said "Increases …" while the card said
    // "70%" — two statements for one datum).
    expect(screen.queryByText(/High/)).toBeNull()
    expect(screen.getByText('→ 70%')).toBeDefined()
  })

  it('unwraps a CEEInterventionV3 {value} object and renders the shared formatted value', () => {
    // Minimal V3 shape — extra fields (source, target_match) are irrelevant to the unwrap.
    mountWithHoveredOption({ value: 0.7 }, {
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, factor_type: 'quality' },
    })
    expect(screen.getByText('→ 70%')).toBeDefined()
    // Regression assertion: none of the pre-fix corrupt strings should appear anywhere.
    expect(screen.queryByText(/\[object Object\]/)).toBeNull()
    expect(screen.queryByText(/NaN/)).toBeNull()
  })

  it('unwraps a {value} object on the currency path without producing £NaN', () => {
    // Pre-fix, this combination produced "Intervention: £NaN" via
    // Math.round({...}).toLocaleString(). The unwrap + guard together must
    // render a valid currency string.
    mountWithHoveredOption({ value: 0.5 }, {
      label: 'Marketing Budget',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.1, raw_value: 5000, unit: '£', cap: 10000 },
    })
    expect(screen.queryByText(/£NaN/)).toBeNull()
    // Denormalised via raw_value/observedValue: 5000 × (0.5 / 0.1) = 25000.
    expect(screen.getByText('→ £25,000')).toBeDefined()
  })

  it('suppresses the hover chip entirely when the intervention entry is malformed', () => {
    mountWithHoveredOption({ source: 'brief_extraction' }, {
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, factor_type: 'quality' },
    })
    expect(screen.queryByText(/^Intervention:/)).toBeNull()
  })

  it('suppresses the hover chip when a primitive NaN is stored', () => {
    mountWithHoveredOption(NaN, {
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, factor_type: 'quality' },
    })
    expect(screen.queryByText(/^Intervention:/)).toBeNull()
  })

  it('renders CEE display_value verbatim on the hover chip, overriding placeholder-unit formatting', () => {
    // Scale-unit factor would normally fall back to directional language
    // ("Increases X"). With CEE-authored display_value present, render the
    // string verbatim — F.6 passthrough.
    mountWithHoveredOption({ value: 0.7, display_value: 'Top decile' }, {
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.3, unit: 'scale' },
    })
    expect(screen.getByText('→ Top decile')).toBeDefined()
    // UI-side fallbacks must not also render.
    expect(screen.queryByText(/Increases/)).toBeNull()
    expect(screen.queryByText(/scale/i)).toBeNull()
  })

  it('renders CEE display_value even when numeric value is null (displayValue-only intervention)', () => {
    // Regression guard: previously the hover useMemo returned null when
    // unwrapped.value was null, suppressing the chip entirely. A CEE record
    // like { value: null, display_value: "no change" } must still render.
    mountWithHoveredOption({ value: null, display_value: 'no change' }, {
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, factor_type: 'quality' },
    })
    expect(screen.getByText('→ no change')).toBeDefined()
  })

  // Polish 4 self-assessment fix #3: scale-unit factor with no raw_value
  // anchor used to render an empty value because formatInterventionValue
  // returns ''. The overlay must fall back to a direction-only cue.
  it('falls back to directional language for scale-unit factors with no raw anchor', () => {
    mountWithHoveredOption(0.7, {
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.3, unit: 'scale' },
    })
    // No "scale", no number — directional language only.
    expect(screen.queryByText(/scale/i)).toBeNull()
    expect(screen.queryByText(/0\.7/)).toBeNull()
    // intervention 0.7 > observed 0.3 + ε → "Increases <label>".
    expect(screen.getByText(/Increases/)).toBeDefined()
    // Never render a bare arrow with no trailing text.
    expect(screen.queryByText(/^→\s*$/)).toBeNull()
  })

  it('renders "Decreases" when intervention is below observed for scale unit', () => {
    mountWithHoveredOption(0.1, {
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, unit: 'scale' },
    })
    expect(screen.queryByText(/scale/i)).toBeNull()
    expect(screen.getByText(/Decreases/)).toBeDefined()
  })

  // ---- Placeholder-unit directional language (extracted helper) ----

  // Shared negative assertions for every placeholder-unit case: the teal strip
  // must never leak unit tokens, tier labels, or a bare arrow.
  const assertNoPlaceholderLeaks = (unitRegex: RegExp) => {
    expect(screen.queryAllByText(unitRegex)).toHaveLength(0)
    expect(screen.queryAllByText(/\b(Very high|Very low|High|Low|Medium|Moderate)\b/)).toHaveLength(0)
    expect(screen.queryAllByText(/^→\s*$/)).toHaveLength(0)
  }

  it('renders "Increases" for index-unit factor with intervention above baseline', () => {
    mountWithHoveredOption(0.9, {
      label: 'Team morale',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.2, unit: 'index' },
    })
    expect(screen.getByText(/Increases/)).toBeDefined()
    assertNoPlaceholderLeaks(/index/i)
  })

  it('renders "Decreases" for score-unit factor with intervention below baseline', () => {
    mountWithHoveredOption(0.1, {
      label: 'Churn risk',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.8, unit: 'score' },
    })
    expect(screen.getByText(/Decreases/)).toBeDefined()
    assertNoPlaceholderLeaks(/score/i)
  })

  it('says "Increases" for a small real shift (audit §8 P0-4 — no ±0.1 display epsilon)', () => {
    // The old ±0.1 epsilon rendered "Does not change" for 0.5→0.55 (and the
    // live 0.5→0.6 boundary case) while other surfaces showed a change.
    mountWithHoveredOption(0.55, {
      label: 'Process maturity',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, unit: 'scale' },
    })
    expect(screen.getByText(/Increases/)).toBeDefined()
    expect(screen.queryByText(/Does not change/)).toBeNull()
    assertNoPlaceholderLeaks(/scale/i)
  })

  it('renders "Does not change" ONLY when intervention exactly equals baseline (scale)', () => {
    mountWithHoveredOption(0.5, {
      label: 'Process maturity',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, unit: 'scale' },
    })
    expect(screen.getByText(/Does not change/)).toBeDefined()
    assertNoPlaceholderLeaks(/scale/i)
  })

  it('renders directional phrasing for norm-unit factor (full placeholder coverage)', () => {
    mountWithHoveredOption(0.8, {
      label: 'Product quality',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.2, unit: 'norm' },
    })
    expect(screen.getByText(/Increases/)).toBeDefined()
    assertNoPlaceholderLeaks(/norm/i)
  })

  it('strips scale metadata like "(0–1 scale)" from the directional label', () => {
    mountWithHoveredOption(0.9, {
      // Raw label still carries the CEE normalisation artefact — it must be
      // cleaned before being compacted into the teal strip text.
      label: 'Hiring rate (0–1 scale)',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.2, unit: 'scale' },
    })
    expect(screen.getByText(/Increases/)).toBeDefined()
    // The cleaned label ("Hiring rate") must appear; the parenthetical must not.
    expect(screen.queryByText(/0–1/)).toBeNull()
    expect(screen.queryByText(/\(.*scale.*\)/i)).toBeNull()
    assertNoPlaceholderLeaks(/\bscale\b/i)
  })

  it('preserves formatted value for currency-unit factor (non-placeholder path)', () => {
    mountWithHoveredOption({ value: 0.5 }, {
      label: 'Marketing Budget',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.1, raw_value: 5000, unit: '£', cap: 10000 },
    })
    expect(screen.getByText('→ £25,000')).toBeDefined()
    expect(screen.queryByText(/Increases/)).toBeNull()
  })

  it('renders nothing when baseline is null for a placeholder-unit factor', () => {
    mountWithHoveredOption(0.7, {
      label: 'Unknown scale thing',
      type: 'factor',
      category: 'controllable',
      observedState: { value: null, unit: 'scale' },
    })
    // No directional phrasing, no raw value, no bare arrow.
    expect(screen.queryByText(/Increases|Decreases|Does not change/)).toBeNull()
    expect(screen.queryByText(/^→/)).toBeNull()
  })

  it('renders nothing when the option does not intervene on this factor', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
      selector({
        hoveredOptionId: 'option-1',
        nodes: [
          // interventions map does not contain 'factor-1'
          { id: 'option-1', type: 'option', data: { interventions: { 'factor-other': 0.7 } } },
        ],
        edges: [],
        ceeAnalysisReady: null,
        results: { status: 'idle', report: null },
        highlightedNodes: new Set(),
        dimmedNodeIds: new Set(),
        goalThreshold: null,
        goalConstraints: [],
        viewMode: 'expert',
      })
    )
    renderFactor({
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.3, unit: 'scale' },
    })
    expect(screen.queryByText(/Increases|Decreases|Does not change/)).toBeNull()
    expect(screen.queryByText(/^→/)).toBeNull()
  })

  // Graph v1.1 Task 2: low-priority factors are visually quieted in Standard
  // view — the hover popover (ConnRows, BiasNote, coaching) is suppressed.
  // High-priority factors keep the popover.
  describe('low-priority Standard view popover', () => {
    it('does not render the popover at all for a low-priority factor in Standard view', () => {
      // Build a 5-factor graph where factor-1 (the rendered node) has no outbound
      // edges to outcomes/risks but factors 2..5 each connect to an outcome.
      // Pre-analysis ranking by structural centrality places factor-1 at rank 5
      // (low priority).
      vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
        selector({
          hoveredOptionId: null,
          nodes: [
            { id: 'factor-1', type: 'factor', data: { type: 'factor', label: 'Low priority' } },
            { id: 'factor-2', type: 'factor', data: { type: 'factor', label: 'F2' } },
            { id: 'factor-3', type: 'factor', data: { type: 'factor', label: 'F3' } },
            { id: 'factor-4', type: 'factor', data: { type: 'factor', label: 'F4' } },
            { id: 'factor-5', type: 'factor', data: { type: 'factor', label: 'F5' } },
            { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Outcome' } },
          ],
          edges: [
            { id: 'e2', source: 'factor-2', target: 'outcome-1', data: { weight: 1, direction: 'positive' } },
            { id: 'e3', source: 'factor-3', target: 'outcome-1', data: { weight: 1, direction: 'positive' } },
            { id: 'e4', source: 'factor-4', target: 'outcome-1', data: { weight: 1, direction: 'positive' } },
            { id: 'e5', source: 'factor-5', target: 'outcome-1', data: { weight: 1, direction: 'positive' } },
          ],
          ceeAnalysisReady: null,
          results: { status: 'idle', report: null },
          highlightedNodes: new Set(),
          dimmedNodeIds: new Set(),
          goalThreshold: null,
          goalConstraints: [],
          viewMode: 'standard',
        })
      )
      renderFactor({
        label: 'Low priority',
        type: 'factor',
        category: 'controllable',
        observedState: { value: 0.5 },
      })
      expect(screen.queryByTestId('factor-node-popover')).toBeNull()
    })

    it('does render the popover for a high-priority (top-3) factor in Standard view', () => {
      // Inverse topology: factor-1 has the only edge to the outcome → rank 1.
      vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
        selector({
          hoveredOptionId: null,
          nodes: [
            { id: 'factor-1', type: 'factor', data: { type: 'factor', label: 'High priority' } },
            { id: 'factor-2', type: 'factor', data: { type: 'factor', label: 'F2' } },
            { id: 'factor-3', type: 'factor', data: { type: 'factor', label: 'F3' } },
            { id: 'factor-4', type: 'factor', data: { type: 'factor', label: 'F4' } },
            { id: 'factor-5', type: 'factor', data: { type: 'factor', label: 'F5' } },
            { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Outcome' } },
          ],
          edges: [
            { id: 'e1', source: 'factor-1', target: 'outcome-1', data: { weight: 1, direction: 'positive' } },
          ],
          ceeAnalysisReady: null,
          results: { status: 'idle', report: null },
          highlightedNodes: new Set(),
          dimmedNodeIds: new Set(),
          goalThreshold: null,
          goalConstraints: [],
          viewMode: 'standard',
        })
      )
      renderFactor({
        label: 'High priority',
        type: 'factor',
        category: 'controllable',
        observedState: { value: 0.5 },
      })
      expect(screen.queryByTestId('factor-node-popover')).not.toBeNull()
    })
  })

  // Polish 4 review: regression test against popover-only chip drift. The
  // chip audit table allows max 2 chips per node in Standard view; the body
  // and the popover must not duplicate the same chip text.
  describe('chip audit drift guard', () => {
    it('top inferred factor renders "What evidence supports this?" exactly once across body + popover', () => {
      vi.mocked(useScienceIcons).mockReturnValue([])
      vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
        selector({
          hoveredOptionId: null,
          nodes: [
            { id: 'factor-1', type: 'factor', data: { type: 'factor', label: 'Hiring rate' } },
            { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Revenue' } },
          ],
          edges: [
            { id: 'e1', source: 'factor-1', target: 'outcome-1', data: { weight: 1, direction: 'positive' } },
          ],
          ceeAnalysisReady: null,
          results: { status: 'idle', report: null },
          highlightedNodes: new Set(),
          dimmedNodeIds: new Set(),
          goalThreshold: null,
          goalConstraints: [],
          viewMode: 'standard',
        })
      )
      renderFactor({
        label: 'Hiring rate',
        type: 'factor',
        category: 'controllable',
        observedState: { value: 0.5, extractionType: 'inferred' },
      })
      // Body chip is canonical; popover does not duplicate it.
      const matches = screen.getAllByText('What evidence supports this?')
      expect(matches.length).toBe(1)
    })
  })
})

// ─── Audit §8 P0-5: Detailed-view card containment ──────────────────────────
describe('FactorNode — connection list containment (audit §8 P0-5)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const fiveConnectionsState = {
    hoveredOptionId: null,
    nodes: [
      { id: 'o1', type: 'outcome', data: { label: 'Outcome One' } },
      { id: 'o2', type: 'outcome', data: { label: 'Outcome Two' } },
      { id: 'o3', type: 'outcome', data: { label: 'Outcome Three' } },
      { id: 'o4', type: 'outcome', data: { label: 'Outcome Four' } },
      { id: 'o5', type: 'outcome', data: { label: 'Outcome Five' } },
    ],
    edges: [
      { id: 'e1', source: 'factor-1', target: 'o1', data: { beliefExists: 0.9 } },
      { id: 'e2', source: 'factor-1', target: 'o2', data: { beliefExists: 0.8 } },
      { id: 'e3', source: 'factor-1', target: 'o3', data: { beliefExists: 0.7 } },
      { id: 'e4', source: 'factor-1', target: 'o4', data: { beliefExists: 0.6 } },
      { id: 'e5', source: 'factor-1', target: 'o5', data: { beliefExists: 0.5 } },
    ],
    ceeAnalysisReady: null,
    results: { status: 'complete', report: {} },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    goalThreshold: null,
    goalConstraints: [],
    viewMode: 'expert',
  }

  it('caps the "Influences:" list at 3 whole rows with "+N more in inspector"', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector: any) => selector(fiveConnectionsState))
    renderFactor({ label: 'Hiring rate', type: 'factor', observedState: { value: 0.5 } })
    // Top 3 by confidence render as whole rows…
    expect(screen.getAllByText('Outcome One').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Outcome Two').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Outcome Three').length).toBeGreaterThan(0)
    // …the 4th and 5th do not…
    expect(screen.queryByText('Outcome Four')).toBeNull()
    expect(screen.queryByText('Outcome Five')).toBeNull()
    // …and the remainder is disclosed with the correct count.
    expect(screen.getAllByText('+2 more in inspector').length).toBeGreaterThan(0)
  })

  it('shows no overflow line when 3 or fewer connections exist', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector: any) => selector({
      ...fiveConnectionsState,
      edges: fiveConnectionsState.edges.slice(0, 3),
    }))
    renderFactor({ label: 'Hiring rate', type: 'factor', observedState: { value: 0.5 } })
    expect(screen.getAllByText('Outcome One').length).toBeGreaterThan(0)
    expect(screen.queryByText(/more in inspector/)).toBeNull()
  })
})
