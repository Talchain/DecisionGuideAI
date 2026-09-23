/**
 * StyledEdge — the fragility row is an EXCEPTION CUE, and an exception cue must
 * not paint as a microscopic icon at the far (`line`) rung of the semantic-zoom
 * ladder (Paul, 23 Sep 2026, D3 · Connectors, item 6).
 *
 * The rung is the store's `lodRung` ('full' | 'quiet' | 'line'), written by
 * `components/LodSync.tsx` from the live viewport. At `line` the cards have
 * already blanked their bodies (`lodBodyHiddenAt`); an edge chip carrying a
 * 12px triangle and "Sensitive · 42%" at that scale is a speck, not a cue.
 *
 * What this pins, and nothing more:
 *   (e) at `line` the fragility row — and a chip that holds only that row — is
 *       absent;
 *   (e) CONTROL at `quiet`, `full`, and with the slice absent (a store double
 *       that never set it), the row renders exactly as before;
 *   CONTROL the cue is not LOST at `line`: the user-summoned hover popover
 *       still says "Sensitive", unchanged.
 *
 * fragileEdgeMatch is deliberately NOT mocked — the real membership rule
 * decides which edge is fragile, as in `StyledEdge.fragilePresence.spec.tsx`,
 * whose mock structure this file follows.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act, screen } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'

let mockReport: Record<string, unknown> | null = null
/** `undefined` models a store double that never set the slice. */
let mockLodRung: 'full' | 'quiet' | 'line' | undefined = 'full'
let mockViewMode: 'standard' | 'detailed' = 'detailed'

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
      getEdges: () => [],
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
      results: { status: 'complete', report: mockReport },
      viewMode: mockViewMode,
      ...(mockLodRung === undefined ? {} : { lodRung: mockLodRung }),
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
    }),
  ),
}))

vi.mock('../../store/edgeLabelMode', () => ({
  useEdgeLabelMode: vi.fn((selector: any) => selector({ mode: 'human' })),
}))
vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
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

const edgeProps = {
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
  data: { weight: 0.6, direction: 'positive' as const, beliefExists: 0.8 },
}

beforeEach(() => {
  vi.useFakeTimers()
  // A MEASURED switch probability, above the UI-SEM-013 cut: the edge is
  // fragile by the real rule, and the top (only) fragile edge.
  mockReport = { robustness: { fragile_edges: [{ edge_id: 'e1', switch_probability: 0.42 }] } }
  mockLodRung = 'full'
  mockViewMode = 'detailed'
})

afterEach(() => {
  vi.useRealTimers()
})

describe('StyledEdge — the fragility row at each semantic-zoom rung', () => {
  it.each(['detailed', 'standard'] as const)(
    '(e) at rung "line" the fragility row is ABSENT, and so is a chip that held only it (%s view)',
    (view) => {
      mockViewMode = view
      mockLodRung = 'line'
      render(<StyledEdge {...(edgeProps as any)} />)
      expect(screen.queryByTestId('edge-fragile-tag')).toBeNull()
      // The row was this chip's only content (no strength row: no top-strength
      // set, not selected, not hovered), so the container must go too — an
      // empty bordered plate is a speck of its own.
      expect(screen.queryByTestId('edge-influence-label')).toBeNull()
    },
  )

  it.each([
    ['full', 'detailed'],
    ['quiet', 'detailed'],
    ['full', 'standard'],
    ['quiet', 'standard'],
  ] as const)('(e) CONTROL: at rung "%s" the fragility row renders as before (%s view)', (rung, view) => {
    mockLodRung = rung
    mockViewMode = view
    render(<StyledEdge {...(edgeProps as any)} />)
    const row = screen.getByTestId('edge-fragile-tag')
    expect(row.textContent).toContain('Sensitive')
    expect(row.textContent).toContain('42%')
    // The AlertTriangle glyph is still the row's first mark.
    expect(row.querySelector('svg')).not.toBeNull()
  })

  it('(e) CONTROL: a store double with NO rung slice renders the row (absent = full, never line)', () => {
    mockLodRung = undefined
    render(<StyledEdge {...(edgeProps as any)} />)
    expect(screen.getByTestId('edge-fragile-tag')).toBeInTheDocument()
  })

  it('CONTROL: the cue is not LOST at "line" — the hover popover still names it', () => {
    mockLodRung = 'line'
    const { container } = render(<StyledEdge {...(edgeProps as any)} />)
    const hitPath = container.querySelector('path[stroke="transparent"]')
    expect(hitPath).not.toBeNull()
    act(() => {
      fireEvent.mouseEnter(hitPath!)
    })
    act(() => {
      vi.advanceTimersByTime(350)
    })
    const popover = screen.getByTestId('edge-hover-popover')
    expect(popover.textContent).toContain('Sensitive')
    expect(popover.textContent).toContain('42% flip risk')
  })
})
