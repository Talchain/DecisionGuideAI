/**
 * THE OLUMI-CORE LANE'S READING CARD follows the model's composition rule (Alpha V2 audit, 1 Nov; binding for every interface):
 * the person's own records come first with Olumi's what-ifs grouped behind them, the calculations and derived figures
 * ("Also in the model") are folded by default, and a constant is marked as plumbing, never as Olumi's. Off the lane the card is
 * exactly W7's (`readingCardConfirmRows.spec.tsx`: Olumi's rows first, the brief's folded), so the same card, served the same
 * way, is read both ways here.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

const mockCallV5Turn = vi.fn()
vi.mock('../../canvas/conversation/turnService', () => ({
  callOrchestratorTurn: vi.fn(),
  streamOrchestratorTurn: vi.fn(),
  OrchestratorError: class OrchestratorError extends Error {},
}))
vi.mock('../../v5/v5Adapter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../v5/v5Adapter')>()),
  callV5Turn: (...args: unknown[]) => mockCallV5Turn(...args),
  getV5Endpoint: () => 'https://cee.test/orchestrate/v2/turn',
}))
vi.mock('../../v5/streamedTurnTransport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../v5/streamedTurnTransport')>()),
  openV5TurnStream: async () => { throw new TypeError('Failed to fetch') },
}))
vi.mock('../../v5/eligibility', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../v5/eligibility')>()),
  isV5Eligible: () => ({ eligible: true as const }),
  isV5CanonicalRunPath: () => false,
}))
vi.mock('../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../services/scenarioService', () => ({ loadScenario: async () => null, storeAnalysis: async () => undefined }))
vi.mock('../../lib/posthog', () => ({ trackEvent: () => undefined }))

import { useConversation } from '../../canvas/conversation/useConversation'
import { ConversationPanel } from '../../canvas/conversation/ConversationPanel'
import { ToastProvider } from '../../canvas/ToastContext'
import { useCanvasStore } from '../../canvas/store'
import { mapDraftNodeToCanvas } from '../../canvas/utils/applyDraftResult'
import { parseV5Response } from '../../v5/responseParser'
import european from '../../canvas/conversation/__tests__/fixtures/served-acceptance-european-draft-turn-20261026.json'
import europeanRead from '../../canvas/nodes/__tests__/fixtures/served-acceptance-european-read-20261026.json'

type Json = Record<string, any>
const body = european.body as Json
const card = body.cards[0] as Json
const PID: string = card.proposal_id

let live: ReturnType<typeof useConversation> | null = null
function App() {
  const conversation = useConversation()
  live = conversation
  return (
    <ToastProvider>
      <ConversationPanel conversation={conversation} onCollapse={vi.fn()} onAttach={vi.fn()} />
    </ToastProvider>
  )
}


beforeEach(async () => {
  Element.prototype.scrollIntoView = vi.fn()
  window.history.replaceState(null, '', '/?ai=core-route')
  mockCallV5Turn.mockReset()
  // The saved model CEE holds after this turn (its revision), read as a program board.
  const read = { ...europeanRead, graph_hash: body.model.revision }
  vi.stubGlobal('fetch', vi.fn(async (url: string) => (
    /\/scenarios\/[^/]+\/graph$/.test(String(url))
      ? new Response(JSON.stringify(read), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : new Promise(() => {})
  )))
  useCanvasStore.getState().resetCanvas()
  useCanvasStore.setState({ currentScenarioId: europeanRead.scenario_id, nodes: (body.model.graph.nodes as Json[]).map(mapDraftNodeToCanvas), edges: [] } as never)
  const parsed = await parseV5Response(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }), { coreRoute: true })
  if (parsed.kind !== 'response') throw new Error(`the served body did not parse: ${parsed.kind}`)
  void parsed
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); live = null })


const sectionOrder = () => {
  const panel = screen.getByTestId(`proposal-change-notes-${PID}`)
  return [...panel.querySelectorAll('[data-testid^="reading-group-section-"]')].map((el) => el.getAttribute('data-testid')!.split('-').pop())
}

// The olumi-core lane's reading card came from a /bff turn through useConversation, which the View lane no longer sends (lane audit
// 14/16, DL ruling 3 Nov): its composition is now core's View order, held by src/olumiView/__tests__/contract.spec.tsx (order, nothing
// dropped). The off-lane card is unchanged:
describe('off the lane the card is unchanged (W7: Olumi\'s first, the brief\'s folded, no plumbing mark)', () => {
  beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', '') })
  afterEach(() => { vi.unstubAllEnvs() })
  it('keeps its order and its fold', async () => {
    mockCallV5Turn.mockResolvedValueOnce(await parseV5Response(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }), { coreRoute: true }))
    render(<App />)
    await act(async () => { await live!.sendMessage('Should we expand into Europe?') })
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(sectionOrder().slice(0, 3)).toEqual(['inferred', 'left_out', 'used'])
    expect(screen.queryByTestId('reading-row-tick-input-goal:reach_customer_target')).toBeNull()
    expect(screen.queryAllByTestId(/^proposal-change-plumbing-/)).toHaveLength(0)
  })
})
