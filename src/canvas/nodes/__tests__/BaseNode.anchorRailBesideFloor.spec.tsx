/**
 * ⛔ THE ANCHOR RAIL SITS BESIDE ONLY AT OR ABOVE THE OLD NORMAL FLOOR.
 *
 * Landing (zoom 0.5) now counts as Normal, where every card's rail is inset.
 * But an anchor's (Question, Goal) rail sits BESIDE its text, and at label scale 2
 * it covered the Question's own "Top gap" line (review 5822709101, Canvas
 * Browser Gate `nodeControlOcclusion` @vendor-selection 1440×900, `dec_cdp`;
 * base ✓). Below `ICON_LEGIBLE_ZOOM` an anchor keeps its old landing rule —
 * the hover row drawn below the card — while repeated cards stay inset.
 * jsdom has no layout, so this pins the placement decision; the browser gate
 * is the geometry witness.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { DecisionNode } from '../DecisionNode'
import { FactorNode } from '../FactorNode'
import { useCanvasStore } from '../../store'
import { ICON_LEGIBLE_ZOOM, type LodRung } from '../../utils/zoomLegibility'
import { anchorRailFitsBesideAtZoom, setAnchorRailFitsBeside } from '../shared/anchorRailFloor'

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
  viewMode: 'standard',
  lodRung: 'full' as LodRung,
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

const setRung = (lodRung: LodRung) => {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    (selector as (s: unknown) => unknown)(makeStoreState({ lodRung }) as never),
  )
}

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


const placementAt = (z: number, node: React.ReactElement, id: string): string | null => {
  setRung('full')
  // What `LodSync` writes from the live viewport (pinned in LodSync.anchorRailFloor.spec).
  setAnchorRailFitsBeside(anchorRailFitsBesideAtZoom(z))
  render(<ReactFlowProvider>{node}</ReactFlowProvider>)
  const rail = screen.getByTestId(`node-card-rail-${id}`)
  const placement = rail.getAttribute('data-rail-placement')
  cleanup()
  return placement
}

const decision = () => <DecisionNode {...baseProps} type="decision" id="dec-1" data={{ label: 'How should we price the Pro plan?', type: 'decision' }} />
const factor = () => <FactorNode {...baseProps} id="fac-1" data={{ label: 'Hiring spend', type: 'factor' }} />

describe('anchor rail beside the text only at or above the old Normal floor', () => {
  it('the Question at the LANDING zoom (0.5, Normal rung) draws its rail BELOW the card', () => {
    expect(placementAt(0.5, decision(), 'dec-1')).toBe('below')
  })

  it('CONTRAST — the Question at ordinary Normal zoom keeps its rail inset beside the text', () => {
    expect(placementAt(1, decision(), 'dec-1')).toBe('inset')
    expect(placementAt(ICON_LEGIBLE_ZOOM, decision(), 'dec-1')).toBe('inset')
  })

  it('CONTRAST — a repeated card at the landing zoom stays inset (the Normal rule is unchanged for it)', () => {
    expect(placementAt(0.5, factor(), 'fac-1')).toBe('inset')
  })

  it('the floor is ICON_LEGIBLE_ZOOM, inclusive', () => {
    expect(anchorRailFitsBesideAtZoom(ICON_LEGIBLE_ZOOM)).toBe(true)
    expect(anchorRailFitsBesideAtZoom(ICON_LEGIBLE_ZOOM - 0.001)).toBe(false)
    expect(anchorRailFitsBesideAtZoom(0.5)).toBe(false)
  })
})
