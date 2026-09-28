/**
 * ⭐ THE FRAGILE-EDGE DISC SITS AT ITS CONNECTION'S MIDPOINT — the rendered
 * component, on Paul's real `mrr-90b8f080` board (post-run DIFF item 12,
 * 27 Sep 2026; contract v3.1 `renderEdges`: the cue at `(ax+bx)/2, (ay+by)/2`).
 *
 * The DIFF measured the served disc at the GOAL ARRIVAL of "Pro plan price →
 * MRR" (x 489.6, y 745.2 at landing; 0.95 of the way along), beside the goal
 * glyph and the `+ +` row: the disc rode the edge-label placement, whose anchor
 * on a long-lead path is the short cubic just above the target.
 *
 * ⚠ REAL, NOT HAND-AUTHORED: the store is seeded the way the geometry harness
 * seeds it (`applyDraftResult`, then the board's real `analysis_result` through
 * `applyV5State`), and every card gets the box the route resolvers read in
 * Chromium at landing (`fixtures/fragileCueLanding.geometry.json`). The edge is
 * rendered at the endpoints xyflow gave it there, and the expected point is the
 * BROWSER's own `getPointAtLength(L/2)` on the path it drew — not a number this
 * file computes.
 *
 * CLAIM SCOPE: jsdom — the disc's inline transform (its centre in graph units).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { Position } from '@xyflow/react'
import geometry from './fixtures/fragileCueLanding.geometry.json'
import fx90b8 from '../../../../e2e/geometry/fixtures/mrr-90b8f080.fixture.json'

const rf = vi.hoisted(() => ({
  getNodes: (() => []) as () => unknown[],
  getEdges: (() => []) as () => unknown[],
}))
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react')
  return {
    ...actual,
    BaseEdge: ({ path }: { path: string }) => <path data-testid="base-edge" d={path} />,
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    useReactFlow: () => ({
      getNode: (id: string) => (rf.getNodes() as Array<{ id: string }>).find((n) => n.id === id) ?? null,
      getEdges: () => rf.getEdges(),
      getNodes: () => rf.getNodes(),
    }),
    // The route resolvers read the xyflow store's nodes: the same boxed nodes.
    useStore: (selector: (s: unknown) => unknown) => selector({ nodes: rf.getNodes(), edges: rf.getEdges() }),
  }
})
vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../hooks/useFirstTimeHints', () => ({ useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }) }))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphLensEnabled: () => false,
}))

import { useCanvasStore } from '../../store'
import { applyDraftResult } from '../../utils/applyDraftResult'
import { applyV5State } from '../../../v5/applyV5State'
import { StyledEdge } from '../StyledEdge'

type Json = Record<string, unknown>
type Box = { x: number; y: number; width: number; height: number }
type GeoBoard = {
  nodes: Array<{ id: string; box: Box }>
  fragileEdges: Array<{ id: string; source: string; target: string; d: string; L: number; midGraph: { x: number; y: number } }>
}
const BOARD = (geometry as unknown as { boards: Record<string, GeoBoard> }).boards['mrr-90b8f080']
const INITIAL = useCanvasStore.getState()

function seed(): void {
  const f = fx90b8 as unknown as { draft: Json; analysis_block: Json; analysis_ready: Json; analysis_state: Json; graph_hash: string }
  applyDraftResult(JSON.parse(JSON.stringify(f.draft)) as never, { skipHistory: true, skipAutosave: true })
  const snap = useCanvasStore.getState()
  const envelope = {
    response_version: 2, assistant_text: '', blocks: [f.analysis_block], suggested_actions: [], insights: [],
    stage_indicator: 'analyse', analysis_ready: f.analysis_ready, analysis_state: f.analysis_state, graph_hash: f.graph_hash,
  }
  const out = applyV5State(
    JSON.parse(JSON.stringify(envelope)) as never,
    { ...snap, currentResultsHash: (snap.results as { hash?: string } | null)?.hash ?? null, backfillGoalThreshold: () => {} } as never,
    { turnClientId: 'spec', currentClientTurnId: 'spec' },
  )
  expect(out.applied, 'the run did not hydrate results').toContain('analysis_result:results_hydrated')
  // Every card at its landing box (the store position + measured the resolvers read in Chromium).
  const boxes = new Map(BOARD.nodes.map((n) => [n.id, n.box]))
  useCanvasStore.setState({
    nodes: (useCanvasStore.getState().nodes as Array<{ id: string }>).map((n) => {
      const b = boxes.get(n.id)
      return b ? { ...n, position: { x: b.x, y: b.y }, measured: { width: b.width, height: b.height }, width: b.width, height: b.height } : n
    }),
    viewMode: 'standard',
  } as never)
}

/** The endpoints xyflow drew the edge between, read off the captured path. */
function endpoints(d: string) {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
  return { sx: nums[0], sy: nums[1], tx: nums[nums.length - 2], ty: nums[nums.length - 1] }
}

