/**
 * goalAnchorCopy — THE house registers for the two questions every
 * comparative surface must anchor to (Paul's ruling, 2026-07-31).
 *
 *   (A) "which option is most likely to achieve MY GOAL"  → backed by
 *       `OptionResult.goalProbability` (the producer's goal-attainment
 *       quantity, chosen by `selectGoalProbability`).
 *   (B) "what is most likely to happen"                    → backed by
 *       `OptionResult.outcome.p50`, already labelled "Most likely outcome"
 *       across the panel; no new register needed here.
 *   (C) the COMPARATIVE quantity (`winProbability`) is NEITHER of those —
 *       it is the share of Monte-Carlo runs in which an option out-ranked
 *       the others. It keeps its place, DEMOTED below the goal number, and
 *       it must always be described by what it measures.
 *
 * Un-anchored forms — bare "win probability", endorsement nouns, bare
 * superlatives — are retired. This module exists so the replacement copy
 * lives in ONE place rather than being re-typed at fifteen render sites.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE POSSESSIVE GATE — the reason every A-register function takes a flag
 * ─────────────────────────────────────────────────────────────────────────
 * `selectGoalProbability` publishes `basis`. When it is
 * `'joint_goal_substituted'` the number is P(all constraints jointly
 * satisfied) STANDING IN for an absent goal probability — it answers a
 * DIFFERENT question from the one "your goal" asserts, and the selector's
 * `mayUsePossessiveGoalFraming` is false. `OptionResult` already carries the
 * decision as `goalFitIsSubstitutedJoint` (set from that basis in
 * `useResultsSectionData`, never re-derived at a render site), so every
 * caller here passes it straight through.
 *
 * The two permitted registers ALREADY SHIPPED, as `HERO_COPY.detail.goalFit`
 * and `HERO_COPY.detail.goalFitJointBasis`. Their wording is unchanged and it
 * now lives HERE, with `heroCopy` delegating to `sentence()` — so there is
 * exactly one copy of each sentence in the repo and every surface reads the
 * same one.
 *
 * ⚠ THE DIRECTION OF THAT DELEGATION IS LOAD-BEARING. It was written the
 * other way first (this module importing `HERO_COPY`) and `heroCopy` also
 * needs `COMPARATIVE_COPY` for its own comparative lines — which made the two
 * modules a cycle, and nine hero specs failed at COLLECTION rather than on an
 * assertion. This module is therefore a LEAF: it imports nothing. Do not add
 * an import here.
 *
 * `phrase()` is the same wording without the full stop, for compact readouts
 * that are not sentences; `goalAnchorCopy.spec.ts` pins
 * `sentence === phrase + '.'` so the two cannot drift — a derived guard, not
 * a hand-maintained mirror (CLAUDE.md trap 12).
 *
 * ⚠ Do not invent a third A-register. If a surface needs wording these two
 * do not cover, the fix is upstream in `selectGoalProbability`'s basis, not
 * a new string here.
 */

/**
 * The A-register: goal attainment per option, in the two permitted voices.
 *
 * `isSubstitutedJoint` is `OptionResult.goalFitIsSubstitutedJoint` — true
 * ⇔ `selectGoalProbability(...).basis === 'joint_goal_substituted'`. Passing
 * `true` withholds the possessive; passing `false` permits it. There is no
 * third value and no default: a caller that does not know the basis must not
 * be rendering this copy.
 */
