/**
 * BaseNode — the reduced line a card keeps at level-of-detail zoom.
 *
 * THE DEFECT THIS PINS (Paul, 31 Aug 2026, second report of the same thing):
 * "when I zoom out of the graph, the content in it shouldn't disappear". The
 * 30 Aug fix kept the TITLE; the BODY still rendered `visibility: hidden`, so
 * below the level-of-detail threshold a card said nothing about itself beyond
 * its name.
 *
 * ⚠ WHAT THESE TESTS CAN AND CANNOT SHOW. jsdom has no layout, so nothing here
 * proves anything is VISIBLE ON SCREEN (CLAUDE.md trap 3). What they pin is
 * exactly three things, and they are stated rather than implied:
 *   1. WHETHER the reduced line is rendered, and for which node types;
 *   2. WHAT STRING it carries — asserted against a hand-written corpus of
 *      expectations, and against the string the factor's own BODY renders for
 *      the same data, so the two surfaces cannot state different values for one
 *      card (the drift guard);
 *   3. that it stays a CHILD of the hidden body element and re-declares its own
 *      visibility — the mechanism that lets one line come back while the box
 *      keeps the dimensions ELK and the edge anchors depend on.
 * The geometry claim itself (that the card's box is unchanged) belongs to the
 * real-browser harness at `e2e/geometry`, not to this file.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { DecisionNode } from '../DecisionNode'

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

vi.mock('../../../flags', () => ({
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

describe('BaseNode — the reduced line kept at level-of-detail zoom', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('what the line states', () => {
    for (const entry of CORPUS) {
      it(`states the factor's own value — ${entry.name}`, () => {
        const { unmount } = renderFactor(entry.data, true)
        expect(screen.getByTestId('node-lod-line').textContent).toBe(entry.expected)
        unmount()
      })

      it(`states the SAME string the body renders — ${entry.name}`, () => {
        // The body at ordinary zoom.
        const atNormalZoom = renderFactor(entry.data, false)
        expect(screen.queryByTestId('node-lod-line')).toBeNull()
        // Binds by the exact string the corpus declares, so this fails if EITHER
        // surface changes what it says about this factor.
        expect(screen.getByText(entry.expected)).toBeTruthy()
        atNormalZoom.unmount()

        // The reduced line at level-of-detail zoom.
        const atLodZoom = renderFactor(entry.data, true)
        expect(screen.getByTestId('node-lod-line').textContent).toBe(entry.expected)
        atLodZoom.unmount()
      })
    }

    it('carries the untruncated string as its hover title', () => {
      renderFactor(CORPUS[0].data, true)
      expect(screen.getByTestId('node-lod-line').getAttribute('title')).toBe(CORPUS[0].expected)
    })
  })

  describe('when it is rendered at all', () => {
    it('is absent at ordinary zoom', () => {
      renderFactor(CORPUS[0].data, false)
      expect(screen.queryByTestId('node-lod-line')).toBeNull()
    })

    it('is absent for a factor with no observed value — never an empty line', () => {
      renderFactor({ label: 'Cash Runway', type: 'factor', category: 'external' }, true)
      expect(screen.queryByTestId('node-lod-line')).toBeNull()
    })

    it('is absent on node types whose headline figure is not this component to state', () => {
      // Scope is deliberate, not incidental: an option's win figure is a full
      // comparative sentence and goal/outcome figures carry mandatory adjacent
      // disclosures. Widening the scope has to be a decision, so it goes red here.
      setStore({ lodActive: true, results: { status: 'complete', report: null } })
      render(
        <ReactFlowProvider>
          {/*
            `DecisionNode` is typed `NodeProps<DecisionNodeData>` — a CONCRETE
            node type, so its props are not the generic `NodeProps` that
            `baseProps` satisfies for `FactorNode` above, and it additionally
            requires `dragHandle` and `parentId`. The sibling spec
            `BaseNode.handleBoundsOnMount.spec.tsx:99` casts for exactly this
            reason; the cast is over the React Flow PLUMBING props only — the
            two props this test is actually about, `type` and `data`, are still
            written literally and still checked by the assertion below.
          */}
          <DecisionNode
            {...({
              ...baseProps,
              type: 'decision',
              id: 'decision-1',
              data: { label: 'Should we expand?', type: 'decision' },
            } as any)}
          />
        </ReactFlowProvider>,
      )
      expect(screen.queryByTestId('node-lod-line')).toBeNull()
    })
  })

  describe('how it survives the hidden body without moving the box', () => {
    it('is a child of the hidden body element and re-declares its own visibility', () => {
      renderFactor(CORPUS[0].data, true)
      const line = screen.getByTestId('node-lod-line')
      const body = line.parentElement
      expect(body).not.toBeNull()
      // The body still hides — unchanged from before this line existed, which is
      // what keeps the card's dimensions (and therefore the edge anchors) stable.
      expect(body?.getAttribute('data-lod-hidden')).toBe('true')
      expect((body as HTMLElement).style.visibility).toBe('hidden')
      // A descendant may re-declare visibility; that is the whole mechanism.
      expect(line.style.visibility).toBe('visible')
      // Class-presence only — jsdom has no layout, so this shows the element is
      // declared out of flow, NOT that the box measured the same. That claim is
      // the browser harness's.
      expect(line.className).toContain('absolute')
    })
  })
})
