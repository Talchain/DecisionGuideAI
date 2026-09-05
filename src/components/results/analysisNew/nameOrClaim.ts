/**
 * ⭐⭐ A NAME AND A CLAIM ARE DIFFERENT THINGS, AND ONE STRING IS DOING BOTH.
 *
 * A factor's `label` is used as a heading, as a chart axis label, and inside
 * sentences. That is fine when it is a NAME — "Time Pressure", "Warm Network
 * Activation". It is not fine when the producer hands back the brief's own
 * prose, which it routinely does:
 *
 *   "We've heard from three churned customers that they left because of
 *    missing integrations, not price — so we think product gaps mediate the
 *    relationship between customer satisfaction and churn"
 *
 * Every surface then does the same thing to it — `white-space: nowrap;
 * text-overflow: ellipsis` — and cuts it MID-WORD, at a different point on
 * every row, with the remainder reachable only through `title`.
 *
 * ── WHY `title` ALONE IS NOT ENOUGH ───────────────────────────────────────
 * `title` is a HOVER affordance. There is no hover on touch, and no major
 * browser surfaces it on keyboard focus. So on a phone or by keyboard the rest
 * of the sentence is simply GONE — not hidden, unreachable. That is the whole
 * reason the approved design rejected "truncate + hover" (option C1) and chose
 * "truncate + expand" (C2): reachable everywhere, and the affordance is itself
 * the signal that this name is not a name yet.
 *
 * ── ⛔ THE ONE THING THIS MUST NEVER DO ───────────────────────────────────
 * IT MUST NOT SHORTEN PROSE INTO A NAME. Choosing which words carry the
 * meaning is a judgement ABOUT THE MODEL, and a render layer that guesses it
 * will eventually put a sentence on screen that the model does not support —
 * which is the fabrication class this panel has already had caught on it three
 * times. So this truncates and discloses, and never rewrites. The result is
 * visibly worse than a real name, deliberately: that is the correct incentive,
 * and it is strictly better than a mid-word cut.
 *
 * The real fix is upstream — a `name` (≤42 chars, noun phrase) alongside the
 * full `claim` — and it is the contract banked with CEE. This is the honest
 * display layer for the world before that arrives, and it stays correct after,
 * because a supplied name is simply short enough never to trigger it.
 */

/**
 * The longest a string can be and still behave like a name.
 *
 * From the approved design's `name` field: "≤42 chars, noun phrase". It is a
 * threshold for "is this prose?", NOT a layout budget — the visible cut is
 * still whatever the column can fit, and CSS ellipsis remains as the backstop
 * at very narrow widths. Above this, a string is treated as a claim.
 */
export const NAME_CHAR_BUDGET = 42

/**
 * ⭐⭐ A SECOND, SMALLER NUMBER — AND IT IS A DIFFERENT QUESTION.
 *
 * `NAME_CHAR_BUDGET` answers *"is this a name or a claim?"* and comes from the
 * contract (`name`, ≤42 chars). This answers *"how much can the row SHOW
 * without the browser cutting a word in half?"* and comes from the narrowest
 * place it renders.
 *
 * They were the same constant for one revision, which is this estate's
 * signature defect — two questions under one name — and it produced exactly
 * the failure you would predict. Measured in a browser: at 420px the label
 * column is 394px and a 41-character cut renders at 258px, comfortably inside.
 * At the 280px dock floor the same column is 254px, so the SAME 41 characters
 * render at 258px and CSS `text-overflow` clipped them — mid-word — giving
 * "…churned customer…". The JS cut was correct and the floor undid it.
 *
 * 36 characters renders at roughly 227px in this face, inside 254px with room
 * for wider glyphs. The cost is a shorter cut at 420px than strictly
 * necessary, and that is the right trade: the same cut at every width is what
 * makes a column scannable, and the full claim is one press away regardless.
 */
export const DISPLAY_CHAR_CUT = 36

/** A label the producer sent as prose rather than as a name. */
export function isProseNotName(label: string): boolean {
  return normaliseSpaces(label).length > NAME_CHAR_BUDGET
}

