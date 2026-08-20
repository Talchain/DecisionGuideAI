import { classifyFlipEvidence, type FlipThresholdLike } from './selectFlipRisk'

/**
 * fragileEdgeCopy — the stress-test fragile-factor card's prose, as pure
 * functions of the shared verdict (ROADMAP 1.267, the #503/#505 pattern).
 *
 * ## Why it moved out of ChallengeSection
 *
 * `FragileEdgeGroupCard` is the card the stress-test "Fragile factors"
 * subsection renders. Four of its strings named a recommendation the producer
 * had withdrawn:
 *
 *   1. `N factors could flip the result to {alt}`   (grouped header)
 *   2. `Result could flip to {alt}`                 (singleton header)
 *   3. `the recommendation could change`            (per-edge consequence)
 *   4. `… would only need to be Nx wrong to flip the recommendation.`
 *   5. `Are these N relationships that could flip the result to {alt} …`
 *      (the Ask-Olumi draft — a string the user is handed to send, and the
 *      same defect class the #503 thinking-pattern drafts carried)
 *
 * None of them was a function of anything: `FragileEdgeGroupCard` took no
 * verdict at all, so on a withheld run the card asserted a recommendation
 * directly beneath the panel's own "the analysis did not put an option
 * forward". `StressTestSection` deliberately keeps fragile factors VISIBLE on
 * a withheld run (its own comment, `StressTestSection.tsx:79-82`: the factors
 * are producer DATA and suppressing them would be the over-suppression the
 * ruling forbids) — which is correct, and is exactly why the prose beneath
 * them had to change instead.
 *
 * As inline JSX literals these five could not be unit-tested without mounting
 * the card, which is why the leak survived #501, #503 and #505. As pure
 * functions they are addressable directly by the withheld/permitted fixture
 * pair, and there is ONE spelling of each sentence rather than five literals a
 * future copy edit could update unevenly (trap 12).
 *
 * ## What changes on a withheld run, and what does not
 *
 * DATA STAYS, in full: the edge count, every source-factor label, every
 * E-value, every Review chip, the stability pill. Only the CLAIM changes.
 *
 * ## Where the defect actually is: the VERB, not the name (orchestrator ruling)
 *
 * This module first dropped `alternative_winner_label` from the withheld
 * headers, reading #505 ("silence where we lack authority") as reaching the
 * name. **That was ruled wrong, and the ruling is recorded here because the
 * distinction is the whole point of the fix:**
 *
 *   · **The PRESUPPOSING VERB is the defect.** "flip the result to {alt}"
 *     asserts that a current result — a leader — exists to flip *from*. That
 *     is the claim the verdict withholds, and it is removed.
 *   · **The NAME is data, not a claim.** `alternative_winner_label` is
 *     DIRECTIONAL SENSITIVITY: which option this edge's fragility points
 *     toward. Dropping it is exactly the over-suppression the ruling forbids —
 *     the product says everything it HAS computed.
 *   · **One field may not be treated two ways on one screen.** `heroCopy.ts`
 *     (`flipRiskWithAlternative`, :398-414) already keeps the name and
 *     neutralises only the verb: "the comparison shifts towards {alt}". A
 *     panel where the hero names the alternative and the stress-test card
 *     hides it is the family-1 self-contradiction shape. Consistency across
 *     surfaces on the same producer field is itself a doctrine requirement,
 *     so the HERO'S TREATMENT IS CANONICAL and this module follows it.
 *
 * So the withheld headers keep `{alt}` and change only the sentence around
 * it. Strings 3 and 4 name no option at all, so they have no name to keep —
 * their withheld forms simply drop the presupposition.
 */

/**
 * The neutral object of every withheld sentence here.
 *
 * Quoted from `flipThresholdStatusNote.ts:62`, which resolved the same
 * question for the "What could change the result" note. Three sanctioned
 * spellings exist across the panel ('the comparison', 'how the options
 * compare', 'the comparison between options'); this surface uses the shortest,
 * and uses it for all five sentences so they cannot drift apart.
 */
