/**
 * COLLAB — the open-round record: NON-SECRET round metadata an owner can come
 * back to.
 *
 * ── WHAT THIS MODULE IS ALLOWED TO STORE, AND WHAT IT NEVER MAY ───────────
 * The round id, the scenario id, when it was opened, and each participant's
 * id + display name. NEVER a participant token: the token is a bearer
 * capability, shown once by design, and `PanelSetupPage`'s own header explains
 * why it must not sit in browser storage. The record is what lets an owner
 * CLOSE a round or open a replacement after navigating away — the round id is
 * not a credential (every owner route also demands the Supabase JWT).
 *
 * The token-exclusion test below is the load-bearing one: it feeds the module
 * the EXACT shape the mint response carries (token and all) and proves the
 * token never reaches storage — with a positive control proving the probe
 * could see it if it did.
 */
import { describe, it, expect, beforeEach } from 'vitest'

import { forgetOpenRound, recallOpenRound, rememberOpenRound } from '../openRoundRecord'

const SCENARIO_ID = 'scn-record-1234'
const OTHER_SCENARIO_ID = 'scn-other-5678'
const ROUND_ID = 'rnd-record-9012'

/** The distinctive secret used by the exclusion probe. */
const SECRET_TOKEN = 'tok-SECRET-must-never-be-stored-f00d'

/** The shape the mint response actually hands the caller — token included. */
const MINTED_PARTICIPANTS = [
  { participant_id: 'p-a', display_name: 'Ada', token: SECRET_TOKEN },
  { participant_id: 'p-b', display_name: 'Grace', token: 'tok-SECRET-second-cafe' },
]

function rememberFixture(): void {
  rememberOpenRound({
    roundId: ROUND_ID,
    scenarioId: SCENARIO_ID,
    participants: MINTED_PARTICIPANTS,
  })
}

/** Every value in the whole store, so the probe cannot miss a stray key. */
function wholeStore(): string {
  const parts: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key !== null) parts.push(key, localStorage.getItem(key) ?? '')
  }
  return parts.join('\n')
}

beforeEach(() => {
  localStorage.clear()
})

describe('openRoundRecord', () => {
  it('round-trips the non-secret fields for the scenario it was saved under', () => {
    rememberFixture()
    const record = recallOpenRound(SCENARIO_ID)
    expect(record).not.toBeNull()
    expect(record?.round_id).toBe(ROUND_ID)
    expect(record?.scenario_id).toBe(SCENARIO_ID)
    expect(record?.participants).toEqual([
      { participant_id: 'p-a', display_name: 'Ada' },
      { participant_id: 'p-b', display_name: 'Grace' },
    ])
    // opened_at is stamped by the module — an ISO string a Date can parse.
    expect(Number.isNaN(Date.parse(record?.opened_at ?? ''))).toBe(false)
  })

  it('DIFFERENT OBJECT: recall for another scenario id returns null, not this record', () => {
    rememberFixture()
    expect(recallOpenRound(OTHER_SCENARIO_ID)).toBeNull()
  })

  it('NEVER stores a participant token — proven against the whole store, with a positive control', () => {
    // POSITIVE CONTROL: the input really does carry the secret, so a probe
    // that cannot see it in the input could not prove its absence in storage.
    expect(JSON.stringify(MINTED_PARTICIPANTS)).toContain(SECRET_TOKEN)

    rememberFixture()

    const stored = wholeStore()
    expect(stored).not.toBe('') // something WAS written — absence is not vacuous
    expect(stored).not.toContain(SECRET_TOKEN)
    expect(stored).not.toContain('tok-SECRET-second-cafe')

    // And the recalled shape carries no token key at all.
    const record = recallOpenRound(SCENARIO_ID)
    for (const p of record?.participants ?? []) {
      expect(Object.keys(p).sort()).toEqual(['display_name', 'participant_id'])
    }
  })

  it('forget removes the record for that scenario only', () => {
    rememberFixture()
    rememberOpenRound({
      roundId: 'rnd-other-3456',
      scenarioId: OTHER_SCENARIO_ID,
      participants: [{ participant_id: 'p-c', display_name: 'Lin' }],
    })
    forgetOpenRound(SCENARIO_ID)
    expect(recallOpenRound(SCENARIO_ID)).toBeNull()
    // DIFFERENT OBJECT: the other scenario's record survives.
    expect(recallOpenRound(OTHER_SCENARIO_ID)?.round_id).toBe('rnd-other-3456')
  })

  it('a malformed stored value reads as null rather than throwing', () => {
    rememberFixture()
    // Corrupt the exact key the module wrote — derived from the write, so this
    // test cannot drift onto a key nothing reads.
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key !== null) keys.push(key)
    }
    expect(keys.length).toBe(1)
    localStorage.setItem(keys[0], '{not json')
    expect(recallOpenRound(SCENARIO_ID)).toBeNull()
  })

  it('an empty scenario id is a no-op in both directions', () => {
    rememberOpenRound({ roundId: ROUND_ID, scenarioId: '', participants: [] })
    expect(localStorage.length).toBe(0)
    expect(recallOpenRound('')).toBeNull()
  })
})
