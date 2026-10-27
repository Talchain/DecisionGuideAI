/**
 * The core route's fixed answer (contract v1.2): parsed by its own schema, and handed on as the client body built from
 * its data alone. A hand-written contract sample until the route serves one (DL 22 Oct).
 */
import { describe, expect, it } from 'vitest'
import { parseV5Response, ADDITIVE_EXTENSIONS_KEY, type V5ParseResult } from '../responseParser'
import { readCoreTurn } from '../applyCoreTurn'
import { parseCoreTurn, coreTurnToClientBody, coreTurnErrorBody } from '../coreTurnContract'
import { readProposalFields, readTurnProposalFields } from '../../canvas/conversation/proposalFields'
import { readRecordedServerTurnId } from '../../canvas/conversation/serverTurnId'
import { readAgentTurnReceipts, agentTurnUndoLabel } from '../../canvas/undo/captureAgentTurnForUndo'
import { extractOpenQuestionListSidecar } from '../../canvas/conversation/serverOpenQuestions'
import { extractProvisionalViewSidecar } from '../../canvas/conversation/provisionalView'
import { readAfterWriteExpectation } from '../../canvas/conversation/readAfterWrite'
import { readActionBar } from '../../canvas/conversation/actionBar/actionBarContract'
import served from './fixtures/core-turn-run-served.json'
import real from './fixtures/core-turn-r2-real.json'
import servedChatEdit from './fixtures/core-turn-served-chat-edit.json'
import r2Errors from './fixtures/core-turn-r2-errors.json'
import clientBodyCapture from './fixtures/core-freshness-5e28e10f-edit.json'
import step0 from './fixtures/core-turn-step0-cee-8114c0bf.json'

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
    // U4 p2: the note is the core applier's (`applyCoreTurn.ts`), read from the contract; no legacy highlight block.
    expect(r.blocks).toEqual([])
    expect(readCoreTurn(r)?.notes).toEqual([{ element_id: 'second_barista', text: 'Would the extra barista still pay after wages?' }])
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

/**
 * ⭐ The core contract is a core turn's ONLY check (DL, 25 Oct). The parse used to hand the answer on to the legacy
 * steps, so `OlumiResponseSchema`'s 140-character `ui_directive.note` cap refused a valid reply (a 189-character goal
 * note from CEE: HTTP 200, "Sent — reply not received"). Every core-route body the tests and step 0 have is read here;
 * each reader of the answer and of its side channels (`_agent`, `_read_after_write`, `_proposal_fields`, `action_bar`)
 * gets what the legacy parse of the same answer gave it, wherever that parse accepted the answer.
 */
