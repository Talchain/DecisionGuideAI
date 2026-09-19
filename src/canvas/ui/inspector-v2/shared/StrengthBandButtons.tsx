/**
 * StrengthBandButtons — quick-select buttons for edge strength bands (B.4).
 *
 * Renders a row of outlined pill buttons for Slight / Moderate / Strong / Very
 * strong. Each button discloses the exact signed value it will write; a
 * categorical label must not silently become an exact number attributed to the
 * user. Clicking a button preserves the current direction sign. The active band
 * is highlighted.
 *
 * ⚠ THE DISCLOSURE MOVED CHANNEL, IT DID NOT GO AWAY (19 Sep 2026). The face
 * used to carry the raw midpoint in mono 9px directly beneath the word — so the
 * pill read *"Slight 0.10"*, printing a model-internal float next to the very
 * word that exists to replace it. That is progressive disclosure inverted, and
 * it is the founder's complaint verbatim. The face now carries the word alone.
 *
 * ⛔⛔ AND THE FIRST ATTEMPT AT THAT MOVE WAS NOT ENOUGH — THE FIGURE WENT INTO
 * `title` + `aria-label` AND THAT IS AN ATTRIBUTE, NOT A DISCLOSURE (P1, same
 * day). The review put it exactly right: *"A sighted keyboard user can Tab to
 * Strong and press Space without seeing the 0.55 consequence; a touch user can
 * tap without a hover disclosure."* `title` renders on hover, on a mouse, on a
 * desktop — it is not a focus channel and it is not a touch channel. So the
 * promise in the paragraph above was true of the DOM and false of the person,
 * and these pills are the one control on this panel where that gap is a consent
 * defect rather than a polish one: THEY WRITE THE NUMBER AND STAMP IT AS THE
 * USER'S OWN STATED STRENGTH.
 *
 * ── THE DISCLOSURE IS NOW A REVEAL, ON EVERY ROUTE A USER CAN ARRIVE BY ──────
 *
 * One slot beneath the row states the consequence of the pill you are engaging
 * with, BEFORE you commit to it. Three channels, and the third is the one this
 * estate keeps forgetting:
 *
 *   · KEYBOARD — `onFocus` / `onBlur`. Tab onto Strong and the slot reads
 *     *"Strong: set strength to 0.55"*; Space then commits a number you have
 *     already seen. This is the P1 case verbatim, and it is pinned by a test
 *     that walks a REAL tab order and asserts `onChange` was NOT called.
 *   · MOUSE — `onMouseEnter` / `onMouseLeave`, the same slot, the same string.
 *     WCAG 2.1 AA 1.4.13 is the standard being met: content available on hover
 *     must be available on focus. `usePopoverHover.ts` cites the same clause for
 *     the node preview, for the same reason.
 *   · TOUCH — there is NO pre-commit interaction on a finger. A tap focuses and
 *     activates in one gesture, so a reveal keyed on either has nothing to fire
 *     before the write. When the browser reports no hover channel
 *     (`matchMedia('(hover: none)')`, the probe `usePopoverHover.ts` uses), the
 *     slot therefore states all four signed values AT REST. `NodeQuickActions
 *     .tsx` records the same conclusion for its coarse-pointer arm and calls it
 *     MANDATORY, not symmetry: a device with no hover cannot be served by a
 *     hover affordance, and pretending otherwise ships a control whose
 *     disclosure never appears.
 *
 * ⭐ NOTE WHAT THE TOUCH ARM COSTS AND WHAT IT DOES NOT. It is ONE line for the
 * WHOLE GROUP, not a figure back on each pill: the faces stay word-only on every
 * device, which was the whole point of the move. The clutter the founder
 * objected to was a float welded to each word, and that does not return here.
 *
 * ⛔ THE REVEAL IS REACT STATE, NOT A `group-hover:` TAILWIND VARIANT, AND THAT
 * IS DELIBERATE. A CSS reveal leaves the figure in the DOM at rest and only
 * paints it on hover — which jsdom cannot see at all, so every "revealed on
 * focus" test would pass BEFORE the focus and the suite would certify a
 * disclosure it had never observed. That is the same vacuity one channel along
 * from the one being fixed (CLAUDE.md trap 13). State makes the reveal a
 * transition the tests can watch, and can fail on.
 *
 * ⛔ AND IT IS DELIBERATELY *NOT* BEHIND `techMode`, THOUGH THAT IS THIS
 * SUBTREE'S USUAL DISCLOSURE GATE. `useTechToggle` defaults technical detail
 * OFF, so gating the figure behind it would make it ABSENT for every default
 * user — precisely when they are authoring. "Is the face cluttered for a
 * newcomer?" and "does the clicker know what they are about to author?" are two
 * different questions; they are named apart here rather than reconciled by
 * moving a default (CLAUDE.md trap 21). The clean face answers the first; the
 * reveal answers the second; neither concedes the other.
 *
 * ⚠ THE SIGN IS PART OF THE CONSEQUENCE, AND IT USED NOT TO BE. On a negative
 * edge the write has always preserved the minus — and every disclosure channel
 * printed the positive magnitude, so a pill offered `0.55` and committed
 * `-0.55`. A disclosure that states a different number from the one it writes is
 * the defect above, one level down. Fixed by DERIVATION rather than by
 * restatement: `presets` below computes the signed value ONCE, and that single
 * value is both what `onChange` receives and what every channel prints. They
 * cannot drift, because there is nothing to drift.
 *
 * ⚠ THE BANDS ARE IMPORTED, NOT RESTATED (18 Sep 2026). This file used to carry
 * its own `BANDS` array under the comment *"Thresholds align with
 * inspectorStrings.ts getStrengthLabel()"* — four labels, four cuts and four
 * midpoints, hand-kept in lockstep with the contract's table one directory
 * along. They aligned on the day they were typed, and nothing would have gone
 * red when they stopped (CLAUDE.md trap 12). That mattered more here than
 * anywhere else on the canvas, because these buttons WRITE THE MIDPOINT INTO
 * THE MODEL: a cut that drifted would have stamped a number the user did not
 * choose under a word that no longer described it. `CANVAS_STRENGTH_BANDS`
 * (`domain/vocabulary.ts`) is now the only copy.
 */

