/**
 * Analysis (New) — THE CONTAINER GRAMMAR, and the one place it is written down.
 *
 * ⭐⭐ THIS EXISTS BECAUSE THE SURFACE HAD SIX CONTAINER TREATMENTS AND ONE
 * MEANING BETWEEN THEM. Paul's reading of the deployed tab: *"lots of formats,
 * and different types of components, so it feels a real jumbly mess rather than
 * a fluid and consistent design system."* Derived at the code on 9 Sep, the
 * boxes on one screenful were:
 *
 *   `ModelHeldUp`      rounded-lg  border-success/30  bg-success/[0.05]  px-3 py-2.5
 *   `DecisionRecorded` rounded-lg  border-panel-border                   px-3 py-2.5
 *   `ModelImplication` rounded-md  border-<tone>      bg-<tone>          p-3
 *   `AtAGlance` inset  rounded-md  border-warning/30  bg-warning/[0.05]  px-2 py-1.5
 *   `AtAGlance` inset  rounded-md  border-warning/30  bg-warning/[0.04]  px-2 py-1.5
 *
 * Two radii, three paddings, and TWO ALPHAS FOR ONE MEANING — 0.05 and 0.04 on
 * the same warning tint, four hundred lines apart in the same file. None of it
 * encodes anything: a reader cannot learn that `rounded-lg` means one thing and
 * `rounded-md` another, because it does not. It is drift, and drift at the
 * level of the container is what "jumbly" names.
 *
 * ── THE RULE ───────────────────────────────────────────────────────────────
 * GEOMETRY IS GRAMMAR AND IS FIXED. TONE IS MEANING AND VARIES.
 *
 * A container's radius, padding and border WEIGHT say only "this is a box at
 * this level". They must therefore be identical for every box at that level, or
 * they are saying something they do not mean. A container's COLOUR — success,
 * warning, neutral — is the one thing on it that carries information, so colour
 * is the only axis a section may choose.
 *
 * ⚠ THE RADIUS IS DERIVED, NOT PREFERRED. `SectionShell` is the ratified
 * grammar of this surface (the collapsed rows ARE the information architecture
 * the design asks for) and it opens with `rounded-md`. So the boxes agree with
 * `SectionShell`; `SectionShell` was not changed to agree with the boxes. Where
 * a ratified component already answers a question, it is the authority.
 *
 * ⚠ TWO LEVELS, DELIBERATELY, AND THE SMALLER ONE IS SMALLER. `surface` is a
 * top-level section box; `inset` is a box INSIDE one (the glance's caveat
 * strips). Nesting the same radius reads as two unrelated boxes that happen to
 * touch. 6px outside, 4px inside — the nested corner sits inside the parent's,
 * which is what makes it read as contained rather than stacked.
 *
 * ⚠ THIS IS NOT A `ResultsBody` CHANGE. Every consumer named above is an
 * `analysisNew` section, and this module is scoped to that directory for the
 * same reason: the Analysis tab is PARKED under Paul's scope ruling, and a
 * token module in `src/styles/` would invite a consumer there.
 */

/**
 * A top-level section box. Compose with exactly ONE tone from `SURFACE_TONE`.
 *
 * ⚠ NO COLOUR HERE. A default tone baked into the geometry is how the neutral
 * box and the success box drifted apart in the first place — the caller must
 * name its tone, and a caller that names none renders an unbordered block,
 * which is visibly wrong rather than quietly wrong.
 */
/*
 * ⭐ V2 (Paul + ChatGPT brief, 23 Sep 2026): NEUTRAL SURFACES, FULL-WIDTH
 * DIVIDERS, NO CARDS. A section is no longer a rounded, tinted box; it is a
 * block closed by one full-width horizontal rule. No radius, no side borders,
 * no fill, no horizontal padding of its own (the tab body owns the gutter).
 * Tone survives only as the rule's colour, so a caveat is still told apart
 * without a tint; the words and icon carry the meaning.
 */
export const PANEL_SURFACE = 'border-b py-2.5'

