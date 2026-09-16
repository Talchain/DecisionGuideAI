/**
 * THE ACTIONS MENU NAMED A LEADER THE RUN HAD REFUSED TO NAME.
 *
 * `actionsCatalogue.ts:113-114` carried, twice:
 *
 *   'Build the strongest case against the option that scored highest.'
 *
 * `METHOD_CATALOGUE` is a module-level constant and `ActionsMenu()` takes NO
 * PROPS (`ActionsMenu.tsx:32`), so every string in it renders on every run —
 * including one whose producer declined to put an option forward
 * (`leader_claim.permitted: false`, measured on Paul's runs `1dd2133d` and
 * `f51850fc`). It is mounted on the Reasoning tab at
 * `AnalysisNewTabBody.tsx:85` and on the overview card at
 * `DecisionOverviewCard.tsx:679`.
 *
 * ⛔ THE ESTATE HAD ALREADY BANNED THIS EXACT SENTENCE — SOMEWHERE ELSE.
 * `ownedLeaderClaim.strengthen.spec.tsx:268` asserts a withheld run's
 * recommendations do NOT contain
 * `'Build the strongest case against the option that scored highest.'`, and
 * `buildRecommendations.ts:715-726` carries the ruling in full: the unnamed arm
 * "addresses the RESULT, never the RANKING", and *"what it must NOT do is fall
 * back to 'the option that scored highest': that is the defect, not the
 * fallback."*
 *
 * The remedy was scoped to `strengthen/`. The identical string sat in
 * `decision-overview/`, invisible to a spec bound to the other directory.
 * That is this estate's most-recorded failure class: the remedy scoped to the
 * instance, with nothing sweeping its siblings.
 *
 * ## Why the copy changes rather than the entry being gated
 *
 * Gating would need props threaded into a component that takes none, and it
 * would DELETE a good method from every withheld run — "Consider the opposite"
 * is worth offering whether or not a leader was named. Rewriting removes the
 * claim and keeps the method. It is also the remedy the estate already chose
 * for its own unnamed arm: address the result, never the ranking.
 *
 * ⚠ WHAT IS GIVEN UP, STATED. On a run entitled to name a leader, "the option
 * that scored highest" was more specific. The trade is deliberate: a small loss
 * of specificity where a claim is licensed, against a false claim where it is
 * not (trap 22b — the two harms are not symmetric and must not share a
 * parameter). CEE holds the full model and can name the leader itself where it
 * is entitled to.
 *
 * ## Scope of this guard
 *
 * It applies to THIS catalogue only, and the reason is structural rather than
 * stylistic: these strings are unconditioned by construction. A surface that
 * reads the leader claim may legitimately name a leader, and banning the phrase
 * there would delete licensed material.
 */

import { describe, it, expect } from 'vitest'

import { METHOD_CATALOGUE, GLOBAL_ACTIONS, REVIEW_BRIEF_ASK } from '../actionsCatalogue'

/**
 * Phrases that assert a ranking outcome. Each is already banned elsewhere in
 * the estate on a withheld run; here they are banned unconditionally, because
 * nothing in this module can consult the claim.
 */
const LEADER_CLAIMS: ReadonlyArray<RegExp> = [
  /the option that scored highest/i,
  /the (?:current )?leading option\b/i,
  /the leading options\b/i,
  /\bthe winner\b/i,
  /\bthe best option\b/i,
  /\bthe top option\b/i,
]

function stringsOf(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) for (const v of value) stringsOf(v, out)
  else if (value !== null && typeof value === 'object')
    for (const v of Object.values(value)) stringsOf(v, out)
  return out
}

describe('the actions catalogue names no leader', () => {
  const all = [
    ...stringsOf(METHOD_CATALOGUE),
    ...stringsOf(GLOBAL_ACTIONS),
    ...stringsOf(REVIEW_BRIEF_ASK),
  ]

  it('pins its own precondition: the catalogue was read and is not empty', () => {
    // An empty corpus would pass every ban below while proving nothing — an
    // absence assertion with no positive control (trap 13).
    expect(METHOD_CATALOGUE.length).toBeGreaterThanOrEqual(5)
    expect(all.length).toBeGreaterThanOrEqual(20)
  })

  it('pins the contrast: the patterns DO fire on the sentence that shipped', () => {
    // Without this the ban could be passing because the regexes match nothing
    // at all. The historical string is the positive control, quoted verbatim.
    const shipped = 'Build the strongest case against the option that scored highest.'
    expect(LEADER_CLAIMS.some((p) => p.test(shipped))).toBe(true)
  })

  it('makes no unconditioned leader claim in any catalogue string', () => {
    const offenders = all.filter((s) => LEADER_CLAIMS.some((p) => p.test(s)))
    expect(offenders).toEqual([])
  })

  it('keeps the method itself: "Consider the opposite" is still offered', () => {
    // The fix must not be a deletion. The entry stays; only the claim goes.
    const entry = METHOD_CATALOGUE.find((m) => m.id === 'consider_opposite')
    expect(entry).toBeDefined()
    expect(entry!.prompt.length).toBeGreaterThan(0)
  })
})
