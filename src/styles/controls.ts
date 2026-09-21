/**
 * Olumi control surfaces — the one place that decides what an INTERACTIVE
 * control looks like.
 *
 * Usage:
 *   import { controls } from '@/styles/controls'
 *   <input className={`${typography.panelHeader} ${controls.editableField}`} />
 *
 * ⭐⭐ WHY THIS MODULE EXISTS — a measured, founder-reported functional defect,
 * not a styling preference.
 *
 * On the deployed build (21 Sep 2026) the factor value input — the control that
 * edits the model, which is the entire product — was:
 *
 *     bg-transparent border-b border-panel-border focus:border-primary
 *
 * i.e. a transparent box whose only marking was a 1px underline measuring
 * **1.23 : 1** against the panel background. WCAG 1.4.11 asks 3.00 : 1 for a
 * non-text indicator, so it failed by 2.4x and rendered as plain text. The one
 * visible state (`focus:border-primary`) arrives only AFTER the user has found
 * and clicked it — the field announces itself exclusively to people who already
 * knew it was there.
 *
 * The founder's words, having built the product himself: *"I still can't edit
 * the graph."* The capability worked — an edit made through that control saved
 * to the shared model and survived a reload. **It was invisible, not absent.**
 *
 * ⛔ AND IT IS NOT ONE INPUT. `border-panel-border` has **548 uses estate-wide**
 * (55 in `inspector-v2` alone) and 21 files in that folder style inputs
 * `bg-transparent`. Neither existing border token can mark a field:
 *
 *     --border-default-rgb    238 230 216  ->  1.23 : 1
 *     --border-emphasis-rgb   221 212 196  ->  1.46 : 1
 *
 * So this could not be fixed by swapping a token — `--border-field` was minted
 * for it (see `styles/brand.css`, which carries the derivation).
 *
 * ⚠ ONE OWNER, DELIBERATELY. The alternative was editing 21 files, which is how
 * a hand-maintained mirror starts (CLAUDE.md trap 12): the next input added
 * copies whichever neighbour it was pasted from, and the drift is invisible
 * because every copy still "looks fine" in isolation. A constant here means the
 * next field is correct by construction, and one edit moves all of them.
 *
 * ⚠ THE CONTRAST IS GUARDED, NOT ASSERTED. `controls.contrast.spec.ts` parses
 * the RGB triples out of `brand.css` and COMPUTES the ratio, so it fails loud if
 * the palette moves — rather than re-typing a number here that would go stale
 * exactly the way `LABEL_DECLARED_FONT_PX` did.
 */
export const controls = {
  /**
   * A control that accepts typed input.
   *
   * A visible box on all four sides, not an underline: an underline reads as
   * decoration under text, while a box reads as somewhere to put something. The
   * fill (`bg-panel-hover`, a warm tint) separates the field from the panel even
   * where a border is missed, so the affordance does not rest on one 1px line.
   *
   * `focus:border-primary` is KEPT — it was never the problem. The defect was
   * that focus was the FIRST visible state, not that it was the wrong one.
   */
  editableField:
    'w-full rounded-md bg-panel-hover border border-field focus:border-primary outline-none px-2 py-1 transition-colors',
} as const
