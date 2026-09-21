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
/**
 * ⭐⭐ A FENCED FIELD MUST LOOK FENCED — the regression that `editableField`
 * would otherwise have introduced.
 *
 * Several inspector writers sit inside `<fieldset disabled={readOnly}>` writer
 * fences (`data-writer-fence="..."`), because this estate's rule is *fence the
 * writers with no server carrier; leave live the ones that reach the model* —
 * decided per WRITER, never per panel. Giving those controls the same warm fill
 * and 3.7:1 border as a live field would advertise an edit the product will
 * refuse: a MORE convincing lie than the invisible field it replaced, because
 * the user would now act on it.
 *
 * ⚠ `:disabled` propagates from a disabled `<fieldset>` to the form controls
 * inside it, so this fires on a fenced writer without the panel having to pass
 * anything down — which matters, since the fence is applied at the fieldset and
 * the control often does not know it is fenced.
 */
const DISABLED_FENCE =
  // ⚠ `border-panel-border`, NOT `border-default`. The low-contrast token
  // `--border-default-rgb` is registered as `colors.panel.border`, so Tailwind
  // generates `border-panel-border`; `border-default` resolves to NOTHING and
  // emitted no CSS, so the fenced state's border silently did not render either.
  // Caught by `controls.classesResolve.spec.ts` — the same class of defect as
  // `border-field`, in the same file, found by the guard written for the first.
  ' disabled:bg-panel disabled:border-panel-border disabled:text-text-light disabled:cursor-not-allowed'

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
    'w-full rounded-md bg-panel-hover border border-field focus:border-primary outline-none px-2 py-1 transition-colors' +
    DISABLED_FENCE,

  /**
   * A control that accepts typed prose.
   *
   * Identical box to `editableField`; `resize-none` because the inspector is a
   * fixed-width column and a user-dragged corner reflows the panel.
   */
  editableTextarea:
    'w-full rounded-md bg-panel-hover border border-field focus:border-primary outline-none px-2.5 py-1.5 resize-none transition-colors' +
    DISABLED_FENCE,

  /**
   * ⭐ THE RESTING HALF OF A CLICK-TO-EDIT VALUE — and the defect that
   * `editableField` alone did NOT fix.
   *
   * `InlineNumberEditor` is the primary control on the observable-factor and
   * risk panels: the number a user clicks to change what the model records. In
   * its resting state it was a bare `<button>` carrying
   *
   *     text-left w-full cursor-text hover:bg-panel-hover rounded px-0.5
   *
   * — no border, no fill, no cue. Its ONLY visible affordance was `hover:`,
   * which requires the pointer to already be on it. So the field a user must
   * find in order to edit anything announced itself exclusively to someone who
   * had already found it. That is the same defect as the transparent input one
   * layer earlier, and fixing the input left it untouched, because on these two
   * panels **the input does not exist until the button has been clicked.**
   *
   * ⚠ THE BOX MATCHES `editableField` DELIBERATELY. Same radius, same padding,
   * same border token — so clicking swaps the readout for a cursor with **no
   * layout shift**, and a person reading the panel sees one consistent shape
   * meaning "you can change this". The old pair shifted the number by ~6px on
   * click, which reads as a glitch rather than as entering a field.
   */
  editableResting:
    'w-full text-left rounded-md bg-panel-hover border border-field hover:border-primary cursor-text px-2 py-1 transition-colors' +
    // ⚠ THE RESTING CONTROL NEEDS THE FENCE TREATMENT MORE THAN THE INPUT DOES,
    // and this was missing from the first cut of it.
    //
    // `InspectorRouter`'s else-branch wraps every NON-authority panel in a
    // `<fieldset disabled>`. `InlineNumberEditor`'s only two call sites —
    // observable factor and risk — are both in that branch, so the live box
    // above would have rendered on a control the product has deliberately
    // fenced: the most convincing possible lie about what can be edited.
    // `:disabled` matches a `<button>` inside a disabled fieldset exactly as it
    // does an input, which the spec beside this pins rather than assumes.
    DISABLED_FENCE +
    // A pencil on a fenced control is a promise, so the cue goes with the box.
    // `group-disabled:` because the cue is a CHILD of the button that carries
    // both the `group` marker and the disabled state.
    ' disabled:hover:border-panel-border',

  /**
   * The pencil cue beside a resting editable value.
   *
   * Kept as an idiom rather than reinvented: `EditableLabel`'s rename trigger
   * already uses a pencil, and two different cues for one meaning is exactly
   * the inconsistency this module exists to stop.
   */
  editableCue:
    'shrink-0 text-text-light group-hover:text-info group-disabled:hidden transition-colors',

  /**
   * ⭐ A CHIP THE USER PICKS FROM — and the reason it is here is a measured
   * population, not consistency for its own sake.
   *
   * The external-factor panel's quick-set range buttons are the PRIMARY, always
   * visible way to give a factor a prior range. That matters because the
   * deployed product **refuses an analysis** when a factor is *"recorded as a
   * bare amount with no range"* — and `analyticalNodeFields.ts:175` records that
   * a factor's prior is *"analysis-affecting… the input ISL samples for external
   * factors"*. **14 of 34 factors on the five shipped starters are `external`**,
   * so this is the remedy control for two fifths of the board.
   *
   * Its SELECTED state used `border-primary` and was fine. Its UNSELECTED state
   * used `border border-panel-border` on `bg-panel` — a **1.23 : 1** edge against
   * the panel's own background, i.e. five text labels floating with no visible
   * boundary. The identical defect as the invisible input, on the control that
   * answers a refusal.
   *
   * ⚠ NOT A SWEEP. `border border-panel-border` has 27 uses in `inspector-v2`,
   * about 5 of them on interactive buttons. Only this one has a population
   * argument today, so only this one moves; the rest are recorded as follow-up
   * rather than changed on a hunch. A token here means the next chip is correct
   * by construction without licensing a 27-site edit nobody measured.
   */
  selectableChip: {
    base: 'px-2.5 py-1 rounded-full cursor-pointer capitalize border transition-colors',
    selected: 'border-primary text-primary bg-panel',
    /** `border-field` is the 3.70:1 token; `bg-panel-hover` on hover keeps the
     *  existing feedback. */
    unselected: 'border-field text-text-light bg-panel hover:bg-panel-hover hover:border-primary',
  },
} as const
