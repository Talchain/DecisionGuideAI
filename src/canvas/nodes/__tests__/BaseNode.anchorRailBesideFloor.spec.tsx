/**
 * ⭐ v3.1 WS1 #16 (26 Sep 2026): THE ANCHOR'S RAIL IS INSIDE THE CARD AT EVERY
 * ZOOM IT IS MOUNTED AT — the landing zoom included.
 *
 * It used to be drawn BELOW the Question and the Goal below `ICON_LEGIBLE_ZOOM`,
 * because a counter-scaled beside-rail reserved on the whole card covered the
 * Question's own "Top gap" line (review 5822709101, Canvas Browser Gate
 * `nodeControlOcclusion` @vendor-selection 1440×900, `dec_cdp`). Drawn below,
 * the coaching icon hung 24.5px under the card's bottom edge on all five
 * starters at landing (DESIGN-GAP-v31 #16). The rail is now inset beside the
 * BODY, whose `padding-right` and `min-height` keep it clear of the title and
 * the rows (`BaseNode` `anchorBodyRailStyle`). jsdom has no layout, so this pins
 * the placement decision and the body reserve; `nodeControlOcclusion` and the
 * WS1 landing probe are the geometry witnesses.
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

const decision = () => <DecisionNode {...({ ...baseProps, type: 'decision', id: 'dec-1', data: { label: 'How should we price the Pro plan?', type: 'decision' } } as any)} />
const factor = () => <FactorNode {...baseProps} id="fac-1" data={{ label: 'Hiring spend', type: 'factor' }} />

describe('WS1 #16 — the anchor rail is inside the card at the landing zoom too', () => {
  it('the Question at the LANDING zoom (0.5, Normal rung) draws its rail INSIDE the card', () => {
    expect(placementAt(0.5, decision(), 'dec-1')).toBe('inset')
  })

  it('…beside its BODY, which reserves the rail\'s run and height (not the whole card)', () => {
    setRung('full')
    setAnchorRailFitsBeside(anchorRailFitsBesideAtZoom(0.5))
    render(<ReactFlowProvider>{decision()}</ReactFlowProvider>)
    const body = screen.getByTestId('anchor-body-rail-beside')
    expect(body.style.paddingRight).toMatch(/var\(--canvas-label-scale, 1\)/)
    expect(body.style.minHeight).toMatch(/var\(--canvas-label-scale, 1\)/)
    const card = body.closest('[role="group"]') as HTMLElement
    expect(card.style.paddingRight).not.toMatch(/canvas-label-scale/)
    cleanup()
  })

  it('CONTRAST — the Question at ordinary Normal zoom keeps its rail inset beside the text', () => {
    expect(placementAt(1, decision(), 'dec-1')).toBe('inset')
    expect(placementAt(ICON_LEGIBLE_ZOOM, decision(), 'dec-1')).toBe('inset')
  })

  it('CONTRAST — a repeated card at the landing zoom stays inset (the Normal rule is unchanged for it)', () => {
    expect(placementAt(0.5, factor(), 'fac-1')).toBe('inset')
  })

  it('(the LodSync floor is unchanged and still read by OptionNode) ICON_LEGIBLE_ZOOM, inclusive', () => {
    expect(anchorRailFitsBesideAtZoom(ICON_LEGIBLE_ZOOM)).toBe(true)
    expect(anchorRailFitsBesideAtZoom(ICON_LEGIBLE_ZOOM - 0.001)).toBe(false)
    expect(anchorRailFitsBesideAtZoom(0.5)).toBe(false)
  })
})
