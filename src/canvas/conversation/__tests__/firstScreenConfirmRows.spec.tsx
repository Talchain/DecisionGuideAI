/**
 * ⭐ PAUL'S FIRST SCREEN: CONFIRM ITEM BY ITEM (27 Oct, a program board). Each row of the reading card has a "That’s right"
 * tick; the ticks collect locally, and "Confirm (N)" sends the card's OWN approve press (its chip id and message, so CEE
 * binds it to the card) with `approve_ids`: the ticked record ids, at the top of the request (CEE #3793 D4). A resend of the
 * same press (a retry) carries the same rows: without them CEE would approve the whole card.
 *
 * Real path: the REAL `useConversation`, the REAL `ConversationPanel` (thread, chips, the chip path); only the network runner
 * (`callV5Turn`, whose first argument is the request body), the stream opener, auth and the scenario service are mocked.
 * The reply is the served European first-draft turn (`served-acceptance-european-draft-turn-20261026.json`) through the
 * production parser; the board is the same run's served read (`served-acceptance-european-read-20261026.json`), with only
 * `fetch` stubbed.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

const mockCallV5Turn = vi.fn()
vi.mock('../turnService', () => ({
  callOrchestratorTurn: vi.fn(),
  streamOrchestratorTurn: vi.fn(),
  OrchestratorError: class OrchestratorError extends Error {},
}))
vi.mock('../../../v5/v5Adapter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/v5Adapter')>()),
  callV5Turn: (...args: unknown[]) => mockCallV5Turn(...args),
  getV5Endpoint: () => 'https://cee.test/orchestrate/v2/turn',
}))
vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()),
  openV5TurnStream: async () => { throw new TypeError('Failed to fetch') },
}))
vi.mock('../../../v5/eligibility', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/eligibility')>()),
  isV5Eligible: () => ({ eligible: true as const }),
  isV5CanonicalRunPath: () => false,
}))
vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../../services/scenarioService', () => ({ loadScenario: async () => null, storeAnalysis: async () => undefined }))
vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))

import { useConversation } from '../useConversation'
import { ConversationPanel } from '../ConversationPanel'
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import { mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
import { parseV5Response } from '../../../v5/responseParser'
import european from './fixtures/served-acceptance-european-draft-turn-20261026.json'
import europeanRead from '../../nodes/__tests__/fixtures/served-acceptance-european-read-20261026.json'

type Json = Record<string, any>
const body = european.body as Json
const card = body.cards[0] as Json
const PID: string = card.proposal_id
const APPROVE = card.approve_action as { id: string; label: string; message: string }

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

const sent = (i: number): Json => mockCallV5Turn.mock.calls[i]![0] as Json
const tick = (key: string) => fireEvent.click(screen.getByTestId(`reading-tick-${key}`))

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
  mockCallV5Turn.mockResolvedValueOnce(parsed)
  render(<App />)
  await act(async () => { await live!.sendMessage('Should we expand into Europe?') })
  await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); live = null })

describe('3. confirm item by item', () => {
  it('two ticks → "Confirm (2)" sends the card’s own approve press with approve_ids, the ticked ids in the card’s order; a retry resends the same rows', async () => {
    expect(mockCallV5Turn).toHaveBeenCalledTimes(1)
    const confirm = screen.getByTestId(`reading-confirm-${PID}`) as HTMLButtonElement
    // Nothing ticked: nothing to confirm, and a press sends nothing.
    expect(confirm.textContent).toBe('Confirm (0)')
    expect(confirm).toBeDisabled()
    fireEvent.click(confirm)
    expect(mockCallV5Turn).toHaveBeenCalledTimes(1)
    // An Olumi row and, unfolded, one of the person's; a third ticked and unticked again is not sent.
    tick('option:no_european_expansion')
    tick('option:limited_european_pilot')
    fireEvent.click(screen.getByTestId(`reading-show-all-${PID}`))
    tick('goal:reach_customer_target')
    tick('option:limited_european_pilot')
    tick('option:limited_european_pilot')
    tick('left_out:profitability_not_established')
    tick('left_out:profitability_not_established')
    expect(screen.getByTestId('reading-tick-option:limited_european_pilot')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('reading-tick-left_out:profitability_not_established')).toHaveAttribute('aria-pressed', 'false')
    expect(confirm.textContent).toBe('Confirm (3)')
    tick('option:no_european_expansion')
    expect(confirm.textContent).toBe('Confirm (2)')

    // The first press is refused before dispatch (a proven non-send), so its retry is the same press again.
    mockCallV5Turn.mockResolvedValueOnce({ kind: 'parse_error', reason: 'offline before dispatch', requestNotStarted: true })
    await act(async () => { fireEvent.click(confirm) })
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    expect(mockCallV5Turn).toHaveBeenCalledTimes(2)
    const press = sent(1)
    expect(press.chip).toEqual({ id: APPROVE.id })
    expect(press.message).toBe(APPROVE.message)
    expect(press.approve_ids).toEqual(['reach_customer_target', 'limited_european_pilot'])
    // The card's own binding, with nothing else inside it: the rows travel only at the top of the body.
    expect(press.proposal_edits).toEqual({ proposal_id: PID, revision: card.revision, digest: card.digest, graph_hash: body.model.revision, fields: [] })

    mockCallV5Turn.mockResolvedValueOnce({ kind: 'parse_error', reason: 'offline before dispatch', requestNotStarted: true })
    await act(async () => { await live!.retryLast() })
    expect(mockCallV5Turn).toHaveBeenCalledTimes(3)
    expect(sent(2).chip).toEqual({ id: APPROVE.id })
    expect(sent(2).message).toBe(APPROVE.message)
    expect(sent(2).approve_ids).toEqual(['reach_customer_target', 'limited_european_pilot'])
  })
})