/**
 * A box nested INSIDE a section box. Same rule, one level down.
 */
/*
 * V2: NO NESTED CARDS. An inset is spacing only: no border, no radius, no fill.
 */
export const PANEL_INSET = 'py-1.5'

/**
 * The tones a container may carry, and the complete list of them.
 *
 * ⚠ ONE ALPHA PER TONE. The pair this replaced used `bg-warning/[0.05]` and
 * `bg-warning/[0.04]` for the same meaning in the same component. A difference
 * a reader cannot perceive and an author cannot justify is not a distinction,
 * it is an edit nobody swept.
 */
export const SURFACE_TONE = {
  /** No claim. The default for a box that groups without judging. */
  neutral: 'border-panel-border',
  /** The run held up. */
  success: 'border-success/30',
  /** A caveat the reader must carry into the reading. */
  warning: 'border-warning/30',
  /** Worth stopping on, but nothing went wrong — the diverged implication. */
  info: 'border-info/30',
  /** A grouped surface with no border of its own to speak of. */
  muted: 'border-panel-border',
} as const

/**
 * ⚠ OPEN, AND DELIBERATELY NOT SETTLED HERE: THE TINT ALPHAS STILL DIFFER
 * ACROSS TONES — success and warning at 0.05, info at 0.10.
 *
 * That is a real inconsistency and it is NOT the one this module fixes. Fixing
 * it means claiming that one alpha reads equally across three different hues,
 * and perceived tint strength is a function of hue and luminance, not of alpha
 * alone: 10% of a blue and 10% of a yellow do not land the same on a near-white
 * panel. This estate has already been bitten once at exactly this seam —
 * `bg-panel-hover/40` composited to 1.015:1 and was shipped as a "subtle fill"
 * that no reader could see (`sectionContainment.spec.tsx` carries the
 * measurement).
 *
 * So the honest position: the DUPLICATE-ALPHA-WITHIN-ONE-TONE defect is settled
 * (warning was 0.05 in one place and 0.04 in another — the same tint, the same
 * component, no possible justification). The CROSS-TONE question needs a
 * contrast measurement per hue against the deployed tokens, and inventing an
 * answer without one would be the same defect wearing a tidier coat.
 */

export type SurfaceTone = keyof typeof SURFACE_TONE

/**
 * ⭐⭐ THE TOP-LEVEL SECTION RULE (fidelity gaps 6 and 11, 24 Sep 2026).
 *
 * One hairline between the Reasoning tab's top-level sections — the model
 * block and "Challenge the thinking", "Move towards commitment", "About this
 * analysis" — matching the design authority's `.section:before` /
 * `.about:before` (`prototype-v2-reference.html`, `reasoningHTML()`): a rule
 * that runs the full panel width, always on the TOP edge, in the neutral
 * border token only, with the SAME gap on both sides of the line.
 *
 * ⚠ `-mx-4 px-4` IS THE FULL-WIDTH PART. The content column's own gutter is
 * `px-4` (16px); the negative margin cancels it for this element alone so
 * the border-box reaches both panel edges, then the padding puts the
 * content back where the column's other children already sit — the same
 * trick the prototype's `left:-16px;right:-16px` performs against its own
 * 16px `.scroll` padding.
 *
 * ⚠ `!mt-[11px]` CARRIES THE `!` DELIBERATELY. Every call site sits inside
 * SOME ancestor's `space-y-N`, and Tailwind's `space-y` selector
 * (`> :not([hidden]) ~ :not([hidden])`) out-specifies a plain `mt-*`
 * utility, so an unmarked override would silently lose to whatever rhythm
 * the caller's parent happens to carry — a different, unstated gap above
 * the rule depending on which zone it was dropped into. The `!important`
 * pins the same 11px the prototype's `.section{margin-top:11px}` uses,
 * regardless of ancestor, matching the `pt-[11px]` below it exactly.
 *
 * ⚠ NOT A TONE. `SURFACE_TONE` exists for boxes that may carry a caller's
 * colour; this rule never does — it is `border-panel-border` at every call
 * site, full stop, which is what "never a tint" means.
 */
