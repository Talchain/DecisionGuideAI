/**
 * ⭐⭐ v3.1 WS1 #25 (26 Sep 2026): AT FAR ZOOM A CARD IS A WHITE CHIP WITH A
 * READABLE NAME AND ITS KIND SHAPE — contract v3.1: "Far zoom: readable identity
 * and a simple attention cue" (`.far-example`: panel ground, a 9px name, the
 * kind dot on the top edge). This file REVERSES its own earlier rule.
 *
 * ⛔ THE EARLIER RULE, KEPT FOR PROVENANCE. It pinned the per-kind LIGHT FILL at
 * the line rung ("a card must read as its coloured shape"), because the card
 * was a white box with a blank interior at scale 0.27. The served result was
 * DESIGN-AUDIT #13 / DESIGN-GAP-v31 #25: at 17% the board became kind-light
 * FILLED BLOCKS whose titles rendered at 4.7px — coloured, but anonymous.
 *
 * ⭐ WHAT CARRIES KIND AND NAME NOW, each pinned below as a rung pair:
 *   · the ground is the panel at EVERY rung (no kind fill);
 *   · the kind SHAPE on the top edge is counter-scaled (`calc(24px × scale)`,
 *     #15), so at far zoom it is ~2× the size it was;
 *   · the far-rung title is the identity chip: `--canvas-far-title-scale`
 *     (`farTitleScale`, 9px on screen down to 0.167) and clamped, marked
 *     `data-lod-far-title` so the layout measurer can read it unclamped;
 *   · at the full rung the title is NOT clamped (WS1 #2).
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

// Spread the real flags module: `FactorNode` now reads the composed analysis
// verdict (`useModelChangedSinceRun`), whose source classifier calls a flag
// this factory never listed. A `vi.mock` factory REPLACES the module, so an
// unlisted flag is `undefined` and throws at render (CLAUDE.md trap 12).
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
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

const titleOf = (c: HTMLElement) => c.querySelector('[data-testid="node-title"]') as HTMLElement
const glyphOf = (c: HTMLElement) => c.querySelector('[data-testid="node-type-glyph"]') as HTMLElement

describe('WS1 #25 — a far-zoom card is a white chip with its name and its kind shape', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('PRECONDITION: the kind fills this file used to apply are real, distinct classes', () => {
    expect(nodeColors.factor.bg).not.toBe(nodeColors.decision.bg)
    expect(nodeColors.factor.bg).toMatch(/^bg-/)
  })

  it('no kind fill at the LINE rung — the card keeps the panel ground', () => {
    const { container } = renderFactorAt('line', { label: 'Churn' })
    const card = cardOf(container)
    expect(card.className).not.toContain(nodeColors.factor.bg)
    expect(card.style.backgroundColor).toBe('var(--bg-panel)')
  })

  it('…for the Question too', () => {
    const { container } = renderDecisionAt('line')
    expect(cardOf(container).className).not.toContain(nodeColors.decision.bg)
  })

  it('the LINE-rung title is the far identity chip: far scale, clamped, marked for the measurer', () => {
    const { container } = renderFactorAt('line', { label: 'Churn' })
    const title = titleOf(container)
    expect(title.getAttribute('data-lod-far-title')).toBe('true')
    expect(title.className).toContain('--canvas-far-title-scale')
    expect(title.className).toMatch(/\bline-clamp-2\b/)
  })

  it('CONTRAST — the FULL-rung title is never clamped (WS1 #2) and not the far chip', () => {
    const { container } = renderFactorAt('full', { label: 'Churn' })
    const title = titleOf(container)
    expect(title.getAttribute('data-lod-far-title')).toBeNull()
    expect(title.className).not.toMatch(/line-clamp/)
    expect(title.className).not.toContain('--canvas-far-title-scale')
  })

  it.each(['full', 'line'] as const)('the kind shape is the contract\'s 24px at −12px, counter-scaled (WS1 #15) — %s rung', (rung) => {
    const { container } = renderFactorAt(rung, { label: 'Churn' })
    const glyph = glyphOf(container)
    expect(glyph.style.width).toBe('calc(24px * var(--canvas-label-scale, 1))')
    expect(glyph.style.height).toBe('calc(24px * var(--canvas-label-scale, 1))')
    expect(glyph.style.top).toBe('calc(-12px * var(--canvas-label-scale, 1))')
    expect(glyph.className).not.toMatch(/h-\[22px\]/)
  })
})
