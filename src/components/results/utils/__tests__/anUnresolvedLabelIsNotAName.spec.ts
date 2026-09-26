/**
 * ⭐ AN UNRESOLVED LABEL IS NOT A NAME — and one template printed it at a user.
 *
 * ## The defect, measured
 *
 * `olumi-debug-1dd2133d-20260916.json` (staging, UI `6497a251`, 16 Sep 2026).
 * The deployed Question card rendered, verbatim:
 *
 *     "This factor's success target can't be evaluated reliably
 *      Set a value or range for This factor."
 *
 * `This factor` is `FALLBACK_LABEL`, the sentinel `resolveFactorLabel` returns
 * when a critique carries no resolvable node identity. It reached the user
 * twice in one sentence, once as a possessive subject.
 *
 * In that export the warning arrives as `{code, message, severity}` and nothing
 * else — no `affected_nodes`, no `field` — so there was no id to resolve and no
 * label map could have helped. The producer's `message` DOES name the node
 * ("Budget Overrun Risk"); it stays unread, because parsing identity out of
 * message prose is the V14.3 rule `withheldLeaderDisclosure.ts` upholds.
 *
 * The target was a RISK node, so "factor" was not merely unresolved — it was
 * the wrong kind. The anonymous form therefore asserts no kind at all.
 *
 * ## Why this spec has a CLASS arm as well as an INSTANCE arm
 *
 * `humaniseCritique.ts` already states the rule twice in prose — at the 2.300
 * goal templates and again as a whole-vocabulary claim ("EVERY TEMPLATE IGNORES
 * THE RESOLVED LABEL, DELIBERATELY"). The rule was correct and simply never
 * reached this entry. Fixing only the instance would repeat the estate's named
 * failure — a remedy scoped to the instance with nothing sweeping its siblings —
 * so the class arm pins the REMAINING offenders as an exact set, derived by
 * execution rather than listed by hand.
 *
 * ⚠ THE PINNED SET IS A RECORDED GAP, NOT AN APPROVAL. Those eight templates
 * still interpolate the sentinel. They are pinned so the suite REDs when the set
 * GROWS (a new template breaks the rule) **and** when it SHRINKS (one is fixed
 * without this record being updated). A gap visible in the suite is honest; a
 * gap invisible to it is how this one shipped.
 */
import { describe, it, expect } from 'vitest'
import { humaniseCritique, codesRenderingUnresolvedLabel } from '../humaniseCritique'

/** The sentinel, spelled here deliberately: this spec must fail if the source
 *  renames it and quietly keeps printing something equivalent. */
const UNRESOLVED_SENTINEL = 'This factor'

/**
 * The exact set still interpolating the sentinel, DERIVED BY EXECUTION at
 * 6497a251 (not grepped, not hand-listed). Each is a separate increment; none
 * is reachable through the canvas Question card, which renders only
 * `LEADER_WITHHOLDING_CODES` (`withheldLeaderDisclosure.ts`) — a set whose sole
 * member is the code this PR fixes.
 */
const KNOWN_STILL_INTERPOLATING = [
  'CONSTRAINT_DIRECTION_ASSUMED',
  'CONSTRAINT_DIRECTION_SUSPECT',
  'CONSTRAINT_MISSING_RANGE',
  'CONSTRAINT_MISSING_VALUE',
  'CONSTRAINT_OUT_OF_DOMAIN',
  'CONSTRAINT_TARGET_NO_OBSERVED_VALUE',
  'INBOUND_STRENGTH_SUM_EXCEEDED',
  'MISSING_OBSERVED_STATE',
] as const

/** The measured warning, reproduced exactly: no `affectedNodes`, no label map. */
const UNRESOLVABLE_TARGET_UNRELIABLE = {
  code: 'CONSTRAINT_TARGET_UNRELIABLE',
  message:
    'The target on "Budget Overrun Risk" can\'t be scored against this model: goal-fit probabilities were withheld for this run rather than shown.',
}

describe('an unresolved label is not a name', () => {
  it('does not print the unresolved sentinel when the warning carries no node identity', () => {
    const got = humaniseCritique(UNRESOLVABLE_TARGET_UNRELIABLE)

    // PRECONDITION, pinned in-test so this cannot pass by the fixture failing to
    // reach the template at all (a guard that agrees with itself).
    expect(got.title.length).toBeGreaterThan(0)
    expect(got.description.length).toBeGreaterThan(0)

    expect(got.title).not.toContain(UNRESOLVED_SENTINEL)
    expect(got.suggestion).not.toContain(UNRESOLVED_SENTINEL)
    expect(got.description).not.toContain(UNRESOLVED_SENTINEL)
  })

  it('asserts no node kind in the anonymous form — the measured target was a risk, not a factor', () => {
    const got = humaniseCritique(UNRESOLVABLE_TARGET_UNRELIABLE)
    expect(got.title.toLowerCase()).not.toContain('factor')
    expect(String(got.suggestion).toLowerCase()).not.toContain('factor')
  })

  it('prescribes no move the engine says does nothing — named or not', () => {
    // ⛔ REVERSED, 26 Sep 2026 (AI Quality, #70 5843266323: the wire cannot tell a missing value from an uncheckable target, and on Paul's churn limit PLoT said a value "would not change that"). This row used to require the
    // "set a current value or range" remedy; on Paul's churn limit that move was
    // inert, and the entry carries no field that says when it would work.
    const got = humaniseCritique(UNRESOLVABLE_TARGET_UNRELIABLE)
    expect(got.suggestion).toBe('')
    expect(got.description.toLowerCase()).not.toContain('missing')
  })

  it('POSITIVE CONTROL: a resolvable label still produces the named form, unchanged', () => {
    const got = humaniseCritique(
      { ...UNRESOLVABLE_TARGET_UNRELIABLE, affectedNodes: ['dac3fdc3'] },
      new Map([['dac3fdc3', 'Budget Overrun Risk']]),
    )
    expect(got.title).toBe("The limit on Budget Overrun Risk can't be checked reliably")
    expect(got.suggestion).toBe('')
    // Non-vacuity: the named and anonymous forms must actually DIFFER, or the
    // first three assertions are satisfied by a template that never branched.
    expect(got.title).not.toBe(humaniseCritique(UNRESOLVABLE_TARGET_UNRELIABLE).title)
  })

  it('pins the EXACT remaining set of templates that still interpolate the sentinel', () => {
    const offenders = codesRenderingUnresolvedLabel()

    // Non-vacuity floor: a derivation that returns nothing would satisfy a
    // subset check while proving the probe blind.
    expect(offenders.length).toBeGreaterThan(0)

    // Exact, in both directions: REDs if the set grows OR shrinks.
    expect([...offenders]).toEqual([...KNOWN_STILL_INTERPOLATING])

    // The code this PR fixes must NOT be in it — the instance arm and the class
    // arm have to agree, or one of them is measuring the wrong thing.
    expect(offenders).not.toContain('CONSTRAINT_TARGET_UNRELIABLE')
  })

  it('CONTRAST CONTROL: the derivation can see an offender, so its exclusions mean something', () => {
    // MISSING_OBSERVED_STATE genuinely interpolates the sentinel today. If this
    // ever stops being true without KNOWN_STILL_INTERPOLATING changing, the
    // derivation has gone blind rather than the code having improved.
    const stillBroken = humaniseCritique({ code: 'MISSING_OBSERVED_STATE', message: '' })
    expect(stillBroken.title).toContain(UNRESOLVED_SENTINEL)
  })
})
