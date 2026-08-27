export function truncateToSize(text: string, maxSize: number, suffix: string): string {
  if (text.length <= maxSize) return text
  const keep = Math.max(0, maxSize - suffix.length)
  return text.slice(0, keep) + suffix
}

/**
 * Truncate without cutting a word in half, and SAY that it was cut.
 *
 * `truncateToSize` above slices at an exact index, which lands mid-word. That is
 * fine for an id or a log line and wrong for anything a person reads: a headline
 * ending "…changes significantl" reads as a rendering fault, and a reader cannot
 * tell a cut string from a string that simply ended.
 *
 * ⚠ THREE TRUNCATION HELPERS NOW EXIST IN THIS REPO and this is the third:
 * `truncateToSize` (here, exact-index) and a PRIVATE `truncateAtWord` duplicated
 * verbatim in `canvas/nodes/OptionNode.tsx` and `canvas/nodes/DecisionNode.tsx`
 * — a same-named twin, the defect class this estate has paid for twice. This
 * one is placed beside `truncateToSize` rather than minting a fourth copy at the
 * call site, and CONVERGING all of them is rowed rather than done here: the node
 * twins have their own callers and their own 0.6 heuristic, and quietly changing
 * what a canvas node displays is not this change's business.
 */
export function truncateAtWordBoundary(text: string, maxLength: number, suffix = '…'): string {
  if (text.length <= maxLength) return text
  const keep = Math.max(0, maxLength - suffix.length)
  const cut = text.slice(0, keep)
  const lastSpace = cut.lastIndexOf(' ')
  // Fall back to the hard cut only when there is no word boundary worth using —
  // otherwise a single very long token would collapse the string to the suffix.
  const body = lastSpace > keep * 0.6 ? cut.slice(0, lastSpace) : cut
  return body.trimEnd() + suffix
}
