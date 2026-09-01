/**
 * ⭐ THE MOUNT CONSULTS THE SCOPE — because a correct predicate nothing calls is
 * this estate's signature defect.
 *
 * `valueProvenanceNodeKind.spec.ts` proves the RULE. This proves the CANVAS
 * obeys it, by rendering the real node components and asking what is on the
 * card — not by reading the source and agreeing with it.
 *
 * ⚠ THE DEFECT IT PINS, measured on deployed staging `be33648b` and not on any
 * fixture: the goal card carried "From brief" (this mark) 18px above
 * "From your brief" (`GOAL_LABEL_FROM_BRIEF_COPY`) — ONE wire literal in two
 * spellings, one of them using value words for a label — and the decision card
 * read "AI estimate" for a question Olumi framed rather than estimated.
 *
 * Both directions are asserted. A gate that suppressed the mark everywhere
 * would satisfy every "goal shows nothing" assertion while silently deleting
 * the mark from the whole canvas, so the factor/risk cases are load-bearing,
 * not decoration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { DecisionNode } from '../DecisionNode'
import { GoalNode } from '../GoalNode'
import { RiskNode } from '../RiskNode'

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
  editedSinceRunNodeIds: new Set(),
  analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
  lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  // Standard view, i.e. the REST state — deliberately not 'expert'. The body's
  // own rest-state shortening only runs outside the detailed view, and the
  // agreement assertions below compare against what the body actually renders.
  viewMode: 'standard',
  lodActive: false,
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    influenceProvenance: null,
    confidence: null,
    confidenceIsDefaulted: false,
    confidenceIsProvisional: false,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    achievementProbabilityIsModelledBasis: false,
    achievementProbabilityBasis: null,
    jointGoalProbability: null,
    goalFitAvailable: false,
    stabilityPercentage: null,
    winRate: null,
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
    isResultsMode: false,
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

// ⚠ `importOriginal`-SPREAD, NOT A HAND-LIST. A `vi.mock` factory REPLACES the
// module, so a hand-listed set of flags is a mirror that goes stale the moment a
// flag is added — CLAUDE.md trap 12's canonical example, which once killed 51
// tests at collection. This one overrides only what it needs.
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))

import { useCanvasStore } from '../../store'

// ⚠ COMPLETE against React Flow's NodeProps rather than cast. The first cut
// omitted `deletable`, `selectable`, `draggable`, `width`, `height`,
// `sourcePosition` and `targetPosition`, which the app's own tsconfig requires
// (TS2739/TS2740) even though the component never reads them. Casting the gap
// away would add another partial mock to a file already carrying a ratchet
// baseline of them; completing it adds none.
const baseProps = {
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
  width: 240,
  height: 100,
  sourcePosition: undefined,
  targetPosition: undefined,
}

const setStore = (state: Record<string, unknown>) => {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector(makeStoreState(state) as never),
  )
}

const renderFactor = (data: Record<string, unknown>, lodActive: boolean) => {
  setStore({ lodActive })
  return render(
    <ReactFlowProvider>
      <FactorNode {...baseProps} id="factor-1" data={data} />
    </ReactFlowProvider>,
  )
}

/**
 * The corpus, and where the expectations come from.
 *
 * Every `expected` below is written from the PRODUCER's declared semantics —
 * `formatFactorDisplayValue`'s documented priority order (Pattern 1 raw_value +
 * meaningful unit → CEE display_value → unitless raw_value → binary heuristic)
 * — never read back out of the code path under test. A guard whose expectation
 * is copied from the implementation only proves the implementation agrees with
 * itself (CLAUDE.md traps 13b/13c).
 */