export const PANEL_RULE = '-mx-4 px-4 !mt-[11px] border-t border-panel-border pt-[11px]'

/**
 * A PRESSABLE box at inset level — the glance's promoted action, and today its
 * only consumer.
 *
 * ⭐ THE ONE DELIBERATELY-DISTINCT OBJECT ON THE SURFACE, AND IT STAYS THAT WAY.
 * A filled, borderless card among outlined ones reads as the thing to press,
 * which is exactly what it is: the single "what to think about next" move. So
 * it keeps its FILL and its lack of a border — that is the distinction earning
 * its keep — while its GEOMETRY rejoins the grammar. It was `rounded-lg px-2.5
 * py-2`: a LARGER radius than the box it sits inside, which inverts the nesting
 * and is the reason it read as a stray object rather than a promoted one.
 *
 * ⚠ THE HOVER IS PART OF THE TOKEN, NOT A CALLER'S CHOICE. A pressable surface
 * whose hover a caller supplies is a pressable surface that will eventually
 * ship without one.
 */
/**
 * ⛔⛔ THE FILL THIS TOKEN RESTED ITS WHOLE ARGUMENT ON MEASURES 1.08:1.
 *
 * The docblock above says the card keeps its FILL and its LACK OF A BORDER
 * because *"a filled, borderless card among outlined ones reads as the thing to
 * press"*. Measured with the repo's own helper against the deployed tokens
 * (`tests/helpers/wcagContrast`, `--bg-panel` #FEFEFE, `--info` #277A9D):
 *
 *     bg-info/[0.06]   vs --bg-panel   1.08:1      ← the whole distinction
 *     bg-info/10       vs --bg-panel   1.14:1      ← its hover
 *     border-info/80   vs --bg-panel   3.35:1   vs --bg-panel-hover  3.22:1
 *
 * ⭐ THIS DIRECTORY HAS ALREADY CONDEMNED THIS EXACT NUMBER ONCE.
 * `SectionShell`'s header records dropping a 1px rule for `bg-panel-hover/40`
 * at **1.015:1** — *"the reader lost a divider they could see and gained one
 * they could not"* — and restored the rule. The promoted card was carrying the
 * identical defect, one level in, and the argument for it was written as though
 * the fill were visible. It is 6% of a mid-blue on near-white.
 *
 * ⚠ WHAT IS UNCHANGED AND WHY. The fill STAYS — it is the thing that groups the
 * card once you are looking at it, and removing it would be answering a
 * salience problem by deleting something. What is ADDED is the shape, which is
 * how `secondary` already carries its own affordance, and a border costs NO
 * text contrast. So the card is now distinguished by an outline a reader can
 * see at 3.35:1 AND a fill that reads once they are on it, rather than by a
 * fill alone at a ratio below every threshold in the standard.
 *
 * ⚠ `border-info/80` IS THE FIRST ALPHA CLEARING SC 1.4.11's 3:1 ON BOTH PANEL
 * GROUNDS, derived, not chosen: /40 is 1.74:1, /60 is 2.37:1, /80 is 3.35:1.
 * The figures reproduce this module's own table below to two decimal places,
 * which is the cross-check that the table was measured rather than asserted.
 *
 * ⛔ IT IS STILL THE ONE SUCH OBJECT. An emphasis every control shares is an
 * emphasis none of them has, and this token has exactly one consumer
 * (`AtAGlance`'s promoted act). That constraint is what makes the outline mean
 * something; it is not a licence to outline the next card too.
 */
export const PANEL_INSET_ACTION =
  'rounded border border-info/80 px-2 py-1.5 bg-info/[0.06] hover:bg-info/10'

/** `surface('success')` → the complete className for a top-level box. */
export function surface(tone: SurfaceTone): string {
  return `${PANEL_SURFACE} ${SURFACE_TONE[tone]}`
}

/** `inset('warning')` → the complete className for a nested box. */
export function inset(tone: SurfaceTone): string {
  return `${PANEL_INSET} ${SURFACE_TONE[tone]}`
}

