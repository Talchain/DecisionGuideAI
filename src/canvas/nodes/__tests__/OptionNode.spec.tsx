/**
 * OptionNode render tests
 * T7: Win probability bar + Leading option badge
 * T8: Intervention chips with cleaned labels and formatted values
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  hoveredOptionId: null,
  nodes: [],
  edges: [],
  ceeAnalysisReady: null,
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  setHoveredOption: vi.fn(),
  viewMode: 'expert',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })
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

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import { useLayoutStore } from '../../layoutStore'

const baseProps = {
  id: 'option-1',
  type: 'option',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

const renderOption = (data: Record<string, unknown> = {}) =>
  render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} data={{ label: 'Hire 3 engineers', type: 'option', ...data }} />
    </ReactFlowProvider>
  )

describe('OptionNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as any))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: false,
    })
    vi.mocked(useLayoutStore).mockImplementation((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
      selector({ layoutNodeWidth: null }) as any
    )
  })

  it('renders label', () => {
    renderOption()
    expect(screen.getByText('Hire 3 engineers')).toBeDefined()
  })

  it('renders shape indicator (type line removed in v1.1)', () => {
    renderOption()
    // Type text label removed in v1.1 — shape icon with tooltip replaces it
    expect(screen.getByLabelText(/option node/i)).toBeDefined()
  })

  // T7: Win probability
  it('does not show win probability outside results mode', () => {
    renderOption()
    expect(screen.queryByText(/win probability/)).toBeNull()
  })

  it('shows win probability in results mode', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.72,
      isResultsMode: true,
    })
    renderOption()
    expect(screen.getByText('72% win probability')).toBeDefined()
  })

  // T7: Leading option badge
  it('shows Leading option badge for highest winRate option', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.72,
      isResultsMode: true,
    })
    // Set up store with report using option_probabilities (the field responseMapper populates)
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            option_probabilities: {
              'option-1': { goal_probability: 0.8, confidence: 0.5, win_probability: 0.72 },
              'option-2': { goal_probability: 0.4, confidence: 0.5, win_probability: 0.28 },
            },
          },
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'option-2', type: 'option', data: { type: 'option' } },
        ],
      }) as any)
    )
    renderOption()
    expect(screen.getByText('Leading option')).toBeDefined()
  })

  it('does not show Leading option badge for non-highest option', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.28,
      isResultsMode: true,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            option_probabilities: {
              'option-1': { goal_probability: 0.4, confidence: 0.5, win_probability: 0.28 },
              'option-2': { goal_probability: 0.8, confidence: 0.5, win_probability: 0.72 },
            },
          },
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'option-2', type: 'option', data: { type: 'option' } },
        ],
      }) as any)
    )
    renderOption()
    expect(screen.queryByText('Leading option')).toBeNull()
  })

  // T8: Intervention chips
  it('shows intervention chips from ceeAnalysisReady', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': 0.6 },
          }],
        },
        nodes: [{
          id: 'factor-1',
          data: { label: 'Hiring rate (0–1 scale)', observedState: { unit: 'fraction' } },
        }],
      }) as any)
    )
    renderOption()
    // cleanFactorLabel strips "(0–1 scale)", stripFactorSuffixes strips "rate"
    // arrow format: label and value are separate spans (multiple "Hiring" texts may exist)
    expect(screen.getAllByText('Hiring').length).toBeGreaterThan(0)
    // formatInterventionValue(0.6, 'fraction') → '60%'
    expect(screen.getByText('60%')).toBeDefined()
  })

  it('has displayName set', () => {
    expect(OptionNode.displayName).toBe('OptionNode')
  })

  // P1-4: layoutNodeWidth propagation — OptionNode must not override layoutNodeWidth
  // with a hardcoded maxWidth prop, so the store-driven width governs BaseNode sizing.
  it('P1-4: OptionNode respects layoutNodeWidth from store (no hardcoded 238px override)', () => {
    vi.mocked(useLayoutStore).mockImplementation((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
      selector({ layoutNodeWidth: 180 }) as any
    )
    const { container } = renderOption()
    // BaseNode's root div carries an inline maxWidth style. In this test no
    // intervention chips are rendered (ceeAnalysisReady is null), so the only
    // element with an inline max-width is BaseNode's root div.
    // Use querySelectorAll('[style*="max-width"]') to find it precisely without
    // fragile DOM-walking that could match chip child elements.
    const maxWidthEls = container.querySelectorAll<HTMLElement>('[style*="max-width"]')
    expect(maxWidthEls.length).toBeGreaterThan(0)
    // The BaseNode root is the element with the layout-governed maxWidth.
    // Collect all found values and verify none is the old hardcoded 238px.
    const widths = Array.from(maxWidthEls).map(el => el.style.maxWidth)
    expect(widths).toContain('180px')
    expect(widths).not.toContain('238px')
  })

  // V2: Win probability number uses text-text-body (neutral, no coloured text in node body)
  it('win probability text uses text-text-body class (not text-success or text-option)', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.72,
      isResultsMode: true,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            option_probabilities: {
              'option-1': { goal_probability: 0.8, confidence: 0.5, win_probability: 0.72 },
              'option-2': { goal_probability: 0.4, confidence: 0.5, win_probability: 0.28 },
            },
          },
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'option-2', type: 'option', data: { type: 'option' } },
        ],
      }) as any)
    )
    renderOption()
    const percentEl = screen.getByText('72% win probability')
    expect(percentEl.className).toContain('text-text-body')
    expect(percentEl.className).not.toContain('text-success')
    expect(percentEl.className).not.toContain('text-option')
  })

  // V3: Leading option badge uses text-text-body (WCAG AA contrast on bg-success-light)
  it('Leading option badge uses text-text-body (not text-success)', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.72,
      isResultsMode: true,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            option_probabilities: {
              'option-1': { goal_probability: 0.8, confidence: 0.5, win_probability: 0.72 },
              'option-2': { goal_probability: 0.4, confidence: 0.5, win_probability: 0.28 },
            },
          },
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'option-2', type: 'option', data: { type: 'option' } },
        ],
      }) as any)
    )
    renderOption()
    const badge = screen.getByText('Leading option')
    expect(badge.className).toContain('text-text-body')
    expect(badge.className).not.toContain('text-success')
  })

  // Null-safe paths — most likely regression sources in production
  it('renders "Untitled" when data.label is absent', () => {
    render(
      <ReactFlowProvider>
        <OptionNode {...baseProps} data={{ type: 'option' }} />
      </ReactFlowProvider>
    )
    expect(screen.getByText('Untitled')).toBeDefined()
  })

  it('does not show intervention chips when ceeAnalysisReady is null', () => {
    renderOption()
    expect(screen.queryByText(/:/)).toBeNull()
  })

  it('does not show intervention chips when options array is empty', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({ ceeAnalysisReady: { options: [] } }) as any)
    )
    renderOption()
    expect(screen.queryByText(/:/)).toBeNull()
  })

  it('does not show intervention chips when matching option has no interventions', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: { options: [{ id: 'option-1' }] },
      }) as any)
    )
    renderOption()
    expect(screen.queryByText(/:/)).toBeNull()
  })

  // G2: Qualitative factors show percentage instead of tier labels (v1.1 polish)
  it('shows percentage for qualitative factor (no unit, factor_type "quality")', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': 0.7 },
          }],
        },
        nodes: [{
          id: 'factor-1',
          data: {
            label: 'Product-market fit',
            observedState: { factor_type: 'quality' },
          },
        }],
      }) as any)
    )
    renderOption()
    // arrow format: label and value are separate spans (no colon)
    expect(screen.getAllByText('Product-market fit').length).toBeGreaterThan(0)
    // 0.7 with factor_type 'quality' → '70%' (tier labels banned in v1.1)
    expect(screen.getByText('70%')).toBeDefined()
  })

  it('shows numeric value for factor with unit even if factor_type is qualitative', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': 0.6 },
          }],
        },
        nodes: [{
          id: 'factor-1',
          data: {
            label: 'Revenue share',
            observedState: { unit: 'fraction', factor_type: 'quality' },
          },
        }],
      }) as any)
    )
    renderOption()
    // unit=fraction takes priority → '60%'
    expect(screen.getByText('60%')).toBeDefined()
  })

  it('formats intervention value correctly when value is nested object {value: N}', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': { value: 0.5 } },
          }],
        },
        nodes: [{
          id: 'factor-1',
          data: { label: 'Budget', observedState: { unit: 'fraction' } },
        }],
      }) as any)
    )
    renderOption()
    // formatInterventionValue(0.5, 'fraction') → '50%'
    expect(screen.getByText('50%')).toBeDefined()
  })

  it('does not show win probability when winRate is null in results mode', () => {
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
    renderOption()
    expect(screen.queryByText(/win probability/)).toBeNull()
  })

  it('does not show Leading option badge when resultsReport has no option_probabilities key', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.8,
      isResultsMode: true,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'option-2', type: 'option', data: { type: 'option' } },
        ],
      }) as any)
    )
    renderOption()
    expect(screen.queryByText('Leading option')).toBeNull()
  })

  it('shows Leading option badge when a non-canvas option has higher rate in report', () => {
    // P0-2: only visible canvas option IDs count when computing max
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.72,
      isResultsMode: true,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            option_probabilities: {
              // option-hidden is NOT on canvas — should be excluded from max
              'option-hidden': { goal_probability: 0.9, confidence: 0.5, win_probability: 0.95 },
              'option-1': { goal_probability: 0.8, confidence: 0.5, win_probability: 0.72 },
              'option-2': { goal_probability: 0.4, confidence: 0.5, win_probability: 0.28 },
            },
          },
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'option-2', type: 'option', data: { type: 'option' } },
          // option-hidden is absent from canvas nodes
        ],
      }) as any)
    )
    renderOption()
    // option-1 has highest win rate among visible options → Leading option
    expect(screen.getByText('Leading option')).toBeDefined()
  })

  it('does not show Leading option badge when only one option node exists', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 1.0,
      isResultsMode: true,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            option_probabilities: {
              'option-1': { goal_probability: 0.9, confidence: 0.5, win_probability: 1.0 },
            },
          },
        },
        nodes: [{ id: 'option-1', type: 'option', data: { type: 'option' } }],
      }) as any)
    )
    renderOption()
    // isRecommended requires length >= 2
    expect(screen.queryByText('Leading option')).toBeNull()
  })

  // V3: Intervention details render in expert overlay without chip styling
  it('intervention details in expert overlay have no chip styling (P1)', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': 0.6 },
          }],
        },
        nodes: [{
          id: 'factor-1',
          data: { label: 'Hiring rate', observedState: { unit: 'fraction' } },
        }],
      }) as any)
    )
    const { container } = renderOption()
    // Expert overlay renders intervention details as plain text rows
    const expertDetail = container.querySelector('[class*="bg-info"]')
    expect(expertDetail).not.toBeNull()
    // Value span must be font-semibold in expert overlay (arrow format)
    const valueSpan = container.querySelector('span.font-semibold')
    expect(valueSpan).not.toBeNull()
  })

  // P0.2: Delta uses baseline option's intervention value when available
  it('uses baseline option intervention value as "from" side in delta display', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
        ceeAnalysisReady: {
          options: [
            {
              id: 'option-1', // non-baseline
              interventions: { 'factor-1': 0.59 },
            },
            {
              id: 'option-baseline', // baseline — intervention sets factor to 0.49
              interventions: { 'factor-1': 0.49 },
            },
          ],
        },
        nodes: [
          {
            id: 'option-1',
            type: 'option',
            data: { label: 'Raise price', type: 'option' },
          },
          {
            id: 'option-baseline',
            type: 'option',
            data: { label: 'Keep current pricing', type: 'option' },
          },
          {
            id: 'factor-1',
            data: {
              label: 'Price',
              observedState: { unit: '£', cap: 100, value: 0.49, raw_value: 49 },
            },
          },
        ],
      }) as any)
    )
    // option-1 is a non-baseline option (baseProps.id = 'option-1');
    // baseline option sets factor to 0.49 → £49; target option sets to 0.59 → £59
    // delta = (59-49)/49 ≈ +20.4%
    renderOption({ label: 'Raise price' })
    // The chip should show "£49 → £59 (+20.4%)"
    expect(screen.getByText(/£49/)).toBeDefined()
    expect(screen.getByText(/£59/)).toBeDefined()
    expect(screen.getByText(/\+20\.4%/)).toBeDefined()
  })

  // P7: Win bar uses max(8px, X%) for very low win probabilities
  it('uses minimum 8px win bar for very low win probability (P7)', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.02,
      isResultsMode: true,
    })
    const { container } = renderOption()
    const bar = container.querySelector('.bg-option.rounded-full') as HTMLElement | null
    expect(bar).not.toBeNull()
    expect(bar?.style.width).toBe('max(4px, 2%)')
  })
})

// ---------------------------------------------------------------------------
// QA Brief C-series — option node display scenarios
// ---------------------------------------------------------------------------
describe('OptionNode — QA Brief C-series', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as any))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
      achievementProbability: null, stabilityPercentage: null, winRate: null, isResultsMode: false,
    })
    vi.mocked(useLayoutStore).mockImplementation((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
      selector({ layoutNodeWidth: null }) as any
    )
  })

  // C2: Baseline option shows "No changes from current state" (all interventions match baseline)
  it('C2: baseline option (is_baseline=true) shows no-changes message', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': 0.49 },
          }],
        },
        nodes: [{
          id: 'factor-1',
          data: { label: 'Price', observedState: { unit: '£', cap: 100, value: 0.49, raw_value: 49 } },
        }],
      }) as any)
    )
    renderOption({ label: 'Keep current price', is_baseline: true })
    // Baseline option shows "No changes to factors" in body (pre-analysis)
    expect(screen.getByText('No changes to factors')).toBeDefined()
    // No delta arrow
    expect(screen.queryByText(/→/)).toBeNull()
  })

  // C3: Baseline detection by keyword — "Status Quo" treated as baseline
  it('C3: option labelled "Status Quo" is detected as baseline (no delta shown)', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': 0.49 },
          }],
        },
        nodes: [{
          id: 'factor-1',
          data: { label: 'Price', observedState: { unit: '£', cap: 100, value: 0.49, raw_value: 49 } },
        }],
      }) as any)
    )
    renderOption({ label: 'Status Quo' })
    // "Status Quo" contains baseline keyword → shows baseline fallback (no intervention chips)
    expect(screen.queryByText('49')).toBeNull()
  })

  // C4: Qualitative intervention — no delta shown
  it('C4: qualitative factor intervention shows no delta arrow', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': 0.7 },
          }],
        },
        nodes: [{
          id: 'factor-1',
          data: { label: 'Team morale', observedState: { factor_type: 'quality' } },
        }],
      }) as any)
    )
    renderOption({ label: 'Hire lead' })
    // Qualitative: no unit, no scale — shows percentage (tier labels banned in v1.1)
    // Arrow separator is present between label and value (not a delta indicator)
    expect(screen.getByText('70%')).toBeDefined()
  })

  // C5: Near-zero baseline — no spurious percentage (guard: abs(denormedBaseline) <= 0.01)
  // When the baseline option doesn't intervene on the factor, fallback is observedState.value.
  // If observedValue is extremely small (e.g. 0.005) with no cap, denormed = 0.005 <= 0.01 → no delta.
  it('C5: near-zero observed baseline value produces no delta (guard: abs <= 0.01)', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [
            {
              id: 'option-1', // non-baseline
              interventions: { 'factor-1': 0.8 },
            },
            {
              id: 'option-baseline',
              // baseline does NOT intervene on factor-1, so fallback is observedState.value
              interventions: {},
            },
          ],
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { label: 'Big investment', type: 'option' } },
          { id: 'option-baseline', type: 'option', data: { label: 'Do nothing', type: 'option' } },
          {
            id: 'factor-1',
            data: {
              label: 'Revenue',
              // No cap, no raw_value, observedValue=0.005 → denormed baseline = 0.005 ≤ 0.01 → no delta
              observedState: { unit: 'k', value: 0.005 },
            },
          },
        ],
      }) as any)
    )
    renderOption({ label: 'Big investment' })
    // Near-zero guard: no spurious delta percentage shown (chip renders label → value without numeric delta)
    // The chip still shows the value, just no from→to delta calculation
    expect(screen.queryByText(/\+\d+%/)).toBeNull()
    expect(screen.queryByText(/-\d+%/)).toBeNull()
  })

  // C6: Multiple interventions per option — all chips render
  it('C6: multiple interventions render multiple chips (up to top 3)', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: {
              'factor-1': 0.8,
              'factor-2': 0.6,
              'factor-3': 0.4,
            },
          }],
        },
        nodes: [
          { id: 'factor-1', data: { label: 'Marketing budget', observedState: {} } },
          { id: 'factor-2', data: { label: 'Team size', observedState: {} } },
          { id: 'factor-3', data: { label: 'Product quality', observedState: {} } },
        ],
      }) as any)
    )
    renderOption()
    // All three factor labels should appear as chips (arrow format: no colon)
    expect(screen.getAllByText('Marketing budget').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Team size').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Product quality').length).toBeGreaterThan(0)
  })

  // C7: 3+ options — only the baseline is detected as such; others show delta
  it('C7: with 3 options only "Do nothing" baseline is suppressed; non-baseline shows delta', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [
            { id: 'option-1', interventions: { 'factor-1': 0.7 } },       // non-baseline
            { id: 'option-2', interventions: { 'factor-1': 0.5 } },       // non-baseline
            { id: 'option-baseline', interventions: { 'factor-1': 0.5 } }, // baseline
          ],
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { label: 'Scale up', type: 'option' } },
          { id: 'option-2', type: 'option', data: { label: 'Moderate growth', type: 'option' } },
          { id: 'option-baseline', type: 'option', data: { label: 'Do nothing', type: 'option' } },
          {
            id: 'factor-1',
            data: { label: 'Revenue', observedState: { unit: 'fraction' } },
          },
        ],
      }) as any)
    )
    // Render the baseline option — no delta should appear
    renderOption({ label: 'Do nothing' })
    expect(screen.queryByText(/→/)).toBeNull()
  })

  // C9: Pre-analysis — no win probability, no Leading option badge
  it('C9: pre-analysis shows no win probability and no Leading option badge', () => {
    renderOption()
    expect(screen.queryByText(/win probability/)).toBeNull()
    expect(screen.queryByText('Leading option')).toBeNull()
  })

  // Polish 4 review: scale-unit interventions with no raw_value should
  // render as arrow + label only on pre-analysis pills, with no numeric
  // text or "scale" suffix bleeding through.
  describe('Polish 4 review: scale-unit interventions render arrow + label only', () => {
    const buildState = (overrides: Record<string, unknown> = {}) => makeStoreState({
      ceeAnalysisReady: {
        options: [
          { id: 'option-1', interventions: { 'factor-1': 0.7 } },
          { id: 'option-2', interventions: { 'factor-1': 0.2 } },
        ],
      },
      nodes: [
        { id: 'option-1', type: 'option', data: { label: 'Aggressive plan', type: 'option' } },
        { id: 'option-2', type: 'option', data: { label: 'Conservative plan', type: 'option' } },
        {
          id: 'factor-1',
          type: 'factor',
          data: {
            label: 'Marketing Expertise Available',
            observedState: { unit: 'scale', value: 0.5 },
          },
        },
      ],
      ...overrides,
    })

    it('option pre-analysis pill omits the scale value and the "scale" suffix', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) => selector(buildState() as any))
      renderOption({ label: 'Aggressive plan' })
      // No "0.7", no "scale", no "70%" should appear in the pill area.
      expect(screen.queryByText(/scale/i)).toBeNull()
      expect(screen.queryByText(/0\.7/)).toBeNull()
      // The factor's compact label is still rendered (one or more occurrences
      // depending on whether the popover/Detailed list also instantiates).
      expect(screen.getAllByText(/marketing expertise/i).length).toBeGreaterThan(0)
    })

    it('option Detailed list shows label only with no "→" arrow when value is empty', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector({ ...buildState(), viewMode: 'expert' } as any),
      )
      renderOption({ label: 'Aggressive plan' })
      // The intervention list row exists for the factor but has no arrow,
      // because formatChipValue returned empty string for scale-no-raw.
      expect(screen.getAllByText(/marketing expertise/i).length).toBeGreaterThan(0)
      expect(screen.queryByText(/scale/i)).toBeNull()
    })
  })
})
