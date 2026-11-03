/**
 * ⭐ GHOST PROPOSALS ON CORE (DL GO, 21 Oct 2026). Core sends no `proposal_preview`, so its held change was never drawn on
 * the canvas. The held card's own `_proposal_fields` name the factor or link it changes: the canvas now ghosts that value
 * or strength on the existing card, labelled Olumi's. An add-item or add-link proposal carries no fields yet (served
 * capacity turn, UI 562ac9be / CEE ebc61205: `fields: []`), so it keeps the dock card alone, with no guessed placement.
 * The fixtures are served turns (S-D slice 2): two factor values, two link strengths, two unsized links.
 */
import { describe, expect, it } from 'vitest'
import factorTurn from './fixtures/sd-s2-a1-proposing-turn.json'
import linkTurn from './fixtures/sd-s2-a6-proposing-turn.json'
import placeholderTurn from './fixtures/served-held-proposal-sdwire4.json'
import { consentChipIdFor, previewOfLatestReply } from '../proposalPreview'
import { reconcileRestoredProposalFields } from '../serverConversationTurns'
import { proposalGhostGeometry } from '../../utils/proposalGhostGeometry'
import { ghostBandText, ghostCardDetail, ghostValueText } from '../../nodes/ProposalGhostLayer'
import type { ConversationMessage } from '../types'

type Json = Record<string, unknown>
const fieldsOf = (turn: Json): Json => (turn._proposal_fields ?? (turn.__additive__ as Json | undefined)?._proposal_fields) as Json
const idsOf = (turn: Json): string[] => (fieldsOf(turn).proposals as Json[]).map((p) => String(p.proposal_id))
/** A core reply: the served projection, its approve chips, and no `proposal_preview`. */
const coreReply = (turn: Json, over: Partial<ConversationMessage> = {}): ConversationMessage => ({
  id: 'r1', role: 'assistant', content: 'reply', timestamp: new Date(), proposalFields: fieldsOf(turn),
  actionChips: idsOf(turn).map((id) => ({ id: consentChipIdFor(id), label: 'Make this change', intent: 'primary' as const, message: 'Yes, make that change.' })),
  ...over,
}) as ConversationMessage

describe('core: the held card\'s fields become its ghost', () => {
  it('⭐ a factor value: each factor the card sets, its figure, unit and whose it is', () => {
    expect(previewOfLatestReply([coreReply(factorTurn as Json)])).toEqual({
      proposalId: 'prop_b7542aa96cc5a4133732832615003b7f',
      ops: [
        { op: 'set_factor_value', nodeId: 'fac_cost', value: 200, unit: 'GBP', source: 'estimate' },
        { op: 'set_factor_value', nodeId: 'fac_hours', value: 10, unit: 'hours', source: 'estimate' },
      ],
    })
  })

  it('⭐ a link strength: on the existing link, in the canvas band words', () => {
    const preview = previewOfLatestReply([coreReply(linkTurn as Json)])
    expect(preview?.ops).toEqual([
      { op: 'set_link_strength', fromId: 'fac_hours', toId: 'goal_x', band: 'moderate', keeps: false, source: 'estimate' },
      { op: 'set_link_strength', fromId: 'fac_cost', toId: 'goal_x', band: 'moderate', keeps: false, source: 'estimate' },
    ])
  })

  it('⛔ Codex R1 (1): whose strength it is survives to the mark: the person\'s own is never said as Olumi\'s estimate', () => {
    const turn = structuredClone(linkTurn) as Json
    const field = ((fieldsOf(turn).proposals as Json[])[0].fields as Json[])[0]
    field.current = { ...(field.current as Json), source: 'yours' }
    const op = previewOfLatestReply([coreReply(turn)])!.ops[0] as Parameters<typeof ghostBandText>[0]
    expect(ghostBandText(op)).toBe('Olumi proposes: moderate · from your message')
    expect(ghostBandText({ ...op, source: 'estimate' })).toBe('Olumi proposes: moderate')
  })

  it('⛔ Codex R1 (2): the figure is said in the held card\'s unit (`unit`), never `current.unit`', () => {
    const turn = structuredClone(factorTurn) as Json
    const field = ((fieldsOf(turn).proposals as Json[])[0].fields as Json[])[0]
    field.current = { ...(field.current as Json), unit: '' }
    const op = previewOfLatestReply([coreReply(turn)])!.ops[0]
    expect(op).toMatchObject({ op: 'set_factor_value', nodeId: 'fac_cost', unit: 'GBP' })
    expect(ghostValueText(op as Parameters<typeof ghostValueText>[0])).toBe('Olumi proposes: £200')
  })

  it('⛔ a link nobody has sized is never drawn as a size (no ghost for a placeholder band)', () => {
    expect(idsOf((placeholderTurn as Json).turn_T1 as Json)).toHaveLength(1)
    expect(previewOfLatestReply([coreReply((placeholderTurn as Json).turn_T1 as Json)])).toBeNull()
  })

  it('⛔ an add-item proposal (served: no fields) draws nothing: the dock card alone', () => {
    const turn = { _proposal_fields: { ...fieldsOf(factorTurn as Json), proposals: (fieldsOf(factorTurn as Json).proposals as Json[]).map((p) => ({ ...p, fields: [] })) } }
    expect(previewOfLatestReply([coreReply(turn)])).toBeNull()
  })

  it('⛔ only while the reply still offers that card\'s approve: settled or another card\'s chip → nothing', () => {
    expect(previewOfLatestReply([coreReply(factorTurn as Json, { actionChips: [] })])).toBeNull()
    expect(previewOfLatestReply([coreReply(factorTurn as Json, { actionChips: [{ id: consentChipIdFor('prop_00000000000000000000000000000000'), label: 'x', intent: 'primary', message: 'x' }] })])).toBeNull()
    // A later reply with no held card clears it.
    expect(previewOfLatestReply([coreReply(factorTurn as Json), { id: 'r2', role: 'assistant', content: 'next', timestamp: new Date() } as ConversationMessage])).toBeNull()
  })

  it('the legacy wire\'s own `proposal_preview` still wins when a turn carries one', () => {
    const legacy = { proposalId: idsOf(linkTurn as Json)[0], ops: [{ op: 'set_option_status' as const, optionId: 'o1', status: 'removed' as const }] }
    expect(previewOfLatestReply([coreReply(linkTurn as Json, { proposalPreview: legacy })])).toBe(legacy)
  })
})