// ────────────────────────────────────────────────────────────────────────────
// ⭐⭐ ACTION TIERS — the same grammar, for the things a reader can PRESS.
// ────────────────────────────────────────────────────────────────────────────
/**
 * ⛔ WHY THIS EXISTS, MEASURED RATHER THAN ASSERTED. Swept over every `<button>`
 * and `<a>` under `analysisNew/`:
 *
 *     48 controls · 30 DISTINCT visual signatures · 23 used exactly ONCE
 *
 * The tiers were always there — the sweep finds the same six clusters over and
 * over (an info link ×10, an info pill ×5, a primary fill ×2, and three quieter
 * variants ×2 each). What was missing is a NAME for them, so every new control
 * re-derived a tier from scratch and landed a 31st spelling. That is the direct
 * cause of the two things Paul reported off a screenshot: "nothing reads as
 * primary", and "two of three card actions don't look clickable".
 *
 * ⚠ THIS IS THE SIBLING OF `SURFACE_TONE`, DELIBERATELY. That constant exists
 * because two spellings of one container tone drifted apart inside a single
 * component; this is the identical defect one layer out, on the pressable
 * objects rather than the boxes. Same fix, same shape, same file — a caller
 * naming a tier cannot invent a new one, and a reviewer can see the whole
 * vocabulary in ten lines instead of inferring it from 48 call sites.
 *
 * ── THE RULE THE TIERS ENCODE ──────────────────────────────────────────────
 * Emphasis is carried by SHAPE AND FILL, never by colour alone. A control
 * distinguished from its surroundings only by hue fails WCAG SC 1.4.1, and on
 * touch — where `hover:` never fires — it reads as coloured text. That is not
 * theoretical: six controls on this panel were exactly that until this week.
 *
 * ⛔ AND THE OBVIOUS REMEDY IS BANNED HERE, WHICH IS WHY `inline` UNDERLINES
 * RATHER THAN TINTS. On this panel's ground `bg-info/10` drops `text-info` to
 * 4.05:1 and `bg-info/20` to 3.56:1 — both failing SC 1.4.3 — and the ratio
 * falls monotonically in alpha, so a smaller tint cannot rescue it. Two tinted
 * controls are already pinned as KNOWN_UNREPAIRED at 3.56:1 in
 * `reasoning-model-text-contrast-per-site.spec.ts`. An underline costs NO
 * contrast, so it is the one remedy that satisfies 1.4.1 without breaching
 * 1.4.3. `secondary` keeps its tint because it is a PILL: its shape already
 * carries the affordance, and its contrast debt is the pre-existing pinned one
 * rather than a new one this module introduces.
 */