function renderFragileEdge(edgeId: string) {
  const e = (useCanvasStore.getState().edges as Array<{ id: string; source: string; target: string; data?: unknown }>).find((x) => x.id === edgeId)!
  const drawn = BOARD.fragileEdges.find((x) => x.id === edgeId)!
  const { sx, sy, tx, ty } = endpoints(drawn.d)
  return render(
    <StyledEdge
      {...({
        id: e.id, source: e.source, target: e.target, data: e.data,
        sourceX: sx, sourceY: sy, targetX: tx, targetY: ty,
        sourcePosition: Position.Bottom, targetPosition: Position.Top, selected: false,
      } as unknown as ComponentProps<typeof StyledEdge>)}
    />,
  )
}

/** The disc's centre in graph units, from its inline transform. */
function discCentre(container: HTMLElement): { x: number; y: number } {
  const disc = container.querySelector('[data-fragile-cue="disc"]') as HTMLElement | null
  expect(disc, 'the top fragile edge paints its disc').not.toBeNull()
  const m = disc!.style.transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/)
  expect(m, disc!.style.transform).not.toBeNull()
  return { x: Number(m![1]), y: Number(m![2]) }
}

beforeEach(() => {
  useCanvasStore.setState(INITIAL, true)
  rf.getNodes = () => useCanvasStore.getState().nodes as unknown[]
  rf.getEdges = () => useCanvasStore.getState().edges as unknown[]
})
afterEach(() => cleanup())

describe('⭐ 90b8 Standard: the top fragile edge\'s disc sits at the midpoint of the path it is drawn on', () => {
  it('PRECONDITION: the component draws the same path Chromium drew for Pro plan price → MRR', () => {
    seed()
    const { getByTestId } = renderFragileEdge('e-6')
    const drawn = BOARD.fragileEdges.find((x) => x.id === 'e-6')!
    const rendered = getByTestId('base-edge').getAttribute('d')!
    // Same lead path (numbers rounded differently by the two writers).
    const n = (s: string) => s.match(/-?\d+(?:\.\d+)?/g)!.map((v) => Math.round(Number(v)))
    expect(n(rendered)).toEqual(n(drawn.d))
  })

  it('Pro plan price → MRR: the disc is at the browser\'s own midpoint of that path, not at the Goal arrival', () => {
    seed()
    const { container } = renderFragileEdge('e-6')
    const c = discCentre(container)
    const mid = BOARD.fragileEdges.find((x) => x.id === 'e-6')!.midGraph
    expect(Math.hypot(c.x - mid.x, c.y - mid.y)).toBeLessThan(0.5)
    // …and nowhere near the Goal card's top (its routed box in the fixture), where it was.
    const goalTop = BOARD.nodes.find((n) => n.id === 'mrr')!.box.y
    expect(c.y).toBeLessThan(goalTop - 200)
  })

  it('the disc keeps its stale "Last run ·" name when the model changes (#2218 / row 38, unchanged)', () => {
    seed()
    useCanvasStore.getState().markAnalysisFreshnessDirty()
    const { container } = renderFragileEdge('e-6')
    const disc = container.querySelector('[data-fragile-cue="disc"]')!
    expect(disc.getAttribute('aria-label')!.startsWith('Last run · ')).toBe(true)
    const c = discCentre(container)
    const mid = BOARD.fragileEdges.find((x) => x.id === 'e-6')!.midGraph
    expect(Math.hypot(c.x - mid.x, c.y - mid.y)).toBeLessThan(0.5)
  })

  it('CONTROL — the second fragile edge (0.27) carries no disc in Standard: the budget is unchanged (E4)', () => {
    seed()
    const { container, getByTestId } = renderFragileEdge('e-10')
    expect(getByTestId('base-edge')).toBeTruthy()
    expect(container.querySelector('[data-fragile-cue]')).toBeNull()
  })
})
