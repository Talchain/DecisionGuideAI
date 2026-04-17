/**
 * resolveEditorRawValue — pure helper for the TriageCard inline editor's
 * default `rawValue`.
 *
 * Priority:
 *   1. If the item's detail is the literal "Not set" placeholder → null
 *      (empty input, placeholder copy).
 *   2. If the item was brief-extracted AND has a zero observed raw value AND
 *      has a meaningful cap → null. We cannot distinguish two sub-cases
 *      from the sourceBadge/rawValue/cap triple alone:
 *        (a) CEE extracted an upper bound (e.g. "up to £70,000") and left
 *            raw_value at 0 because no live baseline is recorded.
 *        (b) The brief literally stated a 0 value (e.g. "current churn: 0%")
 *            and raw_value=0 is the real figure.
 *      Returning the cap would overwrite (b). Returning null forces the
 *      input to render empty with the "Set value" placeholder. The
 *      "From brief" pill still carries the provenance; the user re-enters
 *      the real figure explicitly.
 *      Future direction: when CEE plumbs
 *      `intervention_details[id].display_value` through to ImprovementItem,
 *      prefer that verbatim string over any derivation here.
 *   3. Otherwise → the item's rawValue unchanged (or null when missing).
 *
 * The sourceBadge === 'brief' guard is the equivalent of a
 * "not-yet-confirmed" check: confirmed brief factors flip to
 * source='user_confirmed' and leave the verify list entirely.
 */

export interface EditorRawValueInput {
  detail: string
  rawValue: number | null
  cap: number | null
  sourceBadge?: 'brief' | 'ai'
}

export function resolveEditorRawValue(item: EditorRawValueInput): number | null {
  if (item.detail === 'Not set') return null
  const isBriefExtractedWithCap =
    item.sourceBadge === 'brief' &&
    item.rawValue === 0 &&
    typeof item.cap === 'number' &&
    item.cap > 0
  // Narrowed from returning `cap` to returning `null` after review:
  // cap cannot be used as a safe default without an explicit "baseline
  // missing" sentinel (see doc comment above).
  if (isBriefExtractedWithCap) return null
  return item.rawValue ?? null
}
