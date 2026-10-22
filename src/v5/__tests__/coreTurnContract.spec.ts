/**
 * The core route's fixed answer (contract v1.2): parsed by its own schema, and handed on as the client body built from
 * its data alone. A hand-written contract sample until the route serves one (DL 22 Oct).
 */
import { describe, expect, it } from 'vitest'
import { parseV5Response, ADDITIVE_EXTENSIONS_KEY } from '../responseParser'
import { readProposalFields } from '../../canvas/conversation/proposalFields'
import { readRecordedServerTurnId } from '../../canvas/conversation/serverTurnId'
import { readAgentTurnReceipts, agentTurnUndoLabel } from '../../canvas/undo/captureAgentTurnForUndo'
import served from './fixtures/core-turn-run-served.json'

const TURN = 'b0106a96-f123-4920-9f08-542eaaeadab3'
const card = {
  proposal_id: 'prop_18b096b8dd6a719793bf357d9f1cc621', revision: '45929695-1d9c-4f00-b0f0-a38716f531e4',
  digest: 'd3da0062cd8d9d149e228bfd137a5709', issued_turn_id: TURN,
  approve_action: { id: 'agent-approve-proposal:prop_18b096b8dd6a719793bf357d9f1cc621', label: 'Make this change', message: 'Yes, make that change.' },
  decline_action: { id: 'agent-decline-proposal:prop_18b096b8dd6a719793bf357d9f1cc621', label: 'Not now', message: 'Not now.' },
  adds: [], missing: [],
  fields: [{ field_id: 'factor_value:coffee_volume', kind: 'factor_value', node_id: 'coffee_volume', label: 'Daily coffees sold',
    unit: 'coffees a day', current: { value: 280, unit: 'coffees a day', source: 'yours' }, filled_missing: false, editable: false }],
}
const contract = (over: Record<string, unknown> = {}) => ({
  turn_id: TURN, durability: 'recorded',
  assistant_text: 'Prepared one proposal for your approval.',
  model: {
    revision: '48e2a1babc59ccfd', scenario_revision: 'c57ba8f34f877fa3bcce4de5c6f40c527f8578e821e04b0b9f4237baf2184d9f',
    graph: {
      nodes: [
        { id: 'coffee_volume', kind: 'factor', label: 'Daily coffees sold', ref: 'F2' },
        { id: 'second_barista', kind: 'option', label: 'Add a peak barista', ref: 'O2' },
        { id: 'decision', kind: 'decision', label: 'Daily coffee revenue', ref: 'D' },
      ],
      edges: [{ from: 'second_barista', to: 'coffee_volume', effect_direction: 'positive', exists_probability: 1, provenance: 'user', strength: { mean: 0.5, std: 0.1 } }],
      living_model: { factors: [] },
    },
  },
  cards: [card],
  notes: [{ element_id: 'second_barista', text: 'Would the extra barista still pay after wages?' }],
  run: null,
  receipts: [{ version: 3, version_id: 'v3', mutation_id: 'm3', authorised_by: 'person' }],
  paused: null,
  error: null,
  ...over,
})
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('core route: the client reads only the contract', () => {
  it('⭐ the reply, its card with approve / change / decline, its note, its receipts and its turn, as CEE sent them', async () => {
    const parsed = await parseV5Response(response(contract()), { coreRoute: true })
    expect(parsed.kind).toBe('response')
    if (parsed.kind !== 'response') return
    const r = parsed.response
    expect(r.assistant_text).toBe('Prepared one proposal for your approval.')
    expect(r.suggested_actions.map((a) => a.id)).toEqual([card.approve_action.id, 'agent-amend-proposal', card.decline_action.id])
    expect(readProposalFields((r as unknown as Record<string, Record<string, unknown>>)[ADDITIVE_EXTENSIONS_KEY]._proposal_fields)?.proposals
      .map((p) => p.proposal_id)).toEqual([card.proposal_id])
    expect(r.blocks).toEqual([{ type: 'ui_directive', verb: 'highlight', note: 'Would the extra barista still pay after wages?',
      source: 'composer', targets: [{ id: 'second_barista', label: 'Add a peak barista', kind: 'option' }] }])
    expect(readRecordedServerTurnId(r)).toBe(TURN)
    expect(readAgentTurnReceipts(r)).toEqual([{ version: 3, versionId: 'v3', mutationId: 'm3' }])
    expect((r.draft_graph?.nodes as Array<{ id: string }> | undefined)?.map((n) => n.id)).toEqual(['coffee_volume', 'second_barista', 'decision'])
    expect((r as unknown as { graph_hash?: unknown }).graph_hash ?? (r as unknown as Record<string, Record<string, unknown>>)[ADDITIVE_EXTENSIONS_KEY]?.graph_hash)
      .toBe('48e2a1babc59ccfd')
  })

  it('⭐ a Run turn: the Run\'s own result block and the full verdict, as CEE sent them (served values)', async () => {
    const parsed = await parseV5Response(response(contract({ cards: [], notes: [],
      analysis_result: served.analysis_result, analysis_state: served.analysis_state })), { coreRoute: true })
    expect(parsed.kind).toBe('response')
    if (parsed.kind !== 'response') return
    const block = parsed.response.blocks.find((b) => b.type === 'analysis_result') as Record<string, unknown> | undefined
    expect(block?.computed_against_hash).toBe(served.analysis_result.computed_against_hash)
    expect(block?.enrichment).toEqual(served.analysis_result.enrichment)
    const state = (parsed.response as unknown as { analysis_state?: unknown }).analysis_state
      ?? (parsed.response as unknown as Record<string, Record<string, unknown>>)[ADDITIVE_EXTENSIONS_KEY]?.analysis_state
    expect(state).toEqual(served.analysis_state)
  })

  it('⭐ who authorised the write names the undo: the person\'s approval is theirs; a drafted model is Olumi\'s', async () => {
    const label = async (by: 'person' | 'olumi') => {
      const parsed = await parseV5Response(response(contract({ receipts: [{ version: 3, version_id: 'v3', mutation_id: 'm3', authorised_by: by }] })), { coreRoute: true })
      return parsed.kind === 'response' ? agentTurnUndoLabel(parsed.response) : null
    }
    expect(await label('person')).not.toBe(await label('olumi'))
  })

  it.todo('UNVERIFIED until a real core-route body is read: do the saved model\'s goal constraints ride on model.graph, so a first draft keeps them (applyDraftResult.ts:586)?')

  it('a note on anything but a card (unknown id, the question itself) is not drawn; no cards, no chips', async () => {
    const parsed = await parseV5Response(response(contract({ cards: [],
      notes: [{ element_id: 'nope', text: 'x' }, { element_id: 'decision', text: 'y' }] })), { coreRoute: true })
    expect(parsed.kind === 'response' && { blocks: parsed.response.blocks, chips: parsed.response.suggested_actions })
      .toEqual({ blocks: [], chips: [] })
  })

  it('⛔ a body that is not the contract is a schema mismatch, never read as a legacy answer', async () => {
    const legacy = { response_version: 2, assistant_text: 'hi', blocks: [], suggested_actions: [], insights: [], stage_indicator: 'frame' }
    const parsed = await parseV5Response(response(legacy), { coreRoute: true })
    expect(parsed.kind === 'parse_error' && parsed.parse_failure_kind).toBe('schema_mismatch')
  })

  it('a failed turn reaches today\'s failure path with its own code, retry and nothing-saved flags', async () => {
    const parsed = await parseV5Response(response(contract({ model: null, cards: [], notes: [], receipts: [],
      error: { code: 'UPSTREAM_ERROR', message: 'Tool not found', retry_safe: true, nothing_saved: true } }), 502), { coreRoute: true })
    expect(parsed.kind === 'parse_error' && parsed.raw).toEqual({ error: 'UPSTREAM_ERROR', detail: 'Tool not found', retry_safe: true, nothing_saved: true })
  })

  it('CONTRAST: without the core-route mode the parser is unchanged (a legacy body still reads)', async () => {
    const legacy = { response_version: 2, assistant_text: 'hi', blocks: [], suggested_actions: [], insights: [], stage_indicator: 'frame' }
    const parsed = await parseV5Response(response(legacy))
    expect(parsed.kind === 'response' && parsed.response.assistant_text).toBe('hi')
  })
})
