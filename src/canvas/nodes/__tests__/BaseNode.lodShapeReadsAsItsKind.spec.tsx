/**
 * ⭐⭐ AT THE LEVEL-OF-DETAIL RUNG A CARD MUST READ AS ITS COLOURED SHAPE.
 *
 * `BaseNode.tsx` states the design intent where the body is hidden:
 *
 *   > "at level-of-detail zoom the body hides via visibility (box keeps its
 *   >  dimensions so ELK/edge anchors stay stable) — the node reads as its
 *   >  COLOURED SHAPE, PLUS the one reduced line below."
 *
 * ⛔ THE BOX KEPT ITS DIMENSIONS AND NEVER GOT THE COLOUR. The card painted
 * `var(--bg-panel)` at every rung, so a zoomed-out node rendered as a WHITE box
 * with a hairline border, its interior blank because the body it reserves room
 * for is `visibility: hidden`. Measured on the served build `b7c8c74e`: an
 * option card at scale 0.27 carried its title and one reduced line across the
 * top ~45% and nothing at all below (`/tmp/crop-card.png`). The founder's words
 * were "the graph looks worse than it has for the last few weeks".
 *
 * ⭐ NOTHING IS INVENTED HERE. `nodes/colors.ts` has carried a per-kind light
 * fill next to every per-kind border since it was written — `bg-goal-light`,
 * `bg-option-light`, `bg-factor-light`, `bg-danger-light`, `bg-success-light`,
 * `bg-info-light`, each resolving to a real `--*-light-rgb` token in
 * `tailwind.config.js`. The fill was authored for exactly this and simply was
 * never applied. This change applies it AT THE LINE RUNG ONLY.
 *
 * ⚠ THE EVIDENCE LENS STILL WINS. `evidenceBgStyle` is a data channel; when it
 * is present it keeps the card, because a lens that colours by evidence must not
 * be overpainted by kind. Pinned below.
 *
 * ⛔ WHY THE PAIR, NOT A PRESENCE CHECK. A test that only asserted "the fill
 * class is present at the line rung" would pass if the fill were applied at
 * EVERY rung, which is a different product (kind-tinted cards at reading zoom —
 * not ruled on, and not this change). The rung arm and the PRECONDITION that two
 * kinds resolve to DIFFERENT fills are what bind it (traps 13b, 19).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
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
  // Locked Canvas design (23 Sep 2026): the decision card's rail run icon reads
  // `analysisHeldNotice` at mount, which asks `isV5CanonicalRunPath` — a flag
  // this mock must now answer. Off: the V2 path, as before.
  isV5CanonicalAnalysisEnabled: vi.fn(() => false),
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

import { nodeColors } from '../colors'

const renderFactorAt = (rung: 'full' | 'line', data: Record<string, unknown> = {}) => {
  setStore({ lodRung: rung })
  return render(
    <ReactFlowProvider>
      <FactorNode {...baseProps} id="n-1" data={data} />
    </ReactFlowProvider>,
  )
}

const renderDecisionAt = (rung: 'full' | 'line') => {
  setStore({ lodRung: rung })
  return render(
    <ReactFlowProvider>
      <DecisionNode
        {...baseProps}
        type="decision"
        dragHandle={undefined}
        parentId={undefined}
        id="n-1"
        data={{ type: 'decision', label: 'Pricing' }}
      />
    </ReactFlowProvider>,
  )
}

/** The card element: the outermost role=group BaseNode renders. */
const cardOf = (c: HTMLElement) => c.querySelector('[role="group"]') as HTMLElement

describe('a card at the level-of-detail rung reads as its coloured shape', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('PRECONDITION: the two kinds under test resolve to DIFFERENT identity fills', () => {
    expect(nodeColors.factor.bg).not.toBe(nodeColors.decision.bg)
    expect(nodeColors.factor.bg).toMatch(/^bg-/)
    expect(nodeColors.decision.bg).toMatch(/^bg-/)
  })

  it('carries its own kind identity fill at the LINE rung', () => {
    const { container } = renderFactorAt('line', { label: 'Churn' })
    expect(cardOf(container).className).toContain(nodeColors.factor.bg)
  })

  it('a DIFFERENT kind carries a DIFFERENT fill at the same rung', () => {
    const { container } = renderDecisionAt('line')
    const cls = cardOf(container).className
    expect(cls).toContain(nodeColors.decision.bg)
    expect(cls).not.toContain(nodeColors.factor.bg)
  })

  it('does NOT tint at the FULL rung — this is a level-of-detail affordance, not a repaint', () => {
    const { container } = renderFactorAt('full', { label: 'Churn' })
    expect(cardOf(container).className).not.toContain(nodeColors.factor.bg)
  })
})
