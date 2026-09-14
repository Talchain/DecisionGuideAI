/**
 * The `*_NOT_CONVERTIBLE` family may not blame the user's TARGET.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE MEASURED DEFECT
 * ─────────────────────────────────────────────────────────────────────────
 * Fresh-guest drive of `https://staging--olumi.netlify.app`, Netlify deploy
 * `6aa1fdec0d71200008252154` = UI commit `9eb30b54`, 2026-09-10T02:05:56Z,
 * executing bundle bound to `/version.json` and to the deploy-pinned asset by
 * sha256. The Reasoning tab (`AnalysisNewTabBody` -> `InferenceWarningStrip`)
 * rendered, within three lines of each other:
 *
 *   "Your goal's target couldn't be measured for this run. State the current
 *    level for your goal."
 *   grow monthly recurring revenue to at least £250k by March
 *   Options 3 · Factors 3 · Risks 1 · Outcomes 1
 *   "Target £250,000 · From brief · Change"
 *
 * The same turn's wire carried `goal_threshold_raw: 250000`,
 * `goal_threshold_unit: "£"` and
 * `analysis_admission.semantic_signals.goal_target_stated: true`. The target
 * was captured; the tab displayed it three lines below the sentence denying
 * it had been measured.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE PRODUCER'S TRUTH CONDITION, DERIVED AT THE BYTES — NOT FROM THE CODE
 * NAME AND NOT FROM THE SENTENCE
 * ─────────────────────────────────────────────────────────────────────────
 * ISL `staging` 7781ca4fdee93e550a9c3cc7b7e2a0bb5141bcf1 (2026-09-01),
 * `src/services/robustness_analyzer_v2.py`.
 * `_resolve_goal_threshold_in_sample_frame` (:3682) injects a `refuse` closure
 * (:3763-3782) into the shared rule engine `_resolve_threshold_in_sample_frame`
 * (:3818), whose nine `refuse(...)` sites are the complete domain. Enumerated
 * from those sites plus the `reasons=` mapping dict at :3804-3811 — from the
 * construction sites, never from a literal grep of the code name:
 *
 *   1. goal_node_missing                          :3922  graph identity   (API-unreachable)
 *   2. goal_pinned_by_intervention                :3932  model structure
 *   3. root_goal                                  :3944  model structure
 *   4. goal_parameter_uncertainty_shifts_base     :3956  model structure
 *   5. missing_goal_baseline                      :3970  ⭐ NO CURRENT LEVEL
 *   6. non_finite_conversion_input                :3995  instrument       (API-unreachable)
 *   7. goal_values_outside_normalised_domain      :4027  target received, wrong scale
 *   8. epsilon_breaks_status_quo_reference        :4076  sampling coherence
 *   9. auto_scaled_noise_breaks_status_quo_reference :2218 sampling (flag-off by default)
 *
 * ⭐⭐ NOT ONE OF THE NINE MEANS "THE TARGET WAS NOT CAPTURED", AND THE
 * PRODUCER MAKES THAT STRUCTURAL RATHER THAN INCIDENTAL. The resolver opens
 * (:3745-3749) with:
 *
 *     threshold = request.goal_threshold
 *     if threshold is None:
 *         # No goal threshold requested: nothing to convert, nothing to disclose.
 *         return None, None
 *
 * so a MISSING target emits NO warning at all — pinned producer-side by
 * `test_no_threshold_requested_is_silent`
 * (ISL `tests/unit/test_goal_threshold_frame.py:506-517`, "Control on the
 * control: no threshold => no probability AND no warning"). An UNPARSEABLE
 * target cannot reach the resolver either: `goal_threshold: Optional[float]`
 * (`src/models/robustness_v2.py:902`) is Pydantic-validated. Every refusal
 * therefore fires WITH the user's number in hand and echoes it back in
 * `detail["goal_threshold"]` (the shared detail dict, :3755-3761).
 *
 * ⭐ SO THIS IS ONE HARM, NOT TWO. The question "can this sentence also fire
 * when there genuinely is no target?" is answered NO by construction, so the
 * copy does not have to cover both cases and there is nothing to name apart
 * (CLAUDE.md trap 21). It may presuppose a target — that presupposition is
 * true on every reachable path.
 *
 * ⚠ AND THE EIGHT REACHABLE REASONS ARE INDISTINGUISHABLE ON THIS SIDE OF THE
 * WIRE. The UI's `InferenceWarning` (`components/results/types.ts:985-1000`)
 * carries `code`, `field`, `affected_nodes`, `affected_labels`, `message`,
 * `severity` — and no `detail`, so no `reason`. One code, one sentence, and it
 * has to be true of all eight. Forwarding `detail.reason` is a PLoT-side
 * change and is deliberately not attempted here.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT THIS PINS, AND WHY IT IS SHAPED THIS WAY
 * ─────────────────────────────────────────────────────────────────────────
 * The invariant is written against the PRODUCER'S SPEC — "the target is in
 * hand; what could not be established is where the goal stands today" — and
 * NOT against the one sentence that violated it (CLAUDE.md trap 13d: an
 * invariant written with the same asymmetry as the code it tests is a guard
 * agreeing with itself). Two complementary halves, because a negative alone
 * is satisfiable by saying nothing:
 *
 *   (a) NEGATIVE — the copy may not attribute the refusal to the target
 *       having gone unmeasured/uncaptured/unread. False for all eight.
 *   (b) POSITIVE — the copy must locate the missing quantity at the
 *       subject's CURRENT STANDING, which is what is actually absent or
 *       unusable in every reachable reason.
 *
 * The family is enumerated from the exported `ISL_INFERENCE_WARNING_KINDS`
 * map, so a third `*_NOT_CONVERTIBLE` code inherits the guard automatically.
 *
 * ⭐ THE FAMILY IS ITS OWN CONTRAST CONTROL. `CONSTRAINT_NOT_CONVERTIBLE` —
 * the per-constraint twin, which `humaniseCritique.ts` records as running on
 * the SAME producer rules — already satisfies both halves ("couldn't be
 * compared with where its factor stands today … State that factor's current
 * level"). So this file goes RED for `GOAL_THRESHOLD_NOT_CONVERTIBLE` and
 * GREEN for its twin: the assertion is demonstrably discriminating, not merely
 * failing.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ WHICH HALF STILL BITES AFTER #1427 LANDED, STATED HONESTLY
 * ─────────────────────────────────────────────────────────────────────────
 * This branch was written against `9eb30b54`, where BOTH halves went red on
 * the served sentence. #1427 then merged and removed the false attribution, so
 * the two halves no longer bite equally and it would be dishonest to keep
 * implying they do:
 *
 *   · NEGATIVE half — no longer red at the current base. Its discriminating
 *     power is proven instead by the positive control below, which pins the
 *     sentence the build ACTUALLY SERVED on `9eb30b54`. Going forward it is a
 *     regression guard: the attribution cannot come back unnoticed.
 *   · POSITIVE half — STILL RED at the current base, and this is what the
 *     branch now buys. Measured: #1427's title, "Your goal's target was
 *     recorded, but this run couldn't measure fit against it, so goal-fit
 *     results were withheld rather than guessed", does NOT satisfy
 *     `NAMES_CURRENT_STANDING`. It is true and it names no missing quantity,
 *     so the reader learns that something failed and never learns what. The
 *     title here keeps #1427's capture fact and adds the one thing the wire
 *     supports about the cause: the comparison against where the goal stands.
 *
 * ⛔ AND THE PRESCRIPTION STAYS OUT. This branch originally preserved
 * "State the current level for your goal" and pinned it by exact equality.
 * That pin is removed (see the identity test at the bottom): nothing in the UI
 * writes a goal node's `observed_state.baseline`, so the instruction had no
 * producer. A separate check found `SuccessTargetLine.tsx` does write a goal
 * TARGET through `setGoalThresholdAndUpdateNode` — a different field — and
 * even that does not survive a reload, because `clientCanWriteReadableGraph()`
 * returns a hardcoded `false` (`src/lib/clientGraphWritePolicy.ts:55`).
 * Neither fact makes the removed instruction reachable.
 */
