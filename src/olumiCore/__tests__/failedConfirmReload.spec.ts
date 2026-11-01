/**
 * A first model waits for its confirmation. When "Looks right" failed (core 5xx or 409, "nothing was saved"), the page still holds the
 * person's press as a later message of the thread. After a reload the waiting card is placed by the READ (olumi-core lists it as still
 * held) and must come back beside the reply that offered it: with a press after it, the card used to be dropped, and the model
 * looked confirmed when nothing had been saved.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reconcileRestoredProposalFields } from '../../canvas/conversation/serverConversationTurns'
import { consentChipIdFor } from '../../canvas/conversation/proposalPreview'
import { makeShim } from '../../../scripts/olumi-core/lib/turn.mjs'
import type { ConversationMessage } from '../../canvas/conversation/types'
import firstPending from './fixtures/view-first-pending.json'

const SID = 's_abc000000001'
const card = () => {
  const shim = makeShim({ core: async () => ({}) })
  const view = structuredClone(firstPending) as never as { id: string }
  view.id = SID
  return shim.cardFor(view, '5b2f3d3e-0000-4000-8000-000000000001') as { proposal_id: string }
}
const fields = () => { const c = card(); return { version: 1, graph_hash: 'a'.repeat(16), proposals: [{ ...c, issued_turn_id: 'derived-by-the-read' }] } }
const at = new Date()
/** The page's own thread after a live first draft and a failed press: the reply carries the page's turn id, not the read's, so it cannot be matched by id. */
const thread = (): ConversationMessage[] => [
  { id: 'u1', role: 'user', content: 'Should we add one specialist?', timestamp: at },
  { id: 'a1', role: 'assistant', content: 'Here is your situation as I understood it.', timestamp: at, clientTurnId: 'client-turn-1', heldProposalId: card().proposal_id },
  { id: 'u2', role: 'user', content: 'Looks right', timestamp: at, chipInitiated: true },
  { id: 'div', role: 'assistant', content: '', timestamp: at, sessionDivider: 'Session resumed', synthetic: true },
] as ConversationMessage[]
const offersConfirm = (m: ConversationMessage) => (m.actionChips ?? []).some((c) => c.id === consentChipIdFor(card().proposal_id))

beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', '1') })
afterEach(() => vi.unstubAllEnvs())

describe('a failed Confirm followed by a reload still shows the first model as waiting', () => {
  it('the held card comes back on the reply that offered it, though a press follows it', () => {
    const out = reconcileRestoredProposalFields(thread(), fields())
    expect(offersConfirm(out.find((m) => m.id === 'a1')!)).toBe(true)
  })
  it('and the person\'s press is not taken away: it stays in the thread', () => {
    expect(reconcileRestoredProposalFields(thread(), fields()).some((m) => m.id === 'u2')).toBe(true)
  })
  it('off the olumi-core lane nothing changes (CEE\'s own rule: a later message takes priority)', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    const out = reconcileRestoredProposalFields(thread(), fields())
    expect(out.some(offersConfirm)).toBe(false)
  })
})