export const ACTION_TIER = {
  /**
   * THE ONE ACT. A filled control, and the panel should carry at most one of
   * them in view — an emphasis every control shares is an emphasis none of
   * them has.
   */
  /**
   * ⚠⚠ IT CARRIES THE TOUCH TARGET TOO, AND FOR THE REASON `inline` ALREADY
   * RECORDS BELOW. #1655 put WCAG 2.2 AA §2.5.8 (24×24 CSS px) on `inline`
   * after finding the geometry applied at exactly one of twelve call sites.
   * ⛔ It fixed the tier it was looking at and did not ask the same question
   * of the others — so `primary` and `secondary` kept `py-0.5`, about 19px.
   *
   * Measured on deployed `d084e9a8`: `analysis-new-model-strip-target-edit`
   * ("Set a target") was 76×19 and the ONLY control under 24px at rest on the
   * whole panel. With the strip and every section opened, 27 of 77 controls
   * were under 24; this tier fix reaches the ones that NAME a tier, and the
   * bespoke remainder is rowed rather than swept up here.
   *
   * ⚠ `inline-flex items-center` IS PART OF THE GUARANTEE, not decoration:
   * `min-h` does nothing to a purely inline box, so the minimum would be
   * stated and not reached — the same note `inline` carries.
   *
   * ⚠ COST, MEASURED BY INJECTION ON THE DEPLOYED BUILD BEFORE SHIPPING: the
   * at-rest control 19px → 24px and the panel column 1292 → 1297 (+5px,
   * +0.39%). Fully expanded, fixing EVERY sub-24 control would cost +48px on
   * 5305 (+0.9%) — an upper bound this change does not spend.
   */
  primary: 'inline-flex items-center min-h-[24px] min-w-[24px] px-2 py-0.5 rounded bg-primary text-text-on-color',
  /**
   * A NAMED ACT beside the reading it belongs to. An OUTLINED pill: the shape
   * is the affordance, so the hue is doing no load-bearing work.
   *
   * ⛔⛔ OUTLINED, NOT TINTED, AND THE FIRST DRAFT OF THIS TIER GOT IT WRONG.
   * It shipped as `bg-info/10 … text-info` — copied from the seven existing
   * pills — and `reasoning-model-text-contrast-per-site` REDded on it by name
   * within one run: that pairing measures **4.05:1** against SC 1.4.3's 4.5:1,
   * and it is the exact figure documented three hours earlier in this same
   * module's `inline` note. A system built to end an inconsistency had
   * reproduced the inconsistency's worst instance, in one place, where every
   * future control would inherit it.
   *
   * ⭐ A BORDER COSTS NO TEXT CONTRAST. `text-info` on the untinted panel
   * ground is 4.78:1 and legal; the tint is what breaks it, and the ratio falls
   * monotonically in alpha so a lighter tint cannot rescue it.
   *
   * ⛔⛔ AND THE ALPHA IS MEASURED, BECAUSE MY FIRST VERSION ASSERTED IT AND WAS
   * WRONG. This shipped as `border-info/40` with a docblock claiming it met SC
   * 1.4.11's 3:1 non-text floor. **It is 1.74:1.** Caught by an independent
   * reviewer with the repo's own helper, and re-derived here:
   *
   *     border-info/40   --bg-panel 1.74:1   --bg-panel-hover 1.72:1   ⛔
   *     border-info/60   --bg-panel 2.37:1   --bg-panel-hover 2.33:1   ⛔
   *     border-info/70   --bg-panel 2.79:1   --bg-panel-hover 2.75:1   ⛔
   *     border-info/80   --bg-panel 3.35:1   --bg-panel-hover 3.27:1   ✅ first clearing both
   *
   * ⚠ THE SECOND COLUMN WAS LABELLED `canvas` AND IS `--bg-panel-hover`. The
   * NUMBERS were right — these are the two grounds the contrast register
   * declares (`PANEL_GROUNDS = ['--bg-panel', '--bg-panel-hover']`, and hover
   * is in scope because text must survive it) — but the HEADING named a
   * different surface. `--bg-canvas` is the ground BEHIND the panel and is not
   * a panel ground at all, so a reader checking this table against it would
   * find figures that do not reconcile and could not tell which half was wrong.
   *
   * ⛔ A mislabelled column in the table added to stop figures being asserted
   * rather than measured. Fourth error in this one file, and the third of them
   * inside something written to prevent its own class.
   *
   * ⚠ IT WAS NEVER A REGRESSION — the fill it replaced measures 1.14:1, so the
   * control improved either way. That is exactly why it was dangerous: a FALSE
   * FIGURE attached to a REAL improvement, in a token every future control
   * inherits, with nothing guarding it (the contrast scanner collects text and
   * icon utilities, not borders).
   *
   * ⭐ THE SAME SHAPE AS THE DEFECT THIS MODULE ALREADY CAUGHT IN ITSELF: a
   * documented figure the system then reproduces. First the 4.05:1 fill copied
   * in from the pills; then a 3:1 claim asserted rather than measured. Twice in
   * one file, and neither found by reading it.
   *
   * ⚠ SIX OF THE SEVEN TINTED PILLS ARE NOW CONVERTED; ONE IS NOT. They are
   * already pinned as KNOWN_UNREPAIRED at 3.56:1/4.05:1, and moving them is a
   * VISIBLE change rather than the class-identical de-duplication the other
   * conversions were. Converting them repairs five real failures and should be
   * done — as a deliberate visual change, banked by deleting their lines from
   * that pin, not smuggled in under a refactor.
   */
  /**
   * ⚠ CARRIES THE SAME TOUCH TARGET AS `primary` — see the note there. A tier
   * that is quieter is not a tier that may be harder to hit.
   */
  /**
   * ⚠ `text-info-ink`, NOT `text-info` — AND THE REASON IS COMPOSITIONAL, which
   * is why reading this tier in isolation could never find it. The tier is
   * border-only, so `text-info` sits on the bare panel at 4.78:1 and is legal.
   * But a PARENT may tint the ground under it: measured on the deployed build,
   * this pill inside `analysis-new-glance-primary-intervention` (a 6% info tint)
   * drops to 4.06:1, under SC 1.4.3's 4.5:1. The tier was solved for one ground
   * and then rendered on another.
   *
   * `--info-ink` is the same hue, dark enough to clear BOTH: 4.83:1 on the 6%
   * tint, 4.59:1 on 10%, 5.21:1 bare.
   */
  secondary: 'inline-flex items-center min-h-[24px] min-w-[24px] px-2 py-0.5 rounded-full border border-info/80 hover:border-info text-info-ink',
  /**
   * AN ACT INSIDE PROSE. Underlined AT REST, never on hover alone — see the
   * contrast note above.
   *
   * ⚠⚠ AND IT CARRIES ITS OWN TOUCH TARGET, WCAG 2.2 AA §2.5.8 (24×24 CSS px).
   * This geometry used to live in `CLAIM_TOGGLE_TOUCH_TARGET`, applied at
   * exactly ONE of twelve `action('inline')` call sites — so eleven acts
   * shipped at 15px high, including the ONLY route out of a withheld verdict
   * and the only route to how a run was worked out (both measured at 133×15
   * and 131×15 on deployed `d135ff7e`). A per-call-site remedy is a
   * hand-maintained mirror: every later call site misses it and nothing goes
   * red. The rationale that constant carried is kept here, with its geometry.
   *
   * ⚠ `inline-flex` IS PART OF THE GUARANTEE, NOT DECORATION: `min-h` does
   * nothing to a purely inline box, so declaring the minimum without the
   * display mode would be a target that is stated and not reached.
   *
   * ⚠ MEASURED BEFORE SHIPPING, on the deployed build by injection: both
   * live acts 15px → 24px, and the panel column grew 1288 → 1304 (+16px,
   * +1.2%) at rest. The other ten sites are inside collapsed sections and
   * cost nothing until opened.
   */
  inline: 'inline-flex items-center min-h-[24px] min-w-[24px] px-2 py-1 rounded text-info underline',
  /**
   * A TERTIARY ACT — present, reachable, and not competing. Also underlined at
   * rest: "quiet" is a claim about emphasis, never a licence to drop the
   * affordance.
   */
  /**
   * ⚠ THE TOUCH TARGET IS NOT A FUNCTION OF EMPHASIS. `quiet` has zero call
   * sites today, which is exactly why it gets the geometry now: a tier that is
   * missing it is discovered by its FIRST user shipping a 15px control, and
   * that is how `inline` shipped eleven of them.
   */
  /**
   * ⛔⛔ `min-w` ADDED 19 Sep 2026, AND THE DOCBLOCK ABOVE PREDICTED THIS
   * EXACTLY — through the one dimension it did not include.
   *
   * It says a tier missing the geometry "is discovered by its FIRST user
   * shipping a 15px control". `quiet` was then given `min-h-[24px]` and nothing
   * else, so its first ICON-ONLY user — the Strengthen row toggle (#1724) —
   * shipped `px-1` (4px a side) around a `w-3.5` icon: **4 + 14 + 4 = 22px
   * wide**, passing the height and failing the width.
   *
   * WCAG 2.2 AA §2.5.8 is 24×24, BOTH dimensions. A text control already
   * exceeds 24px by its content, so this is a no-op at every other call site —
   * it bites only the icon-only case, which is exactly the case that failed.
   */
  quiet: 'inline-flex items-center min-h-[24px] min-w-[24px] rounded text-text-light underline',
  /**
   * A NON-DIRECTIVE ACT — an outlined pill for something the panel offers
   * without recommending, e.g. recording a decision. Carries a border rather
   * than a fill so it reads as available, not urged.
   */
  neutral: 'inline-flex items-center min-h-[24px] min-w-[24px] px-2.5 py-1 rounded-full border border-panel-border hover:bg-panel-hover',
  /**
   * AN INFO TEXT-BUTTON, LED BY AN ICON — the prototype's `.textbutton`
   * shape (design-audit-20260925, gap ACTION-2): a control that is neither
   * underlined prose (`inline`) nor a pill (`secondary`), for an act whose
   * own leading glyph is the affordance. No consumer in this bundle's owned
   * files yet — declared here because this module is the one place a tier
   * may be added; the call site (`ChallengeCard.tsx`'s Respond act) belongs
   * to a different bundle.
   */
  text: 'inline-flex items-center gap-1 min-h-[24px] min-w-[24px] py-1 text-info hover:text-info-hover',
} as const

