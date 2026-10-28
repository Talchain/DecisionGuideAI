import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual('@xyflow/react')), Handle: () => null, useViewport: () => ({ x: 0, y: 0, zoom: 1 }) }))
vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../conversation/ConversationContext', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()), useOptionalConversationContext: () => ({ sendSystemEvent: vi.fn() }),
}))

import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
import { OptionNode } from '../OptionNode'

type Json = Record<string, any>
// The saved-graph read is cached per scenario and hash, so each board reads its own hash.
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
  expect(node, `option ${id} hydrated`).toBeTruthy()
  // ReactFlow's NodeProps needs fields no assertion here reads; the sibling node specs cast the same way.
  const props = { id, type: node!.type, data: node!.data, position: { x: 0, y: 0 }, selected: false, isConnectable: true,
    positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0 } as any
  render(<ReactFlowProvider><OptionNode {...props} /></ReactFlowProvider>)
  // The saved-graph read has answered before anything asserts.
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
}
import chat from './fixtures/paul-ai-chat-deadline-read-20261028.json'

beforeEach(() => { window.history.replaceState(null, '', '/?ai=core-route') })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

/**
 * Paul, 28 Oct (his AI-chat board, scenario d85bff9f, saved read as served): O2 showed the Olumi mark twice on its
 * bottom row — "Olumi suggested this" and its target's Olumi estimate. One Olumi mark per card: the two join the
 * card's one merged mark, which names both. Brief options keep no Olumi mark.
 */
describe('one Olumi mark per card, on Paul’s AI-chat board', () => {
  const olumiIn = (band: HTMLElement) => [...band.querySelectorAll('[data-card-mark="source-olumi"], [data-testid="estimate-marker"]')]

  it.each(['specialist_assisted_delivery', 'ready_made_chat_delivery'])('%s: one Olumi mark, named for both', async (id) => {
    await openBoard(chat as Json)
    await card(id)
    const marks = olumiIn(screen.getByTestId(`option-bottom-marks-${id}`))
    expect(marks).toHaveLength(1)
    expect(marks[0].getAttribute('data-olumi-mark')).toBe('merged')
    expect(marks[0].getAttribute('aria-label') ?? marks[0].closest('[aria-label]')?.getAttribute('aria-label'))
      .toBe("Olumi suggested this option · 1 target value is Olumi's estimate you accepted")
  })

  it('CONTRAST: the brief’s own option has no Olumi mark, and keeps its own', async () => {
    await openBoard(chat as Json)
    await card('continue_current_development')
    const band = screen.getByTestId('option-bottom-marks-continue_current_development')
    expect(olumiIn(band)).toHaveLength(0)
    expect(band.querySelector('[data-card-mark="source-brief"]')).not.toBeNull()
  })
})
