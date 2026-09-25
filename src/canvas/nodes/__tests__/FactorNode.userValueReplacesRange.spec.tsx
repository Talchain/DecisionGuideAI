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
import { VALUE_SOURCE_MARK_LABEL, VALUE_SOURCE_MARK_TOKEN } from '../shared/valueSourceMark'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

/**
 * The view and run status are read at CALL time, so the design-integration
 * cases below can drive the locked Standard face after a run; every original
 * case keeps the Detailed / pre-run state it was written against.
 */
let mockViewMode: 'expert' | 'standard' = 'expert'
let mockResultsStatus: 'idle' | 'complete' = 'idle'
vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) =>
    selector({
      hoveredOptionId: null,
      nodes: [],
      edges: [],
      ceeAnalysisReady: null,
      results: { status: mockResultsStatus, report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      goalThreshold: null,
      goalConstraints: [],
      viewMode: mockViewMode,
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
const RANGE_WITH_NO_SOURCE = `${LIVE} ${VALUE_SOURCE_MARK_TOKEN.unknown}${VALUE_SOURCE_MARK_LABEL.unknown}`

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
  beforeEach(() => {
    vi.clearAllMocks()
    mockViewMode = 'expert'
    mockResultsStatus = 'idle'
  })

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
    // Paul 23 Sep contract feedback point 1: a range that is the card's only
    // figure is never unmarked — but nothing records who set a range, so it
    // says "no source", never `est.` (reviewer blocker, 23 Sep).
    expect(screen.getByTestId(`factor-prior-range-${FACTOR_ID}`).textContent).toBe(RANGE_WITH_NO_SOURCE)
  })

  it('TWIN — a model-authored value (cee_inference) is not the user\'s: unchanged', () => {
    const { container } = renderFactor({ value: 0.55, source: 'cee_inference', extractionType: 'inferred' })
    const text = container.textContent ?? ''
    expect(text).toContain(LIVE)
    expect(text).not.toContain('replaces')
  })
})

/**
 * ⭐ DESIGN INTEGRATION (23 Sep 2026): #1889's rule on #1915's LOCKED FACE.
 * The locked Standard face shows the range as a text line under the
 * turning-point precedence (`!turningPoint || isDetailed`). This pins that the
 * line it shows there after a run is the REPLACED sentence for a user-owned
 * value — visual contract v3: a displaced range stays "disclosed as
 * superseded, not plotted as active uncertainty" — with the model-authored
 * twin unchanged.
 *
 * ⭐ RE-POINTED FOR THE BOUNDED ANATOMY (ED #63 5809278282, 24 Sep): in the
 * Standard view the range line moved off the card face into the factor's
 * popover ("can move to the existing hover/focus popover and inspector rather
 * than expanding layout geometry"). Both cases now bind the line INSIDE the
 * popover and assert it is not on the face; the wording rule is unchanged.
 */
/**
 * The Standard range line: ON the card face, never repeated in the popover
 * (prototype, Paul 25 Sep 2026 — superseding ED 5809278282's move to the
 * popover; the helper keeps its name). The wording rule is unchanged.
 */
const popoverRangeLine = () => {
  const face = screen.getByTestId('node-title').closest('[role="group"]') as HTMLElement
  const popover = screen.queryByTestId('factor-node-popover')
  if (popover) expect(popover.querySelector(`[data-testid="factor-prior-range-${FACTOR_ID}"]`), 'the range line is repeated in the popover').toBeNull()
  const line = face.querySelector(`[data-testid="factor-prior-range-${FACTOR_ID}"]`)
  expect(line, 'the range line is not on the card face').not.toBeNull()
  return line as HTMLElement
}

describe('design integration — the Standard view after a run (range line on the card, prototype 25 Sep)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockViewMode = 'standard'
    mockResultsStatus = 'complete'
  })

  it('user_override value: the Standard popover says the range is replaced, never "Range:"', () => {
    const { container } = renderFactor({ value: 0.55, source: 'user_override' })
    expect(popoverRangeLine().textContent).toBe(REPLACED)
    expect(container.textContent ?? '').not.toContain('Range:')
  })

  it('TWIN — a model-authored value keeps the live range in the Standard popover', () => {
    renderFactor({ value: 0.55, source: 'cee_inference', extractionType: 'inferred' })
    // Point 1 (Paul 23 Sep): the range is marked, never left bare — and as
    // "no source", because the range's author is not recorded on the node.
    expect(popoverRangeLine().textContent).toBe(RANGE_WITH_NO_SOURCE)
  })
})
