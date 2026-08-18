/**
 * Headless aiPanelV2 host for the durable-delete drain.
 *
 * ⚠⚠ THIS FILE EXISTS BECAUSE THE FIRST VERSION OF THIS CAPABILITY SHIPPED DARK,
 * AND THE WHOLE SUITE STAYED GREEN. `useStructuralDeleteEvents` was hosted only
 * in `DraftChat`, which `ReactFlowGraph.tsx` mounts ONLY when `aiPanelV2` is
 * OFF — and it is ON for every fresh user (`flags.ts` `defaultValue: true`,
 * `netlify.toml:57` `"true"`, the literal baked into the deployed bundle, and a
 * DOM census of deployed staging finding `floating-olumi-panel` and no
 * `draft-chat`). So the queue was never drained, no `structural_delete` turn
 * could ever be sent, and intents simply accumulated until
 * `DECISION_CONTEXT_CLEAR` discarded them. Deleting the single call site left
 * 157 files / 1773 tests passing.
 *
 * The estate had already solved this for the sibling drain and the fix was to
 * copy the OTHER half: `usePanelApplyDrain` has TWO hosts — `DraftChat` for
 * flag-off and `PanelApplyDrainHost` for flag-on — mounted unconditionally
 * inside `MaybeConversationProvider`. This is the flag-on half for the delete
 * drain, deliberately a SEPARATE component from `PanelApplyDrainHost` so that
 * neither file's name becomes a lie about what it hosts.
 *
 * It creates no second conversation and no second turn transport: it consumes
 * the canvas's existing `ConversationProvider` singleton, exactly as its sibling
 * does. Both hosts are pinned by source inspection in
 * `panelApplyReachability.production.spec.tsx`, so deleting either mount REDs —
 * which is the guard that was missing the first time.
 */

import { useConversationContext } from './ConversationContext'
import { useStructuralDeleteEvents } from './useStructuralDeleteEvents'

export function StructuralDeleteDrainHost(): null {
  const { sendSystemEvent } = useConversationContext()
  useStructuralDeleteEvents(sendSystemEvent)
  return null
}
