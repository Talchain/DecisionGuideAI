/**
 * resolveEditorRawValue — pure helper for the TriageCard inline editor's
 * default `rawValue`. Extracted from PreAnalysisPanel for unit-test coverage
 * of the Brief 4 hotfix Task 3 cap-fallback branch.
 *
 * Priority:
 *   1. If the item's detail is the literal "Not set" placeholder → null
 *      (empty input, placeholder copy).
 *   2. If the item was brief-extracted AND has a zero observed raw value AND
 *      has a meaningful cap → the cap (so brief-carried figures like
 *      "up to £70,000" pre-fill the editor).
 *   3. Otherwise → the item's rawValue unchanged (or null when missing).
 *
 * The sourceBadge === 'brief' guard is the equivalent of a
 * "not-yet-confirmed" check: confirmed brief factors flip to
 * source='user_confirmed' and leave the verify list entirely, so
 * the sourceBadge invariant prevents us from ever overwriting a value
 * the user has already confirmed.
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
  if (isBriefExtractedWithCap) return item.cap as number
  return item.rawValue ?? null
}
