/**
 * D1 — render-time participant-name resolution.
 *
 * The load-bearing test in this file is `never leaks an identifier where a name
 * belongs`, and it carries a POSITIVE CONTROL: an absence assertion that has
 * never been shown detecting a presence is an assertion that passes by testing
 * nothing. The control poisons a result with the very ids the real assertions
 * demand are absent, and requires the SAME detector to find them.
 */

import { describe, it, expect } from 'vitest'
import {
  readElicitedFrom,
  resolveParticipantName,
  type RosterEntry,
} from '../participantNames'

/** A uuid-shaped id, so a leak would look exactly like the real thing. */
const GRACE_ID = '9f1c7d2e-4b3a-4c11-8e6f-0a2b5c8d7e10'
const ABSENT_ID = '00000000-1111-2222-3333-444444444444'
const ROUND_ID = 'c3d4e5f6-a7b8-4901-9234-56789abcdef0'

const ELICITED_FROM = { round_id: ROUND_ID, participant_id: GRACE_ID }

const ROSTER: readonly RosterEntry[] = [
  { participant_id: GRACE_ID, display_name: 'Grace' },
  { participant_id: 'e1e1e1e1-2222-4333-8444-555566667777', display_name: 'Nadia' },
]

/**
 * The detector used by BOTH the absence assertions and their control. It walks
 * the serialised result, so a name-shaped id smuggled in on a NEW member is
 * caught without this test knowing the member exists.
 */
function identifiersIn(result: unknown): string[] {
  const serialised = JSON.stringify(result) ?? ''
  return [GRACE_ID, ROUND_ID, ABSENT_ID].filter((id) => serialised.includes(id))
}

describe('readElicitedFrom — the passthrough boundary', () => {
  it('reads a well-formed reference', () => {
    expect(readElicitedFrom(ELICITED_FROM)).toEqual({
      round_id: ROUND_ID,
      participant_id: GRACE_ID,
    })
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'grace'],
    ['a number', 7],
    ['an empty object', {}],
    ['a participant_id that is not a string', { round_id: ROUND_ID, participant_id: 42 }],
    ['a blank participant_id', { round_id: ROUND_ID, participant_id: '   ' }],
    ['a missing round_id', { participant_id: GRACE_ID }],
    ['a blank round_id', { round_id: '  ', participant_id: GRACE_ID }],
  ])('refuses %s', (_label, input) => {
    expect(readElicitedFrom(input)).toBeNull()
  })

  it('refuses a reference missing round_id even though the lookup only needs participant_id', () => {
    // Pins the DELIBERATE strictness: without a round_id there is no way to know
    // which roster is the right one, and resolving against whichever roster
    // happens to be loaded would attribute a value to a same-id person on
    // another round. The looser version of this function passes the test above
    // and fails this one.
    expect(readElicitedFrom({ participant_id: GRACE_ID })).toBeNull()
  })
})

