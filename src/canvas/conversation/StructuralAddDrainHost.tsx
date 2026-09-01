/**
 * Headless aiPanelV2 host for the durable-add drain.
 *
 * ⚠⚠ BOTH HOSTS FROM THE START, for the reason `StructuralRenameDrainHost`'s
 * header records: `StructuralDeleteDrainHost`'s sibling shipped DARK under a
 * fully green suite because it was hosted only in `DraftChat`, which
 * `ReactFlowGraph.tsx` mounts ONLY when `aiPanelV2` is OFF — and it is ON for
 * every fresh user (`flags.ts` `defaultValue: true`, `netlify.toml` "true", the
 * literal baked into the deployed bundle, and a DOM census of deployed staging
 * finding `floating-olumi-panel` and no `draft-chat`). The queue was never
 * drained and deleting the single call site left the whole suite green.
 *
 * So this drain gets `DraftChat` for flag-off and this component for flag-on,
 * mounted unconditionally inside `MaybeConversationProvider`. Paying a third
 * time for one lesson would be the estate's own worst habit.
 *
 * It is deliberately a SEPARATE component from its two siblings so that no
 * file's name becomes a lie about what it hosts. It creates no second
 * conversation and no second turn transport: it consumes the canvas's existing
 * `ConversationProvider` singleton, exactly as its siblings do.
 */

import { useConversationContext } from './ConversationContext'
import { useStructuralAddEvents } from './useStructuralAddEvents'

export function StructuralAddDrainHost(): null {
  const { sendSystemEvent } = useConversationContext()
  useStructuralAddEvents(sendSystemEvent)
  return null
}
