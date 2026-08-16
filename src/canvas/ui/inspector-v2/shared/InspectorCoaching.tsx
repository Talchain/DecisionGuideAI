/**
 * InspectorCoaching — unified coaching component for inspector panels.
 *
 * Priority: orchestrator GuidanceItems > static coaching text.
 * Maximum ONE coaching card visible. If a GuidanceItem exists for this element,
 * it renders instead of the static fallback.
 *
 * ⚠ THIS COMPONENT USED TO AUTO-SEND (ledger L-18, a trap-21 pair). "Ask about
 * this" dispatched via `_sendMessage` immediately, while the inspector's OTHER
 * ask affordance (DiscussWithAiButton) prefilled an editable draft and waited.
 * Same user intent, opposite semantics, one panel. Auto-send is the half that
 * lies: the question lands in a surface the user may not be looking at, so the
 * control reads as dead.
 *
 * Both now run the ONE semantic in `askSemantic.ts` — prefill-and-confirm.
 * The ask never dispatches; the user presses Send.
 *
 * ONE deliberate exception, and it is not an ask: `run_exercise` is a slash
 * COMMAND whose button IS the confirmation. A prefilled '/exercise …' would sit
 * in the composer as literal text instead of executing.
 *
 * Replaces the separate CoachingCard + InspectorGuidanceSection pattern.
 */

import { useMemo, useCallback } from 'react'
import { useGuidanceStore, compareGuidanceDisplayOrder } from '../../../stores/guidanceStore'
import { revealOlumiSurface } from '../../../conversation/revealOlumi'
import { CoachingCard } from './CoachingCard'
import { resolveAskTemplate } from '../inspectorStrings'
import { requestAsk } from '../askSemantic'

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
    // matches. Within each group, the shared display-order doctrine decides
    // (UI-SEM-085: producer rank ascending; unranked by urgency descending).
    return [...items].sort((a, b) => {
      const aDirect = a.target_object?.id === elementId ? 1 : 0
      const bDirect = b.target_object?.id === elementId ? 1 : 0
      if (bDirect !== aDirect) return bDirect - aDirect
      return compareGuidanceDisplayOrder(a, b)
    })[0]
  }, [guidanceItems, elementId])

  // Resolve the question text
  const questionText = useMemo(
    () => resolveAskTemplate(panelType, labelContext),
    [panelType, labelContext],
  )

  // ASK — the one semantic. Lands an editable draft the user sends; never
  // dispatches. Routing (composer vs drawer) is askSemantic's decision.
  const ask = useCallback((text: string) => {
    requestAsk({
      text,
      label: 'Ask about this',
      context: '',
      targetId: elementId,
    })
  }, [elementId])

  // COMMAND — not an ask. The button is the confirmation, and a prefilled
  // slash command would sit in the composer as literal text.
  const runCommand = useCallback((text: string) => {
    const state = useGuidanceStore.getState()
    if (state._sendMessage) {
      state._sendMessage(text)
      revealOlumiSurface()
    }
  }, [])

  // Handle "Ask about this" — prefill the contextual question for the user
  const handleAsk = useCallback(() => {
    if (!questionText) return
    ask(questionText)
  }, [questionText, ask])

  // Handle guidance item action
  const handleGuidanceAction = useCallback(() => {
    if (!topGuidanceItem) return
    const action = topGuidanceItem.primary_action

    switch (action.type) {
      case 'discuss':
        ask(action.prompt)
        break
      case 'run_exercise':
        // Slash command: a COMMAND, not an ask — see the header note.
        runCommand(`/exercise ${action.exercise}`)
        break
      default:
        // For other action types, fall back to "Ask about this"
        if (questionText) ask(questionText)
    }
  }, [topGuidanceItem, questionText, ask, runCommand])

  // Determine text and action
  const text = topGuidanceItem?.title
    ? `${topGuidanceItem.title}${topGuidanceItem.detail ? ` ${topGuidanceItem.detail}` : ''}`
    : fallbackText

  // ⚠ A `run_exercise` item kept the ASK label ("Ask about this") while
  // AUTO-SENDING a slash command — a control labelled as one semantic doing
  // the other, inside the very component this PR unified. Labelled for what it
  // does, using the estate's EXISTING word for this action class
  // (`GuidanceStrip.tsx` / `InspectorGuidanceSection.tsx` both say 'Try it')
  // rather than minting a third vocabulary for the same enum.
  const guidanceActionLabel = topGuidanceItem
    ? guidanceActionLabelFor(topGuidanceItem.primary_action.type, actionLabel)
    : actionLabel

  const action = canInteract
    ? {
        label: guidanceActionLabel,
        onClick: topGuidanceItem ? handleGuidanceAction : handleAsk,
      }
    : undefined

  return <CoachingCard text={text} action={action} />
}

/**
 * Label for a guidance action. `discuss` and the default are ASKS and keep the
 * ask wording; `run_exercise` is a COMMAND and must not wear an ask's label.
 * Kept in step with the shared table in `GuidanceStrip` / `InspectorGuidanceSection`.
 */
function guidanceActionLabelFor(type: string, askLabel: string): string {
  switch (type) {
    case 'discuss':      return 'Discuss'
    case 'run_exercise': return 'Try it'
    default:             return askLabel
  }
}