/**
 * ⭐ THE GHOST SHOWS WHILE THE CARD SHOWS (served 21 Oct, UI 9a864d87: an add proposal, then a later reply, then a reopen:
 * the card came back on its issuing reply, the ghost did not). The latest reply's fields are CEE's current held set; the
 * card's approve sits on its issuing reply.
 */
describe('reopen: the ghost follows the held card back', () => {
  const restored = () => {
    const pf = structuredClone(fieldsOf(factorTurn as Json))
    ;(pf.proposals as Json[])[0] = { ...(pf.proposals as Json[])[0], issued_turn_id: 'T1' }
    const thread = [
      { id: 'restored-assistant-T1', role: 'assistant', content: 'prepared', timestamp: new Date() },
      { id: 'u2', role: 'user', content: 'Which link?', timestamp: new Date() },
      { id: 'restored-assistant-T2', role: 'assistant', content: 'this one', timestamp: new Date(), actionChips: [] },
      { id: 'div', role: 'assistant', content: '', timestamp: new Date(), sessionDivider: 'Session resumed' },
    ] as ConversationMessage[]
    return reconcileRestoredProposalFields(thread, pf)
  }
  it('⭐ real restore path: card on its issuing reply, a later reply after it → the ghost is drawn', () => {
    const thread = restored()
    expect(thread[0].actionChips?.some((c) => c.id === consentChipIdFor(idsOf(factorTurn as Json)[0]))).toBe(true)
    expect(previewOfLatestReply(thread)?.ops.map((o) => o.op)).toEqual(['set_factor_value', 'set_factor_value'])
  })
  it('⛔ CONTRAST: no longer in the current held set (approved or declined) → no ghost, even with an old approve chip', () => {
    const thread = restored()
    const settled = [...thread.slice(0, 2), { ...thread[2], proposalFields: { ...fieldsOf(factorTurn as Json), proposals: [] } }, thread[3]]
    expect(previewOfLatestReply(settled as ConversationMessage[])).toBeNull()
  })
  it('⛔ a synthetic notice after the reply is not a reply: it neither clears nor owns the ghost', () => {
    const thread = restored()
    const withNotice = [...thread, { id: 'n', role: 'assistant', content: 'Could not reach Olumi', timestamp: new Date(), synthetic: true }] as ConversationMessage[]
    expect(previewOfLatestReply(withNotice)?.proposalId).toBe(idsOf(factorTurn as Json)[0])
  })
})

