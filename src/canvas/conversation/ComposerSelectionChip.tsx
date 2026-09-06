/**
 * ⭐ THE COMPOSER'S SELECTION CHIP — "you point; you don't retype."
 *
 * WHAT THIS FIXES, and it is not a missing feature. `selected_elements` has
 * shipped on the wire for some time: the UI derives typed refs from the canvas
 * selection, and CEE resolves them against canonical state and consumes node
 * ids as a strict deterministic value-update tie-breaker — not a prompt hint.
 * So "click the node, then say `set it to 40%`" ALREADY resolves correctly.
 *
 * Nobody does it, because the composer said nothing. A channel the user cannot
 * see is a channel the user cannot use, so the whole capability sat dark behind
 * a working wire. That is this estate's most-repeated finding (the frontier
 * coaching questions were live, tested and invisible for the same reason), and
 * it is why this component is three dozen lines rather than a feature.
 *
 * ⚠ IT RENDERS THE WIRE'S OWN ANSWER, NEVER A SECOND OPINION. Every claim here
 * comes from `describeSelectionCarriage`, which calls the same function the
 * send leg calls. The alternative — re-reading the store and deciding for
 * itself — would be a hand-maintained mirror of the wire rule, and every one of
 * that rule's withholding branches is a case where the chip would promise an
 * attachment the payload does not make. "Asking about X" while the wire
 * withholds X is precisely the class of lie this product exists not to tell.
 *
 * ⚠ AND IT MUST NOT GO SILENT ON A WITHHELD SELECTION. Absence and withholding
 * are the same to the wire and completely different to the user: one means the
 * turn carries no selection, the other means the user has selected something,
 * believes it is attached, and it is not. Silence is true of the first and a
 * false statement by omission about the second — so they are named apart and
 * the withheld cases say what happened and what to do.
 *
 * A SECOND DEFECT THIS CLOSES, incidentally but not accidentally: nothing
 * clears the canvas selection when a turn is sent (`clearSelection` had exactly
 * one caller, `FocusModeChip`'s exit button) and creating a node auto-selects.
 * A sticky, INVISIBLE selection means a user can ground an answer in something
 * they have forgotten pointing at. Sticky and VISIBLE is fine — and now
 * dismissible from where the user is already looking.
 */

import { memo, useMemo, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { typo } from '../../styles/typography'
import { useCanvasStore } from '../store'
import { describeSelectionCarriage } from './selectedElementRefs'

export interface ComposerSelectionChipProps {
  /** Test id of the owning composer, so the chip answers to its host. */
  readonly testId: string
}

/**
 * Truncation is DISPLAY-ONLY and never reaches the wire. The wire carries the
 * full label; this bounds the chip so a long node title cannot push the send
 * control out of the composer. The title attribute keeps the whole string
 * available, so nothing is destroyed — only folded.
 */
const MAX_CHIP_LABEL = 32

export const ComposerSelectionChip = memo(function ComposerSelectionChip({
  testId,
}: ComposerSelectionChipProps) {
  // Primitive/stable-reference selectors only. These three slices are replaced
  // wholesale by the store when they change, so their identity is a correct
  // change signal and this cannot loop (React #185 — the same care
  // `FocusModeChip` documents).
  const selection = useCanvasStore((s) => s.selection)
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const clearSelection = useCanvasStore((s) => s.clearSelection)

  const carriage = useMemo(
    () => describeSelectionCarriage({ selection, nodes, edges }),
    [selection, nodes, edges],
  )

  if (carriage.kind === 'none') return null

  const dismiss = (
    <button
      type="button"
      onClick={clearSelection}
      className="shrink-0 p-0.5 text-sky-500 hover:text-sky-600 rounded-full hover:bg-sky-100/50 transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
      aria-label="Clear selection"
      title="Clear selection"
      data-testid={`${testId}-selection-clear`}
    >
      <X size={14} />
    </button>
  )

  let body: ReactNode
  if (carriage.kind === 'carried') {
    const [first, ...rest] = carriage.refs
    // No label means the contract had nothing truthful to carry for it — say
    // "this element" rather than inventing a name or leaking the internal node
    // type, which is neither the user's vocabulary nor ours to show.
    const name = first.label ?? 'this element'
    const shown = name.length > MAX_CHIP_LABEL ? `${name.slice(0, MAX_CHIP_LABEL - 1)}…` : name
    body = (
      <span className={typo('panelBody', 'text-text-body min-w-0 truncate')}>
        Asking about{' '}
        <strong className="font-medium" title={name}>
          {shown}
        </strong>
        {rest.length > 0 ? ` and ${rest.length} more` : ''}
      </span>
    )
  } else if (carriage.kind === 'withheld_over_cap') {
    body = (
      <span className={typo('panelBody', 'text-text-body min-w-0')}>
        {carriage.selectedCount} selected — too many to ask about. Narrow it to {carriage.cap} or
        fewer.
      </span>
    )
  } else {
    body = (
      <span className={typo('panelBody', 'text-text-body min-w-0')}>
        That selection is no longer in the model, so this message won&rsquo;t carry it.
      </span>
    )
  }

  return (
    <div
      // Sits INSIDE the composer's own bordered box, above the textarea, so it
      // reads as part of the message being composed rather than as a separate
      // notice about it. A divider, not a second box — the input already has a
      // border and nesting one inside it would say "different object".
      className="flex items-center gap-2 px-3 pt-2 pb-1.5 border-b border-panel-border"
      role="status"
      aria-live="polite"
      data-testid={`${testId}-selection-chip`}
      data-carriage={carriage.kind}
    >
      {body}
      {dismiss}
    </div>
  )
})

export default ComposerSelectionChip