export const GOAL_ANCHOR_COPY = {
  /**
   * Label form — names the quantity, carries no number, no full stop.
   * Used by chart headers, data-bar labels and column captions.
   */
  label: (isSubstitutedJoint: boolean): string =>
    isSubstitutedJoint
      ? 'Chance of meeting every target this run scored'
      : 'Chance of hitting your goal',

  /**
   * Compact readout — number first, no full stop. Used inline beside an
   * option label where a full sentence would be noise.
   */
  phrase: (formatted: string, isSubstitutedJoint: boolean): string =>
    isSubstitutedJoint
      ? `${formatted} chance of meeting every target this run scored`
      : `${formatted} chance of hitting your goal`,

  /**
   * Sentence form — the shipped hero wording, verbatim. `HERO_COPY.detail`
   * calls this; nothing restates it.
   */
  sentence: (formatted: string, isSubstitutedJoint: boolean): string =>
    `${GOAL_ANCHOR_COPY.phrase(formatted, isSubstitutedJoint)}.`,

  /**
   * Headline form (deck A4) — names the option, the basis AND the magnitude.
   * Replaces the bare superlatives ("performs best", "is the leading
   * option", "is most likely to be strongest overall") which named no basis
   * and carried no number.
   */
  headline: (label: string, formatted: string, isSubstitutedJoint: boolean): string =>
    isSubstitutedJoint
      ? `${label} has the highest chance of meeting every target this run scored: ${formatted}`
      : `${label} has the highest chance of hitting your goal: ${formatted}`,

  /**
   * Aria form for a distribution chart over the A quantity.
   */
  byOptionAria: (isSubstitutedJoint: boolean): string =>
    `${GOAL_ANCHOR_COPY.label(isSubstitutedJoint)}, by option`,

  /**
   * A5 — the no-target state. ISL computes a goal probability ONLY when a
   * success threshold was supplied, so this is not an edge case: it is the
   * state of every run the user has not set a target on.
   *
   * Paul's ruling: it NEVER blocks. This is an invitation with a route, not
   * a wall — the surface keeps rendering whatever it can (the comparative
   * distribution stays drawn), and this line says what setting a target
   * would add.
   */
  noTarget: 'Set a success target to see which option is most likely to reach it.',
  /** Inline unlock action beside `noTarget`. `HERO_COPY` re-exports this. */
  noTargetCta: 'Define success',

  /**
   * ⭐ L62 — the WITHHELD state. A second no-number state, NOT a third
   * A-register voice.
   *
   * The header above forbids inventing a third voice for a DISPLAYED number,
   * and this is not one: it is the sentence for when there is no number at
   * all. It exists because `noTarget` is the wrong sentence in this state and
   * saying it would be its own small untruth — the user HAS set a target, or
   * the run DID carry limits; the surface is not asking for one. What
   * happened is that the only figure available was
   * `probability_of_joint_goal` standing in for a goal probability the engine
   * refused to produce, and nothing on the wire lets us check that the
   * threshold and the samples are even in the same frame
   * (`selectGoalProbability`, basis `'joint_goal_withheld'`). Scoring it
   * anyway is what produced "< 1%" for every option on every decision.
   *
   * Plain language, no jargon, no number, no blame on the user, and it does
   * not promise the figure is coming back.
   */
  notScored: "This run couldn't score your options against your target.",
  /**
   * The one-line reason, rendered beside `notScored` where there is room.
   * Separate string so a compact surface can take the headline alone rather
   * than truncate a sentence mid-clause.
   */
  notScoredReason:
    'The analysis produced a figure for your limits, but not one that answers whether an option reaches your target.',

  /**
   * ⭐ L65 — the TARGET-SET-BUT-NOT-SCORED state. A third no-number state,
   * and like `notScored` above it is NOT a third A-register voice: there is
   * no number to voice.
   *
   * LICENSED BY: a user target exists (the store-derived `goalThreshold`
   * signal the V7 goal lens already gates with, `buildV7Lenses.ts`) and NO
   * goal-fit figure arrived at all — basis 'none'. Post-#308 the producer
   * suppresses the frame-broken joint channel at source, so this is the
   * ordinary shape of that run class, and BOTH existing sentences are wrong
   * for it: `noTarget` asks the user for something they already gave, and
   * `notScoredReason` claims "the analysis produced a figure for your
   * limits" when nothing arrived. This sentence claims only the gap.
   *
   * The wording is the V7 goal lens's producer-gap gate, MOVED here verbatim
   * (byte-identical) so the lens and WinGauge render one claim from one
   * register — `V7_LENS_COPY.goal.gateProducerGap` now references this key,
   * the same delegation shape as its `gateNoTarget`. No CTA beside it:
   * there is nothing a user action currently unlocks.
   */
  producerGap:
    'Goal fit unlocks when the engine returns per-option goal probabilities for this run.',
} as const