import { memo, useMemo, useState, useEffect } from 'react'
import { typography } from '../../../../styles/typography'
import { CANVAS_STRENGTH_BANDS, getCanvasStrengthBand } from '../../../domain/vocabulary'

interface StrengthBandButtonsProps {
  /** Current signed strength value (-1 to +1) */
  value: number
  /** Callback with new signed strength value (band midpoint with current sign preserved) */
  onChange: (signedValue: number) => void
  /**
   * ⛔ NOBODY HAS STATED A STRENGTH — LIGHT NOTHING.
   *
   * Without this the component highlights a band derived from `value`, and for a
   * link the user just drew that value is `USER_EDGE_DEFAULTS.weight` (0.3) —
   * so the UI would PROPOSE a number nobody supplied, with `aria-pressed="true"`
   * on it. Accepting the highlighted band would then stamp `weightSource: 'user'`
   * and turn a fabricated default into a stated fact.
   *
   * `captureStructuralAddEdge`'s header calls putting that exact constant on the
   * wire *"a fabricated number reaching the model through the one door this
   * estate guards hardest"*. The wire guard holds; this is the same defect
   * arriving through the pixels, and this flag is where it is refused.
   *
   * DISPLAY-LEVEL ONLY — there is deliberately no second store field.
   */
  unset?: boolean
}

