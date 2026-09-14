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
