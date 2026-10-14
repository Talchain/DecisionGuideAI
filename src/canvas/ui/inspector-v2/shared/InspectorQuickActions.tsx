/**
 * Inspector actions reuse the existing explore payload. The live anatomy
 * labels the merged route Ask Olumi and accepts a specific examine sender;
 * legacy callers retain their original labels and optional conversation route.
 * The Router puts anatomy navigation in the header menu and renders this row
 * after panel content, outside every writer fence.
 *
 * Conversation actions are absent when no conversation surface is registered.
 * Extra controls such as Add option retain their own independent availability.
 */

import { useCallback, useMemo, type ReactNode } from 'react'

import { useGuidanceStore } from '../../../stores/guidanceStore'
import { requestAsk } from '../askSemantic'
import { resolveAskTemplate } from '../inspectorStrings'
import { inspectorButton, inspectorButtonPrimary, inspectorButtonRow } from '../inspectorStyle'

interface InspectorQuickActionsProps {
  /** Live anatomy uses the merged Ask label; legacy callers keep their copy. */
  variant?: 'legacy' | 'anatomy'
  /** A specific existing ask takes priority over the explore fallback. */
  onAsk?: () => void
  askTitle?: string
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
  /**
   * Leave out "Explore with Olumi": the pane already offers a SPECIFIC Olumi action for this element ("Examine with
   * Olumi", gate 5 item 3c). Two Olumi buttons for one link read as two different things to do.
   */
  omitExplore?: boolean
  /** A pane-specific action drawn in the same row (e.g. "+ Add option"). */
  extra?: ReactNode
}

export function InspectorQuickActions({
  variant = 'legacy',
  onAsk,
  askTitle,
  elementId,
  elementLabel,
  panelType,
  labelContext,
  askContext = '',
  onBackToConversation,
  extra,
  omitExplore = false,
}: InspectorQuickActionsProps) {
  const canAsk = useGuidanceStore(
    (s) => !!(s._dispatchAction || s._sendMessage || s._prefillChat),
  )

  const question = useMemo(() => {
    const templated = resolveAskTemplate(panelType, { label: elementLabel, ...labelContext })
    // Fallback keeps the action live for element types with no template rather
    // than silently dropping the affordance for exactly the unusual nodes a
    // user is most likely to have questions about.
    return templated ?? `Tell me about ${elementLabel} in this model.`
  }, [panelType, elementLabel, labelContext])

  const handleExplore = useCallback(() => {
    const landed = requestAsk({
      text: question,
      label: `Ask about ${elementLabel}`,
      context: askContext,
      targetId: elementId,
      intent: panelType === 'edge' ? 'link' : 'explain',
      ...(panelType === 'edge' ? { edgeIds: [elementId], nodeIds: [] } : { nodeIds: [elementId], edgeIds: [] }),
    })
    if (landed === 'none') window.dispatchEvent(new CustomEvent('topbar:show-toast', {
      detail: { message: 'Your question was not sent. Try again in the conversation.', level: 'warning' },
    }))
  }, [question, elementLabel, elementId, askContext, panelType])

  if (!canAsk && !extra) return null

  return (
    <div data-testid="inspector-quick-actions" className={`${inspectorButtonRow} pt-3`}>
      {canAsk && !omitExplore && (
        <button
          type="button"
          data-testid="inspector-quick-ask"
          onClick={onAsk ?? handleExplore}
          title={askTitle}
          aria-label={variant === 'anatomy' ? `Ask Olumi about ${elementLabel}` : `Explore with Olumi: ${elementLabel}`}
          className={inspectorButtonPrimary}
        >
          {variant === 'anatomy' ? 'Ask Olumi' : 'Explore with Olumi'}
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
