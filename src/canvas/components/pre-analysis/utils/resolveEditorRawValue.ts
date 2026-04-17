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
  /** Unit string (e.g. "$", "£", "%"); used by resolveCapHintSubtitle only. */
  unit?: string | null
  sourceBadge?: 'brief' | 'ai'
}

/**
 * True for the triple we can't disambiguate from the envelope:
 * sourceBadge='brief' + rawValue=0 + cap>0. Shared between the editor
 * pre-fill branch and the subtitle-hint branch so the two behaviours stay
 * coupled. If one day CEE publishes `intervention_details[id].display_value`
 * through to ImprovementItem, both consumers should read that instead and
 * this predicate can retire.
 */
export function isBriefExtractedWithCap(item: EditorRawValueInput): boolean {
  return (
    item.sourceBadge === 'brief' &&
    item.rawValue === 0 &&
    typeof item.cap === 'number' &&
    item.cap > 0
  )
}

export function resolveEditorRawValue(item: EditorRawValueInput): number | null {
  if (item.detail === 'Not set') return null
  // Narrowed from returning `cap` to returning `null` after review:
  // cap cannot be used as a safe default without an explicit "baseline
  // missing" sentinel (see doc comment above).
  if (isBriefExtractedWithCap(item)) return null
  return item.rawValue ?? null
}

/**
 * Build the subtitle hint shown below a brief-extracted factor's title
 * when the editor is left empty (isBriefExtractedWithCap case). Surfaces
 * the extracted ceiling so the user still sees the figure the brief
 * carried — without writing it into the input (which would risk the
 * genuine-zero overwrite documented in resolveEditorRawValue).
 *
 * Returns null when the predicate doesn't fire, so callers can preserve
 * their existing subtitle path for all other items.
 */
export function resolveCapHintSubtitle(
  item: EditorRawValueInput,
  format: (value: number, unit: string | null | undefined) => string,
): string | null {
  if (!isBriefExtractedWithCap(item)) return null
  const formatted = format(item.cap as number, item.unit ?? null)
  return `From brief: ${formatted}`
}

