/**
 * FactorNode — once the user has stated a value for an external factor, the
 * card must stop presenting the drafted range as live.
 *
 * The owner's rule is pinned in
 * `shared/__tests__/factorPriorRange.userValueReplacesRange.spec.ts`; this file
 * pins the CARD, because the card is where the defect was on screen: the
 * user's value AND `Range: 0.3 to 0.8`, a range PLoT skips whenever
 * `observed_state.value` is present (`translator-v3.ts`
 * `buildParameterUncertaintiesV3`, read at PLoT staging 5039cca4).
 *
 * Bound by IDENTITY — the factor's own id in the line's test id, and the exact
 * text — so a sibling line that happened to contain the same numbers cannot
 * satisfy it. Every case has its no-user-value twin, which must render
 * byte-for-byte what it rendered before.
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

vi.mock('../../hooks/useScienceIcons', () => ({
  useScienceIcons: vi.fn(() => []),
}))

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="factor-node-popover">{children}</div>
  ),
}))

// `importOriginal`-spread, never a hand-listed factory: a factory REPLACES the
// module, and any export this import graph reaches would go missing.
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    isGraphBadgesEnabled: vi.fn(() => false),
    isCrossHighlightEnabled: vi.fn(() => false),
    isGraphLensEnabled: vi.fn(() => false),
  }
})

const FACTOR_ID = 'fac_market_demand'
const REPLACED = 'Your value replaces the range 0.3 to 0.8'
const LIVE = 'Range: 0.3 to 0.8'

const baseProps = {
  id: FACTOR_ID,
  type: 'factor',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

const renderFactor = (observedState: Record<string, unknown> | undefined) =>
  render(
    <ReactFlowProvider>
      <FactorNode
        {...baseProps}
        data={{
          label: 'Market Demand',
          type: 'factor',
          category: 'external',
          prior: { distribution: 'uniform', range_min: 0.3, range_max: 0.8 },
          ...(observedState === undefined ? {} : { observedState }),
        }}
      />
    </ReactFlowProvider>
  )

describe('FactorNode — a user-stated value replaces the drafted range on the card', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('user_override value: the card shows the value and says the range is replaced, never "Range:"', () => {
    const { container } = renderFactor({ value: 0.55, source: 'user_override' })
    const text = container.textContent ?? ''
    // Behaviour first, so a RED names the defect rather than a missing hook.
    expect(text).toContain(REPLACED)
    expect(text).not.toContain(LIVE)
    expect(text).not.toContain('Range:')
    // …then identity: the line is THIS factor's range line, with exactly this text.
    expect(screen.getByTestId(`factor-prior-range-${FACTOR_ID}`).textContent).toBe(REPLACED)
    // The user's value is still the value the card states.
    expect(screen.getByTestId('factor-recorded-value').textContent).toContain('0.55')
  })

  it('TWIN — no observed value: the card renders the live range exactly as before', () => {
    const { container } = renderFactor(undefined)
    const text = container.textContent ?? ''
    expect(text).toContain(LIVE)
    expect(text).not.toContain('replaces')
    expect(screen.getByTestId(`factor-prior-range-${FACTOR_ID}`).textContent).toBe(LIVE)
  })

  it('TWIN — a model-authored value (cee_inference) is not the user\'s: unchanged', () => {
    const { container } = renderFactor({ value: 0.55, source: 'cee_inference', extractionType: 'inferred' })
    const text = container.textContent ?? ''
    expect(text).toContain(LIVE)
    expect(text).not.toContain('replaces')
  })
})
