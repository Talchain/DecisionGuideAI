/**
 * GroundedFocusNotice — the one thing the canvas must SAY, rather than show,
 * about a grounded answer (hop 4b).
 *
 * ⭐ WHY THIS COMPONENT EXISTS AT ALL, because a marker on a node would
 * otherwise be the whole slice.
 *
 * When a turn is grounded on the user's selection, CEE reports why anything
 * they pointed at is missing, as a closed three-value enum. Two of those values
 * MUST NOT collapse:
 *
 *   · `not_in_model`    — the graph WAS read and does not contain it. Marking
 *                         nothing is honest, and this component renders
 *                         nothing. The absence of a mark IS the answer.
 *   · `could_not_check` — the graph could NOT be read. We do not know whether
 *                         it is there. An empty canvas here would tell the
 *                         user their node is gone on the strength of a lookup
 *                         that never happened.
 *
 * Without this notice both states render identically — nothing marked — and
 * the UI would reintroduce at the pixel layer exactly the conflation CEE's
 * hop 3 and hop 4 were built to keep apart. The visible difference between the
 * two is the acceptance condition for this slice, and this is where it lives.
 *
 * ⚠ IT IS NOT A FAILURE BANNER. `could_not_check` is a turn that answered; it
 * simply could not verify the selection against the model. The copy says what
 * is not known, and claims nothing about the element either way.
 */

import { memo } from 'react'
import { useCanvasStore } from '../store'

interface GroundedFocusNoticeProps {
  /** Optional className for positioning overrides. */
  className?: string
}

export const GroundedFocusNotice = memo(function GroundedFocusNotice({
  className = '',
}: GroundedFocusNoticeProps) {
  // React #185: primitive selector. Selecting the slice object would change
  // reference on every store write and re-render this on every canvas action.
  // Optional chaining keeps store doubles without the slice safe, matching the
  // idiom every other emphasis selector in this canvas uses.
  const unresolved = useCanvasStore((s) => s.groundedFocus?.unresolved ?? null)

  // Rendered for EXACTLY ONE of the three values. `none` is a fully resolved
  // grounding (the marks say it), `not_in_model` is honestly silent, and
  // `null` is a turn that was never grounded.
  if (unresolved !== 'could_not_check') return null

  return (
    <div
      className={`
        inline-flex items-center gap-2 px-4 py-2
        bg-paper-50 border border-sand-200 rounded-full
        shadow-[0_1px_2px_rgba(38,38,38,0.06)]
        transition-opacity duration-200
        motion-reduce:transition-none
        ${className}
      `}
      role="status"
      aria-live="polite"
      data-testid="grounded-focus-could-not-check"
    >
      <span className="text-sm text-ink-900">
        {/* Says what is NOT known. Never "not found" — that is the claim this
            whole component exists to stop the UI making. */}
        I couldn’t read your model to check what you selected, so I can’t show
        it on the canvas.
      </span>
    </div>
  )
})

export default GroundedFocusNotice
