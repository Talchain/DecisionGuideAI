/**
 * THE ADAPTER MUST CARRY EVERY FIELD THE CONTRACT DECLARES — derived from the
 * contract, never from a hand-written list.
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
 * `adaptFactorValueEdit` copied `target_id`, `value`, `raw_value`, `unit` and
 * `field` field-by-field, and silently dropped `applied_from`. The consequence
 * was not a type error or a 422 — it was a capability that looked shipped and
 * was dark: an owner clicking "Use Grace's 0.85" sent a `factor_value_edit`
 * with no attribution claim, CEE stamped `source: 'user_override'` with no
 * `elicited_from`, and the pill said "Set by you". Two merged PRs of
 * attribution work rendered unreachable by one absent line in a third file
 * neither of them touched.
 *
 * **The field list was a hand-maintained mirror of the wire shape, and that is
 * HOW it shipped dark** (CLAUDE.md trap 12). The contract grew a member; the
 * mirror did not; nothing anywhere went red. A second hand-written list —
 * "fields the adapter should carry" — would be the same defect wearing a test's
 * clothes, and would have to be remembered by the same person who forgot the
 * first one.
 *
 * ── SO THE EXPECTATION IS DERIVED FROM THE PUBLISHED ZOD SCHEMA ───────────
 * `SystemEventTurnPayloadSchema` is a discriminated union of `.strict()`
 * members. This file walks it to the `factor_value_edit` member and reads its
 * ACTUAL key set at the pin in `package.json`. When the contract gains a field,
 * this guard starts demanding it on the next run, with no edit here and nobody
 * needing to remember.
 *
 * ⚠ A DERIVED GUARD PROVES AGREEMENT, NOT COMPLETENESS (trap 12d). This one
 * cannot notice that the CONTRACT is missing a field the product needs — only
 * that the adapter has fallen behind the contract. That is the exact defect
 * class that shipped here, and it is the one being closed; the other face needs
 * a corpus, which is what the click-to-wire acceptance spec is.
 */

import { describe, it, expect } from 'vitest'
import { SystemEventTurnPayloadSchema } from '@talchain/schemas/boundary'
import { buildV5Payload } from '../buildPayload'

/**
 * Fields the adapter is allowed NOT to carry from the caller's payload.
 *
 * ⚠ THIS LIST IS A CONFESSION, NOT A CONVENIENCE. Every entry is a field the
 * wire declares and the client deliberately refuses to forward, and each needs
 * a reason a reviewer can check. It is EMPTY today: there is no field on this
 * event the client is entitled to withhold.
 *
 * `kind` is not an exception — the adapter sets it itself, so it is present in
 * the output and the assertion below passes on it for the right reason.
 */
const DELIBERATELY_NOT_CARRIED: Readonly<Record<string, string>> = Object.freeze({})

/** Walk the union to the factor_value_edit member and read its real keys. */
function contractKeysForFactorValueEdit(): string[] {
  const eventSchema = (SystemEventTurnPayloadSchema as never as {
    shape: { event: { _def: { options: unknown[] } } }
  }).shape.event
  const options = eventSchema._def.options as Array<{
    shape: Record<string, { _def?: { value?: unknown } }>
  }>
  const member = options.find(
    (o) => o.shape?.kind?._def?.value === 'factor_value_edit',
  )
  if (member === undefined) {
    throw new Error(
      'could not reach the factor_value_edit member of SystemEventTurnPayloadSchema — ' +
        'the union shape changed and this guard is measuring nothing',
    )
  }
  return Object.keys(member.shape)
}

// Real uuids and a real stage literal: the final case parses the built payload
// against the contract, so a placeholder id would fail on the ID FORMAT and
// disguise whether the event body is right.
const TURN_ID = '11111111-2222-4333-8444-555566667777'
const SCENARIO_ID = '22222222-3333-4444-8555-666677778888'
const ROUND_ID = 'c3d4e5f6-a7b8-4901-9234-56789abcdef0'
const PARTICIPANT_ID = '9f1c7d2e-4b3a-4c11-8e6f-0a2b5c8d7e10'

/**
 * A payload populating EVERY contract field with a valid value.
 *
 * ⚠ `applied_from` and `raw_value`/`unit` are mutually exclusive in the
 * PRODUCT (a verified apply is model-scale, so the builder never attaches
 * user-unit fields beside an attribution). They are populated together HERE on
 * purpose: this guard is about the adapter's CARRIAGE, and it must be able to
 * observe every field's carriage independently of the product rule that decides
 * which combinations occur. The product rule has its own tests.
 */
const MAXIMAL_PAYLOAD: Record<string, unknown> = {
  target_id: 'factor-1',
  value: 0.85,
  raw_value: 85,
  unit: '%',
  field: 'value',
  applied_from: { round_id: ROUND_ID, participant_id: PARTICIPANT_ID },
}

function wireEventFor(payload: Record<string, unknown>): Record<string, unknown> {
  const result = buildV5Payload({
    turnId: TURN_ID,
    scenarioId: SCENARIO_ID,
    stage: 'frame' as never,
    turnClass: 'system' as never,
    mode: 'system',
    systemEvent: { type: 'factor_value_edit', payload } as never,
  })
  if (!result.ok) {
    throw new Error(`buildV5Payload refused the event: ${JSON.stringify(result)}`)
  }
  return (result.payload as unknown as { event: Record<string, unknown> }).event
}

