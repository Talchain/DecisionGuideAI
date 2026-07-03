/**
 * InspectorCoaching — unified coaching component for inspector panels.
 *
 * Priority: orchestrator GuidanceItems > static coaching text.
 * Maximum ONE coaching card visible. If a GuidanceItem exists for this element,
 * it renders instead of the static fallback. "Ask about this" SENDS the question
 * to Olumi immediately (via the guidance store's registered _sendMessage) and
 * reveals the chat. Falls back to prefilling the composer only if the send wire is
 * unavailable.
 *
 * Replaces the separate CoachingCard + InspectorGuidanceSection pattern.
 */

import { useMemo, useCallback } from 'react'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { revealOlumiSurface } from '../../../conversation/revealOlumi'
import { CoachingCard } from './CoachingCard'
import { resolveAskTemplate } from '../inspectorStrings'

interface InspectorCoachingProps {
  /** Node or edge ID for guidance filtering */
  elementId: string
  /** Panel type for question template resolution */
  panelType: string
  /** Static coaching text (fallback when no guidance items) */
  fallbackText: string
  /** Label context for "Ask about this" question templates */
  labelContext: { label?: string; sourceLabel?: string; targetLabel?: string }
  /** Custom action label (default: "Ask about this") */
  actionLabel?: string
}

export function InspectorCoaching({
  elementId,
  panelType,
  fallbackText,
  labelContext,
  actionLabel = 'Ask about this',
}: InspectorCoachingProps) {
  // Check if chat interaction is available (prefill or send)
  const canInteract = useGuidanceStore(s => s._prefillChat !== null || s._sendMessage !== null)

  // Get guidance items for this element (sorted by priority, take top 1)
  const guidanceItems = useGuidanceStore(s => s.guidanceItems)
  const topGuidanceItem = useMemo(() => {
    // Match by target_object.id OR any related_elements[].id. The latter surfaces
    // element-targeted items (e.g. WEAKLY_CONNECTED_NODE) whose primary target
    // is a different element but which carry additional element refs.
    const items = guidanceItems.filter(i =>
      i.target_object?.id === elementId
      || i.related_elements?.some(r => r.id === elementId),
    )
    if (items.length === 0) return null
    // Direct target_object.id matches take precedence over related_elements
    // matches. Within each group, highest priority wins.
    return [...items].sort((a, b) => {
      const aDirect = a.target_object?.id === elementId ? 1 : 0
      const bDirect = b.target_object?.id === elementId ? 1 : 0
      if (bDirect !== aDirect) return bDirect - aDirect
      return b.priority - a.priority
    })[0]
  }, [guidanceItems, elementId])

  // Resolve the question text
  const questionText = useMemo(
    () => resolveAskTemplate(panelType, labelContext),
    [panelType, labelContext],
  )

  // Send the text to Olumi immediately (auto-send) and reveal the chat. Falls back
  // to prefilling the composer only if the send wire is unavailable.
  const sendToChat = useCallback((text: string) => {
    const state = useGuidanceStore.getState()
    if (state._sendMessage) {
      state._sendMessage(text)
      revealOlumiSurface()
    } else if (state._prefillChat) {
      state._prefillChat(text)
      revealOlumiSurface()
    }
  }, [])

  // Handle "Ask about this" — send the contextual question to Olumi
  const handleAsk = useCallback(() => {
    if (!questionText) return
    sendToChat(questionText)
  }, [questionText, sendToChat])

  // Handle guidance item action
  const handleGuidanceAction = useCallback(() => {
    if (!topGuidanceItem) return
    const action = topGuidanceItem.primary_action

    switch (action.type) {
      case 'discuss':
        sendToChat(action.prompt)
        break
      case 'run_exercise':
        sendToChat(`/exercise ${action.exercise}`)
        break
      default:
        // For other action types, fall back to "Ask about this"
        if (questionText) sendToChat(questionText)
    }
  }, [topGuidanceItem, questionText, sendToChat])

  // Determine text and action
  const text = topGuidanceItem?.title
    ? `${topGuidanceItem.title}${topGuidanceItem.detail ? ` ${topGuidanceItem.detail}` : ''}`
    : fallbackText

  const guidanceActionLabel = topGuidanceItem
    ? (topGuidanceItem.primary_action.type === 'discuss' ? 'Discuss' : actionLabel)
    : actionLabel

  const action = canInteract
    ? {
        label: guidanceActionLabel,
        onClick: topGuidanceItem ? handleGuidanceAction : handleAsk,
      }
    : undefined

  return <CoachingCard text={text} action={action} />
}
