/**
 * SPIKE: the shim's reply (captured to a file by scripts/spike/run.sh) read by DGAI's own readers, unmodified.
 * Skipped when no capture exists.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { parseCoreTurn, coreTurnToClientBody } from '../../v5/coreTurnContract'
import { readProposalFields, cardCannotBeShownInFull, changeIsOlumis } from '../../canvas/conversation/proposalFields'

const FILE = process.env.SPIKE_TURN_FILE ?? '/private/tmp/spike-core-data/turn1.json'
describe.skipIf(!existsSync(FILE))('olumi-core shim -> DGAI core-turn contract', () => {
  it('parses as a CoreTurn and reads as a reading card', () => {
    const turn = parseCoreTurn(JSON.parse(readFileSync(FILE, 'utf8')))
    expect(turn).not.toBeNull()
    const body = coreTurnToClientBody(turn!)
    const fields = readProposalFields((body as { _proposal_fields?: unknown })._proposal_fields)
    expect(fields).not.toBeNull()
    const card = fields!.proposals[0]!
    const groups: Record<string, number> = {}
    for (const c of card.changes ?? []) groups[c.group ?? 'none'] = (groups[c.group ?? 'none'] ?? 0) + 1
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ reading: card.reading, rows: card.changes?.length, unread: card.changesUnread, groups,
      olumis: (card.changes ?? []).filter(changeIsOlumis).length, cannotShow: cardCannotBeShownInFull(card, true),
      families: [...new Set((card.changes ?? []).map((c) => c.family))] }))
    expect(card.reading).toBe(true)
    expect(card.changesUnread).toBe(false)
    expect(cardCannotBeShownInFull(card, true)).toBe(false)
  })
})
