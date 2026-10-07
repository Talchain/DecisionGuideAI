/**
 * S-D reload, bound to a SERVED capture (sd-wire-4: staging CEE 4f9f9e5, 7 Oct 15:18Z). A held Agent-lane change
 * (`gmh_…`) is NOT in the read's `held_proposal_offers` (CEE fills that from the conventional pending store only);
 * the read's `proposal_fields` is its one reload authority. Rows bind by proposal id, chip ids and exact words.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ChatThread } from '../zones/ChatThread'
import { useCanvasStore } from '../../store'
import { buildRestoredThread, readServerConversationTurns, readServerHeldProposalOffers, reconcileRestoredProposalFields } from '../serverConversationTurns'
import { readProposalFields, readTurnProposalFields } from '../proposalFields'
import served from './fixtures/served-held-proposal-sdwire4.json'

vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
  supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } },
}))
vi.mock('../../../lib/posthog', () => ({ trackEvent: vi.fn() }))

const PID = 'gmh_fd9035bc1669'
const T1 = 'e388cf20-b819-4a93-aab6-3637aaa3c085'
const DRAFT = 'da49ccf2-f57a-4ec6-bbe9-12b45d887f5b'
const RUN = { runNotCurrent: false, currentRunComputedAt: null }
const read = served.read_R1
const restore = (fields: unknown = read.proposal_fields) =>
  buildRestoredThread(readServerConversationTurns(read.conversation_turns) ?? [], RUN, read.held_proposal_offers, fields)
const latest = (thread: ReturnType<typeof restore>) => thread[thread.length - 1]
const fetchSpy = vi.fn()
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
  fetchSpy.mockReset(); vi.stubGlobal('fetch', fetchSpy)
  useCanvasStore.setState({ currentScenarioId: '9a3239b6-2aec-4d22-aca7-ba93e4ac96fd', nodes: [], edges: [] } as never)
})
afterEach(() => { HTMLElement.prototype.scrollIntoView = originalScrollIntoView; cleanup(); vi.unstubAllGlobals() })

describe('S-D reload restores the held change from proposal_fields (SERVED sd-wire-4)', () => {
  it('the served turn and the served read carry the same held entry', () => {
    const turn = readProposalFields(readTurnProposalFields({ __additive__: { _proposal_fields: served.turn_T1._proposal_fields } }))
    const reload = readProposalFields(read.proposal_fields)
    expect(turn?.proposals.map(p => [p.proposal_id, p.digest, p.fields.length, p.missing.length])).toEqual([[PID, 'c259d8f2be31d84e8fd6babee68e0ae7', 2, 1]])
    expect(reload?.proposals.map(p => [p.proposal_id, p.digest])).toEqual([[PID, 'c259d8f2be31d84e8fd6babee68e0ae7']])
    expect(served.turn_T1.suggested_actions.map(a => a.id)).toContain(`agent-approve-proposal:${PID}`)
  })

  it('PRECONDITION: the read held_proposal_offers carries no gmh_ card (only the draft turn prop_ confirm)', () => {
    expect(readServerHeldProposalOffers(read.held_proposal_offers).map(o => [o.turnId, o.proposalId.slice(0, 5)])).toEqual([[DRAFT, 'prop_']])
  })

  it('arms the gmh_ card on the LATEST reply with the exact approve / amend / decline and its fields', () => {
    const thread = restore(); const reply = latest(thread)
    const approve = served.turn_T1._proposal_fields.proposals[0].approve_action
    expect(reply.id).toBe(`restored-assistant-${T1}`)
    expect(reply.heldProposalId).toBe(PID)
    expect(reply.actionChips?.map(c => [c.id, c.label, c.message])).toEqual([
      [`agent-approve-proposal:${PID}`, approve.label, approve.message],
      ['agent-amend-proposal', 'Change something first', 'Before you apply it, I want to change some of it.'],
      [`agent-decline-proposal:${PID}`, 'Not now', 'Not now.'],
    ])
    expect(reply.proposalFields).toBe(read.proposal_fields)
    // The conventional card the read DID return keeps its own reply.
    expect(thread.find(m => m.id === `restored-assistant-${DRAFT}`)?.actionChips?.[0]?.id).toMatch(/^agent-approve-proposal:prop_/)
  })

  it('CONTROL: the same read without proposal_fields restores no gmh_ card', () => {
    const reply = latest(restore(null))
    expect(reply.id).toBe(`restored-assistant-${T1}`)
    expect((reply.actionChips ?? []).some(c => c.id === `agent-approve-proposal:${PID}`)).toBe(false)
  })

  it('a malformed entry, a later user message, or a card already on the reply leaves the thread unchanged', () => {
    const bad = { ...read.proposal_fields, proposals: [{ ...read.proposal_fields.proposals[0], digest: 'bad' }] }
    expect(latest(restore(bad)).actionChips ?? []).toHaveLength(0)
    const withUser = [...restore(null), { id: 'u-later', role: 'user' as const, content: 'later', timestamp: new Date() }]
    expect(reconcileRestoredProposalFields(withUser, read.proposal_fields)).toEqual(withUser)
    const armed = restore(); const again = reconcileRestoredProposalFields(armed, { ...read.proposal_fields, proposals: [] })
    expect(again).toEqual(armed)
    const prop = restore(null); const last = prop.length - 1
    prop[last] = { ...prop[last], actionChips: [{ id: 'agent-approve-proposal:prop_' + 'a'.repeat(32), label: 'Yes', message: 'Yes.' } as never] }
    expect(reconcileRestoredProposalFields(prop, read.proposal_fields)[last].actionChips?.map(c => c.id)).toEqual([`agent-approve-proposal:prop_${'a'.repeat(32)}`])
  })

  it('on the restored reply, "Change something first" opens the panel from the read, with 0 requests', () => {
    const send = vi.fn().mockResolvedValue(undefined)
    render(<ChatThread messages={restore()} isThinking={false} longRunningHint={null} nodeCount={1} patchBlockStates={new Map()}
      patchRejections={new Map()} onChipClick={send} onPatchAccept={vi.fn()} onPatchDismiss={vi.fn()} onFeedback={vi.fn()} onRetry={vi.fn()} compact />)
    fireEvent.click(screen.getByRole('button', { name: 'Change something first' }))
    const panel = screen.getByRole('region', { name: 'What this change assumes' })
    const f = read.proposal_fields.proposals[0].fields[0]
    const row = within(panel).getByTestId(`proposal-field-${PID}-${f.field_id}`)
    expect(row.textContent).toContain(`${f.from_label} → ${f.to_label}`)
    expect(within(row).getByText("Olumi's placeholder")).toBeTruthy()
    expect(send).not.toHaveBeenCalled(); expect(fetchSpy).not.toHaveBeenCalled()
  })
})
