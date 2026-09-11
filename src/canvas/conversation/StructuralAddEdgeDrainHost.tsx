/**
 * Headless aiPanelV2 host for the durable add-edge drain.
 *
 * ⚠⚠ BOTH HOSTS FROM THE START, because a sibling's capability shipped DARK
 * once already under a fully green suite. `StructuralDeleteDrainHost`'s header
 * records it: that drain was hosted only in `DraftChat`, which `ReactFlowGraph`
 * mounts ONLY when `aiPanelV2` is OFF — and it is ON for every fresh user. The
 * queue was never drained and deleting the single call site left the whole suite
 * passing. Copying the mistake and fixing it later would be the estate paying
 * twice for one lesson.
 *
 * A SEPARATE component from its three siblings, deliberately, so no file's name
 * becomes a lie about what it hosts. It creates no second conversation and no
 * second turn transport: it consumes the canvas's existing
 * `ConversationProvider` singleton, exactly as they do.
 */

import { useConversationContext } from './ConversationContext'
import { useStructuralAddEdgeEvents } from './useStructuralAddEdgeEvents'

export function StructuralAddEdgeDrainHost(): null {
  const { sendSystemEvent } = useConversationContext()
  useStructuralAddEdgeEvents(sendSystemEvent)
  return null
}
