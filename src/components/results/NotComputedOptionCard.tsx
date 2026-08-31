/**
 * NotComputedOptionCard — the option the analysis RAN ON and could not compute.
 *
 * ## The state this replaces, and why it was worse than nothing
 *
 * ISL classifies each option's computation; `'failed'` means `n_valid === 0` —
 * zero finite Monte Carlo samples, so there is no distribution behind any
 * number attached to the option. That classification reached PLoT, and PLoT put
 * it on the wire per option. The UI's mappers then rebuilt the option object key
 * by key and dropped it, so the surface re-derived a worse classification of its
 * own: the option rendered as a fully ranked card with a hard **`0%`** and a
 * zero-width fill bar. In the same run, a genuine measured zero at n=10,000
 * rendered `"<0.01%"`. The two were distinguishable only by an accident of which
 * fallback arm a missing sample count happened to take.
 *
 * So the defect was not a missing number. It was a FABRICATED MEASUREMENT
 * sitting in the slot that answers "how often did this option come out ahead",
 * on a card carrying a rank swatch and an ordinal — i.e. the product asserting
 * that an option it never scored came last.
 *
 * ## Why a SEPARATE COMPONENT, and not a variant of NotAnalysedOptionCard
 *
 * That card's own header sets out why forking beats guards, and the same
 * argument applies again here: `OptionCard` has seven places a number or an
 * ordinal can appear, and a marked option must reach NONE of them. What it does
 * NOT justify is REUSING that card, because it answers a different question and
 * says a different thing:
 *
 *   - `NotAnalysedOptionCard` — the option was NOT IN THE ANALYSIS. Derived from
 *     the producer's omission. Its copy attributes the gap to configuration and,
 *     on one of its two reasons, offers the user a step that fixes it.
 *   - THIS CARD — the option WAS in the analysis and the COMPUTATION failed.
 *     Stated by the producer. Its copy attributes the gap to the run and offers
 *     no step, because there is none.
 *
 * An option can be ANALYSED AND NOT COMPUTED, so these are not two spellings of
 * one state (CLAUDE.md trap 21). Rendering the "Not analysed" pill here would
 * blame the user for an engine outcome — the same "lie about whose fault it is"
 * that `isAnalysedOption` refuses to tell in the other direction.
 *
 * ## What it deliberately does NOT render
 *
 * No rank marker · no ordinal · no win percentage · no fill bar · no expected
 * value · no goal bar · no range bar. Not "rendered as zero", not "rendered as
 * '—'": absent. A dash in a ranked column still asserts membership in the
 * ranking, and a zero-width bar in a track of bars is a measured claim.
 *
 * ## No resolve affordance, on purpose
 *
 * There is nothing a user can do about a degenerate sample draw. Offering a
 * configure step would prescribe a futile action, which is worse than a
 * disclosure that simply reports — the rule `not_returned` already follows on
 * the sibling card. `onFocusNode` is offered because finding the option on the
 * canvas is a real, non-futile thing to do, and it is the same shared handler
 * and the same shared label the sibling card uses.
 */

import { typography } from '../../styles/typography'
import { NOT_COMPUTED_BADGE, notComputedReasonCopy } from './utils/notAnalysedCopy'
import { FOCUS_ON_CANVAS_LABEL } from './utils/focusOnCanvasCopy'
import type { OptionResult } from './types'

export interface NotComputedOptionCardProps {
  /** Must carry `computeStatus === 'failed'`; the caller owns that fork. */
  option: OptionResult
  /** Focus this option's node on the canvas, when the host offers it. */
  onFocusNode?: (nodeId: string) => void
}

export function NotComputedOptionCard({ option, onFocusNode }: NotComputedOptionCardProps) {
  return (
    <div
      className="bg-panel p-3 border border-dashed border-panel-border rounded-lg space-y-2"
      data-testid={`option-card-not-computed-${option.id}`}
      data-option-id={option.id}
    >
      <div className="flex items-center gap-2">
        {/* No rank swatch and no "Option N" — the two ordinals the ranked card
            renders in this slot. The gap is the point. */}
        <span className={`${typography.panelHeader} text-text-header`}>{option.label}</span>
        <span
          className={`${typography.panelMeta} inline-flex items-center px-2 py-0.5 rounded-full bg-transparent border border-panel-border text-text-light flex-shrink-0`}
          data-testid={`not-computed-badge-${option.id}`}
        >
          {NOT_COMPUTED_BADGE}
        </span>
      </div>

      <p
        className={`${typography.panelBody} text-text-light`}
        data-testid={`not-computed-reason-${option.id}`}
      >
        {/* The producer's own reason when it sent one, appended to the
            sanctioned sentence — never substituted for it. See
            `notComputedReasonCopy`: no live capture carries a reason, so the
            absent arm is the common path and has to stand alone. */}
        {notComputedReasonCopy(option.computeStatusReason)}
      </p>

      {onFocusNode && (
        <div className="flex items-center gap-1 pt-1.5">
          <button
            type="button"
            data-testid={`not-computed-focus-${option.id}`}
            onClick={(e) => {
              e.stopPropagation()
              onFocusNode(option.id)
            }}
            className={`${typography.panelMeta} text-info border border-info/30 rounded-full px-2.5 py-1 bg-transparent hover:bg-panel-hover cursor-pointer`}
          >
            {/* Read from the shared owner, exactly as NotAnalysedOptionCard
                does — holding a second label for one handler is how one of them
                came to promise editing. */}
            {FOCUS_ON_CANVAS_LABEL}
          </button>
        </div>
      )}
    </div>
  )
}

export default NotComputedOptionCard