import { describe, it, expect } from 'vitest'
import { humaniseCritique, ISL_INFERENCE_WARNING_KINDS } from '../humaniseCritique'
import type { UncertaintyItem } from '../../types'

/**
 * The family, DERIVED from the exported classification map rather than listed
 * here. `ISL_INFERENCE_WARNING_KINDS` is the repo's enumeration of the ISL
 * vocabulary; taking the suffix from it means a code added to that map is
 * covered without anyone remembering to extend this file.
 */
const NOT_CONVERTIBLE_CODES = Object.keys(ISL_INFERENCE_WARNING_KINDS)
  .filter((code) => code.endsWith('_NOT_CONVERTIBLE'))
  .sort()

/**
 * (a) THE FALSE ATTRIBUTION, AS A SHAPE.
 *
 * Deliberately a shape and not the offending sentence: pinning
 * "Your goal's target couldn't be measured for this run" would be vacuous the
 * moment anyone rewords it, and would certify nothing about honesty.
 *
 * It matches a claim that the TARGET (or threshold) was not
 * measured/captured/read/received/recorded/provided/found/set — the class of
 * claim that is false for all nine producer reasons. It deliberately does NOT
 * match "could not be COMPARED / CONVERTED / RESOLVED / USED", which are the
 * true claims: the number arrived and could not be placed against anything.
 *
 * ⭐⭐ IT BINDS THE VERB TO THE TARGET AS ITS SUBJECT, STRUCTURALLY — AND THE
 * FIRST DRAFT OF THIS GUARD DID NOT, WHICH THE FAMILY'S OWN CONTRAST CONTROL
 * CAUGHT AT PRISTINE. That draft ran `\b(target|threshold)\b[^.]*<negation>
 * [^.]*<verb>`, and it flagged `CONSTRAINT_NOT_CONVERTIBLE`'s description —
 * "The target could not be resolved into its factor's measurement frame — for
 * example when no current level is RECORDED for it" — which is TRUE and is the
 * very sentence this repair holds up as correct. `[^.]*` let a later clause's
 * verb attach to an earlier "target"; the em-dash is not a full stop, so the
 * span never closed. A guard that condemns the model answer is a guard that
 * would have blocked the fix.
 *
 * The repair is structural rather than a distance cap: at most two filler
 * words between the noun and its negation, then the verb DIRECTLY after an
 * optional `be`/`been`. That is what "the target could not be measured" is and
 * what "…no current level is recorded" is not. ⚠ Deliberately NOT a character
 * budget — CLAUDE.md trap 22f is explicit that arbitrary length constants with
 * hard cliffs are how a predicate over natural language starts oscillating,
 * and a cap tuned to pass today's two sentences would be exactly that.
 */
