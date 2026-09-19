/**
 * ⛔ CORRECTING MY OWN MERGED #1618. The cause sentence it shipped asserted
 * more than the producer's token means, and the producer had written the rule
 * down.
 *
 * ## What #1618 shipped
 *
 * `constraint_verdict_withheld` → *"One limit on your model could not be
 * checked, which is why no option is named here."*
 *
 * That sentence was taken from CEE's own prose summary on run `1dd2133d`. It
 * was true OF THAT RUN. It is not what the token means.
 *
 * ## What the token actually means, read at CEE `staging`
 *
 * `orchestrator-v5/compose/analysis-state-v1.ts:773` —
 *
 * ```ts
 * claim.withheld_reason = !entitled ? WITHHELD_CONSTRAINT_VERDICT : …
 * ```
 *
 * so the token is emitted for **any** `mayNameLeadingOption !== true`. And
 * `orchestrator/context/constraint-feasibility.ts:341-349` maps THREE distinct
 * states to `false`:
 *
 * | state | what actually happened |
 * |---|---|
 * | `evaluated_infeasible` | the producer scored the constraints and **the leading option breaks one** |
 * | `unevaluated` | a ratified constraint **was not checked** |
 * | `identity_unresolved` | the constraint ids could not be matched |
 *
 * The producer's own comment on `unevaluated` is explicit: *"'Your condition was
 * not checked' is assertable HERE AND NOWHERE ELSE."* #1618 asserted it for all
 * three — so a correctly evaluated over-budget result was told its limit could
 * not be checked. The producer wrote the rule and the consumer broke it.
 *
 * This is trap 13c: a mutant kit validates SENSITIVITY, never CORRECTNESS. All
 * four of #1618's mutants bit. The oracle was wrong, and a full kill rate
 * against a wrong oracle is a perfect score on the wrong exam.
 *
 * ## What is true across all three, and is what ships
 *
 * The constraint verdict did not support naming one — with no claim about
 * whether the check ran. The precise state is NOT on the wire: `analysis_state`
 * carries `run_state`, `readiness`, `leader_claim`, `robustness`, the three
 * usability flags, `requires_rerun`, `blocked_unusable` and `contradictions`,
 * and no constraint-verdict state. So a precise cause needs CEE to emit one;
 * it cannot be derived here, and guessing is what this corrects.
 *
 * ## The second finding, also the producer's own documented guard
 *
 * The lookup was a bare index read. `analysis-state-v1.ts:255-270` documents
 * exactly this hazard for exactly this kind of map and states the remedy —
 * `Object.prototype.hasOwnProperty.call` — adding that *"new code diverging
 * from it is how one subsystem ends up with two answers to one question"*.
 * `withheld_reason` is free-form `z.string()` at the contract, so a producer
 * token of `'toString'` is admissible and returned a prototype member through
 * a `?? null` that never fired.
 */

import { describe, it, expect } from 'vitest'

import { leaderWithholdCause } from '../analysisNewCopy'

describe('leaderWithholdCause — the cause may not outrun the producer', () => {
  it('states a cause for the one token this estate has evidenced', () => {
    expect(leaderWithholdCause('constraint_verdict_withheld')).not.toBeNull()
  })

  it('does not claim the limit went unchecked, which is true of only one of the three states', () => {
    const sentence = leaderWithholdCause('constraint_verdict_withheld') ?? ''
    expect(sentence).not.toMatch(/could not be checked/i)
    expect(sentence).not.toMatch(/was not checked/i)
    expect(sentence).not.toMatch(/unchecked/i)
  })

  it('does not assert the opposite either, that a limit was broken', () => {
    // `unevaluated` and `identity_unresolved` also carry this token, and on
    // those nothing was scored. A sentence naming a breach would be the same
    // defect with the sign flipped (trap 22b).
    const sentence = leaderWithholdCause('constraint_verdict_withheld') ?? ''
    expect(sentence).not.toMatch(/breaks?\b/i)
    expect(sentence).not.toMatch(/exceeds?\b/i)
    expect(sentence).not.toMatch(/violat/i)
  })

  it('names the limits as the reason, so the clause is about something', () => {
    const sentence = leaderWithholdCause('constraint_verdict_withheld') ?? ''
    expect(sentence).toMatch(/limit/i)
  })

  it('returns null for an inherited key, not a prototype member', () => {
    // `withheld_reason` is `z.string().optional()` at the contract — free form —
    // so these are admissible producer tokens, not hypotheticals.
    expect(leaderWithholdCause('constructor')).toBeNull()
    expect(leaderWithholdCause('toString')).toBeNull()
    expect(leaderWithholdCause('__proto__')).toBeNull()
    expect(leaderWithholdCause('hasOwnProperty')).toBeNull()
    expect(leaderWithholdCause('valueOf')).toBeNull()
  })

  it('still returns null for an ordinary unminted token, and for absence', () => {
    // ⚠ `separation_unavailable` was this arm's first example and MOVED, because
    // bundle `b3d5806d` (19 Sep 14:32Z) carried it on a real run and the map's
    // own rule is that it grows when a capture earns the entry. The arm keeps
    // its job with tokens no run has produced — what it discriminates is
    // unchanged, so the case stays and only the example moved.
    expect(leaderWithholdCause('options_do_not_separate')).toBeNull()
    expect(leaderWithholdCause('a_token_no_capture_has_shown')).toBeNull()
    expect(leaderWithholdCause('')).toBeNull()
    expect(leaderWithholdCause(null)).toBeNull()
    expect(leaderWithholdCause(undefined)).toBeNull()
  })
})

/**
 * ⭐ `separation_unavailable` EARNED ITS ENTRY — bundle `b3d5806d`, staging
 * `fd65f971`, 19 Sep 2026 14:32Z, on a real user's run:
 *
 *   leader_claim: { permitted: false, withheld_reason: "separation_unavailable" }
 *
 * The map's own rule was "it grows when a capture earns the entry". This is that
 * capture, and these arms pin the ONE hazard the old note named.
 */
describe('separation_unavailable, now wire-witnessed', () => {
  it('⛔ states what THE RUN did, never what the OPTIONS are', () => {
    const clause = leaderWithholdCause('separation_unavailable')
    expect(clause, 'the producer token is mapped now that a capture earned it').not.toBeNull()

    // ⚠ THE HAZARD THE OLD NOTE NAMED: "could not be told apart" sits too close
    // to "the options are level", which the sentence beside this one DENIES.
    // A withheld verdict is not entitled to a finding about the options.
    for (const banned of ['level', 'equal', 'the same', 'tied', 'no difference', 'indistinguishable']) {
      expect(
        clause!.toLowerCase(),
        `"${banned}" would make this a claim about the OPTIONS, not about this run`,
      ).not.toContain(banned)
    }
  })

  it('names the run as the subject, so the reader knows what is provisional', () => {
    expect(leaderWithholdCause('separation_unavailable')!.toLowerCase()).toContain('this run')
  })

  it('⛔ an unseen token is still unmapped — the rule did not become "map everything"', () => {
    expect(
      leaderWithholdCause('some_reason_no_capture_has_shown'),
      'a map that guessed at unseen tokens is the fabrication this panel refuses',
    ).toBeNull()
  })

  it('the earlier entry is untouched', () => {
    expect(leaderWithholdCause('constraint_verdict_withheld')).toContain('limits you set')
  })
})
