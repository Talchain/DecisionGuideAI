/**
 * ⭐ AN APPROVAL IS ONE ACTION (DL-3 18 Oct; assessment K5 L2: "press the approval button on the card", and no button was
 * there): a reply that offered SEVERAL waiting cards keeps a button for EVERY one it is the live owner of, each with its own
 * "Not now", after a later reply arrives — while a card CEE no longer holds, or one a newer reply re-offers, is not kept.
 * SYNTHETIC cards. Binds by chip identity (`data-testid` carries the id), never by position or text.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatThread } from '../zones/ChatThread'
import type { ConversationMessage } from '../types'
import { reconcileRestoredProposalFields } from '../serverConversationTurns'
import { displayedProposals } from '../proposalFields'
import { buildV5Payload } from '../../../v5/buildPayload'

vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    (selector: (s: any) => any) => selector({ nodes: [], edges: [] }),
    { getState: () => ({ nodes: [], edges: [] }), setState: vi.fn(), subscribe: vi.fn() },
  ),
}))
vi.mock('../../../stores/uiStore', () => ({
  useUIStore: Object.assign((selector: (s: any) => any) => selector({}), { getState: () => ({ setActiveOutputTab: vi.fn() }), setState: vi.fn() }),
}))
vi.mock('../../stores/guidanceStore', () => ({
  useGuidanceStore: Object.assign(
    (selector: (s: any) => any) => selector({ guidanceItems: [], _dispatchAction: vi.fn() }),
    { getState: () => ({ guidanceItems: [], _dispatchAction: vi.fn(), dismissItem: vi.fn() }) },
  ),
}))
beforeEach(() => { Element.prototype.scrollIntoView = vi.fn() })

const A = `prop_${'a'.repeat(32)}`, B = `prop_${'b'.repeat(32)}`, C = `prop_${'c'.repeat(32)}`
const approve = (id: string, label: string) => ({ id: `agent-approve-proposal:${id}`, label, message: 'Yes, use those.', intent: 'primary' as const })
const decline = (id: string) => ({ id: `agent-decline-proposal:${id}`, label: 'Not now', message: 'Not now.', intent: 'secondary' as const })
const AMEND = { id: 'agent-amend-proposal', label: 'Change something first', message: 'Before you apply it, I want to change some of it.', intent: 'secondary' as const }
const record = (id: string, label: string) => ({ proposal_id: id, revision: `rev-${id.slice(5, 9)}`, digest: id.slice(5, 37),
  approve_action: { id: `agent-approve-proposal:${id}`, label, message: 'Yes, use those.' }, decline_action: { id: `agent-decline-proposal:${id}`, label: 'Not now', message: 'Not now.' }, issued_turn_id: null, fields: [], missing: [] })
const fields = (...ids: [string, string][]) => ({ version: 1, graph_hash: '0123456789abcdef', proposals: ids.map(([id, label]) => record(id, label)) })

let seq = 0
const msg = (o: Partial<ConversationMessage>): ConversationMessage =>
  ({ id: `m-${++seq}`, role: 'assistant', content: 'reply', timestamp: new Date(), ...o } as ConversationMessage)
function renderThread(messages: ConversationMessage[]) {
  render(<ChatThread messages={messages} isThinking={false} longRunningHint={null} nodeCount={1} patchBlockStates={new Map()}
    patchRejections={new Map()} onChipClick={vi.fn().mockResolvedValue(undefined)} onPatchAccept={vi.fn()} onPatchDismiss={vi.fn()}
    onFeedback={vi.fn()} onRetry={vi.fn()} />)
}
const has = (id: string) => screen.queryByTestId(`suggested-chip-${id}`) !== null

describe('every waiting card keeps its button on the reply that offered it', () => {
  it('⭐ RED→GREEN: a reply offering TWO cards keeps BOTH buttons (and each "Not now") once a later reply offers a third', () => {
    renderThread([
      msg({ role: 'user', content: 'yes' }),
      msg({ actionChips: [approve(B, 'Record this level'), approve(A, 'Use as starting assumptions'), AMEND, decline(B), decline(A)],
        proposalFields: fields([B, 'Record this level'], [A, 'Use as starting assumptions']) }),
      msg({ role: 'user', content: 'Also suggest a starting value for oven capacity.' }),
      msg({ actionChips: [approve(C, 'Use as starting assumptions'), AMEND, decline(C)],
        proposalFields: fields([A, 'Use as starting assumptions'], [B, 'Record this level'], [C, 'Use as starting assumptions']) }),
    ])
    for (const id of [A, B, C]) expect(has(`agent-approve-proposal:${id}`), id).toBe(true)
    for (const id of [A, B, C]) expect(has(`agent-decline-proposal:${id}`), id).toBe(true)
    // Several cards in one row: each "Not now" says which card it sets aside; a row with one card keeps the plain words.
    expect(screen.getByTestId(`suggested-chip-agent-decline-proposal:${B}`).textContent).toBe('Not now: Record this level')
    expect(screen.getByTestId(`suggested-chip-agent-decline-proposal:${A}`).textContent).toBe('Not now: Use as starting assumptions')
    expect(screen.getByTestId(`suggested-chip-agent-decline-proposal:${C}`).textContent).toBe('Not now')
  })

  it('CONTRAST: a card CEE no longer holds keeps no button on the earlier reply; the one it still holds does', () => {
    renderThread([
      msg({ actionChips: [approve(B, 'Record this level'), approve(A, 'Use as starting assumptions'), AMEND, decline(B), decline(A)],
        proposalFields: fields([B, 'Record this level'], [A, 'Use as starting assumptions']) }),
      msg({ role: 'user', content: 'Not now for the starting value.' }),
      msg({ actionChips: [], proposalFields: fields([B, 'Record this level']) }),
    ])
    expect(has(`agent-approve-proposal:${B}`)).toBe(true)
    expect(has(`agent-approve-proposal:${A}`)).toBe(false)
    expect(has(`agent-decline-proposal:${A}`)).toBe(false)
  })

  it('CONTRAST: a card a newer reply re-offers is shown once, on that newer reply', () => {
    renderThread([
      msg({ actionChips: [approve(B, 'Record this level'), approve(A, 'Use as starting assumptions'), AMEND, decline(B), decline(A)],
        proposalFields: fields([B, 'Record this level'], [A, 'Use as starting assumptions']) }),
      msg({ role: 'user', content: 'Which one was the mixer?' }),
      msg({ actionChips: [approve(B, 'Record this level'), approve(A, 'Use as starting assumptions'), AMEND, decline(B), decline(A)],
        proposalFields: fields([B, 'Record this level'], [A, 'Use as starting assumptions']) }),
    ])
    expect(screen.getAllByTestId(`suggested-chip-agent-approve-proposal:${A}`)).toHaveLength(1)
    expect(screen.getAllByTestId(`suggested-chip-agent-approve-proposal:${B}`)).toHaveLength(1)
  })
})

// ⭐ Codex BLOCK on #2819@439361db (18 Oct): its two restore probes, adopted as rows. A restore brings back EVERY waiting card.
describe('every waiting card survives a server restore', () => {
  it.each(['same issuing reply', 'unmatched issuing reply'])('%s: both waiting cards come back, each with its button and its "Not now"', kind => {
    const raw = fields([A, 'First reading'], [B, 'Second reading'])
    const proposals = raw.proposals.map(p => ({ ...p, issued_turn_id: kind === 'same issuing reply' ? 'issued-1' : null }))
    const restored = reconcileRestoredProposalFields([msg({ id: 'restored-assistant-issued-1', actionChips: [] })], { ...raw, proposals })
    renderThread(restored)
    for (const id of [A, B]) expect(has(`agent-approve-proposal:${id}`), id).toBe(true)
    for (const id of [A, B]) expect(has(`agent-decline-proposal:${id}`), id).toBe(true)
  })
})

// ⭐ What a typed turn says the user can see: CEE binds typed words ONLY to one of these cards, at this revision.
describe('the cards on screen, sent with a typed turn', () => {
  it('the latest reply\'s two cards, each at the revision it rendered', () => {
    const shown = displayedProposals([
      msg({ role: 'user', content: 'Suggest a starting value.' }),
      msg({ actionChips: [approve(B, 'Record this level'), approve(A, 'Use as starting assumptions'), AMEND, decline(B), decline(A)],
        proposalFields: fields([B, 'Record this level'], [A, 'Use as starting assumptions']) }),
    ])
    expect(shown).toEqual([{ proposal_id: B, revision: `rev-${B.slice(5, 9)}` }, { proposal_id: A, revision: `rev-${A.slice(5, 9)}` }])
  })
  it('a reply this client never received shows nothing new: only the card on screen is sent (the lost replacement is not)', () => {
    // Card A is on screen; CEE replaced it with C, but that reply never arrived, so this client's messages end at A.
    const shown = displayedProposals([
      msg({ actionChips: [approve(A, 'Use as starting assumptions'), AMEND, decline(A)], proposalFields: fields([A, 'Use as starting assumptions']) }),
      msg({ role: 'user', content: 'Actually make it 12%.' }),
    ])
    expect(shown.map(p => p.proposal_id)).toEqual([A])
  })
  it('an earlier reply\'s card CEE no longer holds is not on screen, so it is not sent', () => {
    const shown = displayedProposals([
      msg({ actionChips: [approve(A, 'Use as starting assumptions'), AMEND, decline(A)], proposalFields: fields([A, 'Use as starting assumptions']) }),
      msg({ role: 'user', content: 'Not now.' }),
      msg({ actionChips: [], proposalFields: fields([B, 'Record this level']) }),
    ])
    expect(shown.map(p => p.proposal_id)).toEqual([])
  })
  it('the payload: a typed turn carries the set; a press does not (its chip names its card)', () => {
    const base = { turnId: 't-1', scenarioId: 's-1', stage: 'frame' as const, turnClass: 'frame' as const, mode: 'user' as const,
      displayedProposals: [{ proposal_id: A, revision: 'rev-a' }] }
    const typed = buildV5Payload({ ...base, message: 'Approved.', source: 'composer' })
    expect(typed.ok && typed.payload).toMatchObject({ source: 'composer', displayed_proposals: [{ proposal_id: A, revision: 'rev-a' }] })
    const pressed = buildV5Payload({ ...base, message: 'Yes, use those.', source: 'chip_click', chipMeta: { id: `agent-approve-proposal:${A}` } })
    expect(pressed.ok && pressed.payload).not.toHaveProperty('displayed_proposals')
  })
})