/**
 * The C-register — the comparative quantity, described by what it measures.
 *
 * Not retired, and not renamed: `OptionCards`' tooltip has shipped
 * "Came out ahead in {N}% of simulated scenarios" for months and it is the
 * most honest sentence in the estate about this number. It is promoted to
 * the house register and DEMOTED below the A number on every surface that
 * shows both (Paul's ruling).
 */
export const COMPARATIVE_COPY = {
  /** Label form — chart header / data-bar label. */
  label: 'Came out ahead across scenarios',
  /** Compact readout, number first, no full stop. */
  phrase: (formatted: string): string => `Came out ahead in ${formatted} of simulated scenarios`,
  /**
   * The same claim with NO magnitude — for the runs that carry the
   * comparative RANK but not a displayable probability for the leader.
   *
   * ⚠ This arm exists because the first draft did not have it, and the
   * builder fell back to the missing-value glyph INSIDE the sentence:
   * "came out ahead in — of simulated scenarios". A placeholder rendered as
   * though it were a quantity is worse than saying less, and the honesty bar
   * this whole change serves forbids it. Caught by an existing readout-tie
   * spec, not by a new one.
   */
  phraseNoMagnitude: 'came out ahead most often across simulated scenarios',
  /**
   * The magnitude-free claim in SENTENCE-INITIAL position.
   *
   * ⚠ Added because the F1 fix opened by writing
   * `phraseNoMagnitude.charAt(0).toUpperCase() + …slice(1)` inline at the call
   * site — which is EXACTLY the duplicated string surgery that produced the
   * §10.2 casing defect, reintroduced two sections after being named. The
   * register owns casing; call sites never do it. `goalAnchorCopy.spec.ts`
   * pins this against `phraseNoMagnitude` so the two cannot drift.
   */
  leadNoMagnitude: 'Came out ahead most often across simulated scenarios',
  /**
   * Mid-sentence form — `phrase()` with a lower-case initial, for when the
   * claim follows an option label rather than opening a line.
   *
   * ⚠ Exists because two call sites were doing
   * `phrase(x).charAt(0).toLowerCase() + phrase(x).slice(1)` inline, and one
   * of them (`buildV7Headline`) did NOT, shipping "Option A Came out ahead in
   * 71% of simulated scenarios" with a capital mid-sentence. String surgery
   * repeated at call sites is how one of them ends up different; the register
   * owns the casing.
   */
  clause: (formatted: string): string => {
    // Built ONCE. Calling `phrase()` twice and slicing each result is two
    // chances for the halves to come from different strings if the register
    // ever grows a branch.
    const phrase = COMPARATIVE_COPY.phrase(formatted)
    return `${phrase.charAt(0).toLowerCase()}${phrase.slice(1)}`
  },
  /** Mid-sentence honest-absence form, parallel to `clause`. */
  unavailableClause: 'comparative ranking is unavailable for this run',
  /** Sentence form. */
  sentence: (formatted: string): string => `${COMPARATIVE_COPY.phrase(formatted)}.`,
  /** Aria form for the distribution chart. */
  byOptionAria: 'Share of simulated scenarios each option came out ahead in',
  /** Honest absence (deck C3). */
  unavailable: 'Comparative ranking unavailable for this run',
} as const

/**
 * THE presence test for a producer probability — never treats a missing
 * number as 0.
 *
 * `Number.isFinite` and not `!= null`: a NaN passes the null check, and a NaN
 * that reaches a comparator or a formatter produces an arbitrary order or a
 * "NaN%" readout. Exported from here because `runHasGoalNumbers` below needs
 * it anyway, and because four surfaces had each written their own copy
 * (`WinGauge`'s `finite`, `DecisionConfidencePanel`'s `isFiniteProb`, an
 * inline expression in `OptionCards`, another in `buildV7Headline`) — four
 * chances for one of them to drift to `!= null` and start rendering a hole as
 * a measurement.
 */
