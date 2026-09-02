/**
 * THE POLARITY GLYPH — keep the channel, drop the chrome.
 *
 * The founder called the green "+" marks on edges clutter. They are NOT an
 * add-node affordance (no such affordance exists: `edgeTypes = { styled }`);
 * they are the polarity glyph, and they may NOT simply be deleted.
 * `directionStroke.ts:23-32` carries a dated MEASUREMENT: the stroke palette
 * separates WORSE for a dichromat than the green/red it replaced (ΔE2000 11.7
 * vs 28.3 under deuteranopia), so "the +/− glyph, not the colour, is what
 * carries polarity for a red-green dichromat here."
 *
 * So the glyph keeps its channel and loses its chrome, and it is suppressed in
 * exactly ONE state: where the chip beside it already shows a PERSISTENT
 * strength row, because that row's WORD ("boost" / "drag") is the same datum.
 * One datum, one channel per state — the estate's trap 21 read forwards.
 *
 * ⛔ THIS IS ALSO THE SIZE RULING THE CODE ASKED FOR. StyledEdge's own comment
 * said "⭐ NEEDS A SIZE RULING. Once ruled, route it through a token." Ruled:
 * `typography.edgeLabel`, the same canvas token its four sibling edge-label
 * sites already use. 16px fixed becomes 10px counter-scaled — 8.0px -> 10px
 * apparent at the 0.50 auto-fit floor, and 16px -> 10px at zoom 1.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'
import { typography } from '../../../styles/typography'

let mockReport: Record<string, unknown> | null = null
let mockEdges: Array<Record<string, unknown>> = []
let mockViewMode = 'standard'
let mockStatus = 'complete'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: () => <path data-testid="base-edge" />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({
      getNode: () => null,
      getEdges: () => mockEdges,
      getNodes: () => [],
    }),
    useStore: (selector: any) => selector({ nodes: [] }),
  }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      results: { status: mockStatus, report: mockReport },
      viewMode: mockViewMode,
      hoveredOptionId: null,
      highlightedEdges: new Set<string>(),
      dimmedEdgeIds: new Set<string>(),
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
  existenceCertaintyToLineStyle: () => 'solid',
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

const EDGE_DATA = {
  strength_mean: 0.6,
  effect_direction: 'positive' as const,
  exists_probability: 0.8,
}

const props = {
  id: 'e1',
  source: 'n1',
  target: 'n2',
  sourceX: 0,
  sourceY: 0,
  targetX: 100,
  targetY: 100,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  selected: false,
  data: EDGE_DATA,
}

/** Bound by its accessible name — the four existing binding specs use this. */
const glyph = (c: HTMLElement) =>
  c.querySelector('[aria-label^="Effect direction:"]') as HTMLElement | null
const strengthText = (c: HTMLElement) =>
  c.querySelector('[data-testid="edge-influence-label-text"]') as HTMLElement | null

function pinAsTopStrength(): void {
  mockEdges = [{ id: 'e1', source: 'n1', target: 'n2', data: EDGE_DATA }]
}

beforeEach(() => {
  mockReport = null
  mockEdges = []
  mockViewMode = 'standard'
  mockStatus = 'complete'
})

describe('polarity glyph — suppressed only where a persistent chip already says it', () => {
  it('THE DEFECT: beside a PERSISTENT strength row the glyph is gone, and the WORD carries direction', () => {
    pinAsTopStrength()
    const { container } = render(<StyledEdge {...(props as any)} />)

    // The word is doing the job…
    expect(strengthText(container)!.textContent).toMatch(/boost|drag/)
    // …so the glyph does not repeat it.
    expect(glyph(container)).toBeNull()
  })

  it('CONTROL: a TRANSIENT chip (selected, Detailed) KEEPS the glyph', () => {
    // getEdges is empty, so this edge is NOT in the persistent set; the chip
    // is interaction-driven and disappears the moment selection does.
    mockViewMode = 'detailed'
    const { container } = render(<StyledEdge {...(props as any)} selected />)

    expect(strengthText(container), 'the transient chip did not render').not.toBeNull()
    expect(glyph(container), 'the glyph must survive beside a transient chip').not.toBeNull()
  })

  it('CONTROL: pre-run (no completed analysis) keeps the glyph', () => {
    mockStatus = 'idle'
    const { container } = render(<StyledEdge {...(props as any)} />)

    expect(strengthText(container)).toBeNull()
    expect(glyph(container)).not.toBeNull()
  })

  it('CONTROL: an edge with no chip at all keeps the glyph', () => {
    const { container } = render(<StyledEdge {...(props as any)} />)
    expect(strengthText(container)).toBeNull()
    expect(glyph(container)).not.toBeNull()
  })

  it('THE SIZE RULING: the glyph carries no inline size, weight, colour or chip surface', () => {
    const { container } = render(<StyledEdge {...(props as any)} />)
    const el = glyph(container)!

    expect(el.style.fontSize).toBe('')
    expect(el.style.fontWeight).toBe('')
    expect(el.style.color).toBe('')
    expect(el.style.backgroundColor).toBe('')
    // The chip surface goes too — it was chrome around a single character.
    expect(el.style.padding).toBe('')
    expect(el.style.borderRadius).toBe('')
  })

  it('THE SIZE RULING: the glyph is routed through the canvas token, READ from typography.ts', () => {
    const { container } = render(<StyledEdge {...(props as any)} />)
    const el = glyph(container)!

    // Read, never restated — a hand-copied class string is the mirror defect
    // this estate keeps paying for.
    for (const token of typography.edgeLabel.split(/\s+/).filter(Boolean)) {
      expect(el.className, `missing token ${token}`).toContain(token)
    }
  })

  it('the glyph still says which direction it means', () => {
    const { container } = render(<StyledEdge {...(props as any)} />)
    expect(glyph(container)!.getAttribute('aria-label')).toBe('Effect direction: positive')
    expect(glyph(container)!.textContent).toBe('+')
  })
})