/**
 * ⭐⭐ THE ICON SCALE — THREE STEPS, KEYED TO DEPTH, NOT TO TASTE.
 *
 * Measured across `analysisNew`: FOUR square icon sizes (`w-3` x22, `w-3.5` x9,
 * `w-4` x8, `w-6` x1) with no rule, and **the same disclosure chevron rendering
 * at THREE of them** — `ChevronDown`/`ChevronRight` appear at `w-3`, `w-3.5` and
 * `w-4`. Four files use more than one size internally.
 *
 * ⚠ THE SIZES ARE MOSTLY RIGHT ALREADY, WHICH IS THE POINT. This is not a resize
 * — it is naming what was being chosen ad hoc, so the next icon inherits a
 * decision instead of guessing from whatever is nearest on screen. That is how
 * the four accumulated: each one was reasonable beside its neighbour.
 *
 * ⭐ DEPTH IS THE AXIS, and it is a real one. A section's own icon should not be
 * the same weight as an icon inside a sentence three levels into that section;
 * the hierarchy the panel draws with headings and zones should be drawn by its
 * icons too. So the scale encodes WHERE an icon sits, and a caller picks by
 * position rather than by size.
 *
 * ⛔ `w-6` IS NOT ON THIS SCALE AND MUST NOT JOIN IT. `SectionShell`'s 24px
 * slot is a CONTAINER that holds an icon, not an icon — sizing it from here
 * would make a slot and a glyph the same kind of thing. (It was a tinted
 * circle until the V2 no-tints rule; the slot is now untinted and only keeps
 * the glyph and the title where they were.)
 */
export const ICON_SCALE = {
  /** A section's own leading icon, and the disclosure chevron beside it. */
  section: 'w-4 h-4',
  /** A row inside a section — its chevron, its status mark. */
  row: 'w-3.5 h-3.5',
  /** Inside a line of text, where the glyph must not outweigh the words. */
  inline: 'w-3 h-3',
} as const

export type IconDepth = keyof typeof ICON_SCALE

/** `icon('row')` reads at the call site the way `action('quiet')` does. */
export function icon(depth: IconDepth): string {
  return ICON_SCALE[depth]
}

export type ActionTier = keyof typeof ACTION_TIER

/**
 * The focus treatment every control gets, baked in rather than left to callers.
 *
 * ⚠ NOT A CALLER'S CHOICE, for the same reason `PANEL_INSET_ACTION` owns its
 * hover: a control whose focus ring a caller supplies is a control that will
 * eventually ship without one. Measured on the pre-existing sweep — the focus
 * ring was the ONE thing all 48 controls already agreed on, which is what a
 * shared token is supposed to look like.
 */
export const ACTION_FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-info'

/** `action('inline')` → the complete className for a pressable control. */
export function action(tier: ActionTier): string {
  return `${ACTION_TIER[tier]} ${ACTION_FOCUS}`
}