export function isFiniteProbability(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * True when this run carries a goal number for at least one option.
 *
 * ISL computes a goal probability ONLY against a success threshold, so on a
 * no-target run there is no goal ranking AT ALL — not an empty one. Any copy
 * that names "the goal ranking" must ask this first.
 */
export function runHasGoalNumbers(
  options: ReadonlyArray<{ goalProbability?: number | null }> | null | undefined,
): boolean {
  return (options ?? []).some((o) => isFiniteProbability(o.goalProbability))
}

/**
 * Copy for the outcome-view lens — the sentence that says what the lens does
 * NOT change.
 *
 * ⚠ F3. The re-anchoring replaced the un-anchored noun "the overall
 * recommendation" with "the goal ranking above" at three sites, and left it
 * UNCONDITIONAL. On a no-target run that asserts the existence of a ranking
 * the same panel is offering to unlock — the exact no-target branch this
 * change added to `WinGauge`, the confidence ring and the V7 goal lens, not
 * applied to these three strings. One function, three callers, so a fourth
 * lens sentence cannot be born ungated.
 */
export const LENS_COPY = {
  unchanged: (hasGoalNumbers: boolean): string =>
    hasGoalNumbers
      ? 'The goal ranking above is unchanged.'
      : 'The comparative ranking above is unchanged.',
} as const

/**
 * ─────────────────────────────────────────────────────────────────────────
 * THE COMPARISON-SET REGISTER — what the numbers on this run were computed
 * OVER, said next to the numbers themselves.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ## The defect this closes
 *
 * The product already excludes an option and proceeds: CEE's admission gate
 * drops an option with nothing to submit and runs the rest, and the UI derives
 * that fact at the join (`utils/notAnalysedOptions.ts`). So subset results
 * reach users today.
 *
 * ISL is explicit about which quantities do NOT survive subsetting
 * (`isl/src/utils/response_builder.py`): `win_probability`, `rank`,
 * `expected_regret`, `decision_evpi`, `factor_evppi`,
 * `recommendation_stability` and the flip thresholds are all defined OVER THE
 * CANDIDATE SET. CEE's own comment says admission *"changes WHICH options are
 * compared, never what any number means"* — true of the metric's DEFINITION
 * and false of its VALUE. A 62% among three is not a 62% among four, and a
 * leader that never met the excluded option is not the leader of the question
 * the user asked.
 *
 * ## Why this is a REGISTER and not fifteen strings
 *
 * `NotAnalysedOptionCard` already discloses exclusion — on the excluded
 * option's own card, which is exactly where a user reading a headline
 * percentage is not looking. Proximity is the whole point: a disclosure the
 * user must go looking for does not qualify a headline. This register exists
 * so the qualification is ONE sentence rendered beside the numbers on every
 * comparative surface, rather than a sixteenth spelling per render site — the
 * same reason `COMPARATIVE_COPY` exists above.
 *
 * ## ⚠ WHAT THIS MUST NOT BE ATTACHED TO
 *
 * The A-register quantity (`goalProbability`, "chance of hitting your goal")
 * is INVARIANT on a subset — ISL lists `probability_of_goal` among the
 * per-option quantities that survive. Qualifying it would be its own small
 * untruth in the opposite direction: telling a user a number is set-dependent
 * when it is not. Attach this ONLY where a comparative or superlative claim is
 * made — win probability, rank, ordinal, "highest", "came out ahead".
 *
 * A superlative over an invariant quantity IS comparative: "has the HIGHEST
 * chance of hitting your goal" ranges over the candidate set even though each
 * option's own figure does not. The hero headline is therefore in scope.
 */

/**
 * The derived scope of a run's comparison. `null` means there is nothing to
 * say — see {@link deriveComparisonScope}.
 */
export interface ComparisonScope {
  /** How many options were actually in the comparison. Always ≥ 1. */
  readonly analysed: number
  /** How many options the user has. Always > {@link analysed}. */
  readonly total: number
  /**
   * Labels of the options left out, in the order they arrived. MAY BE SHORTER
   * than `total - analysed`: an option with no usable label cannot be named,
   * and inventing a name for it would be worse than reporting the count alone.
   *
   * "No usable label" includes a label that is merely the option's own NODE ID
   * — see the guard in {@link deriveComparisonScope}.
   */
  readonly excludedLabels: readonly string[]
}

/**
 * Derive the comparison scope from the options array the results surfaces
 * already hold.
 *
 * ⭐ NO SECOND PREDICATE. "Was this option in the comparison?" already has a
 * canonical owner — `utils/notAnalysedOptions.ts`, surfaced onto
 * `OptionResult.notAnalysed` by `useResultsSectionData` at the left join. This
 * function COUNTS that flag; it does not re-decide it. A second spelling of
 * "was it analysed" is how two surfaces end up contradicting each other about
 * one option (CLAUDE.md trap 21), and this estate has paid for that shape
 * repeatedly.
 *
 * Returns `null` — i.e. SAY NOTHING — in three states, all of them deliberate:
 *
 *   1. **Nothing excluded.** A "comparing 4 of 4" note on every result is
 *      noise, and noise is how a real disclosure stops being read.
 *   2. **Nothing analysed.** There are no comparative numbers on screen to
 *      qualify; the surfaces render no ranks at all in this state. Qualifying
 *      absent numbers would be a sentence about nothing.
 *   3. **Empty input.** No run, no claim.
 *
 * It therefore fails toward saying less, and is a strict no-op on every run
 * where the whole set was compared.
 */
export function deriveComparisonScope(
  options:
    | ReadonlyArray<{ id?: string | null; label?: string | null; notAnalysed?: boolean }>
    | null
    | undefined,
): ComparisonScope | null {
  const all = options ?? []
  if (all.length === 0) return null

  const excluded = all.filter((o) => o.notAnalysed === true)
  const analysed = all.length - excluded.length

  // States 1 and 2 — see the header.
  if (excluded.length === 0) return null
  if (analysed === 0) return null

  return {
    analysed,
    total: all.length,
    excludedLabels: excluded
      .map((o) => {
        const label = typeof o.label === 'string' ? o.label.trim() : ''
        // ⛔ NEVER NAME AN OPTION BY ITS NODE ID.
        //
        // `useResultsSectionData` sets `label: node.data?.label || nodeId`, so
        // an unlabelled option arrives carrying its OWN ID as a perfectly
        // well-formed string — and a whitespace check cannot tell the two
        // apart. Without this guard the sentence under the hero reads
        // "…— 79b5d7c0 was left out.", which is a raw internal identifier
        // presented to a user as the name of their option.
        //
        // The leak pre-dates this change (`NotAnalysedOptionCard` has it too,
        // low in the card list); what this register does is PROMOTE it to a
        // headline. Rejecting it here falls back to the count path
        // ("1 was left out"), which is honest and already tested.
        const isBareId = label.length > 0 && label === (o.id ?? '')
        return isBareId ? '' : label
      })
      .filter((label) => label.length > 0),
  }
}

/**
 * Join labels in British house style — no serial comma.
 *
 * Not exported: it is an implementation detail of the register, and a second
 * public list-joiner is exactly the kind of near-duplicate helper that drifts.
 */
function joinLabels(labels: readonly string[]): string {
  if (labels.length === 1) return labels[0]
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

/**
 * How many excluded options are NAMED before the rest are counted.
 *
 * Exported so guards derive it rather than restating it — but note that a
 * derived guard proves the copies agree and can never prove the VALUE is right
 * (CLAUDE.md trap 12d), so the owner spec also pins this number directly with
 * its measurement as the stated reason.
 *
 * ⭐⭐ TWO, AND IT IS ALSO THE ANALYSIS (NEW) ROW CAP — one number, two
 * consumers, deliberately. They were two independent integers and each was
 * justified by the OTHER surface's completeness: the note named them all, so
 * capping the glance's rows lost nothing; the rows named them, so capping the
 * note lost nothing. Bounding the note made the first justification false, and
 * neither suite could see it — a circle built out of two constants (CLAUDE.md
 * trap 21). Binding them removes the circle instead of re-arguing it.
 *
 * ⭐ THE MEASUREMENTS LIVE HERE AND NOWHERE ELSE. Every other file that needs a
 * figure points at this block rather than restating it — a number copied into a
 * second comment is a hand-maintained mirror (CLAUDE.md trap 12), and this PR
 * proved it: a standalone-harness figure was quoted alongside an in-panel one as
 * though they measured the same thing, and it had already propagated into a
 * second file before a review caught it.
 *
 * ALL FIGURES BELOW ARE IN-PANEL — measured on the real Analysis (New) surface,
 * 280px (the narrowest dock width), partial-scope run. An isolated harness reads
 * ~30px taller because it cannot reproduce the surface's `withDetail` gating, so
 * its numbers are NOT comparable and must not be quoted here.
 *
 * What the unbounded note did, by excluded-option count:
 *
 *   excluded      3       12       30
 *   note        76px    287px    741px      <- against a ~769px usable dock
 *
 * What it does now, and the cap that was chosen from it:
 *
 *            note   panel   last nav row   (fold ~769px)
 *   cap 2     61px   835px      784px       15px over
 *   cap 3     91px   930px      879px      110px over
 *
 * The note is now 61px at EVERY count above — the growth is gone, not reduced.
 * At 416px (the default dock width) the whole surface fits the first viewport
 * even at 30 excluded: panel 745px, last nav row 694px.
 *
 * Both values fix the honesty defect identically — that is independent of the
 * number — and both are bounded (the panel is the same height at 6 excluded
 * options as at 30). Two wins because it comes within 15px of holding the whole
 * strategic read and navigation in the first viewport where three misses by
 * 110px, and because the marginal value of a third name AT REST is small when
 * the count is always on screen and one click reveals every name.
 *
 * It also leaves the Analysis (New) row cap exactly where its own measurement
 * put it, so this change is not a height regression at any option count.
 *
 * If you change it, RE-MEASURE at 280px on a partial-scope run and update this
 * table. Pinned directly in the owner spec, because every other guard derives
 * from this constant and would move with it (trap 12d).
 */
export const EXCLUDED_LABEL_NAME_CAP = 2

/**
 * The comparison-set register — ONE spelling of "these numbers compare N of
 * your M options", for every surface that renders a comparative figure.
 *
 * The verb is `left out`, matching `notAnalysedCopy`'s shipped sentence
 * (*"it was left out of the comparison"*) verbatim in its operative words, so
 * the card-level disclosure and the headline-level one cannot read as two
 * different events happening to one option.
 *
 * ⚠ NEUTRAL BY CONSTRUCTION. Nothing here may imply the excluded option was
 * considered and lost — it was never scored. "Left out" states the fact and
 * claims nothing about its merit. Do not add a comparative verb.
 */
export const COMPARISON_SCOPE_COPY = {
  /**
   * Compact scope phrase — no full stop, for a caption slot beside a chart
   * heading where a sentence would crowd the number.
   */
  phrase: (scope: ComparisonScope): string =>
    `Comparing ${scope.analysed} of your ${scope.total} options`,

  /**
   * Who is outside the set. Falls back to the COUNT when no excluded option
   * carries a usable label — reporting "1 was left out" is honest; inventing
   * "Untitled option" is not.
   *
   * ⭐⭐ THE NAMES ARE CAPPED AND THE REMAINDER IS COUNTED. This closes two
   * defects that shared one cause, both measured before the fix.
   *
   * 1. HONESTY, and it is the more serious of the two. `excludedLabels` MAY BE
   *    SHORTER than `total - analysed` (see its own doc), so on a mixed set this
   *    clause NAMED the nameable ones and said nothing about the rest, while
   *    reading as a complete list:
   *      "Comparing 1 of your 31 options — Alpha, Bravo, Charlie, Delta and
   *       Echo were left out."
   *    Thirty were left out. Nothing signalled that the clause was partial, so a
   *    reader takes five as the answer.
   *
   * 2. LENGTH. It grew without limit — 76px at 3 excluded options, 287px at 12,
   *    741px at 30, against a ~769px usable dock height. The note alone could
   *    consume the whole first viewport and push every navigation row below it.
   *    (Figures and their measurement conditions are recorded ONCE, on
   *    `EXCLUDED_LABEL_NAME_CAP`. Do not restate them anywhere else.)
   *
   * ⛔ THE OVERFLOW IS COUNTED FROM `total - analysed`, NEVER FROM
   * `excludedLabels.length`. Counting from the label list would silently drop
   * every option that carries no usable label — i.e. it would reproduce defect 1
   * inside the fix for it.
   *
   * ⛔ THE COUNT ITSELF IS NEVER CAPPED. `phrase` carries "N of your M" and is
   * untouched here; that is the ROADMAP 2.1340 guarantee and it is pinned
   * against this cap in the owner spec.
   *
   * ⚠⚠ USER-REACHABLE ON BOTH ANALYSIS TABS, AND THE TWO TABS DIFFER. An earlier
   * version of this paragraph claimed every excluded option stays NAMED on
   * every surface that mounts this note. An independent review REFUTED that,
   * and it is worth stating why the wrong version was so easy to write: I
   * verified co-mounting INSIDE `ResultsBody` and never asked whether
   * `ResultsBody` is mounted. A co-mount read in source proves a code path
   * exists; it says nothing about whether that surface is on screen.
   *
   * The manifest, re-derived with a contrast control — FIVE mounts in four
   * files (`WinGauge` carries two, `goal` and `comparative`):
   *
   *   WinGauge:398 goal · WinGauge:516 comparative · OptionCards:1292 ·
   *   AnalysisHeroPanel:399 · AtAGlance:300
   *
   * ON THE ANALYSIS TAB the claim HOLDS. All four of the first mounts live in
   * `ResultsBody`, alongside `OptionCards`, which renders a
   * `NotAnalysedOptionCard` for every excluded option UNCONDITIONALLY — its
   * NO-RANK RULING appends them past the TOP_N truncation. Stronger than a
   * co-mount reading: `deriveComparisonScope` returns non-null only at total
   * >= 2, and `useResultsSectionData` sets `isSingleOption = length <= 1`, so
   * the note's own render condition IMPLIES the option block's guard.
   *
   * ON ANALYSIS (NEW) IT DOES NOT. That is a SEPARATE DOCK TAB
   * (`OutputsDock.tsx:3457`), so `ResultsBody` and its cards are not mounted at
   * all; `AtAGlance` is the only namer there and it caps too. This surface
   * therefore names fewer options AT REST than it used to. That reduction is
   * accepted deliberately and the reasoning, with its measurements, is recorded
   * on `EXCLUDED_OPTION_VISIBLE_CAP` in `AtAGlance.tsx` — the short version is
   * that the count is never hidden, every name is one click away, and the
   * alternative was a note reaching 741px against a ~769px dock (figures on
   * `EXCLUDED_LABEL_NAME_CAP` above; do not restate them).
   */
  excludedClause: (scope: ComparisonScope): string => {
    const missing = scope.total - scope.analysed
    if (scope.excludedLabels.length === 0) {
      return missing === 1 ? '1 was left out' : `${missing} were left out`
    }
    const named = scope.excludedLabels.slice(0, EXCLUDED_LABEL_NAME_CAP)
    const others = missing - named.length
    if (others <= 0) {
      // `<= 0` rather than `=== 0`: if the contract above were ever violated and
      // more labels arrived than options were missing, printing "-2 others" is a
      // worse failure than falling back to the plain list.
      const verb = named.length === 1 ? 'was' : 'were'
      return `${joinLabels(named)} ${verb} left out`
    }
    // Always plural: at least one name plus at least one other is two things.
    return `${joinLabels([...named, `${others} other${others === 1 ? '' : 's'}`])} were left out`
  },

  /**
   * THE disclosure sentence — scope and names in one line, for rendering
   * directly beneath a headline or a chart heading.
   */
  sentence: (scope: ComparisonScope): string =>
    `${COMPARISON_SCOPE_COPY.phrase(scope)} — ${COMPARISON_SCOPE_COPY.excludedClause(scope)}.`,

  /**
   * The consequence, for surfaces with room for a second line. States what the
   * ISL contract states: the comparative quantities range over the candidate
   * set, and this run's candidate set is smaller than the user's option set.
   *
   * Deliberately says "ranks and comparative percentages" and NOT "the
   * numbers" — the goal-fit figure on the same screen is subset-invariant and
   * this sentence must not sweep it in.
   */
  detail: (scope: ComparisonScope): string =>
    `Ranks and comparative percentages describe those ${scope.analysed} only.`,
} as const