export const FRAGILE_NEUTRAL_OBJECT = 'the comparison'

/**
 * TODO(designationsWithheld-helper): `designationsWithheld` is hand-derived in
 * three disagreeing spellings across the panel (`ResultsBody.tsx:154`
 * `verdict != null && !verdict.hasLeadingOption`, `ResultsBody.tsx:457`
 * `verdict?.hasLeadingOption === false`, `useResultsSectionData.ts:1571`
 * `!leaderVerdict.hasLeadingOption`). A shared helper is being consolidated
 * separately; this module and its callers deliberately QUOTE the caller's
 * boolean and never re-derive one, so the consolidation lands in one place.
 */
export interface FragileEdgeVerdictInput {
  /**
   * Q1 — PERMISSION. `!DecisionVerdict.hasLeadingOption`, quoted from the
   * caller. Never re-derived here.
   */
  designationsWithheld: boolean
  /**
   * Q2 — EVIDENCE. `flip_thresholds_status === 'all_no_effect'`, quoted from
   * the caller via `attestsNoFactorFlip()`. Never re-derived here.
   *
   * This is a DIFFERENT QUESTION from `designationsWithheld` and the two are
   * deliberately not merged into one boolean — see `flipVerbPermitted`.
   */
  flipEvidenceAttestsNoFlip: boolean
}

/**
 * Q2's ONE SPELLING — and it OWNS NO LOGIC, on purpose.
 *
 * ⚠⚠ THIS DELEGATES TO THE UI'S EXISTING FLIP-EVIDENCE AUTHORITY AND MUST
 * NEVER GROW A RULE OF ITS OWN. `selectFlipRisk.ts` already classifies this
 * run's flip evidence, and its header already states the rule this module was
 * violating, in its own words:
 *
 *     `flips_absent` — "flip thresholds are PRESENT and EVERY row is
 *     non-flipping. The producer has affirmatively said there is no flip.
 *     NO SURFACE MAY NAME A FLIP RISK OR PRINT A FLIP PERCENTAGE."
 *
 * The fragile-edge card is a surface that named a flip risk and printed a flip
 * percentage, and it was the one surface that never asked. That is the whole
 * defect: not a missing rule, an UNCONSULTED one.
 *
 * Delegating rather than re-deriving buys three things this module must not
 * re-litigate, each already settled and tested in `classifyFlipEvidence`:
 *   · an EMPTY/absent array is `no_producer_flip_data`, NOT an attestation —
 *     so there is no vacuous-truth trap here (`[].every(...)` is `true`);
 *   · an unknown/failed/timed-out reason FAILS the allow-list and degrades to
 *     "we do not know", keeping the strong verb — fail toward not-claiming;
 *   · the attesting vocabulary lives once, in `flipReasonVocabulary`, mirroring
 *     PLoT's exported `NO_EFFECT_REASONS` — never restated here.
 *
 * ⚠ AND WHY NOT `flip_thresholds_status`: it is the producer's own summary and
 * would be the natural input, but it DOES NOT REACH THIS CONSUMER. Derived at a
 * real capture, not assumed — `live-analysis-turn-walkA-2026-08-04.json` carries
 * `enrichment.robustness.display_verdict_reason` (the attested wording) and
 * `enrichment.flip_thresholds` (7 rows) but NO `flip_thresholds_status`
 * anywhere; across the JSON corpus the field appears in exactly ONE file, a
 * PLoT-shaped `/v2/run` capture, versus 12 carrying `display_verdict_reason`.
 * A gate keyed on the status would have been FALSE on precisely the runs that
 * need it and the fix would have shipped DARK.
 */
export function attestsNoFactorFlip(
  flipThresholds: readonly FlipThresholdLike[] | null | undefined,
): boolean {
  return classifyFlipEvidence(flipThresholds) === 'flips_absent'
}