describe('factor_value_edit — the adapter carries the whole contract', () => {
  it('POSITIVE CONTROL — the contract walk reaches a real, non-trivial key set', () => {
    // Without this, a walk that silently returned [] would make every
    // assertion below pass by iterating nothing — the vacuity this repo has
    // been bitten by before.
    const keys = contractKeysForFactorValueEdit()
    expect(keys.length).toBeGreaterThanOrEqual(5)
    expect(keys).toContain('kind')
    expect(keys).toContain('target_id')
    expect(keys).toContain('value')
    // And the walk discriminates — it did not hand back some other member.
    expect(keys).not.toContain('patch_id')
  })

  it('⭐ carries EVERY field the contract declares (derived, not a hand list)', () => {
    const contractKeys = contractKeysForFactorValueEdit()
    const event = wireEventFor(MAXIMAL_PAYLOAD)

    const dropped = contractKeys.filter(
      (k) => !(k in event) && !(k in DELIBERATELY_NOT_CARRIED),
    )

    expect(
      dropped,
      dropped.length === 0
        ? ''
        : `adaptFactorValueEdit DROPS contract field(s) [${dropped.join(', ')}]. ` +
          'A field the wire declares and the adapter does not copy is a capability ' +
          'that ships dark — it is how applied_from was lost. Carry it, or add it ' +
          'to DELIBERATELY_NOT_CARRIED with a reason a reviewer can check.',
    ).toEqual([])
  })

  it('every declared exception is real — no stale entry silently excuses a live field', () => {
    // The exception list is itself a hand-maintained list, so it gets the
    // treatment: an entry naming a field the contract no longer has is a
    // standing permission to drop nothing, and it would quietly excuse a
    // future field that happened to share the name.
    const contractKeys = new Set(contractKeysForFactorValueEdit())
    for (const key of Object.keys(DELIBERATELY_NOT_CARRIED)) {
      expect(contractKeys.has(key), `${key} is excepted but is not in the contract`).toBe(true)
    }
  })

  it('⭐ carries applied_from specifically, with BOTH members intact', () => {
    // Named separately from the derived sweep on purpose: the sweep proves the
    // key is PRESENT, and a carriage that forwarded `applied_from: {}` would
    // satisfy it while losing the identity that is the entire point.
    const event = wireEventFor(MAXIMAL_PAYLOAD)
    expect(event.applied_from).toEqual({
      round_id: ROUND_ID,
      participant_id: PARTICIPANT_ID,
    })
  })

  it('omits applied_from when the caller did not claim one — absence stays absence', () => {
    const { applied_from: _omitted, ...withoutClaim } = MAXIMAL_PAYLOAD
    const event = wireEventFor(withoutClaim)
    expect('applied_from' in event).toBe(false)
  })

  it.each([
    ['a claim with no participant_id', { round_id: ROUND_ID }],
    ['a claim with no round_id', { participant_id: PARTICIPANT_ID }],
    ['a claim with a blank round_id', { round_id: '  ', participant_id: PARTICIPANT_ID }],
    ['a claim with a blank participant_id', { round_id: ROUND_ID, participant_id: '' }],
    ['a claim that is not an object', 'grace'],
    ['a claim whose members are not strings', { round_id: 1, participant_id: 2 }],
  ])('⭐ FAILS CLOSED on %s — refuses the event rather than dropping the claim', (_l, claim) => {
    // The asymmetry that decides this: refusing gives the owner a visible
    // nothing they can retry, whereas dropping the claim APPLIES the value and
    // stamps it as the owner's own edit — the exact attribution untruth this
    // seam exists to end, silent and permanent in the model. This is also the
    // behaviour `field` already has one branch up, so the two agree.
    const result = buildV5Payload({
      turnId: TURN_ID,
      scenarioId: SCENARIO_ID,
      stage: 'frame' as never,
      turnClass: 'system' as never,
      mode: 'system',
      systemEvent: {
        type: 'factor_value_edit',
        payload: { ...MAXIMAL_PAYLOAD, applied_from: claim },
      } as never,
    })
    expect(result.ok).toBe(false)
  })

  it('a null claim is treated as absent, not as malformed', () => {
    // `null` is what an "I have no attribution" producer emits; refusing the
    // whole edit for it would break ordinary value edits from any caller that
    // initialises the field.
    const event = wireEventFor({ ...MAXIMAL_PAYLOAD, applied_from: null })
    expect('applied_from' in event).toBe(false)
    expect(event.target_id).toBe('factor-1')
  })

  it('does not launder EXTRA members of the claim onto a strict wire', () => {
    // The caller's object is a client-side record. A spread would put whatever
    // else it carries onto a `.strict()` union member and 422 the whole turn.
    const event = wireEventFor({
      ...MAXIMAL_PAYLOAD,
      applied_from: {
        round_id: ROUND_ID,
        participant_id: PARTICIPANT_ID,
        display_name: 'Grace',
        note: 'local only',
      },
    })
    expect(event.applied_from).toEqual({
      round_id: ROUND_ID,
      participant_id: PARTICIPANT_ID,
    })
    // And specifically: no PII rode along. A display name on the wire would be
    // persisted into the graph, beyond the R-2 redaction routine's reach.
    expect(JSON.stringify(event)).not.toContain('Grace')
  })

  it('the event still validates against the contract it was derived from', () => {
    // Closes the loop: carrying a field is only correct if the result parses.
    const result = buildV5Payload({
      turnId: TURN_ID,
      scenarioId: SCENARIO_ID,
      stage: 'frame' as never,
      turnClass: 'system' as never,
      mode: 'system',
      systemEvent: { type: 'factor_value_edit', payload: MAXIMAL_PAYLOAD } as never,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const parsed = SystemEventTurnPayloadSchema.safeParse(result.payload)
    expect(parsed.success, JSON.stringify((parsed as { error?: unknown }).error)).toBe(true)
  })
})
