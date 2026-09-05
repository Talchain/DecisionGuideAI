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
  const t = label.trim()
  // A single long token (an id, a URL, a compound) is not prose — it has no
  // word boundary to cut at, so word truncation would return it unchanged and
  // the affordance would promise a reveal that shows the same string.
  if (!t.includes(' ')) return false
  return t.length > NAME_CHAR_BUDGET
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
  const t = label.trim()
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
