/**
 * OptionNode render tests
 * T7: Win probability bar + Recommended badge
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
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
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
  })

  it('renders label', () => {
    renderOption()
    expect(screen.getByText('Hire 3 engineers')).toBeDefined()
  })

  it('shows type label as "Option" (sentence-case)', () => {
    renderOption()
    expect(screen.getByText('Option')).toBeDefined()
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
    expect(screen.getByText('72%')).toBeDefined()
    expect(screen.getByText('win probability')).toBeDefined()
  })

  // T7: Recommended badge
  it('shows Recommended badge for highest winRate option', () => {
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
    expect(screen.getByText('Recommended')).toBeDefined()
  })

  it('does not show Recommended badge for non-highest option', () => {
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
    expect(screen.queryByText('Recommended')).toBeNull()
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
    // cleanFactorLabel strips "(0–1 scale)"
    expect(screen.getByText('Hiring rate:')).toBeDefined()
    // formatInterventionValue(0.6, 'fraction') → '60%'
    expect(screen.getByText('60%')).toBeDefined()
  })

  it('has displayName set', () => {
    expect(OptionNode.displayName).toBe('OptionNode')
  })

  // V2: Win probability number always uses text-option regardless of position
  it('win probability text uses text-option class (not text-success)', () => {
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
    const percentEl = screen.getByText('72%')
    expect(percentEl.className).toContain('text-option')
    expect(percentEl.className).not.toContain('text-success')
  })

  // V3: Recommended badge uses text-text-body (WCAG AA contrast on bg-success-light)
  it('Recommended badge uses text-text-body (not text-success)', () => {
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
    const badge = screen.getByText('Recommended')
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

  // G2: Qualitative tier labels for no-unit qualitative factors
  it('shows tier label for qualitative factor (no unit, factor_type "quality")', () => {
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
    expect(screen.getByText('Product-market fit:')).toBeDefined()
    // 0.7 with factor_type 'quality' → 'High'
    expect(screen.getByText('High')).toBeDefined()
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

  it('does not show Recommended badge when resultsReport has no option_probabilities key', () => {
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
    expect(screen.queryByText('Recommended')).toBeNull()
  })

  it('shows Recommended badge when a non-canvas option has higher rate in report', () => {
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
    // option-1 has highest win rate among visible options → Recommended
    expect(screen.getByText('Recommended')).toBeDefined()
  })

  it('does not show Recommended badge when only one option node exists', () => {
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
    expect(screen.queryByText('Recommended')).toBeNull()
  })

  // P1: Intervention chip rows must have no background/padding/rounded (chip style removed)
  it('intervention chip rows have no background, padding, or rounded classes (P1)', () => {
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
    // Find all chip row divs by their known class (items-baseline from the chip div)
    const chipRows = Array.from(container.querySelectorAll('div.inline-flex.items-baseline'))
    expect(chipRows.length).toBeGreaterThan(0)
    chipRows.forEach(row => {
      // Must not have background, padding, or rounded classes from old chip style
      expect(row.className).not.toMatch(/\bbg-factor/)
      expect(row.className).not.toMatch(/\bpx-/)
      expect(row.className).not.toMatch(/\bpy-/)
      expect(row.className).not.toMatch(/\brounded/)
    })
    // Value span must be font-semibold
    const valueSpan = container.querySelector('span.font-semibold')
    expect(valueSpan).not.toBeNull()
  })

  // P0.2: Delta uses baseline option's intervention value when available
  it('uses baseline option intervention value as "from" side in delta display', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
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
    expect(bar?.style.width).toBe('max(8px, 2%)')
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
  })

  // C2: Baseline option shows absolute value, no delta
  it('C2: baseline option (is_baseline=true) shows absolute value without delta arrow', () => {
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
    // For baseline, no delta arrow should be shown
    expect(screen.queryByText(/→/)).toBeNull()
    // Absolute value should be shown
    expect(screen.getByText('£49')).toBeDefined()
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
    // "Status Quo" contains baseline keyword → no delta
    expect(screen.queryByText(/→/)).toBeNull()
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
    // Qualitative: no unit, no scale — shows tier label, no delta
    expect(screen.getByText('High')).toBeDefined()
    expect(screen.queryByText(/→/)).toBeNull()
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
    // Delta arrow must not appear — near-zero guard prevents spurious % calculation
    expect(screen.queryByText(/→/)).toBeNull()
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
    // All three factor labels should appear as chips
    expect(screen.getByText('Marketing budget:')).toBeDefined()
    expect(screen.getByText('Team size:')).toBeDefined()
    expect(screen.getByText('Product quality:')).toBeDefined()
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

  // C9: Pre-analysis — no win probability, no recommended badge
  it('C9: pre-analysis shows no win probability and no Recommended badge', () => {
    renderOption()
    expect(screen.queryByText(/win probability/)).toBeNull()
    expect(screen.queryByText('Recommended')).toBeNull()
  })
})
