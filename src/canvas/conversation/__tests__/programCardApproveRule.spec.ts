/**
 * ⛔ ONE RULE FOR EVERY APPROVE (lease U-W1 (d)): "this approve would apply more than its card shows" is decided once, in
 * `proposalFields.ts` (`cardCannotBeShownInFull`), and read by the chat card, its panel, the canvas ghost and the send
 * boundary (`useConversation`'s `approvesUnreadChanges`). These rows read it directly, on served bodies through the
 * production parser:
 *   (a) a PRESENT `changes` that is not a list is unreadable, on any board;
 *   (b) on a program board, an approve whose card is missing from the held set or fails the held-card schema;
 *   (c) on a program board, a card with no `changes[]` (CEE lists every change on every program card, `holdProgramCard`);
 *   (d) the canvas ghost of an unreadable card offers no Approve of its own: it sends the person to the card.
 * The board is the surfaces' to read (they disable such an approve), never the send boundary's (Codex r1 on #2996, DL): a
 * card the boundary cannot find may be one a surface armed from its own reloaded fields. The boundary refuses only a card
 * it finds, in the newest reply that lists it, that cannot be shown in full.
 */
import { describe, expect, it } from 'vitest'

import { approvesUnreadChanges, cardCannotBeShownInFull, readProposalFields, readTurnProposalFields } from '../proposalFields'
import { previewFromFields } from '../proposalPreview'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { parseV5Response } from '../../../v5/responseParser'
import type { ConversationMessage } from '../types'
import repairTurn from './fixtures/served-card-european-repair-20261025.json'
import capacityTurn from './fixtures/served-card-capacity-leftout-20261025.json'
import readingTurn from './fixtures/served-card-european-reading-20261025.json'
import reviewTurn from './fixtures/served-card-qualitative-review-20261025.json'

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

describe('(b) + (c) on a program board the rule refuses what the card cannot show; the board is the surfaces’ to read', () => {
  it('(b) no readable card (fails the held-card schema, or missing from the held set) and (c) no `changes[]`: refused on a program board', async () => {
    const malformed = readProposalFields((await replyOf(mutated((c) => { c.digest = 'not-a-digest' }))).proposalFields)?.proposals.find((p) => p.approve_action.id === APPROVE)
    const noList = await heldOf(mutated((c) => { delete c.changes }))
    expect(malformed).toBeUndefined()
    expect(cardCannotBeShownInFull(malformed, true)).toBe(true)
    expect(cardCannotBeShownInFull(noList, true)).toBe(true)
    // CONTRAST: the same on a board that is not a program board, and a readable served card on a program board.
    expect(cardCannotBeShownInFull(malformed, false)).toBe(false)
    expect(cardCannotBeShownInFull(noList, false)).toBe(false)
    expect(cardCannotBeShownInFull(await heldOf(repairTurn.body), true)).toBe(false)
  })

  it('🔴 the send boundary never refuses a card it cannot find, whatever it is told of the board (Codex r1 on #2996)', async () => {
    // A surface may have armed this approve from its own reloaded fields, which the conversation never holds.
    const elsewhere = { ...(await replyOf(repairTurn.body)), proposalFields: (await replyOf(capacityTurn.body)).proposalFields }
    const boundary = approvesUnreadChanges as (m: readonly ConversationMessage[], chipId: string, opts?: unknown) => boolean
    for (const opts of [undefined, { program: false }, { program: true }]) expect(boundary([elsewhere], APPROVE, opts)).toBe(false)
  })
})

describe('🔴 the newest reply that lists the proposal decides (Codex r1 on #2996)', () => {
  it('an older readable card and a newer reply listing the same proposal malformed: the approve is refused', async () => {
    const older = { ...(await replyOf(repairTurn.body)), id: 'reply-older' }
    const newer = { ...(await replyOf(mutated((c) => { c.digest = 'not-a-digest' }))), id: 'reply-newer' }
    expect(approvesUnreadChanges([older, newer], APPROVE)).toBe(true)
  })

  it('CONTRAST: a newer reply that does not list the proposal leaves the older readable card in charge: the approve goes out', async () => {
    const older = { ...(await replyOf(repairTurn.body)), id: 'reply-older' }
    const newer = { ...(await replyOf(capacityTurn.body)), id: 'reply-newer' }
    expect(approvesUnreadChanges([older, newer], APPROVE)).toBe(false)
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

describe('the ghost is not asked about the board: CEE’s program cards draw no ghost (premise, DL ruling 3)', () => {
  it('each of the four served program cards yields no ghost', async () => {
    for (const body of [readingTurn.body, repairTurn.body, reviewTurn.body, capacityTurn.body]) {
      const held = await heldOf(body)
      expect(held?.proposal_id).toBe(body.cards[0].proposal_id)
      expect(previewFromFields(held!)).toBeNull()
    }
  })
})
