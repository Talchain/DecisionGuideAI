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
 * The alt-winner NAME is dropped from the withheld headers (#505 doctrine —
 * silence where we lack authority). `alternative_winner_label` means "the
 * option that would take the lead if this edge flipped", so rendering it in a
 * flip sentence names a would-be leader on a run where no leader may be
 * named. The fragility FACT — that N factors could change the picture — is
 * kept whole.
 *
 * ⚠ DOCTRINE NOTE, deliberately left visible for review: `heroCopy.ts`
 * (`flipRiskWithAlternative`) took the OTHER branch for the same producer
 * field — it KEEPS the alternative's name on a withheld run and neutralises
 * only the verb ("the comparison shifts towards {alt}"), arguing that
 * dropping producer data is itself over-suppression. This module follows the
 * #505 drop-the-name doctrine as briefed; if the programme rules the hero's
 * treatment canonical, `fragileEdgeGroupHeader`'s withheld branch is the one
 * line that changes.
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
   * `!DecisionVerdict.hasLeadingOption`, quoted from the caller. Never
   * re-derived here.
   */
  designationsWithheld: boolean
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

/** `N factor` / `N factors` — the count is DATA and survives withholding. */
function factorCount(edgeCount: number): string {
  return `${edgeCount} ${edgeCount === 1 ? 'factor' : 'factors'}`
}

export function fragileEdgeGroupHeader({
  altWinnerLabel,
  edgeCount,
  hasEValue,
  designationsWithheld,
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

  if (designationsWithheld) {
    // The count survives; the flip TARGET does not.
    return {
      kind: 'plain',
      text: multiple
        ? `${factorCount(edgeCount)} could change ${FRAGILE_NEUTRAL_OBJECT}`
        : `${sentenceCase(FRAGILE_NEUTRAL_OBJECT)} could change`,
    }
  }

  return {
    kind: 'altWinner',
    lead: multiple ? `${factorCount(edgeCount)} could flip the result to ` : 'Result could flip to ',
    altWinnerLabel,
  }
}

/**
 * The per-edge trailing clause, rendered beside "If {source} shifts" when the
 * group has no named alt-winner.
 */
export function fragileEdgeConsequence({ designationsWithheld }: FragileEdgeVerdictInput): string {
  return designationsWithheld
    ? `${FRAGILE_NEUTRAL_OBJECT} could change`
    : 'the recommendation could change'
}

/**
 * The expert-mode E-value sentence. The NUMBER is producer data and is
 * unchanged in both states; only the object of "flip" moves.
 */
export function fragileEValueNote({
  eValue,
  designationsWithheld,
}: FragileEdgeVerdictInput & { eValue: number }): string {
  const v = eValue.toFixed(1)
  return designationsWithheld
    ? `E-value ${v}: assumptions would only need to be ${v}x wrong to change ${FRAGILE_NEUTRAL_OBJECT}.`
    : `E-value ${v}: assumptions would only need to be ${v}x wrong to flip the recommendation.`
}

/**
 * The Ask-Olumi draft the sparkle CTA prefills.
 *
 * In scope for the same reason #503 put the two thinking-pattern drafts in
 * scope: a draft is prose the product hands the user to send in their own
 * name. Only the grouped-with-alt-winner branch carries a claim; the other
 * two are already neutral and are byte-identical in both states.
 */
export function fragileDiscussDraft({
  edgeCount,
  altWinnerLabel,
  fromLabel,
  toLabel,
  designationsWithheld,
}: FragileEdgeVerdictInput & {
  edgeCount: number
  altWinnerLabel: string | null
  /** First edge's cleaned endpoint labels — used by the singleton branch. */
  fromLabel: string
  toLabel: string
}): string {
  const multiple = edgeCount > 1

  if (altWinnerLabel && multiple) {
    return designationsWithheld
      ? `Are these ${edgeCount} relationships that could change ${FRAGILE_NEUTRAL_OBJECT} reliable?`
      : `Are these ${edgeCount} relationships that could flip the result to ${altWinnerLabel} reliable?`
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
