import { memo, useCallback, useRef, useState, type ReactNode } from 'react'
import { MessageCircleQuestion } from 'lucide-react'
import { OkIcon, OkIconButton } from '../../olumiView/look/icons'
import { useAnchoredTip } from '../../olumiView/look/Tip'
import { Hover } from '../../olumiView/v12/chat/Hover'
import { useCanvasStore } from '../store'
import { typo } from '../../styles/typography'
import { isOlumiCoreLane } from '../../olumiCore/lane'
import { CHIP_CLASS } from '../../v5/blocks/chipClass'
import { useGuidanceStore } from '../stores/guidanceStore'
import { useSelectionContext } from '../hooks/useSelectionContext'
import { useInspectorPresenceStore } from '../stores/inspectorPresenceStore'

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

/** The fold's two names (fixed chrome). */
export const SELECTION_DETAIL_WORDS = { hide: 'Hide this card’s details', show: 'Show this card’s details' } as const

/**
 * What the lane says about the selected card (whose it is, what its headline rests on, its next step, its explanation: core's words), drawn
 * CLOSED when a card is selected (S4 esc3, 19 Nov: it opened at 377 px of a 704 px panel and repeated the details box); one press on the info icon opens it,
 * and a newly selected card starts closed again (keyed by the selection).
 */
function SelectionDetail({ children }: { children: ReactNode }): JSX.Element {
  // Closed until the person opens it: a card press never opens it (Paul's bar: the composer does not grow under a press, and nothing is said twice).
  const [open, setOpen] = useState(false)
  const words = open ? SELECTION_DETAIL_WORDS.hide : SELECTION_DETAIL_WORDS.show
  const tip = useAnchoredTip(words)
  return (
    <details className="basis-full" data-testid="selection-detail" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="inline-flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-full text-text-light hover:text-text-header" aria-label={words} {...tip.handlers} onClick={tip.dismiss} aria-describedby={tip.describedBy} data-testid="selection-detail-toggle"><OkIcon id="info-more" size={14} decorative /></summary>
      {tip.tip}
      <div className="ok-selected flex flex-wrap items-center gap-1.5">{children}</div>
    </details>
  )
}

/** `after`: what a lane offers for this selection at the end of the row (the olumi-core lane: a card's Rename, DL 7 Nov); none elsewhere. */
export const SelectionPill = memo(function SelectionPill({ after, mark, chip = false, onAsk, useQuiet }: { /** Surfaces step 4: a hook (stable function) telling, for the selected id, that another surface already draws what `after` would add (the lane's open details panel); the chip row then holds the chip alone. */ useQuiet?: (id: string) => boolean; /** The lane's own Ask for the selection (olumi-core, menu brief UI-D): given the selected element, it takes the place of the legacy sender, which that lane never registers. */ onAsk?: (s: { id: string; label: string; kind: 'node' | 'edge' }) => void; /** The chip's kind shape: the selected card's own mark (olumiView/SelectedRename `selectedKindMark`), drawn before "About:". */ mark?: (s: { id: string; kind: 'node' | 'edge' }) => ReactNode; after?: (s: { id: string; kind: 'node' | 'edge' }) => ReactNode; /** The olumi-core lane (17 Nov, the calm panel): the selection is drawn as ONE chip inside the composer, "About: <card heading>" with an X to clear it, and what `after` offers is one press behind its info icon. */ chip?: boolean } = {}) {
  const selection = useSelectionContext()
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
    if ((!sendChip && !onAsk) || !label || !selectionId) return
    const last = sentRef.current
    if (last && last.id === selectionId && Date.now() - last.at < REFIRE_GUARD_MS) return
    sentRef.current = { id: selectionId, at: Date.now() }
    if (onAsk && selection) { onAsk({ id: selection.id, label, kind: selection.kind }); return }
    sendChip?.(`Ask about ${label}`, `Ask about ${label}.`)
  }, [sendChip, onAsk, selection, label, selectionId])

  // Design audit #14: a card click opens the inspector only. While it is open
  // it names the element and offers "Explore with Olumi", so this row stands
  // down and returns when the inspector closes.
  const inspectorOpen = useInspectorPresenceStore((s) => s.open)
  const quiet = useQuiet?.(selectionId) ?? false

  if (!selection || inspectorOpen) return null

  const canAsk = Boolean(sendChip) || onAsk !== undefined

  // V11 pixel pass (9 Nov): on the olumi-core lane the row is on Paul's three sizes (12 px, never the legacy 11).
  const meta: 'viewPanelMeta' | 'panelMeta' = isOlumiCoreLane() ? 'viewPanelMeta' : 'panelMeta'
  if (chip) {
    const extra = quiet ? null : after?.(selection), shape = mark?.(selection)
    return (
      <div className="flex flex-wrap items-center gap-1 px-2 pt-1.5" data-testid="ai-panel-selection-pill" data-selection-kind={selection.kind} data-selection-actionable={canAsk ? 'true' : 'false'}>
        {/* D2 (independent review of 833c1609): "About: <label>" is a label, never a button that sends; asking is its own visible control beside it
            (the registry's ask-about-this, neutral, with its hover), keeping the chip's test id. The card's own kind shape leads the label. */}
        <span className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-panel-border bg-panel-hover pl-2 ${typo(meta, 'text-text-body')}`} data-testid="selection-chip">
          {shape == null ? null : <span aria-hidden="true" className="inline-flex flex-none">{shape}</span>}
          <Hover words={label} className="line-clamp-2 min-w-0 break-words" data-testid="selection-chip-label">About: {label}</Hover>
          {canAsk ? <OkIconButton id="ask-about-this" words={`Ask about ${label}`} testid="selection-ask-chip" size={14} className="h-6 w-6 hover:text-text-header" onClick={ask} /> : null}
          <OkIconButton id="cancel-close" words="Clear the selection" testid="selection-pill-clear" size={12} className="h-6 w-6 rounded-full hover:text-text-header" onClick={() => useCanvasStore.getState().clearSelection()} />
        </span>
        {extra == null ? null : <SelectionDetail key={selection.id}>{extra}</SelectionDetail>}
      </div>
    )
  }
  return (
    <div
      // DL-538 (the target's selected card): on the olumi-core lane the row is drawn as a card (olumiLook.css `.ok-selected`).
      className={`px-3 py-1 flex items-center gap-1.5 flex-wrap${isOlumiCoreLane() ? ' ok-selected' : ''}`}
      data-testid="ai-panel-selection-pill"
      data-selection-kind={selection.kind}
      data-selection-actionable={canAsk ? 'true' : 'false'}
    >
      <span className={typo(meta, 'text-text-light')}>Selected:</span>
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
            meta,
            'text-text-body text-left break-words underline decoration-dotted underline-offset-2 hover:text-info focus:outline-none focus-visible:ring-2 focus-visible:ring-info rounded-sm',
          )}
          aria-label={`Ask about ${label}`}
          title={`Ask about ${label}`}
          data-testid="selection-pill-ask"
        >
          {label}
        </button>
      ) : (
        <span className={typo(meta, 'text-text-body break-words')}>{label}</span>
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
      {after?.(selection)}
    </div>
  )
})
