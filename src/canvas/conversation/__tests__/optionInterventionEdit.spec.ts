/**
 * `buildOptionInterventionEditEvent` — the wire event for one option's effect
 * value on one factor (schemas 0.54.0).
 *
 * ⚠ THIS MODULE HAS NO PRODUCTION CALLER YET, ON PURPOSE. `ModelTabBody` mounts
 * both surfaces with no flag, and the v1 `OptionsSection` renders a LIVE
 * intervention editor calling `useModelEditAuthority.proposeOptionIntervention`
 * directly. The moment that method dispatches, a user-reachable control emits
 * this kind — and a CEE without the 0.54.0 reader fails the `.strict()` union's
 * DISCRIMINATOR and rejects the WHOLE turn, not just the field. So the swap
 * belongs in the change that also flips the affordance, after CEE serves.
 *
 * What that means for this file: it is the builder's contract, proven now so the
 * later change is a body swap rather than a body swap plus an unreviewed
 * payload. Every refusal below is a case that must NEVER reach the wire.
 */
import { describe, it, expect } from 'vitest'

import { buildOptionInterventionEditEvent } from '../optionInterventionEdit'

const OPTION = 'option_open_leeds'
const FACTOR = 'factor_capex'
const HASH = '9f2c1b0ae4d37c5a'

function args(over: Partial<Parameters<typeof buildOptionInterventionEditEvent>[0]> = {}) {
  return { optionId: OPTION, factorId: FACTOR, modelValue: 0.6, baseGraphHash: HASH, ...over }
}

describe('what it emits', () => {
  it('builds the typed event with ids, the model-scale value and the base hash', () => {
    expect(buildOptionInterventionEditEvent(args())).toEqual({
      type: 'option_intervention_edit',
      payload: {
        option_id: OPTION,
        factor_id: FACTOR,
        value: 0.6,
        base_graph_hash: HASH,
      },
    })
  })

  it('carries FOUR fields and no more — no unit, raw value, provenance or actor', () => {
    // Each of those is a claim the client cannot honestly make, and a field
    // nothing may populate is one a later reader populates anyway.
    const event = buildOptionInterventionEditEvent(args())
    expect(Object.keys(event?.payload ?? {}).sort()).toEqual(
      ['base_graph_hash', 'factor_id', 'option_id', 'value'].sort(),
    )
  })

  it('accepts both ends of the model scale — 0 and 1 are real values', () => {
    expect(buildOptionInterventionEditEvent(args({ modelValue: 0 }))?.payload?.value).toBe(0)
    expect(buildOptionInterventionEditEvent(args({ modelValue: 1 }))?.payload?.value).toBe(1)
  })
})

describe('what must never reach the wire', () => {
  it('⚠ refuses with NO base hash — the reload case', () => {
    // `lastServerGraphHash` is null after a restore (persistence is read with no
    // CEE turn). Sending an empty or invented hash would be refused by the
    // server as STALE, which reads to a user as "your edit conflicted" when the
    // client never held a base to assert. Refuse, and let the caller disclose.
    expect(buildOptionInterventionEditEvent(args({ baseGraphHash: null }))).toBeNull()
    expect(buildOptionInterventionEditEvent(args({ baseGraphHash: '' }))).toBeNull()
  })

  it.each([
    ['below the model scale', -0.01],
    ['above the model scale', 1.01],
    ['a user-unit magnitude', 120000],
    ['a percentage as typed', 60],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ] as Array<[string, number]>)('refuses %s — REFUSE, never clamp', (_name, modelValue) => {
    // A clamped 1.5 → 1 sends a number the user never stated and the server
    // persists it as theirs. Same ruling `edgeStrengthEdit` makes for magnitude.
    expect(buildOptionInterventionEditEvent(args({ modelValue }))).toBeNull()
  })

  it.each([
    ['empty', ''],
    ['blank', '   '],
    ['leading whitespace', ' factor_capex'],
    ['trailing whitespace', 'factor_capex '],
    ['arrow composite', 'option→factor'],
    ['ascii-arrow composite', 'option->factor'],
  ] as Array<[string, string]>)('refuses an id that is %s, on BOTH halves', (_name, id) => {
    expect(buildOptionInterventionEditEvent(args({ optionId: id }))).toBeNull()
    expect(buildOptionInterventionEditEvent(args({ factorId: id }))).toBeNull()
  })

  it('refuses an option addressing itself — no such relationship can exist', () => {
    expect(buildOptionInterventionEditEvent(args({ factorId: OPTION }))).toBeNull()
  })

  it('POSITIVE CONTROL: the refusals above are each about their own cause', () => {
    // Without this every assertion in this block would pass against a builder
    // that returned null unconditionally.
    expect(buildOptionInterventionEditEvent(args())).not.toBeNull()
  })
})
