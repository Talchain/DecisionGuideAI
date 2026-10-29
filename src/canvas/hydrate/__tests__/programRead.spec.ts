/**
 * A PROGRAM'S READ ALWAYS PUTS CEE'S GRAPH ON THE CANVAS (UI thin layer, step 1, round 4).
 * The scenario read (`hydrateCanvasFromServer` → `mergeServerGraphOnHydrate` → `applyProgramGraph`) replaces a program
 * board's cards and links with CEE's, whole. A read whose server identity has not moved used to return before any merge
 * (`isSameServerGraph`), so a repeated read kept every local card, figure and link made since the first. The graph is
 * the qualitative journey's real saved read (staging, 29 Oct 2026), with the program marker CEE's read carries.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { __resetPendingFactorEditsForTest } from '../../conversation/pendingFactorEdit'
import { __resetProgramScenariosForTest } from '../../nodes/shared/savedModelProgram'
import SERVED from '../../utils/__tests__/fixtures/served-qualitative-parallel-links.a3c24d98.read.json'

type Body = Omit<typeof SERVED, '_source'> & { graph: Record<string, unknown> }
const CEE_NODE_IDS = SERVED.graph.nodes.map((n) => n.id).sort()
const CEE_EDGE_IDS = SERVED.graph.edges.map((e) => e.id).sort()
const FIGURE_CARD = 'repair_time'

/** The saved read, byte-unchanged but for the program marker the capture left off. */
const programBody = (): Body => {
  const body = structuredClone(Object.fromEntries(Object.entries(SERVED).filter(([k]) => k !== '_source'))) as Body
  body.graph = { ...body.graph, living_model: { model_program: 'v1' } }
  return body
}
async function read(body: Body): Promise<string> {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => structuredClone(body) } as unknown as Response))
  return hydrateCanvasFromServer(SERVED.scenario_id)
}
const nodeIds = () => useCanvasStore.getState().nodes.map((n) => n.id).sort()
const edgeIds = () => useCanvasStore.getState().edges.map((e) => e.id).sort()
const dataOf = (id: string) => useCanvasStore.getState().nodes.find((n) => n.id === id)!.data as Record<string, unknown>

beforeEach(() => {
  useCanvasStore.getState().reset()
  __resetPendingFactorEditsForTest()
  __resetProgramScenariosForTest()
  useCanvasStore.setState({
    currentScenarioId: SERVED.scenario_id,
    nodes: [],
    edges: [],
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    importPendingServerRegistration: false,
    pendingEmittedEdits: 0,
    history: { past: [], future: [] },
  } as never)
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('a repeated, identical program read', () => {
  it('restores exactly CEE\'s graph after a local change: no local card, figure or link outlives it', async () => {
    await read(programBody())
    expect(nodeIds()).toEqual(CEE_NODE_IDS)

    // Local changes since the first read: a figure on a card, a card and a link of the person's own.
    useCanvasStore.setState((s) => ({
      nodes: [
        ...s.nodes.map((n) => n.id === FIGURE_CARD ? { ...n, data: { ...n.data, observedState: { value: 42 } } } : n),
        { id: 'local_card', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'Supplier lead time' } },
      ],
      edges: [...s.edges, { id: 'local_link', source: 'local_card', target: 'sync_readiness', data: { weight: 0.3 } }],
    }) as never)

    // The same read again: same graph, same server identity.
    expect(await read(programBody())).toBe('merged')
    expect(nodeIds()).toEqual(CEE_NODE_IDS)
    expect(edgeIds()).toEqual(CEE_EDGE_IDS)
    expect(dataOf(FIGURE_CARD)).not.toHaveProperty('observedState')
  })
})

describe('an empty program read', () => {
  it('clears a canvas that held the model', async () => {
    await read(programBody())
    expect(nodeIds()).toEqual(CEE_NODE_IDS)
    // CEE's saved model is now empty; its identity is the empty graph's, not the first read's.
    const empty = programBody()
    empty.graph = { nodes: [], edges: [], living_model: { model_program: 'v1' } }
    empty.graph_identity_hash = { ...empty.graph_identity_hash, value: '0'.repeat(64) }
    empty.graph_hash = '1'.repeat(64)
    expect(await read(empty)).toBe('merged')
    expect(useCanvasStore.getState().nodes).toHaveLength(0)
    expect(useCanvasStore.getState().edges).toHaveLength(0)
  })
})
