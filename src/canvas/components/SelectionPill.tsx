import { memo, useCallback, useRef } from 'react'
import { MessageCircleQuestion } from 'lucide-react'
import { typo } from '../../styles/typography'
import { CHIP_CLASS } from '../../v5/blocks/chipClass'
import { useGuidanceStore } from '../stores/guidanceStore'
import { useSelectionContext, useSelectionCarriage } from '../hooks/useSelectionContext'

/**
 * SelectionPill — the canvas selection's conversation affordance.
 *
 * Renders directly above the persistent input strip whenever exactly ONE canvas
 * element is selected. Hidden when nothing (or more than one element) is
 * selected.
 *
 * ── L-17: WHY THIS IS NO LONGER A LABEL ────────────────────────────────────
 * Selecting a connector used to produce two pieces of GREY TEXT and no way to
 * act on either: a `Selected: X → Y` pill with no `onClick`, and a composer
 * PLACEHOLDER reading "Ask about X → Y…". A placeholder is an attribute, not
 * content — the composer's value stayed empty, so the sentence the product
 * appeared to have written could not be sent. Measured again on 16 Aug (UI
 * `f15bccaf`): "composer VALUE empty ... Grey, non-submittable, exactly as
 * filed."
 *
 * The selection is now a REAL, SUBMITTABLE control:
 *   · the pill itself dispatches the selection-grounded turn on click;
 *   · a compact chip beside it dispatches the SAME turn — one code path, so the
 *     two affordances can never come to mean different things (the trap-21
 *     shape this estate has already paid for once, with two inspector
 *     "ask about this" affordances carrying opposite semantics);
 *   · the composer placeholder returns to NEUTRAL (`useStageAwarePlaceholder`),
 *     because a placeholder that looks like a prepared sentence is precisely
 *     what made this ambiguous.
 * Both controls are ordinary buttons, so click, tap and keyboard all reach the
 * same handler (R5's every-hover-action-has-a-click-equivalent rule).
 *
 * ── WHAT CARRIES THE SELECTION ─────────────────────────────────────────────
 * Nothing here has to name the element on the wire. `buildPayload`'s
 * `deriveSelectedElements` reads the live store on EVERY send and attaches
 * `selected_elements` — so the turn this dispatches is selection-grounded by
 * the same mechanism a typed question would be. The label is display copy, not
 * a wire identity, and is never used as one.
 *
 * ── FAIL CLOSED ────────────────────────────────────────────────────────────
 * With no conversation host registered there is nothing to send, so the
 * controls are not rendered at all and the pill degrades to the read-only label
 * it used to be. A dead affordance is the defect this component exists to
 * remove; re-introducing one on the unregistered path would be the same defect
 * with a nicer border.
 */

/** Guard window for the single-flight ref — long enough to swallow a double-click. */
const REFIRE_GUARD_MS = 500

export const SelectionPill = memo(function SelectionPill() {
  const selection = useSelectionContext()
  const carriage = useSelectionCarriage()
  // Subscribed, not read imperatively: the controls must appear the moment a
  // conversation host registers, without waiting for an unrelated re-render.
  const sendChip = useGuidanceStore((s) => s._sendChip)
  /**
   * Single-flight guard, keyed by the SELECTION it fired for — not a bare
   * boolean.
   *
   * A boolean swallowed a legitimate second question: select A, ask, select B,
   * ask again inside the guard window, and the second click was a silent no-op
   * with no feedback of any kind. The guard exists to absorb a DOUBLE-CLICK on
   * one selection; a different selection is a different question and must
   * always get through.
   */
  const sentRef = useRef<{ id: string; at: number } | null>(null)

  const label = selection?.label ?? ''
  /**
   * ONE dispatch for both controls.
   *
   * Display text and submitted message are the SAME sentence the control shows,
   * so the user's own bubble in the permanent transcript records exactly what
   * the button promised. Nothing is invented on the user's behalf: the UI asks
   * the question its label states, and the element identity travels as
   * `selected_elements`, not as prose.
   */
  const selectionId = selection?.id ?? ''
  const ask = useCallback(() => {
    if (!sendChip || !label || !selectionId) return
    const last = sentRef.current
    if (last && last.id === selectionId && Date.now() - last.at < REFIRE_GUARD_MS) return
    sentRef.current = { id: selectionId, at: Date.now() }
    sendChip(`Ask about ${label}`, `Ask about ${label}.`)
  }, [sendChip, label, selectionId])

  if (!selection) {
    /**
     * ⭐ A WITHHELD SELECTION IS NOT THE SAME AS NO SELECTION, and going quiet
     * on it is a false statement by omission.
     *
     * `useSelectionContext` returns null for three different situations. Two of
     * them are honest silence — nothing selected, or a multi-element selection
     * this single-element pill was never meant to describe. The third is the
     * user pointing at something the turn will NOT carry: an over-cap
     * selection, or one that no longer resolves. There the user believes their
     * question is grounded and it is not, so the pill says so and says what to
     * do about it.
     *
     * Note the deliberate silence on a carried MULTI-element selection: the
     * wire does carry it, so there is no falsehood to correct, and this pill's
     * whole grammar ("Selected: <name>") is single-element. Speaking there
     * would need a different surface, not a different sentence here.
     */
    if (carriage.kind === 'withheld_over_cap' || carriage.kind === 'withheld_unresolvable') {
      return (
        <div
          className="px-3 py-1 flex items-center gap-1.5 flex-wrap"
          data-testid="ai-panel-selection-pill"
          data-selection-carriage={carriage.kind}
          role="status"
          aria-live="polite"
        >
          <span className={typo('panelMeta', 'text-text-light')}>
            {carriage.kind === 'withheld_over_cap'
              ? `${carriage.selectedCount} selected \u2014 too many to ask about. Narrow it to ${carriage.cap} or fewer.`
              : 'That selection is no longer in the model, so a question won\u2019t carry it.'}
          </span>
        </div>
      )
    }
    return null
  }

  const canAsk = Boolean(sendChip)

  return (
    <div
      className="px-3 py-1 flex items-center gap-1.5 flex-wrap"
      data-testid="ai-panel-selection-pill"
      data-selection-kind={selection.kind}
      data-selection-carriage={carriage.kind}
      data-selection-actionable={canAsk ? 'true' : 'false'}
    >
      <span className={typo('panelMeta', 'text-text-light')}>Selected:</span>
      {canAsk ? (
        <button
          type="button"
          onClick={ask}
          // WRAP, NEVER TRUNCATE: an edge label is "source → target" and is
          // routinely wider than the dock. `break-words` keeps whole words
          // intact and lets the row grow; the previous `truncate max-w-[220px]`
          // cut names mid-word, which is the same artefact the confirm card was
          // criticised for.
          className={typo(
            'panelMeta',
            'text-text-body text-left break-words underline decoration-dotted underline-offset-2 hover:text-info focus:outline-none focus-visible:ring-2 focus-visible:ring-info rounded-sm',
          )}
          aria-label={`Ask about ${label}`}
          title={`Ask about ${label}`}
          data-testid="selection-pill-ask"
        >
          {label}
        </button>
      ) : (
        <span className={typo('panelMeta', 'text-text-body break-words')}>{label}</span>
      )}
      {canAsk && (
        <button
          type="button"
          onClick={ask}
          className={`${CHIP_CLASS} shrink-0`}
          aria-label={`Ask about ${label}`}
          data-testid="selection-ask-chip"
        >
          <MessageCircleQuestion size={12} aria-hidden="true" className="mr-1 inline-block" />
          Ask about this
        </button>
      )}
    </div>
  )
})
