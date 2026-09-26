/**
 * InspectorQuickActions — the inspector's two conversation routes.
 *
 * R5, Paul's own formulation (16 Aug 2026): "Full functionality stays in the
 * inspector and may be DUPLICATED there (quick actions at the top of the
 * inspector). Efficiency principle: minimise clicks to power functionality;
 * nothing buried." — so these stay at the TOP of the body.
 *
 * ⭐ CANVAS VISUAL CONTRACT v3.1 (DESIGN-GAP-v31 row 7; point 11): the buttons
 * are "Explore with Olumi" and "Back to the conversation", drawn as the
 * contract's `.button.small.primary` / `.button.small`. What left:
 *
 *  · "Ask Olumi" is RENAMED, not removed — same `requestAsk` semantic, same
 *    test id (`inspector-quick-ask`): it never dispatches, it lands an editable
 *    draft about THIS element that the user sends.
 *  · "Change this" is REMOVED. It was a second edit route beside the title's
 *    rename, the value editors and the conversation — the served header showed
 *    a dashed title, a pencil, "Change this" and "Change" at once (the pile-up
 *    the contract replaces with ONE edit route). Asking Olumi to change the
 *    element is exactly what "Explore with Olumi" drafts; the read-only
 *    notice's own remedy ("ask Olumi to change structure") still names it.
 *  · "Its analysis" is REMOVED. It switched the dock to the generic Analysis
 *    tab — not this element's analysis — and the Analysis tab is one click away
 *    in the dock's own strip.
 *  · "Back to results" (formerly in the header) becomes "Back to the
 *    conversation": it FRONTS the conversation (`revealOlumiSurface`, the one
 *    oracle for "which surface is Olumi on") and closes the inspector. Closing
 *    does not clear the selection, so the element stays as the conversation's
 *    context (the dock's "Selected" row) — v3.1: "keeping the element as
 *    context".
 *
 * Both are HIDDEN — not disabled, not silently inert — when no conversation
 * surface is registered, because a control that looks live and does nothing is
 * the dead-button class this estate keeps shipping.
 */

import { useCallback, useMemo, type ReactNode } from 'react'

import { useGuidanceStore } from '../../../stores/guidanceStore'
import { requestAsk } from '../askSemantic'
import { resolveAskTemplate } from '../inspectorStrings'
import { inspectorButton, inspectorButtonPrimary, inspectorButtonRow } from '../inspectorStyle'

interface InspectorQuickActionsProps {
  /** Node or edge id — the ask's model target. */
  elementId: string
  /** User-facing name of the element, used in the question and the labels. */
  elementLabel: string
  /** Panel type, for the shared ask-question template table. */
  panelType: string
  /** Extra label context for edge templates. */
  labelContext?: { sourceLabel?: string; targetLabel?: string }
  /**
   * Paul 23 Sep contract feedback point 11 — the context line an ask carries
   * (e.g. why the element is "Worth reviewing"). Shown by the Ask-Olumi drawer;
   * the composer path already carries the element through `selected_elements`.
   * Empty means no context, never an invented one.
   */
  askContext?: string
  /** "Back to the conversation" — fronts the conversation and closes. */
  onBackToConversation?: () => void
  /** A pane-specific action drawn in the same row (e.g. "+ Add option"). */
  extra?: ReactNode
}

export function InspectorQuickActions({
  elementId,
  elementLabel,
  panelType,
  labelContext,
  askContext = '',
  onBackToConversation,
  extra,
}: InspectorQuickActionsProps) {
  const canAsk = useGuidanceStore(
    (s) => s._prefillChat !== null || s._sendMessage !== null || s._dispatchAction !== null,
  )

  const question = useMemo(() => {
    const templated = resolveAskTemplate(panelType, { label: elementLabel, ...labelContext })
    // Fallback keeps the action live for element types with no template rather
    // than silently dropping the affordance for exactly the unusual nodes a
    // user is most likely to have questions about.
    return templated ?? `Tell me about ${elementLabel} in this model.`
  }, [panelType, elementLabel, labelContext])

  const handleExplore = useCallback(() => {
    requestAsk({
      text: question,
      label: `Ask about ${elementLabel}`,
      context: askContext,
      targetId: elementId,
    })
  }, [question, elementLabel, elementId, askContext])

  if (!canAsk && !extra) return null

  return (
    <div data-testid="inspector-quick-actions" className={`${inspectorButtonRow} pt-3`}>
      {canAsk && (
        <button
          type="button"
          data-testid="inspector-quick-ask"
          onClick={handleExplore}
          aria-label={`Explore with Olumi: ${elementLabel}`}
          className={inspectorButtonPrimary}
        >
          Explore with Olumi
        </button>
      )}
      {canAsk && onBackToConversation && (
        <button
          type="button"
          data-testid="inspector-back-to-conversation"
          onClick={onBackToConversation}
          className={inspectorButton}
        >
          Back to the conversation
        </button>
      )}
      {extra}
    </div>
  )
}
