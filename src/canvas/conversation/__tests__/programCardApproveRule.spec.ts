/**
 * ⛔ ONE RULE FOR EVERY APPROVE (lease U-W1 (d)): "this approve would apply more than its card shows" is decided once, in
 * `proposalFields.ts`, and read by the chat card, its panel, the canvas ghost and the send boundary (`useConversation`'s
 * `approvesUnreadChanges`). These rows read that rule directly, on served bodies through the production parser:
 *   (a) a PRESENT `changes` that is not a list is unreadable, on any board;
 *   (b) on a program board, an approve whose card is missing from the held set or fails the held-card schema;
 *   (c) on a program board, a card with no `changes[]` (CEE lists every change on every program card, `holdProgramCard`);
 *   (d) the canvas ghost of an unreadable card offers no Approve of its own: it sends the person to the card.
 * Each with its contrast: a readable card, and a board that is not a program board, keep today's behaviour.
 */
import { describe, expect, it } from 'vitest'

import { approvesUnreadChanges, readProposalFields, readTurnProposalFields } from '../proposalFields'
import { previewFromFields } from '../proposalPreview'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { parseV5Response } from '../../../v5/responseParser'
import type { ConversationMessage } from '../types'
import repairTurn from './fixtures/served-card-european-repair-20261025.json'
import capacityTurn from './fixtures/served-card-capacity-leftout-20261025.json'

type Json = Record<string, any>
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const APPROVE = repairTurn.body.cards[0].approve_action.id
const NOT_A_LIST: ReadonlyArray<readonly [string, unknown]> = [['an object', { 0: {} }], ['a string', 'changes'], ['a number', 3], ['null', null]]

/** The reply as the conversation stores it (`useConversation`: chips from `suggested_actions`, the card from the sidecar). */
async function replyOf(body: Json): Promise<ConversationMessage> {
  const parsed = await parseV5Response(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }), { coreRoute: true })
  if (parsed.kind !== 'response') throw new Error(`the served body did not parse: ${parsed.kind}`)
  return { id: 'reply-1', role: 'assistant', content: parsed.response.assistant_text, timestamp: new Date(0),
    actionChips: buildSuggestedActionChips(parsed.response.blocks, parsed.response.suggested_actions),
    proposalFields: readTurnProposalFields(parsed.response) }
}
const heldOf = async (body: Json) => readProposalFields((await replyOf(body)).proposalFields)?.proposals[0]
const mutated = (edit: (card: Json) => void): Json => {
  const body = clone(repairTurn.body) as Json
  edit(body.cards[0])
  return body
}

describe('🔴 (a) a present `changes` that is not a list is unreadable, on any board', () => {
  for (const [name, value] of NOT_A_LIST) {
    it(`\`changes\` as ${name}: the card reads as unreadable, nothing listed, and the send boundary refuses its approve`, async () => {
      const body = mutated((c) => { c.changes = value })
      const held = await heldOf(body)
      expect(held?.changesUnread).toBe(true)
      expect(held?.changes).toEqual([])
      expect(approvesUnreadChanges([await replyOf(body)], APPROVE)).toBe(true)
    })
  }

  it('CONTRAST: the served list, read in full, is readable and its approve goes out', async () => {
    const held = await heldOf(repairTurn.body)
    expect(held?.changesUnread).toBe(false)
    expect(held?.changes).toHaveLength(31)
    expect(approvesUnreadChanges([await replyOf(repairTurn.body)], APPROVE)).toBe(false)
  })
})

describe('🔴 (b) + (c) on a program board the same predicate refuses what the card cannot show', () => {
  it('(b) the card fails the held-card schema (malformed digest)', async () => {
    const reply = await replyOf(mutated((c) => { c.digest = 'not-a-digest' }))
    expect(approvesUnreadChanges([reply], APPROVE, { program: true })).toBe(true)
  })

  it('(b) the card is missing from every held set the conversation carries', async () => {
    const reply = { ...(await replyOf(repairTurn.body)), proposalFields: (await replyOf(capacityTurn.body)).proposalFields }
    expect(approvesUnreadChanges([reply], APPROVE, { program: true })).toBe(true)
  })

  it('(c) the card carries no `changes[]`', async () => {
    const reply = await replyOf(mutated((c) => { delete c.changes }))
    expect(approvesUnreadChanges([reply], APPROVE, { program: true })).toBe(true)
  })

  it('CONTRAST: a readable served card on a program board goes out', async () => {
    expect(approvesUnreadChanges([await replyOf(repairTurn.body)], APPROVE, { program: true })).toBe(false)
  })

  it('CONTRAST: on a board that is not a program board, (b) and (c) keep today’s behaviour (the approve goes out)', async () => {
    const malformed = await replyOf(mutated((c) => { c.digest = 'not-a-digest' }))
    const noList = await replyOf(mutated((c) => { delete c.changes }))
    expect(approvesUnreadChanges([malformed], APPROVE)).toBe(false)
    expect(approvesUnreadChanges([noList], APPROVE)).toBe(false)
    expect(approvesUnreadChanges([malformed], APPROVE, { program: false })).toBe(false)
    expect(approvesUnreadChanges([noList], APPROVE, { program: false })).toBe(false)
  })
})

describe('🔴 (d) the canvas ghost of an unreadable card sends the person to the card, never approves itself', () => {
  /** A figure the canvas draws (so the card has a ghost) and no change notes (so nothing else routes it to the card). */
  const FIELD = { field_id: 'factor_value:launch_delay', kind: 'factor_value', node_id: 'launch_delay', label: 'Months until pilot launch readiness',
    unit: 'month', current: { value: 3, unit: 'month', source: 'yours' }, filled_missing: false, editable: true }
  const drawable = (edit: (card: Json) => void) => mutated((c) => { c.fields = [FIELD]; c.adds = []; edit(c) })

  it('a `changes` that is not a list, and a list with an unreadable entry: the ghost has no Approve ("Review on the card")', async () => {
    for (const body of [drawable((c) => { c.changes = { 0: {} } }), drawable((c) => { c.changes = [c.changes[0], { ...c.changes[1], kind: 'mystery' }] })]) {
      const ghost = previewFromFields((await heldOf(body))!)
      expect(ghost?.ops.map((o) => o.op)).toEqual(['set_factor_value'])
      expect(ghost?.otherChanges).toBeDefined()
    }
  })

  it('CONTRAST: the same ghost with its list read in full keeps its Approve (no "+N")', async () => {
    const ghost = previewFromFields((await heldOf(drawable(() => {})))!)
    expect(ghost?.ops.map((o) => o.op)).toEqual(['set_factor_value'])
    expect(ghost?.otherChanges).toBeUndefined()
  })
})
