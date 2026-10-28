/**
 * W8 run 4 (DL, 28 Oct; acceptance 20261028T041934Z, check 1's floor): since E2 a figure Olumi asks for is Olumi's
 * (`author: olumi`), so CEE serves its card `provenance: 'ai_inferred'`. The waiting-for-answer card showed the
 * hourglass and "—" but no Olumi mark, so an Olumi addition read as nobody's. It shows Olumi's mark ("Olumi suggested this"). A person's asked card (from the brief) shows none. One Olumi mark per card.
 *
 * Fixture: the european journey's saved read after the draft, as served (run 4).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual('@xyflow/react')), Handle: () => null, useViewport: () => ({ x: 0, y: 0, zoom: 1 }) }))
vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../conversation/ConversationContext', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()), useOptionalConversationContext: () => ({ sendSystemEvent: vi.fn() }),
}))

import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
import { FactorNode } from '../FactorNode'
import european from './fixtures/w8r4-european-draft-read-20261028.json'
import older from './fixtures/served-w8-european-read-20261027.json'

type Json = Record<string, any>
let n = 0
async function openBoard(board: Json) {
  n += 1
  const read = { ...board, graph_hash: `${board.graph_hash}${n}` }
  useCanvasStore.setState({ currentScenarioId: board.scenario_id, serverGraphIdentity: null, nodes: [], edges: [], lastServerGraphHash: null, lastAuthoritativeGraph: null } as never)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(read), { status: 200, headers: { 'Content-Type': 'application/json' } })))
  await act(async () => { await hydrateCanvasFromServer(board.scenario_id) })
}
async function card(id: string) {
  const node = useCanvasStore.getState().nodes.find((x) => x.id === id)
  expect(node, `factor ${id} hydrated`).toBeTruthy()
  const props = { id, type: node!.type, data: node!.data, position: { x: 0, y: 0 }, selected: false, isConnectable: true,
    positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0 } as any
  const { container } = render(<ReactFlowProvider><FactorNode {...props} /></ReactFlowProvider>)
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
  return container
}
// What check 1 reads: the provenance mark's name or title.
const olumiMarks = (c: HTMLElement) => [...c.querySelectorAll('[data-testid="node-provenance-mark"], [data-testid="node-title-authorship"]')]
  .map((m) => `${m.getAttribute('aria-label') ?? ''} ${m.getAttribute('title') ?? ''}`).filter((t) => /Olumi/.test(t))

beforeEach(() => { window.history.replaceState(null, '', '/?ai=core-route') })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

describe('a figure Olumi asks for carries Olumi’s mark', () => {
  it.each(['current_joins', 'setup_per_country', 'compliance_per_country', 'commercial_per_country', 'current_profit'])(
    '%s (Olumi’s, waiting for your answer): one Olumi mark, "Olumi suggested this"', async (id) => {
      await openBoard(european as Json)
      const c = await card(id)
      expect(olumiMarks(c).length).toBeGreaterThan(0)
      expect(olumiMarks(c).join(' ')).toMatch(/Olumi suggested this/)
      expect(c.querySelectorAll('[data-testid="node-provenance-mark"]').length).toBeLessThanOrEqual(1)
    })

  it('CONTRAST: the person’s asked card (from the brief) shows no Olumi mark', async () => {
    await openBoard(older as Json)
    const c = await card('base_acquisitions')
    expect(olumiMarks(c)).toEqual([])
  })
})
