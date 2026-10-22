/**
 * Contract v1.6 on REAL core-route bodies (R2 `POST /agent/v1/core-turn`, a card turn and its approval, 22 Oct): the
 * one reader parses them, the existing readers find the revision, the saved identity, the card and who authorised the
 * write. The two gaps against v1.4 are pinned as todos until core-route closes them (null analysis_state; null
 * issued_turn_id).
 */
import { describe, expect, it } from 'vitest'
import { parseV5Response, ADDITIVE_EXTENSIONS_KEY } from '../responseParser'
import { readProposalFields } from '../../canvas/conversation/proposalFields'
import { readRecordedServerTurnId } from '../../canvas/conversation/serverTurnId'
import { agentTurnUndoLabel, readAgentTurnReceipts } from '../../canvas/undo/captureAgentTurnForUndo'
import { readAfterWriteExpectation } from '../../canvas/conversation/readAfterWrite'
import real from './fixtures/core-turn-r2-real.json'

const parse = (body: unknown) =>
  parseV5Response(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }), { coreRoute: true })
const sidecar = (r: unknown) => (r as Record<string, Record<string, unknown>>)[ADDITIVE_EXTENSIONS_KEY]

describe('core route: real R2 bodies read through the one contract reader', () => {
  it('⭐ the card turn: its reply, its card with approve / change / decline, its turn and the saved identity to read back', async () => {
    const parsed = await parse(real.card_turn)
    expect(parsed.kind).toBe('response')
    if (parsed.kind !== 'response') return
    const card = real.card_turn.cards[0]
    expect(parsed.response.assistant_text).toBe(real.card_turn.assistant_text)
    expect(parsed.response.suggested_actions.map((a) => a.id)).toEqual([card.approve_action.id, 'agent-amend-proposal', card.decline_action.id])
    expect(readProposalFields(sidecar(parsed.response)._proposal_fields)?.proposals.map((p) => p.proposal_id)).toEqual([card.proposal_id])
    expect(readRecordedServerTurnId(parsed.response)).toBe(real.card_turn.turn_id)
    expect(readAfterWriteExpectation(parsed.response)).toEqual({ scenarioRevision: real.card_turn.model.scenario_revision, runId: null })
    expect(sidecar(parsed.response)._proposal_fields).toMatchObject({ graph_hash: real.card_turn.model.revision })
  })

  it('⭐ the approval turn: the person\'s write is theirs in undo, its receipt and the new saved identity are read', async () => {
    const parsed = await parse(real.approval_turn)
    expect(parsed.kind).toBe('response')
    if (parsed.kind !== 'response') return
    expect(readAgentTurnReceipts(parsed.response)).toEqual([{ version: 1, versionId: 'v_1', mutationId: 'm_1' }])
    const olumi = await parse({ ...real.approval_turn, receipts: [{ ...real.approval_turn.receipts[0], authorised_by: 'olumi' }] })
    expect(agentTurnUndoLabel(parsed.response)).not.toBe(olumi.kind === 'response' ? agentTurnUndoLabel(olumi.response) : null)
    expect(readAfterWriteExpectation(parsed.response)?.scenarioRevision).toBe(real.approval_turn.model.scenario_revision)
    expect(real.approval_turn.model.scenario_revision).not.toBe(real.card_turn.model.scenario_revision)
  })

  it.todo('GAP v1.4: analysis_state is null on both real turns; v1.4 requires the FULL verdict on every turn (absence audit rows 5–7)')
  it.todo('GAP v1: the card\'s issued_turn_id is null; it must be the issuing turn\'s turn_id so the card reattaches on reopen')
})
