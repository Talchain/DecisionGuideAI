/**
 * ⛔ AN APPROVE NEVER APPLIES MORE THAN ITS CARD SHOWS, FROM ANY SURFACE (Codex BLOCK on #2958). #2958 disabled the chat
 * card's Approve when a PRESENT `changes[]` could not be read in full, but the canvas ghost carries its own Approve: a card
 * with a drawable figure and no change notes gets a ghost, and its press went out through the conversation's chip path.
 * The refusal now sits at the ONE boundary every turn leaves through (`useConversation`'s `sendTurn`), so the chat card,
 * its panel, the canvas ghost and a retry all refuse alike.
 *
 * Real path: the REAL `useConversation`, the REAL `ConversationPanel` (which registers the chip path the ghost presses),
 * the REAL ghost bridge and `ProposalGhostLayer`. Only the network runner (`callV5Turn`), the auth/scenario bridges and
 * React Flow's viewport are mocked. The held card arrives on a real reply, as CEE's `_proposal_fields`.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

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
let rfNodes: unknown[] = []
vi.mock('@xyflow/react', async () => ({
  ...(await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react')),
  ViewportPortal: ({ children }: { children: ReactNode }) => children,
  useNodes: () => rfNodes,
  useEdges: () => [],
  useReactFlow: () => ({ screenToFlowPosition: (p: { x: number; y: number }) => p }),
  useStore: (select: (s: { transform: [number, number, number] }) => unknown) => select({ transform: [0, 0, 1] }),
}))

import { useConversation } from '../useConversation'
import { ConversationPanel } from '../ConversationPanel'
import { ToastProvider } from '../../ToastContext'
import { ProposalGhostLayer } from '../../nodes/ProposalGhostLayer'
import { useCanvasStore } from '../../store'
import { useProposalGhostStore } from '../../stores/proposalGhostStore'
import { AMEND_PROPOSAL_ACTION } from '../proposalFields'
import fixture from './fixtures/program-card-changes.json'

type Json = Record<string, any>
const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const APPROVE_ID = fixture.card.approve_action.id
const [goal, figure] = [fixture.card.changes[0], fixture.card.changes[6]]
/** A drawable figure (so the canvas draws a ghost with its own Approve) and no change notes (so nothing else blocks it). */
const FIELD = { field_id: 'factor_value:angel_raise_amount', kind: 'factor_value', node_id: 'angel_raise_amount', label: 'Amount sought from angels',
  unit: 'GBP', current: { value: 150000, unit: 'GBP', source: 'yours' }, filled_missing: false, editable: true }
const card = (changes: unknown[]): Json => ({ ...fixture.card, fields: [FIELD], adds: [], changes })
const UNREAD = [goal, { ...figure, id: 'bad', kind: 'mystery' }, figure]

/** A core reply as the client body carries it: the card's chips, and the held card in the parser's sidecar. */
function replyHolding(heldCard: Json) {
  const response: Json = {
    response_version: 2, assistant_text: 'I’ve prepared this for your approval.', blocks: [], insights: [], stage_indicator: 'frame',
    suggested_actions: [heldCard.approve_action, AMEND_PROPOSAL_ACTION, heldCard.decline_action],
  }
  Object.defineProperty(response, '__additive__', { value: { _proposal_fields: { version: 1, graph_hash: fixture.graph_hash, proposals: [heldCard] } } })
  return { kind: 'response' as const, response }
}

let live: ReturnType<typeof useConversation> | null = null
function App() {
  const conversation = useConversation()
  live = conversation
  return (
    <ToastProvider>
      <ConversationPanel conversation={conversation} onCollapse={vi.fn()} onAttach={vi.fn()} />
      <ProposalGhostLayer />
      <button type="button" data-testid="send-brief" onClick={() => { void conversation.sendMessage('We would seek £150,000 from angel investors.') }}>send</button>
    </ToastProvider>
  )
}
/** The app with the reply holding `heldCard` on screen; returns once its ghost (if any) is drawn. */
async function openWith(heldCard: Json) {
  mockCallV5Turn.mockResolvedValueOnce(replyHolding(heldCard))
  render(<App />)
  await act(async () => { fireEvent.click(screen.getByTestId('send-brief')) })
  await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
}
const turnsSent = () => mockCallV5Turn.mock.calls.length
const approvalsSent = () => mockCallV5Turn.mock.calls.filter(([p]) => (p as Json)?.chip?.id === APPROVE_ID).length

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
  window.history.replaceState(null, '', '/?ai=core-route')
  mockCallV5Turn.mockReset()
  rfNodes = [{ id: 'angel_raise_amount', position: { x: 100, y: 100 }, measured: { width: 240, height: 80 } }]
  useCanvasStore.getState().resetCanvas()
  useCanvasStore.setState({ currentScenarioId: SCENARIO, nodes: [{ id: 'angel_raise_amount', type: 'factor', position: { x: 100, y: 100 }, data: { label: 'Amount sought from angels' } }], edges: [] } as never)
})
afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/')
  const g = useProposalGhostStore.getState().ghost
  if (g) useProposalGhostStore.getState().clearGhost(g.proposalId)
})

describe('the canvas ghost cannot approve a card whose changes[] could not be read in full', () => {
  it('⛔ the ghost offers no Approve of its own (U-W1: "Review on the card"); zero approvals reach the wire', async () => {
    await openWith(card(UNREAD))
    expect(turnsSent()).toBe(1)
    expect(screen.queryByTestId('proposal-ghost-actions-approve')).toBeNull()
    await act(async () => { fireEvent.click(screen.getByTestId('proposal-ghost-actions-review')) })
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(approvalsSent()).toBe(0)
    expect(turnsSent()).toBe(1)
  })

  it('CONTRAST: the same card with its list read in full: the ghost’s Approve sends exactly one approval', async () => {
    mockCallV5Turn.mockResolvedValue({ kind: 'response', response: { response_version: 2, assistant_text: 'Saved.', blocks: [], suggested_actions: [], insights: [], stage_indicator: 'frame' } })
    await openWith(card([goal, figure]))
    const approve = screen.getByTestId('proposal-ghost-actions-approve')
    await act(async () => { fireEvent.click(approve) })
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(approvalsSent()).toBe(1)
  })
})

describe('any other caller of the same approve', () => {
  it('the chat card’s Approve is disabled (#2958); a direct send of it (keyboard, a retry, any caller) is refused at the boundary', async () => {
    await openWith(card(UNREAD))
    expect((screen.getByTestId(`suggested-chip-${APPROVE_ID}`) as HTMLButtonElement).disabled).toBe(true)
    await act(async () => { await live!.sendChip({ ...fixture.card.approve_action, id: APPROVE_ID } as never) })
    expect(approvalsSent()).toBe(0)
    expect(turnsSent()).toBe(1)
    // CONTRAST: another turn on the same reply still goes out.
    mockCallV5Turn.mockResolvedValueOnce({ kind: 'response', response: { response_version: 2, assistant_text: 'OK', blocks: [], suggested_actions: [], insights: [], stage_indicator: 'frame' } })
    await act(async () => { await live!.sendChip({ ...AMEND_PROPOSAL_ACTION } as never) })
    expect(turnsSent()).toBe(2)
  })
})
