/**
 * ⛔ THE FRAGILE-EDGE HOVER LABEL NAMES THE ALTERNATIVE WITHOUT A WINNER VERB.
 *
 * AI Quality's audit of served UI `b017e3c2`, row L3 (#69 5827943157): hovering
 * a fragile edge in the robustness lens rendered "If wrong → {alt}", which
 * presupposes a leader to flip from on a run whose ranking the producer may have
 * withheld. The register's withheld form is "the comparison could shift towards
 * {alt}" (`fragileEdgeCopy.ts`), which is true on a permitted run too.
 *
 * Harness: the mock pattern of `StyledEdge.causalLens.2954.spec.tsx`, with the
 * lens flag ON (the deployed posture), the robustness lens active, and this edge
 * in `_fragileEdgeIds`. The label renders on hover/selection; `selected: true`.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { Position } from '@xyflow/react'
import { StyledEdge } from '../StyledEdge'

const holder = vi.hoisted(() => ({
  fragileEntry: null as Record<string, unknown> | null,
  lensActive: 'robustness' as string,
}))

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  const nodes = [
    { id: 'src', type: 'factor', data: { label: 'Price' }, position: { x: 0, y: 0 }, measured: { width: 200, height: 80 } },
    { id: 'tgt', type: 'outcome', data: { label: 'Revenue' }, position: { x: 0, y: 0 }, measured: { width: 200, height: 80 } },
  ]
  return {
    ...actual,
    BaseEdge: () => <path data-testid="base-edge" />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({
      getNode: (id: string) => nodes.find((n) => n.id === id) ?? null,
      getEdges: () => [],
      getNodes: () => nodes,
    }),
    useStore: (selector: any) => selector({ nodes }),
  }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      results: {
        status: 'complete',
        report: { robustness: { fragile_edges: holder.fragileEntry ? [holder.fragileEntry] : [] } },
      },
      hoveredOptionId: null,
      highlightedEdges: new Set<string>(),
      dimmedEdgeIds: new Set<string>(),
      viewMode: 'detailed',
      lens: {
        active: holder.lensActive,
        _dimmedEdgeIds: new Set<string>(),
        _sensitivityWeights: new Map<string, number>(),
        _sensitivityQuartiles: null,
        _fragileEdgeIds: new Set<string>(['e-under-test']),
        _lensFragileLabels: new Map<string, string>(),
        _hiddenNodeIds: new Set<string>(),
        _hiddenEdgeIds: new Set<string>(),
        _causalEdgeParams: new Map(),
        _evidenceNodeClass: new Map(),
        _evidenceEdgeClass: new Map(),
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
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => true }))
vi.mock('../../theme/edges', () => ({ applyEdgeVisualProps: (_: any, props: any) => props }))

const props = {
  id: 'e-under-test', source: 'src', target: 'tgt',
  sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
  sourcePosition: Position.Right, targetPosition: Position.Left,
  selected: true,
  data: { weight: 0.6, belief: 0.8 },
}

function renderEdge(): string {
  const { container } = render(<svg><StyledEdge {...(props as any)} /></svg>)
  return container.textContent ?? ''
}

describe('the lens fragile-edge label names the alternative without a winner verb', () => {
  it('⭐ an entry with an alternative renders the withheld form', () => {
    holder.fragileEntry = { edge_id: 'e-under-test', from_id: 'src', to_id: 'tgt', switch_probability: 0.85, alternative_winner_label: 'Plan B' }
    const text = renderEdge()
    expect(text).toContain('The comparison could shift towards Plan B')
    expect(text).not.toMatch(/If wrong/)
    expect(text).not.toMatch(/→\s*Plan B/)
  })

  it('CONTROL — an entry with no alternative keeps the existing "Sensitive" word', () => {
    holder.fragileEntry = { edge_id: 'e-under-test', from_id: 'src', to_id: 'tgt', switch_probability: 0.85 }
    const text = renderEdge()
    expect(text).toContain('Sensitive')
    expect(text).not.toMatch(/If wrong/)
  })

  it('CONTROL — outside the fragile lens, no label renders at all', () => {
    holder.lensActive = 'full'
    holder.fragileEntry = { edge_id: 'e-under-test', from_id: 'src', to_id: 'tgt', switch_probability: 0.85, alternative_winner_label: 'Plan B' }
    try {
      expect(renderEdge()).not.toContain('Plan B')
    } finally {
      holder.lensActive = 'robustness'
    }
  })
})
