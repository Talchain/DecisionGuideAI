/**
 * ⭐⭐ THE MODEL ROW'S PROVENANCE, AS A MARK RATHER THAN A SENTENCE.
 *
 * Paul, on the canvas cards: *"We're not using enough iconography. There's lots
 * of text with things like AI Estimate and From Brief, when they should all be
 * icons with hoverover states."* `valueProvenanceIcon.ts` was written for that
 * ruling and is TOTAL over `ValueProvenanceKind`. The canvas consumes it
 * (`NodeProvenanceMark`, `CanvasLegendPopover`); the Model tab never has. This
 * is the Model tab joining the register it should already have been on.
 *
 * ⚠ WHY THIS IS A SIBLING OF `NodeProvenanceMark` AND NOT A REUSE OF IT.
 * That component takes `nodeType` + raw node `data` and routes through
 * `classifyNodeProvenance`, whose vocabulary is three STRUCTURAL literals
 * (`user_set | from_brief | ai_inferred`). A Model row carries
 * `provenanceSource` — an OBSERVED-STATE literal, twelve of them, classified by
 * `classifyValueProvenance`. Same picture, different question: *who authored
 * this NODE* versus *who authored this VALUE*. Wiring one component to both
 * would be the one-name-two-questions defect this lane exists to remove, so the
 * a11y shape is borrowed verbatim and the classifier is not.
 *
 * ⚠ SHAPE CARRIES THE MEANING, NOT HUE. `NodeProvenanceMark` records the
 * measurement: `text-warning` is 1.92:1 against `--bg-panel`, well under the
 * 3:1 that SC 1.4.11 wants, so a colour-coded mark is unreadable to some
 * readers and invisible to a greyscale print. Every glyph here is a distinct
 * lucide SHAPE and they all take the same neutral `text-text-light`.
 *
 * ⚠ AND IT IS NOT A PREDICATE OVER THE ⚠ CHIP. `ModelOutline.tsx`:257 —
 * "TWO FACTS, ONE QUESTION". `estimateText` (Olumi sent display text) and
 * `unconfirmed-estimate` (there is a NUMBER to ratify) are independently owned;
 * a band like "0.4 to 0.9" has the first and not the second. A mark that
 * absorbed the ⚠ would destroy that distinction, so it does not.
 */
import { classifyValueProvenance, VALUE_PROVENANCE_LABEL } from '../domain/valueProvenance'
import { VALUE_PROVENANCE_ICON } from '../domain/valueProvenanceIcon'

export interface ValueProvenanceMarkProps {
  /** The row's `observed_state.source` literal, straight off the model. */
  source: string | null | undefined
  /** Row id, for a testid that binds to THIS row and not to a sibling. */
  rowId: string
}

export function ValueProvenanceMark({ source, rowId }: ValueProvenanceMarkProps) {
  const cls = classifyValueProvenance(source)
  // Absence is rendered as absence — the same rule `SourceProvenancePill` keeps
  // with `showWhenAbsent={false}`. An unrecognised literal is NOT drawn as a
  // neutral glyph, because that would assert "we know where this came from".
  if (cls === null) return null

  const Icon = VALUE_PROVENANCE_ICON[cls.kind]
  const label = VALUE_PROVENANCE_LABEL[cls.kind]

  return (
    <span
      data-testid={`model-row-v2-${rowId}-provenance-mark`}
      data-provenance-kind={cls.kind}
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex shrink-0 items-center text-text-light"
    >
      <Icon aria-hidden="true" className="w-3.5 h-3.5" />
    </span>
  )
}

export default ValueProvenanceMark