describe('⭐ a core turn is read by the core contract alone', () => {
  const CORE_BAR = { v: 1, state_key: '0123456789abcdef', revision: { graph_hash: 'fedcba9876543210', run_key: null }, priority: [],
    standard: [{ action_id: 'pre_mortem', label: 'Pre-mortem', icon: 'SearchX', group: 'method', press_id: 'agent-next-pre-mortem',
      user_line: 'Run a pre-mortem on this model.', enabled: true, why_now: 'Imagine this went badly and work back to why.', offer_key: 'aaaabbbbccccdddd' }], more: [] }
  const SAVED = 'c57ba8f34f877fa3bcce4de5c6f40c527f8578e821e04b0b9f4237baf2184d9f'
  const readBack = (run: unknown) => ({ turn_id: 't', assistant_text: 'ok', cards: [], notes: [], receipts: [], error: null, run,
    model: { revision: '48e2a1babc59ccfd', scenario_revision: SAVED, graph: { nodes: [], edges: [] } } })
  const LONG_NOTE = 'Would the extra barista still pay after wages, holiday cover and training, once the morning queue settles and the weekend trade is counted apart from the weekday rush at both of the shops?'
  const parse = (body: unknown, status = 200) => parseV5Response(response(body, status), { coreRoute: true })
  /** The same answer through the legacy schema (`coreTurnToClientBody`, then `OlumiResponseSchema`). U4 p2: the translator
   *  no longer sends `stage_indicator`, which only the legacy schema requires, so it is added back here for that schema. */
  const legacyParse = (body: unknown) =>
    parseV5Response(response({ stage_indicator: 'frame', ...coreTurnToClientBody(parseCoreTurn(body)!) }))
  /** The sidecar the legacy readers see: everything but the core turn itself, which only the core applier reads (U4). */
  const sidecarOf = (r: unknown) => {
    const { _core_turn: _turn, ...rest } = { ...(r as Record<string, Record<string, unknown>>)[ADDITIVE_EXTENSIONS_KEY] }
    return rest
  }
  /** What each reader takes from a turn: the answer's own fields, its sidecar, and every side-channel reader's result. */
  const seen = (p: V5ParseResult) => p.kind !== 'response' ? p : {
    answer: { ...p.response }, sidecar: sidecarOf(p.response),
    readers: {
      turnId: readRecordedServerTurnId(p.response), receipts: readAgentTurnReceipts(p.response), undo: agentTurnUndoLabel(p.response),
      openQuestions: extractOpenQuestionListSidecar(p.response), provisionalView: extractProvisionalViewSidecar(p.response),
      readAfterWrite: readAfterWriteExpectation(p.response), proposals: readProposalFields(readTurnProposalFields(p.response)),
      actionBar: readActionBar(p.response),
    },
  }
  const short: Array<[string, unknown]> = [
    ['the hand contract', contract()],
    ['the hand contract, a Run', contract({ cards: [], notes: [], analysis_result: served.analysis_result, analysis_state: served.analysis_state })],
    ['the hand contract, an Olumi write', contract({ receipts: [{ version: 3, version_id: 'v3', mutation_id: 'm3', authorised_by: 'olumi' }] })],
    ['the hand contract, notes on no card', contract({ cards: [], notes: [{ element_id: 'nope', text: 'x' }, { element_id: 'decision', text: 'y' }] })],
    ['R2 card turn', real.card_turn], ['R2 approval turn', real.approval_turn], ['R2 value-change card turn', real.value_change_card_turn],
    ['served chat edit', servedChatEdit.chat_edit_turn],
    ['served chat edit with its action bar', { ...servedChatEdit.chat_edit_turn, action_bar: CORE_BAR }],
    ['served chat edit, action_bar null', { ...servedChatEdit.chat_edit_turn, action_bar: null }],
    ['a saved model to read back', readBack(null)],
    ['a saved model and its Run to read back', readBack({ run_key: '07b381d77a4ad439', run_id: 'c253bb65588667a6213a562667f5ae728532b1a966adfa298cbf222d4673bb63', computed_against: '48e2a1babc59ccfd', state: { kind: 'complete_current' } })],
    ['step 0: CEE draft', step0.draft_short], ['step 0: CEE draft, long question', step0.draft_long],
    ['step 0: CEE approval, short goal note', step0.approve_short],
  ]
  it.each(short)('%s: read, and every reader gets what the legacy parse gave it', async (_name, body) => {
    const [now, before] = [await parse(body), await legacyParse(body)]
    expect([now.kind, before.kind]).toEqual(['response', 'response'])
    const { answer: { stage_indicator: _legacyStage, ...beforeAnswer }, sidecar: { __original_top_level_keys__: beforeKeys, ...beforeSidecar }, ...beforeRest } = seen(before) as Record<string, Record<string, unknown>>
    const { sidecar: { __original_top_level_keys__: nowKeys, ...nowSidecar }, ...nowRest } = seen(now) as Record<string, Record<string, unknown>>
    expect({ ...nowRest, sidecar: nowSidecar }).toEqual({ ...beforeRest, answer: beforeAnswer, sidecar: beforeSidecar })
    expect((beforeKeys as unknown as string[]).filter((k) => k !== 'stage_indicator')).toEqual(nowKeys)
    // U4 p2: no legacy highlight block and no action bar from a core turn.
    expect(now.kind === 'response' && now.response.blocks.filter((b) => b.type === 'ui_directive')).toEqual([])
    expect(now.kind === 'response' && readActionBar(now.response)).toBeNull()
    // U4: the core applier reads the contract itself, kept whole beside the answer.
    expect(now.kind === 'response' && readCoreTurn(now.response)).toEqual(parseCoreTurn(body))
  })

  const long: Array<[string, Record<string, unknown>, string]> = [
    ['step 0: CEE approval, a goal note past 140 characters', step0.approve_long, step0.approve_long.notes[0].text],
    ['the hand contract, a 188-character note', contract({ notes: [{ element_id: 'second_barista', text: LONG_NOTE }] }), LONG_NOTE],
  ]
  it.each(long)('⭐ %s: the reply is read, its note whole, its side channels attached', async (_name, body, note) => {
    expect(note.length).toBeGreaterThan(140)
    const before = await legacyParse(body)
    // U4 p2: the note never enters a legacy highlight block (whose schema capped it at 140), so even the legacy schema
    // now reads the answer; before U4 p2 this was a schema_mismatch.
    expect(before.kind).toBe('response')
    const now = await parse(body)
    expect(now.kind).toBe('response')
    if (now.kind !== 'response') return
    expect(now.response.assistant_text).toBe(body.assistant_text)
    expect(readCoreTurn(now.response)?.notes.map((n) => n.text)).toEqual([note])
    const built = coreTurnToClientBody(parseCoreTurn(body)!)
    const channels = ['_agent', '_read_after_write', '_proposal_fields'].filter((k) => k in built)
    expect(sidecarOf(now.response)).toEqual({ ...Object.fromEntries(channels.map((k) => [k, built[k]])),
      __original_top_level_keys__: Object.keys(built).sort() })
    expect(readCoreTurn(now.response)).toEqual(parseCoreTurn(body))
    expect(readRecordedServerTurnId(now.response)).toBe(body.turn_id)
    expect(readAfterWriteExpectation(now.response)?.scenarioRevision).toBe((body.model as { scenario_revision: string }).scenario_revision)
  })

  it('⛔ a body that is not the core contract is still a schema mismatch (a legacy answer, a client body, nothing, an empty note)', async () => {
    const legacy = { response_version: 2, assistant_text: 'hi', blocks: [], suggested_actions: [], insights: [], stage_indicator: 'frame' }
    for (const body of [legacy, clientBodyCapture, {}, contract({ notes: [{ element_id: 'second_barista', text: '' }] })]) {
      const parsed = await parse(body)
      expect(parsed.kind === 'parse_error' && parsed.parse_failure_kind).toBe('schema_mismatch')
    }
  })

  it('a failed core turn still reaches today\'s failure path with its own flags, whatever its status', async () => {
    const timeout = r2Errors.stream_timeout_complete_frame
    for (const [body, status] of [[timeout.payload, timeout.status_code], [r2Errors.resend_after_claim_wait.body, r2Errors.resend_after_claim_wait.status], [r2Errors.resend_after_claim_wait.body, 200]] as const) {
      const parsed = await parse(body, status)
      const { code, message, retry_safe, nothing_saved } = body.error
      expect(parsed.kind === 'parse_error' && [parsed.parse_failure_kind, parsed.raw])
        .toEqual([status === 200 ? 'schema_mismatch' : 'non_ok_non_boundary', { error: code, detail: message, retry_safe, nothing_saved }])
    }
  })
})