describe('resolveParticipantName', () => {
  it('names the participant when the roster has them', () => {
    expect(resolveParticipantName(ELICITED_FROM, ROSTER)).toEqual({
      state: 'named',
      label: 'Grace',
    })
  })

  it('binds the name to the REFERENCED participant, not to the first row', () => {
    // Identity binding (not a value predicate another row could satisfy): the
    // roster's first row is Grace, so a lookup that ignored participant_id
    // would still return 'Grace' for Nadia's reference and look correct.
    const nadiaRef = { round_id: ROUND_ID, participant_id: ROSTER[1].participant_id }
    expect(resolveParticipantName(nadiaRef, ROSTER)).toEqual({
      state: 'named',
      label: 'Nadia',
    })
  })

  it('reports no_attribution when the value carries no reference', () => {
    expect(resolveParticipantName(undefined, ROSTER)).toEqual({
      state: 'unresolved',
      reason: 'no_attribution',
    })
  })

  it('reports roster_unavailable when round data is not loaded', () => {
    expect(resolveParticipantName(ELICITED_FROM, null)).toEqual({
      state: 'unresolved',
      reason: 'roster_unavailable',
    })
  })

  it('distinguishes an EMPTY roster (a fact) from an ABSENT one (transient)', () => {
    // These two must not collapse: one says "this round has no participants",
    // the other says "I could not find out". A caller that retries does so on
    // exactly one of them.
    expect(resolveParticipantName(ELICITED_FROM, [])).toEqual({
      state: 'unresolved',
      reason: 'not_on_roster',
    })
    expect(resolveParticipantName(ELICITED_FROM, null)).toEqual({
      state: 'unresolved',
      reason: 'roster_unavailable',
    })
  })

  it('reports not_on_roster when the round has no row for that participant', () => {
    const ref = { round_id: ROUND_ID, participant_id: ABSENT_ID }
    expect(resolveParticipantName(ref, ROSTER)).toEqual({
      state: 'unresolved',
      reason: 'not_on_roster',
    })
  })

  it('reports label_unusable for a present row with a blank label', () => {
    const roster: RosterEntry[] = [{ participant_id: GRACE_ID, display_name: '   ' }]
    expect(resolveParticipantName(ELICITED_FROM, roster)).toEqual({
      state: 'unresolved',
      reason: 'label_unusable',
    })
  })

  it('trims a usable label rather than rejecting it', () => {
    const roster: RosterEntry[] = [{ participant_id: GRACE_ID, display_name: '  Grace  ' }]
    expect(resolveParticipantName(ELICITED_FROM, roster)).toEqual({
      state: 'named',
      label: 'Grace',
    })
  })

  it('resolves to the R-2 PSEUDONYM when that is what the server served', () => {
    // The module must use the label it is given and hold no opinion about the
    // person's original name. CEE serves `pseudonym ?? display_name`, so a
    // redacted participant arrives already pseudonymised; anything that
    // preferred a remembered original would reinstate the name R-2 detached.
    const redacted: RosterEntry[] = [
      { participant_id: GRACE_ID, display_name: 'Participant 2' },
    ]
    expect(resolveParticipantName(ELICITED_FROM, redacted)).toEqual({
      state: 'named',
      label: 'Participant 2',
    })
  })

  it.each(['owner', 'assistant'])(
    'gives a truthful unresolved answer for the reserved literal %s, never invented copy',
    (reserved) => {
      // `AuthoredBySchema` admits these alongside a uuid. CEE only stamps
      // `elicited_from` after checking the id against the round's own
      // participant rows, so one arriving here means something changed
      // upstream — and the honest answer is "cannot name them", not a guess.
      const ref = { round_id: ROUND_ID, participant_id: reserved }
      expect(resolveParticipantName(ref, ROSTER)).toEqual({
        state: 'unresolved',
        reason: 'not_on_roster',
      })
    },
  )
})

describe('⭐ never leaks an identifier where a name belongs', () => {
  it('POSITIVE CONTROL — the detector finds ids when they ARE present', () => {
    // Without this, every assertion below could pass because the detector is
    // broken rather than because the results are clean.
    expect(identifiersIn({ state: 'named', label: GRACE_ID })).toEqual([GRACE_ID])
    expect(identifiersIn({ state: 'unresolved', reason: 'x', ref: ELICITED_FROM })).toEqual([
      GRACE_ID,
      ROUND_ID,
    ])
    expect(identifiersIn({ state: 'unresolved', debug: `round ${ABSENT_ID}` })).toEqual([
      ABSENT_ID,
    ])
  })

  it.each([
    ['a roster miss', { round_id: ROUND_ID, participant_id: ABSENT_ID }, ROSTER],
    ['an unavailable roster', ELICITED_FROM, null],
    ['an empty roster', ELICITED_FROM, []],
    ['a blank label', ELICITED_FROM, [{ participant_id: GRACE_ID, display_name: ' ' }]],
    ['a reserved literal', { round_id: ROUND_ID, participant_id: 'owner' }, ROSTER],
  ])(
    'carries no participant_id and no round_id for %s',
    (_label, ref, roster: readonly RosterEntry[] | null) => {
      const result = resolveParticipantName(ref, roster)
      expect(result.state).toBe('unresolved')
      expect(identifiersIn(result)).toEqual([])
    },
  )

  it('carries no identifier on the NAMED path either', () => {
    const result = resolveParticipantName(ELICITED_FROM, ROSTER)
    expect(result).toEqual({ state: 'named', label: 'Grace' })
    expect(identifiersIn(result)).toEqual([])
  })
})