describe('the value mark: beside the factor it changes, said as Olumi\'s proposal', () => {
  const nodes = [
    { id: 'fac_cost', position: { x: 0, y: 200 }, measured: { width: 280, height: 100 } },
    { id: 'goal_x', position: { x: 0, y: 500 }, measured: { width: 280, height: 90 } },
  ]
  it('sits just above the factor card, covering nothing; a factor not on the canvas draws nothing', () => {
    const preview = previewOfLatestReply([coreReply(factorTurn as Json)])!
    const g = proposalGhostGeometry(preview, nodes, { markSizes: new Map([['value:fac_cost', { w: 200, h: 24 }]]) })
    expect(g.values.map((v) => v.nodeId)).toEqual(['fac_cost'])
    const v = g.values[0]
    expect(v.x).toBe(140)
    expect(v.y + 12).toBeLessThanOrEqual(200)
  })
  it('words: "Olumi proposes", the figure as the held card says it, and whose figure it is', () => {
    expect(ghostValueText({ value: 10, unit: 'hours', source: 'estimate' })).toBe('Olumi proposes: 10 hours')
    expect(ghostValueText({ value: 5, unit: 'tickets per week', source: 'yours' })).toBe('Olumi proposes: 5 tickets per week · from your message')
    expect(ghostValueText({ value: 40, unit: '%', source: 'from_brief' })).toBe('Olumi proposes: 40% · from your brief')
    expect(ghostBandText({ band: 'moderate', keeps: false, reverses: false })).toBe('Olumi proposes: moderate')
  })
})

/**
 * ⭐ A core proposal's NEW factor or link (CEE `adds`, claude/proposal-fields-adds: the shape its own row pins). The new
 * factor is a ghost card beside the card its new link ties it to; the new link a ghost line saying which way it moves.
 */
describe('core adds: a new factor or link drawn where it would land', () => {
  const ADDS = [
    { field_id: 'factor_add:sickness', kind: 'factor_add', node_id: 'sickness', label: 'Capacity lost to sickness', value: { value: 5, unit: 'tickets' }, source: 'estimate', editable: false },
    { field_id: 'link_add:l_sick', kind: 'link_add', link_id: 'l_sick', from_id: 'sickness', to_id: 'fac_cost', from_label: 'Capacity lost to sickness',
      to_label: 'Cost', direction: 'negative', source: 'estimate', editable: false },
  ]
  const withAdds = (adds: unknown[]): Json => {
    const pf = structuredClone(fieldsOf(factorTurn as Json))
    ;(pf.proposals as Json[])[0] = { ...(pf.proposals as Json[])[0], fields: [], adds }
    return { _proposal_fields: pf }
  }
  it('⭐ adds become a ghost card and a ghost line, each saying whose it is', () => {
    expect(previewOfLatestReply([coreReply(withAdds(ADDS))])?.ops).toEqual([
      { op: 'add_node', id: 'sickness', label: 'Capacity lost to sickness', kind: 'factor', value: { value: 5, unit: 'tickets' }, source: 'estimate' },
      { op: 'add_edge', fromId: 'sickness', toId: 'fac_cost', band: null, direction: 'negative', source: 'estimate' },
    ])
  })
  it('⛔ an unknown add kind or a malformed add is dropped, never the card (a newer CEE never breaks this reader)', () => {
    const ops = previewOfLatestReply([coreReply(withAdds([{ kind: 'risk_add', field_id: 'risk_add:r' }, { ...ADDS[1], direction: 'sideways' }, ADDS[0]]))])?.ops
    expect(ops?.map((o) => o.op)).toEqual(['add_node'])
    // Codex R1: a malformed container is no adds, never a lost card (its editable fields survive).
    for (const bad of [null, {}, 'x']) {
      const turn = structuredClone(factorTurn) as Json
      ;((fieldsOf(turn).proposals as Json[])[0] as Json).adds = bad
      expect(previewOfLatestReply([coreReply(turn)])?.ops.map((o) => o.op)).toEqual(['set_factor_value', 'set_factor_value'])
    }
    // A card with no adds at all (every served card before CEE projects them) reads as before.
    expect(previewOfLatestReply([coreReply(factorTurn as Json)])?.ops.map((o) => o.op)).toEqual(['set_factor_value', 'set_factor_value'])
  })
  it('the card sits beside the card its new link ties it to, covering nothing; the line\'s mark says "lowers"', () => {
    const nodes = [{ id: 'fac_cost', position: { x: 0, y: 200 }, measured: { width: 280, height: 100 } }]
    const g = proposalGhostGeometry(previewOfLatestReply([coreReply(withAdds(ADDS))])!, nodes)
    expect(g.cards).toHaveLength(1)
    const c = g.cards[0]
    expect(c.x).toBeGreaterThanOrEqual(280)
    expect(g.lines.map((l) => l.key)).toEqual(['sickness->fac_cost'])
    expect(g.bands.map((b) => ghostBandText(b))).toEqual(['Olumi proposes: lowers'])
    expect(ghostCardDetail(c)).toBe('5 tickets')
  })
  it('⛔ Codex R1: the legacy wire is unchanged: its new card\'s sized link draws no band mark on the ghost line', () => {
    const nodes = [{ id: 'fac_cost', position: { x: 0, y: 200 }, measured: { width: 280, height: 100 } }]
    const g = proposalGhostGeometry({ proposalId: 'p', ops: [
      { op: 'add_node', id: 'n', label: 'New', kind: 'factor' }, { op: 'add_edge', fromId: 'n', toId: 'fac_cost', band: 'strong' },
    ] }, nodes)
    expect([g.cards.length, g.lines.length, g.bands.length]).toEqual([1, 1, 0])
  })
  it('words: a new link raises or lowers, the person\'s says so; a new factor\'s level and whose it is', () => {
    expect(ghostBandText({ band: null, keeps: false, reverses: false, direction: 'positive', source: 'yours' })).toBe('Olumi proposes: raises · from your message')
    expect(ghostCardDetail({ value: null, source: 'yours' })).toBe('from your message')
    expect(ghostCardDetail({ value: { value: 200, unit: 'GBP' }, source: 'yours' })).toBe('£200 · from your message')
    expect(ghostCardDetail({ value: null, source: 'estimate' })).toBeNull()
  })
})

