/**
 * applyStarter — the provenance stamp is LOAD-BEARING, so it gets its own pin.
 *
 * WHY THIS FILE EXISTS. It was added because a mutation check found the gap:
 * commenting out `stampStarterProvenance` left all 27 starter-integrity tests
 * green. That stamp is the single thing that makes
 *   (a) `computeCeeCannotSeeModel` refuse an un-analysable starter run, and
 *   (b) the saved-example disclosure render at all.
 * Without it the product would silently dispatch a V5 run against a scenario
 * CEE has no graph for, and would show a cached model with no disclosure —
 * both of the failures this feature exists to prevent, passing green.
 *
 * The stamp must land on EVERY node: the honesty gate uses `.some()`, but the
 * banner reads `nodes[0]`, and a partial stamp would make the two disagree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Spread-mocked: the REAL manifest, loaders and drift pin stay live; only the
// store write performed by applyDraftResult is simulated, so this spec tests
// applyStarter's own behaviour rather than re-testing the draft ingestion.
const applyDraftResultMock = vi.fn()
vi.mock('../../utils/applyDraftResult', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/applyDraftResult')>()
  return { ...actual, applyDraftResult: (d: unknown) => applyDraftResultMock(d) }
})

import { applyStarter, STARTERS } from '../loadStarter'
import { useCanvasStore } from '../../store'

function seedStoreWithGraph(nodeCount: number) {
  useCanvasStore.setState({
    nodes: Array.from({ length: nodeCount }, (_, i) => ({
      id: `n${i}`,
      type: 'factor',
      position: { x: 0, y: 0 },
      data: { label: `n${i}`, kind: 'factor' },
    })) as never,
    edges: [] as never,
  })
}

describe('applyStarter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCanvasStore.setState({ nodes: [] as never, edges: [] as never })
    applyDraftResultMock.mockImplementation(() => {
      seedStoreWithGraph(18)
      return { nodeCount: 18, edgeCount: 35 }
    })
  })

  it('feeds the captured payload to the SAME ingestion the live conversation uses', async () => {
    await applyStarter('market-entry')
    expect(applyDraftResultMock).toHaveBeenCalledTimes(1)
    const payload = applyDraftResultMock.mock.calls[0][0] as { nodes: unknown[] }
    // Real captured graph, not a stub — proves the transport swap (import vs
    // fetch) is the ONLY difference from a live draft.
    expect(payload.nodes.length).toBe(18)
  })

  it('stamps starterId on EVERY node — the honesty gate and the disclosure both depend on it', async () => {
    await applyStarter('market-entry')
    const nodes = useCanvasStore.getState().nodes
    expect(nodes.length).toBe(18)
    // POSITIVE CONTROL: prove the assertion can see a present stamp before
    // asserting completeness, so a store that silently emptied cannot pass.
    expect(nodes[0].data.starterId).toBe('market-entry')
    expect(nodes.every((n) => n.data.starterId === 'market-entry')).toBe(true)
  })

  it('stamps the starter title so the disclosure can name the example', async () => {
    await applyStarter('vendor-selection')
    const meta = STARTERS.find((s) => s.id === 'vendor-selection')!
    expect(useCanvasStore.getState().nodes.every((n) => n.data.starterTitle === meta.title)).toBe(true)
  })

  it('preserves the ingested node data rather than replacing it', async () => {
    await applyStarter('market-entry')
    const first = useCanvasStore.getState().nodes[0]
    expect(first.data.label).toBe('n0')
    expect(first.data.kind).toBe('factor')
  })

  it('rejects an unknown starter id instead of applying nothing silently', async () => {
    await expect(applyStarter('not-a-starter')).rejects.toThrow(/unknown starter id/)
    expect(applyDraftResultMock).not.toHaveBeenCalled()
  })

  it('throws — never stamps — when ingestion yields zero nodes', async () => {
    applyDraftResultMock.mockImplementation(() => ({ nodeCount: 0, edgeCount: 0 }))
    await expect(applyStarter('market-entry')).rejects.toThrow(/zero nodes/)
    expect(useCanvasStore.getState().nodes).toHaveLength(0)
  })
})