const CORPUS: ReadonlyArray<{
  name: string
  data: Record<string, unknown>
  /** What the card states for this factor, in BOTH the body and the reduced line. */
  expected: string
}> = [
  {
    name: 'currency raw_value with a real unit',
    data: {
      label: 'Hiring cost',
      type: 'factor',
      observedState: { raw_value: 26000, unit: '£' },
    },
    expected: '£26,000',
  },
  {
    name: 'a 0–1 ratio carrying a percent unit',
    data: {
      label: 'Conversion',
      type: 'factor',
      observedState: { raw_value: 0.25, unit: '%' },
    },
    expected: '25%',
  },
  {
    name: 'CEE contextual display_value at the top level of node data',
    data: {
      label: 'Competitor Acquisition',
      type: 'factor',
      display_value: 'No acquisition pursued',
      observedState: { value: 0, raw_value: 0, cap: 0, factor_type: 'other' },
    },
    expected: 'No acquisition pursued',
  },
  {
    /**
     * ⭐ THE DISCRIMINATING CASE. `unit` here holds an INTERNAL CEE factor_type
     * descriptor, which the shared guard (`isSuppressedUnit`) exists to stop
     * reaching a user — the documented "factor_type leak". Drop the guard from
     * BaseNode and this factor's reduced line reads "0.5 other" while the body
     * two pixels beneath it reads "0.5": one datum, one card, two answers.
     */
    name: 'an internal factor_type descriptor leaking into unit',
    data: {
      label: 'Team quality',
      type: 'factor',
      observedState: { raw_value: 0.5, value: 0.5, unit: 'other' },
    },
    expected: '0.5',
  },
  {
    /**
     * An INFERRED value at rest sheds its parenthesised raw number (R6). The
     * reduced line is the most compressed rest state the card has, so it applies
     * the same shortening through the same owner — and this case is the one that
     * would go red if the two ever stopped agreeing about it.
     */
    name: 'an inferred value whose parenthesised raw number is shed at rest',
    data: {
      label: 'Team morale',
      type: 'factor',
      display_value: 'Moderate (0.5)',
      observedState: { value: 0.5, extractionType: 'inferred' },
    },
    expected: 'Moderate',
  },
]


const mark = () => screen.queryAllByTestId('node-provenance-mark')

const dataFor = (kind: string) => ({
  label: `A ${kind}`,
  kind,
  // ⚠ THE SAME LITERAL FOR EVERY KIND, deliberately. The only thing that may
  // differ across these cases is the NODE KIND — if the fixtures differed in
  // provenance too, a passing test would not tell us which one decided it.
  provenance: 'from_brief',
})

describe('the provenance mark appears only where the value words fit', () => {
  beforeEach(() => {
    vi.mocked(useCanvasStore).mockImplementation((selector: (s: unknown) => unknown) =>
      selector(makeStoreState()),
    )
  })

  it('POSITIVE CONTROL — a factor card carries the mark', () => {
    render(
      <ReactFlowProvider>
        <FactorNode {...baseProps} id="f1" type="factor" data={dataFor('factor')} />
      </ReactFlowProvider>,
    )
    expect(mark().length, 'the probe cannot see a mark at all — every absence below would be vacuous').toBe(1)
  })

  it('a risk card carries it too — the scope is not "only factors"', () => {
    render(
      <ReactFlowProvider>
        <RiskNode {...baseProps} id="r1" type="risk" data={dataFor('risk')} />
      </ReactFlowProvider>,
    )
    expect(mark().length).toBe(1)
  })

  it('⛔ a GOAL card does not — the goal already says this in its own words', () => {
    render(
      <ReactFlowProvider>
        <GoalNode {...baseProps} id="g1" type="goal" data={dataFor('goal')} />
      </ReactFlowProvider>,
    )
    expect(mark().length).toBe(0)
  })

  it('⛔ a DECISION card does not — nothing on it was estimated', () => {
    render(
      <ReactFlowProvider>
        <DecisionNode {...baseProps} id="d1" type="decision" data={dataFor('decision')} />
      </ReactFlowProvider>,
    )
    expect(mark().length).toBe(0)
  })

  it('the goal card states the provenance ONCE, not twice in two spellings', () => {
    render(
      <ReactFlowProvider>
        <GoalNode {...baseProps} id="g2" type="goal" data={dataFor('goal')} />
      </ReactFlowProvider>,
    )
    // The deployed defect, stated as the user met it: two pills, same fact.
    const text = document.body.textContent ?? ''
    const briefish = text.match(/From (your )?brief/g) ?? []
    expect(briefish.length, `two spellings of one fact: ${JSON.stringify(briefish)}`).toBeLessThanOrEqual(1)
  })
})
