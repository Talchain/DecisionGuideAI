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