/**
 * ⭐⭐ A DIFFERENT QUESTION FROM `isProseNotName`, AND THE ONE THE ROW ASKS.
 *
 * `isProseNotName` answers *"is this a claim rather than a name?"* — a
 * statement about the CONTRACT, at `NAME_CHAR_BUDGET`. This answers *"can the
 * row show this in full?"* — a statement about the DISPLAY, at
 * `DISPLAY_CHAR_CUT`. Splitting them is the same move as splitting the two
 * budgets, one level up.
 *
 * ⚠ AND THE OLD SINGLE PREDICATE WAS WRONG IN TWO WAYS A REVIEWER MEASURED:
 *
 * 1. IT EXCLUDED SPACE-FREE LABELS ON A FALSE REASON. Its comment said word
 *    truncation "would return it unchanged and the affordance would promise a
 *    reveal that shows the same string". The first half is true and the second
 *    does not follow: the ROW still CSS-clips the token, so a 72-character
 *    identifier rendered at 463px inside a 254px column, and the reveal would
 *    have shown **209px of otherwise unreachable text**. The disclosure is a
 *    `<p>` that WRAPS; "unchanged by the cut" is not "already visible".
 *
 * 2. IT CLASSIFIED AT 42 WHILE THE ROW CUT AT 36, leaving a 37–42 band that is
 *    truncated by neither — visible only on wide glyphs, but real.
 *
 * Length, not word count, is therefore the whole test: a label that cannot fit
 * needs a route to its full text whether or not it contains a space.
 */
export function needsClaimDisclosure(label: string): boolean {
  return normaliseSpaces(label).length > DISPLAY_CHAR_CUT
}

/**
 * ⚠ U+00A0 IS A SPACE THE BOUNDARY SEARCH COULD NOT SEE. Producer prose
 * arrives with non-breaking spaces (and, less often, narrow/thin spaces), and
 * `lastIndexOf(' ')` matches none of them — so a whole sentence read as one
 * unbreakable token, fell through every cut, and was clipped mid-word with no
 * disclosure. Normalising once, here, keeps every caller honest.
 */
function normaliseSpaces(label: string): string {
  return label.replace(/[\u00a0\u2007\u202f\u2009\u200a]/g, ' ').trim()
}

/**
 * Cut at a WORD boundary, never mid-word, and never invent a word.
 *
 * ⚠ RETURNS THE INPUT UNCHANGED when it is already short enough, or when the
 * first word alone exceeds the budget — in the second case there is no
 * boundary to cut at, and returning a mid-word fragment here would reintroduce
 * exactly the defect this exists to remove. The caller keeps CSS ellipsis, so
 * an uncuttable string still cannot overflow its column.
 */
export function truncateAtWord(label: string, budget: number = DISPLAY_CHAR_CUT): string {
  const t = normaliseSpaces(label)
  if (t.length <= budget) return t
  const cut = t.slice(0, budget)
  const lastSpace = cut.lastIndexOf(' ')
  if (lastSpace <= 0) return t
  // Trailing punctuation left dangling by the cut reads as a typo, not a cut.
  return `${cut.slice(0, lastSpace).replace(/[\s,;:–—-]+$/, '')}…`
}

/**
 * British English, and deliberately not "show more".
 *
 * "Show more" describes the gesture; this names WHAT IS MISSING — that the
 * thing above is a claim wearing a name's place. A reader who meets it should
 * understand the model has a gap, not that the UI has a disclosure.
 */
export const NAME_OR_CLAIM_COPY = {
  showFullClaim: 'Show the full claim',
  hideFullClaim: 'Hide',
  /** Screen-reader name, so the control is not a bare "Show the full claim" ×N. */
  showFullClaimFor: (label: string) => `Show the full claim behind ${truncateAtWord(label, 30)}`,
} as const

/**
 * ⚠ WCAG 2.2 AA §2.5.8 — 24×24 CSS px MINIMUM, and this control had 15px of
 * height (`padding: 0 4px` at `panelMeta`, identical at every dock width). On a
 * PR whose entire premise is that TOUCH HAS NO HOVER, shipping a target below
 * the touch minimum defeats the fix for exactly the users it is for — and it
 * sits directly beneath a full-width row button that means something else, so
 * a mis-tap opens the value editor instead.
 */
export const CLAIM_TOGGLE_TOUCH_TARGET =
  'inline-flex items-center min-h-[24px] px-2 py-1'

