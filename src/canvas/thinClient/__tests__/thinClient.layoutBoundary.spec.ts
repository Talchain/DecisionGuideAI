/**
 * THIN CLIENT — a scenario boundary invalidates the previous scenario's layout (Codex #2511 r2, P1).
 *
 * A layout started for A is awaiting `layoutGraph` when the user moves to B. The thin clear empties the canvas under
 * B's id; when A's layout returns, its ONLY commit guard is the generation (`applyLayout`'s `isCurrentGen`). If the
 * clear does not move the generation, A's nodes are committed under B's id — and B's CEE read then refuses the
 * canvas as zero-overlap, so A stays on screen.
 *
 * CATCH TWIN FIRST: the same interleaving with the round-1 clear (graph emptied, generation untouched) DOES commit A's
 * nodes. Without it, the fix row could pass because the mock never reached the commit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasStore } from '../../store'
import { clearCanvasForThinScenario } from '../../../hooks/useScenario'
import { __resetThinClientForTests } from '../thinClient'
import { __resetPersistenceSessionForTests } from '../../../lib/persistenceSession'

const A = 'aaaaaaaa-2222-4333-8444-555555555555'
const B = 'bbbbbbbb-2222-4333-8444-555555555555'

const nodeAt = (id: string, type: string) =>
  ({ id, type, position: { x: 0, y: 0 }, data: { label: `A ${id}`, kind: type } }) as never

function holdLayoutAcross(boundary: () => void): void {
  vi.doMock('../../utils/layout', () => ({
    layoutGraph: async (nodes: { position: { x: number; y: number } }[]) => {
      boundary() // the user moves to B while A's layout is in flight
      return { nodes: nodes.map((n) => ({ ...n, position: { x: 100, y: 100 } })), layoutNodeWidth: 320 }
    },
    groupByYRow: () => new Map(),
    applyCollisionGuard: () => undefined,
    normaliseTierRows: () => undefined,
  }))
}

async function layOutAThenSwitch(boundary: () => void) {
  holdLayoutAcross(boundary)
  useCanvasStore.setState({
    currentScenarioId: A,
    nodes: [nodeAt('dec', 'decision'), nodeAt('opt', 'option')],
    edges: [],
    layoutRequestId: 1,
    pendingLayout: true,
  } as never)
  await useCanvasStore.getState().applyLayout({ skipHistory: true, requestId: 1 })
  return useCanvasStore.getState()
}

beforeEach(() => {
  localStorage.clear()
  __resetThinClientForTests()
  __resetPersistenceSessionForTests()
  localStorage.setItem('sb-testproject-auth-token', '{"access_token":"t","user":{"id":"u"}}')
  useCanvasStore.getState().resetCanvas()
})
afterEach(() => {
  vi.doUnmock('../../utils/layout')
  vi.restoreAllMocks()
})

describe('a thin scenario boundary invalidates the previous scenario’s layout', () => {
  it('CATCH TWIN — the round-1 clear (generation untouched) lets A’s layout commit A’s nodes under B’s id', async () => {
    const after = await layOutAThenSwitch(() =>
      useCanvasStore.getState().hydrateGraphSlice({ nodes: [], edges: [], currentScenarioId: B }),
    )
    expect(after.currentScenarioId).toBe(B)
    expect(after.nodes.map((n) => n.id).sort()).toEqual(['dec', 'opt'])
  })

  it('clearCanvasForThinScenario ⇒ A’s layout is rejected: B’s canvas stays EMPTY for CEE’s read, no layout pending', async () => {
    const after = await layOutAThenSwitch(() => clearCanvasForThinScenario(B))
    expect(after.currentScenarioId).toBe(B)
    expect(after.nodes).toHaveLength(0)
    expect(after.pendingLayout).toBe(false)
    expect(after.layoutInProgress).toBe(false)
  })
})
