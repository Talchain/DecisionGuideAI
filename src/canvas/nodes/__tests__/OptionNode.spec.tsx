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
  // Partial store state: only layoutNodeWidth is read by OptionNode. The
  // double-cast confines the mock to that shape without exporting the
  // store's internal LayoutOptions type.
  useLayoutStore: vi.fn(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })) as unknown as (...args: never[]) => unknown),
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
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    vi.mocked(useLayoutStore).mockImplementation(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
      selector({ layoutNodeWidth: null })) as never)
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
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
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
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
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
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
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

  // Cross-surface parity: the badge follows the backend recommendation
  // (recommended_option_id) so it agrees with the Results Panel, which honours
  // it first. Win-max is only the fallback when no recommendation is sent.
  it('does not badge the win-max option when the backend recommends another (recommended_option_id wins)', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
      achievementProbability: null, stabilityPercentage: null, winRate: 0.72, isResultsMode: true,
      predictedOutcome: null, valueOfInformation: null, voiRank: null,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            option_probabilities: {
              'option-1': { win_probability: 0.72 },
              'option-2': { win_probability: 0.28 },
            },
            robustness: { recommended_option_id: 'option-2' },
          },
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'option-2', type: 'option', data: { type: 'option' } },
        ],
      }) as any)
    )
    // Rendered node is option-1 (the win-max leader) but the backend recommends option-2.
    renderOption()
    expect(screen.queryByText('Leading option')).toBeNull()
  })

  it('badges the recommended option even when it is not the win-max leader (recommended_option_id wins)', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
      achievementProbability: null, stabilityPercentage: null, winRate: 0.28, isResultsMode: true,
      predictedOutcome: null, valueOfInformation: null, voiRank: null,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            option_probabilities: {
              'option-1': { win_probability: 0.28 },
              'option-2': { win_probability: 0.72 },
            },
            robustness: { recommended_option_id: 'option-1' },
          },
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'option-2', type: 'option', data: { type: 'option' } },
        ],
      }) as any)
    )
    // Rendered node is option-1, recommended by the backend despite a lower win.
    renderOption()
    expect(screen.getByText('Leading option')).toBeDefined()
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
          // observedState.value provides the baseline so the from→to chip renders
          // (brief scope 7: a chip needs both a baseline and an intervention value).
          data: { label: 'Hiring rate (0–1 scale)', observedState: { unit: 'fraction', value: 0.2 } },
        }],
      }) as any)
    )
    renderOption()
    // cleanFactorLabel strips "(0–1 scale)", stripFactorSuffixes strips "rate"
    // from → to format: label and value live in separate spans.
    expect(screen.getAllByText('Hiring').length).toBeGreaterThan(0)
    // from → to chip: baseline 0.2 → intervention 0.6, both formatted as '%'.
    expect(screen.getByText((t: string) => t.includes('60%') && t.includes('→'))).toBeDefined()
  })

  // Float-cleanup: count-unit chip values denormalise to floats (0.804 × 20 =
  // 16.080000000000002). They must render as whole numbers with no artefact.
  it('renders count-unit chip values as whole numbers (no float artefact)', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{ id: 'option-1', interventions: { 'factor-1': 0.804 } }],
        },
        nodes: [{
          id: 'factor-1',
          data: { label: 'Developer Headcount', observedState: { unit: 'developers', value: 0.3, cap: 20 } },
        }],
      }) as any)
    )
    renderOption()
    // 0.3 × 20 = 6 baseline, 0.804 × 20 = 16.08… → rounded whole counts.
    expect(screen.getByText('6 developers → 16 developers')).toBeDefined()
    // No float-precision artefact leaks anywhere.
    expect(screen.queryByText((t: string) => t.includes('16.080'))).toBeNull()
  })

  // FTE is fractional by design — the count-rounding must NOT apply, so a
  // half-FTE intervention keeps its decimal (1.5 FTE, never "2 FTE").
  it('preserves fractional non-count units like FTE (no whole-number rounding)', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{ id: 'option-1', interventions: { 'factor-1': 0.15 } }],
        },
        nodes: [{
          id: 'factor-1',
          data: { label: 'Engineering Capacity', observedState: { unit: 'FTE', value: 0.1, cap: 10 } },
        }],
      }) as any)
    )
    renderOption()
    // 0.1 × 10 = 1 baseline, 0.15 × 10 = 1.5 → FTE keeps the fraction.
    expect(screen.getByText((t: string) => t.includes('1 FTE') && t.includes('1.5 FTE'))).toBeDefined()
    // It must NOT be rounded to a whole number.
    expect(screen.queryByText((t: string) => /\b2 FTE\b/.test(t))).toBeNull()
  })

  // Scope A: a binary factor (0→1) with CEE display labels on BOTH sides —
  // intervention display_value (target) AND the factor's own display_value
  // (baseline state) — renders the payload labels verbatim. Never the
  // "0% → 100%" numeric fallback, never an invented "No X" heuristic.
  it('renders payload display labels on both sides for a binary chip when present', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{ id: 'option-1', interventions: { 'factor-tl': { value: 1, display_value: 'Tech lead in place' } } }],
        },
        nodes: [{
          id: 'factor-tl',
          data: {
            label: 'Tech lead in place',
            display_value: 'No tech lead in place',
            observedState: { value: 0 },
          },
        }],
      }) as any)
    )
    renderOption()
    expect(screen.getByText('No tech lead in place → Tech lead in place')).toBeDefined()
    // Neither the numeric fallback nor an invented "… active" heuristic appears.
    expect(screen.queryByText((t: string) => t.includes('0%') && t.includes('100%'))).toBeNull()
  })

  // Scope A guard: a binary chip WITHOUT payload labels keeps its existing
  // numeric "0% → 100%" rendering — Scope A's label path must NOT fabricate a
  // target label. (This mirrors the reported Hiring case: factor_type is set,
  // so the legacy value-only heuristic is suppressed and both sides are %.)
  it('keeps numeric 0% → 100% for a binary chip when payload labels are absent (never invents a target label)', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{ id: 'option-1', interventions: { 'factor-tl': 1 } }],
        },
        nodes: [{
          id: 'factor-tl',
          data: { label: 'Tech lead in place', observedState: { value: 0, factor_type: 'quality' } },
        }],
      }) as any)
    )
    renderOption()
    expect(screen.getByText((t: string) => t.includes('0%') && t.includes('100%') && t.includes('→'))).toBeDefined()
    // Scope A's both-labels branch did NOT fire: no fabricated target label.
    expect(screen.queryByText((t: string) => t.includes('→ Tech lead in place'))).toBeNull()
  })

  // Scope A edge case (Codex review): a 1 → 0 binary REVERSAL (removing the
  // factor) renders the baseline (value=1) label → target (value=0) label, in
  // that order, from the payload.
  it('renders both payload labels in order for a 1 → 0 binary reversal', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{ id: 'option-1', interventions: { 'factor-tl': { value: 0, display_value: 'No tech lead in place' } } }],
        },
        nodes: [{
          id: 'factor-tl',
          data: {
            label: 'Tech lead in place',
            display_value: 'Tech lead in place', // factor observed at value=1 (baseline)
            observedState: { value: 1 },
          },
        }],
      }) as any)
    )
    renderOption()
    expect(screen.getByText('Tech lead in place → No tech lead in place')).toBeDefined()
  })

  // Scope A edge case (Codex review): the baseline label may live under
  // observedState.display_value (legacy/in-flight shape) rather than top-level.
  // readFactorDisplayValue honours both, so the chip still renders labels.
  it('reads the baseline label from observedState.display_value when top-level is absent', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{ id: 'option-1', interventions: { 'factor-tl': { value: 1, display_value: 'Tech lead in place' } } }],
        },
        nodes: [{
          id: 'factor-tl',
          data: {
            label: 'Tech lead in place',
            // No top-level display_value — only nested in observedState.
            observedState: { value: 0, display_value: 'No tech lead in place' },
          },
        }],
      }) as any)
    )
    renderOption()
    expect(screen.getByText('No tech lead in place → Tech lead in place')).toBeDefined()
  })

  it('has displayName set', () => {
    expect(OptionNode.displayName).toBe('OptionNode')
  })

  // P1-4: layoutNodeWidth propagation — OptionNode must not override layoutNodeWidth
  // with a hardcoded maxWidth prop, so the store-driven width governs BaseNode sizing.
  it('P1-4: OptionNode respects layoutNodeWidth from store (no hardcoded 238px override)', () => {
    vi.mocked(useLayoutStore).mockImplementation(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
      selector({ layoutNodeWidth: 180 })) as never)
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
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
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
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
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
  // Rendered via the post-analysis Detailed "What this option changes:" list —
  // the pre-analysis Detailed "Interventions:" list was removed as a duplicate
  // of the delta pills (audit §8 P1).
  it('shows percentage for qualitative factor (no unit, factor_type "quality")', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
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
        results: { status: 'complete', report: {} },
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
        results: { status: 'complete', report: {} },
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

  it('renders CEE display_value verbatim on intervention chip, overriding numeric formatting', () => {
    // A value of 0.5 with unit="fraction" would normally render "50%". The
    // CEE-provided display_value must win over the numeric formatter.
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': { value: 0.5, display_value: 'Doubled capacity' } },
          }],
        },
        nodes: [{
          id: 'factor-1',
          data: { label: 'Capacity', observedState: { unit: 'fraction' } },
        }],
      }) as any)
    )
    renderOption()
    expect(screen.getByText('Doubled capacity')).toBeDefined()
    // The numeric fallback must NOT also render.
    expect(screen.queryByText('50%')).toBeNull()
  })

  it('falls back to numeric formatting when display_value is absent (precedence gate)', () => {
    // Same shape as the verbatim test but without display_value — proves the
    // new gate does not break the legacy formatter path.
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': { value: 0.5 } },
          }],
        },
        nodes: [{
          id: 'factor-1',
          data: { label: 'Capacity', observedState: { unit: 'fraction' } },
        }],
      }) as any)
    )
    renderOption()
    expect(screen.getByText('50%')).toBeDefined()
  })

  it('suppresses (+X%) delta when target chip has CEE display_value (scale-mismatch guard)', () => {
    // Post-analysis: non-baseline option with displayValue. Previously the
    // delta block would render "50% → Doubled capacity (+70.0%)" — a numeric
    // delta paired with a qualitative string. The delta must be suppressed.
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.7,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: { option_probabilities: { 'option-1': { win_probability: 0.7 } } },
        },
        ceeAnalysisReady: {
          options: [
            { id: 'option-1', interventions: { 'factor-1': { value: 0.85, display_value: 'Doubled capacity' } } },
            // Baseline option so baselineOptionInterventions resolves to 0.5
            { id: 'option-baseline', interventions: { 'factor-1': 0.5 } },
          ],
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'option-baseline', type: 'option', data: { type: 'option', is_baseline: true, label: 'Baseline' } },
          { id: 'factor-1', data: { label: 'Capacity', observedState: { unit: 'fraction', value: 0.5 } } },
        ],
      }) as any)
    )
    renderOption()
    // Verbatim displayValue renders...
    expect(screen.getByText('Doubled capacity')).toBeDefined()
    // ...and the delta arrow with percentage does NOT.
    expect(screen.queryByText(/\(\+/)).toBeNull()
    expect(screen.queryByText(/→.*\(\+\d/)).toBeNull()
  })

  it('passthrough: displayValue is NOT mutated by stripEcho when it starts with the factor label (post-analysis intervention list)', () => {
    // stripEcho rewrites "Engineers added 5" → "added 5" when the factor
    // label is "Engineers". This is a UI heuristic — it must be bypassed
    // for CEE-authored display_value per F.6 passthrough.
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.7,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: { option_probabilities: { 'option-1': { win_probability: 0.7 } } },
        },
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': { value: 0.8, display_value: 'Engineers added 5' } },
          }],
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'factor-1', data: { label: 'Engineers', observedState: { unit: 'fraction', value: 0.2 } } },
        ],
      }) as any)
    )
    renderOption()
    // Verbatim CEE string must appear intact — including the leading word
    // that matches the factor label.
    expect(screen.getByText('Engineers added 5')).toBeDefined()
    // Must NOT be rewritten to the stripped form.
    expect(screen.queryByText('added 5')).toBeNull()
  })

  it('passthrough: displayValue is NOT mutated by stripEcho in Detailed inline list', () => {
    // Detailed view (viewMode='expert', post-analysis, !isBaseline) routes
    // through the Layer 2 inline "What this option changes:" list (the
    // pre-analysis "Interventions:" duplicate was removed — audit §8 P1).
    // Must bypass stripEcho for the CEE string.
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        viewMode: 'expert',
        results: { status: 'complete', report: {} },
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': { value: 0.8, display_value: 'Headcount raised to 12' } },
          }],
        },
        nodes: [{
          id: 'factor-1',
          data: { label: 'Headcount', observedState: { unit: 'fraction', value: 0.2 } },
        }],
      }) as any)
    )
    renderOption()
    // The Detailed inline list renders "Interventions:" header + each chip.
    // At least one rendering of the verbatim string must appear.
    const matches = screen.getAllByText('Headcount raised to 12')
    expect(matches.length).toBeGreaterThan(0)
    // Stripped form must NOT appear.
    expect(screen.queryByText(/^raised to 12$/)).toBeNull()
  })

  it('differentiator sentence renders CEE display_value verbatim for shared-factor options', () => {
    // Two non-baseline options both intervening on the same factor with
    // distinct display_values. Phase 3 de-disambiguation should use the
    // verbatim CEE string rather than fabricating a tier label from the
    // scale-unit factor (which would produce "Very high" / "Very low").
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        viewMode: 'standard', // differentiator line shows in Standard pre-analysis
        ceeAnalysisReady: {
          options: [
            { id: 'option-1', interventions: { 'factor-1': { value: 0.9, display_value: 'Best in class' } } },
            { id: 'option-2', interventions: { 'factor-1': { value: 0.1, display_value: 'Barely adequate' } } },
          ],
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option', label: 'Premium' } },
          { id: 'option-2', type: 'option', data: { type: 'option', label: 'Budget' } },
          { id: 'factor-1', type: 'factor', data: { label: 'Quality', observedState: { unit: 'scale', value: 0.5 } } },
        ],
      }) as any)
    )
    renderOption()
    // Differentiator sentence uses compactFactorLabel → "→ Best in class"
    expect(screen.getByText(/Best in class/)).toBeDefined()
    // Must NOT fabricate a tier label.
    expect(screen.queryByText(/Very high/)).toBeNull()
    expect(screen.queryByText(/^High$/)).toBeNull()
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
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
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
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
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
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
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
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
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

  // V3: Intervention details render in expert overlay without chip styling.
  // Post-analysis Detailed list ("What this option changes:") — the
  // pre-analysis "Interventions:" duplicate was removed (audit §8 P1).
  it('intervention details in expert overlay have no chip styling (P1)', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.6,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
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
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    const { container } = renderOption()
    const bar = container.querySelector('.bg-option.rounded-full') as HTMLElement | null
    expect(bar).not.toBeNull()
    expect(bar?.style.width).toBe('max(4px, 2%)')
  })

  // ROADMAP 1.49 — the "chance of target" badge must use the SAME
  // goal_probability / probability_of_joint_goal fallback as
  // useResultsSectionData (consumed by OptionCards/hero/GoalNode), not a
  // narrower goal_probability-only read. On a constrained-goal run where
  // ISL/PLoT populate probability_of_joint_goal but NOT goal_probability
  // (constraint_analysis present with constraints — the joint figure IS the
  // number every other surface shows), the badge must still render using
  // that joint value rather than silently disappearing.
  it('shows "chance of target" badge from probability_of_joint_goal when goal_probability is absent (constrained-goal run)', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.5,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        goalThreshold: 0.6, // UI-SEM-082: a user target is set so the badge renders
        results: {
          status: 'complete',
          report: {
            option_probabilities: {
              'option-1': {
                confidence: 0.5,
                win_probability: 0.5,
                probability_of_joint_goal: 0.05,
                constraint_analysis: { constraints: [{ id: 'c1' }], joint_probability: 0.05 },
              },
            },
          },
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
        ],
      }) as any)
    )
    renderOption()
    // 5% < 10% threshold → the warning line renders with the joint value,
    // matching what OptionCards/hero derive via useResultsSectionData.
    expect(screen.getByText(/5% chance of target\./)).toBeDefined()
  })

  // Lane 4 fold (UI-SEM-082, extends UI-SEM-071): the "chance of target" badge
  // is a goal-fit claim — it must gate on the USER target. Without a target the
  // producer still returns a joint/goal probability (auto_goal_threshold), and
  // the panel twin OptionCards already suppresses this (hasGoalThreshold). The
  // canvas node must match, or it contradicts the GoalNode beside it (which
  // suppresses its own "chance of reaching target" when no target is set).
  it('SUPPRESSES the "chance of target" badge when the user set no target (auto-threshold)', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      achievementProbabilityIsModelledBasis: false,
      stabilityPercentage: null,
      winRate: 0.5,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        goalThreshold: null, // the user set no target
        results: {
          status: 'complete',
          report: {
            option_probabilities: {
              'option-1': {
                confidence: 0.5,
                win_probability: 0.5,
                probability_of_joint_goal: 0.05,
                constraint_analysis: { constraints: [{ id: 'c1' }], joint_probability: 0.05 },
              },
            },
          },
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
        ],
      }) as any)
    )
    renderOption()
    // No target → the goal-fit badge must not render (matches GoalNode + OptionCards).
    expect(screen.queryByText(/chance of target\./)).toBeNull()
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
    vi.mocked(useLayoutStore).mockImplementation(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
      selector({ layoutNodeWidth: null })) as never)
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
        results: { status: 'complete', report: {} },
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
        results: { status: 'complete', report: {} },
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

    // Self-assessment fix #4: scale-unit factor with cap (so the deltaDisplay
    // path is reached) used to render " → ()" because both formatChipValue
    // calls returned empty strings. The deltaDisplay must only build when
    // both sides produced meaningful output.
    it('does not render a broken " → ()" delta when both formatChipValue calls are empty', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          ceeAnalysisReady: {
            options: [
              { id: 'option-1', interventions: { 'factor-1': 0.7 } },
              { id: 'option-2', interventions: { 'factor-1': 0.3 } },
            ],
          },
          nodes: [
            { id: 'option-1', type: 'option', data: { label: 'Aggressive', type: 'option' } },
            { id: 'option-2', type: 'option', data: { label: 'Conservative', type: 'option' } },
            {
              id: 'factor-1',
              type: 'factor',
              data: {
                label: 'Marketing Expertise',
                // cap=10 means inferInterventionScaleBase returns 10, the
                // deltaDisplay code path activates, but both chip values
                // collapse to '' because of the meaningless-unit suppression.
                observedState: { unit: 'scale', value: 0.5, cap: 10 },
              },
            },
          ],
          viewMode: 'expert',
        }) as any),
      )
      renderOption({ label: 'Aggressive' })
      // No empty parentheses, no orphan arrow.
      expect(screen.queryByText(/→ \(/)).toBeNull()
      expect(screen.queryByText(/\(\)/)).toBeNull()
      expect(screen.queryByText(/→ \s*$/)).toBeNull()
    })
  })

  // Self-assessment fix #5: differentiator must NOT fire when other options
  // simply omit a factor that this option holds at the observed baseline.
  describe('Polish 4 review: differentiator uses observed baseline as fallback', () => {
    it('does not flag a factor when this option intervenes at the observed baseline and others omit it', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          ceeAnalysisReady: {
            options: [
              // Option A intervenes on factor-1 at 0.7 (matches observed value).
              // Option B and C omit factor-1 entirely.
              { id: 'option-1', interventions: { 'factor-1': 0.7 } },
              { id: 'option-2', interventions: {} },
              { id: 'option-3', interventions: {} },
            ],
          },
          nodes: [
            { id: 'option-1', type: 'option', data: { label: 'Hold', type: 'option' } },
            { id: 'option-2', type: 'option', data: { label: 'Other A', type: 'option' } },
            { id: 'option-3', type: 'option', data: { label: 'Other B', type: 'option' } },
            {
              id: 'factor-1',
              type: 'factor',
              data: {
                label: 'Headcount',
                // Observed baseline = 0.7 — same as Option A's intervention.
                // The pre-fix code would compute avgOthers=0 and falsely
                // flag a 0.7 differentiator. Post-fix uses 0.7 baseline so
                // diff = 0 → no differentiator.
                observedState: { unit: 'engineers', value: 0.7, raw_value: 7, cap: 10 },
              },
            },
          ],
          // Differentiator only renders in Standard view.
          viewMode: 'standard',
        }) as any),
      )
      renderOption({ label: 'Hold' })
      expect(screen.queryByText(/key difference/i)).toBeNull()
    })

    it('still flags a factor when this option diverges from the observed baseline', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          ceeAnalysisReady: {
            options: [
              // Option A pushes factor-1 to 0.9 — far above the observed
              // baseline of 0.3, while Option B leaves it at 0.3.
              { id: 'option-1', interventions: { 'factor-1': 0.9 } },
              { id: 'option-2', interventions: {} },
            ],
          },
          nodes: [
            { id: 'option-1', type: 'option', data: { label: 'Aggressive', type: 'option' } },
            { id: 'option-2', type: 'option', data: { label: 'Hold', type: 'option' } },
            {
              id: 'factor-1',
              type: 'factor',
              data: {
                label: 'Headcount',
                observedState: { unit: 'engineers', value: 0.3, raw_value: 3, cap: 10 },
              },
            },
          ],
          viewMode: 'standard',
        }) as any),
      )
      renderOption({ label: 'Aggressive' })
      // diff = |0.9 - 0.3| = 0.6 > 0.1 threshold → differentiator fires.
      expect(screen.getByText(/key difference/i)).toBeDefined()
    })
  })

  // Graph v2: differentiator deduplication — when 2+ options share the same
  // top factor, the label includes the formatted value to disambiguate.
  describe('Graph v2: differentiator deduplication', () => {
    it('shows different differentiator text when two options share the same factor at different values', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          ceeAnalysisReady: {
            options: [
              // Both options intervene on factor-1 but at different values.
              { id: 'option-1', interventions: { 'factor-1': 0.9 } },
              { id: 'option-2', interventions: { 'factor-1': 0.1 } },
            ],
          },
          nodes: [
            { id: 'option-1', type: 'option', data: { label: 'Hire Tech Lead', type: 'option' } },
            { id: 'option-2', type: 'option', data: { label: 'Hire Developers', type: 'option' } },
            {
              id: 'factor-1',
              type: 'factor',
              data: {
                label: 'Tech Lead Hired',
                observedState: { unit: '%', value: 0.5, raw_value: 50, cap: 100 },
              },
            },
          ],
          viewMode: 'standard',
        }) as any),
      )
      renderOption({ label: 'Hire Tech Lead' })
      // Shared factor → option-1 at 0.9 on a % factor → "90%". Brief scope 7:
      // the from→to chip already shows that value (e.g. "50% → 90%"), so the
      // duplicate differentiator footer is dropped — the disambiguating value
      // lives in the chip, not a repeated <p>.
      const valueChip = screen.getByText((t: string) => t.includes('90%') && t.includes('→'))
      expect(valueChip).toBeDefined()
      // No separate differentiator <p> repeating the same value.
      const matches = screen.getAllByText(/tech lead hired/i)
      expect(matches.find(el => el.tagName === 'P')).toBeUndefined()
    })

    it('suppresses differentiator when two options share same factor with identical values', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          ceeAnalysisReady: {
            options: [
              // Both options intervene on factor-1 at the same value
              { id: 'option-1', interventions: { 'factor-1': 0.9 } },
              { id: 'option-2', interventions: { 'factor-1': 0.9 } },
            ],
          },
          nodes: [
            { id: 'option-1', type: 'option', data: { label: 'Option A', type: 'option' } },
            { id: 'option-2', type: 'option', data: { label: 'Option B', type: 'option' } },
            {
              id: 'factor-1',
              type: 'factor',
              data: {
                label: 'Tech Lead Hired',
                observedState: { unit: '%', value: 0.5, raw_value: 50, cap: 100 },
              },
            },
          ],
          viewMode: 'standard',
        }) as any),
      )
      renderOption({ label: 'Option A' })
      // Both options produce identical differentiator text → suppressed.
      // The chip may still show the factor name, but no differentiator <p> should exist.
      expect(screen.queryByText(/key difference/i)).toBeNull()
      const matches = screen.queryAllByText(/tech lead hired/i)
      const differentiatorP = matches.find(el => el.tagName === 'P')
      expect(differentiatorP).toBeUndefined()
    })

    it('uses directional language (not tier labels) when shared factor is a scale unit', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          ceeAnalysisReady: {
            options: [
              // Both options intervene on a scale factor (no raw_value) at different values
              { id: 'option-1', interventions: { 'factor-1': 0.9 } },
              { id: 'option-2', interventions: { 'factor-1': 0.1 } },
            ],
          },
          nodes: [
            { id: 'option-1', type: 'option', data: { label: 'Aggressive', type: 'option' } },
            { id: 'option-2', type: 'option', data: { label: 'Conservative', type: 'option' } },
            {
              id: 'factor-1',
              type: 'factor',
              data: {
                label: 'Marketing Expertise',
                // scale unit, no raw_value → meaningless without anchor;
                // differentiator should use directional language against baseline.
                observedState: { unit: 'scale', value: 0.5 },
              },
            },
          ],
          viewMode: 'standard',
        }) as any),
      )
      renderOption({ label: 'Aggressive' })
      // option-1 has value 0.9, baseline 0.5 → "Increases Marketing expertise"
      const matches = screen.queryAllByText(/marketing expertise/i)
      const differentiatorP = matches.find(el => el.tagName === 'P')
      expect(differentiatorP).toBeDefined()
      expect(differentiatorP!.textContent).toMatch(/^Increases /)
      // Negative assertions: no tier labels, no "scale" unit leaking through.
      expect(differentiatorP!.textContent).not.toMatch(/\b(Very high|Very low|Moderate)\b/)
      expect(differentiatorP!.textContent).not.toContain('→')
      expect(differentiatorP!.textContent!.toLowerCase()).not.toContain('scale')
    })

    it('says "Increases" for a small real shift (0.05) — "Does not change" needs exact equality', () => {
      // Audit §8 P0-4: the old ±0.1 display epsilon rendered "Does not
      // change" for genuinely different values (0.5→0.55, and the live
      // 0.5→0.6 boundary case). The single formatter reserves "Does not
      // change" for exact equality only.
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          ceeAnalysisReady: {
            options: [
              // Option A sits 0.05 above baseline — a real change;
              // Option B is far below. Shared factor → differentiator fires
              // for A via the neutral branch.
              { id: 'option-1', interventions: { 'factor-1': 0.55 } },
              { id: 'option-2', interventions: { 'factor-1': 0.1 } },
            ],
          },
          nodes: [
            { id: 'option-1', type: 'option', data: { label: 'Hold Steady', type: 'option' } },
            { id: 'option-2', type: 'option', data: { label: 'Cut Back', type: 'option' } },
            {
              id: 'factor-1',
              type: 'factor',
              data: {
                label: 'Marketing Expertise',
                observedState: { unit: 'scale', value: 0.5 },
              },
            },
          ],
          viewMode: 'standard',
        }) as any),
      )
      renderOption({ label: 'Hold Steady' })
      const matches = screen.queryAllByText(/marketing expertise/i)
      const differentiatorP = matches.find(el => el.tagName === 'P')
      expect(differentiatorP).toBeDefined()
      expect(differentiatorP!.textContent).toMatch(/^Increases /)
    })

    it('uses "Does not change" ONLY when the intervention exactly equals the baseline', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          ceeAnalysisReady: {
            options: [
              // Option A matches the baseline exactly; Option B is far below.
              { id: 'option-1', interventions: { 'factor-1': 0.5 } },
              { id: 'option-2', interventions: { 'factor-1': 0.1 } },
            ],
          },
          nodes: [
            { id: 'option-1', type: 'option', data: { label: 'Hold Steady', type: 'option' } },
            { id: 'option-2', type: 'option', data: { label: 'Cut Back', type: 'option' } },
            {
              id: 'factor-1',
              type: 'factor',
              data: {
                label: 'Marketing Expertise',
                observedState: { unit: 'scale', value: 0.5 },
              },
            },
          ],
          viewMode: 'standard',
        }) as any),
      )
      renderOption({ label: 'Hold Steady' })
      const matches = screen.queryAllByText(/marketing expertise/i)
      const differentiatorP = matches.find(el => el.tagName === 'P')
      expect(differentiatorP).toBeDefined()
      expect(differentiatorP!.textContent).toMatch(/^Does not change /)
    })

    it('uses "Decreases" when scale-unit intervention is below baseline', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          ceeAnalysisReady: {
            options: [
              { id: 'option-1', interventions: { 'factor-1': 0.1 } },
              { id: 'option-2', interventions: { 'factor-1': 0.9 } },
            ],
          },
          nodes: [
            { id: 'option-1', type: 'option', data: { label: 'Cut Back', type: 'option' } },
            { id: 'option-2', type: 'option', data: { label: 'Invest', type: 'option' } },
            {
              id: 'factor-1',
              type: 'factor',
              data: {
                label: 'Marketing Expertise',
                observedState: { unit: 'scale', value: 0.5 },
              },
            },
          ],
          viewMode: 'standard',
        }) as any),
      )
      renderOption({ label: 'Cut Back' })
      // option-1 has value 0.1, baseline 0.5 → "Decreases Marketing expertise"
      const matches = screen.queryAllByText(/marketing expertise/i)
      const differentiatorP = matches.find(el => el.tagName === 'P')
      expect(differentiatorP).toBeDefined()
      expect(differentiatorP!.textContent).toMatch(/^Decreases /)
      // Negative assertions: no tier labels, no "scale" unit leaking through.
      expect(differentiatorP!.textContent).not.toMatch(/\b(Very high|Very low|High|Low|Moderate)\b/)
      expect(differentiatorP!.textContent!.toLowerCase()).not.toContain('scale')
    })

    it('shows unique differentiator without value when factor is not shared', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          ceeAnalysisReady: {
            options: [
              // Each option intervenes on a different factor
              { id: 'option-1', interventions: { 'factor-1': 0.9 } },
              { id: 'option-2', interventions: { 'factor-2': 0.9 } },
            ],
          },
          nodes: [
            { id: 'option-1', type: 'option', data: { label: 'Option A', type: 'option' } },
            { id: 'option-2', type: 'option', data: { label: 'Option B', type: 'option' } },
            {
              id: 'factor-1',
              type: 'factor',
              data: {
                label: 'Headcount',
                observedState: { unit: 'engineers', value: 0.3, raw_value: 3, cap: 10 },
              },
            },
            {
              id: 'factor-2',
              type: 'factor',
              data: {
                label: 'Budget',
                observedState: { unit: '£', value: 0.5, raw_value: 50000, cap: 100000 },
              },
            },
          ],
          viewMode: 'standard',
        }) as any),
      )
      renderOption({ label: 'Option A' })
      // Unique factor → "Headcount is the key difference" (simple sentence)
      expect(screen.getByText(/headcount is the key difference/i)).toBeDefined()
    })
  })
})