export const StrengthBandButtons = memo(function StrengthBandButtons({
  value,
  onChange,
  unset = false,
}: StrengthBandButtonsProps) {
  const absMagnitude = Math.abs(value)
  const isNegative = value < 0

  /**
   * ⭐ ONE VALUE PER BAND, AND EVERY CHANNEL READS IT.
   *
   * `signedMidpoint` is what `onChange` is handed AND what `disclosure` prints,
   * so the sentence a user reads before committing is built out of the very
   * number that commit will write. A future edit cannot make one signed and the
   * other not; there is a single expression.
   *
   * Note `isNegative` is `value < 0`, which is FALSE for `-0` — so a `-0` input
   * takes the un-negated branch and the write stays byte-identical to the
   * canonical midpoint. The write tests assert that with `Object.is`.
   */
  const presets = useMemo(
    () =>
      CANVAS_STRENGTH_BANDS.map(band => {
        const signedMidpoint = isNegative ? -band.midpoint : band.midpoint
        return {
          band,
          signedMidpoint,
          disclosure: `${band.label}: set strength to ${signedMidpoint.toFixed(2)}`,
        }
      }),
    [isNegative],
  )

  // ⚠ THE `-1` ARM IS LOAD-BEARING AND IS NOT WHAT `getCanvasStrengthBand` RETURNS.
  // The canonical resolver is TOTAL — it falls through to the lowest band for
  // any input, including `NaN`, so that no caller can be handed `undefined`.
  // This component needs the opposite for a non-number: "light nothing" is the
  // same refusal the `unset` prop below exists for, and lighting *Slight* on a
  // value that is not a value would propose a band nobody supplied. So the
  // finiteness check stays here, where the display decision lives, and the
  // table stays total where the domain decision lives.
  const activeBandIndex = useMemo(() => {
    if (!Number.isFinite(absMagnitude)) return -1
    return CANVAS_STRENGTH_BANDS.indexOf(getCanvasStrengthBand(absMagnitude))
  }, [absMagnitude])

  /** Index of the band the user is currently engaging with, by focus or by pointer. */
  const [engagedIndex, setEngagedIndex] = useState<number | null>(null)

  /**
   * Does this device have a hover channel at all? Read once, from the browser,
   * the same way `usePopoverHover.ts` reads it. Defaults to "yes" so a server
   * render or a matchMedia-less environment gets the quiet face rather than the
   * fallback one — the fallback is for devices that have PROVEN they cannot
   * hover, not for every environment that cannot answer the question.
   */
  const [hasHoverChannel, setHasHoverChannel] = useState(true)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    setHasHoverChannel(!window.matchMedia('(hover: none)').matches)
  }, [])

  /**
   * What the slot says right now. Engagement wins over the touch fallback: if a
   * touch browser DOES focus the button, the specific consequence is better than
   * the list.
   */
  const revealed =
    engagedIndex !== null && engagedIndex < presets.length
      ? presets[engagedIndex].disclosure
      : hasHoverChannel
        ? null
        : `Each preset writes, in order: ${presets.map(p => p.signedMidpoint.toFixed(2)).join(', ')}`

  return (
    <div className="mb-2">
      <div className="flex gap-1" role="group" aria-label="Strength presets">
        {presets.map(({ band, signedMidpoint, disclosure }, i) => {
          // `unset` wins over any derived band — see the prop's note.
          const isActive = !unset && activeBandIndex === i
          return (
            <button
              key={band.label}
              type="button"
              onClick={() => onChange(signedMidpoint)}
              // Both engage channels clear only their OWN index, so a leave
              // arriving after the next button's enter cannot blank a slot that
              // now belongs to a different pill.
              onFocus={() => setEngagedIndex(i)}
              onBlur={() => setEngagedIndex(prev => (prev === i ? null : prev))}
              onMouseEnter={() => setEngagedIndex(i)}
              onMouseLeave={() => setEngagedIndex(prev => (prev === i ? null : prev))}
              aria-label={disclosure}
              title={disclosure}
              className={`${typography.panelMeta} px-2 py-1 rounded-full bg-transparent border transition-colors cursor-pointer inline-flex flex-col items-center leading-tight
                ${isActive
                  ? 'border-primary text-primary'
                  : 'border-panel-border text-text-light hover:border-text-light hover:bg-panel-hover'
                }`}
              aria-pressed={isActive}
              data-testid={`strength-band-${band.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <span>{band.label}</span>
            </button>
          )
        })}
      </div>
      {/*
        The slot is ALWAYS in the DOM and reserves its own height, so revealing a
        consequence cannot shove the rest of the panel down the moment a pill
        takes focus — a row that jumps as you Tab along it is its own usability
        defect, and the one thing worse than an undisclosed number is a
        disclosure that moves the control away from the pointer.

        NOT an `aria-live` region and NOT `aria-hidden`. Every button already
        carries the same sentence as its accessible name, so announcing it again
        on focus would double-speak it; this slot exists for the SIGHTED keyboard
        and touch users the review named, and it stays in the accessibility tree
        for anyone browsing the panel by structure.
      */}
      <div
        className={`${typography.panelMeta} text-text-light min-h-[1rem] mt-1`}
        data-testid="strength-preset-consequence"
      >
        {revealed}
      </div>
    </div>
  )
})
