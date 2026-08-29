/**
 * COLLAB — how a panel answer is written on screen.
 *
 * ── WHY A PERCENTAGE ──────────────────────────────────────────────────────
 * The only input path into a round is `BeliefElicitationField`, whose engine
 * returns a chance in [0,1]. A column of `0.85 / 0.2 / 0.35` asks every reader
 * to do the conversion in their head, in a meeting, on a projector. `85%` is
 * the same fact in the units people argue in.
 *
 * ── ⚠ AND WHY IT IS NOT ROUNDED, WHICH IS THE WHOLE POINT ─────────────────
 * The obvious formatter is `Math.round(v * 100)` — that is what
 * `formatElicitedChance` does, correctly, for its own job (a single suggested
 * value prefixed with the word "about", where the rounding is disclosed).
 *
 * Reused HERE it would manufacture a contradiction on this very screen:
 * **0.85 and 0.851 both round to "85%"**, so two participants who genuinely
 * disagreed would appear side by side showing the SAME number, directly under
 * a sentence saying "2 people answered, with 2 different answers between
 * them". That is the exact defect class the divergence sentence was just
 * repaired for, reintroduced one line down and harder to see, because the
 * disagreeing numbers would be invisible rather than merely miscounted.
 *
 * So the conversion is LOSSLESS: `× 100`, with float noise cleaned off
 * (`0.85 * 100 === 85.00000000000001` in IEEE 754 — the reason `toPrecision`
 * is here and not decoration). Distinct answers therefore stay distinct
 * strings, always, and no display rule can ever disagree with the count above
 * it.
 *
 * ── ⚠ AND WHAT IS NOT CLAIMED ─────────────────────────────────────────────
 * A value outside [0,1] is NOT a chance and is written as it was given. The
 * reveal carries no `unit` (only the packet does), so this module cannot know
 * that `18` means months rather than 1800% — and inventing a percent sign for
 * it would be a unit claim nothing on the wire supports.
 *
 * ⚠ THIS IS A DISPLAY RULE AND MUST NEVER REACH A PAYLOAD. The apply path
 * sends `r.value` verbatim because CEE compares it with `Object.is` and
 * refuses on any difference; a formatted string anywhere near that call would
 * refuse every apply.
 */

/**
 * The exact number, as a percentage where that is meaningful.
 *
 * ⚠ `null` IS ACCEPTED AND RENDERS AS NOTHING, and that is a repair rather than
 * a convenience. A declined answer arrives as `null`, and the pristine sites
 * disagreed about it: JSX `{r.value}` rendered nothing, while the apply
 * confirmation's template literal `${applied.value}` rendered the literal word
 * **"null"** into a sentence a facilitator reads ("Grace's null is being
 * applied to …"). Every call site that can reach a real number is already
 * guarded on `!== null`, so this branch is the safety net for the ones that
 * were printing a JavaScript keyword at a user.
 */
export function formatPanelValue(value: number | null): string {
  if (value === null) return ''
  if (!Number.isFinite(value)) return String(value)
  // Not a chance — say what was given rather than assert a unit.
  if (value < 0 || value > 1) return String(value)
  // `toPrecision(12)` removes binary-representation noise without removing any
  // digit the caller actually supplied.
  const percent = Number((value * 100).toPrecision(12))
  return `${percent}%`
}
