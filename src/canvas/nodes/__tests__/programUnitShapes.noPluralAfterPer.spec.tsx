/**
 * #3056 follow-up (DL, 30 Oct): "0.08 per months". A `1/month` rate reads as the bare phrase "per month", and the count
 * rule pluralised its last word. The word after "per" is never counted: only a leading noun takes the figure's number.
 * One row per unit SHAPE, each on a served program card as the canvas renders it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual('@xyflow/react')), Handle: () => null, useViewport: () => ({ x: 0, y: 0, zoom: 1 }) }))
vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../conversation/ConversationContext', async (o) => ({ ...(await o<Record<string, unknown>>()), useOptionalConversationContext: () => ({ sendSystemEvent: vi.fn() }) }))

import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
import { FactorNode } from '../FactorNode'
import european from './fixtures/served-c6-european-draft-read-20261029.json'
import bookshop from './fixtures/served-bookshop-worked-out-read-20261027.json'
import chat from './fixtures/paul-ai-chat-deadline-read-20261028.json'

type Json = Record<string, any>
let n = 0
async function valueLine(board: Json, id: string): Promise<string> {
  n += 1
  const read = { ...board, graph_hash: `${board.graph_hash}${n}` }
  useCanvasStore.setState({ currentScenarioId: board.scenario_id, serverGraphIdentity: null, nodes: [], edges: [], lastServerGraphHash: null, lastAuthoritativeGraph: null } as never)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(read), { status: 200, headers: { 'Content-Type': 'application/json' } })))
  await act(async () => { await hydrateCanvasFromServer(board.scenario_id) })
  const node = useCanvasStore.getState().nodes.find((x) => x.id === id)
  expect(node, `${id} hydrated`).toBeTruthy()
  const { container } = render(<ReactFlowProvider><FactorNode {...({ id, type: node!.type, data: node!.data, position: { x: 0, y: 0 }, selected: false,
    isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0 } as any)} /></ReactFlowProvider>)
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
  return (container.querySelector(`[data-testid="factor-value-figure-${id}"]`)?.parentElement?.textContent ?? '').trim()
}

beforeEach(() => { window.history.replaceState(null, '', '/?ai=core-route') })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

describe('only a leading noun counts against the figure; the word after "per" never does', () => {
  it.each([
    ['1/x rate', 'monthly_churn', european, '0.08 per month'],
    ['1/x rate', 'churn_danger_threshold', european, '0.12 per month'],
    ['count', 'initial_customers', european, '400 customers'],
    ['word rate', 'current_books', bookshop, '400 books per month'],
    ['money per unit', 'current_price', bookshop, '£12 / book'],
    ['%', 'competitor_order_loss', bookshop, '20%'],
    ['time', 'current_engineering_time', chat, '2 months'],
  ] as const)('%s · %s', async (_shape, id, board, want) => {
    const got = await valueLine(board as Json, id)
    expect(got).toBe(want)
  })
})
