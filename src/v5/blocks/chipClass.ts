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
 * at `typography.chatBody`. It was `px-4 py-2` at `bodySmall` (14px), so an
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
import { controls } from '../../styles/controls'

export const CHIP_CLASS = [
  // `text-left`: a label that wraps reads as a sentence, not a centred poem.
  'inline-flex items-center gap-1 text-left',
  // ⭐ `border-field` (3.70:1), not `border-panel-border` (1.24:1). Measured on
  // served `e6551858`: 29 of 178 interactive controls on one screen rendered a
  // 1.24:1 outline, under WCAG 1.4.11's 3.00:1 floor for a non-text indicator,
  // and `selection-ask-chip` was one of them. Changed HERE because this file is
  // already the single authority for a chip's look — the alternative was the
  // same edit at every call site, which is how the authority stops being one.
  // `rounded-[22px]` is the pill at the 44px floor, so a one-line chip is unchanged; a wrapped
  // label becomes a rounded card whose first and last words stay clear of the curve.
  'bg-panel border border-field rounded-[14px]',
  'px-2.5 py-1 min-h-[28px]',
  'hover:bg-panel-hover active:bg-panel-border/30',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2',
  'text-text-body cursor-pointer font-sans',
  typography.chatBody,
  'disabled:opacity-40 disabled:pointer-events-none',
  'transition-colors duration-200',
].join(' ')

/**
 * CHIP_PRIMARY_CLASS — the ONE filled chip: the answer "yes" to a proposal.
 *
 * DS v5 §21.2: "Accept → `bg-primary text-on-color`. Edit → secondary.
 * Dismiss → `text-text-light` link." Contract v3.1 draws the same thing as
 * `.button.primary` beside plain `.button`s. Every other chip stays
 * `CHIP_CLASS`, so a consent pair reads as one clear yes and one way out
 * (Paul, 26 Sep, Chat Atlas review: the approve chip carried no more weight
 * than "Change something first").
 *
 * Same grammar as `CHIP_CLASS` in every other respect — size, 44px hit floor,
 * focus ring, disabled state — so the pair still lines up as one row.
 */
export const CHIP_PRIMARY_CLASS = [
  'inline-flex items-center gap-1 text-left',
  'bg-primary border border-primary rounded-[14px]',
  'px-2.5 py-1 min-h-[28px]',
  'hover:bg-primary/90 active:bg-primary/80',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2',
  'text-text-on-color cursor-pointer font-sans',
  typography.chatBody,
  'disabled:opacity-40 disabled:pointer-events-none',
  'transition-colors duration-200',
].join(' ')

/**
 * THE OLUMI-CORE LANE'S CONTROL RECIPE (Paul, 18 Nov, superseding 7 Nov's "44px main targets" for this lane: "for all buttons, we need to go for
 * the smallest possible option … clear and easy, but simplified, minimised, space-saving, a premium feel"). One height, 28px (`min-h-7`), one
 * radius (6px, `rounded-md`, no pill), the panel's 12/500 heading size (`typography.viewPanelHeading`), no border and no shadow. The 44px hit area is deliberately out; the focus ring stays.
 *   - VIEW_CHIP_PRIMARY_CLASS: the one solid green text control (the green the lane already uses for actions: `bg-success`, ink text).
 *   - VIEW_CHIP_CLASS: a secondary is plain text on no fill; its hover fill is a token.
 *   - VIEW_ICON_BUTTON_PRIMARY_CLASS / VIEW_ICON_BUTTON_CLASS: the icon button, a 28px square, the icon drawn at 16px; solid green, or ghost grey.
 * A disabled control reads as disabled by token (grey fill or grey text, no opacity). The older look's CHIP_CLASS / CHIP_PRIMARY_CLASS above are unchanged.
 */
const VIEW_CONTROL_BASE = 'inline-flex min-h-7 items-center justify-center rounded-control border-0 cursor-pointer font-sans transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1'
const LANE_BASE = `${VIEW_CONTROL_BASE} focus-visible:ring-text-header`
const LANE_PRIMARY = controls.actColours
const LANE_GHOST_SURFACE = 'bg-transparent hover:bg-panel-hover active:bg-panel-border/30 disabled:text-text-light disabled:cursor-not-allowed disabled:hover:bg-transparent'
const LANE_GHOST = `text-text-body ${LANE_GHOST_SURFACE}`
export const VIEW_CHIP_CLASS = [LANE_BASE, 'gap-1 px-2 text-left', typography.viewPanelHeading, LANE_GHOST].join(' ')
/** The lane's outlined secondary chip (the field outline, body type, no new colour): for a row of ways to go on that must read as pressable. */
export const VIEW_CHIP_OUTLINE_CLASS = ['inline-flex min-h-7 items-center rounded-control border border-field cursor-pointer font-sans transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-header focus-visible:ring-offset-1 gap-1 px-2 text-left', typography.viewPanelMeta, LANE_GHOST].join(' ')
const VIEW_CHIP_PRIMARY = `gap-1 px-2.5 text-left ${typography.viewPanelHeading} ${LANE_PRIMARY}`
export const VIEW_CHIP_PRIMARY_CLASS = `${LANE_BASE} ${VIEW_CHIP_PRIMARY}`
/** The shared canvas's in-place figure editor keeps its previous focus ring. */
export const OLDER_VIEW_CHIP_PRIMARY_CLASS = `${VIEW_CONTROL_BASE} focus-visible:ring-info ${VIEW_CHIP_PRIMARY}`
export const VIEW_ICON_BUTTON_PRIMARY_CLASS = [LANE_BASE, 'min-w-7 flex-none', LANE_PRIMARY].join(' ')
/** No text colour of its own: the icon's registry colour is a class the button adds (OkIconButton), so `disabled:text-text-light` and a hover can win. */
export const VIEW_ICON_BUTTON_CLASS = [LANE_BASE, 'min-w-7 flex-none', LANE_GHOST_SURFACE].join(' ')

/**
 * CHIP_DISMISS_LINK_CLASS — DS v5 §21.2's "Dismiss → `text-text-light` link".
 * No border and no pill, so it cannot be mistaken for a second answer; the
 * 44px hit floor and the focus ring stay.
 */
export const CHIP_DISMISS_LINK_CLASS = [
  'inline-flex items-center px-1 min-h-[28px]',
  'bg-transparent rounded-sm',
  'text-text-light underline underline-offset-2 hover:text-text-body',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2',
  'cursor-pointer font-sans',
  typography.chatBody,
  'disabled:opacity-40 disabled:pointer-events-none',
  'transition-colors duration-200',
].join(' ')
