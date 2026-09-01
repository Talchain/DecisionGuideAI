/**
 * Headless aiPanelV2 host for the durable-rename drain.
 *
 * ⚠⚠ THIS FILE EXISTS BECAUSE ITS SIBLING'S CAPABILITY SHIPPED DARK ONCE
 * ALREADY, UNDER A FULLY GREEN SUITE. `StructuralDeleteDrainHost`'s header
 * records it: the delete drain was hosted only in `DraftChat`, which
 * `ReactFlowGraph.tsx` mounts ONLY when `aiPanelV2` is OFF — and it is ON for
 * every fresh user (`flags.ts` `defaultValue: true`, `netlify.toml:57` "true",
 * the literal baked into the deployed bundle, and a DOM census of deployed
 * staging finding `floating-olumi-panel` and no `draft-chat`). The queue was
 * never drained, no turn could ever be sent, and deleting the single call site
 * left 157 files / 1773 tests passing.
 *
 * So the rename drain gets BOTH hosts from the start rather than one and a
 * later correction: `DraftChat` for flag-off, this component for flag-on,
 * mounted unconditionally inside `MaybeConversationProvider`. Copying the
 * mistake and then fixing it again would be the estate paying twice for one
 * lesson.
 *
 * It is deliberately a SEPARATE component from `StructuralDeleteDrainHost` and
 * `PanelApplyDrainHost` so that no file's name becomes a lie about what it
 * hosts. It creates no second conversation and no second turn transport: it
 * consumes the canvas's existing `ConversationProvider` singleton, exactly as
 * its siblings do.
 */

import { useConversationContext } from './ConversationContext'
import { useStructuralRenameEvents } from './useStructuralRenameEvents'

export function StructuralRenameDrainHost(): null {
  const { sendSystemEvent } = useConversationContext()
  useStructuralRenameEvents(sendSystemEvent)
  return null
}