const TARGET_BLAMED_AS_MISSING =
  /\b(?:target|threshold)s?\b(?:\s+\w+){0,2}?\s+(?:could ?n[o']t|can ?n[o']t|cannot|was ?n[o']t|were ?n[o']t|is ?n[o']t|are ?n[o']t|has ?n[o']t|have ?n[o']t|never)\s+(?:be\s+|been\s+|being\s+)?(?:measured|captured|read|received|recorded|provided|supplied|found|set|stated|given|detected)\b/i

/**
 * (b) THE TRUE SUBJECT OF THE REFUSAL.
 *
 * Every reachable reason is a failure to establish, or to trust, WHERE THE
 * SUBJECT STANDS NOW — the baseline (5), the frame that baseline lives in
 * (2, 3, 4, 7), or the status-quo reference the comparison rests on (8, 9).
 * The copy has to name that, or the reader has no way to know what is wrong.
 */
/**
 * ⚠ THE BARE `today` ALTERNATE IS DELIBERATELY GONE (review F4, measured).
 * With it, "Goal fit could not be computed today" and "Results were withheld
 * rather than guessed today." both satisfied this half, so a future reword
 * naming nothing about current standing would have passed the positive test
 * by accident. The four remaining alternates all carry the meaning; the
 * controls below pin the two sentences that used to slip through.
 */
