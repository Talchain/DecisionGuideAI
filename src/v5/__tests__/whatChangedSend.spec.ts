/**
 * F2 CHANGE B — the "What changed?" pill SEND half (UI → CEE).
 *
 * These specs pin the WIRE CONTRACT for the typed `what_changed` chip_click and
 * mutation-check the send gate, both built from the REAL production seams
 * (buildChipMeta + buildV5Payload + the exported isSendableActionType predicate)
 * — never a hand-built payload object. The bug class this guards against is a
 * green test whose fixture encodes the very assumption under test, so:
 *
 *  1. the source is fed in as 'chip' and we assert the gate PROMOTES it to
 *     'chip_click' (not a hardcoded source), and
 *  2. the CEE-accept mirror is mutation-checked: with 'what_changed' removed
 *     from the accepted registry the gate must DROP the value, and only the
 *     restored registry lets it through — proving the hand-mirror edit in
 *     buildPayload.ts is load-bearing, not decorative.
 *
 * Landing: blocked on olumi-schemas #17 publish → CEE #620 deploy (see
 * parallel-briefs/F2B-BYTE-CONFIRM §6). CEE is fail-closed on the enum, so a
 * send before CEE accepts would 422 the whole turn.
 */
import { describe, it, expect } from 'vitest'
import {
  OrchestratorTurnPayloadSchema,
  ActionType,
  type MessageTurnPayload,
} from '@talchain/schemas/boundary'
import {
  buildV5Payload,
  isSendableActionType,
  KNOWN_ACTION_TYPES,
  CEE_ACCEPTED_ACTION_TYPES,
} from '../buildPayload'
import { buildChipMeta } from '../../canvas/conversation/chipMeta'
// Import the message from the ZERO-import leaf, NOT from WhatChangedChip.tsx:
// this spec is inside the narrow CI typecheck gate's src/v5/** include, and
// importing the component would drag the useConversation hook graph (and its
// pre-existing type debt) into the gate.
import { WHAT_CHANGED_CHIP_MESSAGE } from '../../canvas/components/whatChangedChipMessage'

const TURN_ID = '11111111-1111-4111-8111-111111111111'
const SCENARIO_ID = '22222222-2222-4222-8222-222222222222'

/** Reconstruct exactly what dispatchAction feeds the payload builder for the
 * WhatChangedChip click: buildChipMeta from the chip's action_type, source
 * 'chip' (dispatchAction passes 'chip'; promotion is the gate's job), and the
 * chip's exported message constant. */
function buildWhatChangedSend(): MessageTurnPayload {
  const chipMeta = buildChipMeta({ action_type: 'what_changed' })
  const result = buildV5Payload({
    turnId: TURN_ID,
    scenarioId: SCENARIO_ID,
    stage: 'analyse',
    turnClass: 'frame',
    mode: 'user',
    message: WHAT_CHANGED_CHIP_MESSAGE,
    source: 'chip',
    chipMeta,
  })
  if (!result.ok) throw new Error(`expected ok; got ${result.reason}`)
  if (result.payload.kind !== 'message') throw new Error('expected message payload')
  return result.payload
}

describe('what_changed send — wire contract (F2 CHANGE B)', () => {
  it('the vendored enum publishes what_changed as the 11th ActionType', () => {
    // The "published" half of the send gate — satisfied by re-vendoring
    // @talchain/schemas 0.21.0. KNOWN_ACTION_TYPES is DERIVED from this.
    expect(ActionType.options).toContain('what_changed')
    expect(ActionType.options[10]).toBe('what_changed')
    expect(KNOWN_ACTION_TYPES.has('what_changed')).toBe(true)
  })

  it('carries chip.action_type=what_changed, message verbatim, and PROMOTES source chip→chip_click', () => {
    const payload = buildWhatChangedSend()

    // The three fields the byte-confirm §2 pins.
    expect(payload.chip?.action_type).toBe('what_changed')
    expect(payload.message).toBe(WHAT_CHANGED_CHIP_MESSAGE)
    expect(payload.message).toBe('What changed since the last run?')

    // The PROMOTION, not a hardcoded source: we fed source:'chip' in, and the
    // hasBoundAction gate lifted it to 'chip_click' precisely because
    // what_changed passed sendability. This is what routes it to CEE's
    // forced-intent door.
    expect(payload.source).toBe('chip_click')
  })

  it('the built payload is accepted by the v0.7.0 OrchestratorTurnPayload schema', () => {
    // Proves what_changed is a schema-valid action_type on the wire — not just
    // shaped correctly by our builder.
    const payload = buildWhatChangedSend()
    expect(() => OrchestratorTurnPayloadSchema.parse(payload)).not.toThrow()
  })
})

describe('what_changed send gate — the CEE-accept mirror is load-bearing (mutation-check)', () => {
  it('DROPS the value when what_changed is removed from CEE_ACCEPTED_ACTION_TYPES, PASSES when restored', () => {
    // Synthetic accepted registry with what_changed excised — the exact mutation
    // the brief demands, driving the REAL predicate the send gate uses.
    const acceptedWithout = new Set(
      [...CEE_ACCEPTED_ACTION_TYPES].filter((t) => t !== 'what_changed'),
    )

    // Drop: published but NOT accepted → withheld from the wire.
    expect(
      isSendableActionType('what_changed', KNOWN_ACTION_TYPES, acceptedWithout),
    ).toBe(false)

    // Restore (the real registry, post-edit): published AND accepted → sends.
    expect(
      isSendableActionType('what_changed', KNOWN_ACTION_TYPES, CEE_ACCEPTED_ACTION_TYPES),
    ).toBe(true)
  })

  it('the AND bites from BOTH sides — publication alone or acceptance alone never opens the gate', () => {
    const onlyAccepted = new Set(['what_changed'])
    const onlyPublished = new Set(['what_changed'])
    // Accepted but not published (e.g. UI on an older schema pin) → dropped.
    expect(isSendableActionType('what_changed', new Set(), onlyAccepted)).toBe(false)
    // Published but not accepted (CEE has not deployed acceptance) → dropped.
    expect(isSendableActionType('what_changed', onlyPublished, new Set())).toBe(false)
  })

  it('the accepted registry actually contains what_changed after the mirror edit', () => {
    // The load-bearing hand-edit itself. Without it the two specs above pass on
    // the synthetic sets while the real send silently no-ops.
    expect(CEE_ACCEPTED_ACTION_TYPES.has('what_changed')).toBe(true)
  })
})
