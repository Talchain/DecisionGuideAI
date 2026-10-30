/**
 * P1 S3 (DL, 30 Oct): a program card's figure says whose it is when the person who gave it is not the person who
 * approved it. CEE S1 writes a panel answer the owner applied as canonical `author_id` = the participant, `approved_by` =
 * the owner and `party` = the participant's display name. The card then reads "Grace’s figure · approved by you", or
 * "a teammate’s figure · approved by you" with no name. Never "verified", never an id. A viewer of a shared link did not
 * approve it, so it reads "approved by the owner". The owner's own figure (author = approver) is unchanged.
 *
 * Fixture: the European journey's served draft read; the canonical record is set as S1 writes it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual('@xyflow/react')), Handle: () => null, useViewport: () => ({ x: 0, y: 0, zoom: 1 }) }))
vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../conversation/ConversationContext', async (o) => ({ ...(await o<Record<string, unknown>>()), useOptionalConversationContext: () => ({ sendSystemEvent: vi.fn() }) }))

import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
import { setViewerScenario, __resetViewerModeForTests } from '../../../lib/viewerMode'
import { FactorNode } from '../FactorNode'
import read from './fixtures/served-c6-european-draft-read-20261029.json'

type Json = Record<string, any>
const ID = 'monthly_churn'
let n = 0

function withRecord(patch: Json): Json {
  const board = structuredClone(read) as Json
  const g = (board.body ?? board).graph
  Object.assign(g.living_model.canonical.quantities.find((q: Json) => q.id === ID), patch)
  return board
}

/** The card as the canvas renders it: its whole text, and the accessible names of everything on it. */
async function card(board: Json): Promise<{ text: string; names: string }> {
  n += 1
  const r = { ...board, graph_hash: `${board.graph_hash}${n}` }
  useCanvasStore.setState({ currentScenarioId: board.scenario_id, serverGraphIdentity: null, nodes: [], edges: [], lastServerGraphHash: null, lastAuthoritativeGraph: null } as never)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(r), { status: 200, headers: { 'Content-Type': 'application/json' } })))
  await act(async () => { await hydrateCanvasFromServer(board.scenario_id) })
  const node = useCanvasStore.getState().nodes.find((x) => x.id === ID)!
  const { container } = render(<ReactFlowProvider><FactorNode {...({ id: ID, type: node.type, data: node.data, position: { x: 0, y: 0 }, selected: false,
    isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0 } as any)} /></ReactFlowProvider>)
  await act(async () => { await new Promise((res) => setTimeout(res, 30)) })
  const names = [...container.querySelectorAll('[aria-label],[title]')].map((m) => m.getAttribute('aria-label') ?? m.getAttribute('title')).join(' | ')
  return { text: container.textContent ?? '', names }
}

const GRACE = { author_id: '9f1c7d2e-4b3a-4c11-8e6f-0a2b5c8d7e10', approved_by: 'owner-0000-4000-8000-000000000001', approval: 'approved', party: 'Grace' }

beforeEach(() => { window.history.replaceState(null, '', '/?ai=core-route'); __resetViewerModeForTests() })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); __resetViewerModeForTests(); window.history.replaceState(null, '', '/') })

describe('a figure a teammate gave and the owner approved says whose it is', () => {
  it('"Grace’s figure · approved by you", in the card and in its mark’s name', async () => {
    const c = await card(withRecord(GRACE))
    expect(c.text).toContain('Grace’s figure · approved by you')
    expect(c.names).toContain('Grace’s figure · approved by you')
    expect(c.text).not.toContain('From your brief')
  })

  it('no name: "a teammate’s figure · approved by you", never an id', async () => {
    const c = await card(withRecord({ ...GRACE, party: null }))
    expect(c.text).toContain('a teammate’s figure · approved by you')
    expect(`${c.text} ${c.names}`).not.toContain(GRACE.author_id)
  })

  it('a viewer of the shared link reads "approved by the owner", never "by you"', async () => {
    setViewerScenario((read as Json).scenario_id)
    const c = await card(withRecord(GRACE))
    expect(c.text).toContain('Grace’s figure · approved by the owner')
    expect(`${c.text} ${c.names}`).not.toContain('approved by you')
  })

  it('never "verified"', async () => {
    const c = await card(withRecord(GRACE))
    expect(`${c.text} ${c.names}`.toLowerCase()).not.toContain('verified')
  })

  it('CONTRAST: the owner’s own figure (author = approver) is unchanged, byte for byte', async () => {
    const asServed = await card(read as Json)
    const own = await card(withRecord({ author_id: GRACE.approved_by, approved_by: GRACE.approved_by, approval: 'approved', party: null }))
    expect(own).toEqual(asServed)
  })
})
