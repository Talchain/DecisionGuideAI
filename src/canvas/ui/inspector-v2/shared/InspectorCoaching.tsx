/**
 * InspectorCoaching — unified coaching component for inspector panels.
 *
 * Priority: orchestrator GuidanceItems > static coaching text.
 * Maximum ONE coaching card visible. If a GuidanceItem exists for this element,
 * it renders instead of the static fallback.
 *
 * Ask actions submit chip questions through the shared builder and reveal Olumi.
 * Exercises map to the question table; navigation and existing approval cards
 * perform the guidance item's own action.
 *
 * Replaces the separate CoachingCard + InspectorGuidanceSection pattern.
 *
 * ⭐⭐ v3.1 (DESIGN-GAP-v31 row 32): NO GENERIC FALLBACK ANY MORE. The static
 * `fallbackText` ("Consider options that pull different levers to increase
 * differentiation.", "… may benefit from an industry benchmark. Even a rough
 * anchor would improve confidence.") rendered as a lightbulb card in EVERY
 * inspector whether or not anything grounded it — the generic coaching card
 * the contract drops. Only a GROUNDED item — an orchestrator guidance item that
 * targets or relates to THIS element — renders now. The element's own
 * question is one click away as "Explore with Olumi", and its card on the
 * canvas carries its prepared question on the coaching icon (v3.1 point 6).
 *
 * `fallbackText` stays in the props so the eight panes that pass it need not
 * change (one of them sits in another open PR); it is not rendered.
 */

import { useMemo, useCallback } from 'react'
import { useGuidanceStore, compareGuidanceDisplayOrder } from '../../../stores/guidanceStore'
import { revealOlumiSurface } from '../../../conversation/revealOlumi'
import { CoachingCard } from './CoachingCard'
import { openNodeInspector } from '../../../nodes/shared/openNodeInspector'
import { requestAsk, canReceiveAsk } from '../askSemantic'

interface InspectorCoachingProps {
  /** Node or edge ID for guidance filtering */
  elementId: string
  /** Panel type for question template resolution */
  panelType: string
  /** Retired by v3.1 (no generic fallback card). Accepted, not rendered. */
  fallbackText: string
  /** Label context for "Ask about this" question templates */
  labelContext: { label?: string; sourceLabel?: string; targetLabel?: string }
  /** Custom action label (default: "Ask about this") */
  actionLabel?: string
}

export function InspectorCoaching({
  elementId,
  panelType,
  labelContext: _labelContext,
  actionLabel = 'Ask about this',
}: InspectorCoachingProps) {
  // Questions require the chip dispatcher.
  const canInteract = useGuidanceStore(canReceiveAsk)

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

  const ask = useCallback((intent: 'evidence' | 'explain' | 'pre-mortem' | 'method:opposite' | 'challenge') => {
    requestAsk({ text: 'Ask about this', label: 'Ask about this', targetId: elementId,
      intent: panelType === 'edge' ? 'question-link' : intent })
  }, [elementId, panelType])

  const handleGuidanceAction = useCallback(() => {
    if (!topGuidanceItem) return
    const action = topGuidanceItem.primary_action
    switch (action.type) {
      case 'discuss':
        ask(topGuidanceItem.signal_code === 'evidence_gap' ? 'evidence' : 'explain')
        break
      case 'run_exercise':
        ask(action.exercise === 'pre_mortem' ? 'pre-mortem'
          : action.exercise === 'devil_advocate' ? 'method:opposite' : 'challenge')
        break
      case 'open_inspector': {
        if (action.field) useGuidanceStore.setState({ inspectorDeepLinkField: action.field })
        openNodeInspector(action.node_id)
        break
      }
      case 'approve_patch': {
        const patchId = action.operations[0]?.patch_id
        useGuidanceStore.getState()._scrollToPatch?.(typeof patchId === 'string' ? patchId : topGuidanceItem.item_id)
        revealOlumiSurface()
        break
      }
      case 'navigate':
        if (action.target.startsWith('#') || action.target.startsWith('/')) window.location.hash = action.target
        break
    }
  }, [topGuidanceItem, ask])

  // v3.1: grounded only — no guidance item for this element, no card.
  if (!topGuidanceItem) return null

  // Determine text and action
  const text = topGuidanceItem.title
    ? `${topGuidanceItem.title}${topGuidanceItem.detail ? ` ${topGuidanceItem.detail}` : ''}`
    : null
  if (!text) return null

  // ⚠ A `run_exercise` item kept the ASK label ("Ask about this") while
  // AUTO-SENDING a slash command — a control labelled as one semantic doing
  // the other, inside the very component this PR unified. Labelled for what it
  // does, using the estate's EXISTING word for this action class
  // (`GuidanceStrip.tsx` / `InspectorGuidanceSection.tsx` both say 'Try it')
  // rather than minting a third vocabulary for the same enum.
  const guidanceActionLabel = guidanceActionLabelFor(topGuidanceItem.primary_action.type, actionLabel)

  const action = canInteract
    ? { label: guidanceActionLabel, onClick: handleGuidanceAction }
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
