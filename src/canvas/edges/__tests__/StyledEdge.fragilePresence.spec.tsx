/**
 * StyledEdge fragility badge + hover popover — switch_probability presence
 * pins (marginal-quantity honesty batch; same class as #543).
 *
 * Contract (vendored @talchain/schemas 0.30.0): switch_probability ABSENT
 * means NOT COMPUTED; marginal_switch_probability is a DIFFERENT Monte Carlo,
 * never a fallback. The badge "Sensitive · NN%" (+ its title sentence) and
 * the hover popover "Sensitive: NN% flip risk" must render ONLY a measured
 * value — a marginal-only fragile edge still badges as Sensitive (matching
 * tier keeps marginal eligibility, rowed) but shows no number. Both render
 * sites already presence-branch on `!== null` with honest-absence copy; the
 * defect was the shared accessor (getFragileEdgeSwitchProbability) coalescing
 * the marginal. fragileEdgeMatch is deliberately NOT mocked here — the real
 * accessor is the unit under test.
 *
 * ReactFlow/store mock structure follows StyledEdge.hover.spec.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act, screen } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'

// Mutable per-test report — the store mock factory reads it at selector time.
let mockReport: Record<string, unknown> | null = null

// ── ReactFlow mocks (as in StyledEdge.hover.spec.tsx) ────────────────────────
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
      viewMode: 'detailed',
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

vi.mock('../../hooks/useTheme', () => ({
  useIsDark: () => false,
}))

vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))

vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => false,
}))

vi.mock('../../../flags', () => ({
  isGraphLensEnabled: () => false,
}))

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

const defaultEdgeProps = {
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
  data: {
    weight: 0.6,
    direction: 'positive' as const,
    beliefExists: 0.8,
  },
}

function setFragileEdges(fragileEdges: Array<Record<string, unknown>>): void {
  mockReport = { robustness: { fragile_edges: fragileEdges } }
}

function openHoverPopover(container: HTMLElement): void {
  const hitPath = container.querySelector('path[stroke="transparent"]')
  expect(hitPath).not.toBeNull()
  act(() => {
    fireEvent.mouseEnter(hitPath!)
  })
  act(() => {
    vi.advanceTimersByTime(350)
  })
}

describe('StyledEdge — fragility number presence-branches on measured switch_probability', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockReport = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('PIN (badge): a marginal-only fragile edge badges "Sensitive" with NO percentage and the honest-absence title', () => {
    setFragileEdges([{ edge_id: 'e1', marginal_switch_probability: 0.9 }])
    render(<StyledEdge {...(defaultEdgeProps as any)} />)
    const badge = screen.getByText(/Sensitive/)
    expect(badge.textContent).not.toContain('90%')
    expect(badge.textContent).not.toMatch(/·\s*\d+%/)
    const titled = badge.closest('[title]')
    expect(titled?.getAttribute('title')).toBe(
      'Sensitive assumption: outcome may flip if this relationship changes',
    )
  })

  it('PIN (popover): a marginal-only fragile edge hovers to "Sensitive" with NO flip-risk percentage', () => {
    setFragileEdges([{ edge_id: 'e1', marginal_switch_probability: 0.9 }])
    const { container } = render(<StyledEdge {...(defaultEdgeProps as any)} />)
    openHoverPopover(container)
    const popover = screen.getByTestId('edge-hover-popover')
    expect(popover.textContent).toContain('Sensitive')
    expect(popover.textContent).not.toContain('flip risk')
    expect(popover.textContent).not.toContain('90%')
  })

  it('CONTROL (badge): a measured switch_probability still renders "Sensitive · NN%" and the quantified title', () => {
    setFragileEdges([{ edge_id: 'e1', switch_probability: 0.42, marginal_switch_probability: 0.9 }])
    render(<StyledEdge {...(defaultEdgeProps as any)} />)
    const badge = screen.getByText(/Sensitive/)
    expect(badge.textContent).toContain('42%')
    expect(badge.textContent).not.toContain('90%')
    const titled = badge.closest('[title]')
    expect(titled?.getAttribute('title')).toContain('42% chance the result flips')
  })

  it('CONTROL (popover): a measured switch_probability still renders "NN% flip risk"', () => {
    setFragileEdges([{ edge_id: 'e1', switch_probability: 0.42, marginal_switch_probability: 0.9 }])
    const { container } = render(<StyledEdge {...(defaultEdgeProps as any)} />)
    openHoverPopover(container)
    const popover = screen.getByTestId('edge-hover-popover')
    expect(popover.textContent).toContain('42% flip risk')
    expect(popover.textContent).not.toContain('90%')
  })

  it('CONTROL: a measured 0 is a measurement — not fragile, no badge, never resurrected by marginal', () => {
    setFragileEdges([{ edge_id: 'e1', switch_probability: 0, marginal_switch_probability: 0.9 }])
    render(<StyledEdge {...(defaultEdgeProps as any)} />)
    expect(screen.queryByText(/Sensitive/)).toBeNull()
  })
})
