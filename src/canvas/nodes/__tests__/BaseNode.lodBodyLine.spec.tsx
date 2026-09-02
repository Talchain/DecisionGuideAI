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
import { ActionNode } from '../ActionNode'

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
  lodRung: 'full',
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

const renderFactor = (data: Record<string, unknown>, lodBodyHidden: boolean) => {
  setStore({ lodRung: lodBodyHidden ? 'line' : 'full' })
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

    it('is present on a decision card too — the scope this once pinned was WRONG', () => {
      // ⚠⚠ THIS TEST USED TO ASSERT THE OPPOSITE, AND IT WAS GUARDING A DEFECT.
      //
      // It read: "Scope is deliberate, not incidental… Widening the scope has to
      // be a decision, so it goes red here." The intent was right — a scope
      // change SHOULD have to be deliberate — but what it actually pinned was
      // the anchor of the model rendering as an EMPTY BOX below the legibility
      // floor, which Paul reported three times. Measured on deployed
      // `7d717c13`: the card's body held "Segment leads in 48% of scenarios…"
      // at `visibility: hidden` with nothing in its place.
      //
      // So the widening WAS made deliberately, and this went red exactly as
      // designed. It is re-pointed rather than deleted, because the thing worth
      // guarding is still real: `decision` does not get its line from
      // `lodMetricLine.ts` (which cannot see a leader-claim permission) but
      // declares it through `BaseNode`'s `lodMetric` prop. The permission
      // itself is pinned by `lodMetric.decisionGoal.spec.tsx`'s discriminating
      // pair — a withheld verdict must still name no leader here.
      setStore({ lodRung: 'line', results: { status: 'complete', report: null } })
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
      const line = screen.queryByTestId('node-lod-line')
      expect(line).not.toBeNull()
      expect(line!.textContent!.trim().length).toBeGreaterThan(0)
      // …and it says nothing about the analysis on a report-less run.
      expect(line!.textContent!.toLowerCase()).not.toMatch(/lead|ahead|winner|too close/)
    })

    /**
     * ⭐⭐ RE-POINTED, 2 Sep 2026 (Z2), AND THE RE-POINTING MAKES IT STRONGER.
     *
     * This was a CROSS-TYPE absence: `action` had no reduced line at all, and
     * this test asserted that, so that a widening had to be deliberate. Z2 made
     * the widening deliberately — an action card below the floor was a coloured
     * box with a title and nothing else, on exactly the whole-model view every
     * starter parks in — so the cross-type form would now simply be deleted.
     *
     * It is re-pointed into a WITHIN-TYPE PAIR instead, the way this file
     * already treats `decision` above. That keeps the guard discriminating and
     * on a better axis: the old form went green on ANY widening whatsoever,
     * including one that printed an empty line for every action; the pair fails
     * unless the line tracks the specific datum the card's own body renders.
     */
    it('is present on an `action` card that has a description (Z2)', () => {
      setStore({ lodRung: 'line', results: { status: 'complete', report: null } })
      render(
        <ReactFlowProvider>
          <ActionNode
            {...baseProps}
            type="action"
            id="action-1"
            data={{ label: 'Ship the pilot', type: 'action', description: 'Run a 4-week beta' }}
          />
        </ReactFlowProvider>,
      )
      expect(screen.getByText('Ship the pilot')).toBeInTheDocument()
      const line = screen.queryByTestId('node-lod-line')
      expect(line).not.toBeNull()
      // Bound to the DATUM by identity, not to "some non-empty string" — which
      // an unrelated widening could satisfy.
      expect(line!.textContent!.trim()).toBe('Run a 4-week beta')
    })

    it('CONTRAST CONTROL — is absent on an `action` card with NO description', () => {
      // The other half of the pair. An action with nothing to say must still say
      // nothing: a blank line carrying a testid is the defect Z2 removes, not a
      // smaller version of it.
      setStore({ lodRung: 'line', results: { status: 'complete', report: null } })
      render(
        <ReactFlowProvider>
          <ActionNode
            {...baseProps}
            type="action"
            id="action-1"
            data={{ label: 'Ship the pilot', type: 'action' }}
          />
        </ReactFlowProvider>,
      )
      // ⛔ POSITIVE CONTROL FIRST (CLAUDE.md trap 13). An absence assertion is
      // worth nothing until the probe is shown to be able to SEE a presence: if
      // `ActionNode` rendered nothing at all — a throw, a changed testid, a
      // mock drifting out from under this file — `queryByTestId` would return
      // null for the wrong reason and this test would pass forever while
      // asserting nothing. Prove the card is on screen, THEN prove the line is
      // not.
      expect(screen.getByText('Ship the pilot')).toBeInTheDocument()
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
