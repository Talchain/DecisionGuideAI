/**
 * `buildFactorValueEditEvent` — the `applied_from` attribution claim.
 *
 * ⚠ WHY THE PAYLOAD SHAPE IS ASSERTED KEY BY KEY, not with a loose `toMatchObject`.
 * Every member of the system-event union is `.strict()` server-side, so an extra
 * key is not dropped — it REFUSES THE WHOLE TURN. And a `raw_value` riding
 * alongside a panel apply would be the client asserting a magnitude nobody
 * stated. Both failure modes are silent in a shape-tolerant assertion.
 */

import { describe, expect, it } from 'vitest'

import { buildFactorValueEditEvent } from '../factorValueEdit'

const APPLIED_FROM = {
  round_id: '33333333-3333-4333-8333-333333333333',
  participant_id: '55555555-5555-4555-8555-555555555555',
}

/** An uncapped, unitless probability factor — what a panel round asks about. */
const PROBABILITY_NODE = { observedState: { value: 0.4 } }

describe('buildFactorValueEditEvent — applied_from', () => {
  it('emits applied_from with EXACTLY the two ids, and no raw_value/unit', () => {
    const event = buildFactorValueEditEvent({
      nodeId: 'fac_churn_risk',
      typedValue: 0.85,
      nodeData: PROBABILITY_NODE,
      appliedFrom: APPLIED_FROM,
    })

    expect(event).not.toBeNull()
    const payload = event?.payload as Record<string, unknown>

    expect(payload.target_id).toBe('fac_churn_risk')
    expect(payload.value).toBe(0.85)
    expect(payload.field).toBe('value')
    expect(payload.applied_from).toEqual(APPLIED_FROM)

    // A display name here would be refused at parse by
    // `RoundParticipantRefSchema.strict()` — the PII rule made structural.
    expect(Object.keys(payload.applied_from as object).sort()).toEqual([
      'participant_id',
      'round_id',
    ])

    // The server DISCARDS client user-unit fields on a verified apply; a client
    // that sent them anyway would be asserting a magnitude nobody stated.
    expect(payload.raw_value).toBeUndefined()
    expect(payload.unit).toBeUndefined()

    // The complete key set. An extra key refuses the whole turn server-side.
    expect(Object.keys(payload).sort()).toEqual(['applied_from', 'field', 'target_id', 'value'])
  })

  it('carries the value VERBATIM — CEE compares with Object.is and refuses any difference', () => {
    const awkward = 0.1 + 0.2
    const event = buildFactorValueEditEvent({
      nodeId: 'fac_churn_risk',
      typedValue: awkward,
      nodeData: PROBABILITY_NODE,
      appliedFrom: APPLIED_FROM,
    })
    expect((event?.payload as Record<string, unknown>).value).toBe(awkward)
  })

  it('ABSENCE IS DISTINCT: an ordinary edit emits no applied_from at all', () => {
    // The paired negative. Without it, a builder that attached a constant
    // `applied_from` to every edit would satisfy every assertion above.
    const event = buildFactorValueEditEvent({
      nodeId: 'fac_churn_risk',
      typedValue: 0.6,
      nodeData: PROBABILITY_NODE,
    })
    expect(event).not.toBeNull()
    expect((event?.payload as Record<string, unknown>).applied_from).toBeUndefined()
  })

  it('inherits the model_scale structural refusals — outside [0,1] is unencodable', () => {
    // An apply borrows the `model_scale` belt wholesale rather than restating
    // it, so the two cannot disagree about what a bare belief number means.
    expect(
      buildFactorValueEditEvent({
        nodeId: 'fac_churn_risk',
        typedValue: 1.5,
        nodeData: PROBABILITY_NODE,
        appliedFrom: APPLIED_FROM,
      }),
    ).toBeNull()
  })

  it('inherits the magnitude-scaled refusal — a probability onto a £ factor is unencodable', () => {
    // The £40,000 → £0.70 shape. Fail CLOSED: no event, so no wire, no stamp.
    const moneyNode = { observedState: { value: 40000, raw_value: 40000, unit: '£' } }
    expect(
      buildFactorValueEditEvent({
        nodeId: 'fac_budget',
        typedValue: 0.85,
        nodeData: moneyNode,
        appliedFrom: APPLIED_FROM,
      }),
    ).toBeNull()

    // CONTROL: the same factor still accepts an ordinary user-unit edit, so the
    // refusal above is attributable to the apply path and not to a broken node.
    expect(
      buildFactorValueEditEvent({
        nodeId: 'fac_budget',
        typedValue: 50000,
        nodeData: moneyNode,
      }),
    ).not.toBeNull()
  })

  it('fails closed on an unencodable target', () => {
    expect(
      buildFactorValueEditEvent({
        nodeId: '',
        typedValue: 0.85,
        nodeData: PROBABILITY_NODE,
        appliedFrom: APPLIED_FROM,
      }),
    ).toBeNull()
  })
})
