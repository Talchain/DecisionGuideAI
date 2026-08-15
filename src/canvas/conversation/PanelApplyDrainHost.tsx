/**
 * Headless aiPanelV2 host for the panel-to-canvas apply handoff.
 *
 * The legacy DraftChat owns this drain while aiPanelV2 is OFF. With the flag
 * ON, DraftChat is deliberately unmounted, so the drain lives here under the
 * canvas's existing ConversationProvider and consumes its singleton sender.
 * It never creates a second conversation or turn transport.
 */

import { useCallback } from 'react'
import { useParams } from 'react-router-dom'

import { useCanvasStore } from '../store'
import { useConversationContext } from './ConversationContext'
import { usePanelApplyDrain } from './usePanelApplyDrain'
import { useGraphEditEvents } from './useGraphEditEvents'

export function PanelApplyDrainHost(): null {
  const { id: scenarioIdFromRoute } = useParams<{ id: string }>()
  const currentScenarioId = useCanvasStore((state) => state.currentScenarioId)
  const graphRevision = useCanvasStore((state) => state.nodes)
  const { sendSystemEvent, isThinking } = useConversationContext()

  // aiPanelV2 unmounts DraftChat, so host the ONE graph-diff owner here under
  // the existing conversation provider. It feeds both generic notifications
  // and the canonical edge-strength coordinator through the same sender.
  useGraphEditEvents(sendSystemEvent, { isThinking })

  const lookupNodeData = useCallback(
    (targetId: string): unknown =>
      useCanvasStore.getState().nodes.find((node) => node.id === targetId)?.data,
    [],
  )

  usePanelApplyDrain({
    // The route is the requested model's identity. The store may still name
    // the previous scenario for a render while async hydration catches up.
    scenarioId: scenarioIdFromRoute,
    graphReady:
      scenarioIdFromRoute !== undefined && currentScenarioId === scenarioIdFromRoute,
    graphRevision,
    lookupNodeData,
    sendSystemEvent,
  })

  return null
}
