/**
 * A LIMIT IS NOT A SUCCESS TARGET — Panel whole-tab witness, 26 Sep 2026,
 * served UI 046f67ab + CEE 9ea51f8, Paul's MRR brief ("reaching £20k MRR …
 * while keeping monthly churn under 10%").
 *
 * On one turn the chat said "Your monthly churn under 10% limit was not
 * checked" and the Challenge card said "This model cannot check your limit
 * yet", while the Reasoning tab's "Still open" line, About › Sources and limits
 * and the canvas card all said "A success target on your model can't be
 * evaluated reliably" — which a user reads as the £20k MRR goal. PLoT raises
 * CONSTRAINT_TARGET_UNRELIABLE for a goal CONSTRAINT (a limit); the goal's own
 * target has its own codes (GOAL_THRESHOLD_*), which keep the word "target".
 */
import { describe, it, expect } from 'vitest'
import { humaniseCritique } from '../humaniseCritique'

// The wire carries {code, message, severity} and nothing else (see the template's comment).
const CHURN_LIMIT_UNRELIABLE = {
  code: 'CONSTRAINT_TARGET_UNRELIABLE',
  message:
    'The target on "Monthly churn" can\'t be scored against this model: goal-fit probabilities were withheld for this run rather than shown.',
}

describe('a limit is not a success target', () => {
  it('the anonymous form names a limit, never a success target', () => {
    const got = humaniseCritique(CHURN_LIMIT_UNRELIABLE)
    expect(got.title).toBe("A limit on your model can't be checked reliably")
    expect(`${got.title} ${got.description}`.toLowerCase()).not.toContain('success target')
    expect(got.description.toLowerCase()).toContain('limit')
  })

  it('the named form names the limit on that node', () => {
    const got = humaniseCritique(
      { ...CHURN_LIMIT_UNRELIABLE, affectedNodes: ['fac_churn'] },
      new Map([['fac_churn', 'Monthly churn']]),
    )
    expect(got.title).toBe("The limit on Monthly churn can't be checked reliably")
  })

  it("CONTRAST: the goal's own target keeps the word target", () => {
    const got = humaniseCritique({ code: 'GOAL_THRESHOLD_NOT_CONVERTIBLE', message: '' })
    expect(got.title).toContain("goal's target")
    expect(got.title.toLowerCase()).not.toContain('limit')
  })
})
