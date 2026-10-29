/**
 * ⭐ W7: CONFIRM THE READING CARD ITEM BY ITEM (PANEL-1P rule 3; DL 29 Oct under Paul's direction; PL 00:55Z). On a program
 * board's first-draft reading card each row has a "That's right" tick. "Confirm selected" sends the card's OWN approve press
 * (its chip id and message, so CEE binds it to the card) with `approve_ids`, exactly the ticked rows, at the top of the request
 * (CEE core-turn.ts `approve_ids`, approve-rows.ts); a resend carries the same rows. "Confirm whole card" is the card's
 * approve as before, with no rows. Nothing is sent without a press. Olumi's additions and readings come first; the rows from
 * the brief start folded under "Also from your brief" and stay reachable.
 *
 * Real path: the REAL `useConversation` and `ConversationPanel`; only the network runner (`callV5Turn`), the stream opener,
 * auth and the scenario service are mocked. The reply is the served European first-draft turn
 * (`served-acceptance-european-draft-turn-20261026.json`, every row grouped by CEE) through the production parser; the
 * board is the same run's served read (`served-acceptance-european-read-20261026.json`), with only `fetch` stubbed.
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
const tick = (key: string) => fireEvent.click(screen.getByTestId(`reading-row-tick-input-${key}`))

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

describe('W7: confirm the reading card item by item', () => {
  it('Olumi\'s rows come first, each with a tick; the rows from the brief start folded under "Also from your brief" and open on a tap', async () => {
    const panel = screen.getByTestId(`proposal-change-notes-${PID}`)
    const order = [...panel.querySelectorAll('[data-testid^="reading-group-section-"]')].map((el) => el.getAttribute('data-testid')!.split('-').pop())
    expect(order.slice(0, 3)).toEqual(['inferred', 'left_out', 'used'])
    expect(screen.getByTestId('reading-row-tick-input-option:limited_european_pilot')).toBeInTheDocument()
    // Folded, not hidden for good: the person's rows appear on a tap, each with its own tick.
    expect(screen.queryByTestId('reading-row-tick-input-goal:reach_customer_target')).toBeNull()
    fireEvent.click(screen.getByTestId(`reading-also-from-brief-${PID}`))
    expect(screen.getByTestId('reading-row-tick-input-goal:reach_customer_target')).toBeInTheDocument()
    expect(screen.getByTestId(`suggested-chip-${APPROVE.id}`).textContent).toBe('Confirm whole card')
  })

  it('"Confirm selected" sends exactly the ticked rows as approve_ids with the card\'s own press; nothing is sent without a press; a retry resends the same rows', async () => {
    expect(mockCallV5Turn).toHaveBeenCalledTimes(1)
    const confirm = screen.getByTestId(`reading-confirm-selected-${PID}`) as HTMLButtonElement
    expect(confirm.textContent).toBe('Confirm selected')
    expect(confirm).toBeDisabled()
    fireEvent.click(confirm)
    // Ticks alone send nothing; a row ticked and unticked again is not sent.
    tick('option:limited_european_pilot')
    fireEvent.click(screen.getByTestId(`reading-also-from-brief-${PID}`))
    tick('goal:reach_customer_target')
    tick('option:no_european_expansion')
    tick('option:no_european_expansion')
    expect(mockCallV5Turn).toHaveBeenCalledTimes(1)
    expect(confirm).not.toBeDisabled()

    mockCallV5Turn.mockResolvedValueOnce({ kind: 'parse_error', reason: 'offline before dispatch', requestNotStarted: true })
    await act(async () => { fireEvent.click(confirm) })
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    expect(mockCallV5Turn).toHaveBeenCalledTimes(2)
    const press = sent(1)
    expect(press.chip).toEqual({ id: APPROVE.id })
    expect(press.message).toBe(APPROVE.message)
    expect(press.approve_ids).toEqual(['limited_european_pilot', 'reach_customer_target'])
    // The card's own binding, with nothing else inside it: the rows travel only at the top of the body.
    expect(press.proposal_edits).toEqual({ proposal_id: PID, revision: card.revision, digest: card.digest, graph_hash: body.model.revision, fields: [] })

    mockCallV5Turn.mockResolvedValueOnce({ kind: 'parse_error', reason: 'offline before dispatch', requestNotStarted: true })
    await act(async () => { await live!.retryLast() })
    expect(mockCallV5Turn).toHaveBeenCalledTimes(3)
    expect(sent(2).chip).toEqual({ id: APPROVE.id })
    expect(sent(2).approve_ids).toEqual(['limited_european_pilot', 'reach_customer_target'])
  })

  it('"Confirm whole card" is the card\'s own approve as before: no approve_ids, whatever is ticked', async () => {
    tick('option:limited_european_pilot')
    mockCallV5Turn.mockResolvedValueOnce({ kind: 'parse_error', reason: 'offline before dispatch', requestNotStarted: true })
    await act(async () => { fireEvent.click(screen.getByTestId(`suggested-chip-${APPROVE.id}`)) })
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    expect(mockCallV5Turn).toHaveBeenCalledTimes(2)
    expect(sent(1).chip).toEqual({ id: APPROVE.id })
    expect(sent(1)).not.toHaveProperty('approve_ids')
    expect(sent(1).proposal_edits).toEqual({ proposal_id: PID, revision: card.revision, digest: card.digest, graph_hash: body.model.revision, fields: [] })
  })
})
