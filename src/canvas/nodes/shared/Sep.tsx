/**
 * Sep — the space between two sections of a canvas node card.
 *
 * ⭐⭐ IT USED TO BE A LINE. PAUL RULED IT OUT OF THE SYSTEM (17 Sep 2026).
 *
 * > *"The design system should specify not having a single-line border anywhere.
 * > It should always be full borders, no single lines."*
 *
 * The node design system states it as rule 1, and states the remedy in the same
 * sentence, which is why this file changes rather than disappears:
 *
 * > **Borders enclose; nothing is separated by a single line.** No `border-top`,
 * > no left-edge accent stripe, no hairline divider and no gridline anywhere in
 * > the system. A card carries a full border in its kind's colour; **a section
 * > inside a card is separated by space, or by a full border of its own**; a
 * > table's cells are each fully bordered. *A single edge reads as a fragment of
 * > a box that was never drawn, and it puts weight on one side of a thing that
 * > is symmetrical.*
 *
 * So the separation survives and only its CHANNEL changes: space instead of a
 * rule. The ten call sites are untouched.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ THE HEIGHT IS DELIBERATE, AND IT IS NOT A TASTE — IT IS THE OLD FOOTPRINT
 * ─────────────────────────────────────────────────────────────────────────────
 * The previous element was `border-t border-panel-border my-1.5`: a 1px rule
 * with 6px of margin on each side, **13px of vertical space in total**. This is
 * `h-3` — **12px** — so every card carrying a separator loses 1px per separator
 * and no card's geometry moves in a way a reader could see. That matters here
 * specifically: a density fix that silently made cards TALLER shipped from this
 * lane on 16 Sep (382px → 498px, +30%, under a fully green suite), so a change
 * to a spacing primitive states its arithmetic or it is not finished.
 *
 * 12px is also ~6× the `mb-0.5` (2px) that separates lines WITHIN a section, so
 * the gap reads as a break rather than as loose leading. That ratio is what the
 * rule is buying: the eye reads the interval, not the ink.
 *
 * ⚠ `aria-hidden` and no role: this was decorative when it was a line and it is
 * decorative now. The sections either side carry their own headings; a screen
 * reader gets the structure from those, never from this.
 */
export function Sep() {
  return <div aria-hidden="true" data-testid="node-section-space" className="h-3" />
}
