/**
 * Contract v1.6 on REAL core-route bodies (R2 `POST /agent/v1/core-turn`, a card turn and its approval, 22 Oct): the
 * one reader parses them, the existing readers find the revision, the saved identity, the card and who authorised the
 * write, the full analysis verdict on every turn, and the value a card proposes as its ghost. Regenerated bodies, 22 Oct (the
 * first harness sent null analysis_state and issued_turn_id; core-route fixed its harness, not the route).
 */
import { describe, expect, it } from 'vitest'
import { parseV5Response, ADDITIVE_EXTENSIONS_KEY } from '../responseParser'
import { readProposalFields } from '../../canvas/conversation/proposalFields'
import { readRecordedServerTurnId } from '../../canvas/conversation/serverTurnId'
import { agentTurnUndoLabel, readAgentTurnReceipts } from '../../canvas/undo/captureAgentTurnForUndo'
import { readAfterWriteExpectation } from '../../canvas/conversation/readAfterWrite'
import { previewFromFields } from '../../canvas/conversation/proposalPreview'
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

  it('⭐ every turn carries the FULL analysis verdict, as sent (absence audit rows 5–7 cannot fire)', async () => {
    for (const turn of [real.card_turn, real.approval_turn, real.value_change_card_turn]) {
      const parsed = await parse(turn)
      expect(parsed.kind).toBe('response')
      if (parsed.kind !== 'response') return
      const state = (parsed.response as unknown as { analysis_state?: unknown }).analysis_state ?? sidecar(parsed.response)?.analysis_state
      expect(state).toEqual(turn.analysis_state)
    }
  })

  it('⭐ a card is bound to the turn that issued it, so it reattaches to its reply on reopen', async () => {
    const parsed = await parse(real.card_turn)
    const held = parsed.kind === 'response' ? readProposalFields(sidecar(parsed.response)._proposal_fields)?.proposals : undefined
    expect(held?.map((p) => p.issued_turn_id)).toEqual([real.card_turn.turn_id])
  })

  it('⭐ a value-change card proposes its figure on the canvas: 0.6 hours, the person\'s', async () => {
    const parsed = await parse(real.value_change_card_turn)
    const held = parsed.kind === 'response' ? readProposalFields(sidecar(parsed.response)._proposal_fields)?.proposals ?? [] : []
    expect(held.map((p) => previewFromFields(p)?.ops)).toEqual([[{ op: 'set_factor_value', nodeId: 'f', value: 0.6, unit: 'hours', source: 'yours' }]])
  })
})
