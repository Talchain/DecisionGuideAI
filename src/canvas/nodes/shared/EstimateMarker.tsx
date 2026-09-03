import { typography } from '../../../styles/typography'
import { UNCONFIRMED_ESTIMATE_LABEL } from '../../domain/vocabulary'

/**
 * EstimateMarker — R6 (Paul, 16 Aug 2026): "placeholder wall collapses to one
 * subtle `est.` marker at rest, detail on hover/inspector."
 *
 * L-48/S17: every factor and outcome carried its own stamp — "Moderate (0.5)",
 * "50% assumed strength", a bare `*`, a sparkle in the header — so the whole
 * model read unfinished, and the SAME gap was encoded three or four times over.
 * This is the one marker they collapse into. Display only: it changes nothing
 * about the value, its provenance, or what the analysis does with it.
 *
 * Deliberately not a button and not focusable — it is a status marker, and the
 * detail behind it is reachable through the node's quick actions and the
 * inspector, which ARE keyboard-reachable. Adding a second tab stop per node
 * would cost more than it gives.
 *
 * ⭐⭐ ONE GLYPH, TWO DIFFERENT OBJECTS — AND THEY ARE NAMED APART, NOT MERGED
 * (Paul, 31 Aug 2026: "est. is on almost every node and explains nothing").
 *
 * There are three call sites and they do NOT mark the same thing:
 *
 *   · `FactorNode` marks the factor's OWN VALUE as inferred.
 *   · `RiskNode` / `OutcomeNode` mark the BRIDGE WEIGHT — the strength of the
 *     connection to the goal, which is a property of the link, not of the card
 *     it is drawn beside.
 *
 * A single title saying "estimated, not yet confirmed" is true of both and
 * useless for either: the reader cannot tell WHICH number is unconfirmed, and
 * on a risk card the unconfirmed thing is not even the number nearest the
 * marker. `subject` is what makes the hover text name the object. This is the
 * estate's signature defect (CLAUDE.md trap 21 — one name, two questions)
 * caught before it hardened: the fix is to name the two apart, never to align
 * them under one sentence.
 *
 * ⚠ THE VISIBLE TOKEN IS UNCHANGED, DELIBERATELY. `est.` stays exactly as it
 * renders: the caption column is content-sized on a 230px card, so a longer
 * word costs the bar. Only the hover text — which has no width budget — learns
 * the distinction.
 *
 * ⚠⚠ CORRECTED 3 Sep 2026, AND THE CORRECTION IS THE POINT. This paragraph used
 * to cite `lodMetric.riskOutcome.spec.tsx` pinning `'Strength 50% est.'`
 * byte-for-byte as evidence the token must not grow. **That string was the
 * defect.** It was the no-information default (`DEFAULT_EDGE_DATA.weight` is
 * 0.5) printed as a figure, beside a bar drawn EXACTLY HALF FULL, on five cards
 * of one canvas at once. A spec pinning a lie is not a width constraint; it is
 * the lie with a guard around it. The risk and outcome cards now say
 * `METRIC_UNSET.standalone` where nobody set the weight, and this marker no
 * longer rides that row.
 *
 * ⭐ SO `subject: 'strength'` HAS NO `<EstimateMarker />` CALL SITE ANY MORE —
 * AND IT IS NOT DEAD, BECAUSE ITS SENTENCE MOVED RATHER THAN DIED. The two
 * cards consume `ESTIMATE_SUBJECT_TITLE.strength` DIRECTLY as their unset row's
 * disclosure, so the distinction this file exists to keep (trap 21 — the header
 * mark answers *who put this element here*, the strength sentence answers *this
 * connection's strength*) still has exactly one authority and exactly one live
 * reader. Collapsing `subject` back to a single title would merge the two
 * questions this file was written to name apart.
 *
 * ⛔ AND IT IS NOT THE PROVENANCE GLYPH. A tempting "simplification" is to drop
 * `est.` for `NodeProvenanceMark`'s sparkle. That would be a FABRICATION:
 * the unconfirmed test is `weightSource !== 'user'` (`RiskNode` /
 * `OutcomeNode`'s `strengthIsUserStated`, inverted), which
 * INCLUDES a weight that was defaulted with no source at all. Rendering that as
 * AI authorship claims an author the data does not name — and
 * `NodeProvenanceMark`'s own rule is that unrecognised provenance renders
 * NOTHING rather than a guess. `UNCONFIRMED_ESTIMATE_LABEL` records the same
 * boundary in the domain vocabulary: "nobody has confirmed it" is a weaker and
 * different statement from "Olumi wrote it".
 */

