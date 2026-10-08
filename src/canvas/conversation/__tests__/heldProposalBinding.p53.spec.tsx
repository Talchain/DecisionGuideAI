/** P53 contract: approval binds to the held record on the reply that issued the card. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { SuggestedChips } from '../zones/SuggestedChips'
import { ChatThread } from '../zones/ChatThread'
import { AMEND_PROPOSAL_ACTION, type ProposalPanelAction } from '../proposalFields'
import { reconcileRestoredProposalFields } from '../serverConversationTurns'
import type { ConversationMessage } from '../types'
import { useCanvasStore } from '../../store'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { buildV5Payload } from '../../../v5/buildPayload'
import { typography } from '../../../styles/typography'

vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
  supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } },
}))
vi.mock('../../../lib/posthog', () => ({ trackEvent: vi.fn() }))

const SID = '66666666-8888-4999-aaaa-bbbbbbbbbbbb'
const PID_A = 'gmh_aaaaaaaaaaaa'
const PID_B = 'gmh_bbbbbbbbbbbb'
const DIGEST_A = 'a'.repeat(32)
const DIGEST_B = 'b'.repeat(32)
const EARLIER_LABEL = 'An earlier suggestion, still waiting for your answer:'
const GRAPH_HASH = 'c'.repeat(64)
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView

function proposal(id: string, name: string, digest: string, issuedTurnId?: string) {
  return {
    proposal_id: id,
    revision: `revision-${name}`,
    digest,
    ...(issuedTurnId === undefined ? {} : { issued_turn_id: issuedTurnId }),
    approve_action: { id: `agent-approve-proposal:${id}`, label: `Approve ${name} changes`, message: `Yes, add risk ${name}.` },
    decline_action: { id: `agent-decline-proposal:${id}`, label: 'Not now' as const, message: 'Not now.' as const },
    fields: [{
      field_id: `link_strength:risk_${name}::goal`, kind: 'link_strength',
      from_id: `risk_${name}`, to_id: 'goal', from_label: `Risk ${name}`, to_label: 'Our goal', direction: 'negative',
      current: { band: 'strong', source: 'placeholder' }, allowed_bands: ['slight', 'moderate', 'strong', 'very_strong'], editable: true,
    }],
    missing: [],
  }
}
const A = proposal(PID_A, 'A', DIGEST_A)
const B = proposal(PID_B, 'B', DIGEST_B)
const wire = (...proposals: ReturnType<typeof proposal>[]) => ({ version: 1, graph_hash: GRAPH_HASH, proposals })
const chips = (p: ReturnType<typeof proposal>) => buildSuggestedActionChips([], [p.approve_action, AMEND_PROPOSAL_ACTION, p.decline_action])
const binding = (p: ReturnType<typeof proposal>) => ({ proposal_id: p.proposal_id, revision: p.revision, digest: p.digest, graph_hash: GRAPH_HASH, fields: [] })

function built(chip: ProposalPanelAction, source: 'chip' | 'chip_click' = 'chip') {
  const result = buildV5Payload({ turnId: 'approval-turn', scenarioId: SID, mode: 'user', stage: 'frame', turnClass: 'frame', source,
    message: chip.message, chipMeta: { id: chip.id }, proposalEdits: chip.proposalEdits })
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error('Approval payload did not build')
  return result.payload
}

function mount(p = A, fields: unknown = wire(p), send = vi.fn().mockResolvedValue(undefined)) {
  return { ...render(<SuggestedChips chips={chips(p)} proposalFields={fields} replyId={`reply-${p.proposal_id}`} onChipClick={send} />), send }
}

function reply(id: string, content: string, association: Partial<ConversationMessage> = {}): ConversationMessage {
  return { id, role: 'assistant', content, timestamp: new Date('2026-10-08T01:00:00Z'), ...association }
}

function renderThread(messages: ConversationMessage[], send = vi.fn().mockResolvedValue(undefined)) {
  return { ...render(<ChatThread messages={messages} isThinking={false} longRunningHint={null} nodeCount={1}
    patchBlockStates={new Map()} patchRejections={new Map()} onChipClick={send} onPatchAccept={vi.fn()}
    onPatchDismiss={vi.fn()} onFeedback={vi.fn()} onRetry={vi.fn()} compact />), send }
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
  // The no-record control stays genuinely absent: no background graph-read fallback.
  useCanvasStore.setState({ currentScenarioId: null, nodes: [], edges: [], results: null, serverGraphIdentity: null, lastAuthoritativeGraph: null } as never)
})
afterEach(() => { HTMLElement.prototype.scrollIntoView = originalScrollIntoView; cleanup() })

describe('P53: an approval is bound to the message that issued it, from render to commit', () => {
  it.each(['chip', 'chip_click'] as const)('B1: a plain approve sends the rendered record binding with fields: [] (%s)', source => {
    const { send } = mount()
    fireEvent.click(screen.getByTestId(`suggested-chip-${A.approve_action.id}`))
    expect(send).toHaveBeenCalledTimes(1)
    expect(built(send.mock.calls[0][0], source)).toMatchObject({ source, chip: { id: A.approve_action.id }, proposal_edits: binding(A) })
  })

  it.each(["Use Olumi's suggestions", 'Submit'])('B2: panel %s sends the same binding with fields: []', label => {
    const { send } = mount()
    fireEvent.click(screen.getByRole('button', { name: AMEND_PROPOSAL_ACTION.label }))
    const panel = screen.getByRole('region', { name: 'What this change assumes' })
    if (label === "Use Olumi's suggestions") {
      // The reset action keeps the card binding while declining this local value change.
      const field = within(panel).getByTestId(`proposal-field-${PID_A}-${A.fields[0].field_id}`)
      fireEvent.click(within(field).getByRole('button', { name: /^Very strong/ }))
    }
    fireEvent.click(within(panel).getByRole('button', { name: label }))
    expect(send).toHaveBeenCalledTimes(1)
    expect(built(send.mock.calls[0][0])).toMatchObject({ chip: { id: A.approve_action.id }, proposal_edits: binding(A) })
  })

  it('B3: an approve chip on a reply with no record has no proposal_edits key', () => {
    const send = vi.fn().mockResolvedValue(undefined)
    render(<SuggestedChips chips={chips(A)} replyId="reply-without-record" onChipClick={send} />)
    fireEvent.click(screen.getByTestId(`suggested-chip-${A.approve_action.id}`))
    expect(send).toHaveBeenCalledTimes(1)
    expect(built(send.mock.calls[0][0])).not.toHaveProperty('proposal_edits')
  })

  it('B4: two replies approve their own proposal ids and different record digests', () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const messages = [reply('message-1', 'Held offer A', { actionChips: chips(A), proposalFields: wire(A) }),
      reply('message-2', 'Held offer B', { actionChips: chips(B), proposalFields: wire(B) })]
    render(<>{messages.map(message => <section key={message.id} aria-label={message.id}>
      <SuggestedChips chips={message.actionChips!} proposalFields={message.proposalFields} replyId={message.id} onChipClick={send} />
    </section>)}</>)
    fireEvent.click(within(screen.getByRole('region', { name: 'message-1' })).getByTestId(`suggested-chip-${A.approve_action.id}`))
    fireEvent.click(within(screen.getByRole('region', { name: 'message-2' })).getByTestId(`suggested-chip-${B.approve_action.id}`))
    expect(send).toHaveBeenCalledTimes(2)
    expect(built(send.mock.calls[0][0])).toMatchObject({ chip: { id: A.approve_action.id }, proposal_edits: binding(A) })
    expect(built(send.mock.calls[1][0])).toMatchObject({ chip: { id: B.approve_action.id }, proposal_edits: binding(B) })
  })

  it.each(['restored id', 'clientTurnId', 'serverTurnId'] as const)('B5: reload matches both issuing turns through %s and keeps both approvals visible', association => {
    const first = association === 'restored id' ? reply('restored-assistant-t1', 'Issued offer A')
      : reply('local-reply-1', 'Issued offer A', { [association]: 't1' })
    const second = association === 'restored id' ? reply('restored-assistant-t2', 'Issued offer B')
      : reply('local-reply-2', 'Issued offer B', { [association]: 't2' })
    const raw = wire(proposal(PID_A, 'A', DIGEST_A, 't1'), proposal(PID_B, 'B', DIGEST_B, 't2'))
    const restored = reconcileRestoredProposalFields([first, second], raw)
    expect(restored[0]).toMatchObject({ id: first.id, heldProposalId: PID_A, proposalFields: raw })
    expect(restored[1]).toMatchObject({ id: second.id, heldProposalId: PID_B, proposalFields: raw })
    expect(restored[0].actionChips?.map(c => c.id)).toEqual([A.approve_action.id, AMEND_PROPOSAL_ACTION.id, A.decline_action.id])
    expect(restored[1].actionChips?.map(c => c.id)).toEqual([B.approve_action.id, AMEND_PROPOSAL_ACTION.id, B.decline_action.id])
    expect(restored[1].actionChips?.some(c => c.id === A.approve_action.id)).toBe(false)
    const { send } = renderThread(restored)
    const approveA = screen.getByTestId(`suggested-chip-${A.approve_action.id}`)
    const approveB = screen.getByTestId(`suggested-chip-${B.approve_action.id}`)
    const groupA = approveA.closest('.response-chip-group')!
    const groupB = approveB.closest('.response-chip-group')!
    expect(groupA).not.toBeNull(); expect(groupB).not.toBeNull(); expect(groupA).not.toBe(groupB)
    expect(within(groupA as HTMLElement).getByText('Issued offer A')).toBeTruthy()
    expect(within(groupB as HTMLElement).getByText('Issued offer B')).toBeTruthy()
    fireEvent.click(approveA); fireEvent.click(approveB)
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[0][1]).toBe(first.id)
    expect(send.mock.calls[1][1]).toBe(second.id)
    expect(built(send.mock.calls[0][0])).toMatchObject({ proposal_edits: binding(A) })
    expect(built(send.mock.calls[1][0])).toMatchObject({ proposal_edits: binding(B) })
    expect(screen.queryByTestId('held-proposal-earlier-label')).toBeNull()
  })

  it('B6: no issuing turn falls back to the last reply, skips a resumed divider, and renders the exact older-suggestion label', () => {
    const divider = reply('resumed', '', { synthetic: true, sessionDivider: 'Session resumed' })
    const raw = wire(A)
    const restored = reconcileRestoredProposalFields([reply('restored-assistant-t1', 'Earlier reply'), reply('restored-assistant-t2', 'Last reply'), divider], raw)
    expect(restored[0].actionChips ?? []).toHaveLength(0)
    expect(restored[1]).toMatchObject({ heldProposalId: PID_A, heldProposalEarlier: true, proposalFields: raw })
    expect(restored[2]).toBe(divider)
    renderThread(restored)
    const label = screen.getByTestId('held-proposal-earlier-label')
    expect(label.textContent).toBe(EARLIER_LABEL)
    expect(label.className).toContain(typography.chatMeta)
    const group = screen.getByTestId(`suggested-chip-${A.approve_action.id}`).closest('.response-chip-group')!
    expect(within(group as HTMLElement).getByText('Last reply')).toBeTruthy()
    expect(within(group as HTMLElement).getByTestId('held-proposal-earlier-label')).toBe(label)
    expect(label.compareDocumentPosition(within(group as HTMLElement).getByTestId('suggested-chips')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('B7: an issuing turn missing from restored history is labelled as an older suggestion on the last reply', () => {
    const raw = wire(proposal(PID_A, 'A', DIGEST_A, 'not-restored'))
    const restored = reconcileRestoredProposalFields([reply('restored-assistant-t1', 'Earlier reply'), reply('restored-assistant-t2', 'Last reply')], raw)
    expect(restored[0].actionChips ?? []).toHaveLength(0)
    expect(restored[1]).toMatchObject({ heldProposalId: PID_A, heldProposalEarlier: true, proposalFields: raw })
    renderThread(restored)
    expect(screen.getByTestId('held-proposal-earlier-label').textContent).toBe(EARLIER_LABEL)
    expect(screen.getByTestId(`suggested-chip-${A.approve_action.id}`)).toBeTruthy()
  })

  it('B8: an unmatched first entry cannot occupy the last reply owned by a matched second proposal', () => {
    const raw = wire(A, proposal(PID_B, 'B', DIGEST_B, 't2'))
    const restored = reconcileRestoredProposalFields([reply('restored-assistant-t1', 'Earlier reply'), reply('restored-assistant-t2', 'Issued offer B')], raw)
    expect(restored[0].actionChips ?? []).toHaveLength(0)
    expect(restored[1]).toMatchObject({ heldProposalId: PID_B, proposalFields: raw })
    expect(restored[1].actionChips?.filter(c => c.id?.startsWith('agent-approve-proposal:')).map(c => c.id)).toEqual([B.approve_action.id])
    expect(restored[1]).not.toMatchObject({ heldProposalEarlier: true })
    renderThread(restored)
    expect(screen.queryByTestId(`suggested-chip-${A.approve_action.id}`)).toBeNull()
    expect(screen.getByTestId(`suggested-chip-${B.approve_action.id}`)).toBeTruthy()
    expect(screen.queryByTestId('held-proposal-earlier-label')).toBeNull()
  })

  it('B9: a matching reply already holding its own approve card gains the current record and keeps deduped controls and other chips', () => {
    const other = { id: 'another-chat-action', label: 'Explore the risks', message: 'Explore the risks.' }
    const issued = proposal(PID_A, 'A', DIGEST_A, 't1')
    const raw = wire(issued)
    const oldRecord = wire(proposal(PID_A, 'A', 'd'.repeat(32)))
    const existing = reply('restored-assistant-t1', 'Issued offer A', {
      heldProposalId: PID_A, actionChips: [other, ...chips(A)], proposalFields: oldRecord,
    })
    const restored = reconcileRestoredProposalFields([existing, reply('restored-assistant-t2', 'Later reply')], raw)
    expect(restored[0]).toMatchObject({ id: existing.id, heldProposalId: PID_A, proposalFields: raw })
    expect(restored[0].proposalFields).toBe(raw)
    expect(restored[0].actionChips?.map(c => c.id)).toEqual([A.approve_action.id, AMEND_PROPOSAL_ACTION.id, A.decline_action.id, other.id])
    expect(restored[0].actionChips?.find(c => c.id === other.id)).toEqual(other)
    expect(restored[1].actionChips ?? []).toHaveLength(0)
    const { send } = renderThread(restored)
    fireEvent.click(screen.getByTestId(`suggested-chip-${A.approve_action.id}`))
    expect(built(send.mock.calls[0][0])).toMatchObject({ proposal_edits: binding(issued) })
  })

  it('B10: repeated approve id renders only its newer record while a different held proposal remains visible', () => {
    const newerA = { ...proposal(PID_A, 'A', 'e'.repeat(32)), revision: 'revision-A-newer' }
    const messages = [
      reply('old-A', 'Older offer A', { heldProposalId: PID_A, actionChips: chips(A), proposalFields: wire(A) }),
      reply('own-B', 'Distinct offer B', { heldProposalId: PID_B, actionChips: chips(B), proposalFields: wire(B) }),
      // As CEE sends it: the latest reply's _proposal_fields lists EVERY proposal still held.
      reply('new-A', 'Newer offer A', { heldProposalId: PID_A, actionChips: chips(newerA), proposalFields: wire(B, newerA) }),
    ]
    const { send } = renderThread(messages)
    expect(screen.getAllByTestId(`suggested-chip-${A.approve_action.id}`)).toHaveLength(1)
    expect(screen.getAllByTestId(`suggested-chip-${B.approve_action.id}`)).toHaveLength(1)
    const approveA = screen.getByTestId(`suggested-chip-${A.approve_action.id}`)
    const approveB = screen.getByTestId(`suggested-chip-${B.approve_action.id}`)
    const groupA = approveA.closest('.response-chip-group')!
    const groupB = approveB.closest('.response-chip-group')!
    expect(within(groupA as HTMLElement).getByText('Newer offer A')).toBeTruthy()
    expect(within(groupA as HTMLElement).queryByText('Older offer A')).toBeNull()
    expect(within(groupB as HTMLElement).getByText('Distinct offer B')).toBeTruthy()
    expect(screen.getByText('Older offer A')).toBeTruthy()
    fireEvent.click(approveB); fireEvent.click(approveA)
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[0][1]).toBe('own-B')
    expect(send.mock.calls[1][1]).toBe('new-A')
    expect(built(send.mock.calls[0][0])).toMatchObject({ proposal_edits: binding(B) })
    expect(built(send.mock.calls[1][0])).toMatchObject({ proposal_edits: binding(newerA) })
  })

  it('B11 (stale-live): once B is settled, the latest reply no longer lists it, so its earlier card is retired', () => {
    const messages = [
      reply('own-B', 'Distinct offer B', { heldProposalId: PID_B, actionChips: chips(B), proposalFields: wire(B) }),
      reply('after', 'Done: B was added.', { proposalFields: undefined }),
    ]
    renderThread(messages)
    expect(screen.queryByTestId(`suggested-chip-${B.approve_action.id}`)).toBeNull()
  })

  it('B12 (reload): restored cards stay on their issuing replies because the latest reply carries the read\'s held set', () => {
    const restored = reconcileRestoredProposalFields([
      reply('restored-assistant-t1', 'Issued A'), reply('restored-assistant-t2', 'Issued B'), reply('restored-assistant-t3', 'Latest answer'),
    ], wire(proposal(PID_A, 'A', DIGEST_A, 't1'), proposal(PID_B, 'B', DIGEST_B, 't2')))
    renderThread(restored)
    const groupA = screen.getByTestId(`suggested-chip-${A.approve_action.id}`).closest('.response-chip-group') as HTMLElement
    const groupB = screen.getByTestId(`suggested-chip-${B.approve_action.id}`).closest('.response-chip-group') as HTMLElement
    expect(within(groupA).getByText('Issued A')).toBeTruthy()
    expect(within(groupB).getByText('Issued B')).toBeTruthy()
  })

  it('B13: issued_turn_id null (CEE could not match the issuing row) is treated as unmatched and labelled earlier', () => {
    const restored = reconcileRestoredProposalFields([reply('restored-assistant-t1', 'Earlier reply'), reply('restored-assistant-t2', 'Last reply')],
      wire({ ...proposal(PID_A, 'A', DIGEST_A), issued_turn_id: null } as unknown as ReturnType<typeof proposal>))
    expect(restored[1]).toMatchObject({ heldProposalId: PID_A, heldProposalEarlier: true })
    expect(restored[0].heldProposalId).toBeUndefined()
  })
})
