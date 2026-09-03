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
 * renders: a low-zoom arm pins `'Strength 50% est.'` byte-for-byte
 * (`lodMetric.riskOutcome.spec.tsx`), and the caption column is content-sized
 * on a 230px card, so a longer word costs the bar. Only the hover text — which
 * has no width budget — learns the distinction.
 *
 * ⛔ AND IT IS NOT THE PROVENANCE GLYPH. A tempting "simplification" is to drop
 * `est.` for `NodeProvenanceMark`'s sparkle. That would be a FABRICATION:
 * `bridgeIsEstimated` is `signedMean != null && weightSource !== 'user'`, which
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
const SUBJECT_TITLE: Record<EstimateSubject, string> = {
  value: `${UNCONFIRMED_ESTIMATE_LABEL} — this value was filled in for you. Open the details to set or confirm it.`,
  strength: `${UNCONFIRMED_ESTIMATE_LABEL} — the strength of this connection was filled in for you. Open the details to set or confirm it.`,
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
      title={title ?? SUBJECT_TITLE[subject]}
      data-testid="estimate-marker"
    >
      est.
    </span>
  )
}
