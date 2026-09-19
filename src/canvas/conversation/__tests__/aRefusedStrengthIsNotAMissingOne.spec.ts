/**
 * ⭐⭐ "THE SERVER STATED NOTHING" AND "THE SERVER STATED SOMETHING WE CANNOT
 * CARRY" ARE DIFFERENT FACTS, AND THE PRODUCT REPORTED BOTH THE SAME WAY.
 *
 * Measured on the founder's own board, 19 Sep 2026 (`olumi-debug-12928b8c`):
 *
 *   e-10  Dilution and Control Risk -> goal   strength_mean 0.35  effect_direction 'negative'
 *   e-19  Funding Shortfall Risk    -> goal   strength_mean 0.75  effect_direction 'negative'
 *
 * An unsigned magnitude beside a separate direction. The contract requires a
 * SIGNED mean, so the edit is refused — correctly. **Every risk -> goal edge is
 * affected**, because a risk is exactly the relationship that carries a negative
 * direction, so the edge a person most wants to correct is the one the editor
 * will not take.
 *
 * ⛔ AND THE SENTENCE BESIDE THE REFUSAL WAS FALSE: *"This connection has no
 * strength on record… Ask Olumi to set its strength."* The canvas was drawing
 * that strength, and Olumi is what stated it.
 *
 * ⚠ THIS FILE GUARDS THE DISTINCTION, NOT THE REFUSAL. The fence is unchanged
 * and correct; building an event the contract rejects would fail the whole turn.
 * Both halves are asserted, because a predicate that fired on every refusal
 * would replace one wrong sentence with another.
 */
import { describe, it, expect } from 'vitest'
import { serverStatedStrengthOf, serverStatedStrengthDisagreesOnSign } from '../edgeServerStatedStrength'

/** The two edges, verbatim from the capture. */
const FOUNDER_RISK_EDGES = [
  { id: 'e-10', strength_mean: 0.35, effect_direction: 'negative', weight: 0.35, direction: 'negative' },
  { id: 'e-19', strength_mean: 0.75, effect_direction: 'negative', weight: 0.75, direction: 'negative' },
] as const

describe('a refused strength is not a missing one', () => {
  describe("⭐ the founder's risk edges", () => {
    it.each(FOUNDER_RISK_EDGES.map(e => [e.id, e] as const))(
      '%s is refused AND is recognised as a sign disagreement', (_id, edge) => {
        // The refusal is unchanged — this is the precondition, not the claim.
        expect(serverStatedStrengthOf(edge as never), 'the fence moved').toBeNull()
        // And the reason is now nameable.
        expect(serverStatedStrengthDisagreesOnSign(edge as never)).toBe(true)
      })
  })

  describe('⛔ DISCRIMINATION — it must not fire on a genuine absence', () => {
    // If it did, we would replace one false sentence with another: telling a
    // reader the model "recorded it separately" when the model recorded nothing.
    it.each([
      ['no strength at all', {}],
      ['a mean with no direction', { strength_mean: 0.4 }],
      ['a direction with no mean', { effect_direction: 'negative' }],
      ['a non-finite mean', { strength_mean: Number.NaN, effect_direction: 'negative' }],
      ['an unknown direction', { strength_mean: 0.4, effect_direction: 'unknown' }],
      ['null data', null],
    ])('%s is NOT a sign disagreement', (_name, data) => {
      expect(serverStatedStrengthDisagreesOnSign(data as never)).toBe(false)
      expect(serverStatedStrengthOf(data as never), 'this case should still be refused').toBeNull()
    })
  })

  describe('⛔ DISCRIMINATION — it must not fire on an edge that WORKS', () => {
    it.each([
      ['positive/positive', { strength_mean: 0.6, effect_direction: 'positive' }],
      ['negative/negative', { strength_mean: -0.6, effect_direction: 'negative' }],
      ['zero is exempt by contract', { strength_mean: 0, effect_direction: 'negative' }],
    ])('%s is carriable and is not flagged', (_name, data) => {
      expect(serverStatedStrengthOf(data as never), 'a valid tuple was refused').not.toBeNull()
      expect(serverStatedStrengthDisagreesOnSign(data as never)).toBe(false)
    })
  })

  it('⛔ a RECORDED tuple short-circuits — the disagreement is only about raw spellings', () => {
    const recorded = {
      serverStrength: { mean: -0.35, effect_direction: 'negative' },
      // Raw spellings that would disagree, deliberately, to prove precedence.
      strength_mean: 0.35,
      effect_direction: 'negative',
    }
    expect(serverStatedStrengthOf(recorded as never)).not.toBeNull()
    expect(serverStatedStrengthDisagreesOnSign(recorded as never)).toBe(false)
  })

  it('⭐ PRECONDITION: the two predicates genuinely divide the refused population', () => {
    // A probe whose two halves answer identically is not discriminating.
    const refusedForSign = FOUNDER_RISK_EDGES[0]
    const refusedForAbsence = { strength_mean: 0.4 }
    expect(serverStatedStrengthOf(refusedForSign as never)).toBeNull()
    expect(serverStatedStrengthOf(refusedForAbsence as never)).toBeNull()
    expect(serverStatedStrengthDisagreesOnSign(refusedForSign as never))
      .not.toBe(serverStatedStrengthDisagreesOnSign(refusedForAbsence as never))
  })
})
