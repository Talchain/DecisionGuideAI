/**
 * ⭐ "NOT SAVED · SET STRENGTH" ON A CANVAS-ONLY LINK (canvas audit
 * edit-structure/F3, 27 Sep 2026; contract v3.1 §02 "Edit-state words stay
 * visible … Not saved").
 *
 * A link drawn with no stated strength stands down and is never sent; the
 * store records that on the edge (`structuralAddStandDown`). Served, the link
 * then looked identical to a saved one once the toast faded (1px grey, solid,
 * no label) and vanished on reload. `StyledEdge` had zero reads of the marker.
 * It now wears the edit-state word, which is also the way in: one click opens
 * that link's panel (its add-control sends the strength).
 *
 * ⛔ WORDS, NOT A DASH — Paul 23 Sep point 4, "dash remains existence certainty
 * only". `EDGE_DASH_RULES` is untouched by this change (its ordering spec,
 * `edgePresentation.spec.ts`, pins the list).
 *
 * Harness: the one `StyledEdge.strengthSettlementDisclosure.spec.tsx` uses.
 */
import type { ComponentProps } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { StyledEdge, EDGE_SELECTION_DIM_OPACITY } from '../StyledEdge'
import { Position } from '@xyflow/react'
import { CANVAS_ONLY_LINK_MARK } from '../../utils/canvasOnlyLink'

vi.mock('../../utils/openEdgeStrengthEditor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/openEdgeStrengthEditor')>()),
  openEdgeStrengthEditor: vi.fn(() => true),
}))
import { openEdgeStrengthEditor } from '../../utils/openEdgeStrengthEditor'

let mockEdges: Array<Record<string, unknown>> = []
/** The store's selection-dim set, read lazily by the store double below. */
let mockDimmedEdgeIds = new Set<string>()

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: () => <path data-testid="base-edge" />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({ getNode: () => null, getEdges: () => mockEdges, getNodes: () => [] }),
    useStore: (selector: any) => selector({ nodes: [] }),
  }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      results: { status: 'complete', report: null },
      viewMode: 'detailed',
      hoveredOptionId: null,
      highlightedEdges: new Set<string>(),
      dimmedEdgeIds: mockDimmedEdgeIds,
      lens: {
        active: 'full',
        _dimmedEdgeIds: new Set<string>(),
        _sensitivityWeights: new Map<string, number>(),
        _sensitivityQuartiles: null,
        _fragileEdgeIds: new Set<string>(),
        _lensFragileLabels: new Map<string, string>(),
      },
    })
  ),
}))

vi.mock('../../store/edgeLabelMode', () => ({
  useEdgeLabelMode: vi.fn((selector: any) => selector({ mode: 'human' })),
}))
vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => false,
}))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))
vi.mock('../../utils/graphDisplayCalculations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/graphDisplayCalculations')>()),
  calculateEdgeImportance: () => 0.5,
  importanceToStrokeWidth: () => 2,
  weightMagnitudeToStrokeWidth: () => 2,
}))
vi.mock('../../theme/edges', () => ({
  applyEdgeVisualProps: (_: any, props: any) => props,
}))
vi.mock('../../ui/inspector-v2/inspectorStrings', () => ({
  getStrengthDescription: () => 'moderate',
  getProvenanceLabel: () => '',
}))


const baseProps = {
  id: 'e_drawn',
  source: 'n1',
  target: 'n2',
  sourceX: 0,
  sourceY: 0,
  targetX: 100,
  targetY: 100,
  sourcePosition: Position.Bottom,
  targetPosition: Position.Top,
  selected: false,
}

/** Exactly what `addEdge` leaves for a drawn link: the default weight, no provenance, the receipt. */
const DRAWN = { weight: 0.3, direction: 'positive', structuralAddStandDown: 'strength_not_stated' }
/** The same link after the user stated a strength: the capture clears the receipt. */
const STATED = { weight: 0.55, weightSource: 'user', direction: 'positive', directionSource: 'user' }

function renderEdge(data: Record<string, unknown>, selected = false) {
  const props = { ...baseProps, selected, data } as unknown as ComponentProps<typeof StyledEdge>
  return render(
    <svg>
      <StyledEdge {...props} />
    </svg>,
  )
}

beforeEach(() => {
  mockEdges = []
  mockDimmedEdgeIds = new Set<string>()
  vi.mocked(openEdgeStrengthEditor).mockClear()
})

describe('a canvas-only link says so, on the link', () => {
  it('⭐ the word is rendered for this edge, by id', () => {
    const { getByTestId } = renderEdge(DRAWN)
    expect(getByTestId('edge-canvas-only-e_drawn').textContent).toBe(
      `${CANVAS_ONLY_LINK_MARK.word}·${CANVAS_ONLY_LINK_MARK.action}`,
    )
  })

  it('a click opens THIS link\'s panel (the control that sends it)', () => {
    const { getByTestId } = renderEdge(DRAWN)
    fireEvent.click(getByTestId('edge-canvas-only-e_drawn'))
    expect(openEdgeStrengthEditor).toHaveBeenCalledTimes(1)
    expect(openEdgeStrengthEditor).toHaveBeenCalledWith('e_drawn')
  })

  it('it is a named control for assistive tech, and the edge\'s own label carries the state too', () => {
    // Selected, so the edge's own label (and its accessible name) is painted.
    const { getByTestId, container } = renderEdge(DRAWN, true)
    expect(getByTestId('edge-canvas-only-e_drawn').getAttribute('aria-label')).toMatch(/^Not saved: set strength for the connection from /)
    const labelled = [...container.querySelectorAll('[aria-label]')].map((el) => el.getAttribute('aria-label') ?? '')
    expect(labelled.some((l) => l.startsWith('Edge from ') && l.includes('. Not saved'))).toBe(true)
  })

  it('it counter-scales with the canvas type (the 10px mark token)', () => {
    const { getByTestId } = renderEdge(DRAWN)
    // `getAttribute('class')`: inside the test's <svg> the element is created in
    // the SVG namespace, where `className` is not a string.
    expect(getByTestId('edge-canvas-only-e_drawn').getAttribute('class')).toContain('calc(10px*var(--canvas-label-scale,1))')
  })

  it('dims with its connection when the selection dims the edge (contract v3.1 E6, review r06 note 1)', () => {
    mockDimmedEdgeIds = new Set(['e_drawn'])
    const { getByTestId } = renderEdge(DRAWN)
    expect(getByTestId('edge-canvas-only-e_drawn').style.opacity).toBe(String(EDGE_SELECTION_DIM_OPACITY))
  })

  it('CONTRAST: an undimmed edge\'s word is at full strength', () => {
    const { getByTestId } = renderEdge(DRAWN)
    expect(getByTestId('edge-canvas-only-e_drawn').style.opacity).toBe('')
  })

  it('CONTRAST: once a strength is stated the receipt is gone, and so is the word', () => {
    const { queryByTestId } = renderEdge(STATED)
    expect(queryByTestId('edge-canvas-only-e_drawn')).toBeNull()
  })

  it('CONTRAST: a link the server holds (no receipt) wears no word', () => {
    const { queryByTestId } = renderEdge({ weight: 0.3, direction: 'positive' })
    expect(queryByTestId('edge-canvas-only-e_drawn')).toBeNull()
  })
})