/**
 * TWO INDEPENDENT QUESTIONS, ONE CONSEQUENCE — named apart on purpose.
 *
 * ⚠⚠ THIS IS THE WHOLE POINT OF THE FIX, so it is written out rather than
 * collapsed into `a || b`:
 *
 *   Q1 PERMISSION — `designationsWithheld`: may this turn name a leading
 *      option AT ALL? When it may not, "flip the result to X" presupposes a
 *      current result to flip FROM, and that designation is exactly what the
 *      verdict withheld.
 *
 *   Q2 EVIDENCE — `flipEvidenceAttestsNoFlip`: did this run's own factor-flip
 *      probe attest that no probed factor changes the leader ON ITS OWN? When
 *      it did, flip vocabulary here IMPERSONATES an authority this card does
 *      not hold. This card's data are EDGES scored by elasticity and observed
 *      under JOINT Monte Carlo sampling; the flip probe sweeps ROOT FACTORS
 *      ONE AT A TIME. Different objects, different scopes, different
 *      manipulations — so both statements can be, and routinely are, TRUE.
 *      PLoT already wrote this down and nothing downstream read it:
 *      `robustness-display-verdict.ts:85-89` — fragile edges are "a different
 *      measurement from factor flips and is not contradicted by them".
 *
 * ⚠ AND THE COLLISION MECHANIC, which is why this went unnoticed: Q1 and Q2
 * are ANTI-CORRELATED. A run where nothing can flip the leader is precisely a
 * run where the leader IS confidently designated — so `designationsWithheld`
 * is FALSE exactly when `flipEvidenceAttestsNoFlip` is TRUE. The neutral copy
 * below already existed and was gated OFF on exactly the runs that needed it.
 * Two questions under one gate, failing in the worst direction.
 *
 * Neither question is a fallback for the other: each ALONE forbids the verb,
 * and each is pinned by its own test so a later edit cannot quietly drop one.
 */
function flipVerbPermitted(input: FragileEdgeVerdictInput): boolean {
  // Q1 — permission.
  if (input.designationsWithheld) return false
  // Q2 — evidence.
  if (input.flipEvidenceAttestsNoFlip) return false
  return true
}

/**
 * The card header. Two shapes, because the permitted header embeds the
 * alt-winner in its own styled `<span data-testid="fragile-alt-winner">` and
 * the caller must keep rendering that element unchanged on a permitted run.
 */
export type FragileEdgeGroupHeader =
  /** A single plain sentence — no alt-winner element is rendered. */
  | { kind: 'plain'; text: string }
  /** `lead` (trailing space included) followed by the alt-winner element. */
  | { kind: 'altWinner'; lead: string; altWinnerLabel: string }

/**
 * `N relationship` / `N relationships` — the count is DATA and survives
 * withholding. Only the NOUN changed, and it was a plain falsehood
 * INDEPENDENT of the flip-vocabulary defect above:
 *
 * The producer array being counted is `robustness.fragile_edges` — EDGES
 * (`edge_id = "{from}->{to}"`, ISL `robustness_analyzer_v2.py:5964-5996`), not
 * factors. Edges and source factors are NOT 1:1, and the estate had already
 * measured it: `StressTestSection.tsx:287-289` records that "two different
 * edges sharing a source factor legitimately render the same 'If X shifts'
 * line". So "3 factors" could be, and on the witnessed staging run was, a
 * count of 3 edges over FEWER distinct factors — wrong on any run, including
 * runs where the flip evidence says nothing at all.
 *
 * `relationships` is not new vocabulary: `fragileDiscussDraft` below has
 * always called them that ("Are these N relationships…"), so the module was
 * already internally inconsistent and this settles it toward the true noun.
 */
function relationshipCount(edgeCount: number): string {
  return `${edgeCount} ${edgeCount === 1 ? 'relationship' : 'relationships'}`
}

