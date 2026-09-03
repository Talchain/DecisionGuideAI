import { typography } from '../../../styles/typography'
import { UNCONFIRMED_ESTIMATE_LABEL } from '../../domain/vocabulary'
import type { EdgeValueSource } from '../../domain/edgeValueProvenance'

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
 * ⚠⚠ CORRECTED 3 Sep 2026, THEN CORRECTED AGAIN — AND THE SECOND CORRECTION IS
 * THE ONE TO INHERIT. This paragraph used to cite `lodMetric.riskOutcome.spec.tsx`
 * pinning `'Strength 50% est.'` byte-for-byte as evidence the token must not
 * grow. Round 1 of PR #1174 replaced that with *"**That string was the defect** —
 * the no-information default (`DEFAULT_EDGE_DATA.weight` is 0.5) … a spec
 * pinning a lie"*. **THAT REPLACEMENT IS REFUTED BY MEASUREMENT** — see
 * `metricVocabulary.ts`, which holds the canonical root-cause record so this
 * file does not restate it. A bare `DEFAULT_EDGE_DATA.weight` cannot reach that
 * row at all: it carries no provenance stamp, so the gate renders NO ROW.
 *
 * ⛔ SO THE RETIRED SPEC ARM WAS NOT "A SPEC PINNING A LIE" — it pinned a
 * legitimate rendering of a PRODUCER's estimate, and this PR is deliberately
 * changing that rendering. Calling a product decision a defect fix is CLAUDE.md
 * trap 14 (an honest label overwritten by a more useful one), and the more
 * rhetorically convenient sentence is exactly the one nobody re-checks. The
 * risk and outcome cards now say `METRIC_UNSET.standalone` wherever no HUMAN
 * has settled the weight, and this marker no longer rides that row.
 *
 * ⚠ SO `subject: 'strength'` HAS NO `<EstimateMarker />` CALL SITE, AND —
 * CORRECTED — `ESTIMATE_SUBJECT_TITLE.strength` HAS NO PRODUCTION READER
 * EITHER. Round 1 claimed here that the two cards "consume
 * `ESTIMATE_SUBJECT_TITLE.strength` DIRECTLY … exactly one live reader", and
 * used that to justify keeping it. Enumerated (`rg -a`, whole tree): the cards
 * consume `unconfirmedStrengthDisclosure()`, which is built from
 * `STRENGTH_OBJECT` and never touches `ESTIMATE_SUBJECT_TITLE`; the only
 * production `<EstimateMarker />` is `FactorNode.tsx:911`, which passes no
 * `subject` and defaults to `'value'`. The count was not one — it was ZERO, the
 * opposite of the claim. `subject: 'strength'` and
 * `ESTIMATE_SUBJECT_TITLE.strength` survive PINNED ONLY BY TESTS, and are named
 * as such rather than defended.
 *
 * ⭐ THE SHARED CONSTANT THAT GENUINELY SURVIVES IS `STRENGTH_OBJECT`. That is
 * what keeps the distinction this file exists to hold (trap 21 — the header
 * mark answers *who put this element here*, the strength sentence answers *this
 * connection's strength*) spelled in exactly one place.
 *
 * ⛔ AND IT IS NOT THE PROVENANCE GLYPH. A tempting "simplification" is to drop
 * `est.` for `NodeProvenanceMark`'s sparkle. That would be a FABRICATION: the
 * unconfirmed test is `strengthIsHumanSettled` INVERTED
 * (`canvas/domain/edgeStrengthSettlement.ts`), which asks whether a PERSON has
 * taken responsibility — so it includes a producer's estimate, a template
 * author's figure, and a weight defaulted with no source at all. Rendering any
 * of those as AI authorship claims an author the data does not name, and
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
 *
 * ⛔ AND THE FIGURE'S AUTHOR IS NAMED FROM THE DATA, NEVER ASSUMED TO BE OLUMI.
 * `EdgeValueSourceEnum` is `['user','cee','template']`, and `'template'` is
 * DELIBERATELY distinct from `'cee'` — `edgeValueProvenance.ts`: *"a template
 * weight is a real value, not a UI fallthrough"*, authored by a template author
 * for this template rather than estimated for THIS user's decision. It has a
 * live writer (`hooks/useBlueprintInsert.ts:109`, via `edgeValueSourcePatch` —
 * a call shape a `weightSource: 'template'` grep does NOT see, which is how it
 * was first missed). A blueprint-inserted risk→goal edge therefore reaches this
 * sentence, and a hardcoded "Olumi is assuming" would credit Olumi with a
 * number Olumi did not produce — the same fabrication class this row exists to
 * close, one clause along.
 */
export function unconfirmedStrengthDisclosure(
  assumedPct: number | null,
  /** Who supplied `assumedPct`. `null`/omitted is treated as unattributable. */
  assumedSource?: EdgeValueSource | null,
): string {
  if (assumedPct === null) {
    return `Nobody has set ${STRENGTH_OBJECT}. ${OPEN_DETAILS_SET}`
  }
  // ⚠ ABSENCE-SAFE TOWARDS THE WEAKER CLAIM. Anything this cannot attribute
  // falls through to the agentless wording, so an unrecognised source
  // understates authorship rather than inventing one.
  const assumer =
    assumedSource === 'cee'
      ? 'Olumi is assuming'
      : assumedSource === 'template'
        ? 'this template assumes'
        : 'the current assumption is'
  return `Nobody has set ${STRENGTH_OBJECT}; ${assumer} ${assumedPct}%. ${OPEN_DETAILS_SET_OR_CONFIRM}`
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