// ─── Graph coaching audit §8 (P0-4/P0-5/P1) — display coherence ─────────────
describe('OptionNode — display coherence (audit §8)', () => {
  const resultsMetadata = (winRate: number | null) => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    achievementProbabilityIsModelledBasis: false,
    stabilityPercentage: null,
    winRate,
    isResultsMode: true,
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as any))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(null))
    vi.mocked(useLayoutStore).mockImplementation(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
      selector({ layoutNodeWidth: null })) as never)
  })

  // Item 3a: duplicate win-rate phrasing removed from the status-quo card
  it('status-quo card renders "win probability" once and never "win rate across simulations"', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(0.28))
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
      }) as any)
    )
    renderOption({ label: 'Status Quo', is_baseline: true })
    expect(screen.getByText('28% win probability')).toBeDefined()
    expect(screen.queryByText(/win rate across simulations/i)).toBeNull()
    expect(screen.getByText('Current baseline. No changes to factors.')).toBeDefined()
  })

  // Item 3c: identical "Behind:" reasons on multiple non-leading options are
  // suppressed on all of them (non-differentiating copy)
  it('suppresses "Behind:" when another non-leading option shares the identical reason', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(0.2))
    const report = {
      robustness: { recommended_option_id: 'option-3' },
      option_probabilities: {
        'option-1': { win_probability: 0.2 },
        'option-2': { win_probability: 0.2 },
        'option-3': { win_probability: 0.6 },
      },
      // No factor_sensitivity → both losers would read "fewer key changes"
    }
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report },
        nodes: [
          { id: 'option-1', type: 'option', data: { label: 'Option A', type: 'option' } },
          { id: 'option-2', type: 'option', data: { label: 'Option B', type: 'option' } },
          { id: 'option-3', type: 'option', data: { label: 'Option C', type: 'option' } },
        ],
      }) as any)
    )
    renderOption({ label: 'Option A' })
    expect(screen.queryByText(/Behind:/)).toBeNull()
  })

  it('keeps "Behind:" when the reason differs from the other non-leading option', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(0.2))
    const report = {
      robustness: { recommended_option_id: 'option-3' },
      option_probabilities: {
        'option-1': { win_probability: 0.2 },
        'option-2': { win_probability: 0.2 },
        'option-3': { win_probability: 0.6 },
      },
    }
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report },
        nodes: [
          { id: 'option-1', type: 'option', data: { label: 'Option A', type: 'option' } },
          // Sibling loser is the baseline → its reason is "no changes from
          // current state", which differs from option-1's "fewer key changes".
          { id: 'option-2', type: 'option', data: { label: 'Status Quo', type: 'option', is_baseline: true } },
          { id: 'option-3', type: 'option', data: { label: 'Option C', type: 'option' } },
        ],
      }) as any)
    )
    renderOption({ label: 'Option A' })
    expect(screen.getByText(/Behind: fewer key changes/)).toBeDefined()
  })

  // P0-2 (external review 2026-07-14): the loser's "Behind:" top factor must be
  // ranked via the SHARED policy off CERTIFIED factor_sensitivity — not off the
  // untyped enrichment passthrough, and not by a chain that omits `sensitivity`.
  it('ranks the "Behind:" factor off certified factor_sensitivity via the shared policy, not enrichment', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(0.2))
    const report = {
      robustness: { recommended_option_id: 'option-3' },
      option_probabilities: {
        'option-1': { win_probability: 0.2 },
        'option-3': { win_probability: 0.6 },
      },
      // Certified magnitude lives ONLY under `sensitivity` (the V5 shape); the
      // winner intervenes on certA. The untyped enrichment names a DIFFERENT
      // factor (enrX) with a larger importance_score — it must NOT win.
      factor_sensitivity: [
        { factor_id: 'certA', sensitivity: 0.8 },
        { factor_id: 'certB', sensitivity: 0.2 },
      ],
      enrichment: { sensitivity_analysis: { factors: [{ factor_id: 'enrX', importance_score: 0.9 }] } },
    }
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report },
        ceeAnalysisReady: {
          options: [
            { id: 'option-3', interventions: { certA: 0.5 } },
            { id: 'option-1', interventions: {} },
          ],
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { label: 'Option A', type: 'option' } },
          // Baseline sibling → its reason differs, so option-1's reason is not suppressed.
          { id: 'option-2', type: 'option', data: { label: 'Status Quo', type: 'option', is_baseline: true } },
          { id: 'option-3', type: 'option', data: { label: 'Option C', type: 'option' } },
          { id: 'certA', type: 'factor', data: { label: 'Budget' } },
          { id: 'enrX', type: 'factor', data: { label: 'Marketing' } },
        ],
      }) as any)
    )
    renderOption({ label: 'Option A' })
    // Names certA (certified, sensitivity-ranked #1). RED before the fix:
    // enrichment ranked first → enrX, which the winner doesn't intervene on →
    // "Behind: fewer key changes".
    expect(screen.getByText(/Behind: no budget added/i)).toBeDefined()
    expect(screen.queryByText(/marketing/i)).toBeNull()
  })

  // Item 6: stale treatment on result decorations
  it('marks win-probability block and Leading badge stale when the graph changed since the run', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(0.72))
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          graphHash: 'hash-at-run',
          report: { option_probabilities: { 'option-1': { win_probability: 0.72 }, 'option-2': { win_probability: 0.2 } } },
        },
        _internal: { graphHash: 'hash-now-different' },
        nodes: [
          { id: 'option-1', type: 'option', data: { label: 'Option A', type: 'option' } },
          { id: 'option-2', type: 'option', data: { label: 'Option B', type: 'option' } },
        ],
      }) as any)
    )
    const { container } = renderOption({ label: 'Option A' })
    const staleEls = container.querySelectorAll('[data-stale="true"]')
    expect(staleEls.length).toBeGreaterThanOrEqual(2) // win-prob block + badge
    const winProbBlock = screen.getByText('72% win probability').closest('[data-stale="true"]')
    expect(winProbBlock).not.toBeNull()
    expect(winProbBlock!.getAttribute('title')).toBe('Model changed since this analysis')
    expect(winProbBlock!.className).toContain('opacity-50')
    const badge = screen.getByText('Leading option')
    expect(badge.getAttribute('data-stale')).toBe('true')
  })

  it('does not mark decorations stale when hashes match', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(0.72))
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', graphHash: 'same-hash', report: {} },
        _internal: { graphHash: 'same-hash' },
      }) as any)
    )
    const { container } = renderOption()
    expect(container.querySelectorAll('[data-stale="true"]').length).toBe(0)
  })

  // Item 7: per-option intervention list containment
  it('caps the "What this option changes:" list at 3 rows with "+N more in inspector"', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(0.5))
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: {
              'factor-1': 0.9,
              'factor-2': 0.8,
              'factor-3': 0.7,
              'factor-4': 0.6,
              'factor-5': 0.55,
            },
          }],
        },
        nodes: [
          { id: 'factor-1', data: { label: 'Alpha', observedState: { unit: 'fraction' } } },
          { id: 'factor-2', data: { label: 'Bravo', observedState: { unit: 'fraction' } } },
          { id: 'factor-3', data: { label: 'Charlie', observedState: { unit: 'fraction' } } },
          { id: 'factor-4', data: { label: 'Delta', observedState: { unit: 'fraction' } } },
          { id: 'factor-5', data: { label: 'Echo', observedState: { unit: 'fraction' } } },
        ],
      }) as any)
    )
    renderOption()
    // Exactly the top-3 rows render, whole (labels visible)…
    expect(screen.getByText('Alpha')).toBeDefined()
    expect(screen.getByText('Bravo')).toBeDefined()
    expect(screen.getByText('Charlie')).toBeDefined()
    // …the 4th and 5th do not…
    expect(screen.queryByText('Delta')).toBeNull()
    expect(screen.queryByText('Echo')).toBeNull()
    // …and the overflow line reports the correct remainder.
    expect(screen.getByText('+2 more in inspector')).toBeDefined()
  })

  it('shows no overflow line when 3 or fewer interventions exist', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue(resultsMetadata(0.5))
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': 0.9, 'factor-2': 0.8 },
          }],
        },
        nodes: [
          { id: 'factor-1', data: { label: 'Alpha', observedState: { unit: 'fraction' } } },
          { id: 'factor-2', data: { label: 'Bravo', observedState: { unit: 'fraction' } } },
        ],
      }) as any)
    )
    renderOption()
    expect(screen.getByText('Alpha')).toBeDefined()
    expect(screen.getByText('Bravo')).toBeDefined()
    expect(screen.queryByText(/more in inspector/)).toBeNull()
  })

  // Item 3b: Detailed pre-analysis no longer duplicates pills with an
  // "Interventions:" list
  it('Detailed pre-analysis card renders delta pills without a duplicate "Interventions:" list', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
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
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        viewMode: 'expert',
        ceeAnalysisReady: {
          options: [{ id: 'option-1', interventions: { 'factor-1': 0.8 } }],
        },
        nodes: [
          { id: 'factor-1', data: { label: 'Budget', observedState: { unit: 'fraction', value: 0.4 } } },
        ],
      }) as any)
    )
    renderOption()
    // Pills render the from→to data…
    expect(screen.getByText('40% → 80%')).toBeDefined()
    // …and the duplicated inline list is gone.
    expect(screen.queryByText('Interventions:')).toBeNull()
  })

  it('Wave 4 / §6.4: renders the identity-anchored stable option number badge when registered', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({ optionNumbering: { 'option-1': 2 } }) as any),
    )
    renderOption()
    const badge = screen.getByTestId('option-stable-number-option-1')
    expect(badge).toHaveTextContent('2')
    expect(badge).toHaveAttribute('aria-label', 'Option 2')
  })

  it('renders no stable-number badge before the option is registered', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({ optionNumbering: {} }) as any),
    )
    renderOption()
    expect(screen.queryByTestId('option-stable-number-option-1')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Lane 2 — winsVia honesty (live 2026-07-13 contradiction): the leader node
// claimed "Leads via Design Change Scope, the #1 driver" while the SAME
// screen's drivers panel ranked that factor 4th at 17% (real #1: Pricing
// Page Clarity, 100%). winsVia ranked by raw elasticity, option-scoped —
// then asserted a GLOBAL rank. It must rank via the shared display policy
// and only claim "#1 driver" when the chosen factor IS the policy's #1.
// ---------------------------------------------------------------------------

describe('OptionNode — winsVia ranks via the display policy and never overclaims (Lane 2)', () => {
  const FACTOR_NODES = [
    { id: 'fac_clarity', type: 'factor', data: { label: 'Pricing Page Clarity', type: 'factor' } },
    { id: 'fac_scope', type: 'factor', data: { label: 'Design Change Scope', type: 'factor' } },
    { id: 'option-1', type: 'option', data: { label: 'Keep Current Page', type: 'option' } },
    { id: 'option-2', type: 'option', data: { label: 'Full Redesign', type: 'option' } },
  ]

  const winsViaState = (opts: {
    factors: unknown[]
    interventions: Record<string, number>
  }) =>
    makeStoreState({
      nodes: FACTOR_NODES,
      results: {
        status: 'complete',
        report: {
          robustness: { recommended_option_id: 'option-1' },
          option_probabilities: {
            'option-1': { win_probability: 0.54 },
            'option-2': { win_probability: 0.45 },
          },
          factor_sensitivity: opts.factors,
        },
      },
      ceeAnalysisReady: {
        goal_node_id: 'goal_1',
        options: [
          { id: 'option-1', label: 'Keep Current Page', interventions: opts.interventions },
          { id: 'option-2', label: 'Full Redesign', interventions: {} },
        ],
      },
    })

  const mountLeader = (state: ReturnType<typeof makeStoreState>) => {
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(state as any))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.54,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    } as never)
    renderOption()
  }

  it('does NOT claim "#1 driver" when the leader\'s lever is not the policy #1 (live repro)', () => {
    mountLeader(
      winsViaState({
        factors: [
          // Complete producer coverage: policy adopts influence_score.
          // Global #1 = fac_clarity (1.0); the leader only intervenes on
          // fac_scope (0.17, rank 4-ish).
          { factor_id: 'fac_clarity', influence_score: 1.0, elasticity: 0.9 },
          { factor_id: 'fac_scope', influence_score: 0.17, elasticity: 0.93 },
        ],
        interventions: { fac_scope: 0 },
      }),
    )
    expect(screen.getByText(/Leads via/)).toBeInTheDocument()
    expect(screen.getByText('Design Change Scope')).toBeInTheDocument()
    expect(screen.queryByText(/the #1 driver/)).toBeNull()
    expect(screen.getByText(/its biggest lever/)).toBeInTheDocument()
  })

  it('claims "#1 driver" only when the lever IS the policy #1', () => {
    mountLeader(
      winsViaState({
        factors: [
          { factor_id: 'fac_clarity', influence_score: 1.0, elasticity: 0.9 },
          { factor_id: 'fac_scope', influence_score: 0.17, elasticity: 0.93 },
        ],
        interventions: { fac_clarity: 1 },
      }),
    )
    expect(screen.getByText('Pricing Page Clarity')).toBeInTheDocument()
    expect(screen.getByText(/the #1 driver/)).toBeInTheDocument()
  })

  it('ranks candidate levers by the POLICY value, not raw elasticity', () => {
    mountLeader(
      winsViaState({
        factors: [
          // Complete coverage: policy = influence_score. Raw elasticity
          // order is scope > clarity (0.93 > 0.9) — the OLD code picked by
          // that and would choose fac_scope; the policy picks fac_clarity.
          { factor_id: 'fac_clarity', influence_score: 1.0, elasticity: 0.9 },
          { factor_id: 'fac_scope', influence_score: 0.17, elasticity: 0.93 },
        ],
        interventions: { fac_clarity: 1, fac_scope: 0 },
      }),
    )
    expect(screen.getByText('Pricing Page Clarity')).toBeInTheDocument()
    expect(screen.queryByText('Design Change Scope')).toBeNull()
  })
})