export function fragileEdgeGroupHeader({
  altWinnerLabel,
  edgeCount,
  hasEValue,
  designationsWithheld,
  flipEvidenceAttestsNoFlip,
}: FragileEdgeVerdictInput & {
  /** Resolved shared alt-winner for the group, or null/'' when there is none. */
  altWinnerLabel: string | null
  edgeCount: number
  /** True when any edge in the group carries an E-value. */
  hasEValue: boolean
}): FragileEdgeGroupHeader {
  // No alt-winner: both existing sentences are already verdict-neutral —
  // they describe the relationship, not a designation. Byte-identical in
  // both verdict states, on purpose.
  if (!altWinnerLabel) {
    return {
      kind: 'plain',
      text: hasEValue ? 'Fragile result, verify key assumptions' : 'Fragile relationship',
    }
  }

  const multiple = edgeCount > 1

  if (!flipVerbPermitted({ designationsWithheld, flipEvidenceAttestsNoFlip })) {
    // The count survives AND so does the name — the alternative is directional
    // sensitivity data. What goes is "flip the result TO", which presupposes a
    // current result to flip from. Same shape as `heroCopy.flipRiskWithAlternative`
    // ("the comparison shifts towards {alt}"), which is canonical for this field.
    return {
      kind: 'altWinner',
      lead: multiple
        ? `${relationshipCount(edgeCount)} could shift ${FRAGILE_NEUTRAL_OBJECT} towards `
        : `${sentenceCase(FRAGILE_NEUTRAL_OBJECT)} could shift towards `,
      altWinnerLabel,
    }
  }

  return {
    kind: 'altWinner',
    lead: multiple
      ? `${relationshipCount(edgeCount)} could flip the result to `
      : 'Result could flip to ',
    altWinnerLabel,
  }
}

/**
 * The per-edge trailing clause, rendered beside "If {source} shifts" when the
 * group has no named alt-winner.
 */
export function fragileEdgeConsequence(input: FragileEdgeVerdictInput): string {
  return flipVerbPermitted(input)
    ? 'which option is most likely to hit your goal could change'
    : `${FRAGILE_NEUTRAL_OBJECT} could change`
}

/**
 * The expert-mode E-value sentence. The NUMBER is producer data and is
 * unchanged in both states; only the object of "flip" moves.
 */
export function fragileEValueNote({
  eValue,
  ...verdict
}: FragileEdgeVerdictInput & { eValue: number }): string {
  const v = eValue.toFixed(1)
  return flipVerbPermitted(verdict)
    ? `E-value ${v}: assumptions would only need to be ${v}x wrong to change which option is most likely to hit your goal.`
    : `E-value ${v}: assumptions would only need to be ${v}x wrong to change ${FRAGILE_NEUTRAL_OBJECT}.`
}

/**
 * The Ask-Olumi draft the sparkle CTA prefills.
 *
 * In scope for the same reason #503 put the two thinking-pattern drafts in
 * scope: a draft is prose the product hands the user to send in their own
 * name. Only the grouped-with-alt-winner branch carries a claim; the other
 * two are already neutral and are byte-identical in both states.
 *
 * The withheld form keeps `{alt}` for the reason above: the user's own
 * question should carry every fact the analysis computed.
 */
export function fragileDiscussDraft({
  edgeCount,
  altWinnerLabel,
  fromLabel,
  toLabel,
  ...verdict
}: FragileEdgeVerdictInput & {
  edgeCount: number
  altWinnerLabel: string | null
  /** First edge's cleaned endpoint labels — used by the singleton branch. */
  fromLabel: string
  toLabel: string
}): string {
  const multiple = edgeCount > 1

  if (altWinnerLabel && multiple) {
    return flipVerbPermitted(verdict)
      ? `Are these ${edgeCount} relationships that could flip the result to ${altWinnerLabel} reliable?`
      : `Are these ${edgeCount} relationships that could shift ${FRAGILE_NEUTRAL_OBJECT} towards ${altWinnerLabel} reliable?`
  }

  if (altWinnerLabel) {
    return `Is the relationship between ${fromLabel} and ${toLabel} reliable?`
  }

  return `Are these ${edgeCount} fragile relationships in my model reliable?`
}

/** Derived, not mirrored: the neutral object appears once as a constant. */
function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
