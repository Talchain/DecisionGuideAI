/**
 * ⛔ THE SERVED FRAGILE ROW SHAPE RESOLVES ON THE MOUNTED EDGE, AND ITS LENS
 * LABEL IS THE WITHHELD FORM.
 *
 * CEE `0303ef5` pricing: drafted edges carry no id (canvas `e-N`), and the row's
 * `edge_id` is the producer's `"<from>-><to>"` relationship key (pre-review
 * 5828017429). With #2002's matcher the mounted StyledEdge resolves the row, so
 * the lens hover names the alternative, in #2001's withheld form.
 *
 * A separate file from #2001's `StyledEdge.lensFragileNamesNoWinner.spec.tsx`,
 * so that file lands byte-identical from both branches (a squash of #2001 plus
 * an edit here would otherwise be an add/add conflict). The harness is that
 * spec's (the lens flag ON, the deployed posture).
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

describe('the lens fragile-edge label on the served row shape', () => {
  it('⭐ the served row shape (composite relationship key, local edge id) resolves, in the withheld form', () => {
    // CEE 0303ef5 pricing: drafted edges have no id (canvas `e-N`); the row's
    // `edge_id` is the producer's `"<from>-><to>"` key (pre-review 5828017429).
    holder.fragileEntry = { edge_id: 'src->tgt', from_id: 'src', to_id: 'tgt', switch_probability: 0.5504, alternative_winner_label: 'Keep £49 Price' }
    const text = renderEdge()
    expect(text).toContain('The comparison could shift towards Keep £49 Price')
    expect(text).not.toMatch(/If wrong/)
  })

})
