/**
 * CHIP_CLASS — the ratified suggested-action chip idiom (SuggestedChips.tsx),
 * verbatim.
 *
 * WHY IT LIVES HERE RATHER THAN BEING RE-TYPED PER CARD. This string was
 * previously duplicated inside V5HeldProposalBlock, and ROADMAP 2.225 needed
 * the same idiom on the coaching action chip. A second hand-typed copy is
 * exactly the hand-maintained mirror this programme keeps getting bitten by:
 * a later DS tweak lands on one copy, the other drifts silently, and the
 * drift reads as green because nothing compares them. One exported constant,
 * two importers, no mirror.
 *
 * It carries the accessibility affordances the cards depend on, so read
 * before trimming:
 *   - `min-h-[44px]` — the pointer-target floor.
 *   - `focus-visible:ring-2 ring-info ring-offset-2` — the repo's focus
 *     convention; a keyboard user must be able to SEE the chip they are on.
 *   - `disabled:opacity-40 disabled:pointer-events-none` — the settled /
 *     spent state, visually distinct without inventing a second style.
 */
import { typography } from '../../styles/typography'

export const CHIP_CLASS = [
  'inline-flex items-center gap-1.5',
  'bg-panel border border-panel-border rounded-full',
  'px-4 py-2 min-h-[44px]',
  'hover:bg-panel-hover active:bg-panel-border/30',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2',
  'text-text-body cursor-pointer font-sans',
  typography.bodySmall,
  'disabled:opacity-40 disabled:pointer-events-none',
  'transition-colors duration-200',
].join(' ')
