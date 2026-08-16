/**
 * CHIP_CLASS — THE action-chip idiom for the conversation surface. One
 * constant, every chip render site.
 *
 * WHY IT LIVES HERE RATHER THAN BEING RE-TYPED PER CARD. This string was
 * previously duplicated inside V5HeldProposalBlock, and ROADMAP 2.225 needed
 * the same idiom on the coaching action chip. A second hand-typed copy is
 * exactly the hand-maintained mirror this programme keeps getting bitten by:
 * a later DS tweak lands on one copy, the other drifts silently, and the
 * drift reads as green because nothing compares them.
 *
 * ⚠ AND THAT IS EXACTLY WHAT ALMOST HAPPENED HERE (PX-B, 15 Aug). The header
 * used to say "the SuggestedChips idiom, verbatim" — and it WAS verbatim: the
 * literal in `SuggestedChips.tsx` and this constant were byte-identical, which
 * is precisely why nothing noticed they were two copies. The PX-B chip-weight
 * change was first written into the SuggestedChips literal ALONE, which would
 * have shipped two different "action chip" sizes into one panel — the copies
 * had AGREED before the fix and would have diverged because of it. The fix was
 * not to edit both: it was to delete the second copy. `SuggestedChips.tsx` now
 * IMPORTS this constant, so there are four render sites and one authority.
 *
 * THE GRAMMAR (PX-B, Paul 15 Aug: "oversized actions"). Aligned DOWN to the
 * `.chip` CSS grammar these chips are supposed to share — `.chip` is
 * `padding: 6px 12px` at `--conv-type-size-body` (12px), i.e. `px-3 py-1.5`
 * at `typography.panelBody`. It was `px-4 py-2` at `bodySmall` (14px), so an
 * Olumi suggestion read as a primary CTA rather than a secondary control.
 * (The `.chip` class itself is owned by `ActionChipRow`, which has ZERO
 * production importers — verified — so the CSS grammar was never the one
 * users saw. The two grammars are now the same size either way.)
 *
 * It carries the accessibility affordances the cards depend on, so read
 * before trimming:
 *   - `min-h-[44px]` — the pointer-target floor. DELIBERATELY KEPT at the
 *     PX-B down-size: padding sets the chip's visual WEIGHT, min-height sets
 *     how big it is to HIT. Two different questions; shrinking the type is
 *     not a reason to answer the second one differently.
 *   - `focus-visible:ring-2 ring-info ring-offset-2` — the repo's focus
 *     convention; a keyboard user must be able to SEE the chip they are on.
 *   - `disabled:opacity-40 disabled:pointer-events-none` — the settled /
 *     spent state, visually distinct without inventing a second style.
 */
import { typography } from '../../styles/typography'

export const CHIP_CLASS = [
  'inline-flex items-center gap-1.5',
  'bg-panel border border-panel-border rounded-full',
  'px-3 py-1.5 min-h-[44px]',
  'hover:bg-panel-hover active:bg-panel-border/30',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2',
  'text-text-body cursor-pointer font-sans',
  typography.panelBody,
  'disabled:opacity-40 disabled:pointer-events-none',
  'transition-colors duration-200',
].join(' ')
