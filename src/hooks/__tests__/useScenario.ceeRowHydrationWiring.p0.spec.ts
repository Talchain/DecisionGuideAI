/**
 * THE WIRING PIN for the P0 reload fix.
 *
 * `normalisePersistedGraph` is unit-tested in
 * `canvas/__tests__/store.ceeShapedHydration.p0.spec.ts`. That proves the
 * FUNCTION is correct and proves nothing about whether `loadScenario` calls it.
 *
 * ⚠ THIS FILE EXISTS BECAUSE THE GAP WAS MEASURED, NOT IMAGINED. Replacing the
 * `normalisePersistedGraph(row.graph)` call in `useScenario.loadScenario` with
 * the old verbatim `{ nodes: row.graph.nodes, edges: row.graph.edges }` left the
 * unit spec at **10/10 GREEN** — the fix would have been deletable in a tidy-up
 * with no red anywhere, which is exactly the trap-19 proof obligation
 * (delete the producer and the tests must go red) left unmet at the call site.
 * Same shape as `CanvasMVP.serverGraphHydration.spec.tsx`, which was written
 * after the same class of finding one layer up.
 *
 * So this drives the REAL hook against a REAL CEE-shaped row and asserts on the
 * STORE — the thing the canvas actually renders from — not on the mapper.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import ceeRow from '../../canvas/hooks/__tests__/fixtures/cee-persisted-graph-wire-2026-08-12.json'

const REAL_USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const mockAuthValue = { user: { id: REAL_USER_ID }, authenticated: true }

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => mockAuthValue }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))

const mockLoadScenario = vi.fn()
vi.mock('../../services/scenarioService', () => ({
  loadScenario: (...a: unknown[]) => mockLoadScenario(...a),
  createScenario: vi.fn(),
  saveGraph: vi.fn(),
  saveFraming: vi.fn(),
  storeAnalysis: vi.fn(),
  resetAnalysisStatus: vi.fn(),
  createSharedBrief: vi.fn(),
  updateStage: vi.fn(),
}))

import { useScenario } from '../useScenario'
import { useCanvasStore } from '../../canvas/store'

const SCENARIO_ID = '11111111-2222-4333-8444-555555555555'

beforeEach(() => {
  mockLoadScenario.mockReset()
  useCanvasStore.setState({ nodes: [], edges: [] })
})

describe('P0 wiring: loadScenario normalises a CEE-written row before it reaches the store', () => {
  beforeEach(() => {
    mockLoadScenario.mockResolvedValue({
      id: SCENARIO_ID,
      graph: ceeRow,
      framing: null,
      stage: 'draft',
      updated_at: new Date().toISOString(),
      analysis_status: 'none',
      analysis: null,
    })
  })

  it('puts CANVAS-shaped nodes in the store — every node has a position', async () => {
    const { result } = renderHook(() => useScenario())
    await result.current.loadScenario(SCENARIO_ID)

    await waitFor(() => {
      expect(useCanvasStore.getState().nodes).toHaveLength(15)
    })
    const nodes = useCanvasStore.getState().nodes as any[]
    // RED if the normaliser call is removed: CEE nodes carry no `position`.
    expect(nodes.filter((n) => n.position && typeof n.position.x === 'number')).toHaveLength(15)
  })

  it('puts CANVAS-shaped edges in the store — every edge has string source/target', async () => {
    const { result } = renderHook(() => useScenario())
    await result.current.loadScenario(SCENARIO_ID)

    await waitFor(() => {
      expect(useCanvasStore.getState().edges).toHaveLength(28)
    })
    const edges = useCanvasStore.getState().edges as any[]
    // RED if the normaliser call is removed: CEE edges carry `from`/`to` only.
    expect(edges.filter((e) => typeof e.source === 'string' && typeof e.target === 'string'))
      .toHaveLength(28)
    expect(edges.filter((e) => typeof e.id === 'string')).toHaveLength(28)
  })

  it('carries the label through to where the canvas reads it (not blank boxes)', async () => {
    const { result } = renderHook(() => useScenario())
    await result.current.loadScenario(SCENARIO_ID)

    await waitFor(() => {
      expect(useCanvasStore.getState().nodes.length).toBeGreaterThan(0)
    })
    const nodes = useCanvasStore.getState().nodes as any[]
    const first: any = nodes.find((n) => n.id === (ceeRow.nodes as any[])[0].id)
    expect(first.data.label).toBe((ceeRow.nodes as any[])[0].label)
  })

  it('COMPLETES the load: the rest of loadScenario runs (it used to throw out of hydrate)', async () => {
    const { result } = renderHook(() => useScenario())
    await result.current.loadScenario(SCENARIO_ID)

    // `currentStage` is set AFTER hydrateGraphSlice. Before the fix, reseedIds
    // threw out of the hydrate and this was never reached.
    await waitFor(() => {
      expect(useCanvasStore.getState().currentStage).toBe('draft')
    })
    expect(useCanvasStore.getState().currentScenarioId).toBe(SCENARIO_ID)
  })
})

describe('a React-Flow-shaped row still hydrates unchanged', () => {
  it('keeps the persisted positions rather than re-mapping them to {0,0}', async () => {
    mockLoadScenario.mockResolvedValue({
      id: SCENARIO_ID,
      graph: {
        nodes: [{ id: 'n1', type: 'factor', position: { x: 123, y: 456 }, data: { label: 'A' } }],
        edges: [{ id: 'e1', source: 'n1', target: 'n1', data: {} }],
      },
      framing: null,
      stage: 'draft',
      updated_at: new Date().toISOString(),
      analysis_status: 'none',
      analysis: null,
    })

    const { result } = renderHook(() => useScenario())
    await result.current.loadScenario(SCENARIO_ID)

    await waitFor(() => {
      expect(useCanvasStore.getState().nodes).toHaveLength(1)
    })
    const n: any = (useCanvasStore.getState().nodes as any[])[0]
    expect(n.position).toEqual({ x: 123, y: 456 })
  })
})