describe('two held cards: the ghost is the card the person is looking at (served café, UI 4d237a73 / CEE 0ce7ae88, 22 Oct)', () => {
  // Banked `_proposal_fields` of the correction turn (evidence diag-2906-2908-CAFE), trimmed to what the ghost reads:
  // the Challenge's still-held card first (an edge from an option that exists only in its words), then the correction's.
  const challenge = { proposal_id: 'prop_454dc290adeb51ac0bdc62ee6ed8dca7', revision: '7724d235-8f8b-426a-a4df-883806be42fb',
    digest: '340352eaf5414fa2c0657881c6a0a958', issued_turn_id: '20f7b3d4-f488-4f15-bde3-b1e680875a25',
    approve_action: { id: 'agent-approve-proposal:prop_454dc290adeb51ac0bdc62ee6ed8dca7', label: 'Make this change', message: 'Yes, make that change.' },
    decline_action: { id: 'agent-decline-proposal:prop_454dc290adeb51ac0bdc62ee6ed8dca7', label: 'Not now', message: 'Not now.' },
    fields: [], missing: [],
    adds: [{ field_id: 'link_add:reallocate_volume', kind: 'link_add', link_id: 'reallocate_volume', from_id: 'reallocate_staff', to_id: 'coffee_volume',
      from_label: 'Reallocate existing staff to the morning peak', to_label: 'Daily coffees sold', direction: 'positive', source: 'estimate', editable: false }] }
  const correction = { proposal_id: 'prop_18b096b8dd6a719793bf357d9f1cc621', revision: '45929695-1d9c-4f00-b0f0-a38716f531e4',
    digest: 'd3da0062cd8d9d149e228bfd137a5709', issued_turn_id: 'b0106a96-f123-4920-9f08-542eaaeadab3',
    approve_action: { id: 'agent-approve-proposal:prop_18b096b8dd6a719793bf357d9f1cc621', label: 'Make this change', message: 'Yes, make that change.' },
    decline_action: { id: 'agent-decline-proposal:prop_18b096b8dd6a719793bf357d9f1cc621', label: 'Not now', message: 'Not now.' },
    adds: [], missing: [],
    fields: [{ field_id: 'factor_value:coffee_volume', kind: 'factor_value', node_id: 'coffee_volume', label: 'Daily coffees sold', unit: 'coffees a day',
      current: { value: 280, unit: 'coffees a day', source: 'yours' }, filled_missing: false, editable: false }] }
  const turn = (proposals: Json[]): Json => ({ _proposal_fields: { version: 1, graph_hash: '48e2a1babc59ccfd', proposals } })
  const CORRECTION_GHOST = { proposalId: correction.proposal_id,
    ops: [{ op: 'set_factor_value', nodeId: 'coffee_volume', value: 280, unit: 'coffees a day', source: 'yours' }] }

  it('⭐ the correction reply shows ITS card\'s ghost (280 coffees), not the older Challenge card listed first', () => {
    expect(previewOfLatestReply([coreReply(turn([challenge, correction]), { id: correction.issued_turn_id })])).toEqual(CORRECTION_GHOST)
  })
  it('a reply that issued neither (a reopen, a plain answer): the newest held card', () => {
    expect(previewOfLatestReply([coreReply(turn([challenge, correction]), { id: 'r-later' })])).toEqual(CORRECTION_GHOST)
    expect(previewOfLatestReply([coreReply(turn([challenge, correction]), { id: `restored-assistant-${correction.issued_turn_id}` })]))
      .toEqual(CORRECTION_GHOST)
  })
  it('CONTRAST: the card this reply issued wins even when it is the older one; one held card is as before', () => {
    expect(previewOfLatestReply([coreReply(turn([challenge, correction]), { id: challenge.issued_turn_id })])?.proposalId).toBe(challenge.proposal_id)
    expect(previewOfLatestReply([coreReply(turn([challenge]), { id: 'r-later' })])?.proposalId).toBe(challenge.proposal_id)
  })
})
