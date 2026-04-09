/**
 * Graph v2 Task 2 — Structural vs causal edge differentiation.
 *
 * Verifies that StyledEdge renders structural edges (decision→option,
 * option→factor) as thin 1px solid grey with no custom popover and a native
 * <title> tooltip on the hitbox, and that causal edges keep their existing
 * thickness/colour/popover behaviour.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'

// ── Node kind registry — switched per-test ───────────────────────────────────
const nodeKinds: Record<string, string> = {}

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    // Pass style + onMouseEnter through to a real path so we can assert on it
    BaseEdge: ({ style }: any) => (
      <path
        data-testid="base-edge"
        style={style}
      />
    ),
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({
      getNode: (id: string) =>
        nodeKinds[id]
          ? {
              id,
              type: nodeKinds[id],
              data: {},
              position: { x: 0, y: 0 },
              measured: { width: 200, height: 80 },
            }
          : null,
      getEdges: () => [],
    }),
  }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      results: { status: 'idle', report: null },
      hoveredOptionId: null,
      highlightedEdges: new Set<string>(),
      dimmedEdgeIds: new Set<string>(),
      viewMode: 'standard',
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

vi.mock('../../utils/fragileEdgeMatch', () => ({
  isEdgeFragile: () => false,
  getFragileEdgeSwitchProbability: () => null,
}))

vi.mock('../../utils/graphDisplayCalculations', () => ({
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

const baseEdgeProps = {
  id: 'e1',
  source: 'src',
  target: 'tgt',
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

describe('StyledEdge — structural vs causal differentiation', () => {
  beforeEach(() => {
    for (const k of Object.keys(nodeKinds)) delete nodeKinds[k]
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('decision→option edge: thin 1px grey, solid, no custom popover, native <title> tooltip', () => {
    nodeKinds.src = 'decision'
    nodeKinds.tgt = 'option'

    const { container } = render(<StyledEdge {...baseEdgeProps as any} />)

    // BaseEdge style assertions
    const baseEdge = container.querySelector('[data-testid="base-edge"]') as SVGPathElement | null
    expect(baseEdge).not.toBeNull()
    const style = (baseEdge as unknown as HTMLElement).style
    expect(style.strokeWidth).toBe('1')
    // Tailwind/CSS may convert hex to rgb in some browsers; jsdom keeps the
    // raw value, but defensive comparison strips whitespace and case.
    expect(style.stroke.toLowerCase()).toBe('#7a7a7a')
    expect(style.strokeDasharray).toBe('')

    // Native <title> child on the hitbox path
    const hitPath = container.querySelector('path[stroke="transparent"]')
    expect(hitPath).not.toBeNull()
    const titleEl = hitPath!.querySelector('title')
    expect(titleEl).not.toBeNull()
    expect(titleEl!.textContent).toBe('Option of this decision')

    // Hover does not produce a custom popover overlay even after the timer
    act(() => {
      fireEvent.mouseEnter(hitPath!)
      vi.advanceTimersByTime(500)
    })
    expect(container.querySelector('[data-testid="edge-hover-popover"]')).toBeNull()
  })

  it('option→factor edge: thin 1px grey, intervention tooltip', () => {
    nodeKinds.src = 'option'
    nodeKinds.tgt = 'factor'

    const { container } = render(<StyledEdge {...baseEdgeProps as any} />)

    const baseEdge = container.querySelector('[data-testid="base-edge"]') as SVGPathElement | null
    const style = (baseEdge as unknown as HTMLElement).style
    expect(style.strokeWidth).toBe('1')
    expect(style.stroke.toLowerCase()).toBe('#7a7a7a')

    const hitPath = container.querySelector('path[stroke="transparent"]')
    const titleEl = hitPath!.querySelector('title')
    expect(titleEl!.textContent).toBe('This option affects this factor')
  })

  it('factor→outcome edge: causal styling, NOT grey, no native title', () => {
    nodeKinds.src = 'factor'
    nodeKinds.tgt = 'outcome'

    const { container } = render(<StyledEdge {...baseEdgeProps as any} />)

    const baseEdge = container.querySelector('[data-testid="base-edge"]') as SVGPathElement | null
    const style = (baseEdge as unknown as HTMLElement).style
    // Causal: not the structural grey
    expect(style.stroke.toLowerCase()).not.toBe('#7a7a7a')
    // Causal stroke width is > 1 (the importanceToStrokeWidth mock returns 2)
    const widthNum = parseFloat(style.strokeWidth)
    expect(widthNum).toBeGreaterThan(1)

    // No native title on the hitbox
    const hitPath = container.querySelector('path[stroke="transparent"]')
    expect(hitPath!.querySelector('title')).toBeNull()
  })

  it('explicit data.edge_type === "structural" forces structural styling regardless of node kinds', () => {
    nodeKinds.src = 'factor'
    nodeKinds.tgt = 'outcome'

    const { container } = render(
      <StyledEdge
        {...baseEdgeProps as any}
        data={{ ...baseEdgeProps.data, edge_type: 'structural' }}
      />
    )

    const baseEdge = container.querySelector('[data-testid="base-edge"]') as SVGPathElement | null
    const style = (baseEdge as unknown as HTMLElement).style
    expect(style.strokeWidth).toBe('1')
    expect(style.stroke.toLowerCase()).toBe('#7a7a7a')
  })

  it('explicit data.edge_type === "bidirected" keeps causal styling (special path preserved)', () => {
    nodeKinds.src = 'factor'
    nodeKinds.tgt = 'outcome'

    const { container } = render(
      <StyledEdge
        {...baseEdgeProps as any}
        data={{ ...baseEdgeProps.data, edge_type: 'bidirected' }}
      />
    )

    const baseEdge = container.querySelector('[data-testid="base-edge"]') as SVGPathElement | null
    const style = (baseEdge as unknown as HTMLElement).style
    expect(style.stroke.toLowerCase()).not.toBe('#7a7a7a')
  })
})