const NAMES_CURRENT_STANDING = /\b(current level|stands today|stands now|where it stands)\b/i

function humanise(code: string) {
  return humaniseCritique({ code, message: 'raw producer prose — must never render' } as UncertaintyItem)
}

describe('the guard itself discriminates (positive control)', () => {
  /**
   * CLAUDE.md trap 13: a test proving an ABSENCE is worth nothing until it has
   * proved it can see a PRESENCE. And trap 13b: a discriminator must PIN ITS
   * OWN PRECONDITION in-test, or a later reword can quietly reduce it to a
   * regex that matches nothing and stays green forever.
   *
   * ⚠ THE FIRST STRING BELOW IS A HISTORIC RECORD — the sentence this build
   * actually served on Netlify deploy `6aa1fdec0d71200008252154` at
   * 2026-09-10T02:05:56Z. It is quoted here, not edited anywhere: it is
   * evidence of what was emitted, and rewriting it to match today's copy would
   * falsify why this file exists (CLAUDE.md 14b).
   */
  const SERVED_ON_9eb30b54 =
    "Your goal's target couldn't be measured for this run. State the current level for your goal."

  it('matches the false attribution that was live on the deployed build', () => {
    expect(SERVED_ON_9eb30b54).toMatch(TARGET_BLAMED_AS_MISSING)
  })

  it('does NOT match a true sentence in which the missing thing is the current level', () => {
    // The discrimination that matters, and the case that refuted this guard's
    // first draft. "target" appears, a negation appears, "recorded" appears —
    // and the sentence is correct, because the thing not recorded is the
    // CURRENT LEVEL, not the target.
    expect(
      "The target could not be resolved into its factor's measurement frame — for example when no current level is recorded for it.",
    ).not.toMatch(TARGET_BLAMED_AS_MISSING)
    // ⭐ APPENDED 10 Sep 2026, not edited. The line above is the sentence that
    // refuted this guard's first draft, quoted verbatim in the header; it is a
    // record and stays (CLAUDE.md trap 14b). The em dash was removed from the
    // product copy on the same day, so the sentence a user now reads is the one
    // below — and the discrimination has to hold for THAT one, which is a
    // stronger test: its full stop closes the `[^.]*` span the first draft
    // relied on staying open, so a future guard could pass here for the wrong
    // reason. Both are asserted; neither replaces the other.
    expect(
      "The target could not be resolved into its factor's measurement frame, for example when no current level is recorded for it.",
    ).not.toMatch(TARGET_BLAMED_AS_MISSING)
  })

  it('does NOT match a true sentence about comparison or conversion failing', () => {
    expect("Your goal's target couldn't be compared with where the goal stands today.").not.toMatch(
      TARGET_BLAMED_AS_MISSING,
    )
    expect('The threshold could not be converted into the goal samples\' frame.').not.toMatch(
      TARGET_BLAMED_AS_MISSING,
    )
  })

  it('the current-standing guard is not satisfied by silence', () => {
    // Its own positive control: the property must be capable of failing.
    expect('Part of this analysis was limited').not.toMatch(NAMES_CURRENT_STANDING)
    expect("Your goal's target was recorded, but it couldn't be compared with where the goal stands today.").toMatch(
      NAMES_CURRENT_STANDING,
    )
  })

  it('the current-standing guard is not satisfied by a bare time word (review F4)', () => {
    // The two sentences the reviewer measured as slipping through the earlier
    // `today` alternate. Neither names where the goal stands, so neither may
    // satisfy the positive half. Without these the fix to the regex could be
    // reverted with nothing going red.
    expect('Goal fit could not be computed today').not.toMatch(NAMES_CURRENT_STANDING)
    expect('Results were withheld rather than guessed today.').not.toMatch(NAMES_CURRENT_STANDING)
  })
})

