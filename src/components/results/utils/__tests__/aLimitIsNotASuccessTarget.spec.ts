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
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

// ── THE WHOLE CLASS, not one template (26 Sep 2026, the #2111 follow-up) ──
// Every CONSTRAINT_* code is raised for a goal constraint, which is the user's
// limit; the goal's own target has parallel GOAL_THRESHOLD_* codes. Paul's
// served About › Sources and limits still showed two siblings saying "success
// target" after #2111 ("One of your success targets could mean a level…",
// "A factor carrying a success target…"). The list is DERIVED from the source,
// so a new CONSTRAINT_* template cannot opt out by being added later.
const SRC = resolve(__dirname, '../humaniseCritique.ts')
const templateKeys = (prefix: string): string[] =>
  [...readFileSync(SRC, 'utf8').matchAll(new RegExp(`^ {2}(${prefix}[A-Z_]+): \\(`, 'gm'))].map((m) => m[1])

describe('every CONSTRAINT_* template names a limit, never a success target', () => {
  const codes = templateKeys('CONSTRAINT_')

  it('POSITIVE CONTROL: the derivation finds the known family', () => {
    expect(codes.length).toBeGreaterThanOrEqual(10)
    expect(codes).toContain('CONSTRAINT_TARGET_UNRELIABLE')
    expect(codes).toContain('CONSTRAINT_FRAME_UNSPECIFIED')
    expect(codes).toContain('CONSTRAINT_NODE_DEFAULT_BASE')
  })

  it.each(templateKeys('CONSTRAINT_'))('%s says nothing about a "success target"', (code) => {
    const got = humaniseCritique({ code, message: '' })
    // Hyphen-safe (Canvas #2114 N1): "success-target factors" evaded a plain substring.
    expect(`${got.title} ${got.description} ${got.suggestion ?? ''}`).not.toMatch(/success[\s-]?target/i)
  })

  it('the served siblings now say limit', () => {
    expect(humaniseCritique({ code: 'CONSTRAINT_FRAME_UNSPECIFIED', message: '' }).title).toMatch(/^One of your limits /)
    expect(humaniseCritique({ code: 'CONSTRAINT_NODE_DEFAULT_BASE', message: '' }).title).toMatch(/^A factor carrying a limit /)
    expect(humaniseCritique({ code: 'CONSTRAINT_NOT_CONVERTIBLE', message: '' }).title).toMatch(/^One of your limits /)
  })

  it("CONTRAST: the goal's own GOAL_THRESHOLD_* templates never call it a limit", () => {
    const goal = templateKeys('GOAL_THRESHOLD_')
    expect(goal.length).toBeGreaterThanOrEqual(2)
    for (const code of goal) {
      expect(humaniseCritique({ code, message: '' }).title.toLowerCase()).not.toContain('limit')
    }
  })
})