describe('C8 (PL AMEND on #3037): a failed or stopped turn reads its receipts with the one save predicate', () => {
  const error = { code: 'TURN_STOPPED', message: 'You stopped this turn.', retry_safe: false, nothing_saved: false }
  const unversioned = { kind: 'unversioned', scenario_revision: 'a'.repeat(64), run_id: null, source_turn_id: 'turn-1', authorised_by: 'person' as const }
  const versioned = { version: 6, version_id: 'v_6', mutation_id: 'm_6', authorised_by: 'person' as const }

  it('a guest\'s well-formed versionless receipt is a save; CONTRAST: a version is one too', () => {
    expect(coreTurnErrorBody(error, [unversioned])).toMatchObject({ save_outcome: 'VERIFIED_SAVED', receipts: [unversioned] })
    expect(coreTurnErrorBody(error, [versioned])).toMatchObject({ save_outcome: 'VERIFIED_SAVED' })
  })

  it('⛔ a malformed receipt (a short identity, or a versionless one carrying version keys) proves no save, so the outcome stays unknown', () => {
    expect(coreTurnErrorBody(error, [{ ...unversioned, scenario_revision: 'fd14fb8b' }])).not.toHaveProperty('save_outcome')
    expect(coreTurnErrorBody(error, [{ ...unversioned, ...versioned }])).not.toHaveProperty('save_outcome')
    expect(coreTurnErrorBody(error, [unversioned, { ...unversioned, run_id: 'run-2' }])).not.toHaveProperty('save_outcome')
    expect(coreTurnErrorBody(error, [])).not.toHaveProperty('save_outcome')
  })
})