describe('the *_NOT_CONVERTIBLE family names the baseline, never the target', () => {
  it('derives a non-empty family from the exported ISL vocabulary map', () => {
    // Guard on the guard: an empty `it.each` table is a silently vacuous file
    // (CLAUDE.md trap 13 — an absence assertion that never runs).
    expect(NOT_CONVERTIBLE_CODES.length).toBeGreaterThanOrEqual(2)
    expect(NOT_CONVERTIBLE_CODES).toContain('GOAL_THRESHOLD_NOT_CONVERTIBLE')
    expect(NOT_CONVERTIBLE_CODES).toContain('CONSTRAINT_NOT_CONVERTIBLE')
  })

  it.each(NOT_CONVERTIBLE_CODES)(
    '%s does not claim the user\'s target went unmeasured',
    (code) => {
      // FALSE FOR ALL NINE PRODUCER REASONS. ISL emits this family only with
      // `request.goal_threshold` in hand — a missing threshold returns
      // `(None, None)` and discloses nothing at all
      // (robustness_analyzer_v2.py:3745-3749).
      const { title, description } = humanise(code)
      expect(title).not.toMatch(TARGET_BLAMED_AS_MISSING)
      expect(description).not.toMatch(TARGET_BLAMED_AS_MISSING)
    },
  )

  it.each(NOT_CONVERTIBLE_CODES)(
    '%s locates the gap at where the subject stands today',
    (code) => {
      // The positive half. Without it, (a) is satisfiable by copy that names
      // nothing at all, which is how a caveat becomes a dead end.
      const { title } = humanise(code)
      expect(title).toMatch(NAMES_CURRENT_STANDING)
    },
  )

  it.each(NOT_CONVERTIBLE_CODES)(
    '%s still states the withhold rather than implying a computed answer',
    (code) => {
      // The producer is fail-closed and says so three times
      // (:3735-3739, :3866-3869, and `robustness_v2.py:939-942`: "ISL never
      // guesses a frame and never emits a fabricated or clamped probability").
      // A caveat that omits the withhold reads as "your number is wrong"
      // rather than "no number was produced".
      const { title } = humanise(code)
      expect(title).toMatch(/withheld|not shown|left out/i)
    },
  )

  it('binds to the goal code by identity, not to whatever the family happens to contain', () => {
    // IDENTITY BINDING (CLAUDE.md trap 19). The `it.each` rows above pass if
    // the family is right AS A SET; this asserts the specific member the
    // measured defect lived on, so deleting `GOAL_THRESHOLD_NOT_CONVERTIBLE`
    // from the template map cannot leave this file green.
    const { title, description, suggestion, displayText } = humanise('GOAL_THRESHOLD_NOT_CONVERTIBLE')
    expect(title).not.toMatch(TARGET_BLAMED_AS_MISSING)
    expect(title).toMatch(NAMES_CURRENT_STANDING)
    // Goal-scoped, not the generic fallback and not the factor-framed twin.
    expect(title.toLowerCase()).toContain('goal')
    expect(title).not.toBe('Part of this analysis was limited')
    // ⛔ REVIEW F2, REPAIRED. This line used to be
    //     expect(suggestion).toBe('State the current level for your goal')
    // an exact-equality pin on a prescription with NO PRODUCER: nothing in the
    // UI writes a goal node's `observed_state.baseline`
    // (`useInspectorMutations.ts:428` `setObservedBaseline` has three callers,
    // all factor-scoped). The pin defended the defect against the repair that
    // landed on #1427. The template now prescribes nothing, and the reason for
    // that absence is pinned to its CAUSE, not to a literal, in
    // `results/__tests__/goalThresholdNoUnreachableInstruction.spec.ts` - it
    // REDs the day a goal editor gains an `observed_state` writer, and that red
    // is the signal to restore the instruction.
    expect(suggestion).toBeUndefined()
    expect(description).toMatch(/withheld/i)
    // Banner-eligible: no internal token tripped by the new wording.
    expect(displayText).toBe(title)
  })
})