/** What the marker is speaking about — see the header. */
export type EstimateSubject = 'value' | 'strength'

/**
 * The hover text per subject, DERIVED from the domain constant rather than
 * re-typed. `UNCONFIRMED_ESTIMATE_LABEL` is 'Estimate not yet confirmed' and
 * already owns the exact semantics; these two only add WHICH estimate and the
 * way out. Building them from the constant means the shared half cannot drift
 * from the vocabulary the rest of the product spells it with.
 */
/**
 * The three phrases the sentences below are BUILT FROM rather than re-typed.
 *
 * ⚠ THEY EXIST BECAUSE THERE ARE NOW FOUR SENTENCES, NOT TWO. The unset
 * strength row consumes this module's vocabulary directly (see the header), and
 * a fourth hand-written sentence about "the strength of this connection" would
 * be the fourth place a reader could be told a different story about the same
 * object — the mirror `metricVocabulary.ts` exists to abolish, one level down.
 *
 * ⚠ `Open the details` IS THE ESTATE'S ONE WORD FOR THIS ESCAPE HATCH and is
 * pinned as such (`metricVocabulary.spec.ts` — "ONE escape hatch, ONE word for
 * it"). It is spelled once here for the same reason.
 */
const STRENGTH_OBJECT = 'the strength of this connection'
const OPEN_DETAILS_SET_OR_CONFIRM = 'Open the details to set or confirm it.'
const OPEN_DETAILS_SET = 'Open the details to set it.'

export const ESTIMATE_SUBJECT_TITLE: Record<EstimateSubject, string> = {
  value: `${UNCONFIRMED_ESTIMATE_LABEL} — this value was filled in for you. ${OPEN_DETAILS_SET_OR_CONFIRM}`,
  strength: `${UNCONFIRMED_ESTIMATE_LABEL} — ${STRENGTH_OBJECT} was filled in for you. ${OPEN_DETAILS_SET_OR_CONFIRM}`,
}

/**
 * ⭐ THE DISCLOSURE AN UNSET STRENGTH ROW CARRIES, AND WHERE THE PRODUCER'S
 * NUMBER GOES WHEN IT LEAVES THE CARD'S FACE.
 *
 * The risk and outcome cards no longer print a bar and a percentage for a
 * strength nobody set. They print `METRIC_UNSET.standalone`. This is the
 * sentence that rides that row — on its `title` AND, because a `title` is
 * unreachable by keyboard and absent on touch, on its screen-reader phrase.
 *
 * ⛔ TWO ARMS, BECAUSE THEY ARE TWO DIFFERENT FACTS AND ONE SENTENCE CANNOT BE
 * TRUE OF BOTH (CLAUDE.md trap 21 — name them apart, never align them):
 *
 *   `assumedPct` a number  A PRODUCER supplied a figure and no human has
 *                          confirmed it. The figure is DEMOTED here rather than
 *                          deleted: a reader who wants to know what the model
 *                          is currently running on can still find it, stated as
 *                          an assumption instead of drawn as a measurement.
 *   `assumedPct` null      NOTHING supplied a figure — the provenance gate in
 *                          `resolveEdgeSignedStrengthDisplay` refused the edge's
 *                          bare `weight`, which is a `DEFAULT_EDGE_DATA`
 *                          fallthrough. There is no estimate, so this arm may
 *                          not name one, and it deliberately does NOT open with
 *                          `UNCONFIRMED_ESTIMATE_LABEL`: "an estimate nobody
 *                          confirmed" would invent the estimate.
 */
export function unconfirmedStrengthDisclosure(assumedPct: number | null): string {
  if (assumedPct === null) {
    return `Nobody has set ${STRENGTH_OBJECT}. ${OPEN_DETAILS_SET}`
  }
  return `Nobody has set ${STRENGTH_OBJECT}; Olumi is assuming ${assumedPct}%. ${OPEN_DETAILS_SET_OR_CONFIRM}`
}

export function EstimateMarker({
  subject = 'value',
  title,
}: {
  /** Which unconfirmed thing this marker speaks for. Defaults to the card's own value. */
  subject?: EstimateSubject
  /** Escape hatch for a caller with a genuinely different object. Prefer `subject`. */
  title?: string
}) {
  return (
    <span
      className={`${typography.edgeLabel} text-text-light italic`}
      title={title ?? ESTIMATE_SUBJECT_TITLE[subject]}
      data-testid="estimate-marker"
    >
      est.
    </span>
  )
}
