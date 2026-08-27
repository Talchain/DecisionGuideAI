/**
 * panelLists — the ONE spelling for every `<ul>` the AI panel renders.
 * British English: standardise, colour, behaviour.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * Ten lists in the panel surface were styled ten different ways. Measured on
 * `16c55158`: three carried a marker (`list-disc`) and seven did not; indents ran
 * `pl-4`, `pl-5` and an inline `paddingLeft: 20`; vertical rhythm ran `space-y-1`,
 * `space-y-2`, a CSS-module `margin: 4px 0 6px`, and nothing at all. A reader
 * scrolling one answer met several different ideas of what a list is.
 *
 * ⚠ DS v5 does not settle this. Its only statement about lists is that bullets
 * take `panelBody` (12px) — §6.1. There is no list rule to derive, so these three
 * constants ARE the rule, and they are chosen from what the panel already had
 * rather than invented: `list-disc pl-4` was the most common marker treatment,
 * and `space-y-1` the most common rhythm.
 *
 * ── WHY THREE AND NOT ONE ────────────────────────────────────────────────────
 * "Make every list identical" is the wrong target, because two of these are not
 * bullet lists at all. Collapsing them would put a disc in front of a checkbox
 * row. The split is by WHAT THE ITEMS ARE, not by how they were styled:
 *
 *   BULLET   — short prose items. A marker helps the eye separate them.
 *              (answer bullets, driver factors, consent lines, warning signs)
 *   STACK    — composed text rows carrying their own label, id or separator.
 *              A marker would compete with the row's own structure.
 *              (story headlines, scenario contexts, notice rows, flip scenarios)
 *   CONTROLS — stacked INTERACTIVE rows (checkbox + input). Same absence of a
 *              marker as STACK, but roomier: 4px between 44px-tall controls reads
 *              as a single block. This is the one density exception and it is
 *              named rather than left as a stray `space-y-2`.
 *
 * Every `<ul>` in the panel surface must use exactly one of these, and
 * `tests/ci-guards/panel-list-conformance.spec.ts` REDs if one does not — so a
 * new list cannot quietly become an eleventh treatment.
 */

/** Short prose items, disc marker. The default for anything the AI writes. */
export const PANEL_LIST_BULLET = 'list-disc pl-4 space-y-1'

/** Composed text rows that carry their own structure. No marker, no indent. */
export const PANEL_LIST_STACK = 'list-none p-0 m-0 space-y-1'

/** Stacked interactive rows. As STACK, with room for 44px controls. */
export const PANEL_LIST_CONTROLS = 'list-none p-0 m-0 space-y-2'
