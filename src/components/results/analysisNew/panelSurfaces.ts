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
export const PANEL_SURFACE = 'rounded-md border px-3 py-2.5'

/**
 * A box nested INSIDE a section box. Same rule, one level down.
 */
export const PANEL_INSET = 'rounded border px-2 py-1.5'

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
  success: 'border-success/30 bg-success/[0.05]',
  /** A caveat the reader must carry into the reading. */
  warning: 'border-warning/30 bg-warning/[0.05]',
  /** Worth stopping on, but nothing went wrong — the diverged implication. */
  info: 'border-info/30 bg-info/10',
  /** A grouped surface with no border of its own to speak of. */
  muted: 'border-panel-border bg-panel-hover',
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
export const PANEL_INSET_ACTION = 'rounded px-2 py-1.5 bg-info/[0.06] hover:bg-info/10'

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
  primary: 'px-2 py-0.5 rounded bg-primary text-text-on-color',
  /**
   * A NAMED ACT beside the reading it belongs to. An OUTLINED pill: the shape
   * is the affordance, so the hue is doing no load-bearing work.
   *
   * ⛔⛔ OUTLINED, NOT TINTED, AND THE FIRST DRAFT OF THIS TIER GOT IT WRONG.
   * It shipped as `bg-info/10 … text-info` — copied from the five existing
   * pills — and `reasoning-model-text-contrast-per-site` REDded on it by name
   * within one run: that pairing measures **4.05:1** against SC 1.4.3's 4.5:1,
   * and it is the exact figure documented three hours earlier in this same
   * module's `inline` note. A system built to end an inconsistency had
   * reproduced the inconsistency's worst instance, in one place, where every
   * future control would inherit it.
   *
   * ⭐ A BORDER COSTS NO TEXT CONTRAST. `text-info` on the untinted panel
   * ground is 4.78:1 and legal; the tint is what breaks it, and the ratio falls
   * monotonically in alpha so a lighter tint cannot rescue it. The border
   * carries the pill shape at SC 1.4.11's 3:1 non-text floor instead.
   *
   * ⚠ THE FIVE EXISTING TINTED PILLS ARE NOT CONVERTED TO THIS YET. They are
   * already pinned as KNOWN_UNREPAIRED at 3.56:1/4.05:1, and moving them is a
   * VISIBLE change rather than the class-identical de-duplication the other
   * conversions were. Converting them repairs five real failures and should be
   * done — as a deliberate visual change, banked by deleting their lines from
   * that pin, not smuggled in under a refactor.
   */
  secondary: 'px-2 py-0.5 rounded-full border border-info/40 hover:border-info text-info',
  /**
   * AN ACT INSIDE PROSE. Underlined AT REST, never on hover alone — see the
   * contrast note above.
   */
  inline: 'rounded text-info underline',
  /**
   * A TERTIARY ACT — present, reachable, and not competing. Also underlined at
   * rest: "quiet" is a claim about emphasis, never a licence to drop the
   * affordance.
   */
  quiet: 'rounded text-text-light underline',
  /**
   * A NON-DIRECTIVE ACT — an outlined pill for something the panel offers
   * without recommending, e.g. recording a decision. Carries a border rather
   * than a fill so it reads as available, not urged.
   */
  neutral: 'px-2.5 py-1 rounded-full border border-panel-border hover:bg-panel-hover',
} as const

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
