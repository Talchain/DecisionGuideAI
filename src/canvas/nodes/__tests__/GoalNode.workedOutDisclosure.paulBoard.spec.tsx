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

import chat from './fixtures/paul-ai-chat-deadline-read-20261028.json'

beforeEach(() => { window.history.replaceState(null, '', '/?ai=core-route') })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

// Paul's Q1 ruling (28 Oct): the goal's worked-out totals are said on the goal, collapsed, in CEE's own words
// (`value_basis.words`, verbatim). Paul's goal "Launch basic AI chat within two months" carries them as served.
describe('the goal says what it is worked out from, collapsed, in CEE’s words', () => {
  const WORDS = 'Worked out from Remaining implementation time under the selected route, Additional learning delay under the selected route, Additional route setup delay and Additional time for testing and release approval'
  const goal = async (board: Json) => {
    const { GoalNode } = await import('../GoalNode')
    await openBoard(board)
    const node = useCanvasStore.getState().nodes.find((x) => x.id === 'launch_on_time')!
    render(<ReactFlowProvider><GoalNode {...({ id: 'launch_on_time', type: node.type, data: node.data, position: { x: 0, y: 0 }, selected: false, isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0 } as any)} /></ReactFlowProvider>)
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
  }

  it('a collapsed "Worked out from" holding the words verbatim', async () => {
    await goal(chat as Json)
    const details = screen.getByTestId('goal-worked-out-launch_on_time') as HTMLDetailsElement
    expect(details.open).toBe(false)
    expect(details.querySelector('summary')?.textContent).toBe('Worked out from')
    expect(screen.getByTestId('goal-worked-out-words-launch_on_time').textContent).toBe(WORDS)
  })

  // UI-SURGICAL 5: a worked-out figure comes from its parts, so the card has no empty "today" slot to type into.
  it('no empty today slot on the worked-out goal', async () => {
    await goal(chat as Json)
    expect(screen.queryByTestId('goal-today-level-empty-launch_on_time')).toBeNull()
  })

  it('CONTRAST: the same goal without a worked-out basis keeps its empty today slot', async () => {
    const graph = structuredClone(chat.graph) as Json
    delete graph.nodes.find((n: Json) => n.id === 'launch_on_time').value_basis
    await goal({ ...(chat as Json), graph })
    expect(screen.queryByTestId('goal-today-level-empty-launch_on_time')).not.toBeNull()
  })

  it('CONTRAST: a goal with no worked-out basis has no disclosure', async () => {
    const graph = structuredClone(chat.graph) as Json
    delete graph.nodes.find((n: Json) => n.id === 'launch_on_time').value_basis
    await goal({ ...(chat as Json), graph })
    expect(screen.queryByTestId('goal-worked-out-launch_on_time')).toBeNull()
  })
})
