/**
 * ONE PLACED CHIP PER EDGE.
 *
 * The founder's 31 Aug screenshot carried three separate reports, and two of
 * them are this one defect: "Sensitive · 49%" floating on the left with no
 * visible referent, and a weight label detached below the goal card. The
 * fragility badge rendered as its own `EdgeLabelRenderer` sibling at a
 * HARD-CODED `labelX + 30`, so it never entered
 * `resolvePersistentLabelPlacements` and could not dodge anything — while
 * DESIGN_SYSTEM.md's "Edge-label signals" section said "stacking is spaced by
 * edgeLabelCollision.ts". That sentence was FALSE for this badge, and these
 * pins are what make it true.
 *
 * The chip is a CONTAINER, not a fourth signal: each row keeps its own text,
 * its own owner and its own title.
 *
 * ⛔ BINDING. Every assertion binds by test id, never by matching text — three
 * components in this tree carry `role="note"` and the word "Sensitive" appears
 * in the hover popover too (CLAUDE.md trap 19).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'

let mockReport: Record<string, unknown> | null = null
let mockEdges: Array<Record<string, unknown>> = []
let mockViewMode = 'detailed'
let mockStatus = 'complete'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: () => <path data-testid="base-edge" />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    // labelX = 50, labelY = 50 — so the deleted badge offset would be 80px.
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

/** A CEE-sourced edge: strength 0.6, stated positive, belief 0.8. */
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

const chip = (c: HTMLElement) =>
  c.querySelector('[data-testid="edge-influence-label"]') as HTMLElement | null
const chips = (c: HTMLElement) =>
  c.querySelectorAll('[data-testid="edge-influence-label"]')
const fragileTag = (c: HTMLElement) =>
  c.querySelector('[data-testid="edge-fragile-tag"]') as HTMLElement | null
const strengthText = (c: HTMLElement) =>
  c.querySelector('[data-testid="edge-influence-label-text"]') as HTMLElement | null

/** Make this edge one of the persistent top-strength set. */
function pinAsTopStrength(): void {
  mockEdges = [{ id: 'e1', source: 'n1', target: 'n2', data: EDGE_DATA }]
}
function setFragile(entries: Array<Record<string, unknown>>): void {
  mockReport = { robustness: { fragile_edges: entries } }
}

beforeEach(() => {
  mockReport = null
  mockEdges = []
  mockViewMode = 'detailed'
  mockStatus = 'complete'
})

describe('StyledEdge — one placed chip per edge', () => {
  it('a FRAGILE-ONLY edge renders exactly one chip, and that chip IS the old badge', () => {
    setFragile([{ edge_id: 'e1', switch_probability: 0.49 }])
    const { container } = render(<StyledEdge {...(props as any)} />)

    expect(chips(container).length).toBe(1)
    const tag = fragileTag(container)
    expect(tag, 'the fragility row did not render').not.toBeNull()
    // It lives INSIDE the placed chip — not as a free-floating sibling.
    expect(chip(container)!.contains(tag!)).toBe(true)
    // Verbatim, unchanged copy.
    expect(tag!.textContent).toContain('Sensitive · 49%')
    // …and no strength row, because this edge is not in the persistent set.
    expect(strengthText(container)).toBeNull()
  })

  it('a TOP-STRENGTH + FRAGILE edge puts BOTH rows in ONE element', () => {
    pinAsTopStrength()
    setFragile([{ edge_id: 'e1', switch_probability: 0.49 }])
    const { container } = render(<StyledEdge {...(props as any)} />)

    expect(chips(container).length).toBe(1)
    const el = chip(container)!
    expect(el.contains(strengthText(container)!)).toBe(true)
    expect(el.contains(fragileTag(container)!)).toBe(true)
    expect(strengthText(container)!.textContent).toContain('boost')
    expect(fragileTag(container)!.textContent).toContain('Sensitive · 49%')
  })

  it('THE DELETED OFFSET: no element in the tree is transformed to labelX + 30', () => {
    pinAsTopStrength()
    setFragile([{ edge_id: 'e1', switch_probability: 0.49 }])
    const { container } = render(<StyledEdge {...(props as any)} />)

    // labelX is 50, so the standalone badge painted at 80px. Nothing may.
    const transformed = [...container.querySelectorAll<HTMLElement>('[style*="translate"]')]
    expect(transformed.length).toBeGreaterThan(0) // the probe can see SOMETHING
    for (const el of transformed) {
      expect(el.style.transform).not.toContain('80px')
    }
  })

  it('the chip title carries BOTH sentences, and the fragile row keeps its OWN title', () => {
    pinAsTopStrength()
    setFragile([{ edge_id: 'e1', switch_probability: 0.49 }])
    const { container } = render(<StyledEdge {...(props as any)} />)

    const containerTitle = chip(container)!.getAttribute('title') ?? ''
    expect(containerTitle).toContain('Moderate boost')
    expect(containerTitle).toContain('49% chance the result flips')

    // Each row keeps its own owner and its own title — the chip is a
    // container, not a fourth signal.
    expect(fragileTag(container)!.getAttribute('title')).toBe(
      'Sensitive assumption: 49% chance the result flips if this relationship changes',
    )
  })

  it('CONTROL: a top-strength edge that is NOT fragile renders the strength row alone', () => {
    pinAsTopStrength()
    const { container } = render(<StyledEdge {...(props as any)} />)

    expect(chips(container).length).toBe(1)
    expect(strengthText(container)).not.toBeNull()
    expect(fragileTag(container)).toBeNull()
    expect(chip(container)!.getAttribute('title')).not.toContain('Sensitive assumption')
  })

  it('CONTROL: an edge that is neither top-strength nor fragile renders NO chip', () => {
    const { container } = render(<StyledEdge {...(props as any)} />)
    expect(chips(container).length).toBe(0)
  })
})
